-- Supabase schema for Moondream cloud mode
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table (same structure as local)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assets table (same structure as local)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  thumb_path TEXT,
  thumb_url TEXT,
  width INTEGER,
  height INTEGER,
  deleted_at TIMESTAMPTZ,
  trashed_storage_path TEXT,
  trashed_thumb_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Canvas objects table
CREATE TABLE IF NOT EXISTS canvas_objects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  scale_x REAL NOT NULL DEFAULT 1,
  scale_y REAL NOT NULL DEFAULT 1,
  rotation REAL NOT NULL DEFAULT 0,
  width REAL,
  height REAL,
  z_index INTEGER NOT NULL DEFAULT 0,
  props_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS assets_project_sha256_uq ON assets(project_id, sha256) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS assets_project_id_idx ON assets(project_id);
CREATE INDEX IF NOT EXISTS assets_user_id_idx ON assets(user_id);
CREATE INDEX IF NOT EXISTS assets_deleted_at_idx ON assets(deleted_at);
CREATE INDEX IF NOT EXISTS canvas_objects_project_id_idx ON canvas_objects(project_id);
CREATE INDEX IF NOT EXISTS canvas_objects_user_id_idx ON canvas_objects(user_id);
CREATE INDEX IF NOT EXISTS asset_segments_tag_idx ON asset_segments(tag);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);

-- Full-text search index (using PostgreSQL's built-in FTS)
-- We'll use a materialized view or trigger-based approach for search
CREATE INDEX IF NOT EXISTS assets_original_name_fts_idx ON assets USING gin(to_tsvector('english', original_name));
CREATE INDEX IF NOT EXISTS asset_ai_caption_fts_idx ON asset_ai USING gin(to_tsvector('english', COALESCE(caption, '')));
CREATE INDEX IF NOT EXISTS asset_manual_metadata_notes_fts_idx ON asset_manual_metadata USING gin(to_tsvector('english', COALESCE(notes, '')));

-- Row Level Security (RLS) Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_manual_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_view ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own assets" ON assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets" ON assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets" ON assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" ON assets
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own asset_ai" ON asset_ai
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_ai.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_ai" ON asset_ai
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_ai.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_ai" ON asset_ai
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_ai.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can view their own asset_embeddings" ON asset_embeddings
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_embeddings.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_embeddings" ON asset_embeddings
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_embeddings.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_embeddings" ON asset_embeddings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_embeddings.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can view their own asset_segments" ON asset_segments
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_segments.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_segments" ON asset_segments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_segments.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_segments" ON asset_segments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_segments.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can view their own asset_manual_metadata" ON asset_manual_metadata
  FOR SELECT USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_manual_metadata.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can insert their own asset_manual_metadata" ON asset_manual_metadata
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_manual_metadata.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can update their own asset_manual_metadata" ON asset_manual_metadata
  FOR UPDATE USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_manual_metadata.asset_id AND assets.user_id = auth.uid()));

CREATE POLICY "Users can view their own canvas_objects" ON canvas_objects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own canvas_objects" ON canvas_objects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canvas_objects" ON canvas_objects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canvas_objects" ON canvas_objects
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own project_view" ON project_view
  FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_view.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can insert their own project_view" ON project_view
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_view.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update their own project_view" ON project_view
  FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_view.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can view their own project_sync" ON project_sync
  FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_sync.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can insert their own project_sync" ON project_sync
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_sync.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update their own project_sync" ON project_sync
  FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_sync.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can view their own app_state" ON app_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own app_state" ON app_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app_state" ON app_state
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own app_state" ON app_state
  FOR DELETE USING (auth.uid() = user_id);

-- Storage buckets (run these in Supabase Storage UI or via API)
-- Note: Bucket creation and MIME type restrictions must be done via Supabase Dashboard or API
-- 
-- For 'assets' bucket: Allow images and videos
-- Allowed MIME types:
--   - image/jpeg, image/png, image/webp, image/gif, image/heic, image/svg+xml
--   - video/* (all video types)
--
-- For 'thumbs' bucket: Allow only WebP images
-- Allowed MIME types:
--   - image/webp
--
-- Full-text search function for assets
-- This function uses PostgreSQL's native FTS with tsvector indexes for efficient search
CREATE OR REPLACE FUNCTION search_assets_fts(
  p_project_id TEXT,
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id TEXT,
  project_id TEXT,
  user_id UUID,
  original_name TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  sha256 TEXT,
  storage_path TEXT,
  storage_url TEXT,
  thumb_path TEXT,
  thumb_url TEXT,
  width INTEGER,
  height INTEGER,
  deleted_at TIMESTAMPTZ,
  trashed_storage_path TEXT,
  trashed_thumb_path TEXT,
  created_at TIMESTAMPTZ,
  ai_caption TEXT,
  ai_tags_json TEXT,
  ai_status TEXT,
  ai_model_version TEXT,
  ai_updated_at TIMESTAMPTZ,
  manual_notes TEXT,
  manual_tags TEXT,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.project_id,
    a.user_id,
    a.original_name,
    a.mime_type,
    a.byte_size,
    a.sha256,
    a.storage_path,
    a.storage_url,
    a.thumb_path,
    a.thumb_url,
    a.width,
    a.height,
    a.deleted_at,
    a.trashed_storage_path,
    a.trashed_thumb_path,
    a.created_at,
    ai.caption AS ai_caption,
    ai.tags_json AS ai_tags_json,
    ai.status AS ai_status,
    ai.model_version AS ai_model_version,
    ai.updated_at AS ai_updated_at,
    amm.notes AS manual_notes,
    amm.tags AS manual_tags,
    (
      COALESCE(ts_rank(to_tsvector('english', COALESCE(a.original_name, '')), plainto_tsquery('english', p_query)), 0) * 3.0 +
      COALESCE(ts_rank(to_tsvector('english', COALESCE(ai.caption, '')), plainto_tsquery('english', p_query)), 0) * 2.0 +
      COALESCE(ts_rank(to_tsvector('english', COALESCE(amm.notes, '')), plainto_tsquery('english', p_query)), 0) * 1.5
    ) AS relevance
  FROM assets a
  LEFT JOIN asset_ai ai ON ai.asset_id = a.id
  LEFT JOIN asset_manual_metadata amm ON amm.asset_id = a.id
  WHERE
    a.project_id = p_project_id
    AND a.user_id = p_user_id
    AND a.deleted_at IS NULL
    AND (
      -- Full-text search (more precise, uses stemming)
      to_tsvector('english', COALESCE(a.original_name, '')) @@ plainto_tsquery('english', p_query)
      OR to_tsvector('english', COALESCE(ai.caption, '')) @@ plainto_tsquery('english', p_query)
      OR to_tsvector('english', COALESCE(amm.notes, '')) @@ plainto_tsquery('english', p_query)
      -- Fallback to case-insensitive pattern matching (more forgiving)
      OR LOWER(COALESCE(a.original_name, '')) LIKE LOWER('%' || p_query || '%')
      OR LOWER(COALESCE(ai.caption, '')) LIKE LOWER('%' || p_query || '%')
      OR LOWER(COALESCE(amm.notes, '')) LIKE LOWER('%' || p_query || '%')
    )
  ORDER BY relevance DESC, a.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_assets_fts(TEXT, UUID, TEXT, INTEGER) TO authenticated;

-- Storage policies for bucket access
-- Note: MIME type restrictions are handled at the bucket level (configured in Supabase Dashboard)
-- and validated in application code. These policies handle authentication and access control.

-- Allow authenticated users to upload to 'assets' bucket (in projects folder)
CREATE POLICY "Allow authenticated users to upload to assets bucket" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = 'projects'
  );

-- Allow authenticated users to upload to 'thumbs' bucket (in projects folder)
CREATE POLICY "Allow authenticated users to upload to thumbs bucket" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbs' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = 'projects'
  );

-- Allow authenticated users to read from both buckets
CREATE POLICY "Allow authenticated users to read assets" ON storage.objects
  FOR SELECT
  USING (
    bucket_id IN ('assets', 'thumbs') AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete files from both buckets (in projects folder)
CREATE POLICY "Allow authenticated users to delete their own files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id IN ('assets', 'thumbs') AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = 'projects'
  );

