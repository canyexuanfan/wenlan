import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  assertServiceRoleConfigured,
  supabaseEnv,
} from "./config";

export function createSupabaseAdminClient() {
  assertServiceRoleConfigured();

  return createClient<Database>(
    supabaseEnv.url,
    supabaseEnv.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
