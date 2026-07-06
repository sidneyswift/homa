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
    "Ten minutes a day of {skill}, disguised as play: dice, cards, cooking measurements, or keeping score.",
    "Let {interest} carry the math: count it, sort it, add it, chart it. The skill sticks to what they love.",
    "Errand math: at the store or the kitchen, hand over one real {skill} moment a day and let them own it.",
  ],
  literacy: [
    "A daily 15-minute reading rhythm where {skill} is the quiet goal. Same couch, same time, their pick.",
    "Tie it to {interest}: books, articles, or comics about it count double, because they'll actually finish them.",
    "Library trip: they choose anything on the shelf that touches {interest}, you sneak one that stretches toward {skill}.",
  ],
  phonics: [
    "Five minutes of sound play a day aimed at {skill}: in the car, in the bath, no table required.",
    "Label the world of {interest}: sound out its names and words together, one at a time.",
    "A read-aloud where they take every word you point at, pointing only at words that practice {skill}.",
  ],
  writing: [
    "One small daily write aimed at {skill}: a list, a sign, a text to grandma. Tiny and real beats long and forced.",
    "A {interest} journal: two sentences a day about it. The subject does the motivating, {skill} does the growing.",
    "Mail something weekly: a letter or card to a real person. Envelopes are the best handwriting trick ever invented.",
  ],
  language: [
    "Dinner-table turns: two minutes each on the day, practicing {skill} without anyone calling it practice.",
    "Interview them about {interest} and swap: real questions, real answers, real back-and-forth.",
    "One retell a day: they tell someone who wasn't there what happened, aiming quietly at {skill}.",
  ],
  science: [
    "One kitchen-counter experiment a week plus a daily 'what do you notice?', aimed at {skill}.",
    "Chase {interest} scientifically: one why-question about it a day, then find out together.",
    "A weekly outside wander (yard, park, or a science museum morning) with one thing to observe for {skill}.",
  ],
  social_studies: [
    "One map moment a day: find where dinner came from, where grandma lives, where {interest} happens.",
    "Story time from the past: one true story a week connected to {interest}, then talk about {skill}.",
    "A field trip this month (a historic spot, a museum, city hall steps) pointed gently at {skill}.",
  ],
  art: [
    "Ten unhurried minutes of making a day, with {skill} as the quiet stretch. Product optional, mess allowed.",
    "Draw or build {interest} three ways this week: from memory, from a picture, from life.",
    "An artist date: a gallery, a mural walk, or one great art book, then make something back at the table.",
  ],
  music: [
    "Five minutes of daily music play aimed at {skill}: clap it, hum it, tap it on the table.",
    "Soundtrack {interest}: find its songs, learn one together, notice what the music is doing.",
    "One live-music moment this month, anything from a busker to a concert, then talk about what you heard.",
  ],
  gross_motor: [
    "Twenty minutes of daily movement that sneaks up on {skill}: chase games, obstacle courses, the good tired.",
    "Turn {interest} into the workout: build the game around it and let {skill} hide inside.",
    "A weekly bigger outing: playground, pool, trail, or field, with one playful rep of {skill}.",
  ],
  fine_motor: [
    "Five-minute hands sessions aimed at {skill}: tongs, beads, tape, dough, real tools with supervision.",
    "Build {interest} small: models, crafts, or kits about it are {skill} practice wearing a costume.",
    "Give real jobs: pouring, spreading, buttoning, fixing. The household is the best fine-motor gym there is.",
  ],
  social_emotional: [
    "Name one feeling a day out loud (yours count too), building toward {skill} without a single lecture.",
    "Use {interest} stories: when a character struggles, wonder together what they felt and what helped.",
    "One planned peer moment a week (park day, co-op, cousins) with a gentle eye on {skill}.",
  ],
  self_care: [
    "Hand over one real job this week aimed at {skill}, and resist the urge to redo it. Done beats perfect.",
    "Make a picture list or checklist they own. The list does the nagging so you never have to.",
    "Race the clock, never each other: beat yesterday's time at {skill} and celebrate loudly.",
  ],
  executive_function: [
    "One backwards plan a week: pick something they want, put it on paper, work out the steps together, aiming at {skill}.",
    "Let them run one {interest} project start to finish this month. You consult, they own it, {skill} grows.",
    "A visible family calendar they update themselves: one entry a day is executive function in disguise.",
  ],
  spanish: [
    "Ten minutes of daily exposure aimed at {skill}: a song, a show with subtitles, a phrase used for real.",
    "Bring {interest} into the language: its words first, because motivation is half of vocabulary.",
    "One out-loud win a day: a greeting, an order, a question actually used with a real person.",
  ],
};

const STYLE_NOTES: Record<string, string> = {
  montessori: "Shaped Montessori-friendly: real materials, real jobs, child-led pace, observation over correction.",
  charlotte_mason: "Shaped for a Charlotte Mason home: short lessons, living books, narration, and time outdoors.",
  classical: "Shaped for a classical rhythm: memory work first, then understanding, then expression.",
  reggio: "Shaped Reggio-style: follow the child's questions and document what they discover.",
  waldorf: "Shaped Waldorf-friendly: rhythm, story, handwork, and warmth before worksheets.",
  unit_studies: "Shaped for unit studies: fold these into your current theme rather than running them separately.",
  unschooling: "Shaped for an unschooling home: every activity here is an invitation, never an assignment.",
  eclectic: "Shaped for an eclectic mix: take what fits this month, drop what doesn't, nothing is precious.",
  traditional: "Shaped for a traditional structure: short daily slots that fit a planner beautifully.",
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
  for (const item of sorted) {
    const answer = answered.get(item.id);
    if (answer === "easily") reachedMonths = Math.max(reachedMonths, item.typicalMonths);
    if (answer === "getting_there") reachedMonths = Math.max(reachedMonths, item.typicalMonths - 6);
  }

  // Targets: the first two rungs above everything confirmed that aren't
  // themselves confirmed (a not-yet names the frontier directly).
  const targets: string[] = [];
  for (const item of sorted) {
    if (targets.length >= 2) break;
    if (answered.get(item.id) === "easily") continue;
    if (item.typicalMonths <= reachedMonths) continue;
    targets.push(item.statement);
  }
  if (targets.length === 0) {
    // Everything in the bank confirmed: aim the plan at depth, not rungs.
    targets.push(`Going deeper and wider in ${domain.displayName.toLowerCase()}, past every benchmark on file`);
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
    if (week === 3) base.push("A lighter week is allowed and expected. Repeat the favorite from weeks 1 and 2.");
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
