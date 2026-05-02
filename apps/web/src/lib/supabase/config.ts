export const supabaseEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "document-assets",
  thumbnailBucket:
    process.env.SUPABASE_THUMBNAIL_BUCKET ?? "document-thumbnails",
  forceMock:
    process.env.NEXT_PUBLIC_FORCE_MOCK === "true" ||
    process.env.WENLAN_FORCE_MOCK === "true",
};

export function hasSupabaseCredentials() {
  return Boolean(supabaseEnv.url && supabaseEnv.anonKey);
}

export function isMockModeForced() {
  return supabaseEnv.forceMock;
}

export function isSupabaseConfigured() {
  return hasSupabaseCredentials() && !isMockModeForced();
}

export function assertSupabaseConfigured() {
  if (isMockModeForced()) {
    throw new Error(
      "当前处于强制 mock 模式，请先关闭 NEXT_PUBLIC_FORCE_MOCK 或 WENLAN_FORCE_MOCK，再连接 Supabase。",
    );
  }

  if (!isSupabaseConfigured()) {
    throw new Error(
      "缺少 Supabase 环境变量，请先填写 apps/web/.env.local 中的 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。",
    );
  }
}

export function assertServiceRoleConfigured() {
  assertSupabaseConfigured();

  if (!supabaseEnv.serviceRoleKey) {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY。请先把它备份到本地文件，再写入环境变量。",
    );
  }
}
