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
  /** The right-column number: "+14 mo", "at age", "growing", "\u00b7". */
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
      return {
        badge: "Part of your world",
        numberLabel: "exploring",
        sentence: `A second language is alive in your home, and every bit of it counts. ${evidence}`.trim(),
      };
    }
    return {
      badge: "Whenever you like",
      numberLabel: "\u00b7",
      sentence: "Not part of home life right now, and that's completely fine. The door is always open.",
    };
  }

  switch (score.position) {
    case "ahead":
      return {
        badge: "Ahead",
        numberLabel: `+${score.monthsAhead} mo`,
        sentence: `${childName} is working ahead of what's typical for their age here. ${evidence}`.trim(),
      };
    case "on_track":
      return {
        badge: "On track",
        numberLabel:
          score.monthsAhead && score.monthsAhead > 0 ? `+${score.monthsAhead} mo` : "at age",
        sentence: `Right where this typically looks at their age. ${evidence}`.trim(),
      };
    case "growing": {
      const openers = nextStep
        ? [
            `The next step here is clear: ${nextStep}. That's where to start.`,
            `${childName} is right at the edge of one specific thing: ${nextStep}.`,
            `What's next for ${childName}: ${nextStep}. One skill, very learnable.`,
          ]
        : [
            `This one is simply what's next for ${childName}, and there's a place to start below.`,
          ];
      return {
        badge: "Growing right now",
        numberLabel: "growing",
        sentence: openers[rotate(score.domainId, openers.length)],
      };
    }
    case "not_mapped":
      return {
        badge: "Not mapped yet",
        numberLabel: "\u00b7",
        sentence: "We haven't seen enough here to place it honestly. A few more observations would fill it in.",
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
    `You gave me ${scores.observationCount} real observations. ` +
    `Nothing here is a test result: it's your own noticing, organized.`;

  if (scores.mappedCount === 0) {
    return (
      `${opening} where we are: ${childName}'s picture is just getting started, and that's a fine place to be. ` +
      `Answer a few more whenever you like and it fills in. ${noticing}`
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
      `${opening} the honest picture, and honest is what makes it useful: ${footingLine} ` +
      `That's not a verdict on ${childName} or on you. It's a starting line, and each blue card below says exactly where to begin. ` +
      noticing
    );
  }

  const parts: string[] = [];
  if (ahead > 0) parts.push(`ahead of what's typical for their age in ${ahead} ${ahead === 1 ? "subject" : "subjects"}`);
  if (onTrack > 0) parts.push(`right on track in ${onTrack} more`);
  const standing = parts.length > 0 ? `${childName} is ${parts.join(" and ")}` : `${childName}'s picture is filling in`;
  const growingLine =
    growing > 0
      ? ` ${growing === 1 ? "One subject is" : `${growing} subjects are`} growing right now, each with a place to start below.`
      : "";

  return `${opening} the honest picture: ${standing}.${growingLine} ${noticing}`;
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
  return `a first look at where they stand at ${ageLabel(ageMonths)}, from what you've seen them do`;
}

/** Header for the things-to-try section, sized to how much is growing. */
export function tryHeading(growingCount: number): { title: string; sub: string } {
  if (growingCount > 2) {
    return {
      title: "Where to start",
      sub: "Not all at once. Pick one for this week, that's genuinely enough.",
    };
  }
  return {
    title: growingCount === 1 ? "One thing worth trying this week" : "A couple of things worth trying this week",
    sub: "Free, about five minutes, and pointed at what's next. Ideas, never homework.",
  };
}
