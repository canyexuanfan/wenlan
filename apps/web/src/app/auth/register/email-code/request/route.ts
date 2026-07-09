import { NextResponse } from "next/server";

import { getInviteByToken } from "@/lib/auth/invites";
import { sendInviteRegistrationCodeEmail } from "@/lib/email/invite-registration-code";
import { buildRegisterHref } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function buildSameHostUrl(request: Request, path: string) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");

  return new URL(path, `${protocol}://${host}`);
}

function buildRegisterRedirect(input: {
  request: Request;
  token?: string | null;
  email?: string | null;
  displayName?: string | null;
  error?: string | null;
  notice?: string | null;
}) {
  return NextResponse.redirect(
    buildSameHostUrl(
      input.request,
      buildRegisterHref({
        token: input.token,
        email: input.email,
        displayName: input.displayName,
        error: input.error,
        notice: input.notice,
      }),
    ),
  );
}

function isJsonRequest(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return (
    request.headers.get("x-register-email-code-request") === "fetch" || accept.includes("application/json")
  );
}

function buildRegisterResponse(input: {
  request: Request;
  token?: string | null;
  email?: string | null;
  displayName?: string | null;
  error?: string | null;
  notice?: string | null;
  status?: number;
}) {
  if (isJsonRequest(input.request)) {
    return NextResponse.json(
      {
        error: input.error ?? null,
        notice: input.notice ?? null,
      },
      { status: input.status ?? (input.error ? 400 : 200) },
    );
  }

  return buildRegisterRedirect(input);
}

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function isEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function translateEmailCodeError(message?: string | null) {
  switch (message) {
    case "Unable to validate email address: invalid format":
      return "这个邮箱暂时不能接收验证码。";
    case "Email rate limit exceeded":
    case "For security purposes, you can only request this after":
      return "验证码发送过于频繁，请稍后再试。";
    case "邮件服务还没有配置好，请联系管理员。":
    case "Error sending confirmation email":
    case "Error sending magic link email":
      return "邮件服务还没有配置好，请联系管理员。";
    default:
      return "验证码发送失败，请稍后再试。";
  }
}

async function findProfileByEmail(email: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findAuthUserByEmail(email: string) {
  const adminClient = createSupabaseAdminClient();
  let page = 1;

  while (page > 0) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const matchedUser =
      data.users.find((user) => user.email?.trim().toLowerCase() === email) ?? null;

    if (matchedUser) {
      return matchedUser;
    }

    page = data.nextPage ?? 0;
  }

  return null;
}

async function hardDeleteAuthUser(userId: string) {
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

async function prepareInviteAuthUserForRegistration(email: string) {
  const existingUser = await findAuthUserByEmail(email);

  if (existingUser) {
    if (existingUser.email_confirmed_at) {
      await hardDeleteAuthUser(existingUser.id);
    }
  }
}

async function generateInviteRegistrationCode(input: {
  email: string;
  registerUrl: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    email: input.email,
    options: {
      redirectTo: input.registerUrl,
    },
    type: "invite",
  });

  if (error) {
    throw error;
  }

  const actionLink = data.properties?.action_link ?? "";
  const emailOtp = data.properties?.email_otp ?? "";

  if (!actionLink || !emailOtp) {
    throw new Error("验证码发送失败，请稍后再试。");
  }

  return {
    actionLink,
    emailOtp,
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const displayName = String(formData.get("displayName") ?? "").trim();

  try {
    if (!isSupabaseConfigured()) {
      return buildRegisterResponse({
        request,
        token,
        email,
        displayName,
        error: "当前注册服务暂不可用，请稍后再试。",
        status: 503,
      });
    }

    if (!token || !isEmail(email)) {
      return buildRegisterResponse({
        request,
        token,
        email,
        displayName,
        error: "请输入有效的邮箱地址。",
        status: 400,
      });
    }

    const invite = await getInviteByToken(token);

    if (!invite.isValid) {
      return buildRegisterResponse({
        request,
        token,
        email,
        displayName,
        error: invite.error,
        status: 400,
      });
    }

    if (invite.email && invite.email.toLowerCase() !== email) {
      return buildRegisterResponse({
        request,
        token,
        email,
        displayName,
        error: "这个邀请仅适用于最初收到邀请的邮箱地址。",
        status: 400,
      });
    }

    const existingProfile = await findProfileByEmail(email);

    if (existingProfile) {
      return buildRegisterResponse({
        request,
        token,
        email,
        displayName,
        error: "这个邮箱已经注册过了。",
        status: 409,
      });
    }

    const registerUrl = buildSameHostUrl(
      request,
      buildRegisterHref({
        token,
        email,
        displayName,
      }),
    ).toString();

    await prepareInviteAuthUserForRegistration(email);
    const { emailOtp } = await generateInviteRegistrationCode({
      email,
      registerUrl,
    });
    await sendInviteRegistrationCodeEmail({
      code: emailOtp,
      registerUrl,
      siteUrl: buildSameHostUrl(request, "/").toString(),
      to: email,
    });

    return buildRegisterResponse({
      request,
      token,
      email,
      displayName,
      notice: "验证码已发送，请查收邮箱。",
    });
  } catch (error) {
    const message = error instanceof Error ? translateEmailCodeError(error.message) : "验证码发送失败，请稍后再试。";
    return buildRegisterResponse({
      request,
      token,
      email,
      displayName,
      error: message,
      status: 500,
    });
  }
}
