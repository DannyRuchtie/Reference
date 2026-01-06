import fs from "node:fs";
import path from "node:path";

import { getAdapter } from "@/server/db/getAdapter";
import { readAppSettings } from "@/server/appConfig";
import { projectTrashAssetsDir, projectTrashThumbsDir } from "@/server/storage/paths";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await ctx.params;
  const adapter = getAdapter();
  const asset = await adapter.getAsset(assetId);
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
  const adapter = getAdapter();
  const settings = readAppSettings();
  const asset = await adapter.getAssetAny(assetId);
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });

  // Idempotency: already trashed.
  if (asset.deleted_at) {
    return Response.json({ ok: true, trashed: true });
  }

  // Safety: don't allow deleting an asset while it's still referenced by canvas objects.
  // This prevents the next canvas save from failing FK validation.
  // Note: For cloud mode, we'd need to add a count method to the adapter
  // For now, skip this check in cloud mode
  if (settings.mode === "local") {
    const { countCanvasObjectsReferencingAsset } = await import("@/server/db/assets");
    const refs = countCanvasObjectsReferencingAsset(assetId);
    if (refs > 0) {
      return Response.json(
        { error: "Asset is still referenced by canvas objects", refs },
        { status: 409 }
      );
    }
  }

  const deletedAt = new Date().toISOString();

  let trashedStoragePath: string | null = null;
  let trashedThumbPath: string | null = null;

  // Only move files in local mode
  if (settings.mode === "local") {
    const trashStorageDir = projectTrashAssetsDir(asset.project_id);
    const trashThumbDir = projectTrashThumbsDir(asset.project_id);

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
  }

  const ok = await adapter.trashAsset({
    assetId,
    deletedAt,
    trashedStoragePath,
    trashedThumbPath,
  });

  return Response.json({ ok, trashed: true, deletedAt });
}


