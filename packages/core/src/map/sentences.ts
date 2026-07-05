import { ageLabel } from "./bands";
import { getMapDomain } from "./bank";
import type { DomainScore, MapScores } from "./scoring";

/**
 * The reviewed sentence bank (decision D8: template strings, zero model
 * calls). Every sentence a parent can ever read in a report lives here or in
 * the domain content's growingActivity, so one human pass reviews them all.
 *
 * Voice laws: sentence case, reassure before inform, offers never commands,
 * no "behind" or deficit words, temporal never causal, no em dashes.
 */

export interface DomainLine {
  /** The chip label: Ahead, On track, Growing right now, Not mapped yet. */
  badge: string;
  /** The right-column number: "+14 mo", "at age", "growing", "\u00b7". */
  numberLabel: string;
  /** The sentence under the domain name. */
  sentence: string;
}

export function domainLine(score: DomainScore, childName: string): DomainLine {
  const domain = getMapDomain(score.domainId);
  const evidence = score.strongestObservedStatement
    ? `You've seen it: ${lowerFirst(score.strongestObservedStatement)}.`
    : "";

  if (score.exposureBased) {
    if (score.position === "on_track") {
      return {
        badge: "Part of your world",
        numberLabel: "exploring",
        sentence: `A second language is alive in your home. Every bit of exposure counts at this age. ${evidence}`.trim(),
      };
    }
    return {
      badge: "Whenever you like",
      numberLabel: "\u00b7",
      sentence: "Not part of home life yet, and that's completely fine. The door is always open.",
    };
  }

  switch (score.position) {
    case "ahead":
      return {
        badge: "Ahead",
        numberLabel: `+${score.monthsAhead} mo`,
        sentence: `${childName} is working ahead of the band here. ${evidence}`.trim(),
      };
    case "on_track":
      return {
        badge: "On track",
        numberLabel:
          score.monthsAhead && score.monthsAhead > 0 ? `+${score.monthsAhead} mo` : "at age",
        sentence: `Right where the band expects. ${evidence}`.trim(),
      };
    case "growing":
      return {
        badge: "Growing right now",
        numberLabel: "growing",
        sentence: domain
          ? `This is ${childName}'s current frontier, which is just what's next, not a verdict. Something small to try is below.`
          : `This is ${childName}'s current frontier, which is just what's next, not a verdict.`,
      };
    case "not_mapped":
      return {
        badge: "Not mapped yet",
        numberLabel: "\u00b7",
        sentence: "We haven't seen enough here to place it honestly. A few more observations would fill it in.",
      };
  }
}

/** The "note from Homa" paragraph at the top of a report. */
export function homaNote(scores: MapScores, childName: string, parentName?: string): string {
  const ahead = scores.domains.filter((score) => score.position === "ahead").length;
  const onTrack = scores.domains.filter((score) => score.position === "on_track").length;
  const growing = scores.domains.filter(
    (score) => score.position === "growing" && !score.exposureBased,
  ).length;

  const opening = parentName ? `${parentName}, here's` : "Here's";
  const parts: string[] = [];
  if (ahead > 0) parts.push(`ahead of the age band in ${countNoun(ahead, "domain")}`);
  if (onTrack > 0) parts.push(`right in the band in ${countNoun(onTrack, "more", "more")}`);
  const standing =
    parts.length > 0 ? `${childName} is ${parts.join(" and ")}` : `${childName}'s picture is just getting started`;
  const growingLine =
    growing > 0
      ? ` ${growing === 1 ? "One spot is" : `${growing} spots are`} simply what's next, with something small to try attached.`
      : "";

  return (
    `${opening} the honest picture: ${standing}.${growingLine} ` +
    `You gave me ${scores.observationCount} real observations, that's a strong first map. ` +
    `Nothing here is a test result. It's your own noticing, organized.`
  );
}

/** Subject line and preview for the report email. */
export function reportEmailSubject(childName: string): string {
  return `${childName}'s map is ready`;
}

export function reportEmailPreview(): string {
  return "A first look at where they stand, strengths first.";
}

/** The sub-heading under the report title. */
export function reportSubtitle(ageMonths: number): string {
  return `a first look at where they stand at ${ageLabel(ageMonths)}, from what you've seen them do`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function countNoun(count: number, singular: string, plural?: string): string {
  const noun = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${noun}`;
}
