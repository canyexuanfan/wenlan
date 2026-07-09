import { NextResponse } from "next/server";

import { getInviteByToken, hashInviteToken } from "@/lib/auth/invites";
import { buildRegisterHref, ensureProfileForUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

function translateRegisterError(message?: string | null) {
  switch (message) {
    case "User already registered":
      return "这个邮箱已经注册过了。";
    case "Password should be at least 6 characters":
      return "密码长度不足，请重新设置。";
    case "Token has expired or is invalid":
    case "Email link is invalid or has expired":
      return "验证码无效或已过期，请重新获取。";
    default:
      return "注册失败，请稍后再试。";
  }
}

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

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const verificationCode = String(formData.get("verificationCode") ?? "").replace(/\s/g, "").trim();

  try {
    if (!isSupabaseConfigured()) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: "当前注册服务暂不可用，请稍后再试。",
      });
    }

    if (!token || !email || !displayName || !password || !verificationCode) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: "请完整填写所有必填项。",
      });
    }

    if (password.length < 8) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: "密码至少需要 8 位。",
      });
    }

    const invite = await getInviteByToken(token);

    if (!invite.isValid) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: invite.error,
      });
    }

    if (invite.email && invite.email.toLowerCase() !== email) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: "这个邀请仅适用于最初收到邀请的邮箱地址。",
      });
    }

    const { client, applyCookies } = await createSupabaseRouteHandlerClient();
    const { data, error } = await client.auth.verifyOtp({
      email,
      token: verificationCode,
      type: "invite",
    });

    if (error || !data.user) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: translateRegisterError(error?.message),
      });
    }

    const adminClient = createSupabaseAdminClient();
    const { error: updateUserError } = await adminClient.auth.admin.updateUserById(data.user.id, {
      password,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (updateUserError) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: translateRegisterError(updateUserError.message),
      });
    }

    await ensureProfileForUser(data.user, {
      displayName,
      siteRole: invite.siteRole,
    });

    const nextUseCount = Math.min(invite.maxUses, invite.useCount + 1);
    const inviteConsumedAt = nextUseCount >= invite.maxUses ? new Date().toISOString() : null;
    const { error: inviteUpdateError } = await adminClient
      .schema("app")
      .from("invite_tokens")
      .update({
        use_count: nextUseCount,
        used_at: inviteConsumedAt,
      })
      .eq("token_hash", hashInviteToken(token))
      .lt("use_count", invite.maxUses);

    if (inviteUpdateError) {
      return buildRegisterRedirect({
        request,
        token,
        email,
        displayName,
        error: inviteUpdateError.message,
      });
    }

    return applyCookies(NextResponse.redirect(buildSameHostUrl(request, "/")));
  } catch (error) {
    return buildRegisterRedirect({
      request,
      token,
      email,
      displayName,
      error: error instanceof Error ? translateRegisterError(error.message) : "注册失败，请稍后再试。",
    });
  }
}
