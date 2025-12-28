import fs from "node:fs";
import path from "node:path";

import { countCanvasObjectsReferencingAsset, getAsset, getAssetAny, trashAsset } from "@/server/db/assets";
import { projectTrashAssetsDir, projectTrashThumbsDir } from "@/server/storage/paths";

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

function safeMove(src: string, dest: string) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.renameSync(src, dest);
      return true;
    } catch {
      // If rename fails (e.g. cross-device), copy+unlink.
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      return true;
    }
  } catch {
    return false;
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await ctx.params;
  const asset = getAssetAny(assetId);
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });

  // Idempotency: already trashed.
  if (asset.deleted_at) {
    return Response.json({ ok: true, trashed: true });
  }

  // Safety: don't allow deleting an asset while it's still referenced by canvas objects.
  // This prevents the next canvas save from failing FK validation.
  const refs = countCanvasObjectsReferencingAsset(assetId);
  if (refs > 0) {
    return Response.json(
      { error: "Asset is still referenced by canvas objects", refs },
      { status: 409 }
    );
  }

  const deletedAt = new Date().toISOString();

  // Best-effort disk move into per-project trash (DB is still the source of truth).
  const trashStorageDir = projectTrashAssetsDir(asset.project_id);
  const trashThumbDir = projectTrashThumbsDir(asset.project_id);

  let trashedStoragePath: string | null = null;
  let trashedThumbPath: string | null = null;

  if (asset.storage_path && fs.existsSync(asset.storage_path)) {
    const base = path.basename(asset.storage_path);
    const dest = path.join(trashStorageDir, `${asset.id}-${base}`);
    if (safeMove(asset.storage_path, dest)) trashedStoragePath = dest;
  }

  if (asset.thumb_path && fs.existsSync(asset.thumb_path)) {
    const base = path.basename(asset.thumb_path);
    const dest = path.join(trashThumbDir, `${asset.id}-${base}`);
    if (safeMove(asset.thumb_path, dest)) trashedThumbPath = dest;
  }

  const ok = trashAsset({
    assetId,
    deletedAt,
    trashedStoragePath,
    trashedThumbPath,
  });

  return Response.json({ ok, trashed: true, deletedAt });
}


