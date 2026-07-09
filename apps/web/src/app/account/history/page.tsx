import Image from "next/image";
import Link from "next/link";

import { SiteFrame } from "@/components/public/site-frame";
import { getAccountRecentViews } from "@/lib/account/repository";
import { requireAuthenticatedPage } from "@/lib/auth/server";
import { getSiteSettings } from "@/lib/content/repository";
import { toHref } from "@/lib/content/utils";

const copy = {
  accountTitle: "账号中心",
  title: "最近浏览",
  titleHint: "这里会记录你最近打开过的文件夹和文档，方便继续阅读。",
  backToAccount: "返回账号中心",
  emptyTitle: "还没有最近浏览",
  emptyText: "登录后进入文件夹或文档，这里会自动显示你最近打开过的内容。",
  fallback: "打开后可继续查看这个内容。",
  backHome: "回到首页",
};

export default async function AccountHistoryPage() {
  const viewer = await requireAuthenticatedPage("/account/history");
  const siteSettings = await getSiteSettings();
  const recentViews = viewer.profileId ? await getAccountRecentViews(viewer.profileId) : [];

  return (
    <SiteFrame siteSettings={siteSettings} viewer={viewer} accountEntryHref="/account">
      <section className="account-page-shell">
        <div className="account-page-intro">
          <div className="account-inline-actions">
            <Link href="/account" className="account-text-link">
              {copy.backToAccount}
            </Link>
          </div>
          <h1 className="account-page-title">{copy.title}</h1>
          <p className="page-description">{copy.titleHint}</p>
        </div>

        <article className="account-card paper-panel">
          <div className="account-history-heading">
            <div className="account-section-title-row">
              <span className="account-section-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" className="account-section-icon-svg">
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 8v4l3 2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h2>{copy.title}</h2>
            </div>
            <span className="account-history-count">{recentViews.length} 条</span>
          </div>

          {recentViews.length > 0 ? (
            <div className="account-history-list">
              {recentViews.map((item) => (
                <Link key={item.id} href={toHref(item.routePath)} className="account-history-card">
                  <div className="account-history-thumb" aria-hidden="true">
                    <Image
                      src="/illustrations/account-center-hero-v1.png"
                      alt=""
                      fill
                      sizes="104px"
                      className="account-history-thumb-image"
                    />
                  </div>

                  <div className="account-history-body">
                    <strong>{item.title}</strong>
                    <p>{item.contextTitle || item.description || copy.fallback}</p>
                  </div>

                  <div className="account-history-date">
                    <span>{item.visitedAt.slice(0, 10)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="folder-empty-note account-empty-note">
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyText}</p>
              <div className="account-inline-actions">
                <Link href="/" className="account-text-link">
                  {copy.backHome}
                </Link>
              </div>
            </div>
          )}
        </article>
      </section>
    </SiteFrame>
  );
}
