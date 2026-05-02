import { NextResponse } from "next/server";

import { getSupabaseConnectionState } from "@/lib/supabase/health";

export function GET() {
  return NextResponse.json({
    ok: true,
    backend: "supabase",
    ...getSupabaseConnectionState(),
  });
}
