import type { ViewMode } from "./types";

export function toHref(routePath: string) {
  return routePath ? `/${routePath}` : "/";
}

export function formatDate(date: string) {
  return date.replaceAll("-", ".");
}

export function resolveViewMode(view?: string): ViewMode {
  return view === "list" ? "list" : "card";
}

export function normalizeSearchInput(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function buildSearchParams(params: {
  q?: string;
  tag?: string;
  view?: ViewMode;
}) {
  const searchParams = new URLSearchParams();
  const normalizedQuery = normalizeSearchInput(params.q);
  const normalizedTag = normalizeSearchInput(params.tag);

  if (normalizedQuery) {
    searchParams.set("q", normalizedQuery);
  }

  if (normalizedTag) {
    searchParams.set("tag", normalizedTag);
  }

  if (params.view === "list") {
    searchParams.set("view", "list");
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function normalizeRoutePath(routePath: string) {
  return routePath.replace(/^\/+|\/+$/g, "");
}

function decodeRouteSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function normalizeIncomingRoutePath(segments: string[]) {
  return normalizeRoutePath(segments.map(decodeRouteSegment).join("/"));
}

export function buildRoutePath(parts: Array<string | null | undefined>) {
  return normalizeRoutePath(
    parts
      .filter((part): part is string => Boolean(part))
      .join("/"),
  );
}

export function getRoutePrefixes(routePath: string) {
  const normalized = normalizeRoutePath(routePath);

  if (!normalized) {
    return [];
  }

  const segments = normalized.split("/");

  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}
