import Image from "next/image";
import Link from "next/link";

import { FavoriteRemoveButton } from "@/components/account/favorite-remove-button";
import { SiteFrame } from "@/components/public/site-frame";
import { getAccountFavorites } from "@/lib/account/repository";
import { requireAuthenticatedPage } from "@/lib/auth/server";
import { getSiteSettings } from "@/lib/content/repository";
import { toHref } from "@/lib/content/utils";

const copy = {
  title: "我的收藏",
  titleHint: "这里会长期保留你主动收藏过的文件夹和文档，方便随时回看。",
  backToAccount: "返回账号中心",
  emptyTitle: "还没有收藏内容",
  emptyText: "在文件夹页或文档页点击“收藏”，这里就会保留你主动标记过的内容。",
  fallback: "收藏后可以从这里快速回到目标内容。",
  backHome: "回到首页",
};

function SectionIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className="account-section-icon-svg">
      <path
        d="m12 3.4 2.65 5.36 5.92.86-4.29 4.18 1.02 5.88L12 16.93 6.7 19.68l1.02-5.88-4.29-4.18 5.92-.86L12 3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function AccountFavoritesPage() {
  const viewer = await requireAuthenticatedPage("/account/favorites");
  const siteSettings = await getSiteSettings();
  const favoriteItems = viewer.profileId ? await getAccountFavorites(viewer.profileId) : [];

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
                <SectionIcon />
              </span>
              <h2>{copy.title}</h2>
            </div>
            <span className="account-history-count">{favoriteItems.length} 条</span>
          </div>

          {favoriteItems.length > 0 ? (
            <div className="account-favorite-list">
              {favoriteItems.map((item) => (
                <div key={item.id} className="account-favorite-row">
                  <Link href={toHref(item.routePath)} className="account-favorite-link">
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
                      <span>{item.favoritedAt.slice(0, 10)}</span>
                    </div>
                  </Link>

                  <div className="account-favorite-actions">
                    <FavoriteRemoveButton targetType={item.targetType} targetId={item.targetId} />
                  </div>
                </div>
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
