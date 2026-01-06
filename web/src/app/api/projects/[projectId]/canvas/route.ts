import { z } from "zod";

import { getAdapter } from "@/server/db/getAdapter";

export const runtime = "nodejs";

const CanvasObject = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "text", "shape", "group"]),
  asset_id: z.string().nullable().optional(),
  x: z.number(),
  y: z.number(),
  scale_x: z.number(),
  scale_y: z.number(),
  rotation: z.number(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  z_index: z.number().int(),
  props_json: z.string().nullable().optional(),
});

const SaveCanvasBody = z.object({
  objects: z.array(CanvasObject),
  baseCanvasRev: z.number().int().min(0).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const adapter = getAdapter();
  const project = await adapter.getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const objects = await adapter.getCanvasObjects(projectId);
  const sync = await adapter.getProjectSync(projectId);
  return Response.json({
    projectId,
    objects,
    canvasRev: sync?.canvas_rev ?? 0,
    canvasUpdatedAt: sync?.canvas_updated_at ?? new Date().toISOString(),
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const adapter = getAdapter();
  const project = await adapter.getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = SaveCanvasBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const current = await adapter.getProjectSync(projectId);
  const base = parsed.data.baseCanvasRev;
  if (typeof base === "number" && current && base !== current.canvas_rev) {
    return Response.json(
      {
        error: "Conflict: canvas is newer on disk",
        canvasRev: current.canvas_rev,
        canvasUpdatedAt: current.canvas_updated_at,
      },
      { status: 409 }
    );
  }

  const normalized = parsed.data.objects.map((o) => ({
    id: o.id,
    project_id: projectId,
    type: o.type,
    asset_id: o.asset_id ?? null,
    x: o.x,
    y: o.y,
    scale_x: o.scale_x,
    scale_y: o.scale_y,
    rotation: o.rotation,
    width: o.width ?? null,
    height: o.height ?? null,
    z_index: o.z_index,
    props_json: o.props_json ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  await adapter.upsertCanvasObjects(projectId, normalized);
  const next = await adapter.getProjectSync(projectId);
  return Response.json({
    ok: true,
    canvasRev: next?.canvas_rev ?? 0,
    canvasUpdatedAt: next?.canvas_updated_at ?? new Date().toISOString(),
  });
}


