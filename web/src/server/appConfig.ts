import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { repoDataDir } from "@/server/storage/paths";

export const AppSettingsSchema = z.object({
  ai: z
    .object({
      // Moondream Station endpoint (e.g. http://127.0.0.1:2020 or http://127.0.0.1:2021/v1)
      endpoint: z.string().min(1).optional(),
    })
    .default({}),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export function configRootDir() {
  const env = (process.env.MOONDREAM_APP_CONFIG_DIR || "").trim();
  if (env) return path.resolve(env);
  // Dev fallback: keep settings in repo data dir.
  return repoDataDir();
}

export function settingsFilePath() {
  const p = (process.env.MOONDREAM_SETTINGS_PATH || "").trim();
  if (p) return path.resolve(p);
  return path.join(configRootDir(), "settings.json");
}

export function readAppSettings(): AppSettings {
  const file = settingsFilePath();
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = AppSettingsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // ignore
  }
  return AppSettingsSchema.parse({});
}

export function writeAppSettings(next: AppSettings) {
  const root = configRootDir();
  fs.mkdirSync(root, { recursive: true });
  const file = settingsFilePath();
  fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");
}


