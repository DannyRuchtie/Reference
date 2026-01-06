import { z } from "zod";

import { getAdapter } from "@/server/db/getAdapter";

export const runtime = "nodejs";

const CreateProjectBody = z.object({
  name: z.string().min(1).max(200),
});

export async function GET(req: Request) {
  const adapter = getAdapter();
  const url = new URL(req.url);
  const localOnly = url.searchParams.get("local") === "true";

  if (localOnly) {
    // Return local projects only (for migration check)
    const { readAppSettings } = await import("@/server/appConfig");
    const settings = readAppSettings();
    if (settings.mode === "cloud") {
      // Use local adapter directly to get local projects
      const { LocalAdapter } = await import("@/server/db/localAdapter");
      const localAdapter = new LocalAdapter();
      const projects = await localAdapter.listProjects();
      return Response.json({ projects });
    }
  }

  const projects = await adapter.listProjects();
  return Response.json({ projects });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = CreateProjectBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const adapter = getAdapter();
  const project = await adapter.createProject(parsed.data.name);
  return Response.json({ project });
}


