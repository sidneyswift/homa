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
 * or never answered, is recorded as an advisory note rather than a
 * failure. Only an explicit no on a blocking item withholds a page.
 */

export const CHECKLIST_ANSWERS = ["yes", "no", "cannot_tell"] as const;
export type ChecklistAnswerValue = (typeof CHECKLIST_ANSWERS)[number];

/** One answer as the reviewer returned it. */
export interface ChecklistAnswer {
  id: string;
  answer: ChecklistAnswerValue;
  /** For no or cannot_tell: what the reviewer saw, one sentence. */
  note: string;
}

/** An answer joined to the item it answers, so the stored record still
 * reads correctly after the recipe's wording changes. */
export interface VerifiedChecklistAnswer extends ChecklistAnswer {
  severity: RecipeChecklistSeverity;
  check: string;
}

export interface ChecklistVerdict {
  /** False only when a blocking item was answered no. */
  pass: boolean;
  /** Blocking items answered no, worded for the composing agent. */
  issues: string[];
  /** Advisory items answered no, plus every item the reviewer could not
   * settle: named and carried beside the page, never holding it back. */
  advisory: string[];
  /** One entry per checklist item, in recipe order, missing answers
   * recorded as cannot_tell. */
  answers: VerifiedChecklistAnswer[];
}

/** The prefix the skill tells Homa to look for in an issues list. */
export function checklistIssueLabel(id: string): string {
  return `Checklist (${id})`;
}

function withNote(text: string, note: string): string {
  const trimmed = note.trim();
  return trimmed.length > 0 ? `${text} Reviewer: ${trimmed}` : text;
}

/**
 * verifyChecklistAnswers(items, answers): the verdict for one reviewer
 * call. Answers are keyed by id, the first occurrence of an id wins, ids
 * that are not checklist items are dropped, and an item with no answer
 * is treated as cannot_tell. The chunk's pass is the model's pass AND
 * this verdict's pass.
 */
export function verifyChecklistAnswers(
  items: readonly RecipeChecklistItem[],
  answers: readonly ChecklistAnswer[] | undefined,
): ChecklistVerdict {
  const byId = new Map<string, ChecklistAnswer>();
  for (const answer of answers ?? []) {
    if (!byId.has(answer.id)) byId.set(answer.id, answer);
  }

  const verdict: ChecklistVerdict = { pass: true, issues: [], advisory: [], answers: [] };
  for (const item of items) {
    const answered = byId.get(item.id);
    const answer: ChecklistAnswerValue = answered?.answer ?? "cannot_tell";
    const note = answered?.note ?? "";
    verdict.answers.push({
      id: item.id,
      answer,
      note,
      severity: item.severity,
      check: item.check,
    });
    const label = checklistIssueLabel(item.id);
    if (answer === "yes") continue;
    if (answer === "cannot_tell") {
      const trimmed = note.trim();
      verdict.advisory.push(
        trimmed.length > 0
          ? `${label} could not be confirmed from the image: ${trimmed}`
          : `${label} could not be confirmed from the image.`,
      );
      continue;
    }
    const text = withNote(`${label}: ${item.check}`, note);
    if (item.severity === "blocking") {
      verdict.pass = false;
      verdict.issues.push(text);
    } else {
      verdict.advisory.push(text);
    }
  }
  return verdict;
}
