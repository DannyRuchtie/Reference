import fs from "node:fs";

import { countCanvasObjectsReferencingAsset, deleteAsset, getAsset } from "@/server/db/assets";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await ctx.params;
  const asset = getAsset(assetId);
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ asset });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await ctx.params;
  const asset = getAsset(assetId);
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });

  // Safety: don't allow deleting an asset while it's still referenced by canvas objects.
  // This prevents the next canvas save from failing FK validation.
  const refs = countCanvasObjectsReferencingAsset(assetId);
  if (refs > 0) {
    return Response.json(
      { error: "Asset is still referenced by canvas objects", refs },
      { status: 409 }
    );
  }

  const ok = deleteAsset(assetId);

  // Best-effort disk cleanup (DB delete is the source of truth).
  const files: string[] = [];
  if (asset.storage_path) files.push(asset.storage_path);
  if (asset.thumb_path) files.push(asset.thumb_path);
  for (const p of files) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }

  return Response.json({ ok });
}


