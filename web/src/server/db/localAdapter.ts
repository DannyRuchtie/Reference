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
import * as projectsDb from "./projects";
import * as assetsDb from "./assets";
import * as manualMetadataDb from "./manualMetadata";
import * as searchDb from "./search";
import * as canvasDb from "./canvas";
import * as aiDb from "./ai";

export class LocalAdapter implements DbAdapter {
  async getProject(projectId: string): Promise<ProjectRow | null> {
    return projectsDb.getProject(projectId);
  }

  async listProjects(): Promise<ProjectRow[]> {
    return projectsDb.listProjects();
  }

  async createProject(name: string): Promise<ProjectRow> {
    return projectsDb.createProject(name);
  }

  async updateProject(projectId: string, name: string): Promise<boolean> {
    const result = projectsDb.renameProject(projectId, name);
    return result !== null;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    return projectsDb.deleteProject(projectId);
  }

  async getAsset(assetId: string): Promise<AssetWithAi | null> {
    return assetsDb.getAsset(assetId);
  }

  async getAssetAny(assetId: string): Promise<AssetWithAi | null> {
    return assetsDb.getAssetAny(assetId);
  }

  async listAssets(args: {
    projectId: string;
    limit?: number;
    offset?: number;
  }): Promise<AssetWithAi[]> {
    return assetsDb.listAssets(args);
  }

  async insertAsset(
    row: Omit<AssetRow, "created_at" | "deleted_at" | "trashed_storage_path" | "trashed_thumb_path">
  ): Promise<AssetRow> {
    return assetsDb.insertAsset(row);
  }

  async findAssetByProjectSha(projectId: string, sha256: string): Promise<AssetRow | null> {
    return assetsDb.findAssetByProjectSha(projectId, sha256);
  }

  async trashAsset(args: {
    assetId: string;
    deletedAt: string;
    trashedStoragePath: string | null;
    trashedThumbPath: string | null;
  }): Promise<boolean> {
    return assetsDb.trashAsset(args);
  }

  async restoreAsset(assetId: string): Promise<boolean> {
    return assetsDb.restoreAsset(assetId);
  }

  async upsertAssetAi(args: {
    assetId: string;
    status: "pending" | "processing" | "done" | "failed";
    caption?: string | null;
    tagsJson?: string | null;
    modelVersion?: string | null;
  }): Promise<void> {
    assetsDb.upsertAssetAi(args);
  }

  async getAssetManualMetadata(assetId: string): Promise<AssetManualMetadataRow | null> {
    return manualMetadataDb.getAssetManualMetadata(assetId);
  }

  async upsertAssetManualMetadata(args: {
    assetId: string;
    notes?: string | null;
    tags?: string[] | null;
  }): Promise<void> {
    manualMetadataDb.upsertAssetManualMetadata(args);
  }

  async searchAssets(args: {
    projectId: string;
    query: string;
    limit?: number;
  }): Promise<AssetWithAi[]> {
    return searchDb.searchAssets(args);
  }

  async searchAssetsAdvanced(args: {
    projectId: string;
    query: string;
    limit?: number;
    mode: "vector" | "hybrid";
  }): Promise<AssetWithAi[]> {
    return searchDb.searchAssetsAdvanced(args);
  }

  async getCanvasObjects(projectId: string): Promise<CanvasObjectRow[]> {
    return canvasDb.getCanvasObjects(projectId);
  }

  async upsertCanvasObjects(projectId: string, objects: CanvasObjectRow[]): Promise<void> {
    canvasDb.replaceCanvasObjects({
      projectId,
      objects: objects.map((o) => ({
        ...o,
        project_id: undefined, // Will be set by replaceCanvasObjects
        created_at: undefined,
        updated_at: undefined,
      })),
    });
  }

  async getProjectView(projectId: string): Promise<ProjectViewRow | null> {
    return canvasDb.getProjectView(projectId);
  }

  async upsertProjectView(
    projectId: string,
    view: { world_x: number; world_y: number; zoom: number }
  ): Promise<void> {
    canvasDb.upsertProjectView({
      projectId,
      ...view,
    });
  }

  async getProjectSync(projectId: string): Promise<ProjectSyncRow | null> {
    return canvasDb.getProjectSync(projectId);
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
    // For local adapter, we don't need to implement this separately
    // as the sync is managed automatically by canvas operations
    const { getDb } = await import("./db");
    const db = getDb();
    db.prepare(
      `INSERT INTO project_sync (project_id, canvas_rev, view_rev, canvas_updated_at, view_updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         canvas_rev=excluded.canvas_rev,
         view_rev=excluded.view_rev,
         canvas_updated_at=excluded.canvas_updated_at,
         view_updated_at=excluded.view_updated_at`
    ).run(projectId, sync.canvas_rev, sync.view_rev, sync.canvas_updated_at, sync.view_updated_at);
  }

  async getAssetSegment(args: { assetId: string; tag: string }): Promise<AssetSegmentRow | null> {
    return aiDb.getAssetSegment(args);
  }

  async listAssetSegments(assetId: string): Promise<AssetSegmentRow[]> {
    return aiDb.listAssetSegments(assetId);
  }

  async upsertAssetSegment(args: {
    assetId: string;
    tag: string;
    svg?: string | null;
    bboxJson?: string | null;
  }): Promise<void> {
    aiDb.upsertAssetSegment(args);
  }
}

