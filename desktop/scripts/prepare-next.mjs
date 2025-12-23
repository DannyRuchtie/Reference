import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..");
const webDir = path.join(repoRoot, "web");
const outDir = path.join(repoRoot, "desktop", "src-tauri", "resources", "next");

// Require a bundled Node binary for production builds so the app is truly standalone.
execSync("node scripts/check-bundled-node.mjs", {
  cwd: path.join(repoRoot, "desktop"),
  stdio: "inherit",
});

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else if (ent.isSymbolicLink()) {
      const link = fs.readlinkSync(s);
      fs.symlinkSync(link, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log("[desktop] building Next.js (standalone)...");
execSync("npm run build", { cwd: webDir, stdio: "inherit" });

const standaloneDir = path.join(webDir, ".next", "standalone");
const staticDir = path.join(webDir, ".next", "static");
const publicDir = path.join(webDir, "public");

if (!fs.existsSync(standaloneDir)) {
  throw new Error(
    `Missing ${standaloneDir}. Ensure web/next.config.ts has output: "standalone".`
  );
}

console.log("[desktop] copying Next standalone output into Tauri resources...");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1) Copy the standalone server bundle (includes minimal node_modules)
copyDir(standaloneDir, outDir);

// 2) Next requires static assets to be present under ".next/static" next to server.js
copyDir(staticDir, path.join(outDir, ".next", "static"));

// 3) Next expects "public/" next to server.js
if (fs.existsSync(publicDir)) {
  copyDir(publicDir, path.join(outDir, "public"));
}

if (!fs.existsSync(path.join(outDir, "server.js"))) {
  throw new Error(
    `Expected server.js in ${outDir}. Next standalone output structure changed?`
  );
}

console.log("[desktop] done.");


