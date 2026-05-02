import { NextResponse } from "next/server";

import { normalizeRedirectPath } from "@/lib/auth/server";
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

function isEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function translateEmailCodeError(message?: string | null) {
  switch (message) {
    case "Signups not allowed for this instance":
    case "Unable to validate email address: invalid format":
      return "这个邮箱暂时不能接收验证码。";
    case "Email rate limit exceeded":
    case "For security purposes, you can only request this after":
      return "验证码发送太频繁，请稍后再试。";
    case "Error sending magic link email":
      return "邮件服务还没有配置好，请联系管理员。";
    default:
      return "验证码发送失败，请稍后再试。";
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
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

  if (!isEmail(email)) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildEmailCodeHref({
          email,
          redirectTo,
          error: "请输入有效的邮箱地址。",
        }),
      ),
    );
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildEmailCodeHref({
          email,
          redirectTo,
          error: translateEmailCodeError(error.message),
        }),
      ),
    );
  }

  return NextResponse.redirect(
    buildSameHostUrl(
      request,
      buildEmailCodeHref({
        email,
        redirectTo,
        notice: "验证码已发送，请查收邮箱。",
      }),
    ),
  );
}
