import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/public/auth-frame";
import { getAuthViewer, normalizeRedirectPath } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "登录",
  description: "登录后可查看受限内容。",
};

type LoginPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
    method?: string;
    notice?: string;
    redirectTo?: string;
  }>;
};

function buildLoginMethodHref(method: "email" | "password", redirectTo: string) {
  const params = new URLSearchParams();

  if (method === "password") {
    params.set("method", "password");
  }

  if (redirectTo !== "/") {
    params.set("redirectTo", redirectTo);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const viewer = await getAuthViewer();
  const resolvedSearchParams = await searchParams;
  const redirectTo = normalizeRedirectPath(resolvedSearchParams.redirectTo ?? "/");
  const email = resolvedSearchParams.email ? decodeURIComponent(resolvedSearchParams.email) : "";
  const error = resolvedSearchParams.error ? decodeURIComponent(resolvedSearchParams.error) : "";
  const notice = resolvedSearchParams.notice ? decodeURIComponent(resolvedSearchParams.notice) : "";
  const isPasswordMethod = resolvedSearchParams.method === "password";
  const isConfigured = isSupabaseConfigured();
  const errorId = error ? "login-error" : undefined;
  const noticeId = notice ? "login-notice" : undefined;
  const helpId = "login-help";
  const unavailableId = "login-unavailable";

  if (viewer.isAuthenticated) {
    redirect(redirectTo);
  }

  return (
    <AuthFrame>
      <section className="login-simple-stage" aria-labelledby="login-title">
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
            <p className="section-eyebrow">成员登录</p>
            <h1 id="login-title" className="login-title">
              欢迎回来
            </h1>
            <p id={helpId} className="page-description login-copy">
              {isConfigured ? "输入邮箱，使用验证码进入。" : "当前登录服务暂不可用，请稍后再试。"}
            </p>
          </div>

          {isConfigured ? (
            <>
              <nav className="login-method-tabs" aria-label="登录方式">
                <Link
                  href={buildLoginMethodHref("email", redirectTo)}
                  className={!isPasswordMethod ? "active" : ""}
                  aria-current={!isPasswordMethod ? "page" : undefined}
                >
                  验证码登录
                </Link>
                <Link
                  href={buildLoginMethodHref("password", redirectTo)}
                  className={isPasswordMethod ? "active" : ""}
                  aria-current={isPasswordMethod ? "page" : undefined}
                >
                  密码登录
                </Link>
              </nav>

              {notice ? (
                <p id={noticeId} className="form-success" role="status" aria-live="polite">
                  {notice}
                </p>
              ) : null}

              {error ? (
                <p id={errorId} className="form-error" role="alert" aria-live="assertive">
                  {error}
                </p>
              ) : null}

              {isPasswordMethod ? (
                <form
                  action="/auth/login"
                  method="post"
                  className="login-form"
                  aria-labelledby="login-title"
                  aria-describedby={[helpId, noticeId, errorId].filter(Boolean).join(" ")}
                >
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <label htmlFor="login-password-identifier">登录名</label>
                  <input
                    id="login-password-identifier"
                    type="text"
                    name="identifier"
                    placeholder="输入登录名"
                    autoComplete="username"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : helpId}
                    required
                  />

                  <label htmlFor="login-password">密码</label>
                  <input
                    id="login-password"
                    type="password"
                    name="password"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : helpId}
                    required
                  />

                  <button type="submit" className="hero-button hero-button-strong login-submit">
                    登录
                  </button>
                </form>
              ) : (
                <>
                  <form
                    action="/auth/email-code/request"
                    method="post"
                    className="login-form login-code-form"
                    aria-labelledby="login-title"
                    aria-describedby={[helpId, noticeId, errorId].filter(Boolean).join(" ")}
                  >
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <label htmlFor="login-email-code-address">邮箱</label>
                    <input
                      id="login-email-code-address"
                      type="email"
                      name="email"
                      placeholder="输入邮箱地址"
                      defaultValue={email}
                      autoComplete="email"
                      inputMode="email"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : helpId}
                      required
                    />

                    <button type="submit" className="hero-button login-submit">
                      发送验证码
                    </button>
                  </form>

                  {email ? (
                    <form
                      action="/auth/email-code/verify"
                      method="post"
                      className="login-form login-code-form"
                      aria-labelledby="login-title"
                      aria-describedby={[helpId, noticeId, errorId].filter(Boolean).join(" ")}
                    >
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <input type="hidden" name="email" value={email} />
                      <label htmlFor="login-email-code-token">验证码</label>
                      <input
                        id="login-email-code-token"
                        type="text"
                        name="token"
                        placeholder="输入邮箱中的验证码"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : helpId}
                        required
                      />

                      <button type="submit" className="hero-button hero-button-strong login-submit">
                        验证并登录
                      </button>
                    </form>
                  ) : null}
                </>
              )}

              <div className="login-register-row">
                <span>还没有账号？</span>
                <Link href="/register">使用邀请注册</Link>
              </div>
            </>
          ) : (
            <div
              id={unavailableId}
              className="empty-state"
              role="status"
              aria-live="polite"
            >
              登录功能正在准备中，请稍后再试。
            </div>
          )}
        </section>
      </section>
    </AuthFrame>
  );
}
