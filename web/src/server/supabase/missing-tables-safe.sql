-- Missing tables that need to be created (safe version - handles existing policies)
-- Run this in your Supabase SQL Editor to complete the schema setup

-- Asset AI table (preserves all Moondream fields)
CREATE TABLE IF NOT EXISTS asset_ai (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  caption TEXT,
  tags_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  model_version TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset embeddings table (for vector search)
CREATE TABLE IF NOT EXISTS asset_embeddings (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  embedding BYTEA,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset segments table (for tag segmentation overlays)
CREATE TABLE IF NOT EXISTS asset_segments (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  svg TEXT,
  bbox_json TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, tag)
);

-- Manual metadata table
CREATE TABLE IF NOT EXISTS asset_manual_metadata (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  notes TEXT,
  tags TEXT, -- JSON array of strings
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project view table
CREATE TABLE IF NOT EXISTS project_view (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  world_x REAL NOT NULL DEFAULT 0,
  world_y REAL NOT NULL DEFAULT 0,
  zoom REAL NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project sync table
CREATE TABLE IF NOT EXISTS project_sync (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  canvas_rev INTEGER NOT NULL DEFAULT 0,
  view_rev INTEGER NOT NULL DEFAULT 0,
  canvas_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App state table
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for missing tables
CREATE INDEX IF NOT EXISTS asset_segments_tag_idx ON asset_segments(tag);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS asset_ai_caption_fts_idx ON asset_ai USING gin(to_tsvector('english', COALESCE(caption, '')));
CREATE INDEX IF NOT EXISTS asset_manual_metadata_notes_fts_idx ON asset_manual_metadata USING gin(to_tsvector('english', COALESCE(notes, '')));

-- Row Level Security (RLS) for missing tables
ALTER TABLE asset_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_manual_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_view ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
-- Asset AI policies
DROP POLICY IF EXISTS "Users can view their own asset_ai" ON asset_ai;
DROP POLICY IF EXISTS "Users can insert their own asset_ai" ON asset_ai;
DROP POLICY IF EXISTS "Users can update their own asset_ai" ON asset_ai;

CREATE POLICY "Users can view their own asset_ai" ON asset_ai
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_ai.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_ai" ON asset_ai
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_ai.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_ai" ON asset_ai
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_ai.asset_id AND assets.user_id = auth.uid()));

-- Asset embeddings policies
DROP POLICY IF EXISTS "Users can view their own asset_embeddings" ON asset_embeddings;
DROP POLICY IF EXISTS "Users can insert their own asset_embeddings" ON asset_embeddings;
DROP POLICY IF EXISTS "Users can update their own asset_embeddings" ON asset_embeddings;

CREATE POLICY "Users can view their own asset_embeddings" ON asset_embeddings
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_embeddings.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_embeddings" ON asset_embeddings
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_embeddings.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_embeddings" ON asset_embeddings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_embeddings.asset_id AND assets.user_id = auth.uid()));

-- Asset segments policies
DROP POLICY IF EXISTS "Users can view their own asset_segments" ON asset_segments;
DROP POLICY IF EXISTS "Users can insert their own asset_segments" ON asset_segments;
DROP POLICY IF EXISTS "Users can update their own asset_segments" ON asset_segments;

CREATE POLICY "Users can view their own asset_segments" ON asset_segments
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_segments.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_segments" ON asset_segments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_segments.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_segments" ON asset_segments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_segments.asset_id AND assets.user_id = auth.uid()));

-- Asset manual metadata policies
DROP POLICY IF EXISTS "Users can view their own asset_manual_metadata" ON asset_manual_metadata;
DROP POLICY IF EXISTS "Users can insert their own asset_manual_metadata" ON asset_manual_metadata;
DROP POLICY IF EXISTS "Users can update their own asset_manual_metadata" ON asset_manual_metadata;

CREATE POLICY "Users can view their own asset_manual_metadata" ON asset_manual_metadata
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_manual_metadata.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_manual_metadata" ON asset_manual_metadata
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_manual_metadata.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_manual_metadata" ON asset_manual_metadata
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_manual_metadata.asset_id AND assets.user_id = auth.uid()));

-- Project view policies
DROP POLICY IF EXISTS "Users can view their own project_view" ON project_view;
DROP POLICY IF EXISTS "Users can insert their own project_view" ON project_view;
DROP POLICY IF EXISTS "Users can update their own project_view" ON project_view;

CREATE POLICY "Users can view their own project_view" ON project_view
  FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_view.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can insert their own project_view" ON project_view
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_view.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update their own project_view" ON project_view
  FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_view.project_id AND projects.user_id = auth.uid()));

-- Project sync policies
DROP POLICY IF EXISTS "Users can view their own project_sync" ON project_sync;
DROP POLICY IF EXISTS "Users can insert their own project_sync" ON project_sync;
DROP POLICY IF EXISTS "Users can update their own project_sync" ON project_sync;

CREATE POLICY "Users can view their own project_sync" ON project_sync
  FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_sync.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can insert their own project_sync" ON project_sync
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_sync.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update their own project_sync" ON project_sync
  FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_sync.project_id AND projects.user_id = auth.uid()));

-- App state policies
DROP POLICY IF EXISTS "Users can view their own app_state" ON app_state;
DROP POLICY IF EXISTS "Users can insert their own app_state" ON app_state;
DROP POLICY IF EXISTS "Users can update their own app_state" ON app_state;
DROP POLICY IF EXISTS "Users can delete their own app_state" ON app_state;

CREATE POLICY "Users can view their own app_state" ON app_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own app_state" ON app_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app_state" ON app_state
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own app_state" ON app_state
  FOR DELETE USING (auth.uid() = user_id);

