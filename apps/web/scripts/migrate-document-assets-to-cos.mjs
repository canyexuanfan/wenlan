#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import COS from "cos-nodejs-sdk-v5";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const keepSource = args.has("--keep-source");
const envPath = path.join(process.cwd(), ".env.local");
const env = await readEnvFile(envPath);

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "COS_BUCKET",
  "COS_REGION",
  "COS_SECRET_ID",
  "COS_SECRET_KEY",
];

for (const key of requiredEnv) {
  if (!env[key]) {
    throw new Error(`Missing ${key} in ${envPath}`);
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const cos = new COS({
  SecretId: env.COS_SECRET_ID,
  SecretKey: env.COS_SECRET_KEY,
  Protocol: "https:",
});

const sourceBucket = env.SUPABASE_STORAGE_BUCKET;
const cosBucket = env.COS_BUCKET;
const cosRegion = env.COS_REGION;
const cosPublicBaseUrl = (env.COS_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");

const { data: assets, error: assetsError } = await supabase
  .schema("app")
  .from("document_assets")
  .select("id, document_id, file_name, mime_type, storage_bucket, storage_path, public_url, checksum, size_bytes")
  .neq("storage_bucket", cosBucket)
  .order("created_at", { ascending: true });

if (assetsError) {
  throw assetsError;
}

const backupRows = [];
const migratedAssets = [];
const urlMap = new Map();
const skippedAssets = [];

for (const asset of assets ?? []) {
  if (asset.storage_bucket !== sourceBucket) {
    skippedAssets.push({
      id: asset.id,
      reason: `storage_bucket is ${asset.storage_bucket}, expected ${sourceBucket}`,
    });
    continue;
  }

  const targetKey = asset.storage_path;
  const publicUrl = buildCosPublicUrl(targetKey);
  const probe = {
    id: asset.id,
    document_id: asset.document_id,
    file_name: asset.file_name,
    source_path: asset.storage_path,
    target_bucket: cosBucket,
    target_path: targetKey,
    public_url: publicUrl,
  };

  if (!execute) {
    migratedAssets.push(probe);
    continue;
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(sourceBucket)
    .download(asset.storage_path);

  if (downloadError) {
    throw new Error(`Failed to download ${asset.storage_path}: ${downloadError.message}`);
  }

  const buffer = Buffer.from(await downloaded.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");

  await cos.putObject({
    Bucket: cosBucket,
    Region: cosRegion,
    Key: targetKey,
    Body: buffer,
    ContentLength: buffer.byteLength,
    ContentType: asset.mime_type || "application/octet-stream",
  });

  const { error: updateError } = await supabase
    .schema("app")
    .from("document_assets")
    .update({
      storage_bucket: cosBucket,
      storage_path: targetKey,
      public_url: publicUrl,
      checksum,
      size_bytes: buffer.byteLength,
    })
    .eq("id", asset.id);

  if (updateError) {
    throw updateError;
  }

  if (!keepSource) {
    await supabase.storage.from(sourceBucket).remove([asset.storage_path]);
  }

  migratedAssets.push(probe);
  if (asset.public_url) {
    urlMap.set(asset.public_url, publicUrl);
  }
}

if (execute && urlMap.size > 0) {
  const documentIds = [...new Set(migratedAssets.map((asset) => asset.document_id))];
  const { data: documents, error: documentsError } = await supabase
    .schema("app")
    .from("documents")
    .select("id, body_html, rendered_body_html")
    .in("id", documentIds);

  if (documentsError) {
    throw documentsError;
  }

  for (const document of documents ?? []) {
    const nextBodyHtml = rewriteKnownUrls(document.body_html ?? "", urlMap);
    const nextRenderedBodyHtml = rewriteKnownUrls(document.rendered_body_html ?? "", urlMap);

    if (nextBodyHtml === document.body_html && nextRenderedBodyHtml === document.rendered_body_html) {
      continue;
    }

    backupRows.push({
      id: document.id,
      body_html: document.body_html,
      rendered_body_html: document.rendered_body_html,
    });

    const { error: documentUpdateError } = await supabase
      .schema("app")
      .from("documents")
      .update({
        body_html: nextBodyHtml,
        rendered_body_html: nextRenderedBodyHtml,
      })
      .eq("id", document.id);

    if (documentUpdateError) {
      throw documentUpdateError;
    }
  }
}

if (execute && backupRows.length > 0) {
  const backupDir = path.join(process.cwd(), ".migration-backups");
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `document-html-${Date.now()}.jsonl`);
  await writeFile(backupPath, backupRows.map((row) => JSON.stringify(row)).join("\n"), "utf8");
  console.log(`Document HTML backup: ${backupPath}`);
}

console.log(
  JSON.stringify(
    {
      mode: execute ? "execute" : "dry-run",
      sourceBucket,
      targetBucket: cosBucket,
      assetsFound: assets?.length ?? 0,
      assetsToMigrate: migratedAssets.length,
      skippedAssets,
      rewrittenDocuments: backupRows.length,
      keepSource,
    },
    null,
    2,
  ),
);

async function readEnvFile(filePath) {
  const content = await readFile(filePath, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function buildCosPublicUrl(key) {
  const baseUrl = cosPublicBaseUrl || `https://${cosBucket}.cos.${cosRegion}.myqcloud.com`;
  return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function rewriteKnownUrls(html, replacements) {
  let nextHtml = html;

  for (const [fromUrl, toUrl] of replacements.entries()) {
    nextHtml = nextHtml.split(fromUrl).join(toUrl);
    nextHtml = nextHtml.split(escapeHtmlAttribute(fromUrl)).join(escapeHtmlAttribute(toUrl));
  }

  return nextHtml;
}

function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
