import { readAppSettings } from "@/server/appConfig";
import { LocalAdapter } from "@/server/db/localAdapter";
import { CloudAdapter } from "@/server/db/cloudAdapter";
import { uploadToSupabaseStorage } from "@/server/storage/supabaseStorage";
import fs from "node:fs";
import path from "node:path";
import * as projectsDb from "@/server/db/projects";
import * as assetsDb from "@/server/db/assets";
import * as manualMetadataDb from "@/server/db/manualMetadata";
import * as aiDb from "@/server/db/ai";
import * as canvasDb from "@/server/db/canvas";

export const runtime = "nodejs";

export async function POST() {
  try {
    const settings = readAppSettings();
    if (settings.mode !== "cloud") {
      return Response.json({ error: "Must be in cloud mode to migrate" }, { status: 400 });
    }

    // Get all local projects directly from DB (bypass adapter to get local projects even in cloud mode)
    const localProjects = projectsDb.listProjects();
    if (localProjects.length === 0) {
      return Response.json({ message: "No local projects to migrate", migrated: 0 });
    }

    const cloudAdapter = new CloudAdapter();
    let migrated = 0;
    const errors: string[] = [];

    for (const project of localProjects) {
      try {
        // Create project in cloud
        const cloudProject = await cloudAdapter.createProject(project.name);

        // Migrate assets
        const assets = assetsDb.listAssets({ projectId: project.id, limit: 10000 });
        for (const asset of assets) {
          if (asset.deleted_at) continue; // Skip trashed assets

          try {
            // Upload asset file to Supabase Storage
            let storageUrl = asset.storage_url;
            let thumbUrl = asset.thumb_url;

            if (asset.storage_path && fs.existsSync(asset.storage_path)) {
              try {
                const assetPath = `projects/${cloudProject.id}/assets/${path.basename(asset.storage_path)}`;
                storageUrl = await uploadToSupabaseStorage("assets", assetPath, asset.storage_path, asset.mime_type);
                console.log(`Uploaded asset ${asset.id} to ${storageUrl}`);
              } catch (uploadError) {
                errors.push(`Failed to upload asset file for ${asset.id}: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
                // Continue with original URL if upload fails
              }
            }

            if (asset.thumb_path && fs.existsSync(asset.thumb_path)) {
              try {
                const thumbPath = `projects/${cloudProject.id}/thumbs/${path.basename(asset.thumb_path)}`;
                thumbUrl = await uploadToSupabaseStorage("thumbs", thumbPath, asset.thumb_path, "image/webp");
                console.log(`Uploaded thumb ${asset.id} to ${thumbUrl}`);
              } catch (uploadError) {
                errors.push(`Failed to upload thumb for ${asset.id}: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
                // Continue with original URL if upload fails
              }
            }

            // Insert asset in cloud
            await cloudAdapter.insertAsset({
              id: asset.id,
              project_id: cloudProject.id,
              original_name: asset.original_name,
              mime_type: asset.mime_type,
              byte_size: asset.byte_size,
              sha256: asset.sha256,
              storage_path: asset.storage_path, // Keep original path for reference
              storage_url: storageUrl,
              thumb_path: asset.thumb_path,
              thumb_url: thumbUrl,
              width: asset.width,
              height: asset.height,
            });

            // Migrate AI data
            if (asset.ai_status) {
              await cloudAdapter.upsertAssetAi({
                assetId: asset.id,
                status: asset.ai_status,
                caption: asset.ai_caption,
                tagsJson: asset.ai_tags_json,
                modelVersion: asset.ai_model_version,
              });
            }

            // Migrate manual metadata
            const manualMetadata = manualMetadataDb.getAssetManualMetadata(asset.id);
            if (manualMetadata) {
              let tags: string[] | null = null;
              if (manualMetadata.tags) {
                try {
                  tags = JSON.parse(manualMetadata.tags) as string[];
                } catch {
                  tags = null;
                }
              }
              await cloudAdapter.upsertAssetManualMetadata({
                assetId: asset.id,
                notes: manualMetadata.notes,
                tags: tags ?? undefined,
              });
            }

            // Migrate segments
            const segments = aiDb.listAssetSegments(asset.id);
            for (const segment of segments) {
              await cloudAdapter.upsertAssetSegment({
                assetId: asset.id,
                tag: segment.tag,
                svg: segment.svg,
                bboxJson: segment.bbox_json,
              });
            }
          } catch (err) {
            errors.push(`Failed to migrate asset ${asset.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // Migrate canvas objects
        const canvasObjects = canvasDb.getCanvasObjects(project.id);
        if (canvasObjects.length > 0) {
          await cloudAdapter.upsertCanvasObjects(cloudProject.id, canvasObjects);
        }

        // Migrate project view
        const view = canvasDb.getProjectView(project.id);
        if (view) {
          await cloudAdapter.upsertProjectView(cloudProject.id, {
            world_x: view.world_x,
            world_y: view.world_y,
            zoom: view.zoom,
          });
        }

        migrated++;
      } catch (err) {
        errors.push(`Failed to migrate project ${project.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return Response.json({
      message: `Migrated ${migrated} project(s)`,
      migrated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return Response.json(
      { error: "Migration failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

