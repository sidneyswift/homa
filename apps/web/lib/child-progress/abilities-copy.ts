import type { AbilityState } from "./abilities";

/**
 * Every parent-facing string on the abilities map, in one place, the
 * way view-copy.ts holds the Progress page's (founder ruling
 * `abilities-map-v1`, 2026-07-22).
 *
 * Two laws shape all of it. The map is feedback to the PARENT about
 * what her child showed, never a lever aimed at the child, so nothing
 * here instructs, scolds, or counts down. And the map only ever counts
 * up: no string in this file may render a denominator, a percentage, a
 * remaining count, or the size of the catalog. A mother whose child
 * has forty stars must never be told there are 1,600.
 */

/** The surface's own name, per the naming ruling: ability, not skill. */
export const ABILITIES_TITLE = "The abilities map";

export function abilitiesIntro(childName: string): string {
  return `Every star is something ${childName} has shown. The map only ever counts up.`;
}

/** The one hand-written margin note the surface allows itself. */
export const ABILITIES_MARGIN_NOTE = "every star is one you noticed";

export const ABILITIES_OPEN = "Open the map";

/**
 * The headline count. Deliberately takes only what is lit: there is no
 * parameter here that could carry a total, which is the point.
 */
export function abilitiesCount(lit: number, newThisWeek: number): string {
  const abilities = `${lit} ${lit === 1 ? "ability" : "abilities"} so far`;
  if (newThisWeek <= 0) return abilities;
  return `${abilities} · ${newThisWeek} new this week`;
}

export function abilitiesNewStars(count: number): string {
  return count === 1
    ? "1 new star since last week."
    : `${count} new stars since last week.`;
}

/** The celebration line when a star lights while she is watching. */
export function abilityLitUp(statement: string): string {
  return `New star: ${statement}.`;
}

export function abilitiesEmptyHeading(childName: string): string {
  return `${childName}'s map is ready.`;
}

export function abilitiesEmptyBody(childName: string): string {
  return (
    `Stars appear as ${childName} shows what they can do, in check-ins, ` +
    "journal notes, and lessons. Your first few answers light the first " +
    "few stars."
  );
}

/**
 * A quiet week is a fact about the week, never about the mother. The
 * copy names what is standing rather than what did not happen: no
 * "nothing new", no zero, no nudge to do better.
 */
export function abilitiesQuietWeek(childName: string): string {
  return `A quieter week. Here is what ${childName} is standing on.`;
}

export function abilityStateLabel(state: AbilityState): string {
  switch (state) {
    case "mastered":
      return "Shown easily";
    case "emerging":
      return "Getting there";
    case "not_yet":
      return "Not yet";
    case "implied":
      return "Comes with a bigger skill";
  }
}

export const ABILITIES_READY_LABEL = "Ready next";

/** The legend, in the order the eye should read it. */
export const ABILITIES_LEGEND: readonly string[] = [
  abilityStateLabel("mastered"),
  abilityStateLabel("emerging"),
  abilityStateLabel("not_yet"),
  abilityStateLabel("implied"),
  ABILITIES_READY_LABEL,
];

/** The body of a star's popover, per state. Never an instruction. */
export function abilityStateBody(
  state: AbilityState,
  childName: string,
): string {
  switch (state) {
    case "mastered":
      return `${childName} showed this on their own.`;
    case "emerging":
      return `${childName} is doing this with a little help.`;
    case "not_yet":
      return (
        "Not yet is a normal answer. This one stays on the map, ready " +
        `to light up when ${childName} gets there.`
      );
    case "implied":
      return (
        `Counted because ${childName} has shown a bigger skill that ` +
        "includes this one."
      );
  }
}

export const ABILITIES_READY_HEADING = "Ready when you are";

export function abilitiesReadyBody(childName: string): string {
  return `${childName} has shown the skills that lead here.`;
}

export function abilityBuildsOn(prerequisiteStatement: string): string {
  return `It builds on: ${prerequisiteStatement}.`;
}

/** Doors into chat. Offers, never commands. */
export const ABILITY_DOOR_TRY = "Ask Homa for an easy way to try it";
export const ABILITY_DOOR_OPENS = "Ask Homa what this opens up";

/** Subjects with nothing lit: named, never counted, never a gap. */
export const ABILITIES_MORE_TO_EXPLORE = "More to explore";
