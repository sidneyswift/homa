import { createBoundedGetFetch, type BoundedGetFetchOptions } from "./bounded-get-fetch";

/** #1194: a transient children Gateway Timeout made the whole app shell fail.
 * Only this exact caller-scoped read opts into bounded recovery. */
export function createBoundedChildrenReadFetch(
  supabaseUrl: string,
  familyId: string,
  options: BoundedGetFetchOptions = {},
): typeof fetch {
  const url = new URL("rest/v1/children", `${supabaseUrl.replace(/\/$/, "")}/`);
  url.search = new URLSearchParams({
    select: "id,family_id,name,birth_month,profile,avatar_url",
    family_id: `eq.${familyId}`,
    order: "created_at.asc",
  }).toString();
  return createBoundedGetFetch(url.href, {
    unavailableMessage: "Children lookup temporarily unavailable.",
    deniedMessage: "Children lookup was denied.",
    retryResponse(body) {
      if (body === null) return true;
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
        // A PostgREST or SQL code is a query/auth failure, not a gateway retry.
        return !(parsed && typeof parsed === "object" && "code" in parsed
          && typeof parsed.code === "string" && parsed.code.length > 0);
      } catch {
        return true;
      }
    },
  }, options);
}
