import {
  ageInMonths,
  ageLabel,
  subjectLine,
  GENDERED_PRONOUNS,
  getMapItem,
  getMapSubject,
  growingActivityFor,
  type MapAnswer,
  type MapScores,
} from "@homa/core";

/**
 * Pure assembly of the facts payload the report writer writes around
 * (D8 overturn: code computes every number, the model writes every word).
 * Everything here is computed by the deterministic layer; the generated
 * prose may only contain numbers that appear in this payload, enforced by
 * the narrative gate via allowedNumbers. NO last names, no emails, no
 * state, no ids beyond subject ids, and no sibling names ever enter the
 * payload (siblings exist only in the gate context).
 */

export interface SubjectFacts {
  subjectId: string;
  subjectName: string;
  position: "ahead" | "on_track" | "growing" | "not_mapped";
  badge: string;
  monthsAhead: number | null;
  /** True when monthsAhead is a floor, not the measurement: the child
   * confirmed skills past the display cap, or past the last question the
   * checklist has for this subject. The writer says so plainly. */
  numberIsFloor: boolean;
  exposureBased: boolean;
  observations: number;
  /** The strongest thing the parent confirmed she has seen. */
  confirmedSkill: string | null;
  /** The specific named next step (the frontier), when one exists. */
  nextStep: string | null;
  /** Every question asked in this subject, her answer, and the age the
   * skill is typical by. */
  asked: Array<{ question: string; answer: string; typicalBy: string }>;
  /** Raw material for the five-minute activity suggestion. */
  growingActivity: { title: string; description: string } | null;
}

/** One answer that changed between the previous scoring and this one
 * (shape mirrors narrative-store's evidence read; kept local so this
 * module stays pure and import-cycle-free). */
export interface ChangedAnswerFactInput {
  itemId: string;
  answer: MapAnswer;
  previousAnswer: MapAnswer | null;
  source: string;
}

/**
 * Why this report was rewritten and what moved, computed by code so the
 * writer can acknowledge the recalibration instead of writing a
 * stateless letter (founder ask 2026-07-14: after a deeper look, the
 * report says "we read language again from your deeper answers" and
 * names the before and after in the report's own vocabulary).
 */
export interface RescoreFacts {
  /** One quotable sentence naming why the rewrite exists. */
  reasonLine: string;
  /** The specific answers that changed, capped, report vocabulary. */
  changedAnswers: Array<{
    subjectName: string;
    question: string;
    was: string | null;
    now: string;
  }>;
  /** Before and after reading for each subject whose answers changed,
   * in the report's own badge vocabulary ("Growing right now",
   * "On track", "Ahead · +9 mo"). A lower after is a sharper starting
   * line, never a loss; the writer's instructions carry that framing. */
  subjectShifts: Array<{ subjectName: string; was: string; now: string }>;
}

export interface ReportFacts {
  childName: string;
  childAge: string;
  childAgeMonths: number;
  /** The pronoun instruction, computed by code (we never ask a child's
   * sex): "they/them" unless the parent's own words in these facts
   * gender the child. The writer obeys this field literally. */
  childPronouns: string;
  parentFirstName: string | null;
  interests: string[];
  helpWith: string[];
  /** The parent's own whats-working notes, keyed by subject name. */
  whatsWorking: Record<string, string>;
  observationCount: number;
  mappedCount: number;
  totalSubjects: number;
  /** Movement lines computed by code from report history, ready to quote. */
  movement: string[];
  /** Practice lines computed by code from the plans' synced check-offs
   * ("You checked off 12 of 16 math plan activities"), temporal never
   * causal; empty until a month has memory. */
  practice: string[];
  /** The previous letter Homa wrote for this child (from the history
   * archive), so each rescore writes chapter N of a correspondence, not a
   * stateless first letter. Null on a first report. */
  lastLetter: { date: string; note: string } | null;
  /** Why this rewrite exists and what moved; null on a first report and
   * on rescores where no answer actually changed. */
  rescore: RescoreFacts | null;
  subjects: SubjectFacts[];
}

export interface PlanFacts {
  childName: string;
  childAge: string;
  /** Same pronoun instruction as the report facts; obey literally. */
  childPronouns: string;
  subjectName: string;
  interests: string[];
  homeschoolStyle: string | null;
  /** The parent's own whats-working notes, keyed by subject name, ALL
   * subjects on purpose: what works in her strong subject is the month's
   * best borrowed strategy (the fold-it-into-the-plans promise, kept). */
  whatsWorking: Record<string, string>;
  /** Curriculum names the family already uses, quotable verbatim. */
  curriculums: string[];
  /** What the parent asked for help with, from the extras step. */
  helpWith: string[];
  /** The strongest confirmed skill, the honest starting line (or null:
   * starting fresh). */
  startingLine: string | null;
  targets: string[];
  weeks: Array<{ week: number; focus: string; activities: string[] }>;
}

const ANSWER_LABELS: Record<MapAnswer, string> = {
  easily: "Easily",
  getting_there: "Getting there",
  not_yet: "Not yet",
  not_sure: "Not sure",
  skip: "Skipped",
};

const POSITION_RANK = { not_mapped: 0, growing: 1, on_track: 2, ahead: 3 } as const;

export interface ReportFactsInput {
  childName: string;
  birthMonth: string;
  parentFirstName: string | null;
  interests: string[];
  helpWith: string[];
  /** context.whatsWorking bag, keyed by subjectId. */
  whatsWorkingBySubject: Record<string, string>;
  scores: MapScores;
  answers: Array<{ itemId: string; answer: MapAnswer }>;
  history: Array<{ scores: MapScores; generated_at: string }>;
  /** The archived previous narrative (history head), when one exists. */
  priorLetter?: { generatedAt: string; note: string } | null;
  /** Synced plan check-off counts, one row per subject with any checks. */
  practice?: Array<{ subjectName: string; done: number; total: number }>;
  /** Answers that landed or changed since the previous scoring, from
   * the evidence ledger (narrative-store reads it). */
  changedSinceLastScoring?: ChangedAnswerFactInput[];
}

/** Movement lines, same math as the report UI's movement chips: dated,
 * positive-only (anti-guilt law: a drop is never written down). */
function movementLines(scores: MapScores, history: ReportFactsInput["history"]): string[] {
  const prior = history[0];
  if (!prior) return [];
  const since = new Date(prior.generated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const lines: string[] = [];
  for (const current of scores.subjects) {
    if (current.exposureBased) continue;
    const previous = prior.scores.subjects.find((entry) => entry.subjectId === current.subjectId);
    if (!previous) continue;
    const subjectName = getMapSubject(current.subjectId)?.displayName ?? current.subjectId;
    if (
      current.monthsAhead !== null &&
      previous.monthsAhead !== null &&
      current.monthsAhead > previous.monthsAhead
    ) {
      lines.push(
        `${subjectName} moved up ${current.monthsAhead - previous.monthsAhead} months since ${since}`,
      );
    } else if (POSITION_RANK[current.position] > POSITION_RANK[previous.position]) {
      lines.push(`${subjectName} moved up since ${since}`);
    }
  }
  return lines;
}

const CHANGED_ANSWER_CAP = 12;

/** One label per subject reading, the report's own vocabulary: the
 * badge, plus the months number when the badge carries one. */
function subjectReadingLabel(
  scores: MapScores,
  subjectId: string,
  childName: string,
): string | null {
  const score = scores.subjects.find((entry) => entry.subjectId === subjectId);
  if (!score) return null;
  const line = subjectLine(score, childName);
  return line.numberLabel ? `${line.badge} (${line.numberLabel})` : line.badge;
}

function rescoreReasonLine(
  dominantSource: string,
  subjectNames: string[],
  changedCount: number,
): string {
  const subjects =
    subjectNames.length > 0
      ? listWords(subjectNames.slice(0, 3).map((name) => name.toLowerCase()))
      : "a few subjects";
  const answers = changedCount === 1 ? "1 answer" : `${changedCount} answers`;
  switch (dominantSource) {
    case "deep_dive":
      return `The parent chose a deeper ${subjects} check and gave ${answers}; this rewrite reads those in.`;
    case "report_correction":
    case "correction":
    case "report_probe":
      return `The parent corrected ${answers} on the report; this rewrite reads the corrections in.`;
    case "recheck":
      return `A re-check brought ${answers}; this rewrite reads them in.`;
    case "check_in":
    case "journal":
    case "conversation":
      return `${answers} arrived from check-ins and conversation since the last scoring; this rewrite reads them in.`;
    case "checklist":
      return `${answers} landed on the checklist since the last scoring; this rewrite reads them in.`;
    default:
      return `${answers} changed since the last scoring; this rewrite reads them in.`;
  }
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * buildRescoreFacts(changed, currentScores, priorScores, childName)
 * Null on a first report (no prior scoring) and when nothing bank-known
 * actually changed, so a plain rescore still writes a plain letter.
 */
export function buildRescoreFacts(
  changed: ChangedAnswerFactInput[],
  currentScores: MapScores,
  priorScores: MapScores | null,
  childName: string,
): RescoreFacts | null {
  if (!priorScores) return null;
  const bankChanges = changed
    .map((change) => ({ change, found: getMapItem(change.itemId) }))
    .filter(
      (entry): entry is { change: ChangedAnswerFactInput; found: NonNullable<ReturnType<typeof getMapItem>> } =>
        Boolean(entry.found),
    );
  if (bankChanges.length === 0) return null;

  const sourceCounts = new Map<string, number>();
  for (const { change } of bankChanges) {
    sourceCounts.set(change.source, (sourceCounts.get(change.source) ?? 0) + 1);
  }
  const dominantSource = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const subjectNames: string[] = [];
  const subjectIds: string[] = [];
  for (const { found } of bankChanges) {
    if (subjectIds.includes(found.subject.id)) continue;
    subjectIds.push(found.subject.id);
    subjectNames.push(found.subject.displayName);
  }

  const changedAnswers = bankChanges.slice(0, CHANGED_ANSWER_CAP).map(({ change, found }) => ({
    subjectName: found.subject.displayName,
    question: found.item.statement,
    was: change.previousAnswer ? ANSWER_LABELS[change.previousAnswer] : null,
    now: ANSWER_LABELS[change.answer],
  }));

  const subjectShifts = subjectIds.flatMap((subjectId) => {
    const now = subjectReadingLabel(currentScores, subjectId, childName);
    if (!now) return [];
    const was = subjectReadingLabel(priorScores, subjectId, childName) ?? "not read yet";
    const subjectName = getMapSubject(subjectId)?.displayName ?? subjectId;
    return [{ subjectName, was, now }];
  });

  return {
    reasonLine: rescoreReasonLine(dominantSource, subjectNames, bankChanges.length),
    changedAnswers,
    subjectShifts,
  };
}

export function buildReportFacts(input: ReportFactsInput): ReportFacts {
  const months = ageInMonths(input.birthMonth);

  const askedByDomain = new Map<string, SubjectFacts["asked"]>();
  for (const entry of input.answers) {
    const domain = getMapSubject(entry.itemId.split(".")[0]);
    if (!domain) continue;
    const item = domain.items.find((candidate) => candidate.id === entry.itemId);
    if (!item) continue;
    const list = askedByDomain.get(domain.id) ?? [];
    list.push({
      question: item.statement,
      answer: ANSWER_LABELS[entry.answer],
      typicalBy: ageLabel(item.typicalMonths),
    });
    askedByDomain.set(domain.id, list);
  }

  const subjects: SubjectFacts[] = input.scores.subjects.map((score) => {
    const domain = getMapSubject(score.subjectId);
    const line = subjectLine(score, input.childName);
    const activity =
      domain && score.position === "growing" ? growingActivityFor(domain, months) : null;
    return {
      subjectId: score.subjectId,
      subjectName: domain?.displayName ?? score.subjectId,
      position: score.position,
      badge: line.badge,
      monthsAhead: score.monthsAhead,
      numberIsFloor: score.beyondScale,
      exposureBased: score.exposureBased,
      observations: score.observations,
      confirmedSkill: score.strongestObservedStatement,
      nextStep: score.frontierStatement,
      asked: askedByDomain.get(score.subjectId) ?? [],
      growingActivity: activity,
    };
  });

  const whatsWorking: Record<string, string> = {};
  for (const [subjectId, note] of Object.entries(input.whatsWorkingBySubject)) {
    if (typeof note !== "string" || note.trim().length === 0) continue;
    const subjectName = getMapSubject(subjectId)?.displayName ?? subjectId;
    whatsWorking[subjectName] = note.trim();
  }

  const practice = (input.practice ?? [])
    .filter((entry) => entry.done > 0)
    .map(
      (entry) =>
        `You checked off ${entry.done} of ${entry.total} ${entry.subjectName.toLowerCase()} plan activities`,
    );

  const lastLetter = input.priorLetter
    ? {
        date: new Date(input.priorLetter.generatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        note: input.priorLetter.note,
      }
    : null;

  const pronounsAllowed = genderedPronounsAllowedFrom({
    whatsWorking,
    helpWith: input.helpWith,
  });

  return {
    childName: input.childName,
    childAge: ageLabel(months),
    childAgeMonths: months,
    childPronouns: childPronounsFact(pronounsAllowed, input.childName),
    parentFirstName: input.parentFirstName,
    interests: input.interests,
    helpWith: input.helpWith,
    whatsWorking,
    observationCount: input.scores.observationCount,
    mappedCount: input.scores.mappedCount,
    totalSubjects: input.scores.totalSubjects,
    movement: movementLines(input.scores, input.history),
    practice,
    lastLetter,
    rescore: buildRescoreFacts(
      input.changedSinceLastScoring ?? [],
      input.scores,
      input.history[0]?.scores ?? null,
      input.childName,
    ),
    subjects,
  };
}

/** Every digit run appearing anywhere in a facts payload: the gate's
 * allow-list. Derived from the serialized payload itself so the two can
 * never disagree. */
export function allowedNumbersFrom(facts: unknown): string[] {
  return [...new Set(JSON.stringify(facts).match(/\d+/g) ?? [])];
}

/**
 * True only when the parent's OWN words in the facts gender the child
 * (a whats-working note, a help-with entry). The product never asks a
 * child's sex, so this is the writer's only license to say he or she;
 * everything else is "they", and the gate enforces it (same derive-from-
 * the-payload pattern as allowedNumbers, so prompt and gate never drift).
 */
export function genderedPronounsAllowedFrom(parentWords: {
  whatsWorking: Record<string, string>;
  helpWith: string[];
}): boolean {
  const text = [...Object.values(parentWords.whatsWorking), ...parentWords.helpWith].join(" ");
  return GENDERED_PRONOUNS.test(text);
}

/** The literal instruction the writer receives inside the facts. */
export function childPronounsFact(allowed: boolean, childName: string): string {
  return allowed
    ? `match the parent's own words in these facts; where her words do not settle it, use they/them for ${childName}`
    : `they/them only. Never he, she, him, his, or her for ${childName}: the parent has not said, and a name is not an answer`;
}
