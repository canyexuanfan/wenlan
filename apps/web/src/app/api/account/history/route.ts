import { NextResponse } from "next/server";

import { resolveAccountTargetSnapshot } from "@/lib/account/repository";
import { assertAuthenticatedAccess } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type HistoryPayload = {
  targetId?: string;
  targetType?: "folder" | "document";
};

function isTargetType(value: string): value is "folder" | "document" {
  return value === "folder" || value === "document";
}

export async function POST(request: Request) {
  try {
    const viewer = await assertAuthenticatedAccess();

    if (!viewer.profileId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const payload = (await request.json()) as HistoryPayload;
    const targetId = String(payload.targetId ?? "").trim();
    const targetType = String(payload.targetType ?? "").trim();

    if (!targetId || !isTargetType(targetType)) {
      return NextResponse.json({ error: "Invalid target." }, { status: 400 });
    }

    const snapshot = await resolveAccountTargetSnapshot(targetType, targetId);

    if (!snapshot) {
      return NextResponse.json({ error: "Target not found." }, { status: 404 });
    }

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .schema("app")
      .from("user_recent_views")
      .upsert(
        {
          user_id: viewer.profileId,
          target_type: targetType,
          target_id: targetId,
          route_path: snapshot.routePath,
          title: snapshot.title,
          description: snapshot.description,
          context_title: snapshot.contextTitle,
          visited_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,target_type,target_id",
        },
      );

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Unable to record recent view." }, { status: 500 });
  }
}
