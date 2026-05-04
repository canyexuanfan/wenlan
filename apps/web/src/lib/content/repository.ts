import "server-only";

import { cache } from "react";

import { getAuthViewer, viewerCanManageAdmin } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMockModeForced, isSupabaseConfigured } from "@/lib/supabase/config";
import { downloadDocumentObject } from "@/lib/storage/document-storage";
import type { Database } from "@/types/database";

import { getMockHomePageData, getMockPublicRouteData } from "./mock-repository";
import { sanitizeDocumentHtml } from "./html";
import type {
  DocumentPageData,
  DocumentRecord,
  FolderPageData,
  FolderRecord,
  HomeSearchFilters,
  HomePageData,
  OutlineItem,
  PublicRouteData,
  SiteSettings,
} from "./types";
import {
  buildRoutePath,
  getRoutePrefixes,
  normalizeIncomingRoutePath,
  normalizeSearchInput,
  toHref,
} from "./utils";

type SupabaseReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

type ContentViewer = {
  isAuthenticated: boolean;
  email: string | null;
  profileId: string | null;
  siteRole: Database["app"]["Enums"]["site_role"] | null;
  groupIds: string[];
};

type AppClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AppSchema = Database["app"]["Tables"];
type SiteSettingsRow = AppSchema["site_settings"]["Row"];
type FolderRow = AppSchema["folders"]["Row"];
type DocumentRow = AppSchema["documents"]["Row"];
type DocumentListRow = Omit<DocumentRow, "body_html" | "rendered_body_html"> & {
  body_html?: string | null;
  rendered_body_html?: string | null;
};
type DocumentAssetRow = Pick<
  AppSchema["document_assets"]["Row"],
  "file_name" | "mime_type" | "storage_bucket" | "storage_path"
>;
type DocumentOutlineRow = AppSchema["document_outlines"]["Row"];
type EffectiveContentAccessMode = Exclude<Database["app"]["Enums"]["access_mode"], "inherit">;
type ResolvedContentAccess = {
  effectiveAccessMode: EffectiveContentAccessMode;
  grantTargetType: Database["app"]["Enums"]["target_type"] | null;
  grantTargetId: string | null;
};

const CONTENT_READ_TIMEOUT_MS = (() => {
  const rawValue = Number.parseInt(
    process.env.WENLAN_CONTENT_READ_TIMEOUT_MS ?? "8000",
    10,
  );

  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 8000;
})();

function withContentReadTimeout<T>(label: string, operation: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`[content] ${label} timeout after ${CONTENT_READ_TIMEOUT_MS}ms`),
      );
    }, CONTENT_READ_TIMEOUT_MS);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function readFromSupabase<T>(
  label: string,
  reader: (client: AppClient, viewer: ContentViewer) => Promise<T>,
): Promise<SupabaseReadResult<T>> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  try {
    const client = await createSupabaseServerClient();
    const viewer = await getContentViewer();

    return {
      status: "ok",
      data: await withContentReadTimeout(label, reader(client, viewer)),
    };
  } catch (error) {
    console.warn(`[content] ${label} unavailable`, error);

    return { status: "unavailable" };
  }
}

const getContentViewer = cache(async function getContentViewer(): Promise<ContentViewer> {
  const viewer = await getAuthViewer();

  if (!viewer.isAuthenticated || !viewer.profileId) {
    return {
      isAuthenticated: false,
      email: null,
      profileId: null,
      siteRole: null,
      groupIds: [],
    };
  }

  if (viewerCanManageAdmin(viewer.siteRole)) {
    return {
      isAuthenticated: true,
      email: viewer.email,
      profileId: viewer.profileId,
      siteRole: viewer.siteRole,
      groupIds: [],
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("group_members")
    .select("group_id")
    .eq("user_id", viewer.profileId);

  if (error) {
    throw error;
  }

  return {
    isAuthenticated: true,
    email: viewer.email,
    profileId: viewer.profileId,
    siteRole: viewer.siteRole,
    groupIds: data.map((row) => row.group_id),
  };
});

function getAppSchema(client: AppClient) {
  return client.schema("app");
}

const getTargetAccessGrants = cache(async function getTargetAccessGrants(
  targetType: Database["app"]["Enums"]["target_type"],
  targetId: string,
) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("access_grants")
    .select("subject_type, subject_id, access_level")
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) {
    throw error;
  }

  return data;
});

const getFolderRowById = cache(async function getFolderRowById(folderId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("folders")
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .eq("id", folderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
});

function getDirectFolderAccess(
  folder: Pick<FolderRow, "id" | "access_mode">,
): ResolvedContentAccess | null {
  if (folder.access_mode === "inherit") {
    return null;
  }

  return {
    effectiveAccessMode: folder.access_mode,
    grantTargetType:
      folder.access_mode === "specific_users" || folder.access_mode === "group" ? "folder" : null,
    grantTargetId:
      folder.access_mode === "specific_users" || folder.access_mode === "group" ? folder.id : null,
  };
}

function getDirectDocumentAccess(
  document: Pick<DocumentRow, "id" | "access_mode">,
): ResolvedContentAccess | null {
  if (document.access_mode === "inherit") {
    return null;
  }

  return {
    effectiveAccessMode: document.access_mode,
    grantTargetType:
      document.access_mode === "specific_users" || document.access_mode === "group"
        ? "document"
        : null,
    grantTargetId:
      document.access_mode === "specific_users" || document.access_mode === "group"
        ? document.id
        : null,
  };
}

const resolveFolderAccessCached = cache(async function resolveFolderAccessCached(
  folderId: string,
  parentId: string | null,
  accessMode: FolderRow["access_mode"],
): Promise<ResolvedContentAccess> {
  const folder = {
    id: folderId,
    parent_id: parentId,
    access_mode: accessMode,
  };
  const directAccess = getDirectFolderAccess(folder);

  if (directAccess) {
    return directAccess;
  }

  if (!parentId) {
    return {
      effectiveAccessMode: "private",
      grantTargetType: null,
      grantTargetId: null,
    };
  }

  const parentFolder = await getFolderRowById(parentId);

  if (!parentFolder) {
    return {
      effectiveAccessMode: "private",
      grantTargetType: null,
      grantTargetId: null,
    };
  }

  return resolveFolderAccess(parentFolder);
});

async function resolveFolderAccess(folder: Pick<FolderRow, "id" | "parent_id" | "access_mode">): Promise<ResolvedContentAccess> {
  return resolveFolderAccessCached(folder.id, folder.parent_id, folder.access_mode);
}

const resolveDocumentAccessCached = cache(async function resolveDocumentAccessCached(
  documentId: string,
  folderId: string | null,
  accessMode: DocumentRow["access_mode"],
): Promise<ResolvedContentAccess> {
  const document = {
    id: documentId,
    folder_id: folderId,
    access_mode: accessMode,
  };
  const directAccess = getDirectDocumentAccess(document);

  if (directAccess) {
    return directAccess;
  }

  if (!folderId) {
    return {
      effectiveAccessMode: "private",
      grantTargetType: null,
      grantTargetId: null,
    };
  }

  const folder = await getFolderRowById(folderId);

  if (!folder) {
    return {
      effectiveAccessMode: "private",
      grantTargetType: null,
      grantTargetId: null,
    };
  }

  return resolveFolderAccess(folder);
});

async function resolveDocumentAccess(document: Pick<DocumentRow, "id" | "folder_id" | "access_mode">): Promise<ResolvedContentAccess> {
  return resolveDocumentAccessCached(document.id, document.folder_id, document.access_mode);
}

async function canViewerAccessResolvedTarget(
  viewer: ContentViewer,
  resolvedAccess: ResolvedContentAccess,
) {
  if (viewerCanManageAdmin(viewer.siteRole)) {
    return true;
  }

  switch (resolvedAccess.effectiveAccessMode) {
    case "public":
    case "share":
      return true;
    case "login":
      return viewer.isAuthenticated;
    case "specific_users": {
      if (!viewer.profileId || !resolvedAccess.grantTargetType || !resolvedAccess.grantTargetId) {
        return false;
      }

      const grants = await getTargetAccessGrants(
        resolvedAccess.grantTargetType,
        resolvedAccess.grantTargetId,
      );

      return grants.some(
        (grant) => grant.subject_type === "user" && grant.subject_id === viewer.profileId,
      );
    }
    case "group": {
      if (
        !viewer.profileId ||
        viewer.groupIds.length === 0 ||
        !resolvedAccess.grantTargetType ||
        !resolvedAccess.grantTargetId
      ) {
        return false;
      }

      const grants = await getTargetAccessGrants(
        resolvedAccess.grantTargetType,
        resolvedAccess.grantTargetId,
      );

      return grants.some(
        (grant) => grant.subject_type === "group" && viewer.groupIds.includes(grant.subject_id),
      );
    }
    default:
      return false;
  }
}

function isDiscoverableAccessMode(
  mode: EffectiveContentAccessMode,
  viewer: ContentViewer,
) {
  return viewerCanManageAdmin(viewer.siteRole) || mode !== "share";
}

async function canViewerAccessFolder(
  viewer: ContentViewer,
  folder: Pick<FolderRow, "id" | "parent_id" | "access_mode">,
) {
  if (viewerCanManageAdmin(viewer.siteRole)) {
    return true;
  }

  const directAccess = getDirectFolderAccess(folder);

  if (directAccess) {
    return canViewerAccessResolvedTarget(viewer, directAccess);
  }

  return canViewerAccessResolvedTarget(viewer, await resolveFolderAccess(folder));
}

async function canViewerAccessDocument(
  viewer: ContentViewer,
  document: Pick<DocumentRow, "id" | "folder_id" | "access_mode">,
) {
  if (viewerCanManageAdmin(viewer.siteRole)) {
    return true;
  }

  const directAccess = getDirectDocumentAccess(document);

  if (directAccess) {
    return canViewerAccessResolvedTarget(viewer, directAccess);
  }

  return canViewerAccessResolvedTarget(viewer, await resolveDocumentAccess(document));
}

async function filterReadableFolders(rows: FolderRow[], viewer: ContentViewer) {
  const visibility = await Promise.all(
    rows.map(async (row) => {
      const resolvedAccess = getDirectFolderAccess(row) ?? (await resolveFolderAccess(row));

      return {
        row,
        isReadable:
          (await canViewerAccessResolvedTarget(viewer, resolvedAccess)) &&
          isDiscoverableAccessMode(resolvedAccess.effectiveAccessMode, viewer),
      };
    }),
  );

  return visibility.filter((item) => item.isReadable).map((item) => item.row);
}

async function filterReadableDocuments<T extends Pick<DocumentRow, "id" | "folder_id" | "access_mode">>(
  rows: T[],
  viewer: ContentViewer,
) {
  const visibility = await Promise.all(
    rows.map(async (row) => {
      const resolvedAccess = getDirectDocumentAccess(row) ?? (await resolveDocumentAccess(row));

      return {
        row,
        isReadable:
          (await canViewerAccessResolvedTarget(viewer, resolvedAccess)) &&
          isDiscoverableAccessMode(resolvedAccess.effectiveAccessMode, viewer),
      };
    }),
  );

  return visibility.filter((item) => item.isReadable).map((item) => item.row);
}

function mapSiteSettings(row: SiteSettingsRow | null): SiteSettings {
  if (!row) {
    return {
      name: "文览",
      subtitle: "把知识、流程与案例整理成清晰可读的在线内容库。",
      heroDescription:
        "这里收纳 SOP、指南、案例与长期维护资料，帮助团队按主题沉淀知识、稳定复用。",
      contactLabel: "联系团队",
      contactUrl: "https://www.hnwen17.top",
      seedMessage: "首页会优先展示可直接阅读的内容，帮助首次访问者快速找到主题入口。",
    };
  }

  return {
    name: row.site_title,
    subtitle: row.site_subtitle,
    heroDescription:
      row.hero_description ??
      "这里收纳 SOP、指南、案例与长期维护资料，帮助团队按主题沉淀知识、稳定复用。",
    contactLabel: row.contact_label,
    contactUrl: row.contact_url,
    seedMessage:
      row.seed_message ?? "首页会优先展示可直接阅读的内容，帮助首次访问者快速找到主题入口。",
  };
}

function normalizeAccessMode(mode: Database["app"]["Enums"]["access_mode"]) {
  switch (mode) {
    case "public":
      return "public" as const;
    case "share":
      return "share" as const;
    case "login":
      return "login" as const;
    case "draft":
      return "private" as const;
    case "specific_users":
      return "specific_users" as const;
    case "group":
      return "group" as const;
    default:
      return "private" as const;
  }
}

function normalizeDocumentRenderMode(value: string | null | undefined) {
  return value === "source" ? "source" : "site";
}

function mapFolderRow(
  row: FolderRow,
  resolvedAccess?: ResolvedContentAccess,
): FolderRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    routePath: row.route_path,
    description: row.description ?? "",
    heroNote: row.hero_note ?? "",
    accessMode: normalizeAccessMode(resolvedAccess?.effectiveAccessMode ?? row.access_mode),
    order: row.order_index,
    accent: row.accent,
  };
}

function buildRootFolderRecord(): FolderRecord {
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

function formatReadingTime(readingTime: string | null) {
  return readingTime && readingTime.trim() ? readingTime : "5 分钟";
}

function resolvePublicDocumentBody(row: DocumentRow | DocumentListRow) {
  if (normalizeDocumentRenderMode(row.render_mode) === "source") {
    return row.body_html ?? "";
  }

  return row.rendered_body_html ?? row.body_html ?? "";
}

function mapDocumentRow(
  row: DocumentRow | DocumentListRow,
  tags: string[] = [],
  outline: OutlineItem[] = [],
  resolvedAccess?: ResolvedContentAccess,
): DocumentRecord {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    slug: row.slug,
    routePath: row.route_path,
    summary: row.summary ?? "",
    tags,
    accessMode: normalizeAccessMode(resolvedAccess?.effectiveAccessMode ?? row.access_mode),
    authorName: row.author_name ?? "文览编辑部",
    updatedAt: row.updated_at.slice(0, 10),
    readingTime: formatReadingTime(row.reading_time),
    featured: row.is_featured,
    renderMode: normalizeDocumentRenderMode(row.render_mode),
    bodyHtml: resolvePublicDocumentBody(row),
    outline,
    relatedIds: [],
  };
}

function mapOutlineRows(rows: DocumentOutlineRow[]): OutlineItem[] {
  return rows.map((row) => ({
    id: row.anchor,
    label: row.text,
    level: row.level,
  }));
}

const getSupabaseSiteSettings = cache(async function getSupabaseSiteSettings() {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("site_settings")
    .select(
      "id, site_title, site_subtitle, hero_description, contact_label, contact_url, seed_message, created_at, updated_at",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapSiteSettings(data);
});

const getTagMap = cache(async function getTagMap(documentIdsKey: string) {
  const documentIds = documentIdsKey ? documentIdsKey.split(",") : [];
  const tagMap = new Map<string, string[]>();
  const adminClient = createSupabaseAdminClient();

  documentIds.forEach((documentId) => {
    tagMap.set(documentId, []);
  });

  if (documentIds.length === 0) {
    return tagMap;
  }

  const { data: documentTags, error: documentTagsError } = await adminClient
    .schema("app")
    .from("document_tags")
    .select("document_id, tag_id")
    .in("document_id", documentIds);

  if (documentTagsError) {
    throw documentTagsError;
  }

  const tagIds = [...new Set(documentTags.map((row) => row.tag_id))];

  if (tagIds.length === 0) {
    return tagMap;
  }

  const { data: tags, error: tagsError } = await adminClient
    .schema("app")
    .from("tags")
    .select("id, name")
    .in("id", tagIds);

  if (tagsError) {
    throw tagsError;
  }

  const tagNameMap = new Map(tags.map((row) => [row.id, row.name] satisfies [string, string]));

  for (const row of documentTags) {
    const currentTags = tagMap.get(row.document_id) ?? [];
    const tagName = tagNameMap.get(row.tag_id);

    if (tagName) {
      currentTags.push(tagName);
      tagMap.set(row.document_id, currentTags);
    }
  }

  return tagMap;
});

async function listPublicFoldersByParent(
  _client: AppClient,
  viewer: ContentViewer,
  parentId: string | null,
) {
  const adminClient = createSupabaseAdminClient();
  const query = adminClient
    .schema("app")
    .from("folders")
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .order("order_index", { ascending: true });

  const { data, error } =
    parentId === null
      ? await query.is("parent_id", null)
      : await query.eq("parent_id", parentId);

  if (error) {
    throw error;
  }

  const readableFolders = await filterReadableFolders(data, viewer);
  const resolvedFolderAccess = await Promise.all(
    readableFolders.map(
      async (row) => [row.id, getDirectFolderAccess(row) ?? (await resolveFolderAccess(row))] as const,
    ),
  );
  const resolvedFolderMap = new Map(resolvedFolderAccess);

  return readableFolders.map((row) => mapFolderRow(row, resolvedFolderMap.get(row.id)));
}

async function listPublicDocuments(
  client: AppClient,
  viewer: ContentViewer,
  options?: {
    folderId?: string | null;
    featuredOnly?: boolean;
    excludeDocumentId?: string;
    limit?: number;
  },
) {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .schema("app")
    .from("documents")
    .select(
      "id, folder_id, title, slug, route_path, summary, thumbnail_path, source_type, render_mode, publish_status, access_mode, order_index, version, author_name, reading_time, is_featured, created_by, updated_by, published_at, created_at, updated_at",
    );

  const hasFolderFilter = Boolean(options && "folderId" in options);

  if (hasFolderFilter) {
    query = options?.folderId === null ? query.is("folder_id", null) : query.eq("folder_id", options?.folderId ?? "");
  }

  if (options?.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  if (options?.excludeDocumentId) {
    query = query.neq("id", options.excludeDocumentId);
  }

  query = hasFolderFilter
    ? query.order("order_index", { ascending: true }).order("updated_at", {
        ascending: false,
      })
    : query.order("updated_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const readableDocuments = await filterReadableDocuments(data, viewer);
  const resolvedDocumentAccess = await Promise.all(
    readableDocuments.map(
      async (row) => [row.id, getDirectDocumentAccess(row) ?? (await resolveDocumentAccess(row))] as const,
    ),
  );
  const resolvedDocumentMap = new Map(resolvedDocumentAccess);

  const tagMap = await getTagMap(
    readableDocuments.map((row) => row.id).sort().join(","),
  );

  return readableDocuments.map((row) =>
    mapDocumentRow(
      row,
      tagMap.get(row.id) ?? [],
      [],
      resolvedDocumentMap.get(row.id),
    ),
  );
}

async function listReadableSearchFolders(viewer: ContentViewer) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("folders")
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  const readableFolders = await filterReadableFolders(data, viewer);
  const resolvedFolderAccess = await Promise.all(
    readableFolders.map(
      async (row) => [row.id, getDirectFolderAccess(row) ?? (await resolveFolderAccess(row))] as const,
    ),
  );
  const resolvedFolderMap = new Map(resolvedFolderAccess);

  return readableFolders.map((row) => mapFolderRow(row, resolvedFolderMap.get(row.id)));
}

function buildHomeFilters(filters?: Partial<HomeSearchFilters>): HomeSearchFilters {
  return {
    query: normalizeSearchInput(filters?.query),
    tag: normalizeSearchInput(filters?.tag),
  };
}

function buildEmptyHomePageData(filters?: Partial<HomeSearchFilters>): HomePageData {
  return {
    siteSettings: mapSiteSettings(null),
    filters: buildHomeFilters(filters),
    navigationFolders: [],
    availableTags: [],
    searchFolders: [],
    searchDocuments: [],
    featuredDocuments: [],
    topLevelFolders: [],
    latestDocuments: [],
  };
}

function matchesSearch(texts: string[], query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(normalizedQuery));
}

function filterSearchDocuments(
  documents: DocumentRecord[],
  filters: HomeSearchFilters,
  foldersById: Map<string, FolderRecord>,
) {
  return documents.filter((document) => {
    const folder = document.folderId ? foldersById.get(document.folderId) : undefined;
    const matchesQuery = matchesSearch(
      [
        document.title,
        document.summary,
        document.routePath,
        folder?.name ?? "",
        folder?.description ?? "",
        ...document.tags,
      ],
      filters.query,
    );
    const matchesTag = !filters.tag || document.tags.includes(filters.tag);

    return matchesQuery && matchesTag;
  });
}

function filterSearchFolders(folders: FolderRecord[], filters: HomeSearchFilters) {
  if (!filters.query) {
    return filters.tag ? [] : folders;
  }

  return folders.filter((folder) =>
    matchesSearch([folder.name, folder.description, folder.routePath], filters.query),
  );
}

function collectAvailableTags(documents: DocumentRecord[]) {
  const counts = new Map<string, number>();

  for (const document of documents) {
    for (const tag of document.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .map(([tag]) => tag)
    .slice(0, 12);
}

const getFolderTrailByRoutePath = cache(async function getFolderTrailByRoutePath(routePath: string) {
  const prefixes = getRoutePrefixes(routePath);
  const adminClient = createSupabaseAdminClient();

  if (prefixes.length === 0) {
    return [];
  }

  const { data, error } = await adminClient
    .schema("app")
    .from("folders")
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .in("route_path", prefixes);

  if (error) {
    throw error;
  }

  const folderMap = new Map(
    data.map((row) => [row.route_path, mapFolderRow(row)] satisfies [string, FolderRecord]),
  );

  return prefixes
    .map((prefix) => folderMap.get(prefix))
    .filter((folder): folder is FolderRecord => Boolean(folder));
});

async function getLoginProtectedFolderByRoutePath(routePath: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("folders")
    .select("id, parent_id, name, access_mode")
    .eq("route_path", routePath)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const resolvedAccess = await resolveFolderAccess(data);

  return ["login", "specific_users", "group"].includes(resolvedAccess.effectiveAccessMode)
    ? data
    : null;
}

async function getLoginProtectedDocumentByRoutePath(routePath: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("documents")
    .select("id, folder_id, title, access_mode")
    .eq("route_path", routePath)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const resolvedAccess = await resolveDocumentAccess(data);

  return ["login", "specific_users", "group"].includes(resolvedAccess.effectiveAccessMode)
    ? data
    : null;
}

const getDocumentOutline = cache(async function getDocumentOutline(documentId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("document_outlines")
    .select("id, document_id, level, text, anchor, order_index, created_at")
    .eq("document_id", documentId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  return mapOutlineRows(data);
});

const getDocumentEntryAsset = cache(async function getDocumentEntryAsset(documentId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("document_assets")
    .select("file_name, mime_type, storage_bucket, storage_path")
    .eq("document_id", documentId)
    .eq("is_entry", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
});

function isHtmlEntryAsset(asset: DocumentAssetRow | null): asset is DocumentAssetRow {
  if (!asset) {
    return false;
  }

  return (
    asset.mime_type?.toLowerCase().includes("html") ||
    /\.(html?|xhtml)$/i.test(asset.file_name)
  );
}

function hasSourceFormattingMarkers(html: string) {
  return /<style[\s>]/i.test(html) || /<link\b[^>]*rel=["']?stylesheet/i.test(html);
}

async function restoreSourceDocumentBodyFromEntryAsset(
  document: DocumentRow,
): Promise<DocumentRow> {
  if (document.render_mode !== "source" || document.source_type !== "html") {
    return document;
  }

  const entryAsset = await getDocumentEntryAsset(document.id);

  if (!isHtmlEntryAsset(entryAsset)) {
    return document;
  }

  const htmlEntryAsset = entryAsset;

  try {
    const adminClient = createSupabaseAdminClient();
    const sourceHtml = (
      await downloadDocumentObject(adminClient, {
        bucket: htmlEntryAsset.storage_bucket,
        key: htmlEntryAsset.storage_path,
      })
    ).toString("utf8");

    if (
      sourceHtml.trim() &&
      hasSourceFormattingMarkers(sourceHtml) &&
      !hasSourceFormattingMarkers(document.body_html)
    ) {
      return {
        ...document,
        body_html: sourceHtml,
      };
    }
  } catch (error) {
    console.warn("[content] source document entry restore failed", error);
  }

  return document;
}

async function getDocumentByRoutePath(
  _client: AppClient,
  viewer: ContentViewer,
  routePath: string,
) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("documents")
    .select(
      "id, folder_id, title, slug, route_path, summary, thumbnail_path, source_type, render_mode, publish_status, access_mode, order_index, version, body_html, rendered_body_html, author_name, reading_time, is_featured, created_by, updated_by, published_at, created_at, updated_at",
    )
    .eq("route_path", routePath)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (!(await canViewerAccessDocument(viewer, data))) {
    return null;
  }

  if (data.render_mode === "source") {
    return restoreSourceDocumentBodyFromEntryAsset(data);
  }

  if (data.render_mode !== "source" && !data.rendered_body_html.trim()) {
    const normalizedHtml = sanitizeDocumentHtml(data.body_html.trim());
    const nextDocumentRow: DocumentRow = {
      ...data,
      rendered_body_html: normalizedHtml.bodyHtml,
      reading_time: data.reading_time ?? normalizedHtml.readingTime,
    };

    const { error: updateError } = await adminClient
      .schema("app")
      .from("documents")
      .update({
        rendered_body_html: nextDocumentRow.rendered_body_html,
        reading_time: nextDocumentRow.reading_time,
      })
      .eq("id", data.id);

    if (updateError) {
      console.warn("[content] document render cache refresh failed", updateError);
    }

    return nextDocumentRow;
  }

  return data;
}

async function getFolderByRoutePath(
  _client: AppClient,
  viewer: ContentViewer,
  routePath: string,
) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("folders")
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .eq("route_path", routePath)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return (await canViewerAccessFolder(viewer, data)) ? data : null;
}

async function getFolderById(
  _client: AppClient,
  viewer: ContentViewer,
  folderId: string,
) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("folders")
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .eq("id", folderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return (await canViewerAccessFolder(viewer, data)) ? data : null;
}

async function getSupabaseHomePageData(
  client: AppClient,
  viewer: ContentViewer,
  filters?: Partial<HomeSearchFilters>,
): Promise<HomePageData> {
  const resolvedFilters = buildHomeFilters(filters);
  const hasActiveSearch = Boolean(resolvedFilters.query || resolvedFilters.tag);
  const [siteSettings, topLevelFolders, featuredDocuments, latestDocuments] = await Promise.all([
    getSupabaseSiteSettings(),
    listPublicFoldersByParent(client, viewer, null),
    listPublicDocuments(client, viewer, { featuredOnly: true, limit: 3 }),
    listPublicDocuments(client, viewer, { limit: 5 }),
  ]);

  const [searchableFolders, searchableDocuments] = hasActiveSearch
    ? await Promise.all([listReadableSearchFolders(viewer), listPublicDocuments(client, viewer)])
    : [[], []];

  const foldersById = new Map(searchableFolders.map((folder) => [folder.id, folder] as const));
  const searchDocuments = filterSearchDocuments(
    searchableDocuments,
    resolvedFilters,
    foldersById,
  ).slice(0, 18);
  const searchFolders = filterSearchFolders(searchableFolders, resolvedFilters).slice(0, 12);

  return {
    siteSettings,
    filters: resolvedFilters,
    navigationFolders: topLevelFolders,
    availableTags: collectAvailableTags(
      hasActiveSearch ? searchableDocuments : [...featuredDocuments, ...latestDocuments],
    ),
    searchFolders,
    searchDocuments,
    featuredDocuments,
    topLevelFolders,
    latestDocuments,
  };
}

async function getSupabaseFolderPageData(
  client: AppClient,
  viewer: ContentViewer,
  folderRow: FolderRow,
): Promise<FolderPageData> {
  const folderAccessPromise = resolveFolderAccess(folderRow);
  const [siteSettings, navigationFolders, breadcrumbs, childFolders, childDocuments] =
    await Promise.all([
      getSupabaseSiteSettings(),
      listPublicFoldersByParent(client, viewer, null),
      getFolderTrailByRoutePath(folderRow.route_path),
      listPublicFoldersByParent(client, viewer, folderRow.id),
      listPublicDocuments(client, viewer, { folderId: folderRow.id }),
    ]);
  const folder = mapFolderRow(folderRow, await folderAccessPromise);

  return {
    siteSettings,
    navigationFolders,
    folder,
    breadcrumbs: [
      { label: "首页", href: "/" },
      ...breadcrumbs.map((item) => ({
        label: item.name,
        href: toHref(item.routePath),
      })),
    ],
    childFolders,
    childDocuments,
  };
}

async function getSupabaseDocumentPageData(
  client: AppClient,
  viewer: ContentViewer,
  documentRow: DocumentRow,
): Promise<DocumentPageData | null> {
  const folderRow = documentRow.folder_id
    ? await getFolderById(client, viewer, documentRow.folder_id)
    : null;

  if (documentRow.folder_id && !folderRow) {
    return null;
  }

  const rootDocumentAccess: ResolvedContentAccess = {
    effectiveAccessMode: "private",
    grantTargetType: null,
    grantTargetId: null,
  };
  const folderAccessPromise = folderRow
    ? resolveFolderAccess(folderRow)
    : Promise.resolve(rootDocumentAccess);
  const documentAccessPromise = getDirectDocumentAccess(documentRow)
    ? Promise.resolve(getDirectDocumentAccess(documentRow)!)
    : folderAccessPromise;
  const [siteSettings, navigationFolders, folderTrail, outline, relatedDocuments, tagMap] =
    await Promise.all([
      getSupabaseSiteSettings(),
      listPublicFoldersByParent(client, viewer, null),
      folderRow ? getFolderTrailByRoutePath(folderRow.route_path) : Promise.resolve([]),
      getDocumentOutline(documentRow.id),
      listPublicDocuments(client, viewer, {
        folderId: folderRow?.id ?? null,
        excludeDocumentId: documentRow.id,
        limit: 3,
      }),
      getTagMap(documentRow.id),
    ]);

  const [folderAccess, documentAccess] = await Promise.all([
    folderAccessPromise,
    documentAccessPromise,
  ]);
  const folder = folderRow ? mapFolderRow(folderRow, folderAccess) : buildRootFolderRecord();
  const document = mapDocumentRow(
    documentRow,
    tagMap.get(documentRow.id) ?? [],
    outline,
    documentAccess,
  );

  return {
    siteSettings,
    navigationFolders,
    folder,
    document,
    breadcrumbs: [
      { label: "首页", href: "/" },
      ...folderTrail.map((item) => ({
        label: item.name,
        href: toHref(item.routePath),
      })),
      { label: document.title, href: toHref(document.routePath) },
    ],
    relatedDocuments,
  };
}

async function getSupabasePublicRouteData(
  client: AppClient,
  viewer: ContentViewer,
  slugs: string[],
): Promise<PublicRouteData | null> {
  const routePath = normalizeIncomingRoutePath(slugs);

  if (!routePath) {
    return null;
  }

  const [folderRow, documentRow] = await Promise.all([
    getFolderByRoutePath(client, viewer, routePath),
    getDocumentByRoutePath(client, viewer, routePath),
  ]);

  if (folderRow) {
    return {
      kind: "folder",
      data: await getSupabaseFolderPageData(client, viewer, folderRow),
    };
  }

  if (documentRow) {
    const documentData = await getSupabaseDocumentPageData(client, viewer, documentRow);

    if (!documentData) {
      return null;
    }

    return {
      kind: "document",
      data: documentData,
    };
  }

  if (!viewer.isAuthenticated) {
    const [loginFolder, loginDocument] = await Promise.all([
      getLoginProtectedFolderByRoutePath(routePath),
      getLoginProtectedDocumentByRoutePath(routePath),
    ]);

    if (loginFolder) {
      return {
        kind: "login-required",
        redirectTo: toHref(routePath),
        title: loginFolder.name,
      };
    }

    if (loginDocument) {
      return {
        kind: "login-required",
        redirectTo: toHref(routePath),
        title: loginDocument.title,
      };
    }
  }

  return null;
}

export async function getHomePageData(
  filters?: Partial<HomeSearchFilters>,
): Promise<HomePageData> {
  const supabaseRead = await readFromSupabase("homepage", (client, viewer) =>
    getSupabaseHomePageData(client, viewer, filters),
  );

  if (supabaseRead.status === "ok") {
    return supabaseRead.data;
  }

  if (isMockModeForced()) {
    return getMockHomePageData(filters);
  }

  return buildEmptyHomePageData(filters);
}

const getCachedPublicRouteData = cache(async function getCachedPublicRouteData(
  routeKey: string,
): Promise<PublicRouteData | null> {
  const slugs = routeKey ? routeKey.split("/") : [];
  const supabaseRead = await readFromSupabase("route page", (client, viewer) =>
    getSupabasePublicRouteData(client, viewer, slugs),
  );

  if (supabaseRead.status === "ok") {
    return supabaseRead.data;
  }

  if (isMockModeForced()) {
    return getMockPublicRouteData(slugs);
  }

  return null;
});

export async function getPublicRouteData(
  slugs: string[],
): Promise<PublicRouteData | null> {
  const routeKey = normalizeIncomingRoutePath(slugs);
  return getCachedPublicRouteData(routeKey);
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const supabaseRead = await readFromSupabase("site settings", async () => getSupabaseSiteSettings());

  if (supabaseRead.status === "ok") {
    return supabaseRead.data;
  }

  return mapSiteSettings(null);
}

export async function getPublicStaticPaths() {
  const supabaseRead = await readFromSupabase("static paths", async (client) => {
    const [folderRows, documentRows] = await Promise.all([
      getAppSchema(client)
        .from("folders")
        .select("route_path")
        .eq("access_mode", "public"),
      getAppSchema(client)
        .from("documents")
        .select("route_path")
        .eq("access_mode", "public"),
    ]);

    if (folderRows.error) {
      throw folderRows.error;
    }

    if (documentRows.error) {
      throw documentRows.error;
    }

    return [...folderRows.data, ...documentRows.data].map((row) => ({
      slug: buildRoutePath([row.route_path]).split("/"),
    }));
  });

  if (supabaseRead.status === "ok") {
    return supabaseRead.data;
  }

  return [];
}
