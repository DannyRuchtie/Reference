import { getSupabaseClient } from "@/server/supabase/client";
import fs from "node:fs";

// Allowed MIME types for each bucket
const ALLOWED_ASSETS_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/svg+xml",
  // Video types (check prefix)
] as const;

const ALLOWED_THUMBS_MIME_TYPES = ["image/webp"] as const;

function isAllowedMimeType(bucket: string, contentType: string): boolean {
  if (bucket === "assets") {
    // Allow image types
    if (ALLOWED_ASSETS_MIME_TYPES.includes(contentType as any)) {
      return true;
    }
    // Allow video types
    if (contentType.startsWith("video/")) {
      return true;
    }
    return false;
  }
  if (bucket === "thumbs") {
    return ALLOWED_THUMBS_MIME_TYPES.includes(contentType as any);
  }
  return false;
}

export async function uploadToSupabaseStorage(
  bucket: string,
  path: string,
  filePath: string,
  contentType?: string
): Promise<string> {
  const supabase = await getSupabaseClient();
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.split("/").pop() || "file";

  // Validate MIME type
  const mimeType = contentType || "application/octet-stream";
  if (!isAllowedMimeType(bucket, mimeType)) {
    throw new Error(
      `Invalid MIME type "${mimeType}" for bucket "${bucket}". Allowed types: ${
        bucket === "assets"
          ? "image/jpeg, image/png, image/webp, image/gif, image/heic, image/svg+xml, video/*"
          : "image/webp"
      }`
    );
  }

  const { data, error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

export async function deleteFromSupabaseStorage(bucket: string, path: string): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Failed to delete from Supabase Storage: ${error.message}`);
}

