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

/** Tendencies summary from the synthesized modality profile, included
 * in report facts only when the child has enough diverse signals. */
export interface LearnerProfileFacts {
  /** e.g. "tends to respond well to kinesthetic approaches for math, auditory for reading" */
  summary: string;
  /** Per-subject top modality, only subjects that pass the trust threshold. */
  bySubject: Record<string, { preferred: string; strength: string }>;
  /** Human-readable evidence basis so the writer can cite sources.
   * e.g. "Based on 5 lessons and your feedback" */
  evidenceBasis: string;
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
  /** Learner modality profile, present only when the child has enough
   * signals (3+ per modality) to surface meaningful tendencies. */
  learnerProfile: LearnerProfileFacts | null;
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
  /** Synthesized modality profile from children.profile JSONB. */
  modalityProfile?: ModalityProfileData | null;
  /** Per-modality signal type breakdown for trust thresholds. */
  modalitySignalTypes?: Array<{ modality: string; signal_type: string; count: number }>;
}

/** Raw modality profile data as stored in children.profile.modality_profile.
 * Fields are optional since the data comes from JSONB and may be partial. */
export interface ModalityProfileData {
  global?: Record<string, { weight: number; signal_count: number; last_signal: string }>;
  by_subject?: Record<string, Record<string, { weight: number; signal_count: number; last_signal: string }>>;
  updated_at?: string;
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
    learnerProfile: buildLearnerProfileFacts(
      input.modalityProfile ?? null,
      input.modalitySignalTypes ?? [],
    ),
  };
}

/**
 * Trust thresholds for the report's "How [Child] Learns" section.
 *
 * The bar is intentionally high: if the parent can't trace HOW Homa
 * knows this, the section undermines trust instead of building it.
 *
 * Rules:
 *  1. At least 5 positive signals per modality (not 3 — too easy to hit
 *     by just finalizing a few worksheets).
 *  2. At least 2 DIFFERENT signal types contributed (e.g., parent_stated +
 *     lesson_what_worked). material_finalized alone is not enough — that's
 *     just what was available, not evidence of a real preference.
 *  3. The evidence basis is cited in the report so the parent can trace it.
 */
const MIN_SIGNALS_FOR_REPORT = 5;
const MIN_SIGNAL_TYPES_FOR_REPORT = 2;

/** Signal types that count as "strong" evidence (explicit signal, not
 * just implicit material finalization). */
const EXPLICIT_SIGNAL_TYPES = new Set([
  "parent_stated",
  "lesson_what_worked",
  "memory_classified",
  "agent_observed",
]);

const MODALITY_LABELS: Record<string, string> = {
  visual: "visual",
  auditory: "auditory",
  kinesthetic: "hands-on",
  reading_writing: "reading and writing",
};

/** Human-readable names for signal type evidence citations. */
const SIGNAL_TYPE_EVIDENCE_LABELS: Record<string, string> = {
  parent_stated: "your feedback",
  lesson_what_worked: "lessons",
  memory_classified: "your observations",
  material_finalized: "completed materials",
  agent_observed: "conversations",
};

interface SignalTypeCounts {
  modality: string;
  signal_type: string;
  count: number;
}

function buildLearnerProfileFacts(
  profile: ModalityProfileData | null,
  signalTypeCounts: SignalTypeCounts[],
): LearnerProfileFacts | null {
  if (!profile?.global) return null;

  // Index signal type counts by modality for diversity checks.
  const typesByModality = new Map<string, Map<string, number>>();
  for (const row of signalTypeCounts) {
    let types = typesByModality.get(row.modality);
    if (!types) {
      types = new Map();
      typesByModality.set(row.modality, types);
    }
    types.set(row.signal_type, row.count);
  }

  /** Check whether a modality passes the trust threshold. */
  function passesThreshold(modality: string, signalCount: number): boolean {
    if (signalCount < MIN_SIGNALS_FOR_REPORT) return false;
    const types = typesByModality.get(modality);
    if (!types) return false;
    // Must have at least 2 different signal types.
    if (types.size < MIN_SIGNAL_TYPES_FOR_REPORT) return false;
    // At least one must be an explicit signal (not just material_finalized).
    let hasExplicit = false;
    for (const signalType of types.keys()) {
      if (EXPLICIT_SIGNAL_TYPES.has(signalType)) {
        hasExplicit = true;
        break;
      }
    }
    return hasExplicit;
  }

  // Build per-subject summaries with enough diverse signals.
  const bySubject: Record<string, { preferred: string; strength: string }> = {};
  for (const [subjectId, modalities] of Object.entries(profile.by_subject ?? {})) {
    const eligible = Object.entries(modalities)
      .filter(([mod, v]) => passesThreshold(mod, v.signal_count))
      .sort(([_, a], [__, b]) => b.weight - a.weight);
    if (eligible.length > 0) {
      const [mod, data] = eligible[0];
      bySubject[subjectId] = {
        preferred: MODALITY_LABELS[mod] ?? mod,
        strength: data.weight >= 0.7 ? "strong" : "moderate",
      };
    }
  }

  // Build global summary from subjects with enough data.
  const summaryParts: string[] = [];
  for (const [subjectId, pref] of Object.entries(bySubject)) {
    const subjectName = getMapSubject(subjectId)?.displayName ?? subjectId;
    summaryParts.push(
      `tends to respond well to ${pref.preferred} approaches for ${subjectName.toLowerCase()} (${pref.strength} signal)`,
    );
  }

  // Also check global modalities (subject-agnostic signals).
  if (summaryParts.length === 0) {
    const globalEligible = Object.entries(profile.global)
      .filter(([mod, v]) => passesThreshold(mod, v.signal_count))
      .sort(([_, a], [__, b]) => b.weight - a.weight)
      .slice(0, 2);
    for (const [mod, data] of globalEligible) {
      summaryParts.push(
        `tends to respond well to ${MODALITY_LABELS[mod] ?? mod} approaches (${data.weight >= 0.7 ? "strong" : "moderate"} signal)`,
      );
    }
  }

  if (summaryParts.length === 0) return null;

  // Build evidence basis citation from all signal types that contributed.
  const evidenceSources: string[] = [];
  const allTypes = new Map<string, number>();
  for (const row of signalTypeCounts) {
    allTypes.set(row.signal_type, (allTypes.get(row.signal_type) ?? 0) + row.count);
  }
  // Order by count descending, use human-readable labels.
  const sorted = [...allTypes.entries()].sort((a, b) => b[1] - a[1]);
  for (const [signalType, count] of sorted) {
    const label = SIGNAL_TYPE_EVIDENCE_LABELS[signalType];
    if (label) {
      if (signalType === "lesson_what_worked") {
        evidenceSources.push(`${count} ${count === 1 ? "lesson" : "lessons"}`);
      } else {
        evidenceSources.push(label);
      }
    }
  }
  const evidenceBasis =
    evidenceSources.length > 0
      ? `Based on ${evidenceSources.join(" and ")}`
      : "Based on observed patterns";

  return {
    summary: summaryParts.join("; "),
    bySubject,
    evidenceBasis,
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
