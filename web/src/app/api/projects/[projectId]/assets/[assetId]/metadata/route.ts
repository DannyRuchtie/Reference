import { z } from "zod";

import { getAdapter } from "@/server/db/getAdapter";

export const runtime = "nodejs";

const UpdateMetadataBody = z.object({
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; assetId: string }> }
) {
  const { projectId, assetId } = await ctx.params;
  const adapter = getAdapter();
  const project = await adapter.getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const asset = await adapter.getAsset(assetId);
  if (!asset || asset.project_id !== projectId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const metadata = await adapter.getAssetManualMetadata(assetId);
  return Response.json({
    projectId,
    assetId,
    notes: metadata?.notes ?? null,
    tags: metadata?.tags ? (JSON.parse(metadata.tags) as string[]) : null,
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string; assetId: string }> }
) {
  try {
    const { projectId, assetId } = await ctx.params;
    const adapter = getAdapter();
    const project = await adapter.getProject(projectId);
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });

    const asset = await adapter.getAsset(assetId);
    if (!asset || asset.project_id !== projectId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = UpdateMetadataBody.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Invalid body", details: parsed.error.errors }, { status: 400 });
    }

    await adapter.upsertAssetManualMetadata({
      assetId,
      notes: parsed.data.notes,
      tags: parsed.data.tags ?? undefined,
    });

    const metadata = await adapter.getAssetManualMetadata(assetId);
    return Response.json({
      projectId,
      assetId,
      notes: metadata?.notes ?? null,
      tags: metadata?.tags ? (JSON.parse(metadata.tags) as string[]) : null,
    });
  } catch (error) {
    console.error("Error in PUT /api/projects/[projectId]/assets/[assetId]/metadata:", error);
    return Response.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

