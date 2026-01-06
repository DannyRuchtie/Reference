"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;
let settingsPromise: Promise<{ url: string; publishableKey: string }> | null = null;

async function fetchSupabaseConfig(): Promise<{ url: string; publishableKey: string }> {
  if (settingsPromise) return settingsPromise;

  settingsPromise = (async () => {
    // Fetch Supabase config from API (server provides it from env vars)
    const res = await fetch("/api/supabase/config");
    if (!res.ok) throw new Error("Failed to fetch Supabase config");
    const data = (await res.json()) as { url: string; publishableKey: string };
    return data;
  })();

  return settingsPromise;
}

export async function getSupabaseClient() {
  if (client) return client;

  const { url, publishableKey } = await fetchSupabaseConfig();
  // Use createBrowserClient from @supabase/ssr to handle cookies automatically
  client = createBrowserClient(url, publishableKey);
  return client;
}

export function resetSupabaseClient() {
  client = null;
  settingsPromise = null;
}

