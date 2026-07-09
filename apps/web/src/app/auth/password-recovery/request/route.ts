import { NextResponse } from "next/server";

import { buildPasswordRecoveryHref } from "@/lib/account/redirects";
import { buildSameHostUrl } from "@/lib/http/request-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function isEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function translateRecoveryRequestError(message?: string | null) {
  switch (message) {
    case "Email rate limit exceeded":
    case "For security purposes, you can only request this after":
      return "验证码发送太频繁了，请稍后再试。";
    case "Error sending magic link email":
      return "邮件服务暂时不可用，请稍后再试。";
    default:
      return "验证码发送失败，请稍后再试。";
  }
}

function isJsonRequest(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return (
    request.headers.get("x-password-recovery-code-request") === "fetch" ||
    accept.includes("application/json")
  );
}

function buildPasswordRecoveryResponse(
  request: Request,
  input: {
    email?: string | null;
    error?: string | null;
    notice?: string | null;
    status?: number;
  },
) {
  if (isJsonRequest(request)) {
    return NextResponse.json(
      {
        error: input.error ?? null,
        notice: input.notice ?? null,
      },
      { status: input.status ?? (input.error ? 400 : 200) },
    );
  }

  return NextResponse.redirect(
    buildSameHostUrl(
      request,
      buildPasswordRecoveryHref({
        email: input.email,
        error: input.error,
        notice: input.notice,
      }),
    ),
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!isSupabaseConfigured()) {
    return buildPasswordRecoveryResponse(request, {
      email,
      error: "当前找回密码服务暂不可用，请稍后再试。",
      status: 503,
    });
  }

  if (!isEmail(email)) {
    return buildPasswordRecoveryResponse(request, {
      email,
      error: "请输入有效的邮箱地址。",
      status: 400,
    });
  }

  const adminClient = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .schema("app")
    .from("profiles")
    .select("id, status")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    return buildPasswordRecoveryResponse(request, {
      email,
      error: "无法校验当前邮箱，请稍后再试。",
      status: 500,
    });
  }

  if (!profile || profile.status === "disabled" || profile.status === "removed") {
    return buildPasswordRecoveryResponse(request, {
      email,
      error: "这个邮箱暂时不能用于找回密码。",
      status: 400,
    });
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return buildPasswordRecoveryResponse(request, {
      email,
      error: translateRecoveryRequestError(error.message),
      status: 400,
    });
  }

  return buildPasswordRecoveryResponse(request, {
    email,
    notice: "验证码已发送，请查收邮箱并继续重置密码。",
  });
}
