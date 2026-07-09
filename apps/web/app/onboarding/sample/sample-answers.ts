import type { MapAnswerInput } from "@homa/core";

/**
 * Maya's pinned answer set (the public sample report and the narrative
 * fixture generator both read THIS list). Pinned as literal item ids on
 * purpose: the committed sample narrative was founder-reviewed against
 * these exact answers and numbers, so the sample must never drift when
 * the bank gains items or the ladder gains rungs (which is exactly what
 * happened in the 2026-07-08 accuracy pass). Regenerating the narrative
 * (scripts/map-narrative-fixtures.mts) is the only sanctioned way to
 * change what Maya's report says.
 */

export const SAMPLE_AGE_MONTHS = 50;

export const SAMPLE_ANSWERS: MapAnswerInput[] = [
  // math: solid counting, the next rung is emerging (reads on track).
  { itemId: "math.how-many-5", answer: "easily" },
  { itemId: "math.counts-past-20", answer: "getting_there" },
  // literacy: own name letters confirmed, uppercase letters not yet.
  { itemId: "literacy.own-name-letters", answer: "easily" },
  { itemId: "literacy.uppercase-half", answer: "not_yet" },
  // phonics: a two-rung climb (+8).
  { itemId: "phonics.claps-syllables", answer: "easily" },
  { itemId: "phonics.judges-rhyme", answer: "easily" },
  { itemId: "phonics.first-sound", answer: "easily" },
  // writing: not observed yet.
  { itemId: "writing.finger-grip", answer: "not_sure" },
  // language: a two-rung climb (+10).
  { itemId: "language.tells-about-day", answer: "easily" },
  { itemId: "language.why-how", answer: "easily" },
  { itemId: "language.whole-story", answer: "easily" },
  // science: a two-rung climb (+8).
  { itemId: "science.sorts-groups", answer: "easily" },
  { itemId: "science.predicts", answer: "easily" },
  { itemId: "science.grow-change", answer: "easily" },
  { itemId: "social_studies.family-roles", answer: "easily" },
  { itemId: "art.names-colors", answer: "easily" },
  { itemId: "music.steady-beat", answer: "easily" },
  { itemId: "gross_motor.gallops", answer: "easily" },
  { itemId: "fine_motor.beads", answer: "not_yet" },
  // social-emotional: a two-rung climb (+8).
  { itemId: "social_emotional.plays-with", answer: "easily" },
  { itemId: "social_emotional.false-belief", answer: "easily" },
  { itemId: "social_emotional.feeling-because", answer: "easily" },
  { itemId: "self_care.toilet-day", answer: "getting_there" },
  { itemId: "executive_function.waits-turn", answer: "easily" },
  { itemId: "computer_science.robot-game", answer: "easily" },
  { itemId: "spanish.understands-words", answer: "skip" },
];

/**
 * One month earlier, for the visible-movement theater (honest, labeled):
 * self-care hadn't started moving and math hadn't climbed its rung.
 */
export const SAMPLE_PRIOR_ANSWERS: MapAnswerInput[] = SAMPLE_ANSWERS.filter(
  (entry) => entry.itemId !== "math.counts-past-20",
).map((entry) =>
  entry.itemId === "self_care.toilet-day" ? { ...entry, answer: "not_yet" } : entry,
);
