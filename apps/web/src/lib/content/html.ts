import { createHash } from "node:crypto";

import { load } from "cheerio";

import type { OutlineItem } from "./types";
import { normalizeRoutePath } from "./utils";

const REMOVED_TAGS = new Set([
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

const UNWRAP_TAGS = new Set([
  "html",
  "head",
  "body",
  "main",
  "font",
]);

const ALLOWED_TAGS = new Set([
  "article",
  "section",
  "header",
  "footer",
  "nav",
  "aside",
  "div",
  "span",
  "p",
  "br",
  "hr",
  "blockquote",
  "pre",
  "code",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "mark",
  "small",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "colgroup",
  "col",
  "figure",
  "figcaption",
  "img",
  "picture",
  "source",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

const ALLOWED_ATTRS = new Set([
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
]);

export type HtmlAssetReference = {
  relativePath: string;
  publicUrl: string;
};

export type SanitizedHtmlResult = {
  bodyHtml: string;
  outline: OutlineItem[];
  title: string | null;
  summary: string | null;
  readingTime: string;
};

export type SanitizeDocumentOptions = {
  preserveSourceFormatting?: boolean;
};

const SANITIZE_CACHE_LIMIT = 48;
const sanitizeDocumentCache = new Map<string, SanitizedHtmlResult>();

export function sanitizeDocumentHtml(
  html: string,
  assetReferences: HtmlAssetReference[] = [],
  options: SanitizeDocumentOptions = {},
): SanitizedHtmlResult {
  const cacheKey = buildSanitizeCacheKey(html, assetReferences, options);
  const cachedResult = sanitizeDocumentCache.get(cacheKey);

  if (cachedResult) {
    sanitizeDocumentCache.delete(cacheKey);
    sanitizeDocumentCache.set(cacheKey, cachedResult);
    return cachedResult;
  }

  const $ = load(html);
  const assetMap = new Map(
    assetReferences.map((asset) => [normalizeAssetPath(asset.relativePath), asset.publicUrl] as const),
  );
  const preserveSourceFormatting = Boolean(options.preserveSourceFormatting);
  const sourceStyleHtml = preserveSourceFormatting ? collectSourceStyleHtml($, assetMap) : "";

  $("head style").remove();
  if (preserveSourceFormatting) {
    $("link[rel='stylesheet'], noscript").remove();
  } else {
    $("style, link[rel='stylesheet'], noscript").remove();
  }
  $("*").each((_, element) => {
    const node = element as {
      tagName?: string;
      attribs?: Record<string, string>;
    };
    const tagName = node.tagName?.toLowerCase();

    if (!tagName) {
      return;
    }

    if (tagName === "style") {
      if (preserveSourceFormatting) {
        $(element).text(sanitizeStyleContent($(element).html() ?? "", assetMap));
      } else {
        $(element).remove();
      }
      return;
    }

    if (REMOVED_TAGS.has(tagName)) {
      $(element).remove();
      return;
    }

    if (UNWRAP_TAGS.has(tagName)) {
      $(element).replaceWith($(element).contents());
      return;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      $(element).replaceWith($(element).contents());
      return;
    }

    const attributes = { ...node.attribs };

    for (const [name, value] of Object.entries(attributes)) {
      const attrName = name.toLowerCase();

      if (attrName.startsWith("on")) {
        $(element).removeAttr(name);
        continue;
      }

      if (attrName === "style") {
        if (preserveSourceFormatting) {
          $(element).attr(name, sanitizeStyleContent(String(value), assetMap));
        } else {
          $(element).removeAttr(name);
        }
        continue;
      }

      if (!ALLOWED_ATTRS.has(attrName) && !attrName.startsWith("aria-")) {
        $(element).removeAttr(name);
        continue;
      }

      if (attrName === "href" || attrName === "src") {
        const sanitizedUrl = sanitizeUrl(String(value), assetMap);

        if (sanitizedUrl) {
          $(element).attr(name, sanitizedUrl);
        } else {
          $(element).removeAttr(name);
        }
      }

      if (attrName === "srcset") {
        const sanitizedSrcSet = sanitizeSrcSet(String(value), assetMap);

        if (sanitizedSrcSet) {
          $(element).attr(name, sanitizedSrcSet);
        } else {
          $(element).removeAttr(name);
        }
      }

      if (tagName === "a" && attrName === "target" && value === "_blank") {
        $(element).attr("rel", "noreferrer noopener");
      }
    }
  });

  const outline = buildOutline($);
  const title = readPreferredTitle($);
  const summary = readSummary($);
  const textContent = $("body").text() || $.root().text();

  const result = {
    bodyHtml: [sourceStyleHtml, pickBodyHtml($)].filter(Boolean).join("\n"),
    outline,
    title,
    summary,
    readingTime: estimateReadingTime(textContent),
  };

  setSanitizeCache(cacheKey, result);
  return result;
}

function buildSanitizeCacheKey(
  html: string,
  assetReferences: HtmlAssetReference[],
  options: SanitizeDocumentOptions,
) {
  const preserveSourceFormatting = options.preserveSourceFormatting ? "source" : "normalized";
  const assetSignature = assetReferences
    .map((asset) => `${normalizeAssetPath(asset.relativePath)}=>${asset.publicUrl}`)
    .join("|");

  return createHash("sha1")
    .update(preserveSourceFormatting)
    .update("\n")
    .update(assetSignature)
    .update("\n")
    .update(html)
    .digest("hex");
}

function setSanitizeCache(cacheKey: string, result: SanitizedHtmlResult) {
  sanitizeDocumentCache.set(cacheKey, result);

  if (sanitizeDocumentCache.size <= SANITIZE_CACHE_LIMIT) {
    return;
  }

  const oldestKey = sanitizeDocumentCache.keys().next().value;
  if (oldestKey) {
    sanitizeDocumentCache.delete(oldestKey);
  }
}

function collectSourceStyleHtml($: ReturnType<typeof load>, assetMap: Map<string, string>) {
  return $("head style")
    .toArray()
    .map((node) => {
      const cssText = sanitizeStyleContent($(node).html() ?? "", assetMap);
      return cssText ? `<style>${cssText}</style>` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function sanitizeStyleContent(value: string, assetMap: Map<string, string>) {
  return value
    .replace(/@import\s+[^;]+;/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_match, _quote, rawUrl: string) => {
      const sanitizedUrl = sanitizeUrl(rawUrl, assetMap);
      return sanitizedUrl ? `url("${sanitizedUrl}")` : "url(\"\")";
    });
}

export function parseTagInput(value?: string | null) {
  return [...new Set((value ?? "")
    .split(/[,\n，]/)
    .map((tag) => tag.trim())
    .filter(Boolean))];
}

function pickBodyHtml($: ReturnType<typeof load>) {
  const bodyChildren = $("body").children();

  if (bodyChildren.length > 0) {
    return bodyChildren.toArray().map((node) => $.html(node)).join("\n").trim();
  }

  return $.root().html()?.trim() ?? "";
}

function readPreferredTitle($: ReturnType<typeof load>) {
  const titleText = $("title").first().text().trim();

  if (titleText) {
    return titleText;
  }

  const heading = $("h1, h2").first().text().trim();
  return heading || null;
}

function readSummary($: ReturnType<typeof load>) {
  const summary = $("p")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .find((text) => text.length >= 24);

  return summary ? summary.slice(0, 220) : null;
}

function buildOutline($: ReturnType<typeof load>) {
  const usedIds = new Set<string>();
  const outline: OutlineItem[] = [];

  $("h1, h2, h3, h4").each((index, element) => {
    const label = $(element).text().replace(/\s+/g, " ").trim();

    if (!label) {
      return;
    }

    const existingId = $(element).attr("id");
    const baseId = normalizeOutlineId(existingId || label || `section-${index + 1}`);
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

function normalizeOutlineId(value: string) {
  const normalized = normalizeRoutePath(
    value
      .toLowerCase()
      .replace(/\.html?$/g, "")
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/-+/g, "-"),
  );

  return normalized || "section";
}

function dedupeId(baseId: string, usedIds: Set<string>) {
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function estimateReadingTime(textContent: string) {
  const plainText = textContent.replace(/\s+/g, " ").trim();
  const length = plainText.length;

  if (length === 0) {
    return "1 min";
  }

  return `${Math.max(1, Math.ceil(length / 350))} min`;
}

function normalizeAssetPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}

function sanitizeUrl(value: string, assetMap: Map<string, string>) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("#")) {
    return trimmed;
  }

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^javascript:/i.test(trimmed)) {
    return null;
  }

  const normalized = normalizeAssetPath(trimmed);
  return assetMap.get(normalized) ?? null;
}

function sanitizeSrcSet(value: string, assetMap: Map<string, string>) {
  const candidates = value
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/, 2);
      const rewrittenUrl = sanitizeUrl(url, assetMap);

      if (!rewrittenUrl) {
        return null;
      }

      return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl;
    })
    .filter((item): item is string => Boolean(item));

  return candidates.length > 0 ? candidates.join(", ") : null;
}
