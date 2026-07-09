import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import MarkdownIt from "markdown-it";

import type { AuthViewer } from "@/lib/auth/server";
import {
  getAuthViewer,
  viewerCanManageAdmin,
  viewerCanManageMembers,
} from "@/lib/auth/server";
import { isAdminSiteRole, normalizeEditableSiteRole } from "@/lib/auth/roles";
import type { OutlineItem, SiteSettings } from "@/lib/content/types";
import { parseTagInput, sanitizeDocumentHtml } from "@/lib/content/html";
import {
  defaultSiteSettings,
  documents as mockDocuments,
  folders as mockFolders,
} from "@/lib/mock-data";
import { buildRoutePath, normalizeRoutePath } from "@/lib/content/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getDocumentStorageBucketName,
  removeDocumentObjects,
  uploadDocumentObject,
} from "@/lib/storage/document-storage";
import type { Database } from "@/types/database";

import type {
  AdminAccessGrantRecord,
  AdminDocumentRecord,
  AdminFolderRecord,
  AdminGroupRecord,
  AdminInviteRecord,
  AdminProfileRecord,
  AdminTargetType,
  AdminWorkspaceMode,
  CreateGroupInput,
  CreateInviteInput,
  CreateInviteResult,
  AdminWorkspaceData,
  CreateDocumentInput,
  CreateFolderInput,
  DeleteDocumentInput,
  DeleteFolderInput,
  MoveDocumentInput,
  MoveFolderInput,
  ReorderDocumentInput,
  ReorderFolderInput,
  SyncAccessGrantsInput,
  SyncGroupMembersInput,
  UpdateGroupInput,
  UpdateProfileInput,
  UpdateDocumentInput,
  UpdateFolderInput,
} from "./types";

type AppClient = ReturnType<typeof createSupabaseAdminClient>;
type AppSchema = Database["app"]["Tables"];
type FolderRow = AppSchema["folders"]["Row"];
type DocumentRow = AppSchema["documents"]["Row"];
type ProfileRow = AppSchema["profiles"]["Row"];
type InviteRow = AppSchema["invite_tokens"]["Row"];
type GroupRow = AppSchema["user_groups"]["Row"];
type AccessGrantRow = AppSchema["access_grants"]["Row"];
type SiteSettingsRow = AppSchema["site_settings"]["Row"];
type EffectiveAccessMode = Exclude<Database["app"]["Enums"]["access_mode"], "inherit">;
type ResolvedAdminAccess = {
  effectiveAccessMode: EffectiveAccessMode;
  isAccessInherited: boolean;
  accessSourceLabel: string | null;
  accessSourceType: AdminTargetType | null;
  accessSourceId: string | null;
};

const DEFAULT_DOCUMENT_HTML = `
<section id="overview">
  <h2>Overview</h2>
  <p>Write the first version of this document here. You can paste HTML or start from a simple paragraph.</p>
</section>
`.trim();
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PERMANENT_INVITE_EXPIRES_AT = "9999-12-31T23:59:59.999Z";
const PERMANENT_INVITE_EXPIRES_AT_MS = Date.parse(PERMANENT_INVITE_EXPIRES_AT);

const markdown = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

async function ensureStoredRenderedDocument(
  client: AppClient,
  row: DocumentRow,
): Promise<DocumentRow> {
  if (row.render_mode !== "site" || row.rendered_body_html.trim()) {
    return row;
  }

  const normalizedHtml = sanitizeDocumentHtml(row.body_html.trim());
  const nextRow: DocumentRow = {
    ...row,
    rendered_body_html: normalizedHtml.bodyHtml,
    reading_time: row.reading_time ?? normalizedHtml.readingTime,
  };

  const { error } = await client
    .schema("app")
    .from("documents")
    .update({
      rendered_body_html: nextRow.rendered_body_html,
      reading_time: nextRow.reading_time,
    })
    .eq("id", row.id);

  if (error) {
    throw error;
  }

  return nextRow;
}

export async function getAdminWorkspaceData(
  mode: AdminWorkspaceMode = "all",
): Promise<AdminWorkspaceData> {
  if (!isSupabaseConfigured()) {
    return getMockAdminWorkspaceData();
  }

  const client = createSupabaseAdminClient();
  const siteSettings = await getSupabaseSiteSettings(client);
  const viewer = await getWorkspaceViewer();

  if (mode === "members") {
    const [profileRows, inviteRows, groupRows, groupMemberRows] = await Promise.all([
      listProfiles(client),
      listInvites(client),
      listGroups(client),
      listGroupMembers(client),
    ]);
    const groupMembersByGroupId = groupMemberRows.reduce<Map<string, string[]>>((map, row) => {
      const current = map.get(row.group_id) ?? [];
      current.push(row.user_id);
      map.set(row.group_id, current);
      return map;
    }, new Map());

    return {
      sourceMode: "supabase",
      canMutate: true,
      viewer,
      siteSettings,
      folders: [],
      documents: [],
      profiles: profileRows.map(mapProfileRow),
      invites: inviteRows.map(mapInviteRow),
      groups: groupRows.map((group) =>
        mapGroupRow(group, groupMembersByGroupId.get(group.id) ?? []),
      ),
      grants: [],
    };
  }

  const [folderRows, documentRows, outlineMap, tagMap, profileRows, inviteRows, groupRows, groupMemberRows, accessGrantRows] =
    await Promise.all([
      listFolders(client),
      listDocuments(client),
      getOutlineMap(client),
      getTagMap(client),
      listProfiles(client),
      mode === "all" ? listInvites(client) : Promise.resolve([]),
      listGroups(client),
      listGroupMembers(client),
      listAccessGrants(client),
    ]);
  const childFolderCounts = new Map<string, number>();
  const childDocumentCounts = new Map<string, number>();

  for (const folder of folderRows) {
    if (folder.parent_id) {
      childFolderCounts.set(
        folder.parent_id,
        (childFolderCounts.get(folder.parent_id) ?? 0) + 1,
      );
    }
  }

  for (const document of documentRows) {
    if (document.folder_id) {
      childDocumentCounts.set(
        document.folder_id,
        (childDocumentCounts.get(document.folder_id) ?? 0) + 1,
      );
    }
  }

  const folderRowMap = new Map(folderRows.map((folder) => [folder.id, folder] as const));
  const documentAccessMap = new Map<string, ResolvedAdminAccess>();
  const folderAccessMap = new Map<string, ResolvedAdminAccess>();
  const groupMembersByGroupId = groupMemberRows.reduce<Map<string, string[]>>((map, row) => {
    const current = map.get(row.group_id) ?? [];
    current.push(row.user_id);
    map.set(row.group_id, current);
    return map;
  }, new Map());

  return {
    sourceMode: "supabase",
    canMutate: true,
    viewer,
    siteSettings,
    folders: folderRows.map((folder) =>
      mapFolderRow(
        folder,
        childFolderCounts.get(folder.id) ?? 0,
        childDocumentCounts.get(folder.id) ?? 0,
        resolveFolderAccess(folder, folderRowMap, folderAccessMap),
      ),
    ),
    documents: documentRows.map((document) =>
      mapDocumentRow(
        document,
        tagMap.get(document.id) ?? [],
        mode === "all" ? outlineMap.get(document.id) ?? [] : [],
        resolveDocumentAccess(document, folderRowMap, folderAccessMap, documentAccessMap),
        {
          includeBodyHtml: mode === "all",
          includeOutline: mode === "all",
        },
      ),
    ),
    profiles: profileRows.map(mapProfileRow),
    invites: inviteRows.map(mapInviteRow),
    groups: groupRows.map((group) => mapGroupRow(group, groupMembersByGroupId.get(group.id) ?? [])),
    grants: accessGrantRows.map(mapAccessGrantRow),
  };
}

export async function getAdminDocumentDetail(documentId: string): Promise<AdminDocumentRecord> {
  if (!isSupabaseConfigured()) {
    const document = getMockAdminWorkspaceData().documents.find((item) => item.id === documentId);

    if (!document) {
      throw new Error("Document not found.");
    }

    return document;
  }

  const client = createSupabaseAdminClient();
  const [documentRow, tags, outline] = await Promise.all([
    getDocumentById(client, documentId),
    getDocumentTags(client, documentId),
    getDocumentOutline(client, documentId),
  ]);

  if (!documentRow) {
    throw new Error("Document not found.");
  }

  const hydratedDocument = await ensureStoredRenderedDocument(client, documentRow);

  return mapDocumentRow(
    hydratedDocument,
    tags,
    outline,
    await resolveDocumentAccessForDetail(client, hydratedDocument),
  );
}

export async function createAdminFolder(input: CreateFolderInput) {
  const client = getMutableClient();
  const parentFolder = input.parentId ? await getFolderById(client, input.parentId) : null;

  if (input.parentId && !parentFolder) {
    throw new Error("上级文件夹不存在。");
  }

  const slug = sanitizeSlug(input.slug || input.name);
  const routePath = buildRoutePath([parentFolder?.route_path, slug]);
  await assertRoutePathAvailable(client, routePath);

  const orderIndex = await getNextFolderOrder(client, input.parentId ?? null);
  const insertPayload: AppSchema["folders"]["Insert"] = {
    name: input.name.trim(),
    slug,
    route_path: routePath,
    parent_id: input.parentId ?? null,
    description: sanitizeOptionalText(input.description),
    hero_note: sanitizeOptionalText(input.heroNote),
    access_mode: input.accessMode ?? "inherit",
    order_index: orderIndex,
    accent: input.accent ?? parentFolder?.accent ?? "clay",
  };

  const { data, error } = await client
    .schema("app")
    .from("folders")
    .insert(insertPayload)
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .single();

  if (error) {
    throw error;
  }

  const folderRows = parentFolder ? [parentFolder, data] : [data];
  const folderRowMap = new Map(folderRows.map((folder) => [folder.id, folder] as const));
  const folderAccessMap = new Map<string, ResolvedAdminAccess>();

  return mapFolderRow(
    data,
    0,
    0,
    resolveFolderAccess(data, folderRowMap, folderAccessMap),
  );
}

export async function updateAdminFolder(input: UpdateFolderInput) {
  const client = getMutableClient();
  const folder = await getFolderById(client, input.id);

  if (!folder) {
    throw new Error("未找到文件夹。");
  }

  const updatePayload: AppSchema["folders"]["Update"] = {};

  if (typeof input.name === "string" && input.name.trim()) {
    updatePayload.name = input.name.trim();
  }

  if (typeof input.description === "string") {
    updatePayload.description = sanitizeOptionalText(input.description);
  }

  if (typeof input.heroNote === "string") {
    updatePayload.hero_note = sanitizeOptionalText(input.heroNote);
  }

  if (input.accessMode) {
    updatePayload.access_mode = input.accessMode;
  }

  if (input.accent) {
    updatePayload.accent = input.accent;
  }

  const { data, error } = await client
    .schema("app")
    .from("folders")
    .update(updatePayload)
    .eq("id", input.id)
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .single();

  if (error) {
    throw error;
  }

  const childFolderCount = await countChildFolders(client, data.id);
  const childDocumentCount = await countChildDocuments(client, data.id);
  const allFolders = await listFolders(client);
  const folderRowMap = new Map(allFolders.map((currentFolder) => [currentFolder.id, currentFolder] as const));
  const folderAccessMap = new Map<string, ResolvedAdminAccess>();

  return mapFolderRow(
    data,
    childFolderCount,
    childDocumentCount,
    resolveFolderAccess(data, folderRowMap, folderAccessMap),
  );
}

export async function moveAdminFolder(input: MoveFolderInput) {
  const client = getMutableClient();
  const folder = await getFolderById(client, input.id);

  if (!folder) {
    throw new Error("未找到文件夹。");
  }

  if (folder.parent_id === input.parentId) {
    return folder.id;
  }

  const nextParent = input.parentId ? await getFolderById(client, input.parentId) : null;

  if (input.parentId && !nextParent) {
    throw new Error("未找到目标文件夹。");
  }

  if (nextParent && isFolderDescendantPath(folder.route_path, nextParent.route_path)) {
    throw new Error("文件夹不能移动到自己的子级目录中。");
  }

  const nextRoutePath = buildRoutePath([nextParent?.route_path, folder.slug]);
  await moveFolderTree(client, folder, nextParent, nextRoutePath);

  const orderIndex = await getNextFolderOrder(client, input.parentId);
  const { error } = await client
    .schema("app")
    .from("folders")
    .update({
      parent_id: input.parentId,
      route_path: nextRoutePath,
      order_index: orderIndex,
    })
    .eq("id", input.id);

  if (error) {
    throw error;
  }

  return input.id;
}

export async function reorderAdminFolder(input: ReorderFolderInput) {
  const client = getMutableClient();
  const folder = await getFolderById(client, input.id);

  if (!folder) {
    throw new Error("未找到文件夹。");
  }

  const siblings = await listSiblingFolders(client, folder.parent_id);
  const currentIndex = siblings.findIndex((item) => item.id === folder.id);
  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return input.id;
  }

  const target = siblings[targetIndex];
  await swapFolderOrder(client, folder.id, folder.order_index, target.id, target.order_index);
  return input.id;
}

export async function deleteAdminFolder(input: DeleteFolderInput) {
  const client = getMutableClient();
  const folder = await getFolderById(client, input.id);

  if (!folder) {
    throw new Error("未找到文件夹。");
  }

  const [childFolderCount, childDocumentCount] = await Promise.all([
    countChildFolders(client, input.id),
    countChildDocuments(client, input.id),
  ]);

  if (childFolderCount > 0 || childDocumentCount > 0) {
    throw new Error("目前只支持删除空文件夹。");
  }

  await clearAccessGrants(client, "folder", input.id);

  const { error } = await client.schema("app").from("folders").delete().eq("id", input.id);

  if (error) {
    throw error;
  }

  return input.id;
}

export async function createAdminDocument(input: CreateDocumentInput) {
  const client = getMutableClient();
  const folderId = input.folderId || null;
  const folder = folderId ? await getFolderById(client, folderId) : null;

  if (folderId && !folder) {
    throw new Error("文件夹不存在。");
  }

  const slug = sanitizeSlug(input.slug || input.title);
  const routePath = buildRoutePath([folder?.route_path, slug]);
  await assertRoutePathAvailable(client, routePath);

  const orderIndex = await getNextDocumentOrder(client, folderId);
  const updateDate = new Date().toISOString();
  const renderMode = normalizeDocumentRenderMode(input.renderMode);
  const sourceHtml = (input.bodyHtml || DEFAULT_DOCUMENT_HTML).trim();
  const normalizedHtml = sanitizeDocumentHtml(sourceHtml, [], {
    preserveSourceFormatting: renderMode === "source",
  });

  const insertPayload: AppSchema["documents"]["Insert"] = {
    folder_id: folderId,
    title: input.title.trim(),
    slug,
    route_path: routePath,
    summary: sanitizeOptionalText(input.summary),
    source_type: input.sourceType?.trim() || "html",
    render_mode: renderMode,
    publish_status: "published",
    access_mode: input.accessMode ?? "inherit",
    order_index: orderIndex,
    version: 1,
    body_html: sourceHtml,
    rendered_body_html: normalizedHtml.bodyHtml,
    author_name: "Wenlan Editor",
    reading_time: normalizedHtml.readingTime,
    is_featured: Boolean(input.featured),
    published_at: updateDate,
  };

  const { data, error } = await client
    .schema("app")
    .from("documents")
    .insert(insertPayload)
    .select(
      "id, folder_id, title, slug, route_path, summary, thumbnail_path, source_type, render_mode, publish_status, access_mode, order_index, version, body_html, rendered_body_html, author_name, reading_time, is_featured, created_by, updated_by, published_at, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  await Promise.all([
    replaceDocumentTags(client, data.id, input.tags ?? []),
    replaceDocumentOutline(client, data.id, normalizedHtml.outline),
  ]);

  const allFolders = await listFolders(client);
  const folderRowMap = new Map(allFolders.map((currentFolder) => [currentFolder.id, currentFolder] as const));
  const folderAccessMap = new Map<string, ResolvedAdminAccess>();
  const documentAccessMap = new Map<string, ResolvedAdminAccess>();

  return mapDocumentRow(
    data,
    [],
    [],
    resolveDocumentAccess(data, folderRowMap, folderAccessMap, documentAccessMap),
  );
}

export async function updateAdminDocument(input: UpdateDocumentInput) {
  const client = getMutableClient();
  const document = await getDocumentById(client, input.id);

  if (!document) {
    throw new Error("未找到文档。");
  }

  const updatePayload: AppSchema["documents"]["Update"] = {};
  let nextOutline: OutlineItem[] | null = null;
  const nextRenderMode = normalizeDocumentRenderMode(input.renderMode ?? document.render_mode);

  if (typeof input.title === "string" && input.title.trim()) {
    updatePayload.title = input.title.trim();
  }

  if (typeof input.summary === "string") {
    updatePayload.summary = sanitizeOptionalText(input.summary);
  }

  if (typeof input.bodyHtml === "string" && input.bodyHtml.trim()) {
    const sourceHtml = input.bodyHtml.trim();
    const normalizedHtml = sanitizeDocumentHtml(sourceHtml, [], {
      preserveSourceFormatting: nextRenderMode === "source",
    });
    updatePayload.body_html = sourceHtml;
    updatePayload.rendered_body_html = normalizedHtml.bodyHtml;
    updatePayload.reading_time = normalizedHtml.readingTime;
    nextOutline = normalizedHtml.outline;
  }

  if (input.renderMode) {
    updatePayload.render_mode = nextRenderMode;

    if (!input.bodyHtml && nextRenderMode === "site" && document.render_mode === "source") {
      const normalizedHtml = sanitizeDocumentHtml(document.body_html.trim());
      updatePayload.rendered_body_html = normalizedHtml.bodyHtml;
      updatePayload.reading_time = normalizedHtml.readingTime;
      nextOutline = normalizedHtml.outline;
    }
  }

  if (input.accessMode) {
    updatePayload.access_mode = input.accessMode;
  }

  if (typeof input.featured === "boolean") {
    updatePayload.is_featured = input.featured;
  }

  const { data, error } = await client
    .schema("app")
    .from("documents")
    .update(updatePayload)
    .eq("id", input.id)
    .select(
      "id, folder_id, title, slug, route_path, summary, thumbnail_path, source_type, render_mode, publish_status, access_mode, order_index, version, body_html, rendered_body_html, author_name, reading_time, is_featured, created_by, updated_by, published_at, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  if (input.tags) {
    await replaceDocumentTags(client, data.id, input.tags);
  }

  if (nextOutline) {
    await replaceDocumentOutline(client, data.id, nextOutline);
  }

  const [outlineMap, tagMap] = await Promise.all([getOutlineMap(client), getTagMap(client)]);

  return mapDocumentRow(
    data,
    tagMap.get(data.id) ?? [],
    outlineMap.get(data.id) ?? [],
    resolveDocumentAccess(
      data,
      new Map((await listFolders(client)).map((folderRow) => [folderRow.id, folderRow] as const)),
      new Map<string, ResolvedAdminAccess>(),
      new Map<string, ResolvedAdminAccess>(),
    ),
  );
}

export async function moveAdminDocument(input: MoveDocumentInput) {
  const client = getMutableClient();
  const document = await getDocumentById(client, input.id);

  if (!document) {
    throw new Error("未找到文档。");
  }

  const targetFolderId = input.folderId || null;
  const targetFolder = targetFolderId ? await getFolderById(client, targetFolderId) : null;

  if (targetFolderId && !targetFolder) {
    throw new Error("未找到目标文件夹。");
  }

  if (document.folder_id === targetFolderId) {
    return input.id;
  }

  const nextRoutePath = buildRoutePath([targetFolder?.route_path, document.slug]);
  await assertDocumentRouteAvailable(client, nextRoutePath, document.id);

  const { error } = await client
    .schema("app")
    .from("documents")
    .update({
      folder_id: targetFolderId,
      route_path: nextRoutePath,
      order_index: await getNextDocumentOrder(client, targetFolderId),
    })
    .eq("id", input.id);

  if (error) {
    throw error;
  }

  return input.id;
}

export async function reorderAdminDocument(input: ReorderDocumentInput) {
  const client = getMutableClient();
  const document = await getDocumentById(client, input.id);

  if (!document) {
    throw new Error("未找到文档。");
  }

  const siblings = await listSiblingDocuments(client, document.folder_id);
  const currentIndex = siblings.findIndex((item) => item.id === document.id);
  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return input.id;
  }

  const target = siblings[targetIndex];
  await swapDocumentOrder(
    client,
    document.id,
    document.order_index,
    target.id,
    target.order_index,
  );
  return input.id;
}

export async function deleteAdminDocument(input: DeleteDocumentInput) {
  const client = getMutableClient();
  const document = await getDocumentById(client, input.id);

  if (!document) {
    throw new Error("未找到文档。");
  }

  await clearAccessGrants(client, "document", input.id);

  const [{ error: tagError }, { error: outlineError }] = await Promise.all([
    client.schema("app").from("document_tags").delete().eq("document_id", input.id),
    client.schema("app").from("document_outlines").delete().eq("document_id", input.id),
  ]);

  if (tagError) {
    throw tagError;
  }

  if (outlineError) {
    throw outlineError;
  }

  const { error } = await client.schema("app").from("documents").delete().eq("id", input.id);

  if (error) {
    throw error;
  }

  return input.id;
}

export async function importAdminHtmlDocument(input: {
  folderId: string | null;
  title?: string;
  summary?: string;
  tags?: string;
  accessMode?: Database["app"]["Enums"]["access_mode"];
  renderMode?: "site" | "source";
  featured?: boolean;
  htmlFile: File;
  assetFiles: Array<{
    file: File;
    relativePath: string;
  }>;
}) {
  const client = getMutableClient();
  const folder = input.folderId ? await getFolderById(client, input.folderId) : null;

  if (input.folderId && !folder) {
    throw new Error("文件夹不存在。");
  }

  assertImportDocumentFileAllowed(input.htmlFile);
  assertAssetFilesAllowed(input.assetFiles);

  const uploadedAssets = await uploadAssetFiles(client, input.assetFiles);
  const cleanupStoragePaths = [...uploadedAssets.map((asset) => asset.storagePath)];
  let createdDocument: Awaited<ReturnType<typeof createAdminDocument>> | null = null;

  try {
    const sourceText = await input.htmlFile.text();
    const isMarkdownFile = isMarkdownImportFile(input.htmlFile.name);
    const htmlText = isMarkdownFile ? renderMarkdownDocument(sourceText) : sourceText;
    const sourceHtml = htmlText.trim();
    const renderMode = normalizeDocumentRenderMode(input.renderMode);
    const sourceBodyHtml = rewriteSourceHtmlAssetUrls(sourceHtml, uploadedAssets);
    const sanitized = sanitizeDocumentHtml(
      sourceBodyHtml,
      uploadedAssets.map((asset) => ({
        relativePath: asset.relativePath,
        publicUrl: asset.publicUrl,
      })),
      {
        preserveSourceFormatting: renderMode === "source",
      },
    );
    const title =
      sanitizeOptionalText(input.title) ??
      sanitized.title ??
      stripImportedDocumentExtension(input.htmlFile.name);

    if (!title) {
      throw new Error("请填写文档标题，或上传带有标题的 HTML / Markdown 文件。");
    }

    createdDocument = await createAdminDocument({
      folderId: input.folderId,
      title,
      slug: stripImportedDocumentExtension(input.htmlFile.name),
      summary: sanitizeOptionalText(input.summary) ?? sanitized.summary ?? "",
      sourceType: isMarkdownFile ? "markdown" : "html",
      bodyHtml: sourceBodyHtml,
      tags: parseTagInput(input.tags),
      accessMode: input.accessMode ?? "inherit",
      renderMode,
      featured: Boolean(input.featured),
    });
    const documentId = createdDocument.id;

    const htmlStoragePath = buildImportedAssetPath(documentId, input.htmlFile.name);
    cleanupStoragePaths.push(htmlStoragePath);

    const htmlBuffer = Buffer.from(await input.htmlFile.arrayBuffer());
    const htmlChecksum = createHash("sha256").update(htmlBuffer).digest("hex");
    const entryMimeType = getImportedDocumentMimeType(input.htmlFile);
    const uploadedEntry = await uploadDocumentObject(client, {
      key: htmlStoragePath,
      body: htmlBuffer,
      contentType: getImportedDocumentUploadContentType(input.htmlFile),
    });
    const storageBucket = getDocumentStorageBucketName();
    const assetRows: AppSchema["document_assets"]["Insert"][] = [
      {
        document_id: documentId,
        file_name: input.htmlFile.name,
        mime_type: entryMimeType,
        storage_bucket: uploadedEntry.bucket,
        storage_path: uploadedEntry.key,
        public_url: uploadedEntry.publicUrl,
        checksum: htmlChecksum,
        size_bytes: htmlBuffer.byteLength,
        is_entry: true,
      },
      ...uploadedAssets.map((asset) => ({
        document_id: documentId,
        file_name: asset.fileName,
        mime_type: asset.mimeType,
        storage_bucket: storageBucket,
        storage_path: asset.storagePath,
        public_url: asset.publicUrl,
        checksum: asset.checksum,
        size_bytes: asset.sizeBytes,
        is_entry: false,
      })),
    ];
    const { error: assetInsertError } = await client
      .schema("app")
      .from("document_assets")
      .insert(assetRows);

    if (assetInsertError) {
      throw assetInsertError;
    }

    return createdDocument;
  } catch (error) {
    await cleanupImportedArtifacts(client, cleanupStoragePaths, createdDocument?.id ?? null);
    throw error;
  }
}

export async function createAdminInvite(input: CreateInviteInput, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以发起邀请。");
  }

  const client = getMutableClient();
  const email = sanitizeOptionalEmail(input.email);
  const requestedRole = normalizeEditableSiteRole(input.siteRole);

  assertAssignableInviteRole(viewer.siteRole);

  const expiresInDays = clampInviteExpiry(input.expiresInDays ?? 7);
  const maxUses = clampInviteMaxUses(input.maxUses ?? 1);
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt =
    expiresInDays === 0
      ? PERMANENT_INVITE_EXPIRES_AT
      : new Date(Date.now() + expiresInDays * DAY_IN_MS).toISOString();

  const insertPayload: AppSchema["invite_tokens"]["Insert"] = {
    email,
    invite_token: token,
    token_hash: tokenHash,
    site_role: requestedRole,
    expires_at: expiresAt,
    max_uses: maxUses,
    use_count: 0,
    created_by: viewer.profileId,
  };

  const { data, error } = await client
    .schema("app")
    .from("invite_tokens")
    .insert(insertPayload)
    .select("id, email, invite_token, site_role, expires_at, used_at, max_uses, use_count, created_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...mapInviteRow(data),
    invitePath: `/invite/${token}`,
    inviteToken: token,
  } satisfies CreateInviteResult;
}

export async function reissueAdminInvite(inviteId: string, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以重新生成邀请。");
  }

  const client = getMutableClient();
  const invite = await getInviteById(client, inviteId);

  if (!invite) {
    throw new Error("未找到邀请记录。");
  }

  const recreatedInvite = await createAdminInvite(
    {
      email: invite.email,
      siteRole: normalizeEditableSiteRole(invite.site_role),
      maxUses: invite.max_uses,
      expiresInDays: isPermanentInviteExpiry(invite.expires_at)
        ? 0
        : Math.max(1, Math.ceil((new Date(invite.expires_at).getTime() - Date.now()) / DAY_IN_MS)),
    },
    viewer,
  );

  const { error: deleteError } = await client
    .schema("app")
    .from("invite_tokens")
    .delete()
    .eq("id", inviteId);

  if (deleteError) {
    throw deleteError;
  }

  return recreatedInvite;
}

export async function deleteAdminInvite(inviteId: string, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以作废邀请。");
  }

  const client = getMutableClient();
  const invite = await getInviteById(client, inviteId);

  if (!invite) {
    throw new Error("未找到邀请记录。");
  }

  const { error } = await client
    .schema("app")
    .from("invite_tokens")
    .delete()
    .eq("id", inviteId);

  if (error) {
    throw error;
  }

  return mapInviteRow(invite);
}

export async function updateAdminProfile(input: UpdateProfileInput, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以修改成员角色。");
  }

  const client = getMutableClient();
  const profile = await getProfileById(client, input.id);

  if (!profile) {
    throw new Error("未找到成员。");
  }

  const nextRole = input.siteRole ? normalizeEditableSiteRole(input.siteRole) : null;
  const nextStatus = input.status ? sanitizeProfileStatus(input.status) : null;
  assertAssignableProfileRole(viewer.siteRole, profile.site_role);

  if (profile.id === viewer.profileId && nextStatus && nextStatus !== "active") {
    throw new Error("不能禁用或移出当前管理员账号。");
  }

  const updatePayload: AppSchema["profiles"]["Update"] = {};

  if (nextRole && profile.site_role !== nextRole) {
    updatePayload.site_role = nextRole;
  }

  if (nextStatus && profile.status !== nextStatus) {
    updatePayload.status = nextStatus;
  }

  if (Object.keys(updatePayload).length === 0) {
    return mapProfileRow(profile);
  }

  const { data, error } = await client
    .schema("app")
    .from("profiles")
    .update(updatePayload)
    .eq("id", input.id)
    .select("id, email, display_name, avatar_url, site_role, status, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapProfileRow(data);
}

export async function removeAdminProfile(profileId: string, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以移出成员。");
  }

  if (profileId === viewer.profileId) {
    throw new Error("不能移出当前管理员账号。");
  }

  const client = getMutableClient();
  const profile = await getProfileById(client, profileId);

  if (!profile) {
    throw new Error("未找到成员。");
  }

  assertAssignableProfileRole(viewer.siteRole, profile.site_role);

  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(profile.id);

  if (error) {
    throw error;
  }

  return mapProfileRow({
    ...profile,
    status: "removed",
  });
}

export async function createAdminGroup(input: CreateGroupInput, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以创建用户组。");
  }

  const client = getMutableClient();
  const name = input.name.trim();

  if (!name) {
    throw new Error("请输入用户组名称。");
  }

  const slug = sanitizeSlug(input.slug || input.name);
  const { data, error } = await client
    .schema("app")
    .from("user_groups")
    .insert({
      name,
      slug,
      description: sanitizeOptionalText(input.description),
    })
    .select("id, name, slug, description, created_at")
    .single();

  if (error) {
    throw error;
  }

  return mapGroupRow(data, []);
}

export async function updateAdminGroup(input: UpdateGroupInput, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以编辑用户组。");
  }

  const client = getMutableClient();
  const group = await getGroupById(client, input.groupId);

  if (!group) {
    throw new Error("未找到用户组。");
  }

  const name = input.name.trim();

  if (!name) {
    throw new Error("请输入用户组名称。");
  }

  const { data, error } = await client
    .schema("app")
    .from("user_groups")
    .update({
      name,
      description: sanitizeOptionalText(input.description),
    })
    .eq("id", input.groupId)
    .select("id, name, slug, description, created_at")
    .single();

  if (error) {
    throw error;
  }

  const groupMembers = await listGroupMembers(client);
  const memberIds = groupMembers
    .filter((member) => member.group_id === input.groupId)
    .map((member) => member.user_id);

  return mapGroupRow(data, memberIds);
}

export async function syncAdminGroupMembers(input: SyncGroupMembersInput, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以管理用户组成员。");
  }

  const client = getMutableClient();
  const group = await getGroupById(client, input.groupId);

  if (!group) {
    throw new Error("未找到用户组。");
  }

  const uniqueMemberIds = [...new Set(input.memberIds)];
  const existingProfiles = await listProfilesByIds(client, uniqueMemberIds);

  if (existingProfiles.length !== uniqueMemberIds.length) {
    throw new Error("所选成员中有一个或多个已不存在。");
  }

  const { error: deleteError } = await client
    .schema("app")
    .from("group_members")
    .delete()
    .eq("group_id", input.groupId);

  if (deleteError) {
    throw deleteError;
  }

  if (uniqueMemberIds.length > 0) {
    const { error: insertError } = await client
      .schema("app")
      .from("group_members")
      .insert(
        uniqueMemberIds.map((memberId) => ({
          group_id: input.groupId,
          user_id: memberId,
          role: "member",
        })),
      );

    if (insertError) {
      throw insertError;
    }
  }

  return mapGroupRow(group, uniqueMemberIds);
}

export async function deleteAdminGroup(groupId: string, viewer: AuthViewer) {
  if (!viewerCanManageMembers(viewer.siteRole)) {
    throw new Error("只有管理员可以删除用户组。");
  }

  const client = getMutableClient();
  const group = await getGroupById(client, groupId);

  if (!group) {
    throw new Error("未找到用户组。");
  }

  const { error: grantDeleteError } = await client
    .schema("app")
    .from("access_grants")
    .delete()
    .eq("subject_type", "group")
    .eq("subject_id", groupId);

  if (grantDeleteError) {
    throw grantDeleteError;
  }

  const { error: memberDeleteError } = await client
    .schema("app")
    .from("group_members")
    .delete()
    .eq("group_id", groupId);

  if (memberDeleteError) {
    throw memberDeleteError;
  }

  const { error: groupDeleteError } = await client
    .schema("app")
    .from("user_groups")
    .delete()
    .eq("id", groupId);

  if (groupDeleteError) {
    throw groupDeleteError;
  }

  return mapGroupRow(group, []);
}

export async function syncAdminAccessGrants(input: SyncAccessGrantsInput, viewer: AuthViewer) {
  if (!viewerCanManageAdmin(viewer.siteRole)) {
    throw new Error("需要管理员权限才能管理访问授权。");
  }

  const client = getMutableClient();
  await assertTargetExists(client, input.targetType, input.targetId);

  const uniqueUserIds = [...new Set(input.userIds)];
  const uniqueGroupIds = [...new Set(input.groupIds)];

  if (uniqueUserIds.length > 0) {
    const profiles = await listProfilesByIds(client, uniqueUserIds);

    if (profiles.length !== uniqueUserIds.length) {
      throw new Error("所选用户中有一个或多个已不存在。");
    }
  }

  if (uniqueGroupIds.length > 0) {
    const groups = await listGroupsByIds(client, uniqueGroupIds);

    if (groups.length !== uniqueGroupIds.length) {
      throw new Error("所选用户组中有一个或多个已不存在。");
    }
  }

  const { error: deleteError } = await client
    .schema("app")
    .from("access_grants")
    .delete()
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId);

  if (deleteError) {
    throw deleteError;
  }

  const inserts: AppSchema["access_grants"]["Insert"][] = [
    ...uniqueUserIds.map((userId) => ({
      target_type: input.targetType,
      target_id: input.targetId,
      subject_type: "user",
      subject_id: userId,
      access_level: "view",
    })),
    ...uniqueGroupIds.map((groupId) => ({
      target_type: input.targetType,
      target_id: input.targetId,
      subject_type: "group",
      subject_id: groupId,
      access_level: "view",
    })),
  ];

  if (inserts.length > 0) {
    const { error: insertError } = await client
      .schema("app")
      .from("access_grants")
      .insert(inserts);

    if (insertError) {
      throw insertError;
    }
  }

  const rows = await listAccessGrantsForTarget(client, input.targetType, input.targetId);
  return rows.map(mapAccessGrantRow);
}

function getMockAdminWorkspaceData(): AdminWorkspaceData {
  const childFolderCounts = new Map<string, number>();
  const childDocumentCounts = new Map<string, number>();

  for (const folder of mockFolders) {
    if (folder.parentId) {
      childFolderCounts.set(
        folder.parentId,
        (childFolderCounts.get(folder.parentId) ?? 0) + 1,
      );
    }
  }

  for (const document of mockDocuments) {
    if (!document.folderId) {
      continue;
    }

    childDocumentCounts.set(
      document.folderId,
      (childDocumentCounts.get(document.folderId) ?? 0) + 1,
    );
  }

  const mockFolderRows = mockFolders.map((folder) => ({
    id: folder.id,
    parent_id: folder.parentId,
    name: folder.name,
    slug: folder.slug,
    route_path: folder.routePath,
    description: folder.description || null,
    hero_note: folder.heroNote || null,
    access_mode: folder.accessMode,
    order_index: folder.order,
    accent: folder.accent,
    created_at: "",
    updated_at: "",
    cover_image_path: null,
    created_by: null,
    updated_by: null,
  })) satisfies FolderRow[];
  const mockFolderRowMap = new Map(mockFolderRows.map((folder) => [folder.id, folder] as const));
  const mockFolderAccessMap = new Map<string, ResolvedAdminAccess>();
  const mockDocumentAccessMap = new Map<string, ResolvedAdminAccess>();

  return {
    sourceMode: "mock",
    canMutate: false,
    viewer: {
      email: null,
      displayName: "Mock viewer",
      siteRole: null,
      canManageAdmin: false,
      canManageMembers: false,
    },
    siteSettings: defaultSiteSettings,
    folders: mockFolders.map((folder) => ({
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      slug: folder.slug,
      routePath: folder.routePath,
      description: folder.description,
      heroNote: folder.heroNote,
      accessMode: folder.accessMode,
      ...resolveFolderAccess(
        mockFolderRowMap.get(folder.id)!,
        mockFolderRowMap,
        mockFolderAccessMap,
      ),
      order: folder.order,
      accent: folder.accent,
      childFolderCount: childFolderCounts.get(folder.id) ?? 0,
      childDocumentCount: childDocumentCounts.get(folder.id) ?? 0,
    })),
    documents: mockDocuments.map((document, index) => ({
      id: document.id,
      folderId: document.folderId,
      title: document.title,
      slug: document.slug,
      routePath: document.routePath,
      summary: document.summary,
      tags: document.tags,
      accessMode: document.accessMode,
      ...resolveDocumentAccess(
        {
          id: document.id,
          folder_id: document.folderId,
          title: document.title,
          slug: document.slug,
          route_path: document.routePath,
          summary: document.summary,
          thumbnail_path: null,
          source_type: "html",
          render_mode: document.renderMode,
          publish_status: "published",
          access_mode: document.accessMode,
          order_index: 0,
          version: 1,
          body_html: document.bodyHtml,
          rendered_body_html: document.bodyHtml,
          author_name: document.authorName,
          reading_time: document.readingTime,
          is_featured: Boolean(document.featured),
          created_by: null,
          updated_by: null,
          published_at: null,
          created_at: "",
          updated_at: `${document.updatedAt}T00:00:00.000Z`,
        },
        mockFolderRowMap,
        mockFolderAccessMap,
        mockDocumentAccessMap,
      ),
      renderMode: document.renderMode,
      order: index + 1,
      authorName: document.authorName,
      updatedAt: document.updatedAt,
      readingTime: document.readingTime,
      featured: Boolean(document.featured),
      bodyHtml: document.bodyHtml,
      renderedBodyHtml: document.bodyHtml,
      outline: document.outline,
    })),
    profiles: [],
    invites: [],
    groups: [],
    grants: [],
  };
}

function getMutableClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("当前环境未配置可写 Supabase。");
  }

  return createSupabaseAdminClient();
}

async function getWorkspaceViewer() {
  const viewer = await getAuthViewer();

  return {
    email: viewer.email,
    displayName: viewer.displayName ?? viewer.email ?? "Member",
    siteRole: viewer.siteRole,
    canManageAdmin: viewerCanManageAdmin(viewer.siteRole),
    canManageMembers: viewerCanManageMembers(viewer.siteRole),
  };
}

async function getSupabaseSiteSettings(client: AppClient): Promise<SiteSettings> {
  const { data, error } = await client
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

  return data ? mapSiteSettings(data) : defaultSiteSettings;
}

async function listFolders(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("folders")
    .select(
      "id, parent_id, name, slug, route_path, description, hero_note, access_mode, order_index, accent, created_at, updated_at, cover_image_path, created_by, updated_by",
    )
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function listDocuments(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("documents")
    .select(
      "id, folder_id, title, slug, route_path, summary, thumbnail_path, source_type, render_mode, publish_status, access_mode, order_index, version, body_html, rendered_body_html, author_name, reading_time, is_featured, created_by, updated_by, published_at, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

async function listProfiles(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("profiles")
    .select("id, email, display_name, avatar_url, site_role, status, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return [...data].sort(compareProfilesByRole);
}

async function listInvites(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("invite_tokens")
    .select("id, email, invite_token, site_role, expires_at, used_at, max_uses, use_count, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

async function listGroups(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("user_groups")
    .select("id, name, slug, description, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function listGroupsByIds(client: AppClient, groupIds: string[]) {
  if (groupIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .schema("app")
    .from("user_groups")
    .select("id, name, slug, description, created_at")
    .in("id", groupIds);

  if (error) {
    throw error;
  }

  return data;
}

async function listGroupMembers(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("group_members")
    .select("group_id, user_id, role, created_at");

  if (error) {
    throw error;
  }

  return data;
}

async function listAccessGrants(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("access_grants")
    .select("id, target_type, target_id, subject_type, subject_id, access_level, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function listAccessGrantsForTarget(
  client: AppClient,
  targetType: AdminTargetType,
  targetId: string,
) {
  const { data, error } = await client
    .schema("app")
    .from("access_grants")
    .select("id, target_type, target_id, subject_type, subject_id, access_level, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function getTagMap(client: AppClient) {
  const { data: documentTags, error: documentTagError } = await client
    .schema("app")
    .from("document_tags")
    .select("document_id, tag_id");

  if (documentTagError) {
    throw documentTagError;
  }

  const tagIds = [...new Set(documentTags.map((row) => row.tag_id))];
  const tagMap = new Map<string, string[]>();

  if (tagIds.length === 0) {
    return tagMap;
  }

  const { data: tags, error: tagError } = await client
    .schema("app")
    .from("tags")
    .select("id, name")
    .in("id", tagIds);

  if (tagError) {
    throw tagError;
  }

  const tagNameMap = new Map(tags.map((tag) => [tag.id, tag.name] as const));

  for (const row of documentTags) {
    const current = tagMap.get(row.document_id) ?? [];
    const tagName = tagNameMap.get(row.tag_id);

    if (tagName) {
      current.push(tagName);
      tagMap.set(row.document_id, current);
    }
  }

  return tagMap;
}

async function getDocumentTags(client: AppClient, documentId: string) {
  const { data: documentTags, error: documentTagError } = await client
    .schema("app")
    .from("document_tags")
    .select("tag_id")
    .eq("document_id", documentId);

  if (documentTagError) {
    throw documentTagError;
  }

  const tagIds = [...new Set(documentTags.map((row) => row.tag_id))];

  if (tagIds.length === 0) {
    return [];
  }

  const { data: tags, error: tagError } = await client
    .schema("app")
    .from("tags")
    .select("id, name")
    .in("id", tagIds);

  if (tagError) {
    throw tagError;
  }

  const tagNameMap = new Map(tags.map((tag) => [tag.id, tag.name] as const));

  return tagIds
    .map((tagId) => tagNameMap.get(tagId))
    .filter((tagName): tagName is string => Boolean(tagName));
}

async function replaceDocumentTags(client: AppClient, documentId: string, inputTags: string[]) {
  const tags = [...new Set(inputTags.map((tag) => tag.trim()).filter(Boolean))];
  const { error: deleteError } = await client
    .schema("app")
    .from("document_tags")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw deleteError;
  }

  if (tags.length === 0) {
    return;
  }

  const tagNames = [...new Set(tags)];
  const tagSlugs = tagNames.map((tag) => sanitizeSlug(tag));
  const { data: existingTags, error: existingError } = await client
    .schema("app")
    .from("tags")
    .select("id, name, slug")
    .in("slug", tagSlugs);

  if (existingError) {
    throw existingError;
  }

  const existingSlugMap = new Map(existingTags.map((tag) => [tag.slug, tag.id] as const));
  const missingTagInserts = tagNames
    .map((tag) => ({ name: tag, slug: sanitizeSlug(tag) }))
    .filter((tag) => !existingSlugMap.has(tag.slug));

  if (missingTagInserts.length > 0) {
    const { data: insertedTags, error: insertError } = await client
      .schema("app")
      .from("tags")
      .insert(missingTagInserts)
      .select("id, slug");

    if (insertError) {
      throw insertError;
    }

    for (const tag of insertedTags) {
      existingSlugMap.set(tag.slug, tag.id);
    }
  }

  const documentTagInserts = tagNames
    .map((tag) => existingSlugMap.get(sanitizeSlug(tag)))
    .filter((tagId): tagId is string => Boolean(tagId))
    .map((tagId) => ({
      document_id: documentId,
      tag_id: tagId,
    }));

  if (documentTagInserts.length === 0) {
    return;
  }

  const { error: documentTagError } = await client
    .schema("app")
    .from("document_tags")
    .insert(documentTagInserts);

  if (documentTagError) {
    throw documentTagError;
  }
}

async function replaceDocumentOutline(client: AppClient, documentId: string, outline: OutlineItem[]) {
  const { error: deleteError } = await client
    .schema("app")
    .from("document_outlines")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw deleteError;
  }

  if (outline.length === 0) {
    return;
  }

  const { error: insertError } = await client
    .schema("app")
    .from("document_outlines")
    .insert(
      outline.map((item, index) => ({
        document_id: documentId,
        level: item.level ?? 2,
        text: item.label,
        anchor: item.id,
        order_index: index + 1,
      })),
    );

  if (insertError) {
    throw insertError;
  }
}

async function getOutlineMap(client: AppClient) {
  const { data, error } = await client
    .schema("app")
    .from("document_outlines")
    .select("document_id, level, text, anchor, order_index")
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  const outlineMap = new Map<string, OutlineItem[]>();

  for (const row of data) {
    const current = outlineMap.get(row.document_id) ?? [];
    current.push({
      id: row.anchor,
      label: row.text,
      level: row.level,
    });
    outlineMap.set(row.document_id, current);
  }

  return outlineMap;
}

async function getDocumentOutline(client: AppClient, documentId: string) {
  const { data, error } = await client
    .schema("app")
    .from("document_outlines")
    .select("document_id, level, text, anchor, order_index")
    .eq("document_id", documentId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  return data.map((row) => ({
    id: row.anchor,
    label: row.text,
    level: row.level,
  }));
}

async function getFolderById(client: AppClient, folderId: string) {
  const { data, error } = await client
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
}

async function resolveFolderAccessForDetail(
  client: AppClient,
  row: Pick<FolderRow, "id" | "parent_id" | "name" | "access_mode">,
): Promise<ResolvedAdminAccess> {
  if (row.access_mode !== "inherit") {
    return {
      effectiveAccessMode: row.access_mode,
      isAccessInherited: false,
      accessSourceLabel: row.name,
      accessSourceType: "folder",
      accessSourceId: row.id,
    };
  }

  if (!row.parent_id) {
    return {
      effectiveAccessMode: "private",
      isAccessInherited: false,
      accessSourceLabel: row.name,
      accessSourceType: "folder",
      accessSourceId: row.id,
    };
  }

  const parent = await getFolderById(client, row.parent_id);

  if (!parent) {
    return {
      effectiveAccessMode: "private",
      isAccessInherited: false,
      accessSourceLabel: row.name,
      accessSourceType: "folder",
      accessSourceId: row.id,
    };
  }

  const parentResolved = await resolveFolderAccessForDetail(client, parent);

  return {
    ...parentResolved,
    isAccessInherited: true,
  };
}

async function resolveDocumentAccessForDetail(
  client: AppClient,
  row: Pick<DocumentRow, "id" | "folder_id" | "title" | "access_mode">,
): Promise<ResolvedAdminAccess> {
  if (row.access_mode !== "inherit") {
    return {
      effectiveAccessMode: row.access_mode,
      isAccessInherited: false,
      accessSourceLabel: row.title,
      accessSourceType: "document",
      accessSourceId: row.id,
    };
  }

  const folder = row.folder_id ? await getFolderById(client, row.folder_id) : null;

  if (!folder) {
    return {
      effectiveAccessMode: "private",
      isAccessInherited: false,
      accessSourceLabel: row.title,
      accessSourceType: "document",
      accessSourceId: row.id,
    };
  }

  const folderResolved = await resolveFolderAccessForDetail(client, folder);

  return {
    ...folderResolved,
    isAccessInherited: true,
  };
}

async function getDocumentById(client: AppClient, documentId: string) {
  const { data, error } = await client
    .schema("app")
    .from("documents")
    .select(
      "id, folder_id, title, slug, route_path, summary, thumbnail_path, source_type, render_mode, publish_status, access_mode, order_index, version, body_html, rendered_body_html, author_name, reading_time, is_featured, created_by, updated_by, published_at, created_at, updated_at",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getProfileById(client: AppClient, profileId: string) {
  const { data, error } = await client
    .schema("app")
    .from("profiles")
    .select("id, email, display_name, avatar_url, site_role, status, created_at, updated_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getInviteById(client: AppClient, inviteId: string) {
  const { data, error } = await client
    .schema("app")
    .from("invite_tokens")
    .select("id, email, invite_token, site_role, expires_at, used_at, max_uses, use_count, created_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function listProfilesByIds(client: AppClient, profileIds: string[]) {
  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .schema("app")
    .from("profiles")
    .select("id, email, display_name, avatar_url, site_role, status, created_at, updated_at")
    .in("id", profileIds);

  if (error) {
    throw error;
  }

  return data;
}

async function getGroupById(client: AppClient, groupId: string) {
  const { data, error } = await client
    .schema("app")
    .from("user_groups")
    .select("id, name, slug, description, created_at")
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function assertTargetExists(client: AppClient, targetType: AdminTargetType, targetId: string) {
  if (targetType === "folder") {
    const folder = await getFolderById(client, targetId);

    if (!folder) {
      throw new Error("未找到目标文件夹。");
    }

    return;
  }

  const document = await getDocumentById(client, targetId);

  if (!document) {
    throw new Error("未找到目标文档。");
  }
}

async function countChildFolders(client: AppClient, folderId: string) {
  const { count, error } = await client
    .schema("app")
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", folderId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function countChildDocuments(client: AppClient, folderId: string) {
  const { count, error } = await client
    .schema("app")
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", folderId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getNextFolderOrder(client: AppClient, parentId: string | null) {
  let query = client
    .schema("app")
    .from("folders")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1);

  query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data[0]?.order_index ?? 0) + 1;
}

async function getNextDocumentOrder(client: AppClient, folderId: string | null) {
  let query = client
    .schema("app")
    .from("documents")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1);

  query = folderId === null ? query.is("folder_id", null) : query.eq("folder_id", folderId);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data[0]?.order_index ?? 0) + 1;
}

async function listSiblingFolders(client: AppClient, parentId: string | null) {
  let query = client
    .schema("app")
    .from("folders")
    .select("id, order_index")
    .order("order_index", { ascending: true });

  query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

async function listSiblingDocuments(client: AppClient, folderId: string | null) {
  let query = client
    .schema("app")
    .from("documents")
    .select("id, order_index")
    .order("order_index", { ascending: true });

  query = folderId === null ? query.is("folder_id", null) : query.eq("folder_id", folderId);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

async function swapFolderOrder(
  client: AppClient,
  firstId: string,
  firstOrder: number,
  secondId: string,
  secondOrder: number,
) {
  const { error: firstError } = await client
    .schema("app")
    .from("folders")
    .update({ order_index: secondOrder })
    .eq("id", firstId);

  if (firstError) {
    throw firstError;
  }

  const { error: secondError } = await client
    .schema("app")
    .from("folders")
    .update({ order_index: firstOrder })
    .eq("id", secondId);

  if (secondError) {
    throw secondError;
  }
}

async function swapDocumentOrder(
  client: AppClient,
  firstId: string,
  firstOrder: number,
  secondId: string,
  secondOrder: number,
) {
  const { error: firstError } = await client
    .schema("app")
    .from("documents")
    .update({ order_index: secondOrder })
    .eq("id", firstId);

  if (firstError) {
    throw firstError;
  }

  const { error: secondError } = await client
    .schema("app")
    .from("documents")
    .update({ order_index: firstOrder })
    .eq("id", secondId);

  if (secondError) {
    throw secondError;
  }
}

function isFolderDescendantPath(parentRoutePath: string, candidateRoutePath: string) {
  return candidateRoutePath === parentRoutePath || candidateRoutePath.startsWith(`${parentRoutePath}/`);
}

function replaceRoutePrefix(routePath: string, oldPrefix: string, nextPrefix: string) {
  return routePath === oldPrefix ? nextPrefix : `${nextPrefix}${routePath.slice(oldPrefix.length)}`;
}

async function moveFolderTree(
  client: AppClient,
  folder: FolderRow,
  nextParent: FolderRow | null,
  nextRoutePath: string,
) {
  const [allFolders, allDocuments] = await Promise.all([listFolders(client), listDocuments(client)]);
  const descendantFolders = allFolders.filter(
    (item) => item.id !== folder.id && item.route_path.startsWith(`${folder.route_path}/`),
  );
  const descendantDocuments = allDocuments.filter((item) =>
    item.route_path.startsWith(`${folder.route_path}/`),
  );
  const occupiedRoutes = new Set<string>([
    ...allFolders
      .filter((item) => item.id !== folder.id && !item.route_path.startsWith(`${folder.route_path}/`))
      .map((item) => item.route_path),
    ...allDocuments
      .filter((item) => !item.route_path.startsWith(`${folder.route_path}/`))
      .map((item) => item.route_path),
  ]);
  const nextFolderRoutes = [
    nextRoutePath,
    ...descendantFolders.map((item) =>
      replaceRoutePrefix(item.route_path, folder.route_path, nextRoutePath),
    ),
  ];
  const nextDocumentRoutes = descendantDocuments.map((item) =>
    replaceRoutePrefix(item.route_path, folder.route_path, nextRoutePath),
  );

  for (const routePath of [...nextFolderRoutes, ...nextDocumentRoutes]) {
    if (occupiedRoutes.has(routePath)) {
      throw new Error(`Route "${routePath}" already exists.`);
    }
  }

  for (const descendantFolder of descendantFolders) {
    const { error } = await client
      .schema("app")
      .from("folders")
      .update({
        route_path: replaceRoutePrefix(descendantFolder.route_path, folder.route_path, nextRoutePath),
      })
      .eq("id", descendantFolder.id);

    if (error) {
      throw error;
    }
  }

  for (const descendantDocument of descendantDocuments) {
    const { error } = await client
      .schema("app")
      .from("documents")
      .update({
        route_path: replaceRoutePrefix(descendantDocument.route_path, folder.route_path, nextRoutePath),
      })
      .eq("id", descendantDocument.id);

    if (error) {
      throw error;
    }
  }
}

async function clearAccessGrants(
  client: AppClient,
  targetType: AdminTargetType,
  targetId: string,
) {
  const { error } = await client
    .schema("app")
    .from("access_grants")
    .delete()
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) {
    throw error;
  }
}

async function assertDocumentRouteAvailable(client: AppClient, routePath: string, documentId: string) {
  const normalizedRoutePath = normalizeRoutePath(routePath);
  const [{ data: folderMatches, error: folderError }, { data: documentMatches, error: documentError }] =
    await Promise.all([
      client
        .schema("app")
        .from("folders")
        .select("id")
        .eq("route_path", normalizedRoutePath)
        .limit(1),
      client
        .schema("app")
        .from("documents")
        .select("id")
        .eq("route_path", normalizedRoutePath)
        .neq("id", documentId)
        .limit(1),
    ]);

  if (folderError) {
    throw folderError;
  }

  if (documentError) {
    throw documentError;
  }

  if ((folderMatches?.length ?? 0) > 0 || (documentMatches?.length ?? 0) > 0) {
    throw new Error(`Route "${normalizedRoutePath}" already exists.`);
  }
}

async function assertRoutePathAvailable(client: AppClient, routePath: string) {
  const normalizedRoutePath = normalizeRoutePath(routePath);

  const [{ data: folderMatches, error: folderError }, { data: documentMatches, error: documentError }] =
    await Promise.all([
      client
        .schema("app")
        .from("folders")
        .select("id")
        .eq("route_path", normalizedRoutePath)
        .limit(1),
      client
        .schema("app")
        .from("documents")
        .select("id")
        .eq("route_path", normalizedRoutePath)
        .limit(1),
    ]);

  if (folderError) {
    throw folderError;
  }

  if (documentError) {
    throw documentError;
  }

  if ((folderMatches?.length ?? 0) > 0 || (documentMatches?.length ?? 0) > 0) {
    throw new Error(`Route "${normalizedRoutePath}" already exists.`);
  }
}

function mapSiteSettings(row: SiteSettingsRow): SiteSettings {
  return {
    name: row.site_title,
    subtitle: row.site_subtitle,
    heroDescription: row.hero_description ?? defaultSiteSettings.heroDescription,
    contactLabel: row.contact_label,
    contactUrl: row.contact_url,
    seedMessage: row.seed_message ?? defaultSiteSettings.seedMessage,
  };
}

function mapFolderRow(
  row: FolderRow,
  childFolderCount: number,
  childDocumentCount: number,
  resolvedAccess: ResolvedAdminAccess,
): AdminFolderRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    routePath: row.route_path,
    description: row.description ?? "",
    heroNote: row.hero_note ?? "",
    accessMode: row.access_mode,
    effectiveAccessMode: resolvedAccess.effectiveAccessMode,
    isAccessInherited: resolvedAccess.isAccessInherited,
    accessSourceLabel: resolvedAccess.accessSourceLabel,
    accessSourceType: resolvedAccess.accessSourceType,
    accessSourceId: resolvedAccess.accessSourceId,
    order: row.order_index,
    accent: row.accent,
    childFolderCount,
    childDocumentCount,
  };
}

function mapDocumentRow(
  row: DocumentRow,
  tags: string[],
  outline: OutlineItem[],
  resolvedAccess: ResolvedAdminAccess,
  options: {
    includeBodyHtml?: boolean;
    includeOutline?: boolean;
  } = {},
): AdminDocumentRecord {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    slug: row.slug,
    routePath: row.route_path,
    summary: row.summary ?? "",
    tags,
    accessMode: row.access_mode,
    effectiveAccessMode: resolvedAccess.effectiveAccessMode,
    isAccessInherited: resolvedAccess.isAccessInherited,
    accessSourceLabel: resolvedAccess.accessSourceLabel,
    accessSourceType: resolvedAccess.accessSourceType,
    accessSourceId: resolvedAccess.accessSourceId,
    order: row.order_index,
    authorName: row.author_name ?? "Wenlan Editor",
    updatedAt: row.updated_at.slice(0, 10),
    readingTime: row.reading_time ?? "5 min",
    featured: row.is_featured,
    renderMode: normalizeDocumentRenderMode(row.render_mode),
    bodyHtml: options.includeBodyHtml === false ? "" : row.body_html,
    renderedBodyHtml: options.includeBodyHtml === false ? "" : row.rendered_body_html ?? row.body_html,
    outline: options.includeOutline === false ? [] : outline,
  };
}

function normalizeDocumentRenderMode(
  value: string | null | undefined,
): Database["app"]["Tables"]["documents"]["Row"]["render_mode"] {
  return "site";
}

function mapProfileRow(row: ProfileRow): AdminProfileRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? row.email ?? "Unnamed member",
    siteRole: row.site_role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInviteRow(
  row: Pick<
    InviteRow,
    | "id"
    | "email"
    | "invite_token"
    | "site_role"
    | "expires_at"
    | "used_at"
    | "max_uses"
    | "use_count"
    | "created_at"
  >,
): AdminInviteRecord {
  const maxUses = Math.max(1, row.max_uses ?? 1);
  const useCount = Math.min(maxUses, Math.max(0, row.use_count ?? (row.used_at ? 1 : 0)));

  return {
    id: row.id,
    email: row.email,
    siteRole: row.site_role,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    inviteToken: row.invite_token,
    maxUses,
    useCount,
    createdAt: row.created_at,
  };
}

function mapGroupRow(
  row: Pick<GroupRow, "id" | "name" | "slug" | "description" | "created_at">,
  memberIds: string[],
): AdminGroupRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    memberIds,
    memberCount: memberIds.length,
    createdAt: row.created_at,
  };
}

function mapAccessGrantRow(row: AccessGrantRow): AdminAccessGrantRecord {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    subjectType: row.subject_type as "user" | "group",
    subjectId: row.subject_id,
    accessLevel: row.access_level,
    createdAt: row.created_at,
  };
}

function compareProfilesByRole(left: ProfileRow, right: ProfileRow) {
  const order = new Map<ProfileRow["site_role"], number>([
    ["owner", 0],
    ["admin", 1],
    ["editor", 2],
    ["publisher", 3],
    ["viewer", 4],
  ]);

  return (
    (order.get(left.site_role) ?? 99) - (order.get(right.site_role) ?? 99) ||
    left.created_at.localeCompare(right.created_at)
  );
}

function resolveFolderAccess(
  row: FolderRow,
  folderRowMap: Map<string, FolderRow>,
  cache: Map<string, ResolvedAdminAccess>,
): ResolvedAdminAccess {
  const cached = cache.get(row.id);

  if (cached) {
    return cached;
  }

  if (row.access_mode !== "inherit") {
    const resolved: ResolvedAdminAccess = {
      effectiveAccessMode: row.access_mode,
      isAccessInherited: false,
      accessSourceLabel: row.name,
      accessSourceType: "folder",
      accessSourceId: row.id,
    };
    cache.set(row.id, resolved);
    return resolved;
  }

  if (row.parent_id) {
    const parent = folderRowMap.get(row.parent_id);

    if (parent) {
      const parentResolved = resolveFolderAccess(parent, folderRowMap, cache);
      const resolved: ResolvedAdminAccess = {
        ...parentResolved,
        isAccessInherited: true,
      };
      cache.set(row.id, resolved);
      return resolved;
    }
  }

  const fallback: ResolvedAdminAccess = {
    effectiveAccessMode: "private",
    isAccessInherited: false,
    accessSourceLabel: row.name,
    accessSourceType: "folder",
    accessSourceId: row.id,
  };
  cache.set(row.id, fallback);
  return fallback;
}

function resolveDocumentAccess(
  row: DocumentRow,
  folderRowMap: Map<string, FolderRow>,
  folderCache: Map<string, ResolvedAdminAccess>,
  documentCache: Map<string, ResolvedAdminAccess>,
): ResolvedAdminAccess {
  const cached = documentCache.get(row.id);

  if (cached) {
    return cached;
  }

  if (row.access_mode !== "inherit") {
    const resolved: ResolvedAdminAccess = {
      effectiveAccessMode: row.access_mode,
      isAccessInherited: false,
      accessSourceLabel: row.title,
      accessSourceType: "document",
      accessSourceId: row.id,
    };
    documentCache.set(row.id, resolved);
    return resolved;
  }

  const folder = row.folder_id ? folderRowMap.get(row.folder_id) : null;

  if (folder) {
    const folderResolved = resolveFolderAccess(folder, folderRowMap, folderCache);
    const resolved: ResolvedAdminAccess = {
      ...folderResolved,
      isAccessInherited: true,
    };
    documentCache.set(row.id, resolved);
    return resolved;
  }

  const fallback: ResolvedAdminAccess = {
    effectiveAccessMode: "private",
    isAccessInherited: false,
    accessSourceLabel: row.title,
    accessSourceType: "document",
    accessSourceId: row.id,
  };
  documentCache.set(row.id, fallback);
  return fallback;
}

function sanitizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stripImportedDocumentExtension(fileName: string) {
  return fileName.replace(/\.(html?|md|markdown)$/i, "");
}

function assertImportDocumentFileAllowed(file: File) {
  const maxSizeBytes = 4 * 1024 * 1024;
  const lowerName = file.name.toLowerCase();

  if (
    !lowerName.endsWith(".html") &&
    !lowerName.endsWith(".htm") &&
    !lowerName.endsWith(".md") &&
    !lowerName.endsWith(".markdown")
  ) {
    throw new Error("请上传 .html、.htm、.md 或 .markdown 文件。");
  }

  if (file.size > maxSizeBytes) {
    throw new Error("导入文件过大，请控制在 4MB 以内。");
  }
}

function isMarkdownImportFile(fileName: string) {
  return /\.(md|markdown)$/i.test(fileName);
}

function getImportedDocumentMimeType(file: File) {
  return isMarkdownImportFile(file.name) ? "text/markdown" : "text/html";
}

function getImportedDocumentUploadContentType(file: File) {
  if (isMarkdownImportFile(file.name)) {
    return "text/html";
  }

  return normalizeUploadContentType(file.type, "text/html");
}

function renderMarkdownDocument(markdownText: string) {
  const renderedHtml = markdown.render(markdownText.trim());

  return [
    "<article class=\"markdown-import-body\">",
    renderedHtml || "<p></p>",
    "</article>",
  ].join("");
}

function assertAssetFilesAllowed(
  assetFiles: Array<{
    file: File;
    relativePath: string;
  }>,
) {
  const allowedExtensions = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".pdf",
  ]);

  for (const asset of assetFiles) {
    const normalizedPath = normalizeAssetRelativePath(asset.relativePath);
    const extension = normalizedPath.slice(normalizedPath.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      throw new Error(`Unsupported asset type: ${asset.relativePath}`);
    }

    if (asset.file.size > 10 * 1024 * 1024) {
      throw new Error(`Asset is too large: ${asset.relativePath}`);
    }
  }
}

function normalizeAssetRelativePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");

  if (!normalized || normalized.includes("..")) {
    throw new Error(`Invalid asset path: ${relativePath}`);
  }

  return normalized;
}

function rewriteSourceHtmlAssetUrls(
  html: string,
  assets: Array<{ relativePath: string; publicUrl: string }>,
) {
  if (assets.length === 0) {
    return html;
  }

  const assetMap = new Map(
    assets.map((asset) => [normalizeAssetRelativePath(asset.relativePath), asset.publicUrl] as const),
  );

  return html
    .replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi, (match, attr: string, quote: string, value: string) => {
      const rewrittenUrl = resolveImportedSourceAssetUrl(value, assetMap);
      return rewrittenUrl ? `${attr}=${quote}${escapeHtmlAttribute(rewrittenUrl)}${quote}` : match;
    })
    .replace(/\bsrcset\s*=\s*(["'])([^"']+)\1/gi, (match, quote: string, value: string) => {
      const rewrittenSrcSet = rewriteSourceSrcSet(value, assetMap);
      return rewrittenSrcSet ? `srcset=${quote}${escapeHtmlAttribute(rewrittenSrcSet)}${quote}` : match;
    })
    .replace(/url\(\s*(["']?)([^'")]+)\1\s*\)/gi, (match, quote: string, value: string) => {
      const rewrittenUrl = resolveImportedSourceAssetUrl(value, assetMap);
      return rewrittenUrl ? `url(${quote}${rewrittenUrl}${quote})` : match;
    });
}

function rewriteSourceSrcSet(value: string, assetMap: Map<string, string>) {
  let changed = false;
  const rewritten = value
    .split(",")
    .map((part) => {
      const trimmedPart = part.trim();
      const [url, descriptor] = trimmedPart.split(/\s+/, 2);
      const rewrittenUrl = resolveImportedSourceAssetUrl(url, assetMap);

      if (!rewrittenUrl) {
        return trimmedPart;
      }

      changed = true;
      return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl;
    })
    .join(", ");

  return changed ? rewritten : null;
}

function resolveImportedSourceAssetUrl(value: string, assetMap: Map<string, string>) {
  const trimmed = value.trim();

  if (!trimmed || trimmed.startsWith("#") || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) {
    return null;
  }

  const match = trimmed.match(/^([^?#]+)([?#].*)?$/);
  const pathPart = match?.[1];
  const suffix = match?.[2] ?? "";

  if (!pathPart) {
    return null;
  }

  try {
    const rewrittenUrl = assetMap.get(normalizeAssetRelativePath(pathPart));
    return rewrittenUrl ? `${rewrittenUrl}${suffix}` : null;
  } catch {
    return null;
  }
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildImportedAssetPath(documentId: string, relativePath: string) {
  return `documents/${documentId}/${buildSafeStorageRelativePath(relativePath)}`;
}

function buildSafeStorageRelativePath(relativePath: string) {
  return normalizeAssetRelativePath(relativePath).split("/").map(sanitizeStorageSegment).join("/");
}

function sanitizeStorageSegment(segment: string) {
  const extensionMatch = segment.match(/(\.[a-z0-9]{1,12})$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? "";
  const baseName = extension ? segment.slice(0, -extension.length) : segment;
  const safeBase = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const shortHash = createHash("sha1").update(segment).digest("hex").slice(0, 8);

  return `${safeBase || "file"}-${shortHash}${extension}`;
}

async function uploadAssetFiles(
  client: AppClient,
  assetFiles: Array<{
    file: File;
    relativePath: string;
  }>,
) {
  const uploads: Array<{
    relativePath: string;
    fileName: string;
    mimeType: string;
    publicUrl: string;
    storagePath: string;
    checksum: string;
    sizeBytes: number;
  }> = [];
  const importPrefix = `imports/${randomUUID()}`;

  try {
    for (const asset of assetFiles) {
      const relativePath = normalizeAssetRelativePath(asset.relativePath);
      const storagePath = `${importPrefix}/${buildSafeStorageRelativePath(relativePath)}`;
      const buffer = Buffer.from(await asset.file.arrayBuffer());
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const mimeType = normalizeUploadContentType(asset.file.type, "application/octet-stream");
      const uploadedAsset = await uploadDocumentObject(client, {
        key: storagePath,
        body: buffer,
        contentType: mimeType,
      });
      uploads.push({
        relativePath,
        fileName: asset.file.name,
        mimeType,
        publicUrl: uploadedAsset.publicUrl,
        storagePath: uploadedAsset.key,
        checksum,
        sizeBytes: asset.file.size,
      });
    }
  } catch (error) {
    if (uploads.length > 0) {
      await removeDocumentObjects(client, uploads.map((asset) => asset.storagePath));
    }

    throw error;
  }

  return uploads;
}

async function cleanupImportedArtifacts(
  client: AppClient,
  storagePaths: string[],
  documentId: string | null,
) {
  if (storagePaths.length > 0) {
    await removeDocumentObjects(client, storagePaths);
  }

  if (!documentId) {
    return;
  }

  await client.schema("app").from("document_assets").delete().eq("document_id", documentId);
  await client.schema("app").from("document_outlines").delete().eq("document_id", documentId);
  await client.schema("app").from("document_tags").delete().eq("document_id", documentId);
  await clearAccessGrants(client, "document", documentId);
  await client.schema("app").from("documents").delete().eq("id", documentId);
}

function normalizeUploadContentType(value: string | null | undefined, fallback: string) {
  const normalized = value?.split(";", 2)[0]?.trim().toLowerCase();
  return normalized || fallback;
}

function sanitizeEmail(value: string) {
  const email = value.trim().toLowerCase();

  if (!email) {
    throw new Error("请输入邮箱地址。");
  }

  return email;
}

function sanitizeOptionalEmail(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  return sanitizeEmail(value);
}

function sanitizeProfileStatus(value: string) {
  if (value === "active" || value === "disabled" || value === "removed") {
    return value;
  }

  throw new Error("不支持的成员状态。");
}

function sanitizeSlug(value: string) {
  const normalized = normalizeRoutePath(
    value
      .trim()
      .toLowerCase()
      .replace(/\.html?$/g, "")
      .replace(/[^a-z0-9\-_\u4e00-\u9fa5]+/g, "-")
      .replace(/-+/g, "-"),
  );

  if (!normalized) {
    throw new Error("请提供有效的路由标识或标题。");
  }

  return normalized;
}

function clampInviteExpiry(expiresInDays: number) {
  if (!Number.isFinite(expiresInDays)) {
    return 7;
  }

  const rounded = Math.round(expiresInDays);

  if (rounded === 0) {
    return 0;
  }

  return Math.max(rounded, 1);
}

function isPermanentInviteExpiry(expiresAt: string) {
  const expiresAtMs = Date.parse(expiresAt);

  return Number.isFinite(expiresAtMs) && expiresAtMs >= PERMANENT_INVITE_EXPIRES_AT_MS;
}

function clampInviteMaxUses(maxUses: number) {
  if (!Number.isFinite(maxUses)) {
    return 1;
  }

  return Math.min(Math.max(Math.round(maxUses), 1), 999);
}

function assertAssignableInviteRole(actorRole: AuthViewer["siteRole"]) {
  if (actorRole === "owner" || actorRole === "admin") {
    return;
  }

  throw new Error("你的角色不能为该权限级别发起邀请。");
}

function assertAssignableProfileRole(
  actorRole: AuthViewer["siteRole"],
  currentTargetRole: ProfileRow["site_role"],
) {
  if (actorRole === "owner") {
    return;
  }

  if (actorRole === "admin" && !isAdminSiteRole(currentTargetRole)) {
    return;
  }

  throw new Error("你的角色不能修改该成员的权限。");
}
