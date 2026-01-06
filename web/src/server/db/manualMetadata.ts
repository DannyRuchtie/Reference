import { getDb } from "./db";
import type { AssetManualMetadataRow } from "./types";
import { upsertAssetSearchRow } from "./search";

export function getAssetManualMetadata(assetId: string): AssetManualMetadataRow | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM asset_manual_metadata WHERE asset_id = ?")
      .get(assetId) as AssetManualMetadataRow | undefined) ?? null
  );
}

export function upsertAssetManualMetadata(args: {
  assetId: string;
  notes?: string | null;
  tags?: string[] | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const tagsJson = args.tags ? JSON.stringify(args.tags) : null;

  db.prepare(
    `INSERT INTO asset_manual_metadata (asset_id, notes, tags, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET
       notes=excluded.notes,
       tags=excluded.tags,
       updated_at=excluded.updated_at`
  ).run(args.assetId, args.notes ?? null, tagsJson, now);

  // Update search index
  const asset = db
    .prepare(
      `SELECT a.id, a.project_id, a.original_name,
              ai.caption, ai.tags_json,
              mm.notes AS manual_notes, mm.tags AS manual_tags_json
       FROM assets a
       LEFT JOIN asset_ai ai ON ai.asset_id = a.id
       LEFT JOIN asset_manual_metadata mm ON mm.asset_id = a.id
       WHERE a.id = ?`
    )
    .get(args.assetId) as
    | {
        id: string;
        project_id: string;
        original_name: string;
        caption: string | null;
        tags_json: string | null;
        manual_notes: string | null;
        manual_tags_json: string | null;
      }
    | undefined;

  if (asset) {
    let aiTags: string[] = [];
    try {
      aiTags = asset.tags_json ? (JSON.parse(asset.tags_json) as string[]) : [];
    } catch {
      aiTags = [];
    }

    let manualTags: string[] = [];
    try {
      manualTags = asset.manual_tags_json ? (JSON.parse(asset.manual_tags_json) as string[]) : [];
    } catch {
      manualTags = [];
    }

    upsertAssetSearchRow({
      projectId: asset.project_id,
      assetId: asset.id,
      originalName: asset.original_name,
      caption: asset.caption,
      tags: aiTags,
      manualNotes: asset.manual_notes,
      manualTags,
    });
  }
}

