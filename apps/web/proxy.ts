import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeSameOriginPath } from "./lib/safe-redirect";

/**
 * Session-refresh proxy (Next 16's renamed middleware convention). Two jobs:
 *   1. Refresh expired Supabase auth tokens on every matched request and
 *      write the fresh cookies to both the request (for Server Components
 *      downstream) and the response (for the browser).
 *   2. Gate the signed-in surfaces: everything under /app requires a
 *      session; /signin bounces already-signed-in users to /app.
 * getClaims() validates the JWT signature against the project's published
 * keys, so this gate cannot be spoofed by a hand-rolled cookie.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cache headers that prevent CDNs from caching a response that
          // carries a fresh session cookie (session-leak protection).
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value as string),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = data?.claims != null;

  const path = request.nextUrl.pathname;
  // Everything signed-in lives under /app (2026-07-09 rename), so the
  // gate is structural: new app pages are covered without editing this
  // list. The exact-or-slash check keeps lookalikes like /apple-icon out.
  const needsAuth = path === "/app" || path.startsWith("/app/");

  if (needsAuth && !isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  if ((path === "/signin" || path.startsWith("/signin/")) && isSignedIn) {
    const destination = safeSameOriginPath(request.nextUrl.searchParams.get("next")) ?? "/app";
    return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
  }

  return response;
}

export const config = {
  // Skip static assets, the public waitlist/map APIs (they do their own
  // lead-cookie auth and get chatty per-tap traffic), and the eve agent
  // routes (eve does its own auth; interfering with its streaming here
  // buys nothing).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/waitlist|api/map|eve|_eve_internal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
