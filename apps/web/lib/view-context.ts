/**
 * The app-wide view context: who the parent is looking at right now,
 * the whole family (default) or one child. One httpOnly cookie carries
 * the choice so every door reads the same selection: the report tab
 * resolves to the selected kid, the planner filters to their column,
 * and chat turns arrive with the focus stamped (the browser sends the
 * cookie to the eve routes on its own).
 *
 * Deliberately a UI HINT, never an auth fact: the cookie value is
 * client input, so every reader validates it against the caller's own
 * RLS-loaded children before acting on it (tenancy law: a foreign or
 * stale id degrades to "family", it never reaches a query).
 *
 * Pure module on purpose (no next/headers): the eve channel's auth walk
 * imports it to parse the raw Cookie header outside Next's request
 * helpers.
 */

export const VIEW_CONTEXT_COOKIE = "homa-view-context";

/** The cookie value meaning "no child selected, show the whole family". */
export const VIEW_CONTEXT_FAMILY = "family";

export type ViewContext = { kind: "family" } | { kind: "child"; childId: string };

/**
 * parseViewContext(raw, childIds): ViewContext
 * Anything that is not exactly one of the caller's own child ids means
 * the whole family: absent cookie, the literal "family", a deleted
 * kid's stale id, or a forged value.
 */
export function parseViewContext(
  raw: string | undefined,
  childIds: readonly string[],
): ViewContext {
  if (raw && raw !== VIEW_CONTEXT_FAMILY && childIds.includes(raw)) {
    return { kind: "child", childId: raw };
  }
  return { kind: "family" };
}

/**
 * Chooses the child for the stable live Progress route without depending
 * on whether a legacy report exists.
 */
export function resolveProgressChildId(
  viewContext: ViewContext,
  childIds: readonly string[],
): string | null {
  if (
    viewContext.kind === "child" &&
    childIds.includes(viewContext.childId)
  ) {
    return viewContext.childId;
  }
  return childIds[0] ?? null;
}

/** Kid-scoped routes, where switching kids should keep the surface and
 * swap the kid (Progress stays Progress, report stays report). */
const PROGRESS_PAGE = /^\/app\/([^/]+)\/progress$/;
const REPORT_PAGE = /^\/app\/([^/]+)\/report$/;
const KIDS_PAGE = /^\/app\/kids\/([^/]+)$/;

/**
 * kidSwitchTargetPath(pathname, childId): string | null
 * Where picking a kid should navigate from the current page: the
 * sibling's same page on kid-scoped surfaces, null (stay put) elsewhere.
 * Shared by the phone bar switcher and the sidebar's viewing rows so the
 * two can never drift apart.
 */
export function kidSwitchTargetPath(
  pathname: string,
  childId: string,
): string | null {
  if (PROGRESS_PAGE.test(pathname)) {
    return `/app/${childId}/progress`;
  }
  if (REPORT_PAGE.test(pathname)) return `/app/${childId}/report`;
  if (KIDS_PAGE.test(pathname)) return `/app/kids/${childId}`;
  return null;
}

/**
 * readViewContextCookie(cookieHeader): string | null
 * Pulls the raw cookie value out of a Cookie header string, for callers
 * that hold a bare Request (the eve channel) instead of next/headers.
 * Returns null when the cookie is absent or shaped wrong; validation
 * against real child ids stays the reader's job.
 */
export function readViewContextCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== VIEW_CONTEXT_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    // "family" or a UUID; anything longer is not ours.
    return value.length > 0 && value.length <= 64 ? value : null;
  }
  return null;
}
