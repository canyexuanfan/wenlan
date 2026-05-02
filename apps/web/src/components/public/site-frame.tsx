import Image from "next/image";
import Link from "next/link";

import type { AuthViewer } from "@/lib/auth/server";
import { getAuthViewer, viewerCanManageAdmin } from "@/lib/auth/server";
import { accessLabelMap } from "@/lib/content/constants";
import type { AccessMode, FolderRecord, SiteSettings, ViewMode } from "@/lib/content/types";
import { buildSearchParams } from "@/lib/content/utils";
import { defaultSiteSettings } from "@/lib/mock-data";

export async function SiteFrame({
  children,
  siteSettings = defaultSiteSettings,
  searchValue = "",
  activeTag = "",
  hideAdminLink = false,
  viewer,
}: Readonly<{
  children: React.ReactNode;
  siteSettings?: SiteSettings;
  navigationFolders?: FolderRecord[];
  searchValue?: string;
  activeTag?: string;
  hideAdminLink?: boolean;
  viewer?: AuthViewer;
}>) {
  const resolvedViewer = viewer ?? (await getAuthViewer());
  const canManageAdmin = viewerCanManageAdmin(resolvedViewer.siteRole);

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <Link href="/" className="brand-mark" aria-label={siteSettings.name}>
            <Image
              src="/branding/wenlan-logo.png"
              alt={`${siteSettings.name} 标志`}
              width={1254}
              height={1254}
              priority
              className="brand-mark-image"
            />
          </Link>
          <p className="brand-note">{siteSettings.subtitle}</p>
        </div>

        <form className="header-search" role="search" action="/" aria-label="搜索文档">
          <span className="search-icon" aria-hidden="true">
            Q
          </span>
          <input
            name="q"
            aria-label="搜索文档"
            defaultValue={searchValue}
            placeholder="搜索标题、标签或路径"
          />
          {activeTag ? <input type="hidden" name="tag" value={activeTag} /> : null}
          <button type="submit" className="nav-chip nav-chip-strong nav-chip-button">
            搜索
          </button>
          {searchValue || activeTag ? (
            <Link href={`/${buildSearchParams({})}`} className="nav-chip nav-chip-muted">
              清空
            </Link>
          ) : null}
        </form>

        <nav className="header-actions" aria-label="站点导航">
          {hideAdminLink ? (
            <Link href="/" className="nav-chip nav-chip-muted">
              首页
            </Link>
          ) : null}
          {canManageAdmin && !hideAdminLink ? (
            <Link href="/admin" className="nav-chip nav-chip-muted">
              后台
            </Link>
          ) : null}
          {resolvedViewer.isAuthenticated ? (
            <>
              <form action="/auth/logout" method="post" className="header-inline-form">
                <input type="hidden" name="redirectTo" value="/" />
                <button type="submit" className="nav-chip nav-chip-strong nav-chip-button">
                  退出登录
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="nav-chip nav-chip-strong">
              登录
            </Link>
          )}
          <a
            href={siteSettings.contactUrl}
            target="_blank"
            rel="noreferrer"
            className="nav-chip"
          >
            {siteSettings.contactLabel}
          </a>
        </nav>
      </header>

      <main id="main-content">{children}</main>

      <footer className="site-footer">
        <p>文览 · 在线内容库</p>
        <p className="footer-note">SOP、指南、案例、报告，统一在线管理与阅读。</p>
      </footer>
    </div>
  );
}

export function AccessBadge({ mode }: Readonly<{ mode: AccessMode }>) {
  return (
    <span className="access-badge" data-mode={mode}>
      {accessLabelMap[mode]}
    </span>
  );
}

export function TagList({ tags }: Readonly<{ tags: string[] }>) {
  return (
    <div className="tag-list" aria-label="标签列表">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
        </span>
      ))}
    </div>
  );
}

export function ViewModeSwitch({
  baseHref,
  current,
}: Readonly<{
  baseHref: string;
  current: ViewMode;
}>) {
  const normalizedBaseHref = baseHref.replace(/([?&])view=(card|list)/g, "").replace(/[?&]$/, "");
  const separator = normalizedBaseHref.includes("?") ? "&" : "?";
  const cardHref = `${normalizedBaseHref}${separator}view=card`;
  const listHref = `${normalizedBaseHref}${separator}view=list`;

  return (
    <div className="view-switch" role="tablist" aria-label="视图切换">
      <Link
        href={cardHref}
        scroll={false}
        role="tab"
        title="卡片视图"
        aria-label="卡片视图"
        aria-selected={current === "card"}
        aria-current={current === "card" ? "page" : undefined}
        className={`view-pill ${current === "card" ? "is-active" : ""}`}
      >
        <span className="view-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" className="view-icon-svg">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
          </svg>
        </span>
        <span className="sr-only">卡片视图</span>
      </Link>
      <Link
        href={listHref}
        scroll={false}
        role="tab"
        title="列表视图"
        aria-label="列表视图"
        aria-selected={current === "list"}
        aria-current={current === "list" ? "page" : undefined}
        className={`view-pill ${current === "list" ? "is-active" : ""}`}
      >
        <span className="view-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" className="view-icon-svg">
            <circle cx="5" cy="6" r="1.8" />
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="5" cy="18" r="1.8" />
            <rect x="9" y="4.5" width="12" height="3" rx="1.5" />
            <rect x="9" y="10.5" width="12" height="3" rx="1.5" />
            <rect x="9" y="16.5" width="12" height="3" rx="1.5" />
          </svg>
        </span>
        <span className="sr-only">列表视图</span>
      </Link>
    </div>
  );
}

export function Breadcrumbs({
  items,
}: Readonly<{
  items: Array<{ label: string; href?: string }>;
}>) {
  return (
    <nav className="breadcrumbs" aria-label="面包屑导航">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="crumb-item">
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          {index < items.length - 1 ? <span className="crumb-sep">/</span> : null}
        </span>
      ))}
    </nav>
  );
}
