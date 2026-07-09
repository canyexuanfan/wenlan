import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { buildAccountHref } from "@/lib/account/redirects";
import { assertAuthenticatedAccess } from "@/lib/auth/server";
import { buildSameHostUrl } from "@/lib/http/request-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

function normalizePasswordInput(input: FormDataEntryValue | null) {
  return String(input ?? "");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const currentPassword = normalizePasswordInput(formData.get("currentPassword"));
  const nextPassword = normalizePasswordInput(formData.get("nextPassword"));
  const confirmPassword = normalizePasswordInput(formData.get("confirmPassword"));

  try {
    const viewer = await assertAuthenticatedAccess();

    if (!viewer.profileId || !viewer.email) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "security",
            passwordError: "当前账号缺少邮箱信息，暂时无法修改密码。",
          }),
        ),
      );
    }

    if (!currentPassword || !nextPassword || !confirmPassword) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "security",
            passwordError: "请完整填写当前密码和新密码。",
          }),
        ),
      );
    }

    if (nextPassword.length < 8) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "security",
            passwordError: "新密码至少需要 8 位。",
          }),
        ),
      );
    }

    if (nextPassword !== confirmPassword) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "security",
            passwordError: "两次输入的新密码不一致。",
          }),
        ),
      );
    }

    if (currentPassword === nextPassword) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "security",
            passwordError: "新密码不能和当前密码相同。",
          }),
        ),
      );
    }

    const verifyClient = createClient<Database>(supabaseEnv.serverUrl, supabaseEnv.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: viewer.email,
      password: currentPassword,
    });

    if (verifyError) {
      return NextResponse.redirect(
        buildSameHostUrl(
          request,
          buildAccountHref({
            section: "security",
            passwordError: "当前密码不正确。",
          }),
        ),
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { error: updatePasswordError } = await adminClient.auth.admin.updateUserById(viewer.profileId, {
      password: nextPassword,
    });

    if (updatePasswordError) {
      throw updatePasswordError;
    }

    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildAccountHref({
          section: "security",
          passwordNotice: "密码已更新，下次登录请使用新密码。",
        }),
      ),
    );
  } catch {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildAccountHref({
          section: "security",
          passwordError: "密码修改失败，请稍后重试。",
        }),
      ),
    );
  }
}
