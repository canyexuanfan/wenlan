import Link from "next/link";

import { FavoriteToggleButton } from "@/components/account/favorite-toggle-button";
import { RecentViewTracker } from "@/components/account/recent-view-tracker";
import { buildLoginHref, type AuthViewer } from "@/lib/auth/server";
import { isAccountFavorite } from "@/lib/account/repository";
import type { DocumentPageData } from "@/lib/content/types";
import { formatDate, toHref } from "@/lib/content/utils";

import { AccessBadge, Breadcrumbs, SiteFrame, TagList } from "./site-frame";

export async function DocumentPageView({
  data,
  viewer,
}: Readonly<{
  data: DocumentPageData;
  viewer?: AuthViewer;
}>) {
  const { siteSettings, navigationFolders, folder, document, breadcrumbs, relatedDocuments } = data;
  const documentBodyHtml = document.bodyHtml;
  const documentOutline = document.outline;
  const readingTime = document.readingTime;
  const isFavorited =
    viewer?.profileId ? await isAccountFavorite(viewer.profileId, "document", document.id) : false;
  const documentHref = toHref(document.routePath);
  const favoriteLoginHref = buildLoginHref(documentHref);

  return (
    <SiteFrame siteSettings={siteSettings} navigationFolders={navigationFolders} viewer={viewer}>
      <RecentViewTracker
        enabled={Boolean(viewer?.isAuthenticated && viewer.profileId)}
        targetType="document"
        targetId={document.id}
      />

      <section className="document-stage paper-panel">
        <Breadcrumbs items={breadcrumbs} />

        <div className="document-stage-grid">
          <div className="document-stage-copy">
            <div className="document-stage-kicker">
              <p className="section-eyebrow">文档</p>
              <AccessBadge mode={document.accessMode} />
              <span className="document-stage-folder">所属栏目：{folder.name}</span>
            </div>

            <h1 className="page-title">{document.title}</h1>
            <p className="page-description">{document.summary}</p>

            <div className="document-stage-stats" aria-label="文档概览">
              <div className="document-stage-stat">
                <span className="document-stage-stat-label">阅读时长</span>
                <strong className="document-stage-stat-value">{readingTime}</strong>
              </div>
              <div className="document-stage-stat">
                <span className="document-stage-stat-label">更新时间</span>
                <strong className="document-stage-stat-value">{formatDate(document.updatedAt)}</strong>
              </div>
              <div className="document-stage-stat">
                <span className="document-stage-stat-label">作者</span>
                <strong className="document-stage-stat-value">{document.authorName}</strong>
              </div>
              <div className="document-stage-stat">
                <span className="document-stage-stat-label">同栏内容</span>
                <strong className="document-stage-stat-value">{relatedDocuments.length + 1} 篇</strong>
              </div>
            </div>

            <TagList tags={document.tags} />
          </div>

          <aside className="document-stage-aside">
            <div className="document-stage-note">
              <p className="mini-caption">阅读提示</p>
              <p>当前文档统一使用站内阅读版展示，便于目录、搜索、问答和样式保持一致。</p>
            </div>

            <div className="document-actions">
              <a
                href={siteSettings.contactUrl}
                target="_blank"
                rel="noreferrer"
                className="hero-button hero-button-strong"
              >
                {siteSettings.contactLabel}
              </a>
              <Link href={toHref(folder.routePath)} className="hero-button">
                返回栏目
              </Link>
              <FavoriteToggleButton
                enabled={Boolean(viewer?.isAuthenticated && viewer.profileId)}
                initialFavorited={isFavorited}
                loginHref={favoriteLoginHref}
                targetType="document"
                targetId={document.id}
              />
              <Link
                href={`/kb?scopeType=document&routePath=${encodeURIComponent(document.routePath)}`}
                className="hero-button hero-button-strong"
              >
                知识库问答
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="document-layout document-reading-grid">
        <aside className="outline-panel paper-panel document-side-card">
          <p className="section-eyebrow">目录</p>
          <nav aria-label="文档目录">
            {documentOutline.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="outline-link">
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="paper-article paper-panel document-article">
          <div className="article-meta">
            <span className="document-section-label">正文阅读</span>
            <div className="document-meta-inline">
              <span>{readingTime}</span>
              <span>{formatDate(document.updatedAt)}</span>
            </div>
          </div>

          <div className="document-article-shell">
            <div className="document-html" dangerouslySetInnerHTML={{ __html: documentBodyHtml }} />
          </div>
        </article>

        <aside className="info-panel paper-panel document-side-card">
          <p className="section-eyebrow">文档信息</p>
          <ul className="meta-list">
            <li>
              <span>所属栏目</span>
              <strong>{folder.name}</strong>
            </li>
            <li>
              <span>作者</span>
              <strong>{document.authorName}</strong>
            </li>
            <li>
              <span>更新时间</span>
              <strong>{formatDate(document.updatedAt)}</strong>
            </li>
            <li>
              <span>阅读时长</span>
              <strong>{readingTime}</strong>
            </li>
          </ul>

          {relatedDocuments.length > 0 ? (
            <>
              <p className="section-eyebrow section-eyebrow-gap">继续阅读</p>
              <div className="related-list">
                {relatedDocuments.map((item) => (
                  <Link key={item.id} href={toHref(item.routePath)} className="related-card">
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </aside>
      </section>
    </SiteFrame>
  );
}
