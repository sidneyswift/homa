import type {
  RecipeChecklistItem,
  RecipeChecklistSeverity,
} from "./recipe-checklist";

/**
 * The deterministic half of the recipe checklist review. The vision
 * reviewer answers each checklist item with a closed enum (review-artifact.ts
 * builds that schema from the recipe's items); this module turns those
 * answers into the verdict. Models judge, code verifies (founder ruling
 * 2026-07-21): the model says yes, no, or cannot_tell per item, and the
 * code alone decides what a no means, which items may hold a page back,
 * and what wording reaches the composing agent. No prose is parsed.
 *
 * Fail-open posture: an item the reviewer could not settle from the image,
 * or never answered, is recorded (as cannot_tell or unanswered, two
 * different stored values so they can be counted apart) and carried as a
 * plain "could not confirm" note rather than a failure. Only an explicit
 * no on a blocking item withholds a page.
 *
 * Two kinds of wording leave here. Blocking issues carry the
 * `Checklist (<id>)` label the skill tells Homa to look for and fix; they
 * are never relayed to a parent. Advisory and unconfirmed notes are plain
 * check text with no label, because Homa is told to relay those in one
 * sentence and a parent should never read an internal token.
 */

/** The answers the model may give. */
export const CHECKLIST_ANSWERS = ["yes", "no", "cannot_tell"] as const;
export type ChecklistAnswerValue = (typeof CHECKLIST_ANSWERS)[number];

/** What gets stored: the model's answers plus "unanswered" for an item the
 * model never returned, kept distinct from cannot_tell for measurement. */
export type StoredChecklistAnswer = ChecklistAnswerValue | "unanswered";

/** A reviewer note is one sentence; anything longer is cut here rather
 * than failing the whole review on a schema bound. */
export const CHECKLIST_NOTE_MAX_CHARS = 600;

/** One answer as the reviewer returned it. */
export interface ChecklistAnswer {
  id: string;
  answer: ChecklistAnswerValue;
  /** For no or cannot_tell: what the reviewer saw, one sentence. */
  note: string;
}

/** An answer joined to the item it answers, so the stored record still
 * reads correctly after the recipe's wording changes. */
export interface VerifiedChecklistAnswer {
  id: string;
  answer: StoredChecklistAnswer;
  note: string;
  severity: RecipeChecklistSeverity;
  check: string;
}

export interface ChecklistVerdict {
  /** False only when a blocking item was answered no. */
  pass: boolean;
  /** Blocking items answered no, worded for the composing agent with the
   * Checklist (<id>) label. Never relayed to a parent. */
  issues: string[];
  /** Advisory items answered no, in plain words (the check text and the
   * reviewer's note), safe for Homa to relay in one sentence. */
  advisory: string[];
  /** Items the reviewer could not settle or never answered: the plain
   * check text, for a "could not confirm" sentence. */
  unconfirmed: string[];
  /** One entry per checklist item, in recipe order. */
  answers: VerifiedChecklistAnswer[];
  /** Ids the model answered more than once (the first answer stands),
   * recorded for measurement; the verdict is unchanged by them. */
  duplicateIds: string[];
}

/** The prefix the skill tells Homa to look for in an issues list. */
export function checklistIssueLabel(id: string): string {
  return `Checklist (${id})`;
}

function trimNote(note: string): string {
  const trimmed = note.trim();
  return trimmed.length > CHECKLIST_NOTE_MAX_CHARS
    ? `${trimmed.slice(0, CHECKLIST_NOTE_MAX_CHARS - 1)}…`
    : trimmed;
}

function withNote(text: string, note: string): string {
  return note.length > 0 ? `${text} Reviewer: ${note}` : text;
}

/**
 * verifyChecklistAnswers(items, answers): the verdict for one reviewer
 * call. Answers are keyed by id, the first occurrence of an id wins (later
 * ones are recorded in duplicateIds), ids that are not checklist items are
 * dropped, and an item with no answer is stored as "unanswered" and
 * treated like cannot_tell. The chunk's pass is the model's pass AND this
 * verdict's pass.
 */
export function verifyChecklistAnswers(
  items: readonly RecipeChecklistItem[],
  answers: readonly ChecklistAnswer[] | undefined,
): ChecklistVerdict {
  const known = new Set(items.map((item) => item.id));
  const byId = new Map<string, ChecklistAnswer>();
  const duplicateIds: string[] = [];
  for (const answer of answers ?? []) {
    if (!known.has(answer.id)) continue;
    if (byId.has(answer.id)) {
      if (!duplicateIds.includes(answer.id)) duplicateIds.push(answer.id);
      continue;
    }
    byId.set(answer.id, answer);
  }

  const verdict: ChecklistVerdict = {
    pass: true,
    issues: [],
    advisory: [],
    unconfirmed: [],
    answers: [],
    duplicateIds,
  };
  for (const item of items) {
    const answered = byId.get(item.id);
    const answer: StoredChecklistAnswer = answered?.answer ?? "unanswered";
    const note = trimNote(answered?.note ?? "");
    verdict.answers.push({
      id: item.id,
      answer,
      note,
      severity: item.severity,
      check: item.check,
    });
    if (answer === "yes") continue;
    if (answer === "cannot_tell" || answer === "unanswered") {
      verdict.unconfirmed.push(item.check);
      continue;
    }
    if (item.severity === "blocking") {
      verdict.pass = false;
      verdict.issues.push(
        withNote(`${checklistIssueLabel(item.id)}: ${item.check}`, note),
      );
    } else {
      verdict.advisory.push(withNote(item.check, note));
    }
  }
  return verdict;
}
