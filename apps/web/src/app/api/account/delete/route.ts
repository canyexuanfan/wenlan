import { NextResponse } from "next/server";

import { buildAccountHref } from "@/lib/account/redirects";
import { assertAuthenticatedAccess, viewerCanManageAdmin } from "@/lib/auth/server";
import { buildSameHostUrl } from "@/lib/http/request-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

function buildLoginNoticeHref(notice: string) {
  const params = new URLSearchParams();
  params.set("method", "password");
  params.set("notice", notice);

  return `/login?${params.toString()}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const confirmText = String(formData.get("confirmText") ?? "").trim();

  try {
    const viewer = await assertAuthenticatedAccess();

    if (!viewer.profileId) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "danger",
            deleteError: "登录已失效，请重新登录后再试。",
          }),
        ),
      );
    }

    if (viewerCanManageAdmin(viewer.siteRole)) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "danger",
            deleteError: "管理员账号暂不支持自助注销。",
          }),
        ),
      );
    }

    if (confirmText !== "注销账号") {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "danger",
            deleteError: "请输入“注销账号”后再提交。",
          }),
        ),
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .schema("app")
      .from("profiles")
      .update({ status: "disabled" })
      .eq("id", viewer.profileId);

    if (error) {
      throw error;
    }

    const { client, applyCookies } = await createSupabaseRouteHandlerClient();
    await client.auth.signOut();

    return applyCookies(
      NextResponse.redirect(
        buildSameHostUrl(request, buildLoginNoticeHref("账号已停用，如需恢复请联系管理员。")),
      ),
    );
  } catch {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildAccountHref({
          section: "danger",
          deleteError: "注销失败，请稍后重试。",
        }),
      ),
    );
  }
}
