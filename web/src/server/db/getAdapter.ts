import { readAppSettings } from "@/server/appConfig";
import { LocalAdapter } from "./localAdapter";
import { CloudAdapter } from "./cloudAdapter";
import type { DbAdapter } from "./adapter";

let cachedAdapter: DbAdapter | null = null;
let cachedMode: "local" | "cloud" | null = null;

export function getAdapter(): DbAdapter {
  const settings = readAppSettings();
  const mode = settings.mode ?? "local";

  // Return cached adapter if mode hasn't changed
  if (cachedAdapter && cachedMode === mode) {
    return cachedAdapter;
  }

  // Create new adapter based on mode
  if (mode === "cloud") {
    cachedAdapter = new CloudAdapter();
  } else {
    cachedAdapter = new LocalAdapter();
  }

  cachedMode = mode;
  return cachedAdapter;
}

export function resetAdapterCache() {
  cachedAdapter = null;
  cachedMode = null;
}

