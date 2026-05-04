import {
  defaultSiteSettings,
  getFeaturedDocuments,
  getFolderById,
  getFolderTrail,
  getLatestPublicDocuments,
  getPublicFolderChildren,
  getRelatedDocuments,
  getTopLevelFolders,
  resolvePublicRoute,
} from "@/lib/mock-data";

import type {
  BreadcrumbItem,
  DocumentPageData,
  FolderRecord,
  FolderPageData,
  HomeSearchFilters,
  HomePageData,
  PublicRouteData,
} from "./types";
import { normalizeSearchInput, toHref } from "./utils";

function buildFolderBreadcrumbs(folderId: string): BreadcrumbItem[] {
  return [
    { label: "首页", href: "/" },
    ...(folderId ? getFolderTrail(folderId) : []).map((folder) => ({
      label: folder.name,
      href: toHref(folder.routePath),
    })),
  ];
}

function buildRootFolder(): FolderRecord {
  return {
    id: "__root__",
    parentId: null,
    name: "全部内容",
    slug: "",
    routePath: "",
    description: "",
    heroNote: "",
    accessMode: "public",
    order: 0,
    accent: "clay",
  };
}

function buildDocumentBreadcrumbs(folderId: string | null, title: string, routePath: string) {
  return [
    { label: "首页", href: "/" },
    ...(folderId ? getFolderTrail(folderId) : []).map((folder) => ({
      label: folder.name,
      href: toHref(folder.routePath),
    })),
    { label: title, href: toHref(routePath) },
  ];
}

function matchesSearch(texts: string[], query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(normalizedQuery));
}

function buildHomeFilters(filters?: Partial<HomeSearchFilters>): HomeSearchFilters {
  return {
    query: normalizeSearchInput(filters?.query),
    tag: normalizeSearchInput(filters?.tag),
  };
}

export async function getMockHomePageData(
  filters?: Partial<HomeSearchFilters>,
): Promise<HomePageData> {
  const resolvedFilters = buildHomeFilters(filters);
  const topLevelFolders = getTopLevelFolders();
  const publicDocuments = getLatestPublicDocuments(100);
  const availableTags = [...new Set(publicDocuments.flatMap((document) => document.tags))].sort(
    (left, right) => left.localeCompare(right, "zh-CN"),
  );
  const searchFolders = topLevelFolders.filter((folder) =>
    matchesSearch([folder.name, folder.description, folder.routePath], resolvedFilters.query),
  );
  const searchDocuments = publicDocuments.filter((document) => {
    const matchesQuery = matchesSearch(
      [document.title, document.summary, document.routePath, ...document.tags],
      resolvedFilters.query,
    );
    const matchesTag = !resolvedFilters.tag || document.tags.includes(resolvedFilters.tag);

    return matchesQuery && matchesTag;
  });

  return {
    siteSettings: defaultSiteSettings,
    filters: resolvedFilters,
    navigationFolders: topLevelFolders,
    availableTags,
    searchFolders,
    searchDocuments,
    featuredDocuments: getFeaturedDocuments(),
    topLevelFolders,
    latestDocuments: getLatestPublicDocuments(5),
  };
}

export async function getMockPublicRouteData(
  slugs: string[],
): Promise<PublicRouteData | null> {
  const resolvedRoute = resolvePublicRoute(slugs);

  if (!resolvedRoute) {
    return null;
  }

  if (resolvedRoute.kind === "folder") {
    const { childFolders, childDocuments } = getPublicFolderChildren(
      resolvedRoute.folder.id,
    );

    const data: FolderPageData = {
      siteSettings: defaultSiteSettings,
      navigationFolders: getTopLevelFolders(),
      folder: resolvedRoute.folder,
      breadcrumbs: buildFolderBreadcrumbs(resolvedRoute.folder.id),
      childFolders,
      childDocuments,
    };

    return {
      kind: "folder",
      data,
    };
  }

  const folder = resolvedRoute.document.folderId
    ? getFolderById(resolvedRoute.document.folderId)
    : buildRootFolder();

  if (!folder) {
    return null;
  }

  const data: DocumentPageData = {
    siteSettings: defaultSiteSettings,
    navigationFolders: getTopLevelFolders(),
    folder,
    document: resolvedRoute.document,
    breadcrumbs: buildDocumentBreadcrumbs(
      resolvedRoute.document.folderId,
      resolvedRoute.document.title,
      resolvedRoute.document.routePath,
    ),
    relatedDocuments: getRelatedDocuments(resolvedRoute.document.id),
  };

  return {
    kind: "document",
    data,
  };
}
