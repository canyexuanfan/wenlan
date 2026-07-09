import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import COS from "cos-nodejs-sdk-v5";
import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const defaultLogDir = path.join(appRoot, ".codex-logs");
const siteBaseUrl = "https://wenlan.hnwen17.top";

const removedTags = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "meta",
  "base",
]);

const allowedAttrs = new Set([
  "id",
  "class",
  "title",
  "lang",
  "dir",
  "role",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-hidden",
  "aria-current",
  "alt",
  "width",
  "height",
  "colspan",
  "rowspan",
  "scope",
  "target",
  "rel",
  "href",
  "src",
  "srcset",
  "data-feishu-token",
]);

const feishuImportDisplayStyle = `<style data-feishu-import-style>
.feishu-import-body {
  box-sizing: border-box;
  color: #1f2329;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.78;
  overflow-wrap: break-word;
  word-break: normal;
}
.feishu-import-body * {
  box-sizing: border-box;
}
.feishu-import-body p {
  margin: 0.68em 0;
}
.feishu-import-body h1,
.feishu-import-body h2,
.feishu-import-body h3,
.feishu-import-body h4,
.feishu-import-body h5,
.feishu-import-body h6 {
  color: #1f2329;
  font-weight: 700;
  line-height: 1.35;
  margin: 1.4em 0 0.65em;
}
.feishu-import-body h1 { font-size: 1.85em; }
.feishu-import-body h2 { font-size: 1.45em; }
.feishu-import-body h3 { font-size: 1.22em; }
.feishu-import-body a {
  color: #3370ff;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-decoration: none;
}
.feishu-import-body a:hover {
  text-decoration: underline;
}
.feishu-import-body img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px 0;
  border: 0;
  border-radius: 2px;
  box-shadow: none;
}
.feishu-import-body ul,
.feishu-import-body ol {
  margin: 0.7em 0;
  padding-left: 1.7em;
}
.feishu-import-body li {
  margin: 0.28em 0;
  padding-left: 0.1em;
}
.feishu-import-body blockquote {
  margin: 1em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 3px solid #bbbfc4;
  color: #646a73;
  background: transparent;
}
.feishu-import-body .feishu-callout {
  display: flex;
  gap: 10px;
  margin: 14px 0;
  padding: 12px 14px;
  border: 1px solid #f3d57a;
  border-radius: 8px;
  background: #fffbe6;
}
.feishu-import-body .feishu-callout-emoji {
  flex: 0 0 auto;
}
.feishu-import-body .feishu-callout-content {
  min-width: 0;
  flex: 1 1 auto;
}
.feishu-import-body .feishu-callout-content > :first-child {
  margin-top: 0;
}
.feishu-import-body .feishu-callout-content > :last-child {
  margin-bottom: 0;
}
.feishu-import-body .feishu-grid {
  display: flex;
  gap: 14px;
  margin: 14px 0;
}
.feishu-import-body .feishu-column {
  min-width: 0;
  flex: 1 1 0;
}
@media (max-width: 720px) {
  .feishu-import-body .feishu-grid {
    flex-direction: column;
  }
}
.feishu-import-body code {
  padding: 0.1em 0.35em;
  border-radius: 3px;
  background: #f2f3f5;
  color: #1f2329;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
}
.feishu-import-body pre {
  max-width: 100%;
  overflow-x: auto;
  padding: 12px 14px;
  border-radius: 6px;
  background: #f7f8fa;
}
.feishu-import-body .feishu-table-scroll {
  width: 100%;
  max-width: 100%;
  margin: 12px 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.feishu-import-body table.feishu-table {
  width: max-content !important;
  min-width: 100% !important;
  max-width: none !important;
  table-layout: auto !important;
  border-collapse: collapse !important;
  border-spacing: 0 !important;
  font-size: 15px !important;
  line-height: 1.65 !important;
  box-shadow: none !important;
}
.feishu-import-body table.feishu-table th,
.feishu-import-body table.feishu-table td {
  min-width: 120px;
  max-width: 720px;
  padding: 10px 12px !important;
  border: 1px solid #dee0e3 !important;
  background: #fff !important;
  color: #1f2329 !important;
  vertical-align: top !important;
  white-space: normal !important;
  overflow-wrap: break-word !important;
  word-break: normal !important;
}
.feishu-import-body table.feishu-table th {
  background: #f5f6f7 !important;
  font-weight: 600 !important;
}
.feishu-import-body table.feishu-table td:first-child,
.feishu-import-body table.feishu-table th:first-child {
  min-width: 180px;
}
.source-document-frame .feishu-import-body,
.source-document-page .feishu-import-body {
  margin: 0;
}
</style>`;

async function main() {
  const [mode, ...argv] = process.argv.slice(2);
  const args = parseArgs(argv);

  if (mode === "build") {
    return buildPayload(args);
  }

  if (mode === "apply") {
    return applyPayload(args);
  }

  console.error(
    "Usage: node scripts/import-feishu-doc.mjs <build|apply> --doc-url URL --target-folder-route ROUTE [--access-mode login] [--render-mode source|site] [--link-map token=url,...] [--input file] [--output file]",
  );
  process.exit(1);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    parsed[arg.slice(2)] = args[index + 1];
    index += 1;
  }
  return parsed;
}

function buildPayload(args) {
  const docUrl = requiredArg(args, "doc-url");
  const targetFolderRoute = normalizeRoutePath(requiredArg(args, "target-folder-route"));
  const outputPath = args.output
    ? path.resolve(args.output)
    : path.join(defaultLogDir, `feishu-doc-import-${Date.now()}.json`);
  const sourceToken = extractFeishuDocToken(docUrl);

  if (!sourceToken) {
    throw new Error(`Cannot extract Feishu doc token from ${docUrl}`);
  }

  const xml = fetchFeishuDocument(docUrl, args.profile);
  const title = readDocumentTitle(xml) || args.title || sourceToken;
  const routePath = buildRoutePath(targetFolderRoute, sanitizeSlug(title));
  const targetUrl = toPublicUrl(routePath);
  const linkMap = new Map([
    [sourceToken, targetUrl],
    [stripUrlHashAndQuery(docUrl), targetUrl],
    ...parseLinkMap(args["link-map"]),
  ]);
  const transformed = transformFeishuXml(xml, linkMap, title, { profile: args.profile });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      url: docUrl,
      token: sourceToken,
    },
    target: {
      folderRoute: targetFolderRoute,
      routePath,
      url: targetUrl,
      accessMode: normalizeAccessMode(args["access-mode"] || "login"),
      renderMode: normalizeRenderMode(args["render-mode"] || "site"),
    },
    document: {
      title,
      slug: routePath.split("/").at(-1),
      routePath,
      sourceUrl: docUrl,
      summary: transformed.summary,
      readingTime: transformed.readingTime,
      bodyHtml: transformed.html,
      outline: transformed.outline,
      imageCount: transformed.imageCount,
      rewrittenLinks: transformed.rewrittenLinks,
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(JSON.stringify({
    outputPath,
    title,
    routePath,
    targetUrl,
    imageCount: transformed.imageCount,
    rewrittenLinks: transformed.rewrittenLinks,
    renderMode: payload.target.renderMode,
  }, null, 2));
}

async function applyPayload(args) {
  const payloadPath = args.input ? path.resolve(args.input) : null;
  if (!payloadPath) {
    throw new Error("--input is required for apply mode.");
  }

  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const env = loadEnvFile(process.env.WENLAN_ENV_FILE || "/opt/docker/wenlan-web/wenlan-web.env");
  const supabaseUrl = env.SUPABASE_SERVER_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const app = supabase.schema("app");
  const storage = createStorage(env, supabase);
  const folder = await getFolderByRoute(app, payload.target.folderRoute);

  if (!folder) {
    throw new Error(`Target folder not found: ${payload.target.folderRoute}`);
  }

  const existing = await getDocumentByRoute(app, payload.document.routePath);
  const documentId = existing?.id ?? randomUUID();
  const assetResult = await rewriteAndUploadImages({
    html: payload.document.bodyHtml,
    documentId,
    storage,
    sourcePath: payload.document.sourceUrl,
  });
  const assetErrors = [...assetResult.errors];
  const htmlAsset = await uploadHtmlSource({
    htmlText: buildStandaloneHtml(payload.document.title, assetResult.html),
    documentId,
    fileName: `${sanitizeFileName(payload.document.title)}.html`,
    storage,
  });
  const displayHtml = prepareImportedHtmlForDisplay(assetResult.html);
  const renderMode = normalizeRenderMode(payload.target.renderMode || args["render-mode"] || "site");
  const now = new Date().toISOString();
  const row = {
    folder_id: folder.id,
    title: payload.document.title,
    slug: payload.document.slug,
    route_path: payload.document.routePath,
    summary: payload.document.summary || null,
    source_type: "html",
    render_mode: renderMode,
    publish_status: "published",
    access_mode: normalizeAccessMode(payload.target.accessMode || args["access-mode"] || "login"),
    version: existing ? (existing.version ?? 0) + 1 : 1,
    body_html: renderMode === "source"
      ? buildStandaloneHtml(payload.document.title, assetResult.html)
      : displayHtml,
    rendered_body_html: displayHtml,
    author_name: "Feishu Import",
    reading_time: payload.document.readingTime || estimateReadingTime(assetResult.html),
    is_featured: false,
    published_at: existing?.published_at || now,
  };

  if (existing) {
    const { error } = await app.from("documents").update(row).eq("id", existing.id);
    if (error) {
      throw error;
    }
  } else {
    row.id = documentId;
    row.order_index = await getNextOrder(app, "documents", "folder_id", folder.id);
    const { error } = await app.from("documents").insert(row);
    if (error) {
      throw error;
    }
  }

  await replaceOutline(app, documentId, payload.document.outline ?? []);
  await replaceAssets(app, documentId, [htmlAsset, ...assetResult.assets], payload.document.sourceUrl, assetErrors);

  console.log(JSON.stringify({
    action: existing ? "updated" : "created",
    documentId,
    routePath: payload.document.routePath,
    url: toPublicUrl(payload.document.routePath),
    accessMode: row.access_mode,
    renderMode: row.render_mode,
    uploadedAssets: assetResult.uploaded + 1,
    assetErrors,
  }, null, 2));
}

function requiredArg(args, name) {
  if (!args[name]) {
    throw new Error(`--${name} is required.`);
  }
  return args[name];
}

function fetchFeishuDocument(url, profile) {
  const profileArgs = profile ? ["--profile", profile] : [];
  const stdout = execFileSync(
    "node",
    [
      resolveLarkCliRunner(),
      "docs",
      "+fetch",
      "--api-version",
      "v2",
      "--doc",
      url,
      "--format",
      "json",
      ...profileArgs,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    },
  );
  const parsed = JSON.parse(stdout);
  const content = parsed.data?.document?.content || parsed.document?.content;

  if (!content) {
    throw new Error(`Empty Feishu document response for ${url}`);
  }

  return content;
}

function readDocumentTitle(xml) {
  const $ = load(`<article>${xml}</article>`, { decodeEntities: false });
  return $("title").first().text().replace(/\s+/g, " ").trim();
}

function resolveFeishuImageSource(imageUrl, token, profile) {
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  if (!token) {
    return imageUrl || "";
  }

  return downloadFeishuMediaAsDataUrl(token, profile);
}

function downloadFeishuMediaAsDataUrl(token, profile) {
  const mediaDir = path.join(defaultLogDir, "feishu-media");
  fs.mkdirSync(mediaDir, { recursive: true });
  const outputBase = path.join(mediaDir, sanitizeFileName(token));
  const profileArgs = profile ? ["--profile", profile] : [];
  const stdout = execFileSync(
    "node",
    [
      resolveLarkCliRunner(),
      "docs",
      "+media-download",
      "--token",
      token,
      "--output",
      outputBase,
      "--overwrite",
      ...profileArgs,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 16,
    },
  );
  const parsed = JSON.parse(stdout);

  if (!parsed.ok) {
    throw new Error(parsed.error?.message || `Failed to download Feishu media ${token}`);
  }

  const outputPath = findDownloadedMediaFile(outputBase, parsed);
  const buffer = fs.readFileSync(outputPath);
  const mimeType = mimeTypeFromExtension(path.extname(outputPath)) || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function findDownloadedMediaFile(outputBase, parsed) {
  const candidates = [
    parsed.data?.path,
    parsed.data?.output,
    parsed.output,
    parsed.path,
    outputBase,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const absolutePath = path.resolve(candidate);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  const dir = path.dirname(outputBase);
  const baseName = path.basename(outputBase);
  const matched = fs
    .readdirSync(dir)
    .map((entry) => path.join(dir, entry))
    .filter((entry) => path.basename(entry).startsWith(baseName) && fs.statSync(entry).isFile())
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];

  if (!matched) {
    throw new Error(`Downloaded Feishu media file not found for ${outputBase}`);
  }

  return matched;
}

function transformFeishuXml(xml, linkMap, title, options = {}) {
  const $ = load(`<article class="feishu-import-body">${xml}</article>`, {
    decodeEntities: false,
  });
  let rewrittenLinks = 0;
  let imageCount = 0;

  $("title").remove();
  for (const tagName of removedTags) {
    $(tagName).remove();
  }

  $("source,file").each((_, element) => {
    const href = $(element).attr("href") || $(element).attr("url");
    const name = $(element).attr("name") || $(element).text().trim() || "attachment";

    if (href) {
      $(element).replaceWith(`<a href="${escapeHtmlAttribute(href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(name)}</a>`);
    } else {
      $(element).replaceWith(`<span>${escapeHtml(name)}</span>`);
    }
  });

  $("cite").each((_, element) => {
    const type = $(element).attr("type");
    const token = $(element).attr("token") || $(element).attr("doc-id");

    if (type !== "doc" || !token) {
      return;
    }

    const label = $(element).attr("title") || $(element).text().trim() || "相关文档";
    const target = linkMap.get(token);
    if (target) {
      $(element).replaceWith(`<a href="${escapeHtmlAttribute(target)}">${escapeHtml(label)}</a>`);
    } else {
      $(element).replaceWith(`<span>${escapeHtml(label)}</span>`);
    }
  });

  $("img").each((_, element) => {
    const imageUrl = $(element).attr("href") || $(element).attr("url") || $(element).attr("src");
    const token = $(element).attr("src") || $(element).attr("token");
    const name = $(element).attr("name") || "image";
    const resolvedImageUrl = resolveFeishuImageSource(imageUrl, token, options.profile);
    if (resolvedImageUrl) {
      $(element).attr("src", resolvedImageUrl);
      $(element).attr("alt", name);
      if (token) {
        $(element).attr("data-feishu-token", token);
      }
      imageCount += 1;
    }
  });

  $("grid").each((_, element) => {
    $(element).replaceWith(`<div class="feishu-grid">${$(element).html() || ""}</div>`);
  });

  $("column").each((_, element) => {
    $(element).replaceWith(`<div class="feishu-column">${$(element).html() || ""}</div>`);
  });

  $("callout").each((_, element) => {
    const emoji = $(element).attr("emoji") || "💡";
    $(element).replaceWith(
      `<div class="feishu-callout"><span class="feishu-callout-emoji">${escapeHtml(emoji)}</span><div class="feishu-callout-content">${$(element).html() || ""}</div></div>`,
    );
  });

  $("a").each((_, element) => {
    const href = $(element).attr("href");
    const rewritten = rewriteFeishuHref(href, linkMap);
    if (rewritten && rewritten !== href) {
      $(element).attr("href", rewritten);
      rewrittenLinks += 1;
    }
    if (/^https?:\/\//i.test($(element).attr("href") ?? "")) {
      $(element).attr("target", "_blank");
      $(element).attr("rel", "noreferrer noopener");
    }
  });

  $("*").each((_, element) => {
    const attribs = element.attribs ?? {};
    for (const [name, value] of Object.entries({ ...attribs })) {
      const attrName = name.toLowerCase();
      if (attrName.startsWith("on") || attrName === "style") {
        $(element).removeAttr(name);
        continue;
      }
      if (!allowedAttrs.has(attrName) && !attrName.startsWith("aria-")) {
        $(element).removeAttr(name);
        continue;
      }
      if ((attrName === "href" || attrName === "src") && /^javascript:/i.test(String(value).trim())) {
        $(element).removeAttr(name);
      }
    }
  });

  const article = $("article").first();
  const outline = buildOutline($, article);
  const sourceHtml = article.html()?.trim() || "<p></p>";
  const text = article.text().replace(/\s+/g, " ").trim();
  const summary = $("p")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .find((item) => item.length >= 24);

  return {
    title,
    html: sourceHtml,
    outline,
    summary: summary ? summary.slice(0, 220) : "",
    readingTime: estimateReadingTime(text),
    imageCount,
    rewrittenLinks,
  };
}

function prepareImportedHtmlForDisplay(html) {
  const $ = load(`<article>${html || ""}</article>`, { decodeEntities: false });
  const article = $("article").first();
  article.find("style[data-feishu-import-style]").remove();

  article.find("table").each((_, element) => {
    const table = $(element);
    if (!table.parent().hasClass("feishu-table-scroll")) {
      table.wrap('<div class="feishu-table-scroll"></div>');
    }
    table.addClass("feishu-table");
    table.removeAttr("style");
    table.find("td, th").each((_, cell) => {
      $(cell).removeAttr("style");
    });
  });

  article.find("a").each((_, element) => {
    const link = $(element);
    const href = link.attr("href");
    if (href && /^https?:\/\//i.test(href)) {
      link.attr("target", "_blank");
      link.attr("rel", "noreferrer noopener");
    }
  });

  const bodyHtml = article.html()?.trim() || "";
  return `${feishuImportDisplayStyle}\n${bodyHtml}`;
}

function buildStandaloneHtml(title, bodyHtml) {
  const displayHtml = prepareImportedHtmlForDisplay(bodyHtml);
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.75;margin:0;padding:32px;color:#2f2a25;background:#fffaf3}",
    "article{max-width:860px;margin:0 auto;background:#fff;padding:32px;border:1px solid #eadfce;border-radius:8px}",
    "img{max-width:100%;height:auto}",
    "table{border-collapse:collapse;width:100%;overflow:auto}",
    "td,th{border:1px solid #e5d8c6;padding:8px;vertical-align:top}",
    "pre{overflow:auto;background:#f8f3eb;padding:12px;border-radius:6px}",
    "code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}",
    "a{color:#b45a2a}",
    "</style>",
    "</head>",
    "<body>",
    `<article class="feishu-import-body">${displayHtml || "<p></p>"}</article>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

async function rewriteAndUploadImages({ html, documentId, storage, sourcePath }) {
  const $ = load(`<article>${html}</article>`, { decodeEntities: false });
  const assets = [];
  const errors = [];
  let uploaded = 0;
  const images = $("img").toArray();

  for (let index = 0; index < images.length; index += 1) {
    const element = images[index];
    const src = $(element).attr("src");
    if (!src) {
      continue;
    }

    try {
      const imageData = await readImportImageData(src);
      if (!imageData) {
        continue;
      }
      const { mimeType, buffer } = imageData;
      const extension = extensionFromMimeType(mimeType);
      const fileName = `${String(index + 1).padStart(3, "0")}-${sanitizeFileName($(element).attr("alt") || "image")}${extension}`;
      const key = `documents/${documentId}/assets/${fileName}`;
      const uploadedObject = await storage.upload({
        key,
        body: buffer,
        contentType: mimeType,
      });
      const checksum = createHash("sha256").update(buffer).digest("hex");
      $(element).attr("src", uploadedObject.publicUrl);
      $(element).removeAttr("href");
      $(element).removeAttr("data-feishu-token");
      assets.push({
        fileName,
        mimeType,
        checksum,
        sizeBytes: buffer.byteLength,
        isEntry: false,
        ...uploadedObject,
      });
      uploaded += 1;
    } catch (error) {
      errors.push({
        sourcePath,
        image: src,
        message: normalizeError(error),
      });
    }
  }

  return {
    html: $("article").first().html()?.trim() || html,
    assets,
    uploaded,
    errors,
  };
}

async function readImportImageData(src) {
  if (/^data:/i.test(src)) {
    const match = src.match(/^data:([^;,]+)(;base64)?,(.*)$/is);
    if (!match) {
      throw new Error("Invalid data URL");
    }

    const mimeType = match[1] || "image/png";
    const buffer = match[2]
      ? Buffer.from(match[3], "base64")
      : Buffer.from(decodeURIComponent(match[3]), "utf8");
    return { mimeType, buffer };
  }

  if (!/^https?:\/\//i.test(src) || !/feishu\.cn|larksuite\.com/i.test(src)) {
    return null;
  }

  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { mimeType, buffer };
}

async function uploadHtmlSource({ htmlText, documentId, fileName, storage }) {
  const body = Buffer.from(htmlText || "", "utf8");
  const key = `documents/${documentId}/${fileName}`;
  const uploadedObject = await storage.upload({
    key,
    body,
    contentType: "text/html; charset=utf-8",
  });

  return {
    fileName,
    mimeType: "text/html",
    checksum: createHash("sha256").update(body).digest("hex"),
    sizeBytes: body.byteLength,
    isEntry: true,
    ...uploadedObject,
  };
}

function createStorage(env, supabase) {
  const driver = env.DOCUMENT_STORAGE_DRIVER === "cos" ? "cos" : "supabase";
  const bucket = driver === "cos" ? env.COS_BUCKET : env.SUPABASE_STORAGE_BUCKET || "document-assets";

  if (driver === "cos") {
    const cos = new COS({
      SecretId: env.COS_SECRET_ID,
      SecretKey: env.COS_SECRET_KEY,
      Protocol: "https:",
    });
    const region = env.COS_REGION;
    const publicBaseUrl = (env.COS_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    return {
      async upload(input) {
        await cos.putObject({
          Bucket: bucket,
          Region: region,
          Key: input.key,
          Body: input.body,
          ContentLength: input.body.byteLength,
          ContentType: input.contentType,
        });
        const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
        return {
          bucket,
          key: input.key,
          publicUrl: `${publicBaseUrl || `https://${bucket}.cos.${region}.myqcloud.com`}/${encodedKey}`,
        };
      },
    };
  }

  return {
    async upload(input) {
      const { error } = await supabase.storage.from(bucket).upload(input.key, input.body, {
        upsert: true,
        contentType: input.contentType,
      });
      if (error) {
        throw error;
      }
      return {
        bucket,
        key: input.key,
        publicUrl: supabase.storage.from(bucket).getPublicUrl(input.key).data.publicUrl,
      };
    },
  };
}

async function getFolderByRoute(app, routePath) {
  const { data, error } = await app
    .from("folders")
    .select("id, route_path")
    .eq("route_path", routePath)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

async function getDocumentByRoute(app, routePath) {
  const { data, error } = await app
    .from("documents")
    .select("id, route_path, version, published_at")
    .eq("route_path", routePath)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

async function getNextOrder(app, tableName, parentColumn, parentId) {
  const { data, error } = await app
    .from(tableName)
    .select("order_index")
    .eq(parentColumn, parentId)
    .order("order_index", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data[0]?.order_index ?? 0) + 1;
}

async function replaceOutline(app, documentId, outline) {
  const { error: deleteError } = await app
    .from("document_outlines")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw deleteError;
  }

  if (!outline.length) {
    return;
  }

  const { error } = await app.from("document_outlines").insert(
    outline.map((item, index) => ({
      document_id: documentId,
      level: item.level,
      text: item.label,
      anchor: item.id,
      order_index: index + 1,
    })),
  );

  if (error) {
    throw error;
  }
}

async function replaceAssets(app, documentId, assets, sourcePath, assetErrors) {
  const { error: deleteError } = await app
    .from("document_assets")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    assetErrors.push({
      sourcePath,
      message: deleteError.message,
    });
    return;
  }

  if (!assets.length) {
    return;
  }

  const { error: insertError } = await app.from("document_assets").insert(
    assets.map((asset) => ({
      document_id: documentId,
      file_name: asset.fileName,
      mime_type: asset.mimeType,
      storage_bucket: asset.bucket,
      storage_path: asset.key,
      public_url: asset.publicUrl,
      checksum: asset.checksum,
      size_bytes: asset.sizeBytes,
      is_entry: Boolean(asset.isEntry),
    })),
  );

  if (insertError) {
    assetErrors.push({
      sourcePath,
      message: insertError.message,
    });
  }
}

function buildOutline($, root) {
  const usedIds = new Set();
  const outline = [];

  root.find("h1, h2, h3, h4").each((index, element) => {
    const label = $(element).text().replace(/\s+/g, " ").trim();
    if (!label) {
      return;
    }
    const baseId = sanitizeSlug($(element).attr("id") || label || `section-${index + 1}`);
    const id = dedupeId(baseId, usedIds);
    usedIds.add(id);
    $(element).attr("id", id);
    outline.push({
      id,
      label,
      level: Number(element.tagName.slice(1)),
    });
  });

  return outline;
}

function rewriteFeishuHref(href, linkMap) {
  if (!href) {
    return null;
  }

  const token = extractFeishuDocToken(href);
  if (!token) {
    return href;
  }

  const target = linkMap.get(token) || linkMap.get(stripUrlHashAndQuery(href));
  if (!target) {
    return href;
  }

  const hash = readUrlHash(href);
  return hash ? `${target}${hash}` : target;
}

function extractFeishuDocToken(value) {
  const match = String(value).match(/\/(?:docx|doc)\/([A-Za-z0-9]+)/i);
  return match?.[1] ?? null;
}

function stripUrlHashAndQuery(value) {
  return String(value).split("#")[0].split("?")[0];
}

function readUrlHash(value) {
  const hashIndex = String(value).indexOf("#");
  return hashIndex >= 0 ? String(value).slice(hashIndex) : "";
}

function dedupeId(baseId, usedIds) {
  if (!usedIds.has(baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

function sanitizeSlug(value) {
  const normalized = normalizeRoutePath(
    String(value)
      .trim()
      .toLowerCase()
      .replace(/\.html?$/g, "")
      .replace(/[^a-z0-9\-_\u4e00-\u9fa5]+/g, "-")
      .replace(/-+/g, "-"),
  );
  return normalized || "item";
}

function normalizeRoutePath(routePath) {
  return String(routePath).replace(/^\/+|\/+$/g, "");
}

function buildRoutePath(...parts) {
  return normalizeRoutePath(parts.filter(Boolean).join("/"));
}

function toPublicUrl(routePath) {
  return `${siteBaseUrl}/${routePath.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeAccessMode(value) {
  const mode = String(value || "login").trim();
  const allowed = new Set(["inherit", "draft", "public", "share", "login", "private", "specific_users", "group"]);
  if (!allowed.has(mode)) {
    throw new Error(`Unsupported access mode: ${value}`);
  }
  return mode;
}

function normalizeRenderMode(value) {
  const mode = String(value || "source").trim();
  if (mode !== "source" && mode !== "site") {
    throw new Error(`Unsupported render mode: ${value}`);
  }
  return mode;
}

function parseLinkMap(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("=");
      if (separator < 0) {
        throw new Error(`Invalid --link-map entry: ${entry}`);
      }
      return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
    });
}

function estimateReadingTime(textOrHtml) {
  const text = String(textOrHtml).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return `${Math.max(1, Math.ceil(text.length / 350))} min`;
}

function extensionFromMimeType(mimeType) {
  if (mimeType.includes("jpeg")) return ".jpg";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("gif")) return ".gif";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("svg")) return ".svg";
  return ".bin";
}

function mimeTypeFromExtension(extension) {
  const ext = extension.toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "";
}

function sanitizeFileName(value) {
  const base = String(value)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
  return base || "image";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function loadEnvFile(envPath) {
  const result = {};
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index < 0) {
      continue;
    }
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return { ...result, ...process.env };
}

function resolveLarkCliRunner() {
  const windowsRunner = "C:\\Users\\wzm33\\AppData\\Roaming\\npm\\node_modules\\@larksuite\\cli\\scripts\\run.js";
  if (process.platform === "win32" && fs.existsSync(windowsRunner)) {
    return windowsRunner;
  }
  return process.env.LARK_CLI_RUNNER || "lark-cli";
}

Promise.resolve(main()).catch((error) => {
  console.error(normalizeError(error));
  process.exit(1);
});
