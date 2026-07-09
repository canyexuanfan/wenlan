import Image from "next/image";
import Link from "next/link";

import { UserAvatar } from "@/components/account/user-avatar";
import type { AuthViewer } from "@/lib/auth/server";
import { getAuthViewer, viewerCanManageAdmin } from "@/lib/auth/server";
import { accessLabelMap } from "@/lib/content/constants";
import type { AccessMode, FolderRecord, SiteSettings, ViewMode } from "@/lib/content/types";
import { buildSearchParams } from "@/lib/content/utils";
import { defaultSiteSettings } from "@/lib/mock-data";

const copy = {
  search: "\u7ad9\u5185\u641c\u7d22",
  searchPlaceholder: "\u641c\u7d22\u77e5\u8bc6\u3001\u6587\u7ae0\u3001\u4f5c\u8005\u6216\u8bdd\u9898",
  clear: "\u6e05\u7a7a",
  contact: "\u8054\u7cfb\u6211\u4eec",
  nav: "\u7ad9\u70b9\u5bfc\u822a",
  home: "\u9996\u9875",
  admin: "\u540e\u53f0",
  account: "\u8d26\u53f7",
  accountLink: "\u8fdb\u5165\u8d26\u53f7\u9875",
  leaveAccount: "\u9000\u51fa\u8d26\u53f7\u4e2d\u5fc3",
  login: "\u767b\u5f55",
  tags: "\u6807\u7b7e",
  viewSwitch: "\u5207\u6362\u89c6\u56fe",
  cardView: "\u5361\u7247\u89c6\u56fe",
  listView: "\u5217\u8868\u89c6\u56fe",
  breadcrumb: "\u9762\u5305\u5c51\u5bfc\u822a",
  footerNote: "\u6c89\u6dc0 SOP\u3001\u8d44\u6599\u548c\u53ef\u957f\u671f\u590d\u7528\u7684\u77e5\u8bc6\u5185\u5bb9\u3002",
};

function HeaderSearchIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className="header-icon-svg">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m16 16 4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HeaderContactIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className="header-icon-svg">
      <path
        d="M7 6a3 3 0 0 0-3 3v2a3 3 0 0 0 2.3 2.92l1.14.26A2 2 0 0 1 9 16.13V18a2 2 0 0 1-2 2H6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M17 6a3 3 0 0 1 3 3v2a3 3 0 0 1-2.3 2.92l-1.14.26A2 2 0 0 0 15 16.13V18a2 2 0 0 0 2 2h1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 9.5a3 3 0 0 1 6 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HeaderChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className="header-icon-svg">
      <path
        d="m7 10 5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export async function SiteFrame({
  children,
  siteSettings = defaultSiteSettings,
  searchValue = "",
  activeTag = "",
  hideAdminLink = false,
  hideFooter = false,
  accountEntryHref = "/account",
  accountEntryLabel,
  viewer,
}: Readonly<{
  children: React.ReactNode;
  siteSettings?: SiteSettings;
  navigationFolders?: FolderRecord[];
  searchValue?: string;
  activeTag?: string;
  hideAdminLink?: boolean;
  hideFooter?: boolean;
  accountEntryHref?: string;
  accountEntryLabel?: string;
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
              alt={`${siteSettings.name} logo`}
              width={1254}
              height={1254}
              priority
              className="brand-mark-image"
            />
          </Link>

          <div className="brand-copy">
            <p className="brand-title">{siteSettings.name}</p>
            <p className="brand-note">{siteSettings.subtitle}</p>
          </div>
        </div>

        <form className="header-search" role="search" action="/" aria-label={copy.search}>
          <span className="header-icon search-icon" aria-hidden="true">
            <HeaderSearchIcon />
          </span>
          <input
            name="q"
            aria-label={copy.search}
            defaultValue={searchValue}
            placeholder={copy.searchPlaceholder}
          />
          {activeTag ? <input type="hidden" name="tag" value={activeTag} /> : null}
          {searchValue || activeTag ? (
            <Link href={`/${buildSearchParams({})}`} className="nav-chip nav-chip-muted">
              {copy.clear}
            </Link>
          ) : null}
        </form>

        <nav className="header-actions" aria-label={copy.nav}>
          {hideAdminLink ? (
            <Link href="/" className="nav-chip nav-chip-muted">
              {copy.home}
            </Link>
          ) : null}

          {canManageAdmin && !hideAdminLink ? (
            <Link href="/admin" className="nav-chip nav-chip-muted">
              {copy.admin}
            </Link>
          ) : null}

          <a
            href={siteSettings.contactUrl}
            target="_blank"
            rel="noreferrer"
            className="header-contact-link"
          >
            <span className="header-icon" aria-hidden="true">
              <HeaderContactIcon />
            </span>
            <span>{copy.contact}</span>
          </a>

          {resolvedViewer.isAuthenticated ? (
            <Link
              href={accountEntryHref}
              className="account-entry"
              aria-label={accountEntryLabel ?? copy.accountLink}
            >
              <UserAvatar
                avatarUrl={resolvedViewer.avatarUrl}
                displayName={resolvedViewer.displayName}
                email={resolvedViewer.email}
                shape="square"
                fallbackImageSrc="/illustrations/account-center-hero-v1.png"
              />
              <span className="account-entry-text">
                {resolvedViewer.displayName?.trim() || copy.account}
              </span>
              <span className="header-icon account-entry-caret" aria-hidden="true">
                <HeaderChevronIcon />
              </span>
            </Link>
          ) : (
            <Link href="/login" className="nav-chip nav-chip-strong">
              {copy.login}
            </Link>
          )}
        </nav>
      </header>

      <main id="main-content">{children}</main>

      {hideFooter ? null : (
        <footer className="site-footer">
          <p>{siteSettings.name}</p>
          <p className="footer-note">{copy.footerNote}</p>
        </footer>
      )}
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
    <div className="tag-list" aria-label={copy.tags}>
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
    <div className="view-switch" role="tablist" aria-label={copy.viewSwitch}>
      <Link
        href={cardHref}
        scroll={false}
        role="tab"
        title={copy.cardView}
        aria-label={copy.cardView}
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
        <span className="sr-only">{copy.cardView}</span>
      </Link>

      <Link
        href={listHref}
        scroll={false}
        role="tab"
        title={copy.listView}
        aria-label={copy.listView}
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
        <span className="sr-only">{copy.listView}</span>
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
    <nav className="breadcrumbs" aria-label={copy.breadcrumb}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="crumb-item">
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          {index < items.length - 1 ? <span className="crumb-sep">/</span> : null}
        </span>
      ))}
    </nav>
  );
}
