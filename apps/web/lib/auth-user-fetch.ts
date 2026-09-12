import { createBoundedGetFetch, type BoundedGetFetchOptions } from "./bounded-get-fetch";

/** Bound only the fresh Auth user GET. No cache, refresh retry, RLS query
 * retry, or Eve POST replay. Production callers omit injected budgets. */
export function createBoundedAuthUserFetch(
  supabaseUrl: string,
  options: BoundedGetFetchOptions = {},
): typeof fetch {
  const authUserUrl = new URL("auth/v1/user", `${supabaseUrl.replace(/\/$/, "")}/`).href;
  return createBoundedGetFetch(authUserUrl, {
    unavailableMessage: "Auth user lookup temporarily unavailable.",
    deniedMessage: "Auth user lookup was denied.",
  }, options);
}
