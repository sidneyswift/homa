import {
  decodeStudioAnchorBytes,
  studioAnchorIds,
} from "../../../../../lib/materials/anchors";
import { getFounderSession } from "../../../../../lib/admin/gate";

/**
 * Serves a materials-studio golden anchor image to the founder console's
 * studio tab. Anchors live in code (base64 in the registry), not the skill
 * package, so this decodes the registered bytes rather than reading a file.
 *
 * Founder-gated like every admin surface, and the id is matched against the
 * registry's own listing (never used as a path), so nothing outside the
 * anchor set is reachable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const founder = await getFounderSession();
  if (!founder) return new Response(null, { status: 404 });

  const { id } = await params;
  if (!studioAnchorIds().includes(id)) return new Response(null, { status: 404 });

  const bytes = decodeStudioAnchorBytes(id);
  if (!bytes) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=3600",
    },
  });
}
