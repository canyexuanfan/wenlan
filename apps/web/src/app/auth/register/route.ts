import { NextResponse } from "next/server";

import { getInviteByToken, hashInviteToken } from "@/lib/auth/invites";
import { buildRegisterHref, ensureProfileForUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function translateRegisterError(message?: string | null) {
  switch (message) {
    case "User already registered":
      return "这个邮箱已经注册过了。";
    case "Password should be at least 6 characters":
      return "密码长度不足，请重新设置。";
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

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.redirect(
        buildSameHostUrl(request, buildRegisterHref(token, "当前注册服务暂不可用，请稍后再试。")),
      );
    }

    if (!token || !email || !displayName || !password) {
      return NextResponse.redirect(
        buildSameHostUrl(request, buildRegisterHref(token, "请完整填写所有必填项。")),
      );
    }

    if (password.length < 8) {
      return NextResponse.redirect(
        buildSameHostUrl(request, buildRegisterHref(token, "密码至少需要 8 位。")),
      );
    }

    const invite = await getInviteByToken(token);

    if (!invite.isValid) {
      return NextResponse.redirect(buildSameHostUrl(request, buildRegisterHref(token, invite.error)));
    }

    if (invite.email && invite.email.toLowerCase() !== email) {
      return NextResponse.redirect(
        buildSameHostUrl(request, buildRegisterHref(token, "这个邀请仅适用于最初收到邀请的邮箱地址。")),
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (error || !data.user) {
      return NextResponse.redirect(
        buildSameHostUrl(request, buildRegisterHref(token, translateRegisterError(error?.message))),
      );
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
      return NextResponse.redirect(
        buildSameHostUrl(request, buildRegisterHref(token, inviteUpdateError.message)),
      );
    }

    const client = await createSupabaseServerClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.redirect(
        buildSameHostUrl(request, buildRegisterHref(token, "账号已创建，但自动登录失败，请返回登录页手动登录。")),
      );
    }

    return NextResponse.redirect(buildSameHostUrl(request, "/"));
  } catch (error) {
    return NextResponse.redirect(
      buildSameHostUrl(
        request,
        buildRegisterHref(
          token,
          error instanceof Error ? translateRegisterError(error.message) : "注册失败，请稍后再试。",
        ),
      ),
    );
  }
}
