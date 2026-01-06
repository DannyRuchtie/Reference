import {
  AppSettingsSchema,
  readAppSettings,
  writeAppSettings,
} from "@/server/appConfig";

export const runtime = "nodejs";

function withTimeout(ms: number) {
  // AbortSignal.timeout is not available in all Node versions that Next may run under.
  const anySignal = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof anySignal.timeout === "function") return anySignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms).unref?.();
  return c.signal;
}

async function endpointReachable(url: string, timeoutMs: number) {
  try {
    // We don't require 200 here; some servers don't implement GET /v1 and may 404.
    // Any HTTP response indicates "something is listening" (good enough for a default).
    const res = await fetch(url, { method: "GET", signal: withTimeout(timeoutMs) });
    return !!res;
  } catch {
    return false;
  }
}

export async function GET() {
  const settings = readAppSettings();

  // Prefer env (desktop sets MOONDREAM_ENDPOINT from saved settings).
  // Otherwise, use default endpoint.
  const envEndpoint = (process.env.MOONDREAM_ENDPOINT || "").trim();
  const defaultEndpoint = "http://localhost:2023/v1";
  const moondreamEndpoint = envEndpoint || defaultEndpoint;

  return Response.json({
    settings: {
      ...settings,
      ai: {
        ...settings.ai,
      },
    },
    defaults: {
      moondreamEndpoint,
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

  if (next.ai) {
    // Trim endpoint.
    const ep = (next.ai.endpoint || "").trim();
    next.ai.endpoint = ep || undefined;
  }

  writeAppSettings(next);

  return Response.json({ ok: true, settings: next });
}


