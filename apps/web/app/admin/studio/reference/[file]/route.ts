import { readFile } from "node:fs/promises";

import { getFounderSession } from "../../../../../lib/admin/gate";
import {
  listSkillReferenceImages,
  skillReferenceImagePath,
} from "../../../../../lib/admin/studio-data";

/**
 * Serves the materials-studio skill's reference images to the founder
 * console's studio tab. The images live inside the skill package
 * (agent/skills/materials-studio/references/), not in Blob, so a route
 * has to read them off the deployed filesystem; next.config.ts traces
 * the skill directory into this function's bundle.
 *
 * Founder-gated like every admin surface, and the file name is matched
 * against the directory's own listing (never used as a path directly),
 * so the route cannot read anything outside the references folder.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const founder = await getFounderSession();
  if (!founder) return new Response(null, { status: 404 });

  const { file } = await params;
  const allowed = await listSkillReferenceImages();
  if (!allowed.includes(file)) return new Response(null, { status: 404 });

  try {
    const bytes = await readFile(skillReferenceImagePath(file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
