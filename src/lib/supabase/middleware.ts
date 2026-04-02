/**
 * PROBATIO — Supabase Auth Middleware
 *
 * Session refresh logic and route protection for Next.js middleware.
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ────────────────────────────────────────────────────────────────────────────
// Protected Route Patterns
// ────────────────────────────────────────────────────────────────────────────

/** Route prefixes that require authentication. */
const PROTECTED_PREFIXES = ["/dashboard", "/api/analyze", "/api/forensic", "/api/credits"] as const;

/** Routes that authenticated users should be redirected away from. */
const AUTH_ROUTES = ["/login", "/signup", "/auth/callback"] as const;

/** The login page to redirect unauthenticated users to. */
const LOGIN_PATH = "/login";

/** The dashboard page to redirect authenticated users to from auth routes. */
const DASHBOARD_PATH = "/dashboard";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

// ────────────────────────────────────────────────────────────────────────────
// Middleware Handler
// ────────────────────────────────────────────────────────────────────────────

/**
 * Update the Supabase auth session and enforce route protection.
 *
 * This function should be called from the Next.js middleware entry point.
 * It:
 * 1. Creates a Supabase server client backed by request/response cookies.
 * 2. Refreshes the auth session (exchanges refresh tokens if needed).
 * 3. Redirects unauthenticated users from protected routes to `/login`.
 * 4. Redirects authenticated users from auth routes to `/dashboard`.
 *
 * @param request  The incoming Next.js request.
 * @returns A `NextResponse` with updated cookies and optional redirect.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Start with a pass-through response that forwards the request.
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, pass through without auth checks.
    // This allows the app to render error pages during misconfiguration.
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update cookies on the request (for downstream handlers).
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        // Recreate the response with the mutated request so that
        // downstream middleware and route handlers see the new cookies.
        supabaseResponse = NextResponse.next({
          request,
        });

        // Mirror the cookies onto the outgoing response so the browser
        // receives the updated session tokens.
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh the session. This call will update cookies if tokens
  // were refreshed. The `getUser` call validates the JWT server-side
  // (unlike `getSession` which only reads from the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Redirect unauthenticated users from protected routes ───────────
  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    // Preserve the original URL so we can redirect back after login.
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── Redirect authenticated users away from auth pages ──────────────
  if (user && isAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = DASHBOARD_PATH;
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
