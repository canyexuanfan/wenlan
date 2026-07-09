import { NextResponse } from "next/server";

import { normalizeRedirectPath } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = normalizeRedirectPath(String(formData.get("redirectTo") ?? "/"));

  if (isSupabaseConfigured()) {
    const { client, applyCookies } = await createSupabaseRouteHandlerClient();
    await client.auth.signOut();
    return applyCookies(NextResponse.redirect(new URL(redirectTo, request.url)));
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
