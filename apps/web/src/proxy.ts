import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_REFRESH_COOKIE,
  AUTH_REFRESH_INTERVAL_MS,
  AUTH_REFRESH_TIMEOUT_MS,
} from "@/lib/auth/constants";
import type { Database } from "@/types/database";

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      response.cookies.delete(cookie.name);
    }
  }

  response.cookies.delete(AUTH_REFRESH_COOKIE);
}

function shouldRefreshAuth(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return true;
  }

  const refreshedAt = Number.parseInt(
    request.cookies.get(AUTH_REFRESH_COOKIE)?.value ?? "",
    10,
  );

  if (!Number.isFinite(refreshedAt)) {
    return true;
  }

  return Date.now() - refreshedAt >= AUTH_REFRESH_INTERVAL_MS;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms.`));
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

export async function proxy(request: NextRequest) {
  const supabaseUrl =
    process.env.SUPABASE_SERVER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (
    !supabaseUrl ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_FORCE_MOCK === "true" ||
    process.env.WENLAN_FORCE_MOCK === "true"
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  if (!hasSupabaseAuthCookie(request)) {
    clearAuthCookies(request, response);
    return response;
  }

  if (!shouldRefreshAuth(request)) {
    return response;
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>>;

  try {
    authResult = await withTimeout(supabase.auth.getUser(), AUTH_REFRESH_TIMEOUT_MS);
  } catch {
    return response;
  }

  const {
    data: { user },
    error,
  } = authResult;

  if (error || !user) {
    clearAuthCookies(request, response);
    return response;
  }

  response.cookies.set(AUTH_REFRESH_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(AUTH_REFRESH_INTERVAL_MS / 1000),
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
