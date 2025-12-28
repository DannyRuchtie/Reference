import fs from "node:fs";
import path from "node:path";

import { getAssetAny, restoreAsset, upsertAssetSearchRowForAsset } from "@/server/db/assets";

export const runtime = "nodejs";

function safeMove(src: string, dest: string) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) {
      // Destination already exists (e.g. re-uploaded). Keep it and just drop the trashed file.
      try {
        fs.unlinkSync(src);
      } catch {
        // ignore
      }
      return true;
    }
    try {
      fs.renameSync(src, dest);
      return true;
    } catch {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      return true;
    }
  } catch {
    return false;
  }
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await ctx.params;
  const asset = getAssetAny(assetId);
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });

  // Idempotent.
  if (!asset.deleted_at) {
    return Response.json({ ok: true, restored: true });
  }

  // Best-effort move files back.
  if (asset.trashed_storage_path && asset.storage_path && fs.existsSync(asset.trashed_storage_path)) {
    safeMove(asset.trashed_storage_path, asset.storage_path);
  }
  if (asset.trashed_thumb_path && asset.thumb_path && fs.existsSync(asset.trashed_thumb_path)) {
    safeMove(asset.trashed_thumb_path, asset.thumb_path);
  }

  let ok = false;
  try {
    ok = restoreAsset(assetId);
  } catch (e) {
    // Most likely: unique constraint (e.g. you re-uploaded the same file while it was trashed).
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
  if (ok) {
    // Re-add to search index.
    upsertAssetSearchRowForAsset(assetId);
  }

  return Response.json({ ok, restored: true });
}


