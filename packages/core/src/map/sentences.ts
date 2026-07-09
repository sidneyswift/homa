import { ageLabel } from "./bands";
import type { DomainScore, MapScores } from "./scoring";

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

export interface DomainLine {
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

export function domainLine(score: DomainScore, childName: string): DomainLine {
  const evidence = score.strongestObservedStatement
    ? `You've seen it: ${lowerFirst(score.strongestObservedStatement)}.`
    : "";
  const nextStep = score.frontierStatement ? lowerFirst(score.frontierStatement) : null;

  if (score.exposureBased) {
    if (score.position === "on_track") {
      // Exposure domains track what the family does, never age norms, so
      // each one gets its own warm line instead of a position sentence.
      const opener =
        score.domainId === "computer_science"
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
        sentence: openers[rotate(score.domainId, openers.length)],
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
 * The "note from Homa" paragraph at the top of a report. Reads the room:
 * a strong picture celebrates, a growing-heavy picture reassures and points
 * forward, and neither ever shames.
 */
export function homaNote(scores: MapScores, childName: string, parentName?: string): string {
  const ahead = scores.domains.filter((score) => score.position === "ahead" && !score.exposureBased).length;
  const onTrack = scores.domains.filter((score) => score.position === "on_track" && !score.exposureBased).length;
  const growing = scores.domains.filter(
    (score) => score.position === "growing" && !score.exposureBased,
  ).length;

  const opening = parentName ? `${parentName}, here's` : "Here's";
  const noticing =
    `Nothing here is a test: it's ${scores.observationCount} of your own answers, organized.`;

  if (scores.mappedCount === 0) {
    return (
      `${opening} where we are: ${childName}'s picture is just getting started, and that's fine. ` +
      `Answer more whenever you like and it fills in. ${noticing}`
    );
  }

  // Growing-heavy: reassure first, then point at the path. Never a tally of blue.
  if (growing >= 4 && growing > ahead) {
    const footing = ahead + onTrack;
    const footingLine =
      footing > 0
        ? `${childName} has solid footing in ${footing} ${footing === 1 ? "subject" : "subjects"}, and a clear next step in the ones marked blue.`
        : `${childName} has a clear next step in every subject marked blue.`;
    return (
      `${opening} where things stand: ${footingLine} ` +
      `That's normal, not a verdict. Each blue card below names exactly where to begin. ` +
      noticing
    );
  }

  const parts: string[] = [];
  if (ahead > 0) parts.push(`ahead for their age in ${ahead} ${ahead === 1 ? "subject" : "subjects"}`);
  if (onTrack > 0) {
    // "12 more" only reads right after an "ahead in N" clause.
    parts.push(
      ahead > 0
        ? `on track in ${onTrack} more`
        : `on track in ${onTrack} ${onTrack === 1 ? "subject" : "subjects"}`,
    );
  }
  const standing = parts.length > 0 ? `${childName} is ${parts.join(" and ")}` : `${childName}'s picture is filling in`;
  const growingLine =
    growing > 0
      ? ` ${growing === 1 ? "One subject is" : `${growing} subjects are`} growing right now, each with a place to start below.`
      : "";

  return `${opening} where things stand: ${standing}.${growingLine} ${noticing}`;
}

/** Subject line and preview for the report email. */
export function reportEmailSubject(childName: string): string {
  return `${childName}'s progress report is ready`;
}

export function reportEmailPreview(): string {
  return "A first look at where they stand, strengths first.";
}

/** The sub-heading under the report title. */
export function reportSubtitle(ageMonths: number): string {
  return `A first look at where they stand at ${ageLabel(ageMonths)}, from what you've seen them do`;
}

/** Header for the things-to-try section, sized to how much is growing. */
export function tryHeading(growingCount: number): { title: string; sub: string } {
  if (growingCount > 2) {
    return {
      title: "Where to start",
      sub: "Not all at once. Pick one for this week. That's enough.",
    };
  }
  return {
    title: growingCount === 1 ? "One thing worth trying this week" : "A couple of things worth trying this week",
    sub: "Free, about five minutes, and pointed at what's next. Ideas, never homework.",
  };
}
