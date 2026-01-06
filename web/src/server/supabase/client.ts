import { createServerClient } from "@supabase/ssr";
import { readAppSettings, getSupabaseConfig } from "@/server/appConfig";
import { cookies } from "next/headers";

export async function getSupabaseClient() {
  const settings = readAppSettings();
  if (settings.mode !== "cloud") {
    throw new Error("Supabase client requested but mode is not 'cloud'");
  }

  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  // Create server client that automatically handles cookies from @supabase/ssr
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore errors (e.g., in middleware or during rendering)
        }
      },
    },
  });

  return client;
}

export function resetSupabaseClient() {
  // No-op for server client (it's created per request)
}

