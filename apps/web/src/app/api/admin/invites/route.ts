import { NextResponse } from "next/server";

import {
  createAdminInvite,
  deleteAdminInvite,
  reissueAdminInvite,
} from "@/lib/admin/repository";
import type { CreateInviteInput } from "@/lib/admin/types";
import {
  assertAdminAccess,
  isAuthAccessError,
  viewerCanManageMembers,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "未配置用于邀请管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以管理邀请。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as CreateInviteInput;
    const invite = await createAdminInvite(payload, viewer);
    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "未配置用于邀请管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以重新生成邀请。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { id: string };
    const invite = await reissueAdminInvite(payload.id, viewer);
    return NextResponse.json(invite);
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
        { error: "未配置用于邀请管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以作废邀请。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { id: string };
    const invite = await deleteAdminInvite(payload.id, viewer);
    return NextResponse.json(invite);
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

  return "未知邀请接口错误。";
}
