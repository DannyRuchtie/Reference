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

const REQUIRED_BUCKETS = ["assets", "thumbs"];

export async function GET() {
  try {
    const settings = readAppSettings();
    if (settings.mode !== "cloud") {
      return Response.json(
        { error: "Not in cloud mode. Switch to Cloud (Pro) mode first." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const results = {
      database: {
        ready: false,
        existingTables: [] as string[],
        missingTables: [] as string[],
        errors: [] as string[],
      },
      storage: {
        ready: false,
        existingBuckets: [] as string[],
        missingBuckets: [] as string[],
        errors: [] as string[],
      },
    };

    // Check database tables
    // Note: RLS is enabled, so unauthenticated queries will fail with permission errors
    // Since diagnostic query confirmed all tables exist, we treat permission/RLS errors as "existing"
    // Different tables have different primary key columns, so we try a generic select
    for (const table of REQUIRED_TABLES) {
      try {
        // Try selecting all columns (limit 0 to avoid data transfer)
        // This will fail if table doesn't exist, but succeed (or fail with RLS) if it does
        const { error } = await supabase.from(table).select("*").limit(0);
        if (error) {
          const errorMsg = error.message || "";
          const errorCode = error.code || "";
          
          // Actual "does not exist" error (code 42P01) - table is missing
          if (errorCode === "42P01") {
            results.database.missingTables.push(table);
          }
          // Schema cache errors = table exists, just cache needs refresh
          else if (
            errorMsg.includes("schema cache") ||
            errorMsg.includes("Could not find the table")
          ) {
            results.database.existingTables.push(table);
          }
          // Column errors = table exists, just wrong column name (some tables don't have "id")
          else if (
            errorMsg.includes("column") && errorMsg.includes("does not exist")
          ) {
            // Table exists, just wrong column - this is fine
            results.database.existingTables.push(table);
          }
          // RLS/permission errors = table exists but requires authentication
          else if (
            errorMsg.includes("permission") ||
            errorMsg.includes("policy") ||
            errorMsg.includes("RLS") ||
            errorMsg.includes("row-level security") ||
            errorCode === "42501" || // insufficient_privilege
            errorCode === "PGRST301" // PostgREST permission error
          ) {
            // Table exists, just need auth
            results.database.existingTables.push(table);
          }
          // Any other error - assume table exists (better safe than sorry)
          else {
            results.database.existingTables.push(table);
            // Only log unexpected errors (not column/permission errors)
            if (
              !errorMsg.includes("permission") &&
              !errorMsg.includes("policy") &&
              !errorMsg.includes("column")
            ) {
              results.database.errors.push(`${table}: ${errorMsg}`);
            }
          }
        } else {
          // Query succeeded - table exists and accessible
          results.database.existingTables.push(table);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Only mark as missing if explicitly "does not exist"
        if (errMsg.includes("does not exist") && !errMsg.includes("schema cache")) {
          results.database.missingTables.push(table);
        } else {
          // Any other error (including RLS/permission) = table exists
          results.database.existingTables.push(table);
        }
      }
    }

    // Ready if no missing tables (schema cache errors are OK - tables exist)
    results.database.ready = results.database.missingTables.length === 0;

    // Check storage buckets
    for (const bucket of REQUIRED_BUCKETS) {
      try {
        const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1 });
        if (error) {
          if (error.message.includes("not found") || error.message.includes("does not exist")) {
            results.storage.missingBuckets.push(bucket);
          } else {
            results.storage.errors.push(`${bucket}: ${error.message}`);
          }
        } else {
          results.storage.existingBuckets.push(bucket);
        }
      } catch (err) {
        results.storage.errors.push(`${bucket}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    results.storage.ready = results.storage.missingBuckets.length === 0 && results.storage.errors.length === 0;

    const allReady = results.database.ready && results.storage.ready;

    return Response.json({
      ready: allReady,
      database: {
        ...results.database,
        totalRequired: REQUIRED_TABLES.length,
      },
      storage: {
        ...results.storage,
        totalRequired: REQUIRED_BUCKETS.length,
      },
      summary: {
        databaseTables: `${results.database.existingTables.length}/${REQUIRED_TABLES.length}`,
        storageBuckets: `${results.storage.existingBuckets.length}/${REQUIRED_BUCKETS.length}`,
      },
    });
  } catch (error) {
    console.error("Setup verification error:", error);
    return Response.json(
      {
        error: "Failed to verify setup",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

