import type { Database } from "@/types/database";

export type SiteRole = Database["app"]["Enums"]["site_role"];
export type EditableSiteRole = Extract<SiteRole, "admin" | "viewer">;

export const editableSiteRoleOptions = [
  { value: "admin", label: "管理员" },
  { value: "viewer", label: "用户" },
] as const satisfies ReadonlyArray<{ value: EditableSiteRole; label: string }>;

export function isAdminSiteRole(siteRole: SiteRole | null | undefined) {
  return siteRole === "owner" || siteRole === "admin";
}

export function normalizeEditableSiteRole(siteRole: SiteRole | null | undefined): EditableSiteRole {
  return isAdminSiteRole(siteRole) ? "admin" : "viewer";
}

export function getSiteRoleLabel(siteRole: SiteRole | null | undefined) {
  return isAdminSiteRole(siteRole) ? "管理员" : "用户";
}
