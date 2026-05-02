import { NextResponse } from "next/server";

import {
  createAdminFolder,
  deleteAdminFolder,
  moveAdminFolder,
  reorderAdminFolder,
  updateAdminFolder,
} from "@/lib/admin/repository";
import { assertAdminAccess, isAuthAccessError } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  CreateFolderInput,
  DeleteFolderInput,
  MoveFolderInput,
  ReorderFolderInput,
  UpdateFolderInput,
} from "@/lib/admin/types";

export async function POST(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const payload = (await request.json()) as CreateFolderInput;
    const folder = await createAdminFolder(payload);
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const payload = (await request.json()) as
      | (UpdateFolderInput & { action?: undefined })
      | ({ action: "move" } & MoveFolderInput)
      | ({ action: "reorder" } & ReorderFolderInput);

    if (payload.action === "move") {
      const folderId = await moveAdminFolder(payload);
      return NextResponse.json({ id: folderId });
    }

    if (payload.action === "reorder") {
      const folderId = await reorderAdminFolder(payload);
      return NextResponse.json({ id: folderId });
    }

    const folder = await updateAdminFolder(payload);
    return NextResponse.json(folder);
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const payload = (await request.json()) as DeleteFolderInput;
    const folderId = await deleteAdminFolder(payload);
    return NextResponse.json({ id: folderId });
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

  return "未知文件夹接口错误。";
}
