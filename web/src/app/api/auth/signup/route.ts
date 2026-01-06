import { z } from "zod";
import { getSupabaseClient } from "@/server/supabase/client";

export const runtime = "nodejs";

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = SignupBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return Response.json({ error: error?.message ?? "Signup failed" }, { status: 400 });
  }

  return Response.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    session: data.session,
  });
}

