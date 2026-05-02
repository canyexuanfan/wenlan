import "server-only";

import { createHash } from "node:crypto";

import type { SiteRole } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InviteLookupResult =
  | {
      isValid: true;
      email: string | null;
      siteRole: SiteRole;
      expiresAt: string;
    }
  | {
      isValid: false;
      error: string;
    };

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getInviteByToken(token: string): Promise<InviteLookupResult> {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return {
      isValid: false,
      error: "Invite token is missing.",
    };
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .schema("app")
    .from("invite_tokens")
    .select("id, email, site_role, expires_at, used_at")
    .eq("token_hash", hashInviteToken(normalizedToken))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      isValid: false,
      error: "This invite link is invalid or has already been replaced.",
    };
  }

  if (data.used_at) {
    return {
      isValid: false,
      error: "This invite link has already been used.",
    };
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return {
      isValid: false,
      error: "This invite link has expired.",
    };
  }

  return {
    isValid: true,
    email: data.email,
    siteRole: data.site_role,
    expiresAt: data.expires_at,
  };
}
