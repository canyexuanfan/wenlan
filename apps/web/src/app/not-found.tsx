import Link from "next/link";

import { SiteFrame } from "@/components/public/site-frame";

export default function NotFound() {
  return (
    <SiteFrame>
      <section className="login-card paper-panel">
        <p className="section-eyebrow">404</p>
        <h1 className="page-title">页面不存在</h1>
        <p className="page-description">
          路径不存在、内容未发布，或无访问权限。
        </p>
        <div className="hero-actions">
          <Link href="/" className="hero-button hero-button-strong">
            回到首页
          </Link>
          <Link href="/login" className="hero-button">
            登录
          </Link>
        </div>
      </section>
    </SiteFrame>
  );
}
