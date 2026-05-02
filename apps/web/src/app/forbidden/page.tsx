import Link from "next/link";
import type { Metadata } from "next";

import { SiteFrame } from "@/components/public/site-frame";

export const metadata: Metadata = {
  title: "无访问权限",
  description: "当前账号没有访问此区域的权限。",
};

export default function ForbiddenPage() {
  return (
    <SiteFrame>
      <section className="login-card paper-panel">
        <p className="section-eyebrow">无权限</p>
        <h1 className="login-title">没有访问权限</h1>
        <p className="page-description login-copy">
          请联系管理员调整角色，或切换到有权限的账号。
        </p>
        <div className="toolbar-actions">
          <Link href="/" className="hero-button">
            回到首页
          </Link>
          <Link href="/login" className="hero-button hero-button-strong">
            切换账号
          </Link>
        </div>
      </section>
    </SiteFrame>
  );
}
