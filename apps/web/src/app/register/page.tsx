import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/public/auth-frame";
import { getInviteByToken } from "@/lib/auth/invites";
import { getAuthViewer } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "注册",
  description: "通过邀请链接注册账号。",
};

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
    token?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const viewer = await getAuthViewer();
  const resolvedSearchParams = await searchParams;
  const token = String(resolvedSearchParams.token ?? "").trim();
  const error = resolvedSearchParams.error ? decodeURIComponent(resolvedSearchParams.error) : "";

  if (viewer.isAuthenticated) {
    redirect("/");
  }

  const invite = isSupabaseConfigured() && token ? await getInviteByToken(token) : null;

  return (
    <AuthFrame>
      <section className="login-simple-stage" aria-labelledby="register-title">
        <section className="login-card login-card-simple paper-panel">
          <div className="login-card-header">
            <Image
              src="/branding/wenlan-logo.png"
              alt=""
              width={1254}
              height={1254}
              priority
              className="login-card-logo"
            />
            <p className="section-eyebrow">邀请注册</p>
            <h1 id="register-title" className="login-title">
              创建账号
            </h1>
            <p className="page-description login-copy">
              使用管理员发出的邀请完成注册。
            </p>
          </div>

          {!isSupabaseConfigured() ? (
            <p className="form-error" role="alert">
              当前注册服务暂不可用，请稍后再试。
            </p>
          ) : null}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          {isSupabaseConfigured() && !token ? (
            <form action="/register" method="get" className="login-form">
              <label htmlFor="invite-token">邀请码</label>
              <input
                id="invite-token"
                type="text"
                name="token"
                placeholder="粘贴邀请链接中的邀请码"
                autoComplete="off"
                required
              />
              <button type="submit" className="hero-button hero-button-strong login-submit">
                继续注册
              </button>
            </form>
          ) : null}

          {token && invite && !invite.isValid ? (
            <p className="form-error" role="alert">
              {invite.error}
            </p>
          ) : null}

          {token && invite?.isValid ? (
            <form action="/auth/register" method="post" className="login-form">
              <input type="hidden" name="token" value={token} />
              <label htmlFor="register-email">邮箱</label>
              <input
                id="register-email"
                type="email"
                name="email"
                defaultValue={invite.email ?? ""}
                readOnly={Boolean(invite.email)}
                placeholder={invite.email ? undefined : "输入你要注册的邮箱"}
                autoComplete="email"
                required
              />

              <label htmlFor="register-display-name">称呼</label>
              <input
                id="register-display-name"
                type="text"
                name="displayName"
                placeholder="姓名或常用称呼"
                autoComplete="name"
                required
              />

              <label htmlFor="register-password">密码</label>
              <input
                id="register-password"
                type="password"
                name="password"
                placeholder="至少 8 位密码"
                minLength={8}
                autoComplete="new-password"
                required
              />

              <button type="submit" className="hero-button hero-button-strong login-submit">
                创建账号
              </button>
            </form>
          ) : null}

          <div className="login-register-row">
            <span>已经有账号？</span>
            <Link href="/login">返回登录</Link>
          </div>
        </section>
      </section>
    </AuthFrame>
  );
}
