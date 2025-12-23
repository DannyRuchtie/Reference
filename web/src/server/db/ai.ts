import type { AssetEmbeddingRow, AssetSegmentRow } from "./types";
import { getDb } from "./db";

export function upsertAssetEmbedding(args: {
  assetId: string;
  model: string;
  dim: number;
  // Store embeddings as a float32 byte buffer (portable). Can be null if embedding step is skipped.
  embedding: Buffer | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO asset_embeddings (asset_id, model, dim, embedding, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET
       model=excluded.model,
       dim=excluded.dim,
       embedding=excluded.embedding,
       updated_at=excluded.updated_at`
  ).run(args.assetId, args.model, args.dim, args.embedding, now);
}

export function upsertAssetSegment(args: {
  assetId: string;
  tag: string;
  svg?: string | null;
  bboxJson?: string | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO asset_segments (asset_id, tag, svg, bbox_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(asset_id, tag) DO UPDATE SET
       svg=excluded.svg,
       bbox_json=excluded.bbox_json,
       updated_at=excluded.updated_at`
  ).run(args.assetId, args.tag, args.svg ?? null, args.bboxJson ?? null, now);
}

export function getAssetSegment(args: { assetId: string; tag: string }): AssetSegmentRow | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM asset_segments WHERE asset_id = ? AND tag = ?")
      .get(args.assetId, args.tag) as AssetSegmentRow | undefined) ?? null
  );
}

export function listAssetSegments(assetId: string): AssetSegmentRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM asset_segments WHERE asset_id = ? ORDER BY tag ASC")
    .all(assetId) as AssetSegmentRow[];
}


