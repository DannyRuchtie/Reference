import { z } from "zod";

import { getDb } from "@/server/db/db";

export const runtime = "nodejs";

const Body = z
  .object({
    // If omitted, retries all failed assets in the project.
    assetId: z.string().min(1).optional(),
  })
  .strict();

export async function POST(req: Request, props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const db = getDb();

  let changes = 0;
  if (parsed.data.assetId) {
    const info = db
      .prepare(
        `UPDATE asset_ai
         SET status='pending', updated_at=datetime('now')
         WHERE asset_id = ?`
      )
      .run(parsed.data.assetId) as unknown as { changes?: number };
    changes = info?.changes ?? 0;
  } else {
    const info = db
      .prepare(
        `UPDATE asset_ai
         SET status='pending', updated_at=datetime('now')
         WHERE status = 'failed'
           AND asset_id IN (SELECT id FROM assets WHERE project_id = ?)`
      )
      .run(projectId) as unknown as { changes?: number };
    changes = info?.changes ?? 0;
  }

  return Response.json({ ok: true, changes });
}


