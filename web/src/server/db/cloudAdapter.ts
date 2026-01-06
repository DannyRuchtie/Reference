import type { DbAdapter } from "./adapter";
import type {
  ProjectRow,
  AssetRow,
  AssetWithAi,
  CanvasObjectRow,
  ProjectViewRow,
  ProjectSyncRow,
  AssetManualMetadataRow,
  AssetSegmentRow,
} from "./types";
import { getSupabaseClient } from "@/server/supabase/client";

export class CloudAdapter implements DbAdapter {
  private async getUserId(): Promise<string> {
    const supabase = await getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error("Not authenticated");
    }
    return user.id;
  }

  async getProject(projectId: string): Promise<ProjectRow | null> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async listProjects(): Promise<ProjectRow[]> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
  }

  async createProject(name: string): Promise<ProjectRow> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        user_id: userId,
      })
      .select()
      .single();
    if (error || !data) throw new Error("Failed to create project");
    return {
      id: data.id,
      name: data.name,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async updateProject(projectId: string, name: string): Promise<boolean> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { error } = await supabase
      .from("projects")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("user_id", userId);
    return !error;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", userId);
    return !error;
  }

  async getAsset(assetId: string): Promise<AssetWithAi | null> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("assets")
      .select(
        `
        *,
        asset_ai(*),
        asset_manual_metadata(*)
      `
      )
      .eq("id", assetId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();
    if (error || !data) return null;
    return this.mapAssetWithAi(data);
  }

  async getAssetAny(assetId: string): Promise<AssetWithAi | null> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("assets")
      .select(
        `
        *,
        asset_ai(*),
        asset_manual_metadata(*)
      `
      )
      .eq("id", assetId)
      .eq("user_id", userId)
      .single();
    if (error || !data) return null;
    return this.mapAssetWithAi(data);
  }

  async listAssets(args: {
    projectId: string;
    limit?: number;
    offset?: number;
  }): Promise<AssetWithAi[]> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const offset = Math.max(args.offset ?? 0, 0);
    const { data, error } = await supabase
      .from("assets")
      .select(
        `
        *,
        asset_ai(*),
        asset_manual_metadata(*)
      `
      )
      .eq("project_id", args.projectId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error || !data) return [];
    return data.map((a) => this.mapAssetWithAi(a));
  }

  async insertAsset(
    row: Omit<AssetRow, "created_at" | "deleted_at" | "trashed_storage_path" | "trashed_thumb_path">
  ): Promise<AssetRow> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("assets")
      .insert({
        ...row,
        user_id: userId,
      })
      .select()
      .single();
    if (error || !data) throw new Error("Failed to insert asset");
    return {
      id: data.id,
      project_id: data.project_id,
      original_name: data.original_name,
      mime_type: data.mime_type,
      byte_size: data.byte_size,
      sha256: data.sha256,
      storage_path: data.storage_path,
      storage_url: data.storage_url,
      thumb_path: data.thumb_path,
      thumb_url: data.thumb_url,
      deleted_at: data.deleted_at,
      trashed_storage_path: data.trashed_storage_path,
      trashed_thumb_path: data.trashed_thumb_path,
      width: data.width,
      height: data.height,
      created_at: data.created_at,
    };
  }

  async findAssetByProjectSha(projectId: string, sha256: string): Promise<AssetRow | null> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", projectId)
      .eq("sha256", sha256)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      project_id: data.project_id,
      original_name: data.original_name,
      mime_type: data.mime_type,
      byte_size: data.byte_size,
      sha256: data.sha256,
      storage_path: data.storage_path,
      storage_url: data.storage_url,
      thumb_path: data.thumb_path,
      thumb_url: data.thumb_url,
      deleted_at: data.deleted_at,
      trashed_storage_path: data.trashed_storage_path,
      trashed_thumb_path: data.trashed_thumb_path,
      width: data.width,
      height: data.height,
      created_at: data.created_at,
    };
  }

  async trashAsset(args: {
    assetId: string;
    deletedAt: string;
    trashedStoragePath: string | null;
    trashedThumbPath: string | null;
  }): Promise<boolean> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { error } = await supabase
      .from("assets")
      .update({
        deleted_at: args.deletedAt,
        trashed_storage_path: args.trashedStoragePath,
        trashed_thumb_path: args.trashedThumbPath,
      })
      .eq("id", args.assetId)
      .eq("user_id", userId)
      .is("deleted_at", null);
    return !error;
  }

  async restoreAsset(assetId: string): Promise<boolean> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { error } = await supabase
      .from("assets")
      .update({
        deleted_at: null,
        trashed_storage_path: null,
        trashed_thumb_path: null,
      })
      .eq("id", assetId)
      .eq("user_id", userId)
      .not("deleted_at", "is", null);
    return !error;
  }

  async upsertAssetAi(args: {
    assetId: string;
    status: "pending" | "processing" | "done" | "failed";
    caption?: string | null;
    tagsJson?: string | null;
    modelVersion?: string | null;
  }): Promise<void> {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("asset_ai").upsert({
      asset_id: args.assetId,
      caption: args.caption ?? null,
      tags_json: args.tagsJson ?? null,
      status: args.status,
      model_version: args.modelVersion ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Failed to upsert asset AI");
  }

  async getAssetManualMetadata(assetId: string): Promise<AssetManualMetadataRow | null> {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("asset_manual_metadata")
      .select("*")
      .eq("asset_id", assetId)
      .single();
    if (error || !data) return null;
    return {
      asset_id: data.asset_id,
      notes: data.notes,
      tags: data.tags,
      updated_at: data.updated_at,
    };
  }

  async upsertAssetManualMetadata(args: {
    assetId: string;
    notes?: string | null;
    tags?: string[] | null;
  }): Promise<void> {
    const supabase = await getSupabaseClient();
    const tagsJson = args.tags ? JSON.stringify(args.tags) : null;
    const { error } = await supabase.from("asset_manual_metadata").upsert({
      asset_id: args.assetId,
      notes: args.notes ?? null,
      tags: tagsJson,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Failed to upsert manual metadata");
  }

  async searchAssets(args: {
    projectId: string;
    query: string;
    limit?: number;
  }): Promise<AssetWithAi[]> {
    // Use PostgreSQL full-text search via RPC function
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const query = args.query.trim();

    if (!query) {
      return this.listAssets({ projectId: args.projectId, limit });
    }

    // Use PostgreSQL full-text search via RPC function
    // This uses tsvector indexes for efficient search with relevance ranking
    const { data, error } = await supabase.rpc("search_assets_fts", {
      p_project_id: args.projectId,
      p_user_id: userId,
      p_query: query,
      p_limit: limit,
    });

    if (error) {
      console.error("RPC search_assets_fts error:", error);
    }

    // If RPC function returns empty results or errors, use fallback
    if (error || !data || data.length === 0) {
      console.log("RPC function returned no results, using fallback search for query:", query);
      
      // Fallback: Search each field separately and combine results
      const searchPattern = `%${query}%`;
      const allResults = new Map<string, any>();
      
      // Search by original_name
      const { data: nameResults } = await supabase
        .from("assets")
        .select(
          `
          *,
          asset_ai(*),
          asset_manual_metadata(*)
        `
        )
        .eq("project_id", args.projectId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .ilike("original_name", searchPattern)
        .limit(limit);
      
      if (nameResults) {
        nameResults.forEach((a: any) => allResults.set(a.id, a));
      }
      
      // Search by AI caption (requires inner join)
      const { data: captionResults } = await supabase
        .from("assets")
        .select(
          `
          *,
          asset_ai!inner(*),
          asset_manual_metadata(*)
        `
        )
        .eq("project_id", args.projectId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .ilike("asset_ai.caption", searchPattern)
        .limit(limit);
      
      if (captionResults) {
        captionResults.forEach((a: any) => allResults.set(a.id, a));
      }
      
      // Search by manual notes
      // First get all assets in this project, then filter by notes
      const { data: projectAssets } = await supabase
        .from("assets")
        .select("id")
        .eq("project_id", args.projectId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(1000); // Get all asset IDs for this project
      
      if (projectAssets && projectAssets.length > 0) {
        const projectAssetIds = projectAssets.map((a: any) => a.id);
        
        // Now search notes for these specific assets
        const { data: notesMetadata } = await supabase
          .from("asset_manual_metadata")
          .select("asset_id")
          .in("asset_id", projectAssetIds)
          .ilike("notes", searchPattern)
          .limit(limit);
        
        if (notesMetadata && notesMetadata.length > 0) {
          const noteAssetIds = notesMetadata.map((m: any) => m.asset_id);
          
          // Get full asset data for matching notes
          const { data: noteAssets } = await supabase
            .from("assets")
            .select(
              `
              *,
              asset_ai(*),
              asset_manual_metadata(*)
            `
            )
            .eq("project_id", args.projectId)
            .eq("user_id", userId)
            .is("deleted_at", null)
            .in("id", noteAssetIds)
            .limit(limit);
          
          if (noteAssets) {
            noteAssets.forEach((a: any) => allResults.set(a.id, a));
          }
        }
      }
      
      // Convert map to array and limit results
      const results = Array.from(allResults.values()).slice(0, limit);
      console.log(`Fallback search found ${results.length} results`);
      return results.map((a) => this.mapAssetWithAi(a));
    }

    // RPC function returns assets with relevance score
    return data.map((a: any) => this.mapAssetWithAi(a));
  }

  async searchAssetsAdvanced(args: {
    projectId: string;
    query: string;
    limit?: number;
    mode: "vector" | "hybrid";
  }): Promise<AssetWithAi[]> {
    // For now, fall back to regular search (vector search can be added later)
    return this.searchAssets(args);
  }

  async getCanvasObjects(projectId: string): Promise<CanvasObjectRow[]> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from("canvas_objects")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("z_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((o) => ({
      id: o.id,
      project_id: o.project_id,
      type: o.type,
      asset_id: o.asset_id,
      x: o.x,
      y: o.y,
      scale_x: o.scale_x,
      scale_y: o.scale_y,
      rotation: o.rotation,
      width: o.width,
      height: o.height,
      z_index: o.z_index,
      props_json: o.props_json,
      created_at: o.created_at,
      updated_at: o.updated_at,
    }));
  }

  async upsertCanvasObjects(projectId: string, objects: CanvasObjectRow[]): Promise<void> {
    const supabase = await getSupabaseClient();
    const userId = await this.getUserId();
    // Delete existing objects
    await supabase.from("canvas_objects").delete().eq("project_id", projectId).eq("user_id", userId);
    // Insert new objects
    if (objects.length > 0) {
      const { error } = await supabase.from("canvas_objects").insert(
        objects.map((o) => ({
          ...o,
          project_id: projectId,
          user_id: userId,
        }))
      );
      if (error) throw new Error("Failed to upsert canvas objects");
    }
    // Update sync
    await this.upsertProjectSync(projectId, {
      canvas_rev: 0, // Will be incremented by trigger or manually
      view_rev: 0,
      canvas_updated_at: new Date().toISOString(),
      view_updated_at: new Date().toISOString(),
    });
  }

  async getProjectView(projectId: string): Promise<ProjectViewRow | null> {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("project_view")
      .select("*")
      .eq("project_id", projectId)
      .single();
    if (error || !data) return null;
    return {
      project_id: data.project_id,
      world_x: data.world_x,
      world_y: data.world_y,
      zoom: data.zoom,
      updated_at: data.updated_at,
    };
  }

  async upsertProjectView(
    projectId: string,
    view: { world_x: number; world_y: number; zoom: number }
  ): Promise<void> {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("project_view").upsert({
      project_id: projectId,
      world_x: view.world_x,
      world_y: view.world_y,
      zoom: view.zoom,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Failed to upsert project view");
  }

  async getProjectSync(projectId: string): Promise<ProjectSyncRow | null> {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("project_sync")
      .select("*")
      .eq("project_id", projectId)
      .single();
    if (error || !data) return null;
    return {
      project_id: data.project_id,
      canvas_rev: data.canvas_rev,
      view_rev: data.view_rev,
      canvas_updated_at: data.canvas_updated_at,
      view_updated_at: data.view_updated_at,
    };
  }

  async upsertProjectSync(
    projectId: string,
    sync: {
      canvas_rev: number;
      view_rev: number;
      canvas_updated_at: string;
      view_updated_at: string;
    }
  ): Promise<void> {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("project_sync").upsert({
      project_id: projectId,
      canvas_rev: sync.canvas_rev,
      view_rev: sync.view_rev,
      canvas_updated_at: sync.canvas_updated_at,
      view_updated_at: sync.view_updated_at,
    });
    if (error) throw new Error("Failed to upsert project sync");
  }

  async getAssetSegment(args: { assetId: string; tag: string }): Promise<AssetSegmentRow | null> {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("asset_segments")
      .select("*")
      .eq("asset_id", args.assetId)
      .eq("tag", args.tag)
      .single();
    if (error || !data) return null;
    return {
      asset_id: data.asset_id,
      tag: data.tag,
      svg: data.svg,
      bbox_json: data.bbox_json,
      updated_at: data.updated_at,
    };
  }

  async listAssetSegments(assetId: string): Promise<AssetSegmentRow[]> {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("asset_segments")
      .select("*")
      .eq("asset_id", assetId)
      .order("tag", { ascending: true });
    if (error || !data) return [];
    return data.map((s) => ({
      asset_id: s.asset_id,
      tag: s.tag,
      svg: s.svg,
      bbox_json: s.bbox_json,
      updated_at: s.updated_at,
    }));
  }

  async upsertAssetSegment(args: {
    assetId: string;
    tag: string;
    svg?: string | null;
    bboxJson?: string | null;
  }): Promise<void> {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("asset_segments").upsert({
      asset_id: args.assetId,
      tag: args.tag,
      svg: args.svg ?? null,
      bbox_json: args.bboxJson ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Failed to upsert asset segment");
  }

  private mapAssetWithAi(data: any): AssetWithAi {
    return {
      id: data.id,
      project_id: data.project_id,
      original_name: data.original_name,
      mime_type: data.mime_type,
      byte_size: data.byte_size,
      sha256: data.sha256,
      storage_path: data.storage_path,
      storage_url: data.storage_url,
      thumb_path: data.thumb_path,
      thumb_url: data.thumb_url,
      deleted_at: data.deleted_at,
      trashed_storage_path: data.trashed_storage_path,
      trashed_thumb_path: data.trashed_thumb_path,
      width: data.width,
      height: data.height,
      created_at: data.created_at,
      ai_caption: data.asset_ai?.caption ?? null,
      ai_tags_json: data.asset_ai?.tags_json ?? null,
      ai_status: data.asset_ai?.status ?? null,
      ai_model_version: data.asset_ai?.model_version ?? null,
      ai_updated_at: data.asset_ai?.updated_at ?? null,
      manual_notes: data.asset_manual_metadata?.notes ?? null,
      manual_tags: data.asset_manual_metadata?.tags ?? null,
    };
  }
}

