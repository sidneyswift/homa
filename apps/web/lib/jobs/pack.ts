import {
  blobConfigured,
  uploadMaterialArtifacts,
} from "../materials/artifact-store";
import { joinPageBodies, splitPageBodies } from "../materials/page-shell";
import { renderPrintableHtml } from "../materials/render-page";
import { mapDb } from "../map/db";

/**
 * One printable pack per finished job: every worksheet the build produced,
 * in the order it made them, rendered as a single PDF.
 *
 * Why this exists. A multi-part build is one thing the parent asked for
 * ("the alphabet set, letters E to Z"), not twenty-two things. Delivering it
 * as twenty-two files is not delivering it. The first version of the
 * milestone text capped the attachment at the newest two materials, which
 * fixed the message size and quietly dropped twenty of the worksheets she
 * asked for. That was the wrong problem to solve.
 *
 * Why one render rather than merging PDFs. Every material already stores its
 * own page bodies joined by PAGE_HTML_DELIMITER, because a single material
 * can already be multi-page. Concatenating across materials is the same
 * operation with more pages, so the pack is one call to the renderer that
 * already produces every printable in the product. No PDF-merging library,
 * no second rendering path to keep honest.
 *
 * The size objection does not survive contact with the data: the real
 * twenty-two-part set in production is 41,527 characters of HTML in total,
 * average 1,888 each, against a 120,000 character ceiling for a SINGLE
 * material. The whole set is a third of what one worksheet may contain.
 */

/** A pack is worth building only when the build really made several things.
 * One material is already one file, and wrapping it adds a download without
 * adding anything to open. */
const PACK_MIN_MATERIALS = 2;

/**
 * Above this, stop and let the Binder carry it. Not a size limit, a
 * usefulness one: a parent printing three hundred pages from a text message
 * is not a flow anyone wants, and a render that large belongs in a job of
 * its own rather than on the tail of a milestone. The copy still points at
 * the Binder, so nothing is lost, and no build has come close in production.
 */
const PACK_MAX_MATERIALS = 60;

export interface JobMaterialPack {
  pdfUrl: string;
  previewUrl: string;
  /** How many worksheets the pack contains, for the parent-facing line. */
  materials: number;
  /** True page count of the rendered pack. */
  pages: number;
}

interface PackMaterialRow {
  id: string;
  title: string;
  html: string;
}

/** Every material this job produced, oldest first, which is the order the
 * build made them and therefore the order she expects to print them. */
export async function jobPackMaterials(
  familyId: string,
  jobId: string,
): Promise<PackMaterialRow[]> {
  const sql = mapDb();
  return await sql<PackMaterialRow[]>`
    select m.id, m.title, m.html
    from public.agent_job_stage_artifacts a
    join public.materials m
      on m.id = a.material_id and m.family_id = a.family_id
    where a.job_id = ${jobId}
      and a.family_id = ${familyId}
      and a.kind = 'material'
    order by a.created_at asc
  `;
}

/**
 * The pack's page bodies: every page of every material, in order.
 *
 * Exported for tests. Pure, so the ordering and the page arithmetic can be
 * checked without a browser or a database.
 */
export function packPageBodies(materials: readonly PackMaterialRow[]): string[] {
  return materials.flatMap((material) => splitPageBodies(material.html));
}

/**
 * Builds and stores the pack, or returns null when there is nothing worth
 * packing. Never throws: a pack is an improvement on the delivery, and a
 * failed render must leave the parent with the message she would have had
 * anyway rather than with nothing.
 */
export async function buildJobMaterialPack(
  familyId: string,
  jobId: string,
): Promise<JobMaterialPack | null> {
  if (!blobConfigured()) return null;
  try {
    const materials = await jobPackMaterials(familyId, jobId);
    if (materials.length < PACK_MIN_MATERIALS) return null;
    if (materials.length > PACK_MAX_MATERIALS) {
      console.warn(
        `buildJobMaterialPack: job ${jobId} made ${materials.length} materials, above the pack ceiling of ${PACK_MAX_MATERIALS}; delivering words plus the Binder instead.`,
      );
      return null;
    }

    const pageBodies = packPageBodies(materials);
    if (pageBodies.length === 0) return null;

    const rendered = await renderPrintableHtml(joinPageBodies(pageBodies));
    const stored = await uploadMaterialArtifacts({
      familyId,
      slug: `job-pack-${jobId}`,
      pdf: rendered.pdf,
      pageJpegs: rendered.pageJpegs,
    });

    return {
      pdfUrl: stored.pdfUrl,
      previewUrl: stored.previewUrl,
      materials: materials.length,
      pages: rendered.pageCount,
    };
  } catch (error) {
    console.error("buildJobMaterialPack failed:", error);
    return null;
  }
}
