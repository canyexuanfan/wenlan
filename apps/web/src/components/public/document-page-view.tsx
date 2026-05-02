import Link from "next/link";

import type { AuthViewer } from "@/lib/auth/server";
import type { DocumentPageData } from "@/lib/content/types";
import { formatDate, toHref } from "@/lib/content/utils";

import { AccessBadge, Breadcrumbs, SiteFrame, TagList } from "./site-frame";
import { SourceDocumentFrame } from "./source-document-frame";

export function DocumentPageView({
  data,
  viewer,
}: Readonly<{
  data: DocumentPageData;
  viewer?: AuthViewer;
}>) {
  const { siteSettings, navigationFolders, folder, document, breadcrumbs, relatedDocuments } = data;
  const preserveSourceFormatting = document.renderMode === "source";
  const documentBodyHtml = document.bodyHtml;
  const documentOutline = document.outline;
  const readingTime = document.readingTime;

  if (preserveSourceFormatting) {
    return (
      <SiteFrame siteSettings={siteSettings} navigationFolders={navigationFolders} viewer={viewer}>
        <section className="document-stage paper-panel source-document-stage">
          <Breadcrumbs items={breadcrumbs} />

          <div className="document-stage-grid">
            <div className="document-stage-copy">
              <div className="document-stage-kicker">
                <p className="section-eyebrow">文档</p>
                <AccessBadge mode={document.accessMode} />
                <span className="document-stage-folder">所属栏目：{folder.name}</span>
                <span className="document-format-badge">保留原格式</span>
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
                  <span className="document-stage-stat-label">显示方式</span>
                  <strong className="document-stage-stat-value">原始 HTML</strong>
                </div>
              </div>
            </div>

            <aside className="document-stage-aside">
              <div className="document-stage-note">
                <p className="mini-caption">阅读提示</p>
                <p>
                  这篇文档启用了保留原格式，下面会直接展示上传时的原始 HTML。站内主题只作用于外层
                  导航和信息区，不会清洗或改写文档本体样式。
                </p>
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
              </div>
            </aside>
          </div>
        </section>

        <section className="source-document-page" aria-label={document.title}>
          <div className="source-document-shell paper-panel">
            <SourceDocumentFrame title={document.title} html={document.bodyHtml} />
          </div>
        </section>
      </SiteFrame>
    );
  }

  return (
    <SiteFrame siteSettings={siteSettings} navigationFolders={navigationFolders} viewer={viewer}>
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
              <p>
                当前是站内统一阅读版，只作用于站内渲染文档。勾选了保留原格式的文档会继续走原始
                HTML iframe 展示，不会被这里的样式改写。
              </p>
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
