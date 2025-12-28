import path from "node:path";

export function repoDataDir() {
  // In dev, Next.js runs with cwd = web/ so repo-root /data is at ../data.
  // In a packaged desktop app, point this at a writable per-user directory via:
  //   MOONDREAM_DATA_DIR=/path/to/app-data
  const fromEnv = (process.env.MOONDREAM_DATA_DIR || "").trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "..", "data");
}

export function projectDir(projectId: string) {
  return path.join(repoDataDir(), "projects", projectId);
}

export function projectAssetsDir(projectId: string) {
  return path.join(projectDir(projectId), "assets");
}

export function projectThumbsDir(projectId: string) {
  return path.join(projectDir(projectId), "thumbs");
}

export function projectTrashDir(projectId: string) {
  return path.join(projectDir(projectId), "trash");
}

export function projectTrashAssetsDir(projectId: string) {
  return path.join(projectTrashDir(projectId), "assets");
}

export function projectTrashThumbsDir(projectId: string) {
  return path.join(projectTrashDir(projectId), "thumbs");
}

export function projectPreviewDiskPath(projectId: string) {
  return path.join(projectDir(projectId), "preview.webp");
}

export function projectPreviewUrlPath(projectId: string) {
  return `/files/projects/${projectId}/preview`;
}

export function assetDiskPath(projectId: string, filename: string) {
  return path.join(projectAssetsDir(projectId), filename);
}

export function thumbDiskPath(projectId: string, filename: string) {
  return path.join(projectThumbsDir(projectId), filename);
}

export function assetUrlPath(projectId: string, filename: string) {
  return `/files/projects/${projectId}/assets/${filename}`;
}

export function thumbUrlPath(projectId: string, filename: string) {
  return `/files/projects/${projectId}/thumbs/${filename}`;
}


