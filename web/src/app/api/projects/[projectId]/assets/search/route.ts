import { z } from "zod";

import { getAdapter } from "@/server/db/getAdapter";

export const runtime = "nodejs";

const SearchQuery = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().optional(),
  mode: z.enum(["fts", "vector", "hybrid"]).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const adapter = getAdapter();
  const project = await adapter.getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const parsed = SearchQuery.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit"),
    mode: url.searchParams.get("mode") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid query" }, { status: 400 });
  }

  const mode = parsed.data.mode ?? "fts";
  const query = parsed.data.q ?? "";
  const limit = parsed.data.limit;

  const assets =
    mode === "fts"
      ? await adapter.searchAssets({ projectId, query, limit })
      : await adapter.searchAssetsAdvanced({ projectId, query, limit, mode });
  return Response.json({ projectId, assets });
}


