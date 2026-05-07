"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type {
  AdminAccessMode,
  AdminDocumentRecord,
  AdminFolderRecord,
  AdminGroupRecord,
  AdminInviteRecord,
  AdminProfileRecord,
  AdminWorkspaceData,
} from "@/lib/admin/types";
import {
  editableSiteRoleOptions,
  getSiteRoleLabel,
  normalizeEditableSiteRole,
  type EditableSiteRole,
} from "@/lib/auth/roles";
import { formatDate } from "@/lib/content/utils";

const accessLabelMap: Record<AdminAccessMode, string> = {
  inherit: "继承",
  draft: "私密",
  public: "公开",
  share: "分享可见",
  login: "登录可见",
  private: "私密",
  specific_users: "指定用户",
  group: "用户组",
};

const editableAccessOptions = (Object.entries(accessLabelMap) as Array<[AdminAccessMode, string]>)
  .filter(([value]) => value !== "draft");

const allSiteRoles: EditableSiteRole[] = editableSiteRoleOptions.map((option) => option.value);
const MIN_TREE_PANE_WIDTH = 180;
const MAX_TREE_PANE_WIDTH = 460;
const RESOURCE_DRAG_MIME = "application/x-wenlan-resource";
type CreatePanel = "folder" | "import";
type DragResource =
  | { type: "folder"; id: string }
  | { type: "document"; id: string };
type SortDropTarget = {
  id: string;
  position: "before" | "after";
};

type FolderDraft = {
  name: string;
  description: string;
  heroNote: string;
  accessMode: AdminAccessMode;
  accent: AdminFolderRecord["accent"];
};

type DocumentDraft = {
  title: string;
  bodyHtml: string;
  accessMode: AdminAccessMode;
  renderMode: AdminDocumentRecord["renderMode"];
  featured: boolean;
};

const emptyFolderDraft: FolderDraft = {
  name: "",
  description: "",
  heroNote: "",
  accessMode: "private",
  accent: "clay",
};

const emptyDocumentDraft: DocumentDraft = {
  title: "",
  bodyHtml: "",
  accessMode: "private",
  renderMode: "site",
  featured: false,
};

type AdminWorkspaceMode = "content" | "members";
type MembersView = "members" | "invites" | "groups";
type EditTarget = "folder" | "document";
type CreatedInviteRecord = AdminInviteRecord & {
  invitePath: string;
  inviteToken: string;
};
type VisibleInviteSecret = {
  inviteId: string;
  inviteToken: string;
  inviteLink: string;
  createdAt: string;
  maxUses: number;
  useCount: number;
};

export function AdminWorkspace({
  mode = "content",
  initialWorkspace = null,
}: Readonly<{
  mode?: AdminWorkspaceMode;
  initialWorkspace?: AdminWorkspaceData | null;
}> = {}) {
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const documentDetailCacheRef = useRef(new Map<string, AdminDocumentRecord>());
  const [workspace, setWorkspace] = useState<AdminWorkspaceData | null>(initialWorkspace);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [openCreatePanel, setOpenCreatePanel] = useState<CreatePanel | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingFolderId, setEditingFolderId] = useState("");
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [treePaneWidth, setTreePaneWidth] = useState(260);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(!initialWorkspace);
  const [folderDraft, setFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(emptyDocumentDraft);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderSlug, setNewFolderSlug] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [importHtmlFile, setImportHtmlFile] = useState<File | null>(null);
  const [importAccessMode, setImportAccessMode] = useState<AdminAccessMode>("inherit");
  const [importRenderMode, setImportRenderMode] =
    useState<AdminDocumentRecord["renderMode"]>("site");
  const [isImporting, setIsImporting] = useState(false);
  const [inviteRole, setInviteRole] = useState<EditableSiteRole>("viewer");
  const [inviteExpiryDays, setInviteExpiryDays] = useState("7");
  const [inviteMaxUses, setInviteMaxUses] = useState("1");
  const [visibleInviteSecrets, setVisibleInviteSecrets] = useState<
    Record<string, VisibleInviteSecret>
  >({});
  const [latestInviteId, setLatestInviteId] = useState("");
  const [profileRoleDrafts, setProfileRoleDrafts] = useState<Record<string, EditableSiteRole>>({});
  const [membersView, setMembersView] = useState<MembersView>("members");
  const [memberDetailTarget, setMemberDetailTarget] = useState<AdminProfileRecord | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [editingGroup, setEditingGroup] = useState<AdminGroupRecord | null>(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditDescription, setGroupEditDescription] = useState("");
  const [isGroupMemberEditorOpen, setIsGroupMemberEditorOpen] = useState(false);
  const [groupMemberDraftIds, setGroupMemberDraftIds] = useState<string[]>([]);
  const [folderParentDraftId, setFolderParentDraftId] = useState("__root__");
  const [documentFolderDraftId, setDocumentFolderDraftId] = useState("");
  const [dragResource, setDragResource] = useState<DragResource | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState("");
  const [folderDropTarget, setFolderDropTarget] = useState<SortDropTarget | null>(null);
  const [documentDropTarget, setDocumentDropTarget] = useState<SortDropTarget | null>(null);

  const folders = useMemo(() => workspace?.folders ?? [], [workspace]);
  const documents = useMemo(() => workspace?.documents ?? [], [workspace]);
  const members = useMemo(() => workspace?.profiles ?? [], [workspace]);
  const invites = useMemo(() => workspace?.invites ?? [], [workspace]);
  const groups = useMemo(() => workspace?.groups ?? [], [workspace]);
  const canManageMembers = workspace?.viewer.canManageMembers ?? false;
  const availableInviteRoles = useMemo(() => allSiteRoles, []);
  const latestInviteSecret = latestInviteId ? visibleInviteSecrets[latestInviteId] ?? null : null;

  const folderMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );

  const currentFolder = selectedFolderId ? folderMap.get(selectedFolderId) ?? null : null;
  const parentFolder = currentFolder?.parentId ? folderMap.get(currentFolder.parentId) ?? null : null;
  const currentFolderScopeId = currentFolder?.id ?? null;

  const childFolders = folders
    .filter((folder) => folder.parentId === currentFolderScopeId)
    .sort((left, right) => left.order - right.order);

  const childDocuments = documents
    .filter((document) => document.folderId === currentFolderScopeId)
    .sort((left, right) => left.order - right.order || right.updatedAt.localeCompare(left.updatedAt));

  const previewDocument =
    documents.find((document) => document.id === selectedDocumentId) ??
    childDocuments[0] ??
    null;
  const editingFolder =
    editTarget === "folder" && editingFolderId ? folderMap.get(editingFolderId) ?? null : null;
  const editingDocument =
    editTarget === "document" && editingDocumentId
      ? documents.find((document) => document.id === editingDocumentId) ?? null
      : null;
  const folderEditorRecord = editTarget === "folder" ? editingFolder : currentFolder;
  const documentEditorRecord = editTarget === "document" ? editingDocument : previewDocument;
  const availableParentFolders = folderEditorRecord
    ? folders.filter(
        (folder) =>
          folder.id !== folderEditorRecord.id &&
          !folder.routePath.startsWith(`${folderEditorRecord.routePath}/`),
      )
    : folders;
  const isEditorOpen =
    (editTarget === "folder" && Boolean(folderEditorRecord)) ||
    (editTarget === "document" && Boolean(documentEditorRecord));
  const explorerStyle = {
    "--tree-pane-width": `${treePaneWidth}px`,
  } as CSSProperties;
  const currentGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const memberDetailGroups = useMemo(
    () =>
      memberDetailTarget
        ? groups.filter((group) => group.memberIds.includes(memberDetailTarget.id))
        : [],
    [groups, memberDetailTarget],
  );
  const memberDetailRole = memberDetailTarget
    ? normalizeEditableSiteRole(memberDetailTarget.siteRole)
    : null;
  const memberDetailAccessText =
    memberDetailRole === "admin"
      ? "可进入后台，管理内容、成员和邀请。"
      : "可按文档权限访问公开、登录可见或被授权内容。";

  useEffect(() => {
    if (!currentFolder) {
      setFolderDraft(emptyFolderDraft);
      setFolderParentDraftId("__root__");
      return;
    }

    syncFolderDraft(currentFolder);
  }, [currentFolder]);

  useEffect(() => {
    if (!previewDocument) {
      setDocumentDraft(emptyDocumentDraft);
      setDocumentFolderDraftId("");
      return;
    }

    syncDocumentDraft(previewDocument);
  }, [previewDocument]);

  useEffect(() => {
    setProfileRoleDrafts(
      Object.fromEntries(
        members.map((member) => [member.id, normalizeEditableSiteRole(member.siteRole)]),
      ),
    );
  }, [members]);

  useEffect(() => {
    if (!availableInviteRoles.includes(inviteRole)) {
      setInviteRole(availableInviteRoles[availableInviteRoles.length - 1] ?? "viewer");
    }
  }, [availableInviteRoles, inviteRole]);

  useEffect(() => {
    if (!currentGroup) {
      setSelectedGroupId("");
      setGroupMemberDraftIds([]);
      return;
    }

    setSelectedGroupId((current) => current || currentGroup.id);
    setGroupMemberDraftIds(currentGroup.memberIds);
  }, [currentGroup]);


  const folderTrail = useMemo(() => {
    if (!currentFolder) {
      return [];
    }

    const trail: AdminFolderRecord[] = [];
    let cursor: AdminFolderRecord | null = currentFolder;

    while (cursor) {
      trail.unshift(cursor);
      cursor = cursor.parentId ? folderMap.get(cursor.parentId) ?? null : null;
    }

    return trail;
  }, [currentFolder, folderMap]);

  const loadWorkspace = useCallback(
    async (preferred?: { folderId?: string; documentId?: string; statusMessage?: string }) => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/admin/workspace?mode=${mode}`, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "加载工作区失败，请刷新重试。");
        }

        const nextWorkspace = payload as AdminWorkspaceData;
        const nextFolderId = preferred?.folderId ?? "";
        const nextFolderScopeId = nextFolderId || null;

        const nextDocumentId =
          preferred?.documentId ??
          nextWorkspace.documents.find((document) => document.folderId === nextFolderScopeId)?.id ??
          "";

        setWorkspace(nextWorkspace);
        setSelectedFolderId(nextFolderId);
        setSelectedDocumentId(nextDocumentId);
        setStatusMessage(preferred?.statusMessage ?? "");
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "加载工作区失败，请刷新重试。",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [mode],
  );

  useEffect(() => {
    if (!initialWorkspace) {
      void loadWorkspace();
      return;
    }

    setWorkspace(initialWorkspace);
    setIsLoading(false);
  }, [initialWorkspace, loadWorkspace]);

  useEffect(() => {
    setOpenCreatePanel(null);
    setStatusMessage("");
    clearImportSelection();
  }, [mode]);

  function handleSelectFolder(folderId: string) {
    setEditTarget(null);
    setSelectedFolderId(folderId);
    const nextFolderScopeId = folderId || null;
    const nextDocument = documents.find((document) => document.folderId === nextFolderScopeId);
    setSelectedDocumentId(nextDocument?.id ?? "");
  }

  function syncFolderDraft(folder: AdminFolderRecord) {
    setFolderDraft({
      name: folder.name,
      description: folder.description,
      heroNote: folder.heroNote,
      accessMode: folder.accessMode,
      accent: folder.accent,
    });
    setFolderParentDraftId(folder.parentId ?? "__root__");
  }

  function syncDocumentDraft(document: AdminDocumentRecord) {
    documentDetailCacheRef.current.set(document.id, document);
    setDocumentDraft({
      title: document.title,
      bodyHtml: document.bodyHtml,
      accessMode: document.accessMode,
      renderMode: document.renderMode,
      featured: document.featured,
    });
    setDocumentFolderDraftId(document.folderId ?? "__root__");
  }

  function openFolderEditor(folder: AdminFolderRecord) {
    syncFolderDraft(folder);
    setEditingFolderId(folder.id);
    setEditingDocumentId("");
    setEditTarget("folder");
  }

  function openDocumentEditor(document: AdminDocumentRecord) {
    const cachedDetail = documentDetailCacheRef.current.get(document.id);

    if (cachedDetail) {
      syncDocumentDraft(cachedDetail);
      setEditingDocumentId(cachedDetail.id);
      setEditingFolderId("");
      setEditTarget("document");
      setStatusMessage("");
      return;
    }

    runMutation(async () => {
      setStatusMessage("正在载入文档内容...");
      const detail = await fetchJson<AdminDocumentRecord>(`/api/admin/documents?id=${document.id}`);
      syncDocumentDraft(detail);
      setEditingDocumentId(detail.id);
      setEditingFolderId("");
      setEditTarget("document");
      setStatusMessage("");
    });
  }

  function closeEditor() {
    setEditTarget(null);
    setEditingFolderId("");
    setEditingDocumentId("");
  }

  function clampTreePaneWidth(width: number) {
    return Math.min(MAX_TREE_PANE_WIDTH, Math.max(MIN_TREE_PANE_WIDTH, width));
  }

  function handleTreeResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = treePaneWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setTreePaneWidth(clampTreePaneWidth(startWidth + moveEvent.clientX - startX));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleTreeResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    setTreePaneWidth((current) => clampTreePaneWidth(current + direction * 16));
  }

  function readDragResource(event: React.DragEvent<HTMLElement>) {
    if (dragResource) {
      return dragResource;
    }

    const rawValue = event.dataTransfer.getData(RESOURCE_DRAG_MIME);

    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as DragResource;
      return parsed.type === "folder" || parsed.type === "document" ? parsed : null;
    } catch {
      return null;
    }
  }

  function canDropOnFolder(resource: DragResource | null, folderId: string) {
    if (!workspace?.canMutate || !resource) {
      return false;
    }

    if (resource.type === "document") {
      const document = documents.find((item) => item.id === resource.id);
      return Boolean(document && document.folderId !== folderId);
    }

    const sourceFolder = folderMap.get(resource.id);
    const targetFolder = folderMap.get(folderId);

    return Boolean(
      sourceFolder &&
        targetFolder &&
        sourceFolder.id !== targetFolder.id &&
        sourceFolder.parentId !== targetFolder.id &&
        !targetFolder.routePath.startsWith(`${sourceFolder.routePath}/`),
    );
  }

  function canDropOnRoot(resource: DragResource | null) {
    if (!workspace?.canMutate || !resource) {
      return false;
    }

    if (resource.type === "document") {
      const document = documents.find((item) => item.id === resource.id);
      return Boolean(document && document.folderId !== null);
    }

    const sourceFolder = folderMap.get(resource.id);
    return Boolean(sourceFolder && sourceFolder.parentId !== null);
  }

  function handleResourceDragStart(
    event: React.DragEvent<HTMLElement>,
    resource: DragResource,
  ) {
    if (!workspace?.canMutate) {
      event.preventDefault();
      return;
    }

    setDragResource(resource);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(RESOURCE_DRAG_MIME, JSON.stringify(resource));
    event.dataTransfer.setData("text/plain", resource.id);
  }

  function handleResourceDragEnd() {
    setDragResource(null);
    setDropTargetFolderId("");
    setFolderDropTarget(null);
    setDocumentDropTarget(null);
  }

  function getSortDropPosition(event: React.DragEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    return event.clientY - rect.top < rect.height / 2 ? "before" : "after";
  }

  function canReorderFolder(resource: DragResource | null, targetFolder: AdminFolderRecord) {
    if (!workspace?.canMutate || !resource || resource.type !== "folder") {
      return false;
    }

    const sourceFolder = folderMap.get(resource.id);

    return Boolean(
      sourceFolder &&
        sourceFolder.id !== targetFolder.id &&
        sourceFolder.parentId === targetFolder.parentId,
    );
  }

  function getDesiredSortMove(
    sourceId: string,
    targetId: string,
    dropPosition: SortDropTarget["position"],
    siblings: Array<{ id: string }>,
  ) {
    const sourceIndex = siblings.findIndex((item) => item.id === sourceId);
    const targetIndex = siblings.findIndex((item) => item.id === targetId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return null;
    }

    let desiredIndex = dropPosition === "before" ? targetIndex : targetIndex + 1;

    if (sourceIndex < desiredIndex) {
      desiredIndex -= 1;
    }

    if (desiredIndex === sourceIndex) {
      return null;
    }

    return {
      direction: desiredIndex < sourceIndex ? "up" as const : "down" as const,
      steps: Math.abs(desiredIndex - sourceIndex),
    };
  }

  function canReorderDocument(resource: DragResource | null, targetDocument: AdminDocumentRecord) {
    if (!workspace?.canMutate || !resource || resource.type !== "document") {
      return false;
    }

    const sourceDocument = documents.find((item) => item.id === resource.id);

    return Boolean(
      sourceDocument &&
        sourceDocument.id !== targetDocument.id &&
        sourceDocument.folderId === targetDocument.folderId,
    );
  }

  function handleDocumentDragOver(
    event: React.DragEvent<HTMLElement>,
    targetDocument: AdminDocumentRecord,
  ) {
    const resource = readDragResource(event);

    if (!canReorderDocument(resource, targetDocument)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDocumentDropTarget({
      id: targetDocument.id,
      position: getSortDropPosition(event),
    });
  }

  function handleDocumentDragLeave(
    event: React.DragEvent<HTMLElement>,
    targetDocument: AdminDocumentRecord,
  ) {
    const nextTarget = event.relatedTarget;

    if (
      documentDropTarget?.id === targetDocument.id &&
      (!nextTarget || !event.currentTarget.contains(nextTarget as Node))
    ) {
      setDocumentDropTarget(null);
    }
  }

  function handleDocumentDrop(
    event: React.DragEvent<HTMLElement>,
    targetDocument: AdminDocumentRecord,
  ) {
    const resource = readDragResource(event);

    if (!canReorderDocument(resource, targetDocument) || !resource) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const sourceDocument = documents.find((item) => item.id === resource.id);
    const siblings = documents
      .filter((document) => document.folderId === targetDocument.folderId)
      .sort((left, right) => left.order - right.order);
    const sourceIndex = siblings.findIndex((document) => document.id === resource.id);
    const targetIndex = siblings.findIndex((document) => document.id === targetDocument.id);
    const dropPosition = documentDropTarget?.id === targetDocument.id
      ? documentDropTarget.position
      : getSortDropPosition(event);

    setDragResource(null);
    setDocumentDropTarget(null);

    if (!sourceDocument || sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const sortMove = getDesiredSortMove(sourceDocument.id, targetDocument.id, dropPosition, siblings);

    if (!sortMove) {
      return;
    }

    runMutation(async () => {
      for (let index = 0; index < sortMove.steps; index += 1) {
        await submitJson("/api/admin/documents", "PATCH", {
          action: "reorder",
          id: sourceDocument.id,
          direction: sortMove.direction,
        });
      }

      setStatusMessage(`已调整文档“${sourceDocument.title}”的顺序。`);
      await loadWorkspace({
        folderId: targetDocument.folderId ?? "",
        documentId: sourceDocument.id,
      });
    });
  }

  function handleFolderDragOver(event: React.DragEvent<HTMLElement>, folderId: string) {
    const resource = readDragResource(event);
    const targetFolder = folderMap.get(folderId);

    if (targetFolder && canReorderFolder(resource, targetFolder)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setDropTargetFolderId("");
      setFolderDropTarget({
        id: targetFolder.id,
        position: getSortDropPosition(event),
      });
      return;
    }

    if (!canDropOnFolder(resource, folderId)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setFolderDropTarget(null);
    setDropTargetFolderId(folderId);
  }

  function handleFolderDragLeave(event: React.DragEvent<HTMLElement>, folderId: string) {
    const nextTarget = event.relatedTarget;

    if (
      dropTargetFolderId === folderId &&
      (!nextTarget || !event.currentTarget.contains(nextTarget as Node))
    ) {
      setDropTargetFolderId("");
    }

    if (
      folderDropTarget?.id === folderId &&
      (!nextTarget || !event.currentTarget.contains(nextTarget as Node))
    ) {
      setFolderDropTarget(null);
    }
  }

  function handleFolderDrop(event: React.DragEvent<HTMLElement>, folderId: string) {
    const resource = readDragResource(event);
    const targetFolder = folderMap.get(folderId);

    if (targetFolder && canReorderFolder(resource, targetFolder) && resource) {
      event.preventDefault();
      event.stopPropagation();

      const sourceFolder = folderMap.get(resource.id);
      const siblings = folders
        .filter((folder) => folder.parentId === targetFolder.parentId)
        .sort((left, right) => left.order - right.order);
      const dropPosition = folderDropTarget?.id === targetFolder.id
        ? folderDropTarget.position
        : getSortDropPosition(event);

      setDragResource(null);
      setFolderDropTarget(null);

      if (!sourceFolder) {
        return;
      }

      const sortMove = getDesiredSortMove(sourceFolder.id, targetFolder.id, dropPosition, siblings);

      if (!sortMove) {
        return;
      }

      runMutation(async () => {
        for (let index = 0; index < sortMove.steps; index += 1) {
          await submitJson("/api/admin/folders", "PATCH", {
            action: "reorder",
            id: sourceFolder.id,
            direction: sortMove.direction,
          });
        }

        setStatusMessage(`已调整文件夹“${sourceFolder.name}”的顺序。`);
        await loadWorkspace({
          folderId: currentFolder?.id ?? sourceFolder.parentId ?? "",
          documentId: selectedDocumentId,
        });
      });
      return;
    }

    if (!canDropOnFolder(resource, folderId) || !resource) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragResource(null);
    setDropTargetFolderId("");
    setFolderDropTarget(null);

    runMutation(async () => {
      const targetFolderName = folderMap.get(folderId)?.name ?? "目标文件夹";

      if (resource.type === "document") {
        const sourceName = documents.find((item) => item.id === resource.id)?.title ?? "文档";
        await submitJson("/api/admin/documents", "PATCH", {
          action: "move",
          id: resource.id,
          folderId,
        });
        await loadWorkspace({
          folderId,
          documentId: resource.id,
          statusMessage: `已移动文档“${sourceName}”到“${targetFolderName}”。`,
        });
        return;
      }

      const sourceName = folderMap.get(resource.id)?.name ?? "文件夹";
      await submitJson("/api/admin/folders", "PATCH", {
        action: "move",
        id: resource.id,
        parentId: folderId,
      });
      await loadWorkspace({
        folderId,
        documentId: selectedDocumentId,
        statusMessage: `已移动文件夹“${sourceName}”到“${targetFolderName}”。`,
      });
    });
  }

  function handleToggleCreatePanel(panel: CreatePanel) {
    const isClosing = openCreatePanel === panel;
    if (openCreatePanel === "import" && panel !== "import") {
      clearImportSelection();
    }

    setOpenCreatePanel(isClosing ? null : panel);

    if (isClosing && panel === "import") {
      clearImportSelection();
      setStatusMessage("");
      return;
    }

    if (!isClosing && panel === "import") {
      setStatusMessage("");
    }
  }

  function handleImportToolbarClick() {
    if (!workspace?.canMutate) {
      setStatusMessage("当前账号没有导入权限。");
      return;
    }

    setOpenCreatePanel("import");
    setStatusMessage("");
    importFileInputRef.current?.click();
  }

  function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setImportHtmlFile(file);

    if (file) {
      setOpenCreatePanel("import");
      setStatusMessage("");
    }
  }

  function clearImportSelection() {
    setImportHtmlFile(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  }

  async function submitJson(url: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "操作失败，请稍后再试。");
    }

    return payload;
  }

  async function fetchJson<T>(url: string) {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "加载失败，请稍后再试。");
    }

    return payload as T;
  }

  function runMutation(task: () => Promise<void>) {
    startTransition(() => {
      void task().catch((error) => {
        setStatusMessage(formatAdminError(error));
      });
    });
  }

  function formatAdminError(error: unknown, fallback = "操作失败，请稍后再试。") {
    const message = error instanceof Error ? error.message : fallback;

    if (message === "Authentication required.") {
      return "登录已失效，请重新登录后再操作。";
    }

    if (message === "Admin role required.") {
      return "当前账号没有后台权限。";
    }

    if (/mime type\s+text\/markdown\s+is not supported/i.test(message)) {
      return "当前存储服务不接受 Markdown 的原始 MIME 类型，已改为兼容上传方式，请重新导入一次。";
    }

    return message || fallback;
  }

  function buildInviteLink(invitePath: string) {
    if (typeof window === "undefined") {
      return invitePath;
    }

    return new URL(invitePath, window.location.origin).toString();
  }

  function rememberInviteSecret(payload: CreatedInviteRecord, replacedInviteId?: string) {
    const secret: VisibleInviteSecret = {
      inviteId: payload.id,
      inviteToken: payload.inviteToken,
      inviteLink: buildInviteLink(payload.invitePath),
      createdAt: new Date().toISOString(),
      maxUses: payload.maxUses,
      useCount: payload.useCount,
    };

    setVisibleInviteSecrets((current) => {
      const next = { ...current };

      if (replacedInviteId) {
        delete next[replacedInviteId];
      }

      next[secret.inviteId] = secret;
      return next;
    });
    setLatestInviteId(secret.inviteId);

    return secret;
  }

  function getStoredInviteSecret(invite: AdminInviteRecord) {
    const cachedSecret = visibleInviteSecrets[invite.id] ?? null;

    if (cachedSecret) {
      return cachedSecret;
    }

    if (!invite.inviteToken) {
      return null;
    }

    return {
      inviteId: invite.id,
      inviteToken: invite.inviteToken,
      inviteLink: buildInviteLink(`/invite/${invite.inviteToken}`),
      createdAt: invite.createdAt,
      maxUses: invite.maxUses,
      useCount: invite.useCount,
    } satisfies VisibleInviteSecret;
  }

  async function copyTextToClipboard(value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  function handleCopyVisibleInvite(secret: VisibleInviteSecret, copyTarget: "token" | "link") {
    const label = copyTarget === "token" ? "邀请码" : "注册链接";
    const value = copyTarget === "token" ? secret.inviteToken : secret.inviteLink;

    runMutation(async () => {
      const copied = await copyTextToClipboard(value);
      setStatusMessage(copied ? `已复制${label}。` : `${label}：${value}`);
    });
  }

  function handleMissingInviteSecret() {
    setStatusMessage("旧邀请码没有保存明文，请重新生成后再复制。");
  }

  function getInviteTargetLabel(invite: AdminInviteRecord) {
    if (invite.email) {
      return invite.email;
    }

    return invite.useCount > 0 ? "开放邀请已使用" : "开放邀请";
  }

  function getInviteStatusLabel(invite: AdminInviteRecord) {
    if (invite.useCount >= invite.maxUses) {
      return "已用完";
    }

    if (invite.useCount > 0) {
      return "使用中";
    }

    return "待使用";
  }

  function handleInviteSecretView(invite: AdminInviteRecord) {
    const secret = getStoredInviteSecret(invite);

    if (!secret) {
      handleMissingInviteSecret();
      return;
    }

    setStatusMessage(`邀请码：${secret.inviteToken}，使用次数：${invite.useCount}/${invite.maxUses}`);
  }

  function canEditMemberRole() {
    return canManageMembers;
  }

  function toggleSelection(items: string[], item: string) {
    return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
  }

  function describeAccessState(record: {
    accessMode: AdminAccessMode;
    effectiveAccessMode: Exclude<AdminAccessMode, "inherit">;
    isAccessInherited: boolean;
    accessSourceLabel: string | null;
  }) {
    if (record.accessMode === "inherit") {
      return `继承自 ${record.accessSourceLabel ?? "上级"}，当前生效权限：${accessLabelMap[record.effectiveAccessMode]}。`;
    }

    return `已直接设置权限：${accessLabelMap[record.effectiveAccessMode]}。`;
  }

  function formatProfileStatus(status: string) {
    switch (status) {
      case "active":
        return "正常";
      case "invited":
        return "待加入";
      case "disabled":
        return "已禁用";
      default:
        return status;
    }
  }

  function handleCreateFolderSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspace?.canMutate) {
      return;
    }

    runMutation(async () => {
      const payload = await submitJson("/api/admin/folders", "POST", {
        parentId: currentFolder?.id ?? null,
        name: newFolderName,
        slug: newFolderSlug,
        description: newFolderDescription,
        accessMode: "inherit",
        accent: currentFolder?.accent ?? "clay",
      });

      setNewFolderName("");
      setNewFolderSlug("");
      setNewFolderDescription("");
      setOpenCreatePanel(null);
      setStatusMessage(`已创建文件夹“${payload.name}”。`);
      await loadWorkspace({ folderId: currentFolder?.id ?? "" });
    });
  }

  function handleRootDragOver(event: React.DragEvent<HTMLElement>) {
    const resource = readDragResource(event);

    if (!canDropOnRoot(resource)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setFolderDropTarget(null);
    setDropTargetFolderId("__root__");
  }

  function handleRootDragLeave(event: React.DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;

    if (
      dropTargetFolderId === "__root__" &&
      (!nextTarget || !event.currentTarget.contains(nextTarget as Node))
    ) {
      setDropTargetFolderId("");
    }
  }

  function handleRootDrop(event: React.DragEvent<HTMLElement>) {
    const resource = readDragResource(event);

    if (!canDropOnRoot(resource) || !resource) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragResource(null);
    setDropTargetFolderId("");
    setFolderDropTarget(null);

    runMutation(async () => {
      if (resource.type === "document") {
        const sourceName = documents.find((item) => item.id === resource.id)?.title ?? "文档";
        await submitJson("/api/admin/documents", "PATCH", {
          action: "move",
          id: resource.id,
          folderId: null,
        });
        await loadWorkspace({
          folderId: "",
          documentId: resource.id,
          statusMessage: `已移动文档“${sourceName}”到“全部内容”。`,
        });
        return;
      }

      const sourceName = folderMap.get(resource.id)?.name ?? "文件夹";
      await submitJson("/api/admin/folders", "PATCH", {
        action: "move",
        id: resource.id,
        parentId: null,
      });
      await loadWorkspace({
        folderId: "",
        documentId: selectedDocumentId,
        statusMessage: `已移动文件夹“${sourceName}”到“全部内容”。`,
      });
    });
  }

  async function getImportTargetFolderId() {
    return currentFolder?.id ?? null;
  }

  function handleFolderSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspace?.canMutate || !folderEditorRecord) {
      return;
    }

    runMutation(async () => {
      const nextParentId = folderParentDraftId === "__root__" ? null : folderParentDraftId;

      await submitJson("/api/admin/folders", "PATCH", {
        id: folderEditorRecord.id,
        ...folderDraft,
      });

      if (nextParentId !== folderEditorRecord.parentId) {
        await submitJson("/api/admin/folders", "PATCH", {
          action: "move",
          id: folderEditorRecord.id,
          parentId: nextParentId,
        });
      }

      await loadWorkspace({
        folderId: currentFolder?.id ?? folderEditorRecord.id,
        documentId: selectedDocumentId,
        statusMessage: `已保存文件夹“${folderDraft.name}”。`,
      });
      closeEditor();
    });
  }

  function handleDocumentSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspace?.canMutate || !documentEditorRecord) {
      return;
    }

    runMutation(async () => {
      const nextFolderId =
        documentFolderDraftId === "__root__"
          ? null
          : documentFolderDraftId || documentEditorRecord.folderId;
      const nextDocumentRecord: AdminDocumentRecord = {
        ...documentEditorRecord,
        title: documentDraft.title,
        bodyHtml: documentDraft.bodyHtml,
        renderedBodyHtml:
          documentDraft.renderMode === "source"
            ? documentDraft.bodyHtml
            : documentEditorRecord.renderedBodyHtml,
        accessMode: documentDraft.accessMode,
        renderMode: documentDraft.renderMode,
        featured: documentDraft.featured,
        folderId: nextFolderId,
      };

      await submitJson("/api/admin/documents", "PATCH", {
        id: documentEditorRecord.id,
        title: documentDraft.title,
        bodyHtml: documentDraft.bodyHtml,
        accessMode: documentDraft.accessMode,
        renderMode: documentDraft.renderMode,
        featured: documentDraft.featured,
      });

      if (nextFolderId !== documentEditorRecord.folderId) {
        await submitJson("/api/admin/documents", "PATCH", {
          action: "move",
          id: documentEditorRecord.id,
          folderId: nextFolderId,
        });
      }

      documentDetailCacheRef.current.set(documentEditorRecord.id, nextDocumentRecord);

      await loadWorkspace({
        folderId: nextFolderId ?? "",
        documentId: documentEditorRecord.id,
        statusMessage: `已保存文档“${documentDraft.title}”。`,
      });
      closeEditor();
    });
  }

  async function handleImportHtmlSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspace?.canMutate) {
      setStatusMessage("当前账号没有导入权限，请重新登录后再试。");
      return;
    }

    if (!importHtmlFile) {
      setStatusMessage("请选择 HTML 或 Markdown 文件。");
      importFileInputRef.current?.click();
      return;
    }

    setIsImporting(true);
    setStatusMessage("正在导入文档...");

    try {
      const targetFolderId = await getImportTargetFolderId();
      const formData = new FormData();
      formData.set("folderId", targetFolderId ?? "");
      formData.set("accessMode", importAccessMode);
      formData.set("renderMode", importRenderMode);
      formData.set("documentFile", importHtmlFile);

      const response = await fetch("/api/admin/import-html", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        id: string;
        title: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("登录已失效，请重新登录后再导入。");
        }

        if (response.status === 403) {
          throw new Error("当前账号没有导入权限。");
        }

        throw new Error(payload.error || "导入文档失败，请检查文件格式。");
      }

      clearImportSelection();
      setImportAccessMode("inherit");
      setImportRenderMode("site");
      setOpenCreatePanel(null);
      await loadWorkspace({ folderId: targetFolderId ?? "", documentId: payload.id });
      setStatusMessage(`已导入文档“${payload.title}”。`);
    } catch (error) {
      setStatusMessage(formatAdminError(error, "导入文档失败，请稍后再试。"));
    } finally {
      setIsImporting(false);
    }
  }

  function handleDeleteFolder(folder: AdminFolderRecord | null = folderEditorRecord) {
    if (!workspace?.canMutate || !folder || typeof window === "undefined") {
      return;
    }

    const confirmed = window.confirm(
      `确定删除文件夹“${folder.name}”吗？只有空文件夹可以删除。`,
    );

    if (!confirmed) {
      return;
    }

    runMutation(async () => {
      await submitJson("/api/admin/folders", "DELETE", {
        id: folder.id,
      });

      setStatusMessage(`已删除文件夹“${folder.name}”。`);
      await loadWorkspace({
        folderId:
          currentFolder?.id === folder.id
            ? folder.parentId ?? ""
            : currentFolder?.id ?? "",
      });
      if (editingFolderId === folder.id) {
        closeEditor();
      }
    });
  }

  function handleDeleteDocument(document: AdminDocumentRecord | null = documentEditorRecord) {
    if (!workspace?.canMutate || !document || typeof window === "undefined") {
      return;
    }

    const confirmed = window.confirm(`确定删除文档“${document.title}”吗？`);

    if (!confirmed) {
      return;
    }

    runMutation(async () => {
      await submitJson("/api/admin/documents", "DELETE", {
        id: document.id,
      });

      setStatusMessage(`已删除文档“${document.title}”。`);
      await loadWorkspace({
        folderId: currentFolder?.id ?? document.folderId ?? "",
        documentId: selectedDocumentId === document.id ? "" : selectedDocumentId,
      });
      if (editingDocumentId === document.id) {
        closeEditor();
      }
    });
  }

  function handleCreateInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageMembers) {
      return;
    }

    runMutation(async () => {
      const payload = (await submitJson("/api/admin/invites", "POST", {
        siteRole: inviteRole,
        expiresInDays: Number(inviteExpiryDays) || 7,
        maxUses: Number(inviteMaxUses) || 1,
      })) as CreatedInviteRecord;

      setInviteExpiryDays("7");
      setInviteMaxUses("1");
      const secret = rememberInviteSecret(payload);
      const copied = await copyTextToClipboard(secret.inviteLink);

      setStatusMessage(
        copied
          ? `邀请码 ${secret.inviteToken} 已生成，注册链接已复制到剪贴板。`
          : `邀请码 ${secret.inviteToken} 已生成，请在下方结果卡片复制。`,
      );
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleMemberSave(memberId: string) {
    if (!canManageMembers) {
      return;
    }

    const nextRole = profileRoleDrafts[memberId];

    if (!nextRole) {
      return;
    }

    const member = members.find((item) => item.id === memberId);

    runMutation(async () => {
      await submitJson("/api/admin/profiles", "PATCH", {
        id: memberId,
        siteRole: nextRole,
      });

      setStatusMessage(`已更新“${member?.displayName ?? member?.email ?? "成员"}”的角色。`);
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleMemberStatusToggle(memberId: string) {
    if (!canManageMembers) {
      return;
    }

    const member = members.find((item) => item.id === memberId);

    if (!member) {
      return;
    }

    const nextStatus = member.status === "disabled" ? "active" : "disabled";

    runMutation(async () => {
      await submitJson("/api/admin/profiles", "PATCH", {
        id: memberId,
        status: nextStatus,
      });

      setStatusMessage(
        nextStatus === "disabled"
          ? `已禁用“${member.displayName ?? member.email ?? "成员"}”。`
          : `已恢复“${member.displayName ?? member.email ?? "成员"}”。`,
      );
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleMemberRemove(memberId: string) {
    if (!canManageMembers) {
      return;
    }

    const member = members.find((item) => item.id === memberId);

    if (!member) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(`确认移出“${member.displayName ?? member.email ?? "该成员"}”？`)
    ) {
      return;
    }

    runMutation(async () => {
      await submitJson("/api/admin/profiles", "DELETE", { id: memberId });
      setStatusMessage(`已移出“${member.displayName ?? member.email ?? "成员"}”。`);
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleMemberView(memberId: string) {
    const member = members.find((item) => item.id === memberId);

    if (!member) {
      return;
    }

    setMemberDetailTarget(member);
  }

  function handleInviteReissue(inviteId: string) {
    if (!canManageMembers) {
      return;
    }

    const invite = invites.find((item) => item.id === inviteId);

    if (!invite) {
      return;
    }

    runMutation(async () => {
      const payload = (await submitJson("/api/admin/invites", "PATCH", {
        id: inviteId,
      })) as CreatedInviteRecord;
      const secret = rememberInviteSecret(payload, inviteId);
      const copied = await copyTextToClipboard(secret.inviteLink);

      setStatusMessage(
        copied
          ? `已重新生成邀请码 ${secret.inviteToken}，注册链接已复制到剪贴板。`
          : `已重新生成邀请码 ${secret.inviteToken}，请在下方结果卡片复制。`,
      );
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleInviteDelete(inviteId: string) {
    if (!canManageMembers) {
      return;
    }

    const invite = invites.find((item) => item.id === inviteId);

    if (!invite) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(`确认作废这条邀请${invite.email ? `（${invite.email}）` : ""}？`)
    ) {
      return;
    }

    runMutation(async () => {
      await submitJson("/api/admin/invites", "DELETE", { id: inviteId });
      setVisibleInviteSecrets((current) => {
        const next = { ...current };
        delete next[inviteId];
        return next;
      });
      setLatestInviteId((current) => (current === inviteId ? "" : current));
      setStatusMessage("已作废该邀请。");
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleCreateGroupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageMembers) {
      return;
    }

    runMutation(async () => {
      const payload = await submitJson("/api/admin/groups", "POST", {
        name: newGroupName,
        description: newGroupDescription,
      });

      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedGroupId(payload.id);
      setStatusMessage(`已创建用户组“${payload.name}”。`);
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleGroupMembersSave() {
    if (!canManageMembers || !currentGroup) {
      return;
    }

    runMutation(async () => {
      await submitJson("/api/admin/groups", "PATCH", {
        groupId: currentGroup.id,
        memberIds: groupMemberDraftIds,
      });

      setStatusMessage(`已更新用户组“${currentGroup.name}”的成员。`);
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
      setIsGroupMemberEditorOpen(false);
    });
  }

  function openGroupInfoEditor(group: AdminGroupRecord) {
    setEditingGroup(group);
    setGroupEditName(group.name);
    setGroupEditDescription(group.description);
  }

  function closeGroupInfoEditor() {
    setEditingGroup(null);
    setGroupEditName("");
    setGroupEditDescription("");
  }

  function handleGroupInfoSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageMembers || !editingGroup) {
      return;
    }

    runMutation(async () => {
      const payload = await submitJson("/api/admin/groups", "PATCH", {
        groupId: editingGroup.id,
        name: groupEditName,
        description: groupEditDescription,
      });

      setStatusMessage(`已更新用户组“${payload.name}”。`);
      closeGroupInfoEditor();
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function handleGroupDelete(group: AdminGroupRecord | null = currentGroup) {
    if (!canManageMembers || !group) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除用户组“${group.name}”吗？删除后会同时移除它的成员关系和权限授权。`,
    );

    if (!confirmed) {
      return;
    }

    const deletedGroupName = group.name;

    runMutation(async () => {
      await submitJson("/api/admin/groups", "DELETE", {
        groupId: group.id,
      });

      setSelectedGroupId("");
      setGroupMemberDraftIds([]);
      setIsGroupMemberEditorOpen(false);
      setStatusMessage(`已删除用户组“${deletedGroupName}”。`);
      await loadWorkspace({ folderId: currentFolder?.id, documentId: previewDocument?.id });
    });
  }

  function renderTree(parentId: string | null, depth = 0): React.ReactNode {
    const branchFolders = folders
      .filter((folder) => folder.parentId === parentId)
      .sort((left, right) => left.order - right.order);

    return branchFolders.map((folder) => (
      <div key={folder.id}>
        <button
          type="button"
          className={`tree-node ${currentFolder?.id === folder.id ? "is-active" : ""} ${
            dropTargetFolderId === folder.id ? "is-drop-target" : ""
          } ${dragResource?.type === "folder" && dragResource.id === folder.id ? "is-dragging" : ""}`}
          style={{ paddingLeft: `${depth * 18 + 18}px` }}
          aria-pressed={currentFolder?.id === folder.id}
          draggable={workspace?.canMutate ?? false}
          onClick={() => handleSelectFolder(folder.id)}
          onDragStart={(event) => handleResourceDragStart(event, { type: "folder", id: folder.id })}
          onDragEnd={handleResourceDragEnd}
          onDragOver={(event) => handleFolderDragOver(event, folder.id)}
          onDragLeave={(event) => handleFolderDragLeave(event, folder.id)}
          onDrop={(event) => handleFolderDrop(event, folder.id)}
        >
          {folder.name}
        </button>
        {renderTree(folder.id, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="admin-shell">
      <header className="admin-toolbar paper-panel">
        <div className="toolbar-stack">
          <div className="admin-brand-row">
            <Image
              src="/branding/wenlan-logo.png"
              alt="文览 标志"
              width={1254}
              height={1254}
              priority
              className="admin-brand-icon"
            />
            <div>
              <p className="section-eyebrow">文览后台</p>
              <h1 className="page-title">{mode === "content" ? "内容管理" : "成员管理"}</h1>
            </div>
          </div>
          <p className="page-description">
            {mode === "content"
              ? "像文件资源管理器一样管理文件夹、文档和访问权限。"
              : "管理成员、邀请和用户组。"}
          </p>
        </div>

        <div className="toolbar-actions">
          <input
            ref={importFileInputRef}
            className="sr-only"
            type="file"
            accept=".html,.htm,.md,.markdown,text/html,text/markdown,text/plain"
            tabIndex={-1}
            onChange={handleImportFileChange}
          />
          {mode === "content" ? (
            <>
              <button
                type="button"
                className={`hero-button ${openCreatePanel === "folder" ? "is-active" : ""}`}
                onClick={() => handleToggleCreatePanel("folder")}
              >
                新建文件夹
              </button>
              <button
                type="button"
                className={`hero-button hero-button-strong ${
                  openCreatePanel === "import" ? "is-active" : ""
                }`}
                aria-expanded={openCreatePanel === "import"}
                aria-controls="admin-import-html-panel"
                onClick={handleImportToolbarClick}
              >
                导入文档
              </button>
              <Link href="/admin/members" className="hero-button">
                成员管理
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`hero-button ${membersView === "members" ? "hero-button-strong" : ""}`}
                onClick={() => setMembersView("members")}
              >
                成员管理
              </button>
              <button
                type="button"
                className={`hero-button ${membersView === "invites" ? "hero-button-strong" : ""}`}
                onClick={() => setMembersView("invites")}
              >
                邀请管理
              </button>
              <button
                type="button"
                className={`hero-button ${membersView === "groups" ? "hero-button-strong" : ""}`}
                onClick={() => setMembersView("groups")}
              >
                用户组
              </button>
              <Link href="/admin" className="hero-button hero-button-strong">
                内容管理
              </Link>
            </>
          )}
        </div>
      </header>

      {(statusMessage || isLoading) && openCreatePanel !== "import" ? (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {statusMessage || "正在加载后台内容"}
        </p>
      ) : null}

      {mode === "content" && openCreatePanel === "folder" ? (
        <form
          className="admin-form-panel paper-panel"
          onSubmit={handleCreateFolderSubmit}
        >
          <div className="form-panel-head">
            <h2>新建文件夹</h2>
            <span className="mini-caption">上级：{currentFolder?.name ?? "根目录"}</span>
          </div>
          <div className="field-grid">
            <label>
              名称
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="运营规范"
                required
              />
            </label>
            <label>
              路由标识
              <input
                value={newFolderSlug}
                onChange={(event) => setNewFolderSlug(event.target.value)}
                placeholder="operations"
              />
            </label>
          </div>
          <label>
            描述
            <textarea
              value={newFolderDescription}
              onChange={(event) => setNewFolderDescription(event.target.value)}
              placeholder="这个文件夹主要收纳什么内容？"
            />
          </label>
          {statusMessage ? (
            <p className="form-feedback" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
          <div className="toolbar-actions">
            <button
              type="submit"
              className="hero-button hero-button-strong"
              disabled={!workspace?.canMutate}
            >
              保存文件夹
            </button>
            <button
              type="button"
              className="hero-button"
              onClick={() => setOpenCreatePanel(null)}
            >
              取消
            </button>
          </div>
        </form>
      ) : null}

      {mode === "content" && openCreatePanel === "import" ? (
        <form
          id="admin-import-html-panel"
          className="admin-form-panel paper-panel"
          onSubmit={handleImportHtmlSubmit}
        >
          <div className="form-panel-head import-panel-head">
            <div>
              <p className="section-eyebrow">导入工作台</p>
              <h2>导入文档</h2>
              <p className="mini-caption">
                支持 HTML / Markdown，权限和原格式选项会直接用于这次导入的文档。
              </p>
            </div>
            <span className="tag-chip">
              导入位置：{currentFolder?.name ?? "全部内容"}
            </span>
          </div>

          <div className="import-workbench">
            <section className="import-file-stage">
              <div className="import-stage-head">
                <span className="import-field-label">源文件</span>
                <div className="import-format-pills" aria-hidden="true">
                  <span>HTML</span>
                  <span>MD</span>
                </div>
              </div>
              <button
                type="button"
                className={`file-picker-button import-dropzone ${importHtmlFile ? "has-file" : ""}`}
                aria-label={
                  importHtmlFile
                    ? `重新选择文档文件，当前文件：${importHtmlFile.name}`
                    : "选择 HTML / Markdown 文件"
                }
                onClick={() => importFileInputRef.current?.click()}
              >
                <span className="import-dropzone-icon" aria-hidden="true">
                  ⤴
                </span>
                <span className="import-dropzone-copy">
                  <strong>{importHtmlFile?.name ?? "选择 HTML / Markdown 文件"}</strong>
                  <small>
                    {importHtmlFile
                      ? "已选中文件，可直接导入或重新选择。"
                      : "支持单文件导入，适合规范、手册、报告和 Markdown 草稿。"}
                  </small>
                </span>
              </button>
            </section>

            <section className="import-option-stack" aria-label="导入设置">
              <label className="import-option-card">
                <span className="import-field-label">权限</span>
                <select
                  value={importAccessMode}
                  onChange={(event) => setImportAccessMode(event.target.value as AdminAccessMode)}
                >
                  {editableAccessOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="import-option-card import-toggle-card">
                <span className="import-field-label">显示方式</span>
                <span className="import-toggle-copy">
                  <strong>{importRenderMode === "source" ? "保留原格式" : "站内阅读版"}</strong>
                  <small>
                    {importRenderMode === "source"
                      ? "直接按源文件样式展示，适合有完整设计的文档。"
                      : "自动整理成站内统一阅读样式，适合知识库沉淀。"}
                  </small>
                </span>
                <span className="admin-checkbox import-format-checkbox">
                  <input
                    type="checkbox"
                    checked={importRenderMode === "source"}
                    onChange={(event) =>
                      setImportRenderMode(event.target.checked ? "source" : "site")
                    }
                  />
                  保留源文档格式
                </span>
              </label>
            </section>
          </div>
          {statusMessage ? (
            <p className="form-feedback" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
          <div className="toolbar-actions">
            <button
              type="submit"
              className="hero-button hero-button-strong"
              disabled={!workspace?.canMutate || !importHtmlFile || isImporting}
            >
              {isImporting ? "导入中..." : "导入文档"}
            </button>
            <button
              type="button"
              className="hero-button"
              onClick={() => {
                clearImportSelection();
                setOpenCreatePanel(null);
                setStatusMessage("");
              }}
            >
              取消
            </button>
          </div>
        </form>
      ) : null}

      {mode === "content" ? (
      <>
      <section className="paper-panel explorer-shell" style={explorerStyle}>
        <div className="manager-head explorer-head">
          <div className="manager-heading-stack">
            <p className="section-eyebrow">文件管理</p>
            <div className="manager-title-row">
              <nav className="breadcrumbs manager-breadcrumbs" aria-label="当前文件夹路径">
                {folderTrail.length > 0 ? (
                  folderTrail.map((item, index) => {
                    const isLast = index === folderTrail.length - 1;
                    return (
                      <span key={item.id} className="crumb-item">
                        {isLast ? (
                          <span aria-current="page">{item.name}</span>
                        ) : (
                          <button
                            type="button"
                            className="crumb-button"
                            onClick={() => handleSelectFolder(item.id)}
                          >
                            {item.name}
                          </button>
                        )}
                      </span>
                    );
                  })
                ) : (
                  <span className="crumb-item" aria-current="page">
                    全部内容
                  </span>
                )}
              </nav>
              <div
                className="resource-row-actions"
                role="group"
                aria-label={`当前层级操作：${currentFolder?.name ?? "全部内容"}`}
              >
                {currentFolder ? (
                  <button
                    type="button"
                    className="resource-edit-button row-edit-button"
                    aria-label="返回最外层根目录"
                    data-tooltip="根目录"
                    title="返回最外层根目录"
                    onClick={() => handleSelectFolder("")}
                  >
                    <span aria-hidden="true">⌂</span>
                  </button>
                ) : null}
                {parentFolder ? (
                  <button
                    type="button"
                    className="resource-edit-button row-edit-button"
                    aria-label={`返回上一级：${parentFolder.name}`}
                    data-tooltip="上一级"
                    title="返回上一级"
                    onClick={() => handleSelectFolder(parentFolder.id)}
                  >
                    <span aria-hidden="true">↩</span>
                  </button>
                ) : null}
                {currentFolder ? (
                  <>
                    <button
                      type="button"
                      className="resource-edit-button row-edit-button"
                      aria-label={`编辑当前文件夹：${currentFolder.name}`}
                      data-tooltip="编辑"
                      title="编辑"
                      onClick={() => openFolderEditor(currentFolder)}
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <button
                      type="button"
                      className="resource-edit-button row-edit-button"
                      aria-label={`删除当前文件夹：${currentFolder.name}`}
                      data-tooltip="删除"
                      title="删除"
                      onClick={() => handleDeleteFolder(currentFolder)}
                      disabled={
                        !workspace?.canMutate ||
                        currentFolder.childFolderCount > 0 ||
                        currentFolder.childDocumentCount > 0
                      }
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="manager-status-row">
              <div className="manager-title-cluster">
                <h2 className="manager-title">{currentFolder?.name ?? "全部内容"}</h2>
                <span className="manager-count-pill">
                  {currentFolder
                    ? `${currentFolder.childFolderCount} 个子文件夹 · ${currentFolder.childDocumentCount} 篇文档`
                    : `${childFolders.length} 个顶级文件夹 · ${childDocuments.length} 篇顶级文档`}
                </span>
              </div>
              <p className="mini-caption">
                {currentFolder
                  ? `当前层级：${folderTrail.map((item) => item.name).join(" / ")}`
                  : "当前层级：全部内容，可创建顶级文件夹或顶级文档。"}
              </p>
            </div>
          </div>

          <div className="manager-utility-stack">
            <span className="tag-chip">
              {workspace?.canMutate ? "可拖动排序与移动" : "当前为只读查看"}
            </span>
            <div className="view-switch small-switch" role="tablist" aria-label="后台视图切换">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "grid"}
                className={`view-pill ${viewMode === "grid" ? "is-active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                卡片
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "list"}
                className={`view-pill ${viewMode === "list" ? "is-active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                列表
              </button>
            </div>
          </div>
        </div>

        <div className="explorer-body">
          <aside className="tree-panel explorer-tree-pane">
            <div className="tree-list">
              <button
                type="button"
                className={`tree-node ${!selectedFolderId ? "is-active" : ""} ${
                  dropTargetFolderId === "__root__" ? "is-drop-target" : ""
                }`}
                style={{ paddingLeft: "18px" }}
                aria-pressed={!selectedFolderId}
                onClick={() => handleSelectFolder("")}
                onDragOver={handleRootDragOver}
                onDragLeave={handleRootDragLeave}
                onDrop={handleRootDrop}
              >
                全部内容
              </button>
              {renderTree(null)}
            </div>
          </aside>
          <div
            className="explorer-resizer"
            role="separator"
            aria-label="调整文件夹树宽度"
            aria-orientation="vertical"
            aria-valuemin={MIN_TREE_PANE_WIDTH}
            aria-valuemax={MAX_TREE_PANE_WIDTH}
            aria-valuenow={treePaneWidth}
            tabIndex={0}
            onPointerDown={handleTreeResizePointerDown}
            onKeyDown={handleTreeResizeKeyDown}
          />

          <section className="manager-panel explorer-resource-pane">

          {viewMode === "grid" ? (
            <div className="gallery-grid compact-grid explorer-grid">
              {childFolders.map((folder) => (
                <article
                  key={folder.id}
                  className={`paper-card folder-card card-button explorer-card ${
                    currentFolder?.id === folder.id ? "is-selected" : ""
                  } ${dropTargetFolderId === folder.id ? "is-drop-target" : ""} ${
                    dragResource?.type === "folder" && dragResource.id === folder.id ? "is-dragging" : ""
                  } ${
                    folderDropTarget?.id === folder.id
                      ? `is-drop-${folderDropTarget.position}`
                      : ""
                  }`}
                  draggable={workspace?.canMutate ?? false}
                  onDragStart={(event) =>
                    handleResourceDragStart(event, { type: "folder", id: folder.id })
                  }
                  onDragEnd={handleResourceDragEnd}
                  onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                  onDragLeave={(event) => handleFolderDragLeave(event, folder.id)}
                  onDrop={(event) => handleFolderDrop(event, folder.id)}
                >
                  <button
                    type="button"
                    className="resource-card-main"
                    onClick={() => handleSelectFolder(folder.id)}
                  >
                    <div className="card-topline">
                      <p className="card-eyebrow">文件夹</p>
                    </div>
                    <h3>{folder.name}</h3>
                  </button>
                  <details className="resource-menu card-action-menu" onClick={(event) => event.stopPropagation()}>
                    <summary aria-label={`打开文件夹操作：${folder.name}`}>
                      <span aria-hidden="true">⋯</span>
                    </summary>
                    <div className="resource-menu-popover">
                      <button
                        type="button"
                        onClick={() => openFolderEditor(folder)}
                        disabled={!workspace?.canMutate}
                      >
                        <span aria-hidden="true">✎</span>
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(folder)}
                        disabled={
                          !workspace?.canMutate ||
                          folder.childFolderCount > 0 ||
                          folder.childDocumentCount > 0
                        }
                      >
                        <span aria-hidden="true">×</span>
                        删除
                      </button>
                    </div>
                  </details>
                </article>
              ))}
              {childDocuments.map((document) => (
                <article
                  key={document.id}
                  className={`paper-card document-card card-button explorer-card ${
                    previewDocument?.id === document.id ? "is-selected" : ""
                  } ${
                    dragResource?.type === "document" && dragResource.id === document.id
                      ? "is-dragging"
                      : ""
                  } ${
                    documentDropTarget?.id === document.id
                      ? `is-drop-${documentDropTarget.position}`
                      : ""
                  }`}
                  draggable={workspace?.canMutate ?? false}
                  onDragStart={(event) =>
                    handleResourceDragStart(event, { type: "document", id: document.id })
                  }
                  onDragEnd={handleResourceDragEnd}
                  onDragOver={(event) => handleDocumentDragOver(event, document)}
                  onDragLeave={(event) => handleDocumentDragLeave(event, document)}
                  onDrop={(event) => handleDocumentDrop(event, document)}
                >
                  <button
                    type="button"
                    className="resource-card-main"
                    aria-pressed={previewDocument?.id === document.id}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <div className="card-topline">
                      <p className="card-eyebrow">文档</p>
                    </div>
                    <h3>{document.title}</h3>
                  </button>
                  <details className="resource-menu card-action-menu" onClick={(event) => event.stopPropagation()}>
                    <summary aria-label={`打开文档操作：${document.title}`}>
                      <span aria-hidden="true">⋯</span>
                    </summary>
                    <div className="resource-menu-popover">
                      <button
                        type="button"
                        onClick={() => openDocumentEditor(document)}
                        disabled={!workspace?.canMutate}
                      >
                        <span aria-hidden="true">✎</span>
                        编辑
                      </button>
                      <a href={`/admin/preview/${document.id}`} target="_blank" rel="noreferrer">
                        <span aria-hidden="true">↗</span>
                        预览
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(document)}
                        disabled={!workspace?.canMutate}
                      >
                        <span aria-hidden="true">×</span>
                        删除
                      </button>
                    </div>
                  </details>
                </article>
              ))}
              {childFolders.length === 0 && childDocuments.length === 0 ? (
                <div className="empty-state">当前文件夹为空。</div>
              ) : null}
            </div>
          ) : (
            <div className="admin-table explorer-table">
              <div className="list-header admin-resource-header">
                <span>名称</span>
                <span>权限</span>
                <span>类型</span>
                <span>更新于</span>
                <span>操作</span>
              </div>

              {childFolders.map((folder) => (
                <div
                  key={folder.id}
                  className={`list-row list-row-rich admin-list-button admin-resource-row ${
                    currentFolder?.id === folder.id ? "is-selected" : ""
                  } ${dropTargetFolderId === folder.id ? "is-drop-target" : ""} ${
                    dragResource?.type === "folder" && dragResource.id === folder.id ? "is-dragging" : ""
                  } ${
                    folderDropTarget?.id === folder.id
                      ? `is-drop-${folderDropTarget.position}`
                      : ""
                  }`}
                  draggable={workspace?.canMutate ?? false}
                  onDragStart={(event) =>
                    handleResourceDragStart(event, { type: "folder", id: folder.id })
                  }
                  onDragEnd={handleResourceDragEnd}
                  onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                  onDragLeave={(event) => handleFolderDragLeave(event, folder.id)}
                  onDrop={(event) => handleFolderDrop(event, folder.id)}
                >
                  <button
                    type="button"
                    className="resource-row-main"
                    onClick={() => handleSelectFolder(folder.id)}
                  >
                    <strong>{folder.name}</strong>
                  </button>
                  <span>{accessLabelMap[folder.accessMode]}</span>
                  <span>文件夹</span>
                  <span>-</span>
                  <div
                    className="resource-row-actions"
                    role="group"
                    aria-label={`文件夹操作：${folder.name}`}
                  >
                    <button
                      type="button"
                      className="resource-edit-button row-edit-button"
                      aria-label={`编辑文件夹：${folder.name}`}
                      data-tooltip="编辑"
                      title="编辑"
                      onClick={() => openFolderEditor(folder)}
                      disabled={!workspace?.canMutate}
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <button
                      type="button"
                      className="resource-edit-button row-edit-button"
                      aria-label={`删除文件夹：${folder.name}`}
                      data-tooltip="删除"
                      title="删除"
                      onClick={() => handleDeleteFolder(folder)}
                      disabled={
                        !workspace?.canMutate ||
                        folder.childFolderCount > 0 ||
                        folder.childDocumentCount > 0
                      }
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </div>
              ))}
              {childDocuments.map((document) => (
                <div
                  key={document.id}
                  className={`list-row list-row-rich admin-list-button admin-resource-row ${
                    previewDocument?.id === document.id ? "is-selected" : ""
                  } ${
                    dragResource?.type === "document" && dragResource.id === document.id
                      ? "is-dragging"
                      : ""
                  } ${
                    documentDropTarget?.id === document.id
                      ? `is-drop-${documentDropTarget.position}`
                      : ""
                  }`}
                  draggable={workspace?.canMutate ?? false}
                  onDragStart={(event) =>
                    handleResourceDragStart(event, { type: "document", id: document.id })
                  }
                  onDragEnd={handleResourceDragEnd}
                  onDragOver={(event) => handleDocumentDragOver(event, document)}
                  onDragLeave={(event) => handleDocumentDragLeave(event, document)}
                  onDrop={(event) => handleDocumentDrop(event, document)}
                >
                  <button
                    type="button"
                    className="resource-row-main"
                    aria-pressed={previewDocument?.id === document.id}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <strong>{document.title}</strong>
                  </button>
                  <span>{accessLabelMap[document.accessMode]}</span>
                  <span>文档</span>
                  <span>{formatDate(document.updatedAt)}</span>
                  <div
                    className="resource-row-actions"
                    role="group"
                    aria-label={`文档操作：${document.title}`}
                  >
                    <button
                      type="button"
                      className="resource-edit-button row-edit-button"
                      aria-label={`编辑文档：${document.title}`}
                      data-tooltip="编辑"
                      title="编辑"
                      onClick={() => openDocumentEditor(document)}
                      disabled={!workspace?.canMutate}
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <a
                      className="resource-edit-button row-edit-button"
                      aria-label={`打开预览：${document.title}`}
                      data-tooltip="预览"
                      title="预览"
                      href={`/admin/preview/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span aria-hidden="true">↗</span>
                    </a>
                    <button
                      type="button"
                      className="resource-edit-button row-edit-button"
                      aria-label={`删除文档：${document.title}`}
                      data-tooltip="删除"
                      title="删除"
                      onClick={() => handleDeleteDocument(document)}
                      disabled={!workspace?.canMutate}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </div>
              ))}
              {childFolders.length === 0 && childDocuments.length === 0 ? (
                <div className="empty-state">当前文件夹为空。</div>
              ) : null}
            </div>
          )}
        </section>
        </div>
      </section>

      {isEditorOpen ? (
        <div className="admin-editor-overlay">
          <section
            className="admin-editor-dialog paper-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-editor-title"
          >
          {editTarget === "folder" && folderEditorRecord ? (
            <form className="admin-editor-card" onSubmit={handleFolderSave}>
              <div className="preview-head">
                <h2 id="admin-editor-title">文件夹设置</h2>
                <div className="preview-badges">
                  <span className="tag-chip">直接权限：{accessLabelMap[folderDraft.accessMode]}</span>
                  <span className="tag-chip">
                    生效权限：{accessLabelMap[folderEditorRecord.effectiveAccessMode]}
                  </span>
                </div>
                <button
                  type="button"
                  className="resource-edit-button dialog-close-button"
                  aria-label="关闭编辑窗口"
                  onClick={closeEditor}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <p className="mini-caption">{describeAccessState(folderEditorRecord)}</p>
              <label>
                名称
                <input
                  value={folderDraft.name}
                  onChange={(event) =>
                    setFolderDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label>
                描述
                <textarea
                  value={folderDraft.description}
                  onChange={(event) =>
                    setFolderDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="field-grid">
                <label>
                  权限
                  <select
                    value={folderDraft.accessMode}
                    onChange={(event) =>
                      setFolderDraft((current) => ({
                        ...current,
                        accessMode: event.target.value as AdminAccessMode,
                      }))
                    }
                  >
                    {editableAccessOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  上级文件夹
                  <select
                    value={folderParentDraftId}
                    onChange={(event) => setFolderParentDraftId(event.target.value)}
                  >
                    <option value="__root__">全部内容</option>
                    {availableParentFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.routePath}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="toolbar-actions">
                <button
                  type="submit"
                  className="hero-button hero-button-strong"
                  disabled={!workspace?.canMutate}
                >
                  保存文件夹
                </button>
                <button
                  type="button"
                  className="hero-button"
                  onClick={closeEditor}
                >
                  取消
                </button>
              </div>
            </form>
          ) : null}

          {editTarget === "document" && documentEditorRecord ? (
            <form className="admin-editor-card" onSubmit={handleDocumentSave}>
              <div className="preview-head">
                <h2 id="admin-editor-title">文档编辑</h2>
                <div className="preview-badges">
                  <span className="tag-chip">直接权限：{accessLabelMap[documentDraft.accessMode]}</span>
                  <span className="tag-chip">
                    生效权限：{accessLabelMap[documentEditorRecord.effectiveAccessMode]}
                  </span>
                </div>
                <button
                  type="button"
                  className="resource-edit-button dialog-close-button"
                  aria-label="关闭编辑窗口"
                  onClick={closeEditor}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <p className="mini-caption">{describeAccessState(documentEditorRecord)}</p>

              <label>
                标题
                <input
                  value={documentDraft.title}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <div className="field-grid">
                <label>
                  权限
                  <select
                    value={documentDraft.accessMode}
                    onChange={(event) =>
                      setDocumentDraft((current) => ({
                        ...current,
                        accessMode: event.target.value as AdminAccessMode,
                      }))
                    }
                  >
                    {editableAccessOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  所属文件夹
                  <select
                    value={documentFolderDraftId}
                    onChange={(event) => setDocumentFolderDraftId(event.target.value)}
                  >
                    <option value="__root__">全部内容</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.routePath}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={documentDraft.featured}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({
                      ...current,
                      featured: event.target.checked,
                    }))
                  }
                />
                首页推荐
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={documentDraft.renderMode === "source"}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({
                      ...current,
                      renderMode: event.target.checked ? "source" : "site",
                    }))
                  }
                />
                保留源文档格式
              </label>
              <label>
                HTML 正文
                <textarea
                  className="editor-textarea"
                  value={documentDraft.bodyHtml}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({ ...current, bodyHtml: event.target.value }))
                  }
                />
              </label>
              <div className="toolbar-actions">
                <button
                  type="submit"
                  className="hero-button hero-button-strong"
                  disabled={!workspace?.canMutate}
                >
                  保存文档
                </button>
                <button
                  type="button"
                  className="hero-button"
                  onClick={closeEditor}
                >
                  取消
                </button>
              </div>
            </form>
          ) : null}
          </section>
        </div>
      ) : null}
      </>
      ) : null}

      {mode === "members" ? (
      <section className="paper-panel access-desk">
        <div className="manager-head">
          <div>
            <p className="section-eyebrow">成员工作区</p>
            <h2 className="section-title">
              {membersView === "members"
                ? "成员管理"
                : membersView === "invites"
                  ? "邀请管理"
                  : "用户组"}
            </h2>
            <p className="page-description">
              {membersView === "members"
                ? "管理已有成员账号与角色。"
                : membersView === "invites"
                  ? "生成邀请码或注册链接，发给待注册成员即可。"
                  : "整理用户组与组内成员。"}
            </p>
          </div>
          <span className="tag-chip">
            {canManageMembers ? "当前角色可管理成员" : "当前角色仅可查看"}
          </span>
        </div>

        {statusMessage ? (
          <p className="form-feedback" role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}

        <div className="access-grid access-grid-single">
          {membersView === "invites" ? (
            <div className="access-column access-column-full">
              <form className="admin-editor-card" onSubmit={handleCreateInviteSubmit}>
                <div className="preview-head">
                  <h2>创建邀请</h2>
                  <span className="mini-caption">有效期 1-30 天</span>
                </div>
                <p className="mini-caption">
                  无需先填邮箱。生成后会优先复制注册链接，同时返回邀请码，拿到任一方式都能完成注册。
                </p>
                <div className="field-grid">
                  <label>
                    角色
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as EditableSiteRole)}
                      disabled={!canManageMembers}
                    >
                      {availableInviteRoles.map((role) => (
                        <option key={role} value={role}>
                          {getSiteRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    有效天数
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={inviteExpiryDays}
                      onChange={(event) => setInviteExpiryDays(event.target.value)}
                      disabled={!canManageMembers}
                    />
                  </label>
                  <label>
                    使用数量
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={inviteMaxUses}
                      onChange={(event) => setInviteMaxUses(event.target.value)}
                      disabled={!canManageMembers}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="hero-button hero-button-strong"
                  disabled={!canManageMembers}
                >
                  生成邀请码
                </button>
                {latestInviteSecret ? (
                  <div className="invite-result-card" role="status" aria-live="polite">
                    <div>
                      <p className="section-eyebrow">本次生成的邀请码</p>
                      <code className="invite-secret-code">{latestInviteSecret.inviteToken}</code>
                    </div>
                    <div className="invite-secret-line">
                      <span>注册链接</span>
                      <input value={latestInviteSecret.inviteLink} readOnly aria-label="注册链接" />
                    </div>
                    <div className="invite-result-actions">
                      <button
                        type="button"
                        className="hero-button"
                        onClick={() => handleCopyVisibleInvite(latestInviteSecret, "token")}
                      >
                        复制邀请码
                      </button>
                      <button
                        type="button"
                        className="hero-button hero-button-strong"
                        onClick={() => handleCopyVisibleInvite(latestInviteSecret, "link")}
                      >
                        复制注册链接
                      </button>
                    </div>
                    <p className="mini-caption">
                      使用次数：{latestInviteSecret.useCount}/{latestInviteSecret.maxUses}。邀请码会保留在后台，后续可在记录里查看或复制。
                    </p>
                  </div>
                ) : null}
              </form>
              <div className="admin-editor-card">
                <div className="preview-head">
                  <h2>邀请记录</h2>
                  <span className="mini-caption">已发出 {invites.length} 条</span>
                </div>
              <div className="admin-table access-table access-table-invites">
                <div className="list-header access-list-header">
                  <span>目标</span>
                  <span>角色</span>
                  <span>过期时间</span>
                  <span>使用次数</span>
                  <span>状态</span>
                  <span>操作</span>
                </div>
                {invites.map((invite) => {
                  const inviteSecret = getStoredInviteSecret(invite);
                  const inviteTargetLabel = getInviteTargetLabel(invite);

                  return (
                    <div key={invite.id} className="list-row access-list-row">
                      <div>
                        <strong>{inviteTargetLabel}</strong>
                        <p>创建于 {formatDate(invite.createdAt.slice(0, 10))}</p>
                      </div>
                      <span>{getSiteRoleLabel(invite.siteRole)}</span>
                      <span>{new Date(invite.expiresAt).toLocaleDateString("zh-CN")}</span>
                      <span>{invite.useCount}/{invite.maxUses}</span>
                      <span>{getInviteStatusLabel(invite)}</span>
                      <div
                        className="resource-row-actions"
                        role="group"
                        aria-label={`邀请操作：${inviteTargetLabel}`}
                      >
                        <>
                            <button
                              type="button"
                              className="resource-edit-button row-edit-button"
                              aria-label={`查看邀请码：${inviteTargetLabel}`}
                              data-tooltip={inviteSecret ? "查看邀请码" : "需重新生成"}
                              title={inviteSecret ? "查看邀请码" : "旧邀请码无法反查，请重新生成"}
                              onClick={() => handleInviteSecretView(invite)}
                              disabled={!canManageMembers}
                            >
                              <span aria-hidden="true">看</span>
                            </button>
                            <button
                              type="button"
                              className="resource-edit-button row-edit-button"
                              aria-label={`复制邀请码：${inviteTargetLabel}`}
                              data-tooltip={inviteSecret ? "复制邀请码" : "需重新生成"}
                              title={inviteSecret ? "复制邀请码" : "旧邀请码无法反查，请重新生成"}
                              onClick={() =>
                                inviteSecret
                                  ? handleCopyVisibleInvite(inviteSecret, "token")
                                  : handleMissingInviteSecret()
                              }
                              disabled={!canManageMembers}
                            >
                              <span aria-hidden="true">码</span>
                            </button>
                            <button
                              type="button"
                              className="resource-edit-button row-edit-button"
                              aria-label={`复制注册链接：${inviteTargetLabel}`}
                              data-tooltip={inviteSecret ? "复制链接" : "需重新生成"}
                              title={inviteSecret ? "复制注册链接" : "旧链接无法反查，请重新生成"}
                              onClick={() =>
                                inviteSecret
                                  ? handleCopyVisibleInvite(inviteSecret, "link")
                                  : handleMissingInviteSecret()
                              }
                              disabled={!canManageMembers}
                            >
                              <span aria-hidden="true">链</span>
                            </button>
                            <button
                              type="button"
                              className="resource-edit-button row-edit-button"
                              aria-label={`重新生成邀请：${inviteTargetLabel}`}
                              data-tooltip="重新生成"
                              title="重新生成"
                              onClick={() => handleInviteReissue(invite.id)}
                              disabled={!canManageMembers}
                            >
                              <span aria-hidden="true">↻</span>
                            </button>
                            <button
                              type="button"
                              className="resource-edit-button row-edit-button"
                              aria-label={`作废邀请：${inviteTargetLabel}`}
                              data-tooltip="作废邀请"
                              title="作废邀请"
                              onClick={() => handleInviteDelete(invite.id)}
                              disabled={!canManageMembers}
                            >
                              <span aria-hidden="true">×</span>
                            </button>
                          </>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          ) : null}

          {membersView === "members" ? (
          <div className="access-column access-column-full">
            <div className="admin-editor-card">
              <div className="preview-head">
                <h2>成员列表</h2>
                <span className="mini-caption">共 {members.length} 人</span>
              </div>
              <div className="admin-table access-table access-table-members">
                <div className="list-header access-list-header">
                  <span>成员</span>
                  <span>角色</span>
                  <span>状态</span>
                  <span>操作</span>
                </div>
                {members.map((member) => (
                  <div key={member.id} className="list-row access-list-row">
                    <div>
                      <strong>{member.displayName}</strong>
                      <p>{member.email ?? "未填写邮箱"}</p>
                    </div>
                    <label className="table-select-label">
                      <span className="sr-only">{member.displayName} 的角色</span>
                      <select
                        value={
                          profileRoleDrafts[member.id] ??
                          normalizeEditableSiteRole(member.siteRole)
                        }
                        onChange={(event) =>
                          setProfileRoleDrafts((current) => ({
                            ...current,
                            [member.id]: event.target.value as EditableSiteRole,
                          }))
                        }
                        disabled={!canEditMemberRole()}
                      >
                        {allSiteRoles.map((role) => (
                          <option key={role} value={role}>
                            {getSiteRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span>{formatProfileStatus(member.status)}</span>
                    <div
                      className="resource-row-actions"
                      role="group"
                      aria-label={`成员操作：${member.displayName}`}
                    >
                      <button
                        type="button"
                        className="resource-edit-button row-edit-button"
                        aria-label={`保存成员设置：${member.displayName}`}
                        data-tooltip="保存"
                        title="保存"
                        disabled={
                          !canEditMemberRole() ||
                          (profileRoleDrafts[member.id] ??
                            normalizeEditableSiteRole(member.siteRole)) ===
                            normalizeEditableSiteRole(member.siteRole)
                        }
                        onClick={() => handleMemberSave(member.id)}
                      >
                        <span aria-hidden="true">✓</span>
                      </button>
                      <button
                        type="button"
                        className="resource-edit-button row-edit-button"
                        aria-label={
                          member.status === "disabled"
                            ? `恢复成员：${member.displayName}`
                            : `禁用成员：${member.displayName}`
                        }
                        data-tooltip={member.status === "disabled" ? "恢复成员" : "禁用成员"}
                        title={member.status === "disabled" ? "恢复成员" : "禁用成员"}
                        onClick={() => handleMemberStatusToggle(member.id)}
                        disabled={
                          !canManageMembers ||
                          Boolean(workspace?.viewer.email && member.email === workspace.viewer.email)
                        }
                      >
                        <span aria-hidden="true">{member.status === "disabled" ? "↺" : "⏸"}</span>
                      </button>
                      <button
                        type="button"
                        className="resource-edit-button row-edit-button"
                        aria-label={`移出成员：${member.displayName}`}
                        data-tooltip="移出成员"
                        title="移出成员"
                        onClick={() => handleMemberRemove(member.id)}
                        disabled={
                          !canManageMembers ||
                          Boolean(workspace?.viewer.email && member.email === workspace.viewer.email)
                        }
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                      <button
                        type="button"
                        className="resource-edit-button row-edit-button"
                        aria-label={`查看成员资料：${member.displayName}`}
                        data-tooltip="查看资料"
                        title="查看资料"
                        onClick={() => handleMemberView(member.id)}
                      >
                        <span aria-hidden="true">i</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          ) : null}

          {membersView === "groups" ? (
          <div className="access-column access-column-full">
            <form className="admin-editor-card group-create-card" onSubmit={handleCreateGroupSubmit}>
              <div className="preview-head">
                <h2>新建用户组</h2>
                <span className="mini-caption">可复用的权限集合</span>
              </div>
              <div className="group-create-row">
                <label>
                  名称
                  <input
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder="核心编辑组"
                    disabled={!canManageMembers}
                    required
                  />
                </label>
                <label>
                  描述
                  <input
                    value={newGroupDescription}
                    onChange={(event) => setNewGroupDescription(event.target.value)}
                    placeholder="这个用户组适合哪些人？"
                    disabled={!canManageMembers}
                  />
                </label>
                <button
                  type="submit"
                  className="hero-button hero-button-strong"
                  disabled={!canManageMembers}
                >
                  创建用户组
                </button>
              </div>
            </form>

            <div className="admin-editor-card">
              <div className="preview-head">
                <h2>用户组管理</h2>
                <span className="mini-caption">共 {groups.length} 个用户组</span>
              </div>
              {groups.length > 0 ? (
                <div className="admin-table access-table access-table-group-list">
                  <div className="list-header access-list-header">
                    <span>用户组</span>
                    <span>成员</span>
                    <span>说明</span>
                    <span>操作</span>
                  </div>
                  {groups.map((group) => {
                    const isCurrentGroup = currentGroup?.id === group.id;

                    return (
                      <div
                        key={group.id}
                        className={`list-row access-list-row ${isCurrentGroup ? "is-active-group" : ""}`}
                      >
                        <div>
                          <strong>{group.name}</strong>
                          <p>{isCurrentGroup ? "当前用户组" : "点击操作图标管理"}</p>
                        </div>
                        <span>{group.memberCount} 人</span>
                        <span>{group.description || "未填写说明"}</span>
                        <div
                          className="resource-row-actions"
                          role="group"
                          aria-label={`用户组操作：${group.name}`}
                        >
                          <button
                            type="button"
                            className="resource-edit-button row-edit-button"
                            onClick={() => openGroupInfoEditor(group)}
                            disabled={!canManageMembers}
                            aria-label={`编辑用户组信息：${group.name}`}
                            data-tooltip="编辑信息"
                            title="编辑信息"
                          >
                            <span aria-hidden="true">✎</span>
                          </button>
                          <button
                            type="button"
                            className="resource-edit-button row-edit-button"
                            onClick={() => {
                              setSelectedGroupId(group.id);
                              setGroupMemberDraftIds(group.memberIds);
                              setIsGroupMemberEditorOpen(true);
                            }}
                            aria-label={`配置成员：${group.name}`}
                            data-tooltip="配置成员"
                            title="配置成员"
                          >
                            <span aria-hidden="true">人</span>
                          </button>
                          <button
                            type="button"
                            className="resource-edit-button row-edit-button"
                            onClick={() => handleGroupDelete(group)}
                            disabled={!canManageMembers}
                            aria-label={`删除用户组：${group.name}`}
                            data-tooltip="删除用户组"
                            title="删除用户组"
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">还没有用户组，先创建一个再分配成员。</div>
              )}

            </div>
          </div>
          ) : null}

        </div>
      </section>
      ) : null}

      {editingGroup ? (
        <div className="admin-editor-overlay" onClick={closeGroupInfoEditor}>
          <section
            className="admin-editor-dialog group-info-dialog paper-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-info-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <form className="admin-editor-card" onSubmit={handleGroupInfoSave}>
              <div className="preview-head">
                <div>
                  <h2 id="group-info-dialog-title">编辑用户组信息</h2>
                  <p className="mini-caption">只修改用户组名称和说明。</p>
                </div>
                <button
                  type="button"
                  className="resource-edit-button dialog-close-button"
                  aria-label="关闭用户组信息编辑"
                  onClick={closeGroupInfoEditor}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <label>
                名称
                <input
                  value={groupEditName}
                  onChange={(event) => setGroupEditName(event.target.value)}
                  disabled={!canManageMembers}
                  required
                />
              </label>
              <label>
                说明
                <textarea
                  value={groupEditDescription}
                  onChange={(event) => setGroupEditDescription(event.target.value)}
                  disabled={!canManageMembers}
                  rows={4}
                />
              </label>
              <div className="dialog-actions">
                <button
                  type="submit"
                  className="hero-button hero-button-strong"
                  disabled={
                    !canManageMembers ||
                    (groupEditName.trim() === editingGroup.name &&
                      groupEditDescription.trim() === editingGroup.description)
                  }
                >
                  保存信息
                </button>
                <button type="button" className="hero-button" onClick={closeGroupInfoEditor}>
                  取消
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isGroupMemberEditorOpen && currentGroup ? (
        <div className="admin-editor-overlay" onClick={() => setIsGroupMemberEditorOpen(false)}>
          <section
            className="admin-editor-dialog group-member-dialog paper-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-member-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-head">
              <div>
                <h2 id="group-member-dialog-title">配置用户组成员</h2>
                <p className="mini-caption">当前用户组：{currentGroup.name}</p>
              </div>
              <button
                type="button"
                className="resource-edit-button dialog-close-button"
                aria-label="关闭用户组成员配置"
                onClick={() => setIsGroupMemberEditorOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="admin-table access-table access-table-groups">
              <div className="list-header access-list-header">
                <span>成员</span>
                <span>状态</span>
                <span>加入用户组</span>
                <span>操作</span>
              </div>
              {members.map((member) => {
                const checked = groupMemberDraftIds.includes(member.id);
                const nextActionLabel = checked ? "移出用户组" : "加入用户组";

                return (
                  <div key={member.id} className="list-row access-list-row">
                    <div>
                      <strong>{member.displayName}</strong>
                      <p>{member.email ?? "未填写邮箱"}</p>
                    </div>
                    <span>{formatProfileStatus(member.status)}</span>
                    <span>{checked ? "已加入" : "未加入"}</span>
                    <div
                      className="resource-row-actions"
                      role="group"
                      aria-label={`用户组成员操作：${member.displayName}`}
                    >
                      <button
                        type="button"
                        className="resource-edit-button row-edit-button"
                        aria-label={`${nextActionLabel}：${member.displayName}`}
                        data-tooltip={nextActionLabel}
                        title={nextActionLabel}
                        onClick={() =>
                          setGroupMemberDraftIds((current) =>
                            toggleSelection(current, member.id),
                          )
                        }
                        disabled={!canManageMembers}
                      >
                        <span aria-hidden="true">{checked ? "−" : "+"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                className="hero-button hero-button-strong"
                onClick={handleGroupMembersSave}
                disabled={
                  !canManageMembers ||
                  groupMemberDraftIds.join(",") === currentGroup.memberIds.join(",")
                }
              >
                保存成员
              </button>
              <button
                type="button"
                className="hero-button"
                onClick={() => {
                  setGroupMemberDraftIds(currentGroup.memberIds);
                  setIsGroupMemberEditorOpen(false);
                }}
              >
                取消
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {memberDetailTarget ? (
        <div className="admin-editor-overlay" onClick={() => setMemberDetailTarget(null)}>
          <section
            className="admin-editor-dialog member-detail-dialog paper-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-head">
              <div>
                <h2 id="member-detail-title">成员资料</h2>
                <p className="mini-caption">查看账号信息与权限状态</p>
              </div>
              <button
                type="button"
                className="resource-edit-button dialog-close-button"
                aria-label="关闭成员资料窗口"
                onClick={() => setMemberDetailTarget(null)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="member-detail-hero">
              <strong>{memberDetailTarget.displayName}</strong>
              <span>{memberDetailTarget.email ?? "未填写邮箱"}</span>
            </div>
            <div className="member-detail-grid">
              <div className="member-detail-card">
                <span className="member-detail-label">角色</span>
                <strong>
                  {getSiteRoleLabel(memberDetailRole)}
                </strong>
              </div>
              <div className="member-detail-card">
                <span className="member-detail-label">状态</span>
                <strong>{formatProfileStatus(memberDetailTarget.status)}</strong>
              </div>
              <div className="member-detail-card">
                <span className="member-detail-label">所属用户组</span>
                <strong>{memberDetailGroups.length} 个</strong>
                <div className="member-detail-tags">
                  {memberDetailGroups.length > 0 ? (
                    memberDetailGroups.map((group) => <span key={group.id}>{group.name}</span>)
                  ) : (
                    <span>未加入用户组</span>
                  )}
                </div>
              </div>
              <div className="member-detail-card">
                <span className="member-detail-label">权限能力</span>
                <strong>{memberDetailAccessText}</strong>
              </div>
              <div className="member-detail-card">
                <span className="member-detail-label">创建时间</span>
                <strong>{formatDate(memberDetailTarget.createdAt.slice(0, 10))}</strong>
              </div>
              <div className="member-detail-card">
                <span className="member-detail-label">最近更新</span>
                <strong>{formatDate(memberDetailTarget.updatedAt.slice(0, 10))}</strong>
              </div>
              <div className="member-detail-card member-detail-card-wide">
                <span className="member-detail-label">账号 ID</span>
                <strong>{memberDetailTarget.id}</strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
