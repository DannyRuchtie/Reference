import { getSupabaseConfig } from "@/server/appConfig";

export const runtime = "nodejs";

export async function GET() {
  const config = getSupabaseConfig();
  return Response.json({
    url: config.url,
    publishableKey: config.publishableKey,
  });
}

