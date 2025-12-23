import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function spawnCmd(name, cmd, { env = process.env } = {}) {
  const child = spawn(cmd, {
    stdio: "inherit",
    shell: true,
    env,
  });
  child.on("exit", (code, signal) => {
    if (code === 0) return;
    console.log(`[dev] ${name} exited`, { code, signal });
  });
  return child;
}

const stationCmd = process.env.MOONDREAM_STATION_CMD || "moondream-station";
const nextCmd = process.env.NEXT_DEV_CMD || "next dev --webpack";
const startWorker = (process.env.MOONDREAM_START_WORKER ?? "1") !== "0";

const repoRoot = path.resolve(process.cwd(), "..");
const defaultDbPath = path.resolve(repoRoot, "data", "moondream.sqlite3");
const stationEndpoint = process.env.MOONDREAM_ENDPOINT || "http://127.0.0.1:2020";
const workerPy = path.resolve(repoRoot, "worker", "moondream_worker.py");
const workerVenvPy = path.resolve(
  repoRoot,
  "worker",
  ".venv",
  "bin",
  process.platform === "win32" ? "python.exe" : "python"
);
const workerCmd =
  process.env.MOONDREAM_WORKER_CMD ||
  (fs.existsSync(workerVenvPy)
    ? `"${workerVenvPy}" -u "${workerPy}"`
    : `python3 -u "${workerPy}"`);

async function waitForStationHealth({ timeoutMs = 60000 } = {}) {
  const start = Date.now();
  const url = `${stationEndpoint.replace(/\\/$/, "")}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

console.log(`[dev] starting: ${nextCmd}`);
console.log(`[dev] starting: ${stationCmd}`);
if (startWorker) console.log(`[dev] will start worker after station health: ${workerCmd}`);

const next = spawnCmd("next", nextCmd);
const station = spawnCmd("moondream-station", stationCmd);

// If station command isn't available, it will typically exit quickly with non-zero.
// Keep next running, but surface a helpful message.
let stationExited = false;
station.on("exit", (code) => {
  stationExited = true;
  if (code && code !== 0) {
    console.log(
      `[dev] moondream-station failed to start. Ensure it's installed and on PATH.\n` +
        `      You can also override via MOONDREAM_STATION_CMD.\n` +
        `      Example: MOONDREAM_STATION_CMD=\"${stationCmd}\" npm run dev`
    );
  }
});

let worker = null;
let workerExited = false;
(async () => {
  if (!startWorker) return;
  const ok = await waitForStationHealth({ timeoutMs: 60000 });
  if (!ok) {
    console.log(
      `[dev] worker not started: station health check failed at ${stationEndpoint}.\n` +
        `      Ensure Moondream Station is running, or set MOONDREAM_ENDPOINT.`
    );
    return;
  }
  if (!fs.existsSync(workerPy)) {
    console.log(`[dev] worker not started: missing ${workerPy}`);
    return;
  }

  console.log(`[dev] starting worker (db=${defaultDbPath} endpoint=${stationEndpoint})`);
  worker = spawnCmd("worker", workerCmd, {
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      MOONDREAM_DB_PATH: process.env.MOONDREAM_DB_PATH || defaultDbPath,
      MOONDREAM_ENDPOINT: stationEndpoint,
      MOONDREAM_POLL_SECONDS: process.env.MOONDREAM_POLL_SECONDS || "1.0",
    },
  });
  worker.on("exit", () => {
    workerExited = true;
  });
})();

function shutdown() {
  try {
    next.kill("SIGINT");
  } catch {}
  try {
    if (!stationExited) station.kill("SIGINT");
  } catch {}
  try {
    if (worker && !workerExited) worker.kill("SIGINT");
  } catch {}
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

next.on("exit", (code) => {
  shutdown();
  process.exit(code ?? 0);
});


