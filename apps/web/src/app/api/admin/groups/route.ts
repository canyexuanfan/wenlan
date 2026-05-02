import { NextResponse } from "next/server";

import {
  createAdminGroup,
  deleteAdminGroup,
  syncAdminGroupMembers,
  updateAdminGroup,
} from "@/lib/admin/repository";
import type {
  CreateGroupInput,
  SyncGroupMembersInput,
  UpdateGroupInput,
} from "@/lib/admin/types";
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
        { error: "未配置用于用户组管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以创建用户组。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as CreateGroupInput;
    const group = await createAdminGroup(payload, viewer);
    return NextResponse.json(group, { status: 201 });
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
        { error: "未配置用于用户组管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以更新用户组。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as SyncGroupMembersInput | UpdateGroupInput;
    const group = Array.isArray((payload as SyncGroupMembersInput).memberIds)
      ? await syncAdminGroupMembers(payload as SyncGroupMembersInput, viewer)
      : await updateAdminGroup(payload as UpdateGroupInput, viewer);
    return NextResponse.json(group);
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
        { error: "未配置用于用户组管理的 Supabase。" },
        { status: 400 },
      );
    }

    const viewer = await assertAdminAccess();

    if (!viewerCanManageMembers(viewer.siteRole)) {
      return NextResponse.json(
        { error: "只有管理员可以删除用户组。" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { groupId?: string };

    if (!payload.groupId) {
      return NextResponse.json({ error: "请选择要删除的用户组。" }, { status: 400 });
    }

    const group = await deleteAdminGroup(payload.groupId, viewer);
    return NextResponse.json(group);
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

  return "未知用户组接口错误。";
}
