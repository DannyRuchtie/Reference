import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..");
const workerDir = path.join(repoRoot, "worker");
const venvDir = path.join(workerDir, ".venv_desktop_build");
const py = path.join(venvDir, "bin", "python3");

const workerPy = path.join(workerDir, "moondream_worker.py");
const reqs = path.join(workerDir, "requirements_desktop.txt");
const outBin = path.join(repoRoot, "desktop", "src-tauri", "resources", "bin", "moondream-worker");

function run(cmd, cwd = repoRoot) {
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

if (!fs.existsSync(workerPy)) {
  throw new Error(`Missing worker entrypoint: ${workerPy}`);
}
if (!fs.existsSync(reqs)) {
  throw new Error(`Missing worker requirements: ${reqs}`);
}

console.log("[desktop] building bundled python worker (pyinstaller)...");

// Create venv if needed
if (!fs.existsSync(py)) {
  run(`python3 -m venv "${venvDir}"`, workerDir);
}

// Install deps into build venv
run(`"${py}" -m pip install --upgrade pip`, workerDir);
run(`"${py}" -m pip install -r "${reqs}"`, workerDir);
run(`"${py}" -m pip install pyinstaller==6.11.1`, workerDir);

// Build onefile executable (arm64)
const distDir = path.join(workerDir, "dist");
const buildDir = path.join(workerDir, "build");
run(
  `"${py}" -m PyInstaller ` +
    `--clean --noconfirm ` +
    `--name moondream-worker ` +
    `--onefile ` +
    `--noconsole ` +
    `--distpath "${distDir}" ` +
    `--workpath "${buildDir}" ` +
    `"${workerPy}"`,
  workerDir
);

const built = path.join(distDir, "moondream-worker");
if (!fs.existsSync(built)) {
  throw new Error(`PyInstaller did not produce expected binary: ${built}`);
}

fs.mkdirSync(path.dirname(outBin), { recursive: true });
fs.copyFileSync(built, outBin);
fs.chmodSync(outBin, 0o755);

console.log(`[desktop] worker binary ready: ${outBin}`);


