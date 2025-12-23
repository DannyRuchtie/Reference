PRAGMA foreign_keys = ON;

-- Store caption embeddings for semantic/vector search.
-- We keep this schema portable so it can be migrated to Supabase/pgvector later.
CREATE TABLE IF NOT EXISTS asset_embeddings (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  embedding BLOB,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Store per-tag segmentation results so searches like "apple" can highlight on-image regions.
-- One row per (asset_id, tag).
CREATE TABLE IF NOT EXISTS asset_segments (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  svg TEXT,
  bbox_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (asset_id, tag)
);

CREATE INDEX IF NOT EXISTS asset_segments_tag_idx ON asset_segments(tag);


