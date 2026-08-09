import type { CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeSameOriginPath } from "../safe-redirect";

type CookieWrite = Parameters<
  NonNullable<CookieMethodsServer["setAll"]>
>[0][number];

export interface SessionProxyDependencies {
  hasVerifiedClaims(cookieMethods: CookieMethodsServer): Promise<boolean>;
}

function applySessionState(
  response: NextResponse,
  cookies: CookieWrite[],
  headers: Headers,
) {
  cookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export function createSessionProxyHandler(
  dependencies: SessionProxyDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async function handleSessionProxy(request) {
    const pendingCookies: CookieWrite[] = [];
    const pendingHeaders = new Headers();
    const cookieMethods: CookieMethodsServer = {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        pendingCookies.push(...cookiesToSet);
        Object.entries(headers).forEach(([key, value]) =>
          pendingHeaders.set(key, value),
        );
      },
    };

    const isSignedIn = await dependencies.hasVerifiedClaims(cookieMethods);
    const path = request.nextUrl.pathname;
    const needsAuth = path === "/app" || path.startsWith("/app/");

    let response: NextResponse;
    if (needsAuth && !isSignedIn) {
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      url.search = "";
      url.searchParams.set("next", `${path}${request.nextUrl.search}`);
      response = NextResponse.redirect(url);
    } else if (
      (path === "/signin" || path.startsWith("/signin/")) &&
      isSignedIn
    ) {
      const destination =
        safeSameOriginPath(request.nextUrl.searchParams.get("next")) ?? "/app";
      response = NextResponse.redirect(
        new URL(destination, request.nextUrl.origin),
      );
    } else {
      response = NextResponse.next({ request });
    }

    return applySessionState(response, pendingCookies, pendingHeaders);
  };
}
