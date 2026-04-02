/**
 * SPECTRA — Root Middleware
 *
 * Combines authentication (Supabase session refresh + route protection)
 * and internationalization (language detection + routing) into a single
 * Next.js middleware entry point.
 *
 * Execution order:
 * 1. Skip static assets and internal Next.js routes.
 * 2. Detect and resolve the user's preferred locale.
 * 3. Refresh the Supabase auth session.
 * 4. Enforce route protection (redirect unauthenticated users).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_LOCALE = "en" as const;
const SUPPORTED_LOCALES = ["en", "es"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Route prefixes that require authentication. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/api/analyze",
  "/api/forensic",
  "/api/credits",
] as const;

/** Routes that authenticated users should be redirected away from. */
const AUTH_ROUTES = ["/login", "/signup", "/auth/callback"] as const;

const LOGIN_PATH = "/login";
const DASHBOARD_PATH = "/dashboard";

/** Cookie name for persisting the user's locale preference. */
const LOCALE_COOKIE = "SPECTRA_LOCALE";

// ────────────────────────────────────────────────────────────────────────────
// Locale Detection
// ────────────────────────────────────────────────────────────────────────────

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Resolve the user's preferred locale using the following priority:
 *
 * 1. Explicit cookie preference (set in user settings).
 * 2. `Accept-Language` header from the browser.
 * 3. Default locale (`en`).
 */
function resolveLocale(request: NextRequest): SupportedLocale {
  // 1. Cookie preference.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Accept-Language header.
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    // Parse the header and find the first supported locale.
    const preferred = acceptLanguage
      .split(",")
      .map((part) => {
        const [lang, q] = part.trim().split(";q=");
        return { lang: lang.trim().toLowerCase(), q: q ? parseFloat(q) : 1.0 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of preferred) {
      // Match exact locale (e.g. "es") or language prefix (e.g. "es-mx" -> "es").
      if (isSupportedLocale(lang)) {
        return lang;
      }
      const prefix = lang.split("-")[0];
      if (isSupportedLocale(prefix)) {
        return prefix;
      }
    }
  }

  // 3. Default.
  return DEFAULT_LOCALE;
}

// ────────────────────────────────────────────────────────────────────────────
// Route Helpers
// ────────────────────────────────────────────────────────────────────────────

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

// ────────────────────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ── Resolve locale and set it on the response ──────────────────────
  const locale = resolveLocale(request);

  // Start with a pass-through response.
  let response = NextResponse.next({ request });

  // Set the locale cookie if it's not already set or has changed.
  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existingLocale !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  // Set a header for downstream use (Server Components, API routes).
  response.headers.set("x-spectra-locale", locale);

  // ── Supabase Auth Session Refresh ──────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured — skip auth checks entirely.
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update cookies on the request for downstream handlers.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        // Recreate the response so downstream sees the mutated request.
        response = NextResponse.next({ request });

        // Preserve the locale header on the new response.
        response.headers.set("x-spectra-locale", locale);

        // Mirror cookies onto the outgoing response.
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        // Re-set locale cookie if we just re-created the response.
        if (existingLocale !== locale) {
          response.cookies.set(LOCALE_COOKIE, locale, {
            path: "/",
            maxAge: 365 * 24 * 60 * 60,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      },
    },
  });

  // Refresh the auth session. `getUser` validates the JWT server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Route Protection ───────────────────────────────────────────────

  // Redirect unauthenticated users from protected routes to login.
  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages to dashboard.
  if (user && isAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = DASHBOARD_PATH;
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

// ────────────────────────────────────────────────────────────────────────────
// Matcher — Skip static assets and internal routes
// ────────────────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser favicon)
     * - Static assets in /public (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
  ],
};
