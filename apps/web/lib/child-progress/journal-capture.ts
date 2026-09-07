import { ageInMonths } from "@homa/core";

import { mapDb } from "../map/db";
import { effectiveTimeZone, zonedDateString } from "../time-zone";
import { extractProgressClaims } from "./claim-extraction";
import {
  validateProposedClaims,
  type ClaimChild,
  type ValidatedClaim,
} from "./claim-validation";
import { claimExtractionEnabled } from "./claim-extraction-flag";
import { loadJournalConversationContext, type JournalContextRequest } from "./journal-context";

/**
 * The seam between judgment and verification (AGENTS.md "Models judge,
 * code verifies").
 *
 * One place decides what a parent's message says about her children:
 * load the roster, let the model propose claims, run every claim through
 * the deterministic gate, and hand the survivors to the service, which
 * stays entirely deterministic (tenancy, idempotency, writes, rescore).
 *
 * The model call happens HERE, outside the service transaction, on
 * purpose. A database transaction must never wait on a network call,
 * and keeping extraction out here means the service can be tested, and
 * can run, without a model at all.
 */

export interface JournalCaptureContext {
  familyId: string;
  /** The child the caller is recording for. Claims about anyone else
   *  in the roster are returned separately so the caller can fan out. */
  childId: string;
  message: string;
  surface: "journal" | "lesson";
  /** Authenticated runtime provenance, never model-authored context text. */
  conversation?: Omit<JournalContextRequest, "familyId" | "message">;
}

export interface JournalCaptureResult {
  /**
   * Always the judgment step's final verdict, possibly empty (flag off,
   * no roster, or a failed extraction call all mean "nothing to score,"
   * never "guess with the legacy matcher instead").
   */
  claims: ValidatedClaim[];
  /** Every child the message produced accepted claims for, so a caller
   *  can record for siblings too (the family-activity fan-out). */
  childIds: string[];
}

export async function loadJournalFamilyChildren(
  familyId: string,
  options: { database?: ReturnType<typeof mapDb>; now?: Date } = {},
): Promise<ClaimChild[]> {
  const sql = options.database ?? mapDb();
  // to_char in SQL, matching every other birth_month read in this
  // codebase: the column is a DATE, so the driver hands back a Date
  // object and ageInMonths (which splits a string) throws on it.
  const rows = await sql<
    { id: string; name: string; birth_date: string | null; time_zone: string | null }[]
  >`
    select child.id, child.name, to_char(child.birth_month, 'YYYY-MM-DD') as birth_date,
           family.time_zone
    from public.children child
    join public.families family on family.id = child.family_id
    where child.family_id = ${familyId}
    order by child.created_at
  `;
  const now = options.now ?? new Date();
  return rows.flatMap((row) => {
    if (!row.birth_date) return [];
    return [
      {
        childId: row.id,
        name: row.name,
        // Match the canonical Progress projector's family-local date at UTC noon.
        ageMonths: ageInMonths(row.birth_date, new Date(
          `${zonedDateString(now, effectiveTimeZone(row.time_zone))}T12:00:00.000Z`,
        )),
      },
    ];
  });
}

/**
 * captureJournalClaims(...): the judgment step plus the gate. Never
 * throws: any failure returns undefined claims, and the caller records
 * the parent's message the way it always did rather than losing it.
 */
export async function captureJournalClaims(
  context: JournalCaptureContext,
): Promise<JournalCaptureResult> {
  if (!claimExtractionEnabled()) {
    return { claims: [], childIds: [] };
  }
  try {
    const children = await loadJournalFamilyChildren(context.familyId);
    if (children.length === 0 || !children.some((child) => child.childId === context.childId)) {
      return { claims: [], childIds: [] };
    }
    // The whole roster goes to the model even though the caller named
    // one child: a family recap ("we all did the states hunt") has to
    // be able to produce a claim per child, and the caller fans out
    // from childIds below.
    const previousAssistant = context.surface === "journal" && context.conversation
      ? await loadJournalConversationContext({ ...context.conversation, familyId: context.familyId, message: context.message })
      : null;
    const proposed = await extractProgressClaims({
      familyId: context.familyId,
      message: context.message,
      children,
      surface: context.surface,
      ...(context.surface === "journal" ? { interpretationContext: { recordingTargetChildId: context.childId, previousAssistant } } : {}),
    });
    const { accepted } = validateProposedClaims({
      message: context.message,
      children,
      claims: proposed,
    });
    return {
      claims: accepted,
      childIds: [...new Set(accepted.map((claim) => claim.childId))],
    };
  } catch (error) {
    console.error(
      "journal claim capture failed (recording the message, scoring nothing):",
      error instanceof Error ? error.message : "unknown",
    );
    return { claims: [], childIds: [] };
  }
}
