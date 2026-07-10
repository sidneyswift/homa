import {
  ageInMonths,
  ageLabel,
  domainLine,
  GENDERED_PRONOUNS,
  getMapDomain,
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
  totalDomains: number;
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
  /** context.whatsWorking bag, keyed by domainId. */
  whatsWorkingByDomain: Record<string, string>;
  scores: MapScores;
  answers: Array<{ itemId: string; answer: MapAnswer }>;
  history: Array<{ scores: MapScores; generated_at: string }>;
  /** The archived previous narrative (history head), when one exists. */
  priorLetter?: { generatedAt: string; note: string } | null;
  /** Synced plan check-off counts, one row per subject with any checks. */
  practice?: Array<{ subjectName: string; done: number; total: number }>;
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
  for (const current of scores.domains) {
    if (current.exposureBased) continue;
    const previous = prior.scores.domains.find((entry) => entry.domainId === current.domainId);
    if (!previous) continue;
    const subjectName = getMapDomain(current.domainId)?.displayName ?? current.domainId;
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

export function buildReportFacts(input: ReportFactsInput): ReportFacts {
  const months = ageInMonths(input.birthMonth);

  const askedByDomain = new Map<string, SubjectFacts["asked"]>();
  for (const entry of input.answers) {
    const domain = getMapDomain(entry.itemId.split(".")[0]);
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

  const subjects: SubjectFacts[] = input.scores.domains.map((score) => {
    const domain = getMapDomain(score.domainId);
    const line = domainLine(score, input.childName);
    const activity =
      domain && score.position === "growing" ? growingActivityFor(domain, months) : null;
    return {
      subjectId: score.domainId,
      subjectName: domain?.displayName ?? score.domainId,
      position: score.position,
      badge: line.badge,
      monthsAhead: score.monthsAhead,
      numberIsFloor: score.beyondScale,
      exposureBased: score.exposureBased,
      observations: score.observations,
      confirmedSkill: score.strongestObservedStatement,
      nextStep: score.frontierStatement,
      asked: askedByDomain.get(score.domainId) ?? [],
      growingActivity: activity,
    };
  });

  const whatsWorking: Record<string, string> = {};
  for (const [domainId, note] of Object.entries(input.whatsWorkingByDomain)) {
    if (typeof note !== "string" || note.trim().length === 0) continue;
    const subjectName = getMapDomain(domainId)?.displayName ?? domainId;
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
    totalDomains: input.scores.totalDomains,
    movement: movementLines(input.scores, input.history),
    practice,
    lastLetter,
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
