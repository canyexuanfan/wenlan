import { NextResponse } from "next/server";

import { removeAdminProfile, updateAdminProfile } from "@/lib/admin/repository";
import type { UpdateProfileInput } from "@/lib/admin/types";
import {
  assertAdminAccess,
  isAuthAccessError,
  viewerCanManageMembers,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function PATCH(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "未配置用于成员管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以修改成员角色。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as UpdateProfileInput;
    const profile = await updateAdminProfile(payload, viewer);
    return NextResponse.json(profile);
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "未配置用于成员管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以移出成员。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { id: string };
    const profile = await removeAdminProfile(payload.id, viewer);
    return NextResponse.json(profile);
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

  return "未知成员接口错误。";
}
