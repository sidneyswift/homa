import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

import { createSessionProxyHandler } from "./lib/supabase/session-proxy";

const handleSessionProxy = createSessionProxyHandler({
  async hasVerifiedClaims(cookieMethods) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: cookieMethods },
    );
    const { data } = await supabase.auth.getClaims();
    return data?.claims != null;
  },
});

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
  return handleSessionProxy(request);
}

export const config = {
  // Skip static assets, the public waitlist/map APIs (they do their own
  // lead-cookie auth and get chatty per-tap traffic), the eve agent
  // routes (eve does its own auth; interfering with its streaming here
  // buys nothing), and the device sync API (machine traffic with its own
  // token auth; a browser session refresh means nothing to it).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/waitlist|api/map|api/sync|eve|_eve_internal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
