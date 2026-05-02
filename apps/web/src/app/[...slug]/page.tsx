import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentPageView } from "@/components/public/document-page-view";
import { FolderPageView } from "@/components/public/folder-page-view";
import { buildLoginHref, getAuthViewer } from "@/lib/auth/server";
import { getPublicRouteData } from "@/lib/content/repository";
import { resolveViewMode } from "@/lib/content/utils";
import { defaultSiteSettings } from "@/lib/mock-data";

type RoutePageProps = {
  params: Promise<{
    slug: string[];
  }>;
  searchParams: Promise<{
    view?: string;
  }>;
};

export async function generateMetadata({
  params,
}: RoutePageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedRoute = await getPublicRouteData(slug);

  if (!resolvedRoute) {
    return {
      title: "页面不存在",
    };
  }

  if (resolvedRoute.kind === "login-required") {
    return {
      title: `${resolvedRoute.title} | 登录后查看`,
      description: "登录后可继续访问这部分内容。",
    };
  }

  if (resolvedRoute.kind === "folder") {
    return {
      title: resolvedRoute.data.folder.name,
      description: resolvedRoute.data.folder.description,
    };
  }

  return {
    title: resolvedRoute.data.document.title,
    description: resolvedRoute.data.document.summary,
    openGraph: {
      title: `${resolvedRoute.data.document.title} | ${defaultSiteSettings.name}`,
      description: resolvedRoute.data.document.summary,
    },
  };
}

export default async function CatchAllPage({
  params,
  searchParams,
}: RoutePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const viewMode = resolveViewMode(resolvedSearchParams.view);
  const [viewer, resolvedRoute] = await Promise.all([
    getAuthViewer(),
    getPublicRouteData(slug),
  ]);

  if (!resolvedRoute) {
    notFound();
  }

  if (resolvedRoute.kind === "login-required") {
    redirect(buildLoginHref(resolvedRoute.redirectTo));
  }

  if (resolvedRoute.kind === "folder") {
    return <FolderPageView data={resolvedRoute.data} viewMode={viewMode} viewer={viewer} />;
  }

  return <DocumentPageView data={resolvedRoute.data} viewer={viewer} />;
}
