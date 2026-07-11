import type { SubjectScore, MapScores } from "./scoring";

/**
 * The reviewed sentence bank (decision D8: template strings, zero model
 * calls). Every sentence a parent can ever read in a report lives here or in
 * the domain content's growing activities, so one human pass reviews it all.
 *
 * Vocabulary rules from the 2026-07-05 founder + Alessa read-through:
 * "progress report" never "map", "subject" never "domain", plain age words
 * never "band", and color words are yellow / green / blue in copy (the
 * tokens stay gold / sage / sky in code). Growing subjects name the actual
 * next step instead of repeating one generic line, and the top note reads
 * the room instead of celebrating a wall of blue.
 *
 * Voice laws: sentence case, reassure before inform, offers never commands,
 * no deficit words, temporal never causal, no em dashes.
 */

export interface SubjectLine {
  /** The chip label: Ahead, On track, Growing right now, Not mapped yet. */
  badge: string;
  /** The right-column number, e.g. "+14 mo". Empty when it would only
   * restate the badge ("at age" next to an "On track" chip, "growing"
   * next to "Growing right now" said the same fact in two vocabularies,
   * UI review 2026-07-06). It speaks only when it ADDS information,
   * which also makes "+14 mo" rarer and therefore louder. */
  numberLabel: string;
  /** The sentence under the subject name. */
  sentence: string;
}

/** Stable tiny hash so growing sentences rotate deterministically. */
function rotate(seed: string, count: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return hash % count;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function subjectLine(score: SubjectScore, childName: string): SubjectLine {
  const evidence = score.strongestObservedStatement
    ? `You've seen it: ${lowerFirst(score.strongestObservedStatement)}.`
    : "";
  const nextStep = score.frontierStatement ? lowerFirst(score.frontierStatement) : null;

  if (score.exposureBased) {
    if (score.position === "on_track") {
      // Exposure domains track what the family does, never age norms, so
      // each one gets its own warm line instead of a position sentence.
      const opener =
        score.subjectId === "computer_science"
          ? "Code and computers are part of their world, and every build teaches."
          : "A second language is part of your home, and every bit counts.";
      return {
        badge: "Part of your world",
        numberLabel: "",
        sentence: `${opener} ${evidence}`.trim(),
      };
    }
    return {
      badge: "Whenever you like",
      numberLabel: "",
      sentence: "Not part of home life right now, and that's fine. The door is always open.",
    };
  }

  switch (score.position) {
    case "ahead":
      // beyondScale: the number is a floor (the confirmed frontier ran
      // past the display cap, or past the last question the bank has).
      // Saying so plainly is what keeps a genuinely advanced kid's report
      // honest: the checklist stops here, the child didn't.
      if (score.beyondScale) {
        return {
          badge: "Ahead",
          numberLabel: `+${score.monthsAhead} mo`,
          sentence:
            `${childName} is ahead of what's typical for their age here. ` +
            `The skills you've confirmed go past what this number can show. ${evidence}`.trim(),
        };
      }
      return {
        badge: "Ahead",
        numberLabel: `+${score.monthsAhead} mo`,
        sentence: `${childName} is ahead of what's typical for their age here. ${evidence}`.trim(),
      };
    case "on_track":
      return {
        badge: "On track",
        numberLabel: score.monthsAhead && score.monthsAhead > 0 ? `+${score.monthsAhead} mo` : "",
        sentence: `Right where most kids their age are. ${evidence}`.trim(),
      };
    case "growing": {
      const openers = nextStep
        ? [
            `The next step here is clear: ${nextStep}. That's where to start.`,
            `Next up for ${childName}: ${nextStep}.`,
            `What's next for ${childName}: ${nextStep}. One specific, learnable skill.`,
          ]
        : [
            `This is just what's next for ${childName}. There's a place to start below.`,
          ];
      return {
        badge: "Growing right now",
        numberLabel: "",
        sentence: openers[rotate(score.subjectId, openers.length)],
      };
    }
    case "not_mapped":
      return {
        badge: "Not mapped yet",
        numberLabel: "",
        sentence: "Not enough answers yet to place this honestly. A few more would fill it in.",
      };
  }
}

/**
 * The "note from Homa" at the top of a report: ONE conversational sentence
 * (founder ruling 2026-07-08, report simplification pass). It reads the
 * room: a strong picture celebrates, a growing-heavy picture reassures,
 * and neither ever shames. Everything else the note used to carry
 * (movement, practice, the month offer) lives elsewhere on the page.
 *
 * The parent's name no longer opens this sentence (round 2, founder ask
 * 2026-07-09): the note now sits under a "Hey {name}," letter greeting
 * (see `noteGreeting`), so repeating the name here read twice in one
 * breath.
 */
export function homaNote(scores: MapScores, childName: string): string {
  const ahead = scores.subjects.filter((score) => score.position === "ahead" && !score.exposureBased).length;
  const onTrack = scores.subjects.filter((score) => score.position === "on_track" && !score.exposureBased).length;
  const growing = scores.subjects.filter(
    (score) => score.position === "growing" && !score.exposureBased,
  ).length;

  if (scores.mappedCount === 0) {
    return `${childName}'s picture is just getting started, and it fills in whenever you answer a few more questions.`;
  }

  // Growing-heavy: reassure first. Never a tally of blue.
  if (growing >= 4 && growing > ahead) {
    const footing = ahead + onTrack;
    return footing > 0
      ? `${childName} has solid footing in ${footing} ${footing === 1 ? "subject" : "subjects"}, and every subject growing right now has a clear place to start below.`
      : `Every subject here is growing right now, and each one has a clear place to start below.`;
  }

  if (ahead > 0 && onTrack > 0) {
    return `${childName} is ahead for their age in ${ahead} ${ahead === 1 ? "subject" : "subjects"}, on track in ${onTrack} more.`;
  }
  if (ahead > 0) {
    return `${childName} is ahead for their age in ${ahead} ${ahead === 1 ? "subject" : "subjects"}.`;
  }
  if (onTrack > 0) {
    return `${childName} is right where most kids their age are, across ${onTrack} ${onTrack === 1 ? "subject" : "subjects"}.`;
  }
  return `${childName}'s picture is filling in, with a clear place to start in ${growing === 1 ? "one subject" : `${growing} subjects`} below.`;
}

/** The letter greeting above the note (round 2, founder ask 2026-07-09:
 * the note reads as a personal letter, not a block of text). Falls back
 * to "there" when the family never gave a first name. */
export function noteGreeting(parentFirstName: string | null): string {
  return `Hey ${parentFirstName ?? "there"},`;
}

/** The month-plan line inside the letter, naming the actual month the
 * plan starts. The button right under it does the work; this sentence
 * just says what she's about to open. */
export function notePlanSentence(childName: string, monthName: string): string {
  return `I took everything you told me and turned it into ${childName}'s ${monthName} 4-week plan.`;
}

/** Subject line and preview for the report email. */
export function reportEmailSubject(childName: string): string {
  return `${childName}'s progress report is ready`;
}

export function reportEmailPreview(): string {
  return "A first look at where they stand, strengths first.";
}

