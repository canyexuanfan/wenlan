import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readSource(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const contentTypes = readSource("src/lib/content/types.ts");
const contentConstants = readSource("src/lib/content/constants.ts");
const contentRepository = readSource("src/lib/content/repository.ts");
const adminRepository = readSource("src/lib/admin/repository.ts");
const adminPreviewPage = readSource("src/app/admin/preview/[id]/page.tsx");
const importRoute = readSource("src/app/api/admin/import-html/route.ts");
const nextConfig = readSource("next.config.ts");
const databaseTypes = readSource("src/types/database.ts");
const schemaSql = readFileSync(
  join(root, "../../infra/supabase/sql/001_wenlan_v1_schema.sql"),
  "utf8",
);
const shareMigrationSql = readFileSync(
  join(root, "../../infra/supabase/sql/009_share_visibility_and_root_documents.sql"),
  "utf8",
);
const inviteEmailMigrationSql = readFileSync(
  join(root, "../../infra/supabase/sql/008_invite_email_optional.sql"),
  "utf8",
);

assertContract(
  /export type AccessMode =[\s\S]*\|\s*"share"/.test(contentTypes),
  "V1 access mode must include share-visible documents.",
);
assertContract(
  contentConstants.includes('share: "分享可见"'),
  "The UI label for share-visible access must stay available.",
);
assertContract(
  databaseTypes.includes('| "share"') && schemaSql.includes("'share'"),
  "Database types and base schema must both know the share access mode.",
);
assertContract(
  shareMigrationSql.includes("add value if not exists 'share'") &&
    shareMigrationSql.includes("alter column folder_id drop not null"),
  "The production migration must add share visibility and allow root-level documents.",
);
assertContract(
  /case "public":\s*case "share":\s*return true;/.test(contentRepository),
  "Direct links to share-visible content must remain readable.",
);
assertContract(
  contentRepository.includes("viewerCanManageAdmin(viewer.siteRole) || mode !== \"share\""),
  "Admins must still see share-visible content in discovery lists.",
);
assertContract(
  contentRepository.includes("folderId?: string | null") &&
    contentRepository.includes('query.is("folder_id", null)'),
  "Root-level document listing must keep explicit null folder support.",
);
assertContract(
  adminPreviewPage.includes("buildRootFolderRecord") &&
    adminPreviewPage.includes("if (document.folderId && !folder)"),
  "Admin preview must not 404 for root-level documents.",
);
assertContract(
  importRoute.includes("| \"share\"") &&
    adminRepository.includes("function isMarkdownImportFile") &&
    adminRepository.includes("return /\\.(md|markdown)$/i.test(fileName)") &&
    adminRepository.includes('return isMarkdownImportFile(file.name) ? "text/markdown" : "text/html"'),
  "Import must continue to support share-visible access and Markdown files.",
);
assertContract(
  /create table if not exists app\.invite_tokens[\s\S]*email text/.test(schemaSql) &&
    inviteEmailMigrationSql.includes("alter column email drop not null") &&
    /invite_tokens:[\s\S]*Row:[\s\S]*email: string \| null;/.test(databaseTypes) &&
    adminRepository.includes("const email = sanitizeOptionalEmail(input.email)"),
  "Invitation links must be creatable without binding an email address.",
);
assertContract(
  nextConfig.includes("media-src 'self' data: blob:"),
  "CSP must allow the login verification audio data URL.",
);

console.log("V1 contract check passed.");
