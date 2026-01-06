-- Diagnostic query to check what tables and policies actually exist
-- Run this in Supabase SQL Editor to see the current state

-- Check which tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('projects', 'assets', 'asset_ai', 'asset_manual_metadata', 'asset_embeddings', 'asset_segments', 'canvas_objects', 'project_view', 'project_sync', 'app_state') 
    THEN '✓ Required'
    ELSE 'Other'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check which policies exist for our tables
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('projects', 'assets', 'asset_ai', 'asset_manual_metadata', 'asset_embeddings', 'asset_segments', 'canvas_objects', 'project_view', 'project_sync', 'app_state')
ORDER BY tablename, policyname;

-- Check if RLS is enabled on our tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'assets', 'asset_ai', 'asset_manual_metadata', 'asset_embeddings', 'asset_segments', 'canvas_objects', 'project_view', 'project_sync', 'app_state')
ORDER BY tablename;

