import { getSupabaseClient } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function POST() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ ok: true });
}

