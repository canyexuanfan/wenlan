import { NextResponse } from "next/server";

import { normalizeRedirectPath } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

function translateLoginError(message?: string | null) {
  switch (message) {
    case "Invalid login credentials":
      return "账号或密码不正确。";
    case "Email not confirmed":
      return "当前账号尚未完成验证，请联系管理员。";
    default:
      return "登录失败，请稍后再试。";
  }
}

function buildPasswordLoginHref(redirectTo: string, error?: string | null) {
  const params = new URLSearchParams();

  params.set("method", "password");

  if (redirectTo !== "/") {
    params.set("redirectTo", redirectTo);
  }

  if (error) {
    params.set("error", error);
  }

  return `/login?${params.toString()}`;
}

function buildSameHostUrl(request: Request, path: string) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");

  return new URL(path, `${protocol}://${host}`);
}

function normalizeLoginIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();

  return normalized;
}

function resolveAdminLoginEmail(identifier: string) {
  const adminUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminUsername || !adminEmail) {
    return "";
  }

  return identifier === adminUsername ? adminEmail : "";
}

async function resolveLoginEmail(identifier: string) {
  if (!identifier || identifier.includes("@")) {
    return identifier;
  }

  return resolveAdminLoginEmail(identifier);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = normalizeRedirectPath(String(formData.get("redirectTo") ?? "/"));
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      buildSameHostUrl(request, buildPasswordLoginHref(redirectTo, "当前登录服务暂不可用，请稍后再试。")),
    );
  }

  if (!normalizedIdentifier || !password) {
    return NextResponse.redirect(
      buildSameHostUrl(request, buildPasswordLoginHref(redirectTo, "请输入登录名和密码。")),
    );
  }

  const email = await resolveLoginEmail(normalizedIdentifier);
  const { client, applyCookies } = await createSupabaseRouteHandlerClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.redirect(
      buildSameHostUrl(request, buildPasswordLoginHref(redirectTo, translateLoginError(error.message))),
    );
  }

  return applyCookies(NextResponse.redirect(buildSameHostUrl(request, redirectTo)));
}
