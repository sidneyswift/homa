import type { ReviewAnchorSkip } from "../../lib/materials/review-anchor";
import type { StoredChecklistAnswer } from "../../lib/materials/review-checklist";
import type { PageGeometry } from "../../lib/materials/page-geometry";
import type { SizeFloorFinding, SizeFloorStatus } from "../../lib/materials/size-floor";
import { mapDb } from "../../lib/map/db";

/**
 * The slice of materials.generation the provenance evals read back.
 * Read from the row, not from the tool result: the row is what a later
 * session, the admin bench, and every per-format measurement see.
 * Fields are optional because older rows (and rows from a tool path that
 * skipped a stage) may lack them; the evals assert presence explicitly.
 */
export interface StoredMaterialGeneration {
  input?: { recipe?: string | null } | null;
  review?: {
    pass: boolean;
    issues?: string[];
    checklist?: {
      recipe: string | null;
      answers: { id: string; answer: StoredChecklistAnswer; check?: string }[];
      blockingFailures?: string[];
    } | null;
    anchorShown?: boolean;
    anchorSkipped?: ReviewAnchorSkip;
  } | null;
  pageGeometry?: PageGeometry[];
  sizeFloor?: {
    status: SizeFloorStatus;
    comparedTo: string | null;
    findings: SizeFloorFinding[];
    reductionAllowedByModel: boolean;
    consentNote: string | null;
  } | null;
}

/**
 * generation for one material, scoped to the family the eval runs as.
 * Inside `pnpm eval:sandbox` mapDb() points at the disposable cluster
 * (HOMA_EVAL_DATABASE_URL), the same place create_printable wrote.
 */
export async function readMaterialGeneration(
  familyId: string,
  materialId: string,
): Promise<StoredMaterialGeneration | null> {
  const sql = mapDb();
  const rows = await sql<{ generation: StoredMaterialGeneration | null }[]>`
    select generation
    from public.materials
    where id = ${materialId}::uuid and family_id = ${familyId}::uuid
    limit 1
  `;
  return rows[0]?.generation ?? null;
}
