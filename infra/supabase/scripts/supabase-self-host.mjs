#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..", "..");
const supabaseRoot = resolve(__dirname, "..");
const runtimeDir = resolve(supabaseRoot, "runtime");
const runtimeEnvPath = resolve(runtimeDir, ".env.self-host");
const runtimeInventoryPath = resolve(runtimeDir, "SECRET-INVENTORY.md");
const runtimeExampleEnvPath = resolve(supabaseRoot, ".env.self-host.example");
const runtimeInventoryTemplatePath = resolve(
  supabaseRoot,
  "SECRET-INVENTORY.template.md",
);
const appEnvPath = resolve(repoRoot, "apps", "web", ".env.local");
const sqlDir = resolve(supabaseRoot, "sql");

const command = process.argv[2] ?? "help";
const force = process.argv.includes("--force");
const targetOptionIndex = process.argv.indexOf("--target");
const targetArg =
  targetOptionIndex >= 0 ? process.argv[targetOptionIndex + 1] : undefined;

const inventoryKeys = [
  "POSTGRES_PASSWORD",
  "JWT_SECRET",
  "ANON_KEY",
  "SERVICE_ROLE_KEY",
  "SECRET_KEY_BASE",
  "VAULT_ENC_KEY",
  "PG_META_CRYPTO_KEY",
  "LOGFLARE_PUBLIC_ACCESS_TOKEN",
  "LOGFLARE_PRIVATE_ACCESS_TOKEN",
  "S3_PROTOCOL_ACCESS_KEY_ID",
  "S3_PROTOCOL_ACCESS_KEY_SECRET",
  "MINIO_ROOT_PASSWORD",
  "DASHBOARD_USERNAME",
  "DASHBOARD_PASSWORD",
  "SMTP_USER",
  "SMTP_PASS",
];

const generatedSecretKeys = [
  "POSTGRES_PASSWORD",
  "JWT_SECRET",
  "ANON_KEY",
  "SERVICE_ROLE_KEY",
  "SECRET_KEY_BASE",
  "VAULT_ENC_KEY",
  "PG_META_CRYPTO_KEY",
  "POOLER_TENANT_ID",
  "LOGFLARE_PUBLIC_ACCESS_TOKEN",
  "LOGFLARE_PRIVATE_ACCESS_TOKEN",
  "S3_PROTOCOL_ACCESS_KEY_ID",
  "S3_PROTOCOL_ACCESS_KEY_SECRET",
  "MINIO_ROOT_PASSWORD",
  "DASHBOARD_PASSWORD",
];

run(command);

function run(selectedCommand) {
  switch (selectedCommand) {
    case "init":
      initRuntime();
      console.log("Initialized runtime files.");
      break;
    case "generate-secrets":
      initRuntime();
      generateSecrets();
      syncWebEnv();
      console.log("Generated secrets and updated local backup files.");
      break;
    case "sync-web-env":
      initRuntime();
      syncWebEnv();
      console.log("Updated apps/web/.env.local from runtime env.");
      break;
    case "prepare-official-stack":
      initRuntime();
      prepareOfficialStack();
      console.log("Prepared official Supabase Docker stack.");
      break;
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`Usage:
  node infra/supabase/scripts/supabase-self-host.mjs init
  node infra/supabase/scripts/supabase-self-host.mjs generate-secrets [--force]
  node infra/supabase/scripts/supabase-self-host.mjs sync-web-env
  node infra/supabase/scripts/supabase-self-host.mjs prepare-official-stack [--target <dir>] [--force]
`);
}

function initRuntime() {
  mkdirSync(runtimeDir, { recursive: true });

  if (!existsSync(runtimeEnvPath)) {
    cpSync(runtimeExampleEnvPath, runtimeEnvPath);
  }

  if (!existsSync(runtimeInventoryPath)) {
    cpSync(runtimeInventoryTemplatePath, runtimeInventoryPath);
  }
}

function generateSecrets() {
  const env = readEnvFile(runtimeEnvPath);
  const projectName = env.PROJECT_NAME || "wenlan-prod";
  const slug = slugify(projectName);
  const generated = createGeneratedValues(slug);

  for (const key of generatedSecretKeys) {
    const currentValue = env[key] ?? "";

    if (force || shouldReplaceValue(currentValue)) {
      env[key] = generated[key];
    }
  }

  if (force || shouldReplaceValue(env.DASHBOARD_USERNAME ?? "")) {
    env.DASHBOARD_USERNAME = "wenlan_admin";
  }

  if (force || shouldReplaceValue(env.GLOBAL_S3_BUCKET ?? "")) {
    env.GLOBAL_S3_BUCKET = "document-assets";
  }

  if (force || shouldReplaceValue(env.REGION ?? "")) {
    env.REGION = "local";
  }

  if (force || shouldReplaceValue(env.STORAGE_TENANT_ID ?? "")) {
    env.STORAGE_TENANT_ID = slug;
  }

  writeEnvFile(runtimeEnvPath, env);
  writeSecretInventory(env);
}

function createGeneratedValues(projectSlug) {
  const jwtSecret = randomBase64(30);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 5 * 3600 * 24 * 365;

  return {
    POSTGRES_PASSWORD: randomHex(16),
    JWT_SECRET: jwtSecret,
    ANON_KEY: signJwt(
      { role: "anon", iss: "supabase", iat: issuedAt, exp: expiresAt },
      jwtSecret,
    ),
    SERVICE_ROLE_KEY: signJwt(
      {
        role: "service_role",
        iss: "supabase",
        iat: issuedAt,
        exp: expiresAt,
      },
      jwtSecret,
    ),
    SECRET_KEY_BASE: randomBase64(48),
    VAULT_ENC_KEY: randomHex(16),
    PG_META_CRYPTO_KEY: randomBase64(24),
    POOLER_TENANT_ID: `${projectSlug}-${randomHex(4)}`,
    LOGFLARE_PUBLIC_ACCESS_TOKEN: randomBase64(24),
    LOGFLARE_PRIVATE_ACCESS_TOKEN: randomBase64(24),
    S3_PROTOCOL_ACCESS_KEY_ID: randomHex(16),
    S3_PROTOCOL_ACCESS_KEY_SECRET: randomHex(32),
    MINIO_ROOT_PASSWORD: randomHex(16),
    DASHBOARD_PASSWORD: randomHex(16),
  };
}

function syncWebEnv() {
  const env = readEnvFile(runtimeEnvPath);
  const publicUrl = env.SUPABASE_PUBLIC_URL || env.API_EXTERNAL_URL || "";

  if (!publicUrl) {
    throw new Error(
      "SUPABASE_PUBLIC_URL or API_EXTERNAL_URL is required before syncing apps/web/.env.local.",
    );
  }

  const webEnv = {
    NEXT_PUBLIC_SUPABASE_URL: publicUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY || "",
    SUPABASE_STORAGE_BUCKET: "document-assets",
    SUPABASE_THUMBNAIL_BUCKET: "document-thumbnails",
  };

  const lines = [
    "# Generated from infra/supabase/runtime/.env.self-host",
    ...Object.entries(webEnv).map(([key, value]) => `${key}=${value}`),
    "",
  ];

  writeFileSync(appEnvPath, lines.join("\n"), "utf8");
}

function prepareOfficialStack() {
  const env = readEnvFile(runtimeEnvPath);
  const outputDir = targetArg
    ? resolve(process.cwd(), targetArg)
    : resolve(runtimeDir, "official-stack");

  if (existsSync(outputDir) && force) {
    rmSync(outputDir, { recursive: true, force: true });
  }

  if (existsSync(outputDir) && readdirSync(outputDir).length > 0) {
    throw new Error(
      `Target directory is not empty: ${outputDir}. Use --force to replace it.`,
    );
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "wenlan-supabase-"));
  const cloneDir = resolve(tempRoot, "supabase");

  runCheckedCommand(
    "git",
    ["clone", "--depth", "1", "https://github.com/supabase/supabase.git", cloneDir],
    tempRoot,
  );

  rmSync(outputDir, { recursive: true, force: true });
  cpSync(resolve(cloneDir, "docker"), outputDir, { recursive: true });

  const officialEnvPath = resolve(outputDir, ".env");
  const officialExampleEnvPath = resolve(outputDir, ".env.example");
  const officialExampleEnv = readFileSync(officialExampleEnvPath, "utf8");
  const mergedEnv = applyEnvUpdates(officialExampleEnv, env);

  writeFileSync(officialEnvPath, mergedEnv, "utf8");

  const wenlanDir = resolve(outputDir, "wenlan");
  mkdirSync(wenlanDir, { recursive: true });
  cpSync(sqlDir, resolve(wenlanDir, "sql"), { recursive: true });
  writeFileSync(
    resolve(wenlanDir, "README-WENLAN.md"),
    buildOfficialStackReadme(outputDir),
    "utf8",
  );

  rmSync(tempRoot, { recursive: true, force: true });
}

function buildOfficialStackReadme(outputDir) {
  return `# Wenlan overlay for Supabase official Docker stack

This directory was prepared from the official Supabase Docker repository and merged with the values in:

- ${runtimeEnvPath}

Prepared output directory:

- ${outputDir}

## Start services

\`\`\`bash
docker compose pull
docker compose up -d
\`\`\`

## Apply Wenlan schema

Linux / macOS:

\`\`\`bash
cat wenlan/sql/001_wenlan_v1_schema.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/002_storage_bootstrap.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/003_postgrest_permissions.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/004_login_content_policies.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/005_document_render_mode.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/006_access_driven_visibility.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/007_document_render_cache.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/009_share_visibility_and_root_documents.sql | docker compose exec -T db psql -U postgres -d postgres
\`\`\`

PowerShell:

\`\`\`powershell
Get-Content wenlan/sql/001_wenlan_v1_schema.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/002_storage_bootstrap.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/003_postgrest_permissions.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/004_login_content_policies.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/005_document_render_mode.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/006_access_driven_visibility.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/007_document_render_cache.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/009_share_visibility_and_root_documents.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
\`\`\`

## Notes

- Before production, edit .env and replace any remaining placeholder values such as SMTP or domain settings.
- Runtime secrets are also backed up in:
  - ${runtimeEnvPath}
  - ${runtimeInventoryPath}
`;
}

function writeSecretInventory(env) {
  const projectName = env.PROJECT_NAME || "wenlan-prod";
  const siteUrl = env.SITE_URL || "";
  const publicUrl = env.SUPABASE_PUBLIC_URL || "";
  const apiUrl = env.API_EXTERNAL_URL || "";
  const postgresDsn =
    env.POSTGRES_PASSWORD && env.POSTGRES_HOST && env.POSTGRES_DB
      ? `postgresql://postgres:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT || "5432"}/${env.POSTGRES_DB}`
      : "";

  const tableLines = inventoryKeys.map(
    (key) => `| ${key} | ${env[key] ?? ""} |  |  |  |`,
  );

  const content = `# Wenlan Supabase Secret Inventory

> Sensitive file. Do not commit.
> Generated from ${runtimeEnvPath}

## Instance Information

- Environment: \`${projectName}\`
- Generated At: ${new Date().toISOString()}
- Server:
- Deployment Directory:
- Owner:

## Core Secrets

| Name | Current Value | Deployed | Backed Up To Password Manager | Notes |
|------|---------------|----------|-------------------------------|-------|
${tableLines.join("\n")}

## Related Information

- Supabase Public URL: ${publicUrl}
- API External URL: ${apiUrl}
- Site URL: ${siteUrl}
- Postgres DSN: ${postgresDsn}
- Storage bucket: ${env.GLOBAL_S3_BUCKET ?? "document-assets"}

## Last Change Record

- Date: ${new Date().toISOString().slice(0, 10)}
- Change: Generated or refreshed local self-host secrets
- Operator: Codex
- Synced To Server:
- Synced To Password Manager:
`;

  writeFileSync(runtimeInventoryPath, content, "utf8");
}

function readEnvFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    env[key] = value;
  }

  return env;
}

function writeEnvFile(filePath, env) {
  const template = readFileSync(runtimeExampleEnvPath, "utf8");
  const content = applyEnvUpdates(template, env);
  writeFileSync(filePath, content, "utf8");
}

function applyEnvUpdates(baseContent, env) {
  let output = baseContent;

  for (const [key, value] of Object.entries(env)) {
    const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");

    if (pattern.test(output)) {
      output = output.replace(pattern, `${key}=${value}`);
    } else {
      output = `${output.trimEnd()}\n${key}=${value}\n`;
    }
  }

  return output.endsWith("\n") ? output : `${output}\n`;
}

function shouldReplaceValue(value) {
  if (!value) {
    return true;
  }

  const lowered = value.toLowerCase();

  return [
    "replace-with",
    "your-",
    "stub",
    "fake_",
    "secret1234",
    "example.com",
    "google_project_",
  ].some((marker) => lowered.includes(marker));
}

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function randomBase64(bytes) {
  return randomBytes(bytes).toString("base64");
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();

  return `${signingInput}.${toBase64Url(signature)}`;
}

function toBase64Url(input) {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");

  return source
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "wenlan";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runCheckedCommand(commandName, args, cwd) {
  const result = spawnSync(commandName, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(
      `${commandName} ${args.join(" ")} failed.\n${result.stdout}\n${result.stderr}`,
    );
  }

  return result;
}
