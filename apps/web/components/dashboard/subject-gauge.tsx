import { MONTHS_AHEAD_CAP, type DomainScore, type MapPosition } from "@homa/core";

/**
 * The subject position gauge, shared by the kid cards and the per-kid
 * page. Not a completion bar: the notch marks "at age", ahead extends
 * right on the report chart's months-ahead scale, growing sits just left
 * in sky (same semantics as report-chart.tsx, never a negative number).
 */

export interface SubjectTone {
  bar: string;
  ink: string;
  chipBg: string;
}

export function subjectTone(position: MapPosition): SubjectTone {
  switch (position) {
    case "ahead":
      return { bar: "var(--gold-400)", ink: "var(--gold-ink)", chipBg: "var(--gold-100)" };
    case "on_track":
      return { bar: "var(--sage-400)", ink: "var(--sage-700)", chipBg: "var(--sage-50)" };
    case "growing":
      return { bar: "var(--sky-500)", ink: "var(--sky-600)", chipBg: "var(--info-soft)" };
    case "not_mapped":
      return { bar: "var(--stone-300)", ink: "var(--text-subtle)", chipBg: "var(--surface-sunken)" };
    default: {
      const unreachable: never = position;
      return unreachable;
    }
  }
}

/** Gauge fill: 50% is the at-age notch, +24 mo fills the track, growing
 * rests just left of the notch (mirrors the chart's dot placement). */
export function gaugePercent(score: DomainScore): number {
  if (score.position === "growing") return 44;
  const months = Math.min(score.monthsAhead ?? 0, MONTHS_AHEAD_CAP);
  return 50 + (months / MONTHS_AHEAD_CAP) * 50;
}

export function gaugeLabel(score: DomainScore): string {
  if (score.position === "growing") return "growing";
  const months = score.monthsAhead ?? 0;
  return months > 0 ? `+${months} mo` : "at age";
}

export function SubjectGauge({ score }: { score: DomainScore }) {
  const tone = subjectTone(score.position);
  return (
    <div className="relative h-[7px] rounded-pill bg-[var(--stone-100)]">
      <div
        className="h-full rounded-pill"
        style={{ width: `${gaugePercent(score)}%`, background: tone.bar }}
      />
      {/* The at-age notch, so the bar reads as a position gauge instead
          of an unfinished progress bar. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-[var(--stone-300)]" />
    </div>
  );
}
