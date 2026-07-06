import { ageLabel } from "./bands";
import { getMapDomain, growingActivityFor, MAP_BANK_VERSION } from "./bank";
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
  domainId: string;
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
    "Fifteen minutes of reading a day, same couch, same time, their pick. {skill} is the quiet goal.",
    "Books, articles, or comics about {interest} count double, because they'll finish them.",
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
    "Find the songs of {interest}, learn one together, notice what the music does.",
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
    "Learn the words of {interest} first. Motivation is half of vocabulary.",
    "One out-loud win a day: a greeting, an order, a question used with a real person.",
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
  return template.replaceAll("{skill}", skill).replaceAll("{interest}", interest);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * A skill statement trimmed to read naturally inside a sentence: long
 * two-clause statements keep only their first clause ("skip-counts by 5s,
 * 10s, and 100s, and reads 3-digit numbers" becomes the part before the
 * final ", and").
 */
function skillPhrase(statement: string): string {
  const lowered = lowerFirst(statement);
  if (lowered.length <= 50) return lowered;
  const cut = lowered.lastIndexOf(", and ");
  return cut > 20 ? lowered.slice(0, cut) : lowered;
}

/**
 * Builds the four-week plan for one subject from the child's answers.
 * Week 1-2 aim at the first unconfirmed skill (the frontier), week 3-4 at
 * the rung above it; strong subjects extend upward from the ladder's top.
 */
export function buildFourWeekPlan(
  domainId: string,
  ageMonths: number,
  answers: MapAnswerInput[],
  context: PlanContext = {},
): FourWeekPlan | null {
  const domain = getMapDomain(domainId);
  if (!domain) return null;

  const scores = scoreMap(ageMonths, answers);
  const score = scores.domains.find((entry) => entry.domainId === domainId);
  const answered = new Map(answers.map((entry) => [entry.itemId, entry.answer]));
  const sorted = [...domain.items].sort((a, b) => a.typicalMonths - b.typicalMonths);

  // The starting line: strongest confirmed skill (if any).
  const startingLine = score?.strongestObservedStatement ?? null;

  // The highest anchor she confirmed, in months: nothing below it can be a
  // target (re-proving the obvious is busywork, not a plan).
  let reachedMonths = -Infinity;
  let lowestNotYet: number | null = null;
  for (const item of sorted) {
    const answer = answered.get(item.id);
    if (answer === "easily") reachedMonths = Math.max(reachedMonths, item.typicalMonths);
    if (answer === "getting_there") reachedMonths = Math.max(reachedMonths, item.typicalMonths - 6);
    if (answer === "not_yet" && (lowestNotYet === null || item.typicalMonths < lowestNotYet)) {
      lowestNotYet = item.typicalMonths;
    }
  }
  // With nothing confirmed, the honest aim is the named not-yet itself, not
  // the bottom of the bank (a 6-year-old's plan must never target
  // block-stacking). The deep dive refines this floor further.
  const floor = Number.isFinite(reachedMonths)
    ? reachedMonths
    : lowestNotYet !== null
      ? lowestNotYet - 1
      : -Infinity;

  // Targets: the first two rungs above the floor that aren't confirmed
  // (a not-yet names the frontier directly).
  const targets: string[] = [];
  for (const item of sorted) {
    if (targets.length >= 2) break;
    if (answered.get(item.id) === "easily") continue;
    if (item.typicalMonths <= floor) continue;
    targets.push(item.statement);
  }
  if (targets.length === 0) {
    // Everything in the bank confirmed: aim the plan at depth, not rungs.
    targets.push(`Going wider in ${domain.displayName.toLowerCase()}: past every benchmark on file`);
  }

  const interest = context.interests?.[0] ?? "whatever they love most right now";
  const patterns = PRACTICE_PATTERNS[domainId] ?? PRACTICE_PATTERNS.math;
  const activity = growingActivityFor(domain, ageMonths);

  const weeks: PlanWeek[] = [1, 2, 3, 4].map((week) => {
    const focus = week <= 2 ? targets[0] : (targets[1] ?? targets[0]);
    const skill = skillPhrase(focus);
    const base = [
      fill(patterns[0], skill, interest),
      fill(patterns[1], skill, interest),
    ];
    if (week === 1) base.push(`${activity.title}: ${lowerFirst(activity.description)}`);
    if (week === 2 || week === 4) base.push(fill(patterns[2], skill, interest));
    if (week === 3) base.push("A lighter week is normal. Repeat the favorite from weeks 1 and 2.");
    return { week, focus, activities: base };
  });

  return {
    domainId,
    subjectName: domain.displayName,
    childAgeLabel: ageLabel(ageMonths),
    startingLine,
    targets,
    weeks,
    styleNote: context.style ? (STYLE_NOTES[context.style] ?? null) : null,
    bankVersion: MAP_BANK_VERSION,
  };
}
