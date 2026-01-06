import { getSupabaseClient } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseClient();
  const {
    data: { user, session },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json({ user: null, session: null });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
    },
    session,
  });
}

