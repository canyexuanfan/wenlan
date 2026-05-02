import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { assertSupabaseConfigured, supabaseEnv } from "./config";

export function createSupabaseBrowserClient() {
  assertSupabaseConfigured();

  return createBrowserClient<Database>(
    supabaseEnv.url,
    supabaseEnv.anonKey,
  );
}
