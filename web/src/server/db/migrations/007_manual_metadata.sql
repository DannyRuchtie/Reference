PRAGMA foreign_keys = ON;

-- Manual metadata table for user-editable notes and tags
CREATE TABLE IF NOT EXISTS asset_manual_metadata (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  notes TEXT,
  tags TEXT, -- JSON array of strings
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rebuild asset_search FTS5 table to include manual metadata
-- Note: FTS5 tables cannot be altered, so we must drop and recreate
DROP TABLE IF EXISTS asset_search;

CREATE VIRTUAL TABLE IF NOT EXISTS asset_search USING fts5(
  asset_id UNINDEXED,
  project_id UNINDEXED,
  original_name,
  caption, -- AI caption
  tags, -- AI tags
  manual_notes, -- Manual notes
  manual_tags -- Manual tags
);

