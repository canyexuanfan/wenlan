import { NextResponse } from "next/server";

import { ensureProfileForUser, normalizeRedirectPath } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildEmailCodeHref(input: {
  email?: string | null;
  redirectTo?: string | null;
  error?: string | null;
  notice?: string | null;
}) {
  const params = new URLSearchParams();
  const redirectTo = normalizeRedirectPath(input.redirectTo);

  params.set("method", "email");

  if (input.email?.trim()) {
    params.set("email", input.email.trim());
  }

  if (redirectTo !== "/") {
    params.set("redirectTo", redirectTo);
  }

  if (input.error) {
    params.set("error", input.error);
  }

  if (input.notice) {
    params.set("notice", input.notice);
  }

  return `/login?${params.toString()}`;
}

function buildSameHostUrl(request: Request, path: string) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");

  return new URL(path, `${protocol}://${host}`);
}

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

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const token = normalizeToken(String(formData.get("token") ?? ""));
  const redirectTo = normalizeRedirectPath(String(formData.get("redirectTo") ?? "/"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildEmailCodeHref({
          email,
          redirectTo,
          error: "当前登录服务暂不可用，请稍后再试。",
        }),
      ),
    );
  }

  if (!email || !token) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildEmailCodeHref({
          email,
          redirectTo,
          error: "请输入邮箱和验证码。",
        }),
      ),
    );
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error || !data.user) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildEmailCodeHref({
          email,
          redirectTo,
          error: translateVerifyError(error?.message),
        }),
      ),
    );
  }

  await ensureProfileForUser(data.user);

  return NextResponse.redirect(buildSameHostUrl(request, redirectTo));
}
