import { NextResponse } from "next/server";

import { getAdminWorkspaceData } from "@/lib/admin/repository";
import type { AdminWorkspaceMode } from "@/lib/admin/types";
import { assertAdminAccess, isAuthAccessError } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const workspaceModes = new Set<AdminWorkspaceMode>(["all", "content", "members"]);

export async function GET(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const { searchParams } = new URL(request.url);
    const requestedMode = searchParams.get("mode");
    const mode = workspaceModes.has((requestedMode as AdminWorkspaceMode) ?? "all")
      ? ((requestedMode as AdminWorkspaceMode) ?? "all")
      : "all";

    const workspace = await getAdminWorkspaceData(mode);
    return NextResponse.json(workspace);
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }

  return "未知后台工作区错误。";
}
