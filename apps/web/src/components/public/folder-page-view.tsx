import Link from "next/link";

import { FavoriteToggleButton } from "@/components/account/favorite-toggle-button";
import { RecentViewTracker } from "@/components/account/recent-view-tracker";
import { buildLoginHref, type AuthViewer } from "@/lib/auth/server";
import { isAccountFavorite } from "@/lib/account/repository";
import { accessLabelMap } from "@/lib/content/constants";
import type { AccentTone, FolderPageData, ViewMode } from "@/lib/content/types";
import { formatDate, toHref } from "@/lib/content/utils";

import {
  AccessBadge,
  Breadcrumbs,
  SiteFrame,
  TagList,
  ViewModeSwitch,
} from "./site-frame";

const accentLabelMap: Record<AccentTone, string> = {
  clay: "陶土调",
  sage: "鼠尾草调",
  sky: "天青调",
  rose: "玫瑰调",
};

export async function FolderPageView({
  data,
  viewMode,
  viewer,
}: Readonly<{
  data: FolderPageData;
  viewMode: ViewMode;
  viewer?: AuthViewer;
}>) {
  const { siteSettings, navigationFolders, folder, breadcrumbs, childFolders, childDocuments } = data;
  const totalItems = childFolders.length + childDocuments.length;
  const hasDocuments = childDocuments.length > 0;
  const hasChildFolders = childFolders.length > 0;
  const isFavorited =
    viewer?.profileId ? await isAccountFavorite(viewer.profileId, "folder", folder.id) : false;
  const folderHref = toHref(folder.routePath);
  const favoriteLoginHref = buildLoginHref(folderHref);

  return (
    <SiteFrame siteSettings={siteSettings} navigationFolders={navigationFolders} viewer={viewer}>
      <RecentViewTracker
        enabled={Boolean(viewer?.isAuthenticated && viewer.profileId)}
        targetType="folder"
        targetId={folder.id}
      />

      <section className="folder-stage paper-panel" data-accent={folder.accent}>
        <Breadcrumbs items={breadcrumbs} />

        <div className="folder-stage-grid">
          <div className="folder-stage-copy">
            <div className="folder-stage-kicker">
              <p className="section-eyebrow">栏目</p>
              <span className="folder-stage-tone">{accentLabelMap[folder.accent]}</span>
            </div>

            <h1 className="page-title">{folder.name}</h1>
            <p className="page-description">
              {folder.description || "在这个栏目中继续浏览分组后的内容、文档与长期维护资料。"}
            </p>

            <div className="folder-stage-stats" aria-label="栏目概览">
              <div className="folder-stage-stat">
                <span className="folder-stage-stat-value">{childFolders.length}</span>
                <span className="folder-stage-stat-label">下级栏目</span>
              </div>
              <div className="folder-stage-stat">
                <span className="folder-stage-stat-value">{childDocuments.length}</span>
                <span className="folder-stage-stat-label">文档</span>
              </div>
              <div className="folder-stage-stat">
                <span className="folder-stage-stat-value">{totalItems}</span>
                <span className="folder-stage-stat-label">总条目</span>
              </div>
            </div>
          </div>

          <aside className="folder-stage-aside">
            <div className="folder-stage-note">
              <p className="folder-stage-note-label">导览提示</p>
              <p>{folder.heroNote || "先浏览下级栏目，再进入文档正文，会更容易找到目标内容。"}</p>
            </div>

            <div className="folder-stage-meta">
              <div className="folder-stage-meta-block">
                <span className="mini-caption">访问方式</span>
                <AccessBadge mode={folder.accessMode} />
              </div>
              <div className="folder-stage-meta-block">
                <span className="mini-caption">当前权限</span>
                <strong>{accessLabelMap[folder.accessMode]}</strong>
              </div>
            </div>

            <div className="document-actions">
              <Link
                href={`/kb?scopeType=folder&routePath=${encodeURIComponent(folder.routePath)}`}
                className="hero-button hero-button-strong"
              >
                知识库问答
              </Link>
              <FavoriteToggleButton
                enabled={Boolean(viewer?.isAuthenticated && viewer.profileId)}
                initialFavorited={isFavorited}
                loginHref={favoriteLoginHref}
                targetType="folder"
                targetId={folder.id}
              />
            </div>
          </aside>
        </div>
      </section>

      {hasChildFolders ? (
        <section className="folder-rail paper-panel">
          <div className="folder-rail-heading">
            <div>
              <p className="section-eyebrow">路径展开</p>
              <h2 className="section-title">继续进入下级栏目</h2>
            </div>
            <p className="mini-caption">像资源管理器一样，先选栏目，再进入对应文档。</p>
          </div>

          <div className="folder-chip-grid">
            {childFolders.map((childFolder) => (
              <Link
                key={childFolder.id}
                href={toHref(childFolder.routePath)}
                prefetch
                scroll={false}
                className="folder-rail-card"
              >
                <span className="folder-rail-accent" data-accent={childFolder.accent} aria-hidden="true" />
                <div className="folder-rail-copy">
                  <p className="card-eyebrow">栏目</p>
                  <h3>{childFolder.name}</h3>
                  <p>{childFolder.description || childFolder.heroNote}</p>
                </div>
                <span className="folder-rail-arrow" aria-hidden="true">
                  进入
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="folder-content-shell paper-panel">
        <div className="section-toolbar folder-section-toolbar">
          <div>
            <p className="section-eyebrow">内容</p>
            <h2 className="section-title">本栏文档</h2>
            <p className="mini-caption">
              {hasDocuments
                ? `当前共有 ${childDocuments.length} 篇文档，可按 ${viewMode === "card" ? "卡片" : "列表"} 方式浏览。`
                : hasChildFolders
                  ? "这个栏目下暂时没有直接文档，请先进入上方子栏目。"
                  : "这个栏目里还没有可展示的内容。"}
            </p>
          </div>

          <div className="folder-toolbar-actions">
            <div className="folder-toolbar-badge">
              <span className="mini-caption">视图切换</span>
              <ViewModeSwitch baseHref={toHref(folder.routePath)} current={viewMode} />
            </div>
          </div>
        </div>

        {!hasDocuments ? (
          <div className="folder-empty-note">
            <strong>{hasChildFolders ? "先进入子栏目" : "暂时还没有内容"}</strong>
            <p>
              {hasChildFolders
                ? "上方已经为你展开了下级栏目，点击任意栏目即可继续进入。"
                : "管理员还没有在这个栏目中发布文档，稍后再来查看。"}
            </p>
          </div>
        ) : viewMode === "card" ? (
          <div className="folder-gallery-grid">
            {childDocuments.map((document) => (
              <Link
                key={document.id}
                href={toHref(document.routePath)}
                prefetch
                className="paper-card document-card folder-document-card"
              >
                <div className="card-topline">
                  <p className="card-eyebrow">文档</p>
                  <AccessBadge mode={document.accessMode} />
                </div>
                <h2>{document.title}</h2>
                <p>{document.summary}</p>
                <TagList tags={document.tags} />
                <div className="card-meta">
                  <span>{document.readingTime}</span>
                  <span>{formatDate(document.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="list-board folder-list-board">
            <div className="list-header">
              <span>名称</span>
              <span>权限</span>
              <span>标签</span>
              <span>更新时间</span>
              <span>操作</span>
            </div>

            {childDocuments.map((document) => (
              <Link
                key={document.id}
                href={toHref(document.routePath)}
                prefetch
                className="list-row list-row-rich"
              >
                <div>
                  <strong>{document.title}</strong>
                  <p>{document.summary}</p>
                </div>
                <span>{accessLabelMap[document.accessMode]}</span>
                <span>{document.tags.join(" / ") || "未设置标签"}</span>
                <span>{formatDate(document.updatedAt)}</span>
                <span className="row-more">查看</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteFrame>
  );
}
