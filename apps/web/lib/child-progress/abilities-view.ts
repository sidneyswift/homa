import { createHash } from "node:crypto";

import type {
  AbilityNode,
  AbilityState,
  SubjectAbilityMap,
} from "./abilities";

/**
 * The serializable sky model: what the client actually receives to
 * draw one child's abilities map (founder ruling `abilities-map-v1`).
 *
 * Two properties this module exists to guarantee.
 *
 * DETERMINISM. Star positions come from a hash of the ability id, not
 * from Math.random, so a mother's sky looks the same every visit and
 * server and client render identically. A star that wandered between
 * loads would quietly say the map is decorative; it is not, it is her
 * child's record.
 *
 * NO DENOMINATORS. Nothing here carries the catalog's size, a percent,
 * or a remaining count, and a test asserts it. The map counts up only.
 * A child with forty stars is a child with forty stars, never forty out
 * of sixteen hundred.
 */

export interface AbilityStar {
  itemId: string;
  statement: string;
  state: AbilityState;
  /** 0 to 1 across the age axis, oldest-typical at the right. */
  x: number;
  /** 0 to 1, deterministic jitter so a band reads as a sky, not a row. */
  y: number;
  /** Bigger stars for abilities more of the graph leans on. */
  size: 1 | 2 | 3;
  /** Lit within the last seven days: the week's new stars twinkle in. */
  isNew: boolean;
}

export interface AbilitySkyEdge {
  fromItemId: string;
  toItemId: string;
}

export interface SubjectSky {
  subjectId: string;
  displayName: string;
  stars: AbilityStar[];
  /** Hairlines between a star and the ability it builds on. */
  edges: AbilitySkyEdge[];
  readyNext: Array<{
    itemId: string;
    statement: string;
    /** The receipts: what the child already showed that opens this. */
    becauseOf: string[];
  }>;
  /** Lit count for this subject. Never a total, never a fraction. */
  lit: number;
  newThisWeek: number;
}

export interface AbilitiesSky {
  subjects: SubjectSky[];
  /** Lit across every subject. Counts up only. */
  lit: number;
  newThisWeek: number;
  /** Subjects with nothing lit yet: names only, never a count. */
  moreToExplore: string[];
}

const NEW_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The narrowest the age axis is allowed to get, in months.
 *
 * Without a floor, a child with two abilities four months apart would
 * have them normalized to 0 and 1: one hard against each end of the
 * strip, with nothing between. That reads as a gap rather than as two
 * close abilities, which is the opposite of true.
 */
const MIN_AXIS_MONTHS = 24;

/** Deterministic horizontal nudge, so two abilities that share a
 *  typical age do not land exactly on top of each other. Small enough
 *  that it cannot change which of two stars reads as older. */
const X_JITTER = 0.015;

/**
 * Deterministic 0-to-1 jitter from an ability id. sha256 keeps
 * neighbours from clumping the way a cheap string hash does, and the
 * id is stable forever, so the sky is stable forever.
 */
function jitter(itemId: string, salt: string): number {
  const digest = createHash("sha256")
    .update(`${salt}:${itemId}`)
    .digest();
  return digest.readUInt16BE(0) / 0x10000;
}

function starSize(typicalMonths: number, ageMonths: number): 1 | 2 | 3 {
  // Nearest the child's own age reads largest: her sky is about where
  // she is, not about the far ends of the catalog.
  const distance = Math.abs(typicalMonths - ageMonths);
  if (distance <= 12) return 3;
  if (distance <= 30) return 2;
  return 1;
}

function isNew(observedAt: string | null, now: Date): boolean {
  if (observedAt === null) return false;
  const at = new Date(observedAt).getTime();
  if (Number.isNaN(at)) return false;
  return now.getTime() - at <= NEW_WINDOW_DAYS * DAY_MS;
}

/**
 * The age axis every subject shares.
 *
 * This is deliberately ONE axis for the whole sky, not one per subject.
 * The card draws every subject's stars into a single strip, so a star's
 * horizontal position has to mean the same thing everywhere: further
 * right is a later typical age, full stop. Normalizing inside each
 * subject made x mean "far along for this subject", which put a
 * two-ability subject's stars at both extremes and left the middle
 * empty. It also made two stars at the same height mean two different
 * ages, which is worse than meaningless, it is wrong.
 */
function ageAxis(
  map: readonly SubjectAbilityMap[],
  ageMonths: number,
): { min: number; span: number } {
  const months = map.flatMap((subject) =>
    subject.nodes.map((node) => node.typicalMonths),
  );
  let min = Math.min(...months, ageMonths);
  let max = Math.max(...months, ageMonths);
  const short = MIN_AXIS_MONTHS - (max - min);
  if (short > 0) {
    // Widen around the middle so the existing stars stay centered
    // rather than being pushed to one end.
    min -= short / 2;
    max += short / 2;
  }
  return { min, span: max - min };
}

function toStar(
  node: AbilityNode,
  axis: { min: number; span: number },
  ageMonths: number,
  now: Date,
): AbilityStar {
  const placed =
    (node.typicalMonths - axis.min) / axis.span +
    (jitter(node.itemId, "x") - 0.5) * 2 * X_JITTER;
  return {
    itemId: node.itemId,
    statement: node.statement,
    state: node.state,
    x: Math.min(1, Math.max(0, placed)),
    y: jitter(node.itemId, "y"),
    size: starSize(node.typicalMonths, ageMonths),
    isNew: isNew(node.observedAt, now),
  };
}

/**
 * buildAbilitiesSky(map, ageMonths, now, allSubjectNames): the client
 * payload. `moreToExplore` takes subject display names the caller knows
 * are unlit; it is a list of names on purpose, never a count of what is
 * missing.
 */
export function buildAbilitiesSky(
  map: readonly SubjectAbilityMap[],
  ageMonths: number,
  now: Date,
  unlitSubjectNames: readonly string[] = [],
): AbilitiesSky {
  const axis = ageAxis(map, ageMonths);
  const subjects: SubjectSky[] = map.map((subject) => {
    const stars = subject.nodes.map((node) =>
      toStar(node, axis, ageMonths, now),
    );
    const litIds = new Set(stars.map((star) => star.itemId));
    return {
      subjectId: subject.subjectId,
      displayName: subject.displayName,
      stars,
      // Only edges between two lit stars: an edge to an unlit ability
      // would draw a line into the dark, which is the shape of a hole.
      edges: subject.readyNext.flatMap((ready) =>
        ready.becauseOf
          .filter((itemId) => litIds.has(itemId))
          .map((itemId) => ({
            fromItemId: itemId,
            toItemId: ready.itemId,
          })),
      ),
      readyNext: subject.readyNext.map((ready) => ({
        itemId: ready.itemId,
        statement: ready.statement,
        becauseOf: ready.becauseOfStatements ?? [],
      })),
      lit: stars.length,
      newThisWeek: stars.filter((star) => star.isNew).length,
    };
  });

  return {
    subjects,
    lit: subjects.reduce((total, subject) => total + subject.lit, 0),
    newThisWeek: subjects.reduce(
      (total, subject) => total + subject.newThisWeek,
      0,
    ),
    moreToExplore: [...unlitSubjectNames],
  };
}
