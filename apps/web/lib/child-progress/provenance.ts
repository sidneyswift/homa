import { getMapItem, getScorableItem } from "@homa/core";

import { gateStoredQuote, type QuoteGateContext } from "./quote-gate";
import type {
  ProgressCheckInChannel,
  ProgressEvidence,
  ProgressEvidenceAnswer,
  ProgressSourceKind,
} from "./types";

/**
 * The pure mapper from one evidence row to the one receipt a parent may
 * read.
 *
 * It carries two fences. The first stops any surface from attributing
 * Homa's own sentence to a parent: only journal and conversation rows
 * store a human's own words, and a lesson_listen row stores a
 * model-written clause in parent-report style, so rendering that as
 * "her own words" would repeat the 2026-07-19 recall internal-visibility
 * failure (PR #52). The second stops any surface from putting one
 * child's name on another child's keepsake: the multi-child capture
 * path writes a row per named sibling off one message
 * (manage_child_progress.ts), so a quote can name a child other than
 * the one whose page it lands on.
 */

/** The only sources whose stored `quote` is a human's own sentence.
 *  Journal and conversation rows store a verbatim substring of the
 *  adult's canonical inbound message. Every other source either stores
 *  no quote at all, or stores Homa's own words. */
const HUMAN_AUTHORED_QUOTE_SOURCES: ReadonlySet<ProgressSourceKind> =
  new Set(["journal", "conversation"]);

export interface ProvenanceRecord {
  evidenceId: string;
  itemId: string;
  /** The catalog line. A parent-observable sentence for bank items; a
   *  bare topic name for taxonomy items, which is why isBankStatement
   *  exists. */
  statement: string;
  /** True when getMapItem resolved the id, so `statement` is one of the
   *  authored bank sentences rather than a taxonomy topic name. */
  isBankStatement: boolean;
  subjectId: string;
  subjectDisplayName: string;
  answer: ProgressEvidenceAnswer;
  source: ProgressSourceKind;
  channel: ProgressCheckInChannel | null;
  adultDisplayName: string | null;
  /** The adult's own words, gate-passed. Never a model-authored string,
   *  never a string naming another child in this family. */
  quote: string | null;
  /** True when a human-authored quote existed and the gate held it
   *  back. The renderer then shows no quote AND no "no words saved"
   *  line, because that line would be false. */
  quoteSuppressed: boolean;
  observedAt: string;
  createdAt: string;
}

/**
 * humanAuthoredQuote(evidence): the row's quote only when it is a
 * human's own words. Runs BEFORE the render gate, so a lesson_listen
 * clause is dropped as not-a-human's-words rather than reported as
 * suppressed.
 */
export function humanAuthoredQuote(
  evidence: ProgressEvidence,
): string | null {
  if (!HUMAN_AUTHORED_QUOTE_SOURCES.has(evidence.source)) return null;
  if (evidence.quote === null || evidence.quote.trim() === "") return null;
  return evidence.quote;
}

/**
 * buildProvenanceRecord(evidence, gate): the receipt, or null when the
 * row cannot honestly render one.
 */
export function buildProvenanceRecord(
  evidence: ProgressEvidence,
  gate: QuoteGateContext,
): ProvenanceRecord | null {
  // Return null rather than throw on an unknown id. projection.ts throws
  // here, which is right for the scored projection and wrong for a
  // celebration page: a retired catalog id must never take the page down.
  const found = getScorableItem(evidence.itemId);
  if (found === undefined) return null;
  const isBankStatement = getMapItem(evidence.itemId) !== undefined;

  const authored = humanAuthoredQuote(evidence);
  const verdict = authored === null ? null : gateStoredQuote(authored, gate);
  const quote = verdict?.kind === "render" ? verdict.quote : null;
  const quoteSuppressed =
    verdict !== null && verdict.kind === "suppress" && verdict.reason !== "blank";

  // The renderability floor. A taxonomy item's statement is topic.name
  // (scorable.ts), a bare noun phrase like "Persuasive Writing", and the
  // extraction model sees every taxonomy id, so taxonomy ids arrive on
  // exactly the rows a parent quotes. A dated noun phrase with no
  // sentence under it is a coverage checklist line, which the spec
  // shelves. Either her words carry the row or an authored bank sentence
  // does; nothing else renders.
  if (quote === null && !isBankStatement) return null;

  // Field by field, deliberately. Nothing carries memberUserId,
  // familyId, idempotencyKey, messageId, supersedesId or supersededAt:
  // those are ledger internals and never cross to a client payload.
  return {
    evidenceId: evidence.id,
    itemId: evidence.itemId,
    statement: found.item.statement,
    isBankStatement,
    subjectId: found.subject.id,
    subjectDisplayName: found.subject.displayName,
    answer: evidence.answer,
    source: evidence.source,
    channel: evidence.channel,
    adultDisplayName: evidence.adultDisplayName,
    quote,
    quoteSuppressed,
    observedAt: evidence.observedAt,
    createdAt: evidence.createdAt,
  };
}
