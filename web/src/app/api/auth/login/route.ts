import { z } from "zod";
import { getSupabaseClient } from "@/server/supabase/client";

export const runtime = "nodejs";

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = LoginBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.session) {
    return Response.json({ error: error?.message ?? "Login failed" }, { status: 401 });
  }

  return Response.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    session: data.session,
  });
}

