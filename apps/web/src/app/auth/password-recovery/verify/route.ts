import { NextResponse } from "next/server";

import { buildPasswordRecoveryHref } from "@/lib/account/redirects";
import { buildSameHostUrl } from "@/lib/http/request-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function normalizeToken(input: string) {
  return input.replace(/\s/g, "").trim();
}

function translateVerifyError(message?: string | null) {
  switch (message) {
    case "Token has expired or is invalid":
    case "Email link is invalid or has expired":
      return "验证码无效或已过期，请重新获取。";
    default:
      return "验证码校验失败，请稍后再试。";
  }
}

function buildLoginHref(notice: string) {
  const params = new URLSearchParams();
  params.set("method", "password");
  params.set("notice", notice);

  return `/login?${params.toString()}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const token = normalizeToken(String(formData.get("token") ?? ""));
  const nextPassword = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildPasswordRecoveryHref({
          email,
          error: "当前找回密码服务暂不可用，请稍后再试。",
        }),
      ),
    );
  }

  if (!email || !token || !nextPassword || !confirmPassword) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildPasswordRecoveryHref({
          email,
          error: "请完整填写邮箱、验证码和新密码。",
        }),
      ),
    );
  }

  if (nextPassword.length < 8) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildPasswordRecoveryHref({
          email,
          error: "新密码至少需要 8 位。",
        }),
      ),
    );
  }

  if (nextPassword !== confirmPassword) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildPasswordRecoveryHref({
          email,
          error: "两次输入的新密码不一致。",
        }),
      ),
    );
  }

  const { client, applyCookies } = await createSupabaseRouteHandlerClient();
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error || !data.user) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildPasswordRecoveryHref({
          email,
          error: translateVerifyError(error?.message),
        }),
      ),
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { error: updatePasswordError } = await adminClient.auth.admin.updateUserById(data.user.id, {
    password: nextPassword,
  });

  if (updatePasswordError) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildPasswordRecoveryHref({
          email,
          error: "新密码保存失败，请稍后再试。",
        }),
      ),
    );
  }

  await client.auth.signOut();

  return applyCookies(
    NextResponse.redirect(
      buildSameHostUrl(request, buildLoginHref("密码已重置，请使用新密码登录。")),
    ),
  );
}
