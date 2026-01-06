import { z } from "zod";
import fs from "node:fs";

import { getAdapter } from "@/server/db/getAdapter";
import { projectDir } from "@/server/storage/paths";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const adapter = getAdapter();
  const project = await adapter.getProject(projectId);
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ project });
}

const RenameBody = z.object({
  name: z.string().min(1).max(200),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = RenameBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });

  const adapter = getAdapter();
  const ok = await adapter.updateProject(projectId, parsed.data.name);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  const project = await adapter.getProject(projectId);
  return Response.json({ project });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const adapter = getAdapter();
  const ok = await adapter.deleteProject(projectId);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });

  // Best-effort disk cleanup: remove the project folder (assets + thumbs).
  // DB deletion is the source of truth; failures here should not block the response.
  try {
    fs.rmSync(projectDir(projectId), { recursive: true, force: true });
  } catch {
    // ignore
  }

  return Response.json({ ok: true });
}


