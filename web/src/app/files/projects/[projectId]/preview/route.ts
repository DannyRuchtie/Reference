import fs from "node:fs";

import { projectPreviewDiskPath } from "@/server/storage/paths";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const p = projectPreviewDiskPath(projectId);
  if (!fs.existsSync(p)) {
    return new Response("Not found", { status: 404 });
  }
  const body = fs.readFileSync(p);
  return new Response(body, {
    headers: {
      "Content-Type": "image/webp",
      // Small, dynamic-ish asset; keep it fresh.
      "Cache-Control": "no-store",
    },
  });
}


