import type {
  ProjectRow,
  AssetRow,
  AssetWithAi,
  AssetAiRow,
  CanvasObjectRow,
  ProjectViewRow,
  ProjectSyncRow,
  AssetManualMetadataRow,
  AssetSegmentRow,
} from "./types";

export interface DbAdapter {
  // Projects
  getProject(projectId: string): Promise<ProjectRow | null>;
  listProjects(): Promise<ProjectRow[]>;
  createProject(name: string): Promise<ProjectRow>;
  updateProject(projectId: string, name: string): Promise<boolean>;
  deleteProject(projectId: string): Promise<boolean>;

  // Assets
  getAsset(assetId: string): Promise<AssetWithAi | null>;
  getAssetAny(assetId: string): Promise<AssetWithAi | null>;
  listAssets(args: { projectId: string; limit?: number; offset?: number }): Promise<AssetWithAi[]>;
  insertAsset(
    row: Omit<AssetRow, "created_at" | "deleted_at" | "trashed_storage_path" | "trashed_thumb_path">
  ): Promise<AssetRow>;
  findAssetByProjectSha(projectId: string, sha256: string): Promise<AssetRow | null>;
  trashAsset(args: {
    assetId: string;
    deletedAt: string;
    trashedStoragePath: string | null;
    trashedThumbPath: string | null;
  }): Promise<boolean>;
  restoreAsset(assetId: string): Promise<boolean>;

  // Asset AI
  upsertAssetAi(args: {
    assetId: string;
    status: "pending" | "processing" | "done" | "failed";
    caption?: string | null;
    tagsJson?: string | null;
    modelVersion?: string | null;
  }): Promise<void>;

  // Manual Metadata
  getAssetManualMetadata(assetId: string): Promise<AssetManualMetadataRow | null>;
  upsertAssetManualMetadata(args: {
    assetId: string;
    notes?: string | null;
    tags?: string[] | null;
  }): Promise<void>;

  // Search
  searchAssets(args: { projectId: string; query: string; limit?: number }): Promise<AssetWithAi[]>;
  searchAssetsAdvanced(args: {
    projectId: string;
    query: string;
    limit?: number;
    mode: "vector" | "hybrid";
  }): Promise<AssetWithAi[]>;

  // Canvas
  getCanvasObjects(projectId: string): Promise<CanvasObjectRow[]>;
  upsertCanvasObjects(projectId: string, objects: CanvasObjectRow[]): Promise<void>;

  // Project View
  getProjectView(projectId: string): Promise<ProjectViewRow | null>;
  upsertProjectView(projectId: string, view: { world_x: number; world_y: number; zoom: number }): Promise<void>;

  // Project Sync
  getProjectSync(projectId: string): Promise<ProjectSyncRow | null>;
  upsertProjectSync(projectId: string, sync: {
    canvas_rev: number;
    view_rev: number;
    canvas_updated_at: string;
    view_updated_at: string;
  }): Promise<void>;

  // Asset Segments
  getAssetSegment(args: { assetId: string; tag: string }): Promise<AssetSegmentRow | null>;
  listAssetSegments(assetId: string): Promise<AssetSegmentRow[]>;
  upsertAssetSegment(args: {
    assetId: string;
    tag: string;
    svg?: string | null;
    bboxJson?: string | null;
  }): Promise<void>;
}

