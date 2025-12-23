import fs from "node:fs";

import { getProject } from "@/server/db/projects";
import { projectDir, projectPreviewDiskPath } from "@/server/storage/paths";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return Response.json({ error: "Expected image/* body" }, { status: 400 });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  // Safety: keep previews small.
  if (buf.byteLength > 3_000_000) {
    return Response.json({ error: "Preview too large" }, { status: 413 });
  }

  fs.mkdirSync(projectDir(projectId), { recursive: true });
  fs.writeFileSync(projectPreviewDiskPath(projectId), buf);

  return Response.json({ ok: true });
}


