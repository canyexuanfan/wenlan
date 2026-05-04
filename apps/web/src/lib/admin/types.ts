import type { OutlineItem, SiteSettings } from "@/lib/content/types";
import type { EditableSiteRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

export type AdminAccessMode = Database["app"]["Enums"]["access_mode"];
export type AdminSiteRole = Database["app"]["Enums"]["site_role"];
export type AdminAccentTone = Database["app"]["Tables"]["folders"]["Row"]["accent"];
export type AdminDocumentRenderMode = "site" | "source";
export type AdminSourceMode = "supabase" | "mock";
export type AdminWorkspaceMode = "all" | "content" | "members";

export type AdminFolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  routePath: string;
  description: string;
  heroNote: string;
  accessMode: AdminAccessMode;
  effectiveAccessMode: Exclude<AdminAccessMode, "inherit">;
  isAccessInherited: boolean;
  accessSourceLabel: string | null;
  accessSourceType: AdminTargetType | null;
  accessSourceId: string | null;
  order: number;
  accent: AdminAccentTone;
  childFolderCount: number;
  childDocumentCount: number;
};

export type AdminDocumentRecord = {
  id: string;
  folderId: string | null;
  title: string;
  slug: string;
  routePath: string;
  summary: string;
  tags: string[];
  accessMode: AdminAccessMode;
  effectiveAccessMode: Exclude<AdminAccessMode, "inherit">;
  isAccessInherited: boolean;
  accessSourceLabel: string | null;
  accessSourceType: AdminTargetType | null;
  accessSourceId: string | null;
  order: number;
  authorName: string;
  updatedAt: string;
  readingTime: string;
  featured: boolean;
  renderMode: AdminDocumentRenderMode;
  bodyHtml: string;
  renderedBodyHtml: string;
  outline: OutlineItem[];
};

export type AdminProfileRecord = {
  id: string;
  email: string | null;
  displayName: string;
  siteRole: AdminSiteRole;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminInviteRecord = {
  id: string;
  email: string | null;
  siteRole: AdminSiteRole;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type AdminCurrentViewer = {
  email: string | null;
  displayName: string;
  siteRole: AdminSiteRole | null;
  canManageAdmin: boolean;
  canManageMembers: boolean;
};

export type AdminWorkspaceData = {
  sourceMode: AdminSourceMode;
  canMutate: boolean;
  viewer: AdminCurrentViewer;
  siteSettings: SiteSettings;
  folders: AdminFolderRecord[];
  documents: AdminDocumentRecord[];
  profiles: AdminProfileRecord[];
  invites: AdminInviteRecord[];
  groups: AdminGroupRecord[];
  grants: AdminAccessGrantRecord[];
};

export type CreateFolderInput = {
  parentId?: string | null;
  name: string;
  slug?: string;
  description?: string;
  heroNote?: string;
  accessMode?: AdminAccessMode;
  accent?: AdminAccentTone;
};

export type UpdateFolderInput = {
  id: string;
  name?: string;
  description?: string;
  heroNote?: string;
  accessMode?: AdminAccessMode;
  accent?: AdminAccentTone;
};

export type MoveFolderInput = {
  id: string;
  parentId: string | null;
};

export type DeleteFolderInput = {
  id: string;
};

export type ReorderFolderInput = {
  id: string;
  direction: "up" | "down";
};

export type CreateDocumentInput = {
  folderId: string | null;
  title: string;
  slug?: string;
  summary?: string;
  bodyHtml?: string;
  sourceType?: string;
  tags?: string[];
  accessMode?: AdminAccessMode;
  renderMode?: AdminDocumentRenderMode;
  featured?: boolean;
};

export type UpdateDocumentInput = {
  id: string;
  title?: string;
  summary?: string;
  bodyHtml?: string;
  tags?: string[];
  accessMode?: AdminAccessMode;
  renderMode?: AdminDocumentRenderMode;
  featured?: boolean;
};

export type MoveDocumentInput = {
  id: string;
  folderId: string | null;
};

export type DeleteDocumentInput = {
  id: string;
};

export type ReorderDocumentInput = {
  id: string;
  direction: "up" | "down";
};

export type CreateInviteInput = {
  email?: string | null;
  siteRole: EditableSiteRole;
  expiresInDays?: number;
};

export type CreateInviteResult = AdminInviteRecord & {
  invitePath: string;
  inviteToken: string;
};

export type UpdateProfileInput = {
  id: string;
  siteRole?: EditableSiteRole;
  status?: "active" | "disabled" | "removed";
};

export type AdminTargetType = Database["app"]["Enums"]["target_type"];

export type AdminGroupRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  memberIds: string[];
  memberCount: number;
  createdAt: string;
};

export type AdminAccessGrantRecord = {
  id: string;
  targetType: AdminTargetType;
  targetId: string;
  subjectType: "user" | "group";
  subjectId: string;
  accessLevel: string;
  createdAt: string;
};

export type CreateGroupInput = {
  name: string;
  slug?: string;
  description?: string;
};

export type UpdateGroupInput = {
  groupId: string;
  name: string;
  description?: string;
};

export type SyncGroupMembersInput = {
  groupId: string;
  memberIds: string[];
};

export type SyncAccessGrantsInput = {
  targetType: AdminTargetType;
  targetId: string;
  userIds: string[];
  groupIds: string[];
};
