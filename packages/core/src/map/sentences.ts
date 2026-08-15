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
  /** The chip label describes what Homa can help with, not a verdict about
   * the child or a numerical comparison. */
  badge: string;
  /** Parent-facing report rows deliberately do not expose a comparative
   * month score. The deterministic score remains available to planning and
   * other authorized downstream logic. */
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
          badge: "A clear strength",
          numberLabel: "",
          sentence:
            `${childName} has a clear strength here. ` +
            `The skills you've confirmed go beyond what this checklist can show. ${evidence}`.trim(),
        };
      }
      return {
        badge: "A clear strength",
        numberLabel: "",
        sentence: `${childName} has a clear strength here. ${evidence}`.trim(),
      };
    case "on_track":
      return {
        badge: "Solid footing",
        numberLabel: "",
        sentence: `There is solid footing here to build from. ${evidence}`.trim(),
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
    default: {
      const exhaustive: never = score.position;
      throw new Error(`Unhandled map position: ${exhaustive}`);
    }
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
    return `${childName} has clear strengths to build from, with solid footing across the rest of the picture.`;
  }
  if (ahead > 0) {
    return `${childName} has clear strengths to build from.`;
  }
  if (onTrack > 0) {
    return `${childName} has solid footing across this picture.`;
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
 * just says what she's about to open. Word order matters twice here:
 * "month: a 4-week plan for July" teaches the name the button and the
 * plan page both use ("{child}'s month"), and it retires the old
 * "${monthName} 4-week plan" shape, which read as "July 4" for a beat
 * (and could line-break right after it). */
export function notePlanSentence(childName: string, monthName: string): string {
  return `I took everything you told me and turned it into ${childName}'s month: a 4-week plan for ${monthName}.`;
}

/** Subject line and preview for the report email. */
export function reportEmailSubject(childName: string): string {
  return `${childName}'s progress report is ready`;
}

export function reportEmailPreview(): string {
  return "A first look at where they stand, strengths first.";
}
