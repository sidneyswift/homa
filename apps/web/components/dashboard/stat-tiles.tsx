import type { DashboardPlan, DashboardReport } from "../../lib/dashboard";

/**
 * The three stat tiles, template layout with honest numbers. The mock's
 * streak and hours tiles wait for the hours log; until then every value
 * here is counted from rows that exist: mapped subjects, the parent's own
 * observations, plan check-offs. Positive-only by the display law: a
 * tile never renders a deficit.
 */

interface Tile {
  label: string;
  value: string;
  sub: string;
  subTone: "muted" | "sage" | "gold";
}

const SUB_TONE: Record<Tile["subTone"], React.CSSProperties> = {
  muted: { color: "var(--text-muted)" },
  sage: { color: "var(--sage-700)", fontWeight: 700 },
  gold: { color: "var(--gold-ink)", fontWeight: 700 },
};

function buildTiles(reports: DashboardReport[], plans: DashboardPlan[], kidCount: number): Tile[] {
  const mapped = reports.reduce((sum, report) => sum + report.scores.mappedCount, 0);
  const possible = reports.reduce((sum, report) => sum + report.scores.totalSubjects, 0);
  const observations = reports.reduce((sum, report) => sum + report.scores.observationCount, 0);
  const aheadCount = reports.reduce(
    (sum, report) =>
      sum +
      report.scores.subjects.filter((score) => score.position === "ahead" && !score.exposureBased)
        .length,
    0,
  );
  const planDone = plans.reduce((sum, plan) => sum + plan.done, 0);
  const planTotal = plans.reduce((sum, plan) => sum + plan.total, 0);

  const tiles: Tile[] = [
    {
      label: "Subjects mapped",
      value: `${mapped} of ${possible}`,
      sub: kidCount === 1 ? "one growing picture" : `across ${kidCount} kids`,
      subTone: "muted",
    },
    {
      label: "Your answers",
      value: String(observations),
      sub: "every answer sharpens the picture",
      subTone: "muted",
    },
  ];

  if (planTotal > 0) {
    tiles.push({
      label: "Plan check-offs",
      value: `${planDone} of ${planTotal}`,
      sub: planDone > 0 ? "your work, counted \u2726" : "this month's activities",
      subTone: planDone > 0 ? "sage" : "muted",
    });
  } else if (aheadCount > 0) {
    tiles.push({
      label: "Ahead of age",
      value: String(aheadCount),
      sub: `${aheadCount === 1 ? "subject" : "subjects"} across the family \u2726`,
      subTone: "gold",
    });
  } else {
    tiles.push({
      label: "Reports",
      value: String(reports.length),
      sub: "living records that re-check as kids grow",
      subTone: "muted",
    });
  }
  return tiles;
}

export function StatTiles({
  reports,
  plans,
  kidCount,
}: {
  reports: DashboardReport[];
  plans: DashboardPlan[];
  kidCount: number;
}) {
  if (reports.length === 0) return null;
  const tiles = buildTiles(reports, plans, kidCount);
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
          <p className="text-[0.8rem] font-semibold text-muted">{tile.label}</p>
          <p className="mt-1.5 font-display text-[2rem] font-semibold leading-none text-strong">
            {tile.value}
          </p>
          <p className="mt-1.5 text-xs" style={SUB_TONE[tile.subTone]}>
            {tile.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
