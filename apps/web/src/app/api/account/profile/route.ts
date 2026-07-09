import { NextResponse } from "next/server";

import { buildAccountHref } from "@/lib/account/redirects";
import { assertAuthenticatedAccess } from "@/lib/auth/server";
import { buildSameHostUrl } from "@/lib/http/request-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizeDisplayName(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const displayName = normalizeDisplayName(String(formData.get("displayName") ?? ""));

  try {
    const viewer = await assertAuthenticatedAccess();

    if (!viewer.profileId) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "profile",
            profileError: "当前登录状态无效，请重新登录后再试。",
          }),
        ),
      );
    }

    if (!displayName) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "profile",
            profileError: "请输入昵称后再保存。",
          }),
        ),
      );
    }

    if (displayName.length > 40) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "profile",
            profileError: "昵称请控制在 40 个字符以内。",
          }),
        ),
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { error: updateProfileError } = await adminClient
      .schema("app")
      .from("profiles")
      .update({
        display_name: displayName,
      })
      .eq("id", viewer.profileId);

    if (updateProfileError) {
      throw updateProfileError;
    }

    const { error: updateAuthUserError } = await adminClient.auth.admin.updateUserById(viewer.profileId, {
      user_metadata: {
        display_name: displayName,
      },
    });

    if (updateAuthUserError) {
      throw updateAuthUserError;
    }

    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildAccountHref({
          section: "profile",
          profileNotice: "昵称已更新。",
        }),
      ),
    );
  } catch {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildAccountHref({
          section: "profile",
          profileError: "昵称保存失败，请稍后重试。",
        }),
      ),
    );
  }
}
