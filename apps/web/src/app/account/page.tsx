import Image from "next/image";
import Link from "next/link";

import { AccountAvatarForm } from "@/components/account/account-avatar-form";
import { UserAvatar } from "@/components/account/user-avatar";
import { SiteFrame } from "@/components/public/site-frame";
import { getAccountFavorites, getAccountRecentViews } from "@/lib/account/repository";
import { buildPasswordRecoveryHref } from "@/lib/account/redirects";
import { requireAuthenticatedPage, viewerCanManageAdmin } from "@/lib/auth/server";
import { getSiteSettings } from "@/lib/content/repository";
import { toHref } from "@/lib/content/utils";

type AccountPageProps = {
  searchParams: Promise<{
    deleteError?: string;
    deleteNotice?: string;
    passwordError?: string;
    passwordNotice?: string;
    profileError?: string;
    profileNotice?: string;
  }>;
};

const copy = {
  title: "\u8d26\u53f7\u4e2d\u5fc3",
  defaultName: "\u672a\u8bbe\u7f6e\u6635\u79f0",
  defaultEmail: "\u672a\u7ed1\u5b9a\u90ae\u7bb1",
  heroDescription: "\u9605\u8bfb\u3001\u601d\u8003\u3001\u8bb0\u5f55\u3001\u5206\u4eab\uff0c\u6301\u7eed\u63a2\u7d22\u77e5\u8bc6\u7684\u8fb9\u754c\u3002",
  heroAlt: "\u8d26\u53f7\u4e2d\u5fc3\u88c5\u9970\u63d2\u753b",
  profileTitle: "\u57fa\u7840\u8d44\u6599",
  nickname: "\u6635\u79f0",
  email: "\u90ae\u7bb1",
  role: "\u89d2\u8272",
  description: "\u7b80\u4ecb",
  profileNote: "\u9605\u8bfb\u3001\u601d\u8003\u3001\u8bb0\u5f55\u3001\u5206\u4eab\uff0c\u6301\u7eed\u63a2\u7d22\u77e5\u8bc6\u7684\u8fb9\u754c\u3002",
  nicknamePlaceholder: "\u8f93\u5165\u6635\u79f0",
  saveNickname: "\u4fdd\u5b58\u6635\u79f0",
  enterAdmin: "\u8fdb\u5165\u540e\u53f0",
  explorerRole: "\u77e5\u8bc6\u63a2\u7d22\u8005",
  adminRole: "\u7ad9\u70b9\u7ba1\u7406\u8005",
  securityTitle: "\u8d26\u53f7\u5b89\u5168",
  securityHint: "\u5efa\u8bae\u5b9a\u671f\u66f4\u65b0\u5bc6\u7801\u4ee5\u4fdd\u969c\u8d26\u53f7\u5b89\u5168",
  securityNote: "\u4fee\u6539\u5bc6\u7801\u524d\u9700\u8981\u5148\u8f93\u5165\u5f53\u524d\u5bc6\u7801\uff0c\u5982\u5df2\u5fd8\u8bb0\u53ef\u4ee5\u6539\u7528\u90ae\u7bb1\u9a8c\u8bc1\u7801\u91cd\u7f6e\u3002",
  currentPassword: "\u5f53\u524d\u5bc6\u7801",
  currentPasswordPlaceholder: "\u8f93\u5165\u5f53\u524d\u5bc6\u7801",
  nextPassword: "\u65b0\u5bc6\u7801",
  nextPasswordPlaceholder: "\u81f3\u5c11 8 \u4f4d",
  confirmPassword: "\u786e\u8ba4\u65b0\u5bc6\u7801",
  confirmPasswordPlaceholder: "\u518d\u6b21\u8f93\u5165\u65b0\u5bc6\u7801",
  savePassword: "\u66f4\u65b0\u5bc6\u7801",
  recoverPassword: "\u5fd8\u8bb0\u5bc6\u7801\uff0c\u6539\u7528\u90ae\u7bb1\u9a8c\u8bc1\u7801\u91cd\u7f6e",
  historyTitle: "\u6700\u8fd1\u6d4f\u89c8",
  historyAll: "\u67e5\u770b\u5168\u90e8",
  historyFallback: "\u6253\u5f00\u540e\u53ef\u7ee7\u7eed\u67e5\u770b\u8fd9\u4e2a\u5185\u5bb9\u3002",
  historyEmptyTitle: "\u8fd8\u6ca1\u6709\u6700\u8fd1\u6d4f\u89c8",
  historyEmptyText:
    "\u767b\u5f55\u540e\u8fdb\u5165\u6587\u4ef6\u5939\u6216\u6587\u6863\uff0c\u8fd9\u91cc\u5c31\u4f1a\u81ea\u52a8\u51fa\u73b0\u4f60\u6700\u8fd1\u6253\u5f00\u8fc7\u7684\u5185\u5bb9\u3002",
  favoritesTitle: "\u6211\u7684\u6536\u85cf",
  favoritesAll: "\u67e5\u770b\u5168\u90e8",
  favoritesFallback: "\u6536\u85cf\u540e\u53ef\u4ee5\u4ece\u8fd9\u91cc\u5feb\u901f\u56de\u5230\u76ee\u6807\u5185\u5bb9\u3002",
  favoritesEmptyTitle: "\u8fd8\u6ca1\u6709\u6536\u85cf\u5185\u5bb9",
  favoritesEmptyText:
    "\u5728\u6587\u4ef6\u5939\u6216\u6587\u6863\u9875\u70b9\u51fb\u201c\u6536\u85cf\u201d\uff0c\u8fd9\u91cc\u5c31\u4f1a\u957f\u671f\u4fdd\u5b58\u4f60\u4e3b\u52a8\u6807\u8bb0\u7684\u5185\u5bb9\u3002",
  avatarTitle: "\u5934\u50cf",
  actionsTitle: "\u8d26\u53f7\u64cd\u4f5c",
  leaveAccount: "\u9000\u51fa\u8d26\u53f7\u4e2d\u5fc3",
  logoutLabel: "\u9000\u51fa\u767b\u5f55",
  logoutButton: "\u9000\u51fa\u767b\u5f55",
  deleteTitle: "\u6ce8\u9500\u8d26\u53f7",
  deleteDangerText:
    "\u6ce8\u9500\u540e\u4f1a\u7acb\u5373\u505c\u7528\u5e76\u9000\u51fa\u767b\u5f55\uff0c\u6210\u5458\u8bb0\u5f55\u4fdd\u7559\uff0c\u7ba1\u7406\u5458\u53ef\u6062\u590d\uff1b\u5982\u9700\u5f7b\u5e95\u5220\u9664\u8d26\u53f7\u6570\u636e\u5e76\u91ca\u653e\u90ae\u7bb1\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u3002",
  deleteConfirm: "\u8f93\u5165\u201c\u6ce8\u9500\u8d26\u53f7\u201d\u786e\u8ba4",
  deletePlaceholder: "\u6ce8\u9500\u8d26\u53f7",
  deleteButton: "\u6ce8\u9500\u5e76\u505c\u7528",
};

function decodeParam(value?: string) {
  return value ? decodeURIComponent(value) : "";
}

function SectionIcon({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className="account-section-icon-svg">
      {children}
    </svg>
  );
}

function AccountSectionTitle({
  title,
  icon,
  tone = "default",
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  tone?: "default" | "danger";
}>) {
  return (
    <div className={`account-section-title-row ${tone === "danger" ? "is-danger" : ""}`}>
      <span className="account-section-icon" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
    </div>
  );
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const viewer = await requireAuthenticatedPage("/account");
  const siteSettings = await getSiteSettings();
  const canManageAdmin = viewerCanManageAdmin(viewer.siteRole);
  const recentViews = viewer.profileId ? await getAccountRecentViews(viewer.profileId) : [];
  const favoriteItems = viewer.profileId ? await getAccountFavorites(viewer.profileId, 6) : [];
  const resolvedSearchParams = await searchParams;

  const profileError = decodeParam(resolvedSearchParams.profileError);
  const profileNotice = decodeParam(resolvedSearchParams.profileNotice);
  const passwordError = decodeParam(resolvedSearchParams.passwordError);
  const passwordNotice = decodeParam(resolvedSearchParams.passwordNotice);
  const deleteError = decodeParam(resolvedSearchParams.deleteError);
  const deleteNotice = decodeParam(resolvedSearchParams.deleteNotice);

  const displayName = viewer.displayName?.trim() || copy.defaultName;
  const email = viewer.email ?? copy.defaultEmail;
  const roleLabel = canManageAdmin ? copy.adminRole : copy.explorerRole;

  return (
    <SiteFrame
      siteSettings={siteSettings}
      viewer={viewer}
      accountEntryHref="/"
      accountEntryLabel={copy.leaveAccount}
    >
      <section className="account-page-shell">
        <div className="account-page-intro">
          <h1 className="account-page-title">{copy.title}</h1>
        </div>

        <section className="account-hero paper-panel">
          <div className="account-hero-backdrop" aria-hidden="true">
            <Image
              src="/illustrations/account-center-hero-v1.png"
              alt={copy.heroAlt}
              fill
              sizes="(max-width: 900px) 100vw, 56vw"
              className="account-hero-backdrop-image"
              priority
            />
          </div>

          <div className="account-hero-profile">
            <div className="account-hero-avatar-shell">
              <UserAvatar
                avatarUrl={viewer.avatarUrl}
                displayName={viewer.displayName}
                email={viewer.email}
                size="large"
                shape="square"
                fallbackImageSrc="/illustrations/account-center-hero-v1.png"
                className="account-hero-avatar"
              />
            </div>

            <div className="account-hero-copy">
              <div className="account-hero-heading">
                <h2>{displayName}</h2>
                <span
                  className={`account-role-badge ${
                    canManageAdmin ? "is-admin" : "is-viewer"
                  }`}
                >
                  {roleLabel}
                </span>
              </div>

              <p className="account-hero-email">{email}</p>
              <p className="account-hero-description">{copy.heroDescription}</p>
            </div>
          </div>
        </section>

        <section className="account-layout">
          <article id="account-profile" className="account-card paper-panel account-grid-profile">
              <AccountSectionTitle
                title={copy.profileTitle}
                icon={
                  <SectionIcon>
                    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                    <path d="M4 20a8 8 0 0 1 16 0H4Z" />
                  </SectionIcon>
                }
              />

              <dl className="account-detail-list account-detail-table">
                <div className="account-detail-row">
                  <dt>{copy.nickname}</dt>
                  <dd>
                    <form action="/api/account/profile" method="post" className="account-inline-form-row">
                      <input
                        type="text"
                        name="displayName"
                        defaultValue={viewer.displayName ?? ""}
                        placeholder={copy.nicknamePlaceholder}
                        maxLength={40}
                        required
                      />
                      <button type="submit" className="hero-button account-mini-button">
                        {copy.saveNickname}
                      </button>
                    </form>
                  </dd>
                </div>
                <div className="account-detail-row">
                  <dt>{copy.email}</dt>
                  <dd>{email}</dd>
                </div>
                <div className="account-detail-row">
                  <dt>{copy.role}</dt>
                  <dd>{roleLabel}</dd>
                </div>
                <div className="account-detail-row">
                  <dt>{copy.description}</dt>
                  <dd>{copy.profileNote}</dd>
                </div>
              </dl>

              {canManageAdmin ? (
                <div className="account-inline-actions">
                  <Link href="/admin" className="account-text-link">
                    {copy.enterAdmin}
                  </Link>
                </div>
              ) : null}

              {profileNotice ? (
                <p className="form-success" role="status" aria-live="polite">
                  {profileNotice}
                </p>
              ) : null}

              {profileError ? (
                <p className="form-error" role="alert">
                  {profileError}
                </p>
              ) : null}
          </article>

          <article id="account-avatar" className="account-card paper-panel account-grid-avatar">
            <AccountSectionTitle
              title={copy.avatarTitle}
              icon={
                <SectionIcon>
                  <path d="M12 11a3.6 3.6 0 1 0-3.6-3.6A3.6 3.6 0 0 0 12 11Z" />
                  <path d="M5 19a7 7 0 0 1 14 0H5Z" />
                </SectionIcon>
              }
            />

            <AccountAvatarForm
              avatarUrl={viewer.avatarUrl}
              displayName={viewer.displayName}
              email={viewer.email}
            />
          </article>

          <article id="account-security" className="account-card paper-panel account-grid-security">
              <AccountSectionTitle
                title={copy.securityTitle}
                icon={
                  <SectionIcon>
                    <path d="M12 3 5 6v5c0 4.6 2.8 8.8 7 10 4.2-1.2 7-5.4 7-10V6l-7-3Z" />
                    <path d="M10.8 14.8 8.6 12.6l-1.2 1.2 3.4 3.4 5.8-5.8-1.2-1.2-4.6 4.6Z" />
                  </SectionIcon>
                }
              />

              <div className="account-security-summary">
                <span className="account-security-mask">**********</span>
                <span className="account-security-tip">{copy.securityHint}</span>
              </div>

              <p className="account-card-copy">{copy.securityNote}</p>

              {passwordNotice ? (
                <p className="form-success" role="status" aria-live="polite">
                  {passwordNotice}
                </p>
              ) : null}

              {passwordError ? (
                <p className="form-error" role="alert">
                  {passwordError}
                </p>
              ) : null}

              <form action="/api/account/password" method="post" className="account-form">
                <label className="account-field">
                  <span>{copy.currentPassword}</span>
                  <input
                    type="password"
                    name="currentPassword"
                    autoComplete="current-password"
                    placeholder={copy.currentPasswordPlaceholder}
                    required
                  />
                </label>

                <div className="account-password-grid">
                  <label className="account-field">
                    <span>{copy.nextPassword}</span>
                    <input
                      type="password"
                      name="nextPassword"
                      minLength={8}
                      autoComplete="new-password"
                      placeholder={copy.nextPasswordPlaceholder}
                      required
                    />
                  </label>

                  <label className="account-field">
                    <span>{copy.confirmPassword}</span>
                    <input
                      type="password"
                      name="confirmPassword"
                      minLength={8}
                      autoComplete="new-password"
                      placeholder={copy.confirmPasswordPlaceholder}
                      required
                    />
                  </label>
                </div>

                <div className="account-inline-actions">
                  <button type="submit" className="hero-button account-mini-button">
                    {copy.savePassword}
                  </button>
                  <Link
                    href={buildPasswordRecoveryHref({ email: viewer.email })}
                    className="account-text-link"
                  >
                    {copy.recoverPassword}
                  </Link>
                </div>
              </form>
          </article>

          <div className="account-grid-operations">
            <article className="account-card paper-panel account-grid-actions">
              <AccountSectionTitle
                title={copy.actionsTitle}
                icon={
                  <SectionIcon>
                    <path
                      d="M11 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m14 16 5-4-5-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 12H9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </SectionIcon>
                }
              />

              <form action="/auth/logout" method="post" className="account-action-strip">
                <input type="hidden" name="redirectTo" value="/" />
                <span className="account-action-label">{copy.logoutLabel}</span>
                <button type="submit" className="hero-button account-danger-outline">
                  {copy.logoutButton}
                </button>
              </form>
            </article>

            <article id="account-danger" className="account-card paper-panel account-grid-danger">
              <AccountSectionTitle
                title={copy.deleteTitle}
                tone="danger"
                icon={
                  <SectionIcon>
                    <path d="M12 3 2.6 19h18.8L12 3Z" />
                    <path
                      d="M12 9v4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="16.4" r="1" fill="currentColor" />
                  </SectionIcon>
                }
              />

              <div className="account-danger-note">
                <p>{copy.deleteDangerText}</p>
              </div>

              {deleteNotice ? (
                <p className="form-success" role="status" aria-live="polite">
                  {deleteNotice}
                </p>
              ) : null}

              {deleteError ? (
                <p className="form-error" role="alert">
                  {deleteError}
                </p>
              ) : null}

              <form action="/api/account/delete" method="post" className="account-form">
                <label className="account-field">
                  <span>{copy.deleteConfirm}</span>
                  <input
                    type="text"
                    name="confirmText"
                    placeholder={copy.deletePlaceholder}
                    autoComplete="off"
                    required
                  />
                </label>

                <button type="submit" className="hero-button account-danger-button">
                  {copy.deleteButton}
                </button>
              </form>
            </article>
          </div>

          <article className="account-card paper-panel account-grid-history">
              <div className="account-history-heading">
                <AccountSectionTitle
                  title={copy.historyTitle}
                  icon={
                    <SectionIcon>
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
                    </SectionIcon>
                  }
                />
                <Link href="/account/history" className="account-history-link">
                  {copy.historyAll}
                </Link>
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
                        <p>{item.contextTitle || item.description || copy.historyFallback}</p>
                      </div>

                      <div className="account-history-date">
                        <span>{item.visitedAt.slice(0, 10)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="folder-empty-note account-empty-note">
                  <strong>{copy.historyEmptyTitle}</strong>
                  <p>{copy.historyEmptyText}</p>
                </div>
              )}
          </article>

          <article className="account-card paper-panel account-grid-favorites">
            <div className="account-history-heading">
              <AccountSectionTitle
                title={copy.favoritesTitle}
                icon={
                  <SectionIcon>
                    <path
                      d="m12 3.4 2.65 5.36 5.92.86-4.29 4.18 1.02 5.88L12 16.93 6.7 19.68l1.02-5.88-4.29-4.18 5.92-.86L12 3.4Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </SectionIcon>
                }
              />
              <Link href="/account/favorites" className="account-history-link">
                {copy.favoritesAll}
              </Link>
            </div>

            {favoriteItems.length > 0 ? (
              <div className="account-history-list">
                {favoriteItems.map((item) => (
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
                      <p>{item.contextTitle || item.description || copy.favoritesFallback}</p>
                    </div>

                    <div className="account-history-date">
                      <span>{item.favoritedAt.slice(0, 10)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="folder-empty-note account-empty-note">
                <strong>{copy.favoritesEmptyTitle}</strong>
                <p>{copy.favoritesEmptyText}</p>
              </div>
            )}
          </article>

        </section>
      </section>
    </SiteFrame>
  );
}
