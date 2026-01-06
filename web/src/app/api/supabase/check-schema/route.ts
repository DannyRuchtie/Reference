import { getSupabaseClient } from "@/server/supabase/client";
import { readAppSettings } from "@/server/appConfig";

export const runtime = "nodejs";

const REQUIRED_TABLES = [
  "projects",
  "assets",
  "asset_ai",
  "asset_manual_metadata",
  "asset_embeddings",
  "asset_segments",
  "canvas_objects",
  "project_view",
  "project_sync",
  "app_state",
];

export async function GET() {
  try {
    const settings = readAppSettings();
    if (settings.mode !== "cloud") {
      return Response.json({ error: "Not in cloud mode" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const missingTables: string[] = [];
    const existingTables: string[] = [];

    // Check each required table
    for (const table of REQUIRED_TABLES) {
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error) {
        // If error code is 42P01, table doesn't exist
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          missingTables.push(table);
        } else {
          // Other error (permissions, etc.)
          console.error(`Error checking table ${table}:`, error);
        }
      } else {
        existingTables.push(table);
      }
    }

    return Response.json({
      schemaReady: missingTables.length === 0,
      existingTables,
      missingTables,
      totalRequired: REQUIRED_TABLES.length,
    });
  } catch (error) {
    console.error("Schema check error:", error);
    return Response.json(
      { error: "Failed to check schema", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

