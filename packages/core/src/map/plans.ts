import { ageLabel } from "./bands";
import {
  getMapSubject,
  growingActivityFor,
  MAP_BANK_VERSION,
  MAP_SUBJECTS,
} from "./bank";
import { selectSubjectPlanTargets } from "./lesson-target";
import { scoreMap, type MapAnswerInput } from "./scoring";

/**
 * The four-week plan builder (founder ruling from the read-through:
 * "let's create curriculums... test your metric in four weeks"). Pure and
 * deterministic: the child's answers set the starting line, the bank's
 * ladder sets the two focus skills, interests flavor the practice, and the
 * family's homeschool style bends the tone. Zero model calls, so every
 * sentence below was written and reviewed by a person.
 *
 * Voice laws apply: growth framing, offers never commands, no deficit
 * words, temporal never causal ("retest and see what moved", never a
 * promised outcome).
 */

export interface PlanWeek {
  week: number;
  focus: string;
  activities: string[];
}

export interface FourWeekPlan {
  subjectId: string;
  subjectName: string;
  childAgeLabel: string;
  /** The strongest confirmed skill, the honest starting line. */
  startingLine: string | null;
  /** The two skills the four weeks aim at, in order. */
  targets: string[];
  weeks: PlanWeek[];
  /** One line explaining how the plan bends to the family, when context exists. */
  styleNote: string | null;
  bankVersion: string;
}

export interface PlanContext {
  interests?: string[];
  style?: string;
  curriculums?: string[];
}

/**
 * Per-subject practice patterns, parametrized by the target skill and an
 * interest. Three per subject: a daily-rhythm rep, a make-it-theirs rep,
 * and an out-in-the-world rep (the read-through's museum instinct, kept
 * generic: no local-data engine exists yet, by design).
 */
const PRACTICE_PATTERNS: Record<string, readonly [string, string, string]> = {
  math: [
    "Ten minutes a day of {skill}, played not taught: dice, cards, cooking, keeping score.",
    "Let {interest} carry the math: count it, sort it, add it, chart it.",
    "One real {skill} moment a day, at the store or in the kitchen, and they own it.",
  ],
  literacy: [
    // "The quiet goal is {skill}", never "{skill} is the quiet goal":
    // skill statements carry their own comma clauses, and a clause that
    // does not end the sentence garden-paths ("...a cereal box is the
    // quiet goal", copy-editor gate 2026-07-11).
    "Fifteen minutes of reading a day, same couch, same time, their pick. The quiet goal is {skill}.",
    // Plain fact, not "count double": on a page of literal check-offs a
    // scoring metaphor reads as a real mechanic (same gate).
    "Reach for books, articles, or comics about {interest}: they'll finish them.",
    "Library trip: they pick anything about {interest}, you sneak in one that stretches toward {skill}.",
  ],
  phonics: [
    "Five minutes of sound play a day aimed at {skill}: in the car, in the bath. No table needed.",
    "Sound out the words of {interest} together, one at a time.",
    "During read-alouds, they read every word you point at. Point only at words that practice {skill}.",
  ],
  writing: [
    "One tiny real write a day aimed at {skill}: a list, a sign, a text to grandma.",
    "A {interest} journal: two sentences a day. The topic motivates, {skill} grows.",
    "Mail something weekly: a letter or card to a real person. Envelopes make kids want to write.",
  ],
  language: [
    "Dinner-table turns: two minutes each about the day. {skill} practice nobody calls practice.",
    "Interview them about {interest}, then swap. Real questions, real back-and-forth.",
    "One retell a day: they tell someone who wasn't there what happened. That builds {skill}.",
  ],
  science: [
    "One kitchen experiment a week, plus a daily 'what do you notice?'. Both build {skill}.",
    "One why-question about {interest} a day, then find out together.",
    "A weekly wander (yard, park, or a museum morning) with one thing to observe for {skill}.",
  ],
  social_studies: [
    "One map moment a day: where dinner came from, where grandma lives, where {interest} happens.",
    "One true story from the past each week, tied to {interest}, then talk about {skill}.",
    "One field trip this month (a historic spot, a museum, city hall) pointed at {skill}.",
  ],
  art: [
    "Ten minutes of making a day, with {skill} as the quiet stretch. Mess allowed.",
    "Draw or build {interest} three ways this week: from memory, from a picture, from life.",
    "An artist date: a gallery, a mural walk, or one great art book. Then make something at the table.",
  ],
  music: [
    "Five minutes of music play a day aimed at {skill}: clap it, hum it, tap it.",
    "Find songs about {interest}, learn one together, and notice what the music does.",
    "One live-music moment this month, busker to concert, then talk about what you heard.",
  ],
  gross_motor: [
    "Twenty minutes of movement a day that sneaks up on {skill}: chase games, obstacle courses.",
    "Build the game around {interest} and let {skill} hide inside it.",
    "One bigger outing a week: playground, pool, trail, field, with one playful rep of {skill}.",
  ],
  fine_motor: [
    "Five minutes of hand work a day aimed at {skill}: tongs, beads, tape, dough, real tools.",
    "Build {interest} small: models, crafts, and kits are {skill} practice in disguise.",
    "Give real jobs: pouring, spreading, buttoning, fixing. The house is the best fine-motor gym.",
  ],
  social_emotional: [
    "Name one feeling a day out loud (yours count too). It builds {skill} without a lecture.",
    "In {interest} stories, when a character struggles, wonder together what they felt and what helped.",
    "One peer moment a week (park day, co-op, cousins) with a quiet eye on {skill}.",
  ],
  self_care: [
    "Hand over one real job this week aimed at {skill}. Don't redo it. Done beats perfect.",
    "Make a checklist they own. The list does the nagging so you don't.",
    "Race the clock, never each other: beat yesterday's time at {skill}.",
  ],
  executive_function: [
    "One backwards plan a week: something they want, on paper, steps worked out together. That's {skill}.",
    "They run one {interest} project start to finish this month. You consult. {skill} grows.",
    "A family calendar they update themselves: one entry a day builds {skill} quietly.",
  ],
  spanish: [
    "Ten minutes of the language a day aimed at {skill}: a song, a show with subtitles, a phrase used for real.",
    "Learn the words for {interest} first. Motivation is half of vocabulary.",
    "One out-loud win a day: a greeting, an order, a question used with a real person.",
  ],
  computer_science: [
    "Ten minutes of building a day aimed at {skill}: blocks of code, not worksheets.",
    "Let {interest} pick the project: a game about it, an animation, a quiz. {skill} rides along.",
    "One real automation this week (a timer, a shortcut, a spreadsheet formula), built together, then theirs.",
  ],
};

const STYLE_NOTES: Record<string, string> = {
  montessori: "Shaped for a Montessori home: real materials, real jobs, child-led pace.",
  charlotte_mason: "Shaped for a Charlotte Mason home: short lessons, living books, narration, time outdoors.",
  classical: "Shaped for a classical home: memory first, then understanding, then expression.",
  reggio: "Shaped Reggio-style: follow their questions, document what they find.",
  waldorf: "Shaped for a Waldorf home: rhythm, story, handwork, warmth before worksheets.",
  unit_studies: "Shaped for unit studies: fold these into your current theme.",
  unschooling: "Shaped for an unschooling home: everything here is an invitation, never an assignment.",
  eclectic: "Shaped for an eclectic home: take what fits, drop what doesn't.",
  traditional: "Shaped for a traditional home: short daily slots that fit a planner.",
};

function fill(template: string, skill: string, interest: string): string {
  const filled = template.replaceAll("{skill}", skill).replaceAll("{interest}", interest);
  // A gerund landing at a sentence start must be capitalized
  // ("their pick. reading..." reads broken).
  return filled.replace(/(^|[.!?] )([a-z])/g, (_m, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Third-person verb to gerund: "knows" to "knowing", "writes" to
 * "writing", "runs" to "running", "studies" to "studying". */
function gerundize(word: string): string {
  // Hyphenated verbs conjugate their last segment (skip-counts).
  const hyphen = word.lastIndexOf("-");
  if (hyphen > 0) return word.slice(0, hyphen + 1) + gerundize(word.slice(hyphen + 1));
  if (!/^[a-z]+s$/.test(word)) return word;

  let stem: string;
  if (word.endsWith("ies")) stem = `${word.slice(0, -3)}y`;
  else if (/(sses|shes|ches|xes|zes)$/.test(word)) stem = word.slice(0, -2);
  else stem = word.slice(0, -1);

  if (stem.endsWith("ie")) return `${stem.slice(0, -2)}ying`;
  if (stem.endsWith("e") && !stem.endsWith("ee")) return `${stem.slice(0, -1)}ing`;
  // Short consonant-vowel-consonant verbs double the last letter (run, cut).
  //
  // Only ONE-syllable ones. English doubles for a stressed final
  // syllable, and a two-syllable verb ending the same way does not:
  // "open" matched the letter pattern and shipped "openning" into a
  // parent's week plan (walk 007, 2026-07-29). Counting vowel groups is
  // a good enough stand-in for counting syllables on this bank's verbs.
  const vowelGroups = stem.match(/[aeiou]+/g) ?? [];
  if (
    stem.length <= 4 &&
    vowelGroups.length === 1 &&
    /[^aeiou][aeiou][^aeiouwxy]$/.test(stem)
  ) {
    return `${stem}${stem.slice(-1)}ing`;
  }
  return `${stem}ing`;
}

/** A verb token, hyphens included, as the bank writes them (skip-counts). */
const LEADING_VERB = /^[a-z]+(?:-[a-z]+)*s\b/;
/** The next verb in a coordination: ", verb", " and verb", ", or verb". */
const COORDINATED_VERB = /^(,?\s+(?:and|or)\s+|,\s+)([a-z]+(?:-[a-z]+)*s)\b/;

/**
 * Every verb in a leading coordination becomes a gerund, not just the
 * first, so a plan activity reads as one sentence.
 *
 * Ten of the bank's 224 statements open with a verb series, and each of
 * them shipped broken after "ten minutes a day of..." (walk 007,
 * 2026-07-29): "adding and subtracts small numbers", "getting and uses
 * figurative language", and, where a comma blocked conversion outright,
 * "adds, subtracts, and compares fractions".
 *
 * Only a comma or an explicit and/or continues the run. That is what
 * keeps a plural noun from being conjugated: "knows letters and sounds"
 * is separated by a plain space, so it converts "knows" alone and
 * "sounds" stays a noun.
 */
function gerundizeLeadingVerbs(phrase: string): string {
  const first = phrase.match(LEADING_VERB);
  if (!first) return phrase;
  let out = gerundize(first[0]);
  let rest = phrase.slice(first[0].length);
  for (;;) {
    const next = rest.match(COORDINATED_VERB);
    if (!next) break;
    out += `${next[1]}${gerundize(next[2])}`;
    rest = rest.slice(next[0].length);
  }
  return out + rest;
}

/**
 * A skill statement shaped to read naturally inside a sentence:
 *   1. examples after a colon drop ("...with control: measures, chops"),
 *   2. a trailing second verb clause drops ("reads a novel and follows
 *      the plot" keeps "reads a novel"), list items ("beginning, middle,
 *      and end") survive because "end" is not a verb,
 *   3. the leading third-person verb becomes a gerund ("knows
 *      multiplication facts" reads as "knowing multiplication facts"
 *      after "ten minutes a day of...").
 */
export function skillPhrase(statement: string): string {
  let phrase = lowerFirst(statement);

  if (phrase.length > 45) {
    const colon = phrase.indexOf(":");
    if (colon > 20) phrase = phrase.slice(0, colon);
  }
  if (phrase.length > 45) {
    const andClause = /,? and ([a-z]+s)\b/g;
    let cutAt = -1;
    for (const match of phrase.matchAll(andClause)) {
      if ((match.index ?? 0) > 20) cutAt = match.index ?? -1;
    }
    if (cutAt > 20) phrase = phrase.slice(0, cutAt);
  }

  return gerundizeLeadingVerbs(phrase);
}

/** The pseudo-domain id the unified month plan stores under. */
export const MONTH_PLAN_SUBJECT = "month";

/**
 * How far ahead of a skill's typical age a child is assumed to have it
 * comfortably rather than to be working on it.
 *
 * A year, because the bank's typicalMonths is when a skill usually
 * ARRIVES, and a child a year past that is not still practising it.
 */
const TYPICAL_MASTERY_LEAD_MONTHS = 12;

/**
 * typicalAnswersForAge(ageMonths): what a child of exactly this age
 * would most likely answer, derived from the bank's own typicalMonths.
 *
 * The point is a real plan from a name and a birthday alone, before a
 * parent has answered anything (founder ask, 2026-07-29: "the baseline
 * is the kid's name and the kid's age"). buildMonthPlan returns null on
 * zero answers, so without this there is nothing to show her until she
 * has tapped at least once.
 *
 * Deliberately a derivation and not a stored template. A seeded table
 * would be a second copy of the bank that goes stale the first time an
 * item's typicalMonths moves, and it would let the preview drift from
 * the plan it is previewing. Same function, same output shape, no drift
 * possible.
 *
 * Measured against real answer profiles across ten ages: for a child
 * typical for their age this reproduces the answered plan exactly, 100%
 * of targets and 100% of activities. It diverges only for a child well
 * ahead of their age, where about two thirds of activities still hold.
 * See docs/homa-planning/plans/2026-07-29-onboarding-week-fills.md §9.
 */
export function typicalAnswersForAge(ageMonths: number): MapAnswerInput[] {
  return MAP_SUBJECTS.flatMap((subject) =>
    subject.items.map((item) => ({
      itemId: item.id,
      answer:
        item.typicalMonths <= ageMonths - TYPICAL_MASTERY_LEAD_MONTHS
          ? ("easily" as const)
          : item.typicalMonths <= ageMonths
            ? ("getting_there" as const)
            : ("not_yet" as const),
    })),
  );
}

/**
 * buildAgeTemplatePlan(ageMonths, context): the month a typical child of
 * this age would get, from age alone.
 *
 * Real in every sense that matters: the same builder, the same activity
 * text, the same shape, and her child's interests already woven in. What
 * it is NOT is a claim about her child, because nobody has said anything
 * about her child yet. Whatever renders this owes her that distinction
 * in words; the honesty rules do not bend just because the activities
 * are genuine.
 */
export function buildAgeTemplatePlan(
  ageMonths: number,
  context: PlanContext = {},
): FourWeekPlan | null {
  return buildMonthPlan(ageMonths, typicalAnswersForAge(ageMonths), context);
}

/**
 * blendTypicalWithAnswers(ageMonths, given): the typical answers for
 * this age, with everything she has actually said written over the top.
 *
 * This is the delta closing, one answer at a time, and it exists
 * because the obvious approach looked wrong on a walk. Showing the
 * template until she answers and the answered plan afterwards means the
 * month goes from three focus subjects to ONE the moment she finishes
 * her first subject, then climbs back: she watches her month shrink
 * immediately after helping, which reads as having made it worse
 * (2026-07-29).
 *
 * Blending keeps the month whole the whole way through. Every subject
 * always has an answer behind it, hers where she has given one and the
 * typical one where she has not, so the plan converges on her child
 * instead of collapsing and refilling.
 *
 * A skip is not an answer and never overrides: she declined to say,
 * which is different from saying no, and the typical answer remains the
 * better guess.
 */
export function blendTypicalWithAnswers(
  ageMonths: number,
  given: readonly MapAnswerInput[],
): MapAnswerInput[] {
  const said = new Map(
    given.filter((entry) => entry.answer !== "skip").map((entry) => [entry.itemId, entry.answer]),
  );
  return typicalAnswersForAge(ageMonths).map((typical) => ({
    itemId: typical.itemId,
    answer: said.get(typical.itemId) ?? typical.answer,
  }));
}

/** Core subjects always keep presence in a month (the read-through
 * ruling: "a kid can't not do math and literacy for an entire month");
 * everything else is an elective that sprinkles in as joy. */
const ELECTIVE_SUBJECTS = new Set(["art", "music", "spanish", "computer_science"]);

/**
 * The unified month (read-through ruling 2026-07-08: ONE four-week plan
 * for the whole child, not sixteen). Weighted the way Alessa ruled: the
 * growing CORE subjects carry the emphasis (up to three focus subjects),
 * one strength sprinkles in for joy, and the whole thing is an ADD-ON to
 * whatever the family already does, never a schedule takeover. Returns a
 * FourWeekPlan shaped like any other so storage, narrative, and retest
 * machinery need no new paths; subjectId is MONTH_PLAN_SUBJECT.
 */
export function buildMonthPlan(
  ageMonths: number,
  answers: MapAnswerInput[],
  context: PlanContext = {},
): FourWeekPlan | null {
  const scores = scoreMap(ageMonths, answers);

  const growingCores = scores.subjects.filter(
    (score) =>
      score.position === "growing" &&
      !score.exposureBased &&
      !ELECTIVE_SUBJECTS.has(score.subjectId),
  );
  // Fill to at least two focuses with the lowest on-track cores, so a
  // strong kid still gets a month that keeps things moving.
  const onTrackCores = scores.subjects
    .filter(
      (score) =>
        score.position === "on_track" &&
        !score.exposureBased &&
        !ELECTIVE_SUBJECTS.has(score.subjectId),
    )
    .sort((a, b) => (a.monthsAhead ?? 0) - (b.monthsAhead ?? 0));
  const focusScores = [...growingCores, ...onTrackCores].slice(0, 3);
  if (focusScores.length === 0) return null;

  // One strength sprinkle: the subject with the most months ahead,
  // electives welcome (the joy slot, never a focus slot).
  const sprinkleScore = [...scores.subjects]
    .filter((score) => score.position === "ahead" && score.monthsAhead !== null)
    .sort((a, b) => (b.monthsAhead ?? 0) - (a.monthsAhead ?? 0))[0];

  const subPlans = focusScores
    .map((score) => buildFourWeekPlan(score.subjectId, ageMonths, answers, context))
    .filter((plan): plan is FourWeekPlan => plan !== null);
  if (subPlans.length === 0) return null;
  const sprinklePlan = sprinkleScore
    ? buildFourWeekPlan(sprinkleScore.subjectId, ageMonths, answers, context)
    : null;

  const targets = subPlans.map((plan) => `${plan.subjectName}: ${plan.targets[0]}`);
  const startingLine = subPlans.find((plan) => plan.startingLine)?.startingLine ?? null;

  const weeks: PlanWeek[] = [1, 2, 3, 4].map((week) => {
    const activities: string[] = [];
    for (const plan of subPlans) {
      const source = plan.weeks[week - 1];
      // One activity per focus subject per week, rotating through each
      // subject's own patterns so the month stays light on purpose
      // ("the lowest amount of effort that moves a number").
      const pick = source.activities[(week - 1) % source.activities.length];
      activities.push(`${plan.subjectName}: ${pick}`);
    }
    if (sprinklePlan && (week === 1 || week === 4)) {
      const source = sprinklePlan.weeks[week - 1];
      activities.push(
        `${sprinklePlan.subjectName} (already a strength, keep the joy): ${source.activities[0]}`,
      );
    }
    return {
      week,
      // Subject names, not three concatenated target statements: the
      // formal targets live in the plan's targets list already. Comma
      // separated: plus signs read as a third symbol vocabulary next to
      // the planner's mid-dots and chips (copy-editor gate 2026-07-11).
      focus: subPlans.map((plan) => plan.subjectName.toLowerCase()).join(", "),
      activities,
    };
  });

  return {
    subjectId: MONTH_PLAN_SUBJECT,
    subjectName: "the whole month",
    childAgeLabel: ageLabel(ageMonths),
    startingLine,
    targets,
    weeks,
    styleNote: context.style ? (STYLE_NOTES[context.style] ?? null) : null,
    bankVersion: MAP_BANK_VERSION,
  };
}

/**
 * Builds the four-week plan for one subject from the child's answers.
 * Week 1-2 aim at the first unconfirmed skill (the frontier), week 3-4 at
 * the rung above it; strong subjects extend upward from the ladder's top.
 */
export function buildFourWeekPlan(
  subjectId: string,
  ageMonths: number,
  answers: MapAnswerInput[],
  context: PlanContext = {},
): FourWeekPlan | null {
  const domain = getMapSubject(subjectId);
  if (!domain) return null;
  const selectedTargets = selectSubjectPlanTargets(subjectId, ageMonths, answers);
  if (!selectedTargets) return null;
  const { startingLine, targets } = selectedTargets;

  const interest = context.interests?.[0] ?? "whatever they love most right now";
  const patterns = PRACTICE_PATTERNS[subjectId] ?? PRACTICE_PATTERNS.math;
  const activity = growingActivityFor(domain, ageMonths);

  const weeks: PlanWeek[] = [1, 2, 3, 4].map((week) => {
    const focus = week <= 2 ? targets[0] : (targets[1] ?? targets[0]);
    const skill = skillPhrase(focus);
    const base = [
      fill(patterns[0], skill, interest),
      fill(patterns[1], skill, interest),
    ];
    // Title joins with a period, not a colon: activity descriptions
    // carry their own colons ("hunt it everywhere: cereal boxes..."),
    // and two colons stack three structures into one sentence
    // (copy-editor gate 2026-07-11).
    if (week === 1) base.push(`${activity.title}. ${activity.description}`);
    if (week === 2 || week === 4) base.push(fill(patterns[2], skill, interest));
    if (week === 3) base.push("A lighter week is normal. Repeat the favorite from weeks 1 and 2.");
    return { week, focus, activities: base };
  });

  return {
    subjectId,
    subjectName: domain.displayName,
    childAgeLabel: ageLabel(ageMonths),
    startingLine,
    targets,
    weeks,
    styleNote: context.style ? (STYLE_NOTES[context.style] ?? null) : null,
    bankVersion: MAP_BANK_VERSION,
  };
}
