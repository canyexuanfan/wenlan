import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { assertSupabaseConfigured, supabaseEnv } from "./config";

export async function createSupabaseServerClient() {
  assertSupabaseConfigured();

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
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
          // App Router 在某些纯 Server Component 场景不允许写 cookie。
          // 这里静默处理，真正的写 session 场景放在 Route Handler / Server Action 中。
        }
      },
    },
  });
}
