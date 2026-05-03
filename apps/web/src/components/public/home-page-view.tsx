import Image from "next/image";
import Link from "next/link";

import { getAuthViewer, viewerCanManageAdmin } from "@/lib/auth/server";
import type { HomePageData, ViewMode } from "@/lib/content/types";
import { buildSearchParams, formatDate, toHref } from "@/lib/content/utils";

import { AccessBadge, SiteFrame, TagList, ViewModeSwitch } from "./site-frame";

export async function HomePageView({
  data,
  viewMode,
}: Readonly<{
  data: HomePageData;
  viewMode: ViewMode;
}>) {
  const {
    siteSettings,
    navigationFolders,
    filters,
    availableTags,
    searchFolders,
    searchDocuments,
    featuredDocuments,
    topLevelFolders,
    latestDocuments,
  } = data;
  const viewer = await getAuthViewer();
  const canManageAdmin = viewerCanManageAdmin(viewer.siteRole);
  const hasActiveSearch = Boolean(filters.query || filters.tag);
  const resultCount = searchFolders.length + searchDocuments.length;
  const homeDocuments = topLevelFolders.length > 0 ? [] : latestDocuments;
  const latestHomeDocuments =
    !hasActiveSearch && topLevelFolders.length > 0 ? latestDocuments.slice(0, 3) : [];
  const hasHomeContent =
    topLevelFolders.length > 0 || homeDocuments.length > 0 || featuredDocuments.length > 0;
  const defaultBrowseHref = topLevelFolders[0]
    ? toHref(topLevelFolders[0].routePath)
    : homeDocuments[0]
      ? toHref(homeDocuments[0].routePath)
      : canManageAdmin
        ? "/admin"
        : viewer.isAuthenticated
          ? "/"
          : "/login";
  const defaultBrowseLabel = hasHomeContent
    ? "浏览内容"
    : canManageAdmin
      ? "上传内容"
      : viewer.isAuthenticated
        ? "进入内容库"
        : "登录";

  function buildHomeHref(next: Partial<{ q: string; tag: string; view: ViewMode }>) {
    const search = buildSearchParams({
      q: next.q ?? filters.query,
      tag: next.tag ?? filters.tag,
      view: next.view ?? viewMode,
    });

    return `/${search}`;
  }

  const libraryBaseHref = `/${buildSearchParams({
    q: filters.query,
    tag: filters.tag,
  })}`;

  return (
    <SiteFrame
      siteSettings={siteSettings}
      navigationFolders={navigationFolders}
      searchValue={filters.query}
      activeTag={filters.tag}
      viewer={viewer}
    >
      <section className="hero-board">
        <div className="hero-copy">
          <p className="hero-kicker">在线文库</p>
          <h1>发现高质量的内容，找到你需要的知识。</h1>
          <p className="hero-description">{siteSettings.heroDescription}</p>
          <div className="hero-actions">
            <Link href={defaultBrowseHref} className="hero-button hero-button-strong">
              {defaultBrowseLabel}
            </Link>
            <a
              href={siteSettings.contactUrl}
              target="_blank"
              rel="noreferrer"
              className="hero-button"
            >
              {siteSettings.contactLabel}
            </a>
          </div>
        </div>

        <div className="hero-stack" aria-label="精选内容">
          <div className="hero-visual-stage" aria-hidden="true">
            <div className="hero-visual-card">
              <Image
                src="/illustrations/wenlan-river.svg"
                alt=""
                width={1440}
                height={960}
                sizes="(max-width: 768px) 92vw, (max-width: 1200px) 48vw, 640px"
                priority
                className="hero-visual-image"
              />
            </div>
            <div className="hero-glass-panel hero-glass-panel-a">
              <span />
              <span />
              <span />
            </div>
            <div className="hero-glass-panel hero-glass-panel-b">
              <span />
              <span />
            </div>
          </div>
          {featuredDocuments.length > 0 ? (
            featuredDocuments.map((document, index) => (
              <Link
                key={document.id}
                href={toHref(document.routePath)}
                prefetch
                className={`feature-paper feature-paper-${index + 1}`}
              >
                <p className="feature-eyebrow">精选</p>
                <h2>{document.title}</h2>
                <p>{document.summary}</p>
                <TagList tags={document.tags} />
              </Link>
            ))
          ) : null}
        </div>
      </section>

      <section className="home-library-panel" aria-labelledby="home-library-title">
      <div className="section-toolbar">
        <div>
          <p className="section-eyebrow">{hasActiveSearch ? "搜索结果" : "浏览"}</p>
          <h2 id="home-library-title" className="section-title">
            {hasActiveSearch
              ? `找到 ${resultCount} 条内容`
              : "按主题浏览"}
          </h2>
        </div>
        <ViewModeSwitch baseHref={libraryBaseHref} current={viewMode} />
      </div>

      <div className="filter-row" aria-label="标签筛选">
        <Link
          href={buildHomeHref({ q: filters.query, tag: "" })}
          className={`filter-chip ${!filters.tag ? "is-active" : ""}`}
        >
          全部
        </Link>
        {availableTags.map((label) => (
          <Link
            key={label}
            href={buildHomeHref({ q: filters.query, tag: filters.tag === label ? "" : label })}
            className={`filter-chip ${filters.tag === label ? "is-active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {hasActiveSearch ? (
        viewMode === "card" ? (
          <section className="gallery-grid">
            {searchFolders.map((folder) => (
              <Link
                key={folder.id}
                href={toHref(folder.routePath)}
                prefetch
                className="paper-card folder-card"
              >
                <p className="card-eyebrow">栏目</p>
                <h3>{folder.name}</h3>
                <p>{folder.description || folder.heroNote || "点击进入，查看栏目内容。"}</p>
              </Link>
            ))}

            {searchDocuments.map((document) => (
              <Link
                key={document.id}
                href={toHref(document.routePath)}
                prefetch
                className="paper-card document-card"
              >
                <div className="card-topline">
                  <p className="card-eyebrow">文档</p>
                  <AccessBadge mode={document.accessMode} />
                </div>
                <h3>{document.title}</h3>
                <p>{document.summary}</p>
                <TagList tags={document.tags} />
                <div className="card-meta">
                  <span>{document.authorName}</span>
                  <span>{formatDate(document.updatedAt)}</span>
                </div>
              </Link>
            ))}

            {resultCount === 0 ? (
              <div className="paper-panel empty-state">
                没找到匹配的内容
              </div>
            ) : null}
          </section>
        ) : (
          <section className="list-board">
            <div className="list-header">
              <span>名称</span>
              <span>类型</span>
              <span>标签 / 路径</span>
              <span>更新时间</span>
            </div>

            {searchFolders.map((folder) => (
              <Link key={folder.id} href={toHref(folder.routePath)} prefetch className="list-row">
                <strong>{folder.name}</strong>
                <span>栏目</span>
                <span>{folder.routePath}</span>
                <span>—</span>
              </Link>
            ))}

            {searchDocuments.map((document) => (
              <Link key={document.id} href={toHref(document.routePath)} prefetch className="list-row">
                <strong>{document.title}</strong>
                <span>文档</span>
                <span>{document.tags.join(" / ") || document.routePath}</span>
                <span>{formatDate(document.updatedAt)}</span>
              </Link>
            ))}

            {resultCount === 0 ? (
              <div className="empty-state">
                没找到匹配的内容
              </div>
            ) : null}
          </section>
        )
      ) : !hasHomeContent ? (
        <section className="paper-panel empty-state">
          {canManageAdmin ? (
            <>
              还没有内容。前往
              <Link href="/admin" className="hero-link">
                后台
              </Link>
              上传文档。
            </>
          ) : viewer.isAuthenticated ? (
            <>暂无可查看的内容</>
          ) : (
            <>
              请
              <Link href="/login" className="hero-link">
                登录
              </Link>
              查看内容
            </>
          )}
        </section>
      ) : viewMode === "card" ? (
        <section className="gallery-grid">
          {topLevelFolders.map((folder) => (
            <Link
              key={folder.id}
              href={toHref(folder.routePath)}
              prefetch
              className="paper-card folder-card"
            >
              <p className="card-eyebrow">栏目</p>
              <h3>{folder.name}</h3>
              <p>{folder.description || folder.heroNote || "点击进入，查看栏目内容。"}</p>
            </Link>
          ))}

          {homeDocuments.map((document) => (
            <Link
              key={document.id}
              href={toHref(document.routePath)}
              prefetch
              className="paper-card document-card"
            >
              <div className="card-topline">
                <p className="card-eyebrow">最新</p>
                <AccessBadge mode={document.accessMode} />
              </div>
              <h3>{document.title}</h3>
              <p>{document.summary}</p>
              <TagList tags={document.tags} />
              <div className="card-meta">
                <span>{document.authorName}</span>
                <span>{formatDate(document.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="list-board">
          <div className="list-header">
            <span>名称</span>
            <span>类型</span>
            <span>说明</span>
            <span>更新时间</span>
          </div>

          {topLevelFolders.map((folder) => (
            <Link key={folder.id} href={toHref(folder.routePath)} prefetch className="list-row">
              <strong>{folder.name}</strong>
              <span>栏目</span>
              <span>{folder.heroNote || folder.description || "查看栏目"}</span>
              <span>持续更新</span>
            </Link>
          ))}

          {homeDocuments.map((document) => (
            <Link key={document.id} href={toHref(document.routePath)} prefetch className="list-row">
              <strong>{document.title}</strong>
              <span>文档</span>
              <span>{document.tags.join(" / ")}</span>
              <span>{formatDate(document.updatedAt)}</span>
            </Link>
          ))}
        </section>
      )}
      </section>

      {latestHomeDocuments.length > 0 ? (
        <section className="home-library-panel" aria-labelledby="home-latest-title">
          <div className="section-toolbar">
            <div>
              <p className="section-eyebrow">最新</p>
              <h2 id="home-latest-title" className="section-title">
                最新公开文档
              </h2>
            </div>
          </div>

          <section className="gallery-grid">
            {latestHomeDocuments.map((document) => (
              <Link
                key={document.id}
                href={toHref(document.routePath)}
                prefetch
                className="paper-card document-card"
              >
                <div className="card-topline">
                  <p className="card-eyebrow">文档</p>
                  <AccessBadge mode={document.accessMode} />
                </div>
                <h3>{document.title}</h3>
                <p>{document.summary}</p>
                <TagList tags={document.tags} />
                <div className="card-meta">
                  <span>{document.authorName}</span>
                  <span>{formatDate(document.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </section>
        </section>
      ) : null}
    </SiteFrame>
  );
}
