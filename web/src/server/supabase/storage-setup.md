# Supabase Storage Setup Guide

## Step 1: Create Storage Buckets

In your Supabase Dashboard:

1. Go to **Storage** → **Buckets**
2. Click **New Bucket**
3. Create bucket: `assets`
   - Name: `assets`
   - Public: ✅ Yes (checked)
   - File size limit: Set as needed (e.g., 50MB)
   - Allowed MIME types: Leave empty (we'll restrict via policies)
4. Create bucket: `thumbs`
   - Name: `thumbs`
   - Public: ✅ Yes (checked)
   - File size limit: Set as needed (e.g., 5MB)
   - Allowed MIME types: Leave empty (we'll restrict via policies)

## Step 2: Configure MIME Type Restrictions

### Option A: Via Supabase Dashboard (Recommended)

1. Go to **Storage** → **Policies**
2. For the `assets` bucket:
   - Create a new policy for INSERT operations
   - Policy name: `Allow image and video uploads`
   - Target roles: `authenticated`
   - Policy definition:
   ```sql
   (
     bucket_id = 'assets' AND
     (
       (storage.foldername(name))[1] = 'projects' AND
       (
         (storage.contenttype(name) IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/svg+xml')) OR
         (storage.contenttype(name) LIKE 'video/%')
       )
     )
   )
   ```

3. For the `thumbs` bucket:
   - Create a new policy for INSERT operations
   - Policy name: `Allow WebP uploads`
   - Target roles: `authenticated`
   - Policy definition:
   ```sql
   (
     bucket_id = 'thumbs' AND
     storage.contenttype(name) = 'image/webp'
   )
   ```

### Option B: Via SQL Editor

Run the storage policies from `schema.sql` (the policies are included at the end of the file).

## Step 3: Verify Setup

After setting up, test by:

1. Signing in to your app
2. Uploading an image (should work)
3. Trying to upload a non-image file (should be rejected)

## Allowed MIME Types

### `assets` bucket:
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `image/heic`
- `image/svg+xml`
- `video/*` (all video types)

### `thumbs` bucket:
- `image/webp` (only)

## Notes

- The application code also validates MIME types before upload as an additional security layer
- Storage policies provide server-side enforcement
- Both layers work together to ensure only allowed file types are stored

