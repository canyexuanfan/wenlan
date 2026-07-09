import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AuthFrame } from "@/components/public/auth-frame";
import { PasswordRecoveryPanel } from "@/components/public/password-recovery-panel";
export const metadata: Metadata = {
  title: "找回密码",
  description: "通过邮箱验证码重置文澜账号密码。",
};

type PasswordRecoveryPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
    notice?: string;
  }>;
};

function decodeParam(value?: string) {
  return value ? decodeURIComponent(value) : "";
}

export default async function PasswordRecoveryPage({
  searchParams,
}: PasswordRecoveryPageProps) {
  const resolvedSearchParams = await searchParams;
  const email = decodeParam(resolvedSearchParams.email);
  const error = decodeParam(resolvedSearchParams.error);
  const notice = decodeParam(resolvedSearchParams.notice);

  return (
    <AuthFrame>
      <section className="login-simple-stage" aria-labelledby="password-recovery-title">
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
            <p className="section-eyebrow">密码找回</p>
            <h1 id="password-recovery-title" className="login-title">
              重置账号密码
            </h1>
            <p className="page-description login-copy">
              先发送邮箱验证码，再用验证码设置新密码。这个流程不会新建账号，只用于已经存在的用户。
            </p>
          </div>

          <PasswordRecoveryPanel
            initialEmail={email}
            initialError={error}
            initialNotice={notice}
          />

          <div className="login-register-row">
            <span>想起密码了？</span>
            <Link href="/login?method=password">返回登录</Link>
          </div>
        </section>
      </section>
    </AuthFrame>
  );
}
