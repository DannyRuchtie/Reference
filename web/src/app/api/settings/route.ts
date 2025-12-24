import {
  AppSettingsSchema,
  defaultIcloudDir,
  readAppSettings,
  writeAppSettings,
} from "@/server/appConfig";

export const runtime = "nodejs";

export async function GET() {
  const settings = readAppSettings();
  return Response.json({
    settings,
    defaults: {
      icloudDir: defaultIcloudDir(),
      moondreamEndpoint: "http://127.0.0.1:2020",
    },
  });
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = AppSettingsSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const next = parsed.data;

  // If switching to iCloud, ensure the folder exists so the user doesn't have to create it manually.
  if (next.storage.mode === "icloud") {
    const p = (next.storage.icloudPath || defaultIcloudDir() || "").trim();
    if (!p) {
      return Response.json(
        { error: "Could not determine default iCloud Drive folder. Please enter a path." },
        { status: 400 }
      );
    }
    const fs = await import("node:fs");
    fs.mkdirSync(p, { recursive: true });
  }

  writeAppSettings(next);

  return Response.json({ ok: true, settings: next });
}


