import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readSource(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const authServer = readSource("src/lib/auth/server.ts");
const adminWorkspace = readSource("src/components/admin/admin-workspace.tsx");
const adminRepository = readSource("src/lib/admin/repository.ts");

const legacyAdminRolePattern = /ADMIN_ROLES[\s\S]*\[[^\]]*(editor|publisher)[^\]]*\]/;
if (legacyAdminRolePattern.test(authServer)) {
  throw new Error("Only owner/admin may be treated as administrators.");
}

const forbiddenEditableRolePattern = /allSiteRoles[\s\S]*\[[^\]]*(owner|editor|publisher)[^\]]*\]/;
if (forbiddenEditableRolePattern.test(adminWorkspace)) {
  throw new Error("The admin UI must expose only admin/user editable roles.");
}

const normalizedWorkspace = adminWorkspace.replace(/\s+/g, " ");
if (
  !/const allSiteRoles: EditableSiteRole\[\] = editableSiteRoleOptions\.map\(\(option\) => option\.value\);/.test(
    normalizedWorkspace,
  )
) {
  throw new Error("The admin UI must derive editable roles from the two-role option set.");
}

if (!adminWorkspace.includes("normalizeEditableSiteRole(member.siteRole)")) {
  throw new Error("Member role editing must normalize legacy roles to admin/user.");
}

const legacyAssignmentPatterns = [
  '["editor", "publisher", "viewer"].includes',
  '["owner", "admin"].includes(currentTargetRole)',
];
if (legacyAssignmentPatterns.some((pattern) => adminRepository.includes(pattern))) {
  throw new Error("Role assignment must be limited to admin/user.");
}

console.log("Two-role model check passed.");
