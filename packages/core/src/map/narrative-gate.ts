import { BANNED_WORDS, EM_DASH, GENDERED_PRONOUNS } from "./copy-laws";
import type { PlanNarrative, ReportNarrative } from "./narrative";

/**
 * The runtime gate every generated sentence passes before a parent can
 * read it (D8 overturn safety floor). Pure and dependency-free so the
 * build-time fixture check (scripts/map-check.mts) runs the exact same
 * law as the live report path. A rejected piece falls back to its
 * template sentence; too many rejections fail the whole generation
 * (a half-fallback report reads worse than a clean template one).
 */

export interface NarrativeGateContext {
  /** Every digit run that appears anywhere in the facts payload. Any
   * digit sequence in generated text outside this set is an invented
   * number and rejects the piece. */
  allowedNumbers: readonly string[];
  /** The lead's OTHER kids; their names must never appear (never compare
   * siblings, and a report is a per-child artifact). */
  siblingNames: readonly string[];
  childName: string;
  /** True only when the parent's OWN words in the facts payload gender
   * the child (a whats-working note, a help-with entry). False means the
   * writer was never told, so any he/she/him/her in generated prose is an
   * inference from the name and rejects the piece: the child is "they"
   * until the parent says otherwise. */
  genderedPronounsAllowed?: boolean;
  /** Subject ids that must each have a card line. */
  expectedSubjects?: readonly string[];
  /** Subject ids that must each have a drawer explainer. */
  expectedDrawers?: readonly string[];
}

export interface NarrativeVerdicts {
  /** Piece key to rejection reason; only rejected pieces appear. */
  rejected: Record<string, string>;
  rejectedPieces: string[];
  /** True when the whole generation should be discarded. */
  failed: boolean;
}

/** Per-piece character caps (starting values per the implementation
 * prompt; tune in review). */
export const NARRATIVE_LENGTH_CAPS = {
  // Tightened 2026-07-08 after the first live read-through ("she needs
  // to be shorter"): the caps now enforce the prompt's brevity budgets.
  note: 520,
  subject: 340,
  drawer: 360,
  planIntro: 450,
  planWeek: 300,
  planClosing: 400,
} as const;

/** Diagnosis-adjacent phrasing beyond BANNED_WORDS, case-insensitive
 * substrings (a report must never gesture at a diagnosis). */
const DIAGNOSIS_SUBSTRINGS = ["on the spectrum", "adhd", "dyslexi", "autis"];

const DIGIT_RUN = /\d+/g;
const NEGATIVE_NUMBER = /(?:-|\u2212)\s?\d/;
/**
 * Score names belong to the deterministic presentation layer, never the
 * model-written explanation. The report shows warm, concrete labels such as
 * "A clear strength" and "Growing right now" while the model explains what
 * the parent actually saw and what to try next. Keeping this as a validator
 * protects both new narratives and older stored ones at render time.
 */
const REPORT_VERDICT_LANGUAGE = /\b(?:ahead|on[ -]track|benchmark(?:s)?|below\s+(?:age|typical|average)|above\s+(?:age|typical|average)|average\s+for\s+(?:their|this)\s+age|normal|typical|expected|(?:hasn't|has\s+not)\s+(?:happened|shown|started|reached)|not\s+(?:ready|there)\s+yet|catch(?:ing)?\s+up|for\s+(?:their|this)\s+age|for\s+a\s+\w+(?:-\w+)?-year-old)|without\s+(?:getting\s+stuck|falling\s+apart)\b/i;

/** True when a stored generated report sentence is safe to show as-is. */
export function reportNarrativePieceProblem(text: string | undefined): string | null {
  if (!text || text.trim().length === 0) return "empty";
  if (REPORT_VERDICT_LANGUAGE.test(text)) return "score or benchmark verdict";
  return null;
}

function pieceProblem(
  text: string | undefined,
  cap: number,
  context: NarrativeGateContext,
  rejectReportVerdicts = true,
): string | null {
  if (!text || text.trim().length === 0) return "empty";
  if (rejectReportVerdicts) {
    const presentationProblem = reportNarrativePieceProblem(text);
    if (presentationProblem) return presentationProblem;
  }
  if (text.length > cap) return `over ${cap} chars`;
  if (BANNED_WORDS.test(text)) return "banned word";
  if (EM_DASH.test(text)) return "em dash";
  if (NEGATIVE_NUMBER.test(text)) return "negative number";
  if (!context.genderedPronounsAllowed && GENDERED_PRONOUNS.test(text)) {
    return "gendered pronoun not in the parent's own words";
  }

  const lower = text.toLowerCase();
  for (const phrase of DIAGNOSIS_SUBSTRINGS) {
    if (lower.includes(phrase)) return `diagnosis phrasing "${phrase}"`;
  }
  for (const sibling of context.siblingNames) {
    const name = sibling.trim();
    if (!name) continue;
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(text)) return `sibling name "${name}"`;
  }

  const allowed = new Set(context.allowedNumbers);
  for (const run of text.match(DIGIT_RUN) ?? []) {
    if (!allowed.has(run)) return `number ${run} not in facts`;
  }
  return null;
}

export function validateNarrative(
  narrative: ReportNarrative,
  context: NarrativeGateContext,
): NarrativeVerdicts {
  const rejected: Record<string, string> = {};

  const note = pieceProblem(narrative.note, NARRATIVE_LENGTH_CAPS.note, context);
  if (note) rejected.note = note;

  const subjectIds = context.expectedSubjects ?? Object.keys(narrative.subjects);
  let subjectRejections = 0;
  for (const subjectId of subjectIds) {
    const problem = pieceProblem(
      narrative.subjects[subjectId],
      NARRATIVE_LENGTH_CAPS.subject,
      context,
    );
    if (problem) {
      rejected[`subject.${subjectId}`] = problem;
      subjectRejections += 1;
    }
  }

  const drawerIds = context.expectedDrawers ?? Object.keys(narrative.drawers);
  for (const subjectId of drawerIds) {
    const problem = pieceProblem(
      narrative.drawers[subjectId],
      NARRATIVE_LENGTH_CAPS.drawer,
      context,
    );
    if (problem) rejected[`drawer.${subjectId}`] = problem;
  }

  // A report that is half fallback reads worse than a clean template
  // report: the note is the voice of the whole page, and more than 4
  // broken card lines means the generation went sideways.
  const failed = Boolean(rejected.note) || subjectRejections > 4;

  return { rejected, rejectedPieces: Object.keys(rejected), failed };
}

export function validatePlanNarrative(
  narrative: PlanNarrative,
  context: NarrativeGateContext,
): NarrativeVerdicts {
  const rejected: Record<string, string> = {};

  const intro = pieceProblem(
    narrative.intro,
    NARRATIVE_LENGTH_CAPS.planIntro,
    context,
    false,
  );
  if (intro) rejected.intro = intro;

  const weeks = Array.isArray(narrative.weeks) ? narrative.weeks : [];
  let weekRejections = 0;
  for (let index = 0; index < 4; index += 1) {
    const problem = pieceProblem(weeks[index], NARRATIVE_LENGTH_CAPS.planWeek, context, false);
    if (problem) {
      rejected[`week.${index}`] = problem;
      weekRejections += 1;
    }
  }

  const closing = pieceProblem(narrative.closing, NARRATIVE_LENGTH_CAPS.planClosing, context, false);
  if (closing) rejected.closing = closing;

  const failed = Boolean(rejected.intro) || Boolean(rejected.closing) || weekRejections >= 2;

  return { rejected, rejectedPieces: Object.keys(rejected), failed };
}
