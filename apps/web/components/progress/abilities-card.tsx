import type { AbilitiesSky, AbilityStar } from "../../lib/child-progress/abilities-view";
import {
  ABILITIES_MARGIN_NOTE,
  ABILITIES_TITLE,
  abilitiesCount,
  abilitiesEmptyBody,
  abilitiesEmptyHeading,
  abilitiesIntro,
  abilitiesNewStars,
} from "../../lib/child-progress/abilities-copy";

/**
 * The abilities map's front door on the Progress page (founder ruling
 * `abilities-map-v1`, 2026-07-22).
 *
 * The card shows the real sky, not a placeholder for it: a wide strip
 * of this child's own stars, positioned exactly where the full map will
 * put them. A mother should recognise her child's shape here before she
 * ever opens anything.
 *
 * What it deliberately never shows: how many abilities exist, how far
 * along she is, or anything a percentage could be computed from. The
 * count says "so far" and only ever grows.
 */

function starFill(state: AbilityStar["state"]): string {
  switch (state) {
    case "mastered":
      return "var(--gold-400)";
    case "emerging":
      return "var(--sage-400)";
    case "not_yet":
      return "transparent";
    case "implied":
      return "var(--gold-400)";
  }
}

function starOpacity(state: AbilityStar["state"]): number {
  // Implied stars are real but quieter: they were never reported, so
  // they must not shine as brightly as something she actually saw.
  return state === "implied" ? 0.65 : 1;
}

/** Diameter in px. Fixed rather than proportional: a star should be the
 *  same size on a phone as on a laptop, because it means the same
 *  thing on both. */
function starDiameter(size: AbilityStar["size"]): number {
  return size === 3 ? 9 : size === 2 ? 7 : 5;
}

/**
 * The stars are positioned elements, not SVG.
 *
 * An SVG strip needs `preserveAspectRatio="none"` to stretch a fixed
 * viewBox across a fluid card width, and that stretch applies to the
 * circles too: at a typical card width every star rendered as a flat
 * ellipse roughly nine times wider than it was tall. Percentage
 * positioning with a fixed pixel diameter keeps a star round at every
 * width, which is the only version of this that reads as a sky.
 */
function AbilitiesStrip({ sky }: { sky: AbilitiesSky }) {
  const stars = sky.subjects.flatMap((subject) => subject.stars);
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="relative mt-4 h-[72px] w-full overflow-hidden rounded-md"
      style={{ background: "var(--pop-navy)" }}
    >
      {stars.map((star) => {
        const diameter = starDiameter(star.size);
        return (
          <span
            key={star.itemId}
            className="absolute rounded-full"
            style={{
              // Inset the usable band so a star at either extreme is
              // fully inside the strip rather than half clipped.
              left: `${4 + star.x * 92}%`,
              top: `${12 + star.y * 76}%`,
              width: `${diameter}px`,
              height: `${diameter}px`,
              marginLeft: `${-diameter / 2}px`,
              marginTop: `${-diameter / 2}px`,
              background: starFill(star.state),
              opacity: starOpacity(star.state),
              boxShadow:
                star.state === "not_yet"
                  ? "inset 0 0 0 1px var(--stone-400)"
                  : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function AbilitiesCard({
  childName,
  sky,
}: {
  childName: string;
  sky: AbilitiesSky;
}) {
  // A child with nothing lit gets an invitation, never an empty
  // scoreboard: the sky is ready, it just has not been filled yet.
  if (sky.lit === 0) {
    return (
      <section
        aria-label={ABILITIES_TITLE}
        className="mt-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
      >
        <p className="font-display text-lg font-semibold text-strong">
          {abilitiesEmptyHeading(childName)}
        </p>
        <p className="mt-1 max-w-2xl text-sm text-body">
          {abilitiesEmptyBody(childName)}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label={ABILITIES_TITLE}
      className="mt-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-strong">
            {ABILITIES_TITLE}
          </p>
          <p className="mt-0.5 max-w-2xl text-sm text-muted">
            {abilitiesIntro(childName)}
          </p>
        </div>
        <p className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-subtle">
          {abilitiesCount(sky.lit, sky.newThisWeek)}
        </p>
      </div>

      <AbilitiesStrip sky={sky} />

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        {sky.newThisWeek > 0 ? (
          <p className="text-sm font-medium text-[var(--sage-700)]">
            {abilitiesNewStars(sky.newThisWeek)}
          </p>
        ) : (
          <span />
        )}
        {/* The house hand-note treatment, matching wins-card.tsx. */}
        <p
          className="inline-block -rotate-[1.5deg] font-hand text-lg font-semibold"
          style={{ color: "var(--sage-600)" }}
        >
          {ABILITIES_MARGIN_NOTE}
        </p>
      </div>
    </section>
  );
}
