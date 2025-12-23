import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..");
const nodePath = path.join(repoRoot, "desktop", "src-tauri", "resources", "bin", "node");

function isExecutable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

if (!fs.existsSync(nodePath)) {
  throw new Error(
    `Missing bundled Node binary at:\n` +
      `  ${nodePath}\n\n` +
      `To build a truly-standalone app, copy an Apple Silicon (arm64) Node binary there and:\n` +
      `  chmod +x "${nodePath}"`
  );
}

if (!isExecutable(nodePath)) {
  throw new Error(
    `Bundled Node exists but is not executable:\n` +
      `  ${nodePath}\n\n` +
      `Fix with:\n` +
      `  chmod +x "${nodePath}"`
  );
}

console.log(`[desktop] bundled node ok: ${nodePath}`);


