import "server-only";

import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AccountRecentViewItem = {
  id: string;
  targetType: "folder" | "document";
  targetId: string;
  routePath: string;
  title: string;
  description: string;
  contextTitle: string | null;
  visitedAt: string;
};

export type AccountFavoriteItem = {
  id: string;
  targetType: "folder" | "document";
  targetId: string;
  routePath: string;
  title: string;
  description: string;
  contextTitle: string | null;
  favoritedAt: string;
};

type RecentViewRow = Database["app"]["Tables"]["user_recent_views"]["Row"];
type FavoriteRow = Database["app"]["Tables"]["user_favorites"]["Row"];

export type AccountTargetSnapshot = {
  contextTitle: string | null;
  description: string;
  routePath: string;
  title: string;
};

function toRecentViewItem(row: RecentViewRow): AccountRecentViewItem {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    routePath: row.route_path,
    title: row.title,
    description: row.description ?? "",
    contextTitle: row.context_title,
    visitedAt: row.visited_at,
  };
}

function toFavoriteItem(row: FavoriteRow): AccountFavoriteItem {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    routePath: row.route_path,
    title: row.title,
    description: row.description ?? "",
    contextTitle: row.context_title,
    favoritedAt: row.favorited_at,
  };
}

export async function resolveAccountTargetSnapshot(
  targetType: "folder" | "document",
  targetId: string,
): Promise<AccountTargetSnapshot | null> {
  const adminClient = createSupabaseAdminClient();

  if (targetType === "folder") {
    const { data, error } = await adminClient
      .schema("app")
      .from("folders")
      .select("id, name, route_path, description, hero_note")
      .eq("id", targetId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      contextTitle: null,
      description: data.description ?? data.hero_note ?? "",
      routePath: data.route_path,
      title: data.name,
    };
  }

  const { data, error } = await adminClient
    .schema("app")
    .from("documents")
    .select("id, title, route_path, summary, folder_id")
    .eq("id", targetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  let contextTitle: string | null = null;

  if (data.folder_id) {
    const { data: folder, error: folderError } = await adminClient
      .schema("app")
      .from("folders")
      .select("name")
      .eq("id", data.folder_id)
      .maybeSingle();

    if (folderError) {
      throw folderError;
    }

    contextTitle = folder?.name ?? null;
  }

  return {
    contextTitle,
    description: data.summary ?? "",
    routePath: data.route_path,
    title: data.title,
  };
}

async function filterVisibleItems<
  T extends { targetId: string; targetType: "folder" | "document" },
>(items: T[]) {
  if (items.length === 0) {
    return items;
  }

  const client = await createSupabaseServerClient();
  const folderIds = items
    .filter((item) => item.targetType === "folder")
    .map((item) => item.targetId);
  const documentIds = items
    .filter((item) => item.targetType === "document")
    .map((item) => item.targetId);

  const [visibleFoldersResult, visibleDocumentsResult] = await Promise.all([
    folderIds.length > 0
      ? client
          .schema("app")
          .from("folders")
          .select("id")
          .in("id", folderIds)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
    documentIds.length > 0
      ? client
          .schema("app")
          .from("documents")
          .select("id")
          .in("id", documentIds)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
  ]);

  if (visibleFoldersResult.error) {
    throw visibleFoldersResult.error;
  }

  if (visibleDocumentsResult.error) {
    throw visibleDocumentsResult.error;
  }

  const visibleFolderIds = new Set(visibleFoldersResult.data.map((row) => row.id));
  const visibleDocumentIds = new Set(visibleDocumentsResult.data.map((row) => row.id));

  return items.filter((item) =>
    item.targetType === "folder"
      ? visibleFolderIds.has(item.targetId)
      : visibleDocumentIds.has(item.targetId),
  );
}

export const getAccountRecentViews = cache(async function getAccountRecentViews(
  userId: string,
  limit?: number,
) {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .schema("app")
    .from("user_recent_views")
    .select(
      "id, user_id, target_type, target_id, route_path, title, description, context_title, visited_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("visited_at", { ascending: false });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data.map(toRecentViewItem);
});

export const getAccountFavorites = cache(async function getAccountFavorites(
  userId: string,
  limit?: number,
) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("user_favorites")
    .select(
      "id, user_id, target_type, target_id, route_path, title, description, context_title, favorited_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("favorited_at", { ascending: false });

  if (error) {
    throw error;
  }

  const visibleItems = await filterVisibleItems(data.map(toFavoriteItem));
  return typeof limit === "number" ? visibleItems.slice(0, limit) : visibleItems;
});

export const isAccountFavorite = cache(async function isAccountFavorite(
  userId: string,
  targetType: "folder" | "document",
  targetId: string,
) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("user_favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
});

export async function addAccountFavorite(
  userId: string,
  targetType: "folder" | "document",
  targetId: string,
) {
  const snapshot = await resolveAccountTargetSnapshot(targetType, targetId);

  if (!snapshot) {
    return null;
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .schema("app")
    .from("user_favorites")
    .upsert(
      {
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        route_path: snapshot.routePath,
        title: snapshot.title,
        description: snapshot.description,
        context_title: snapshot.contextTitle,
        favorited_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,target_type,target_id",
      },
    );

  if (error) {
    throw error;
  }

  return snapshot;
}

export async function removeAccountFavorite(
  userId: string,
  targetType: "folder" | "document",
  targetId: string,
) {
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .schema("app")
    .from("user_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) {
    throw error;
  }
}
