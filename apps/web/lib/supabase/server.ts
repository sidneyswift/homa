import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads the session from request cookies. Writes are attempted but tolerated
 * to fail inside Server Components (the proxy owns cookie refresh there).
 */
export async function createSupabaseServerClient(options?: { fetch?: typeof fetch }) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(options?.fetch ? { global: { fetch: options.fetch } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookie writes are not allowed
            // there. Safe to ignore; apps/web/proxy.ts refreshes sessions.
          }
        },
      },
    },
  );
}

/**
 * Supabase client for Route Handlers that already receive an explicit Request.
 * Reading the request header directly avoids depending on Next's ambient
 * request store, which is not guaranteed to survive every route execution
 * path. apps/web/proxy.ts owns session refresh and response cookie writes.
 */
export function createSupabaseRequestClient(request: Request, options?: { fetch?: typeof fetch }) {
  const requestCookies = parseCookieHeader(
    request.headers.get("cookie") ?? "",
  ).flatMap(({ name, value }) =>
    value === undefined ? [] : [{ name, value }],
  );

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(options?.fetch ? { global: { fetch: options.fetch } } : {}),
      cookies: {
        getAll() {
          return requestCookies;
        },
        setAll() {
          // The proxy refreshes sessions before Route Handlers execute.
        },
      },
    },
  );
}
