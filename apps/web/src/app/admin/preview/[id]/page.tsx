import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentPageView } from "@/components/public/document-page-view";
import { requireAdminPage } from "@/lib/auth/server";
import { getAdminDocumentDetail, getAdminWorkspaceData } from "@/lib/admin/repository";
import type { AdminAccessMode, AdminDocumentRecord, AdminFolderRecord } from "@/lib/admin/types";
import type { AccessMode, DocumentRecord, FolderRecord } from "@/lib/content/types";
import { toHref } from "@/lib/content/utils";

type AdminPreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata: Metadata = {
  title: "文档预览",
  robots: {
    index: false,
    follow: false,
  },
};

function toFolderAccessMode(mode: Exclude<AdminAccessMode, "inherit">): FolderRecord["accessMode"] {
  return mode === "draft" ? "private" : mode;
}

function toDocumentAccessMode(mode: Exclude<AdminAccessMode, "inherit">): AccessMode {
  return mode === "draft" ? "private" : mode;
}

function mapFolder(folder: AdminFolderRecord): FolderRecord {
  return {
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    slug: folder.slug,
    routePath: folder.routePath,
    description: folder.description,
    heroNote: folder.heroNote,
    accessMode: toFolderAccessMode(folder.effectiveAccessMode),
    order: folder.order,
    accent: folder.accent,
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

function mapDocument(document: AdminDocumentRecord): DocumentRecord {
  return {
    id: document.id,
    folderId: document.folderId,
    title: document.title,
    slug: document.slug,
    routePath: document.routePath,
    summary: document.summary,
    tags: document.tags,
    accessMode: toDocumentAccessMode(document.effectiveAccessMode),
    authorName: document.authorName,
    updatedAt: document.updatedAt,
    readingTime: document.readingTime,
    featured: document.featured,
    renderMode: document.renderMode,
    bodyHtml: document.renderMode === "source" ? document.bodyHtml : document.renderedBodyHtml,
    outline: document.outline,
    relatedIds: [],
  };
}

function buildFolderTrail(folder: AdminFolderRecord, folders: AdminFolderRecord[]) {
  const folderMap = new Map(folders.map((item) => [item.id, item]));
  const trail: AdminFolderRecord[] = [];
  let cursor: AdminFolderRecord | null = folder;

  while (cursor) {
    trail.unshift(cursor);
    cursor = cursor.parentId ? folderMap.get(cursor.parentId) ?? null : null;
  }

  return trail;
}

export default async function AdminPreviewPage({ params }: AdminPreviewPageProps) {
  const viewer = await requireAdminPage("/admin");

  const { id } = await params;
  let workspace;
  let document;

  try {
    [workspace, document] = await Promise.all([
      getAdminWorkspaceData("content"),
      getAdminDocumentDetail(id),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "Document not found.") {
      notFound();
    }

    throw error;
  }

  if (!document) {
    notFound();
  }

  const folder = document.folderId
    ? workspace.folders.find((item) => item.id === document.folderId)
    : null;

  if (document.folderId && !folder) {
    notFound();
  }

  const folderTrail = folder ? buildFolderTrail(folder, workspace.folders) : [];
  const previewFolder = folder ? mapFolder(folder) : buildRootFolderRecord();
  const navigationFolders = workspace.folders
    .filter((item) => item.parentId === null)
    .sort((left, right) => left.order - right.order)
    .map(mapFolder);

  return (
    <DocumentPageView
      viewer={viewer}
      data={{
        siteSettings: workspace.siteSettings,
        navigationFolders,
        folder: previewFolder,
        document: mapDocument(document),
        breadcrumbs: [
          { label: "首页", href: "/" },
          ...folderTrail.map((item) => ({
            label: item.name,
            href: toHref(item.routePath),
          })),
          { label: document.title },
        ],
        relatedDocuments: [],
      }}
    />
  );
}
