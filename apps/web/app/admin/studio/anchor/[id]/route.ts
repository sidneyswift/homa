import { getFounderSession } from "../../../../../lib/admin/gate";
import { studioAnchorUrl } from "../../../../../lib/materials/anchors";

/**
 * Sends the founder console's studio tab to a materials-studio golden
 * anchor image. Anchor bytes live in Vercel Blob (public, content-
 * addressed; lib/materials/anchors.ts), so this redirects to the manifest
 * URL rather than streaming bytes through the function.
 *
 * Founder-gated like every admin surface, and the id is matched against
 * the registry (never used as a path) with the URL re-checked by
 * isFleetAnchorUrl, so nothing outside the anchor set is reachable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const founder = await getFounderSession();
  if (!founder) return new Response(null, { status: 404 });

  const { id } = await params;
  const url = studioAnchorUrl(id);
  if (!url) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      "cache-control": "private, max-age=3600",
    },
  });
}
