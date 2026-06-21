import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { KnowledgeBaseChatPanel } from "@/components/public/kb-chat-panel";
import { SiteFrame } from "@/components/public/site-frame";
import { buildLoginHref, getAuthViewer, viewerCanManageAdmin } from "@/lib/auth/server";
import type { SiteSettings } from "@/lib/content/types";
import { getPublicRouteData, getSiteSettings } from "@/lib/content/repository";
import { normalizeRoutePath, toHref } from "@/lib/content/utils";

type KnowledgePageProps = {
  searchParams: Promise<{
    routePath?: string;
    scopeType?: string;
  }>;
};

type KnowledgeScopeType = "folder" | "document";

export const metadata: Metadata = {
  title: "知识库问答",
  description: "基于文览文件夹或文档内容进行独立问答。",
};

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const resolvedSearchParams = await searchParams;
  const routePath = normalizeRoutePath(resolvedSearchParams.routePath ?? "");
  const scopeType = resolveScopeType(resolvedSearchParams.scopeType);
  const viewer = await getAuthViewer();
  const canUseServerModelKey = viewerCanManageAdmin(viewer.siteRole);

  if (!routePath) {
    const siteSettings = await getSiteSettings();

    return (
      <SiteFrame
        siteSettings={withKnowledgeSubtitle(siteSettings, "知识库问答")}
        viewer={viewer}
        hideFooter
      >
        <KnowledgeEmptyState
          title="知识库问答"
          description="请先从文件夹页或文档页进入问答，这样系统才能确定回答范围和引用来源。"
          href="/"
          actionLabel="返回首页"
        />
      </SiteFrame>
    );
  }

  const resolvedRoute = await getPublicRouteData(routePathToSegments(routePath));

  if (!resolvedRoute) {
    const siteSettings = await getSiteSettings();

    return (
      <SiteFrame
        siteSettings={withKnowledgeSubtitle(siteSettings, "知识库范围不可用")}
        viewer={viewer}
        hideFooter
      >
        <KnowledgeEmptyState
          title="知识库范围不可用"
          description="这个范围不存在、尚未发布，或当前账号没有访问权限。"
          href="/"
          actionLabel="返回首页"
        />
      </SiteFrame>
    );
  }

  if (resolvedRoute.kind === "login-required") {
    redirect(buildLoginHref(resolvedRoute.redirectTo));
  }

  const scope = resolveScope(scopeType, resolvedRoute);

  if (!scope) {
    const siteSettings =
      resolvedRoute.kind === "folder"
        ? resolvedRoute.data.siteSettings
        : resolvedRoute.data.siteSettings;

    return (
      <SiteFrame
        siteSettings={withKnowledgeSubtitle(siteSettings, "知识库范围不匹配")}
        viewer={viewer}
        hideFooter
      >
        <KnowledgeEmptyState
          title="知识库范围不匹配"
          description="当前链接里的问答类型和实际内容类型不一致，请从原文页面重新进入。"
          href={toHref(routePath)}
          actionLabel="返回原文"
        />
      </SiteFrame>
    );
  }

  return (
    <SiteFrame
      siteSettings={withKnowledgeSubtitle(scope.siteSettings, `${scope.label} · 知识库问答`)}
      viewer={viewer}
      hideFooter
    >
      <section className="kb-chat-workspace">
        <KnowledgeBaseChatPanel
          scopeType={scope.scopeType}
          scopeLabel={scope.label}
          routePath={routePath}
          canUseServerModelKey={canUseServerModelKey}
        />
      </section>
    </SiteFrame>
  );
}

function KnowledgeEmptyState({
  actionLabel,
  description,
  href,
  title,
}: Readonly<{
  actionLabel: string;
  description: string;
  href: string;
  title: string;
}>) {
  return (
    <section className="kb-chat-workspace">
      <section className="kb-empty-state paper-panel">
        <p className="section-eyebrow">Knowledge QA</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
        <div className="hero-actions">
          <Link href={href} className="hero-button hero-button-strong">
            {actionLabel}
          </Link>
        </div>
      </section>
    </section>
  );
}

function withKnowledgeSubtitle(siteSettings: SiteSettings, subtitle: string): SiteSettings {
  return {
    ...siteSettings,
    subtitle,
  };
}

function resolveScopeType(value?: string): KnowledgeScopeType {
  return value === "document" ? "document" : "folder";
}

function routePathToSegments(routePath: string) {
  return normalizeRoutePath(routePath)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function resolveScope(
  scopeType: KnowledgeScopeType,
  route: Exclude<Awaited<ReturnType<typeof getPublicRouteData>>, null | { kind: "login-required" }>,
) {
  if (scopeType === "folder" && route.kind === "folder") {
    return {
      scopeType,
      label: route.data.folder.name,
      siteSettings: route.data.siteSettings,
    };
  }

  if (scopeType === "document" && route.kind === "document") {
    return {
      scopeType,
      label: route.data.document.title,
      siteSettings: route.data.siteSettings,
    };
  }

  return null;
}
