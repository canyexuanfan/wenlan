import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminSiteRole } from "@/lib/auth/roles";
import type { SiteRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

const AUTH_VIEWER_TIMEOUT_MS = 5000;

class AuthAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthAccessError";
    this.status = status;
  }
}

export type AuthViewer = {
  user: User | null;
  isAuthenticated: boolean;
  email: string | null;
  profileId: string | null;
  displayName: string | null;
  siteRole: SiteRole | null;
};

type ProfileRecord = Database["app"]["Tables"]["profiles"]["Row"];

function emptyAuthViewer(): AuthViewer {
  return {
    user: null,
    isAuthenticated: false,
    email: null,
    profileId: null,
    displayName: null,
    siteRole: null,
  };
}

function createAuthTimeoutError(step: string) {
  return new Error(`Timed out while resolving auth viewer during ${step}.`);
}

function withTimeout<T>(promise: Promise<T>, step: string, timeoutMs = AUTH_VIEWER_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(createAuthTimeoutError(step));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function hasSupabaseAuthCookie() {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

export function normalizeRedirectPath(input?: string | null) {
  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return "/";
  }

  return input;
}

export function buildLoginHref(redirectTo?: string | null, error?: string | null) {
  const params = new URLSearchParams();
  const normalizedRedirectPath = normalizeRedirectPath(redirectTo);

  if (normalizedRedirectPath && normalizedRedirectPath !== "/") {
    params.set("redirectTo", normalizedRedirectPath);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function buildRegisterHref(token?: string | null, error?: string | null) {
  const params = new URLSearchParams();

  if (token?.trim()) {
    params.set("token", token.trim());
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `/register?${query}` : "/register";
}

const getProfileById = cache(async function getProfileById(profileId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .schema("app")
    .from("profiles")
    .select("id, email, display_name, site_role, status, created_at, updated_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
});

function toAuthViewer(user: User, profile: ProfileRecord): AuthViewer {
  if (profile.status === "disabled" || profile.status === "removed") {
    return emptyAuthViewer();
  }

  return {
    user,
    isAuthenticated: true,
    email: user.email ?? null,
    profileId: profile.id,
    displayName: profile.display_name,
    siteRole: profile.site_role,
  };
}

export const getAuthViewer = cache(async function getAuthViewer(): Promise<AuthViewer> {
  if (!isSupabaseConfigured()) {
    return emptyAuthViewer();
  }

  try {
    if (!(await hasSupabaseAuthCookie())) {
      return emptyAuthViewer();
    }

    const client = await createSupabaseServerClient();
    const {
      data: { session },
      error,
    } = await withTimeout(client.auth.getSession(), "auth.getSession");
    const user = session?.user ?? null;

    if (error || !user) {
      return emptyAuthViewer();
    }

    const existingProfile = await withTimeout(getProfileById(user.id), "getProfileById");
    if (existingProfile) {
      return toAuthViewer(user, existingProfile);
    }

    const profile = await withTimeout(ensureProfileForUser(user), "ensureProfileForUser");
    return toAuthViewer(user, profile);
  } catch {
    return emptyAuthViewer();
  }
});

const getVerifiedAuthViewer = cache(async function getVerifiedAuthViewer(): Promise<AuthViewer> {
  if (!isSupabaseConfigured()) {
    return emptyAuthViewer();
  }

  try {
    if (!(await hasSupabaseAuthCookie())) {
      return emptyAuthViewer();
    }

    const client = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await withTimeout(client.auth.getUser(), "auth.getUser");

    if (error || !user) {
      return emptyAuthViewer();
    }

    const profile = await withTimeout(ensureProfileForUser(user), "ensureProfileForUser");
    return toAuthViewer(user, profile);
  } catch {
    return emptyAuthViewer();
  }
});

export async function requireAuthenticatedPage(redirectTo: string) {
  const viewer = await getVerifiedAuthViewer();

  if (!viewer.isAuthenticated) {
    redirect(buildLoginHref(redirectTo));
  }

  return viewer;
}

export function viewerCanManageAdmin(siteRole: SiteRole | null) {
  return isAdminSiteRole(siteRole);
}

export function viewerCanManageMembers(siteRole: SiteRole | null) {
  return isAdminSiteRole(siteRole);
}

export function isAuthAccessError(error: unknown): error is AuthAccessError {
  return error instanceof AuthAccessError;
}

export async function requireAdminPage(redirectTo: string) {
  const viewer = await requireAuthenticatedPage(redirectTo);

  if (!viewerCanManageAdmin(viewer.siteRole)) {
    redirect("/forbidden");
  }

  return viewer;
}

export async function assertAdminAccess() {
  const viewer = await getVerifiedAuthViewer();

  if (!viewer.isAuthenticated) {
    throw new AuthAccessError("Authentication required.", 401);
  }

  if (!viewerCanManageAdmin(viewer.siteRole)) {
    throw new AuthAccessError("Admin role required.", 403);
  }

  return viewer;
}

export async function ensureProfileForUser(
  user: User,
  overrides?: {
    displayName?: string | null;
    siteRole?: SiteRole;
  },
) {
  const adminClient = createSupabaseAdminClient();
  const { data: existingProfile, error: existingProfileError } = await adminClient
    .schema("app")
    .from("profiles")
    .select("id, email, display_name, site_role, status, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  const metadataDisplayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : null;

  const nextDisplayName = overrides?.displayName ?? metadataDisplayName;

  if (existingProfile) {
    const updatePayload: Database["app"]["Tables"]["profiles"]["Update"] = {};

    if (user.email && existingProfile.email !== user.email) {
      updatePayload.email = user.email;
    }

    if (typeof nextDisplayName === "string" && existingProfile.display_name !== nextDisplayName) {
      updatePayload.display_name = nextDisplayName;
    }

    if (overrides?.siteRole && existingProfile.site_role !== overrides.siteRole) {
      updatePayload.site_role = overrides.siteRole;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { data, error } = await adminClient
        .schema("app")
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id)
        .select("id, email, display_name, site_role, status, created_at, updated_at")
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    return existingProfile;
  }

  const { count, error: profileCountError } = await adminClient
    .schema("app")
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (profileCountError) {
    throw profileCountError;
  }

  const initialRole = overrides?.siteRole ?? ((count ?? 0) === 0 ? "admin" : "viewer");
  const insertPayload: Database["app"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    email: user.email ?? null,
    display_name: nextDisplayName,
    site_role: initialRole,
    status: "active",
  };

  const { data, error } = await adminClient
    .schema("app")
    .from("profiles")
    .insert(insertPayload)
    .select("id, email, display_name, site_role, status, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
