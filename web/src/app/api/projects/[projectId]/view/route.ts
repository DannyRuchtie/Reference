import { z } from "zod";

import { getAdapter } from "@/server/db/getAdapter";

export const runtime = "nodejs";

const ViewBody = z.object({
  world_x: z.number(),
  world_y: z.number(),
  zoom: z.number(),
  baseViewRev: z.number().int().min(0).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const adapter = getAdapter();
  const project = await adapter.getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  const view = await adapter.getProjectView(projectId);
  const sync = await adapter.getProjectSync(projectId);
  return Response.json({
    projectId,
    view,
    viewRev: sync?.view_rev ?? 0,
    viewUpdatedAt: sync?.view_updated_at ?? new Date().toISOString(),
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
  const parsed = ViewBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });

  const current = await adapter.getProjectSync(projectId);
  const base = parsed.data.baseViewRev;
  if (typeof base === "number" && current && base !== current.view_rev) {
    return Response.json(
      {
        error: "Conflict: view is newer on disk",
        viewRev: current.view_rev,
        viewUpdatedAt: current.view_updated_at,
      },
      { status: 409 }
    );
  }

  await adapter.upsertProjectView(projectId, {
    world_x: parsed.data.world_x,
    world_y: parsed.data.world_y,
    zoom: parsed.data.zoom,
  });
  const next = await adapter.getProjectSync(projectId);
  return Response.json({
    ok: true,
    viewRev: next?.view_rev ?? 0,
    viewUpdatedAt: next?.view_updated_at ?? new Date().toISOString(),
  });
}


