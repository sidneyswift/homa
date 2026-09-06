import { parsePreparedPrintRequest, printPdfPath, type PreparedPrintRequest } from "@homa/core";

/** SMS has no print card. The existing signin return path preserves this
 * exact selection; its authenticated PDF GET rechecks the current revision.
 * This creates a link only, with no provider delivery or approval effect. */
export function printSigninUrl(siteRoot: string, request: PreparedPrintRequest): string | null {
  const verified = parsePreparedPrintRequest(request);
  if (!verified) return null;
  try {
    const origin = new URL(siteRoot);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.port
      || origin.pathname !== "/" || origin.search || origin.hash) return null;
    const signin = new URL("/signin", origin);
    signin.searchParams.set("next", printPdfPath(verified));
    return signin.href;
  } catch { return null; }
}
