import { NextResponse } from "next/server";

import { syncAdminAccessGrants } from "@/lib/admin/repository";
import type { SyncAccessGrantsInput } from "@/lib/admin/types";
import {
  assertAdminAccess,
  isAuthAccessError,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function PATCH(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "未配置用于访问授权的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();
    const payload = (await request.json()) as SyncAccessGrantsInput;
    const grants = await syncAdminAccessGrants(payload, viewer);
    return NextResponse.json(grants);
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }

  return "未知访问授权接口错误。";
}
