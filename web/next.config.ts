import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows packaging the Next.js server with minimal runtime files:
  // `web/.next/standalone` (+ `web/.next/static` + `web/public`)
  // This is useful for the Tauri "Option A" desktop wrapper.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp"],
};

export default nextConfig;
