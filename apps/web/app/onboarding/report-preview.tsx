import { Doodle } from "../../components/marketing/Doodle";

/**
 * Decorative, at-a-glance mock of the progress report for the entry
 * screen's right column (founder call 2026-07-06: "build a sample report
 * mock ui so they can visualize what they get"). Not the real component,
 * but truthful to it: same header band, same badge colors and position
 * language as report-view.tsx (gold = ahead, sage = on track, sky =
 * growing right now, growth framing only, never a red or "behind" state).
 * The whole card links to the real /onboarding/sample so the tease pays
 * off in one tap.
 */

const PREVIEW_ROWS: ReadonlyArray<{
  subject: string;
  badge: string;
  chipBg: string;
  chipInk: string;
  barColor: string;
  barWidth: string;
}> = [
  { subject: "Language", badge: "Ahead \u00b7 +9 mo", chipBg: "var(--gold-100)", chipInk: "var(--gold-ink)", barColor: "var(--gold-400)", barWidth: "88%" },
  { subject: "Math", badge: "Ahead \u00b7 +4 mo", chipBg: "var(--gold-100)", chipInk: "var(--gold-ink)", barColor: "var(--gold-400)", barWidth: "72%" },
  { subject: "Reading", badge: "On track", chipBg: "var(--sage-50)", chipInk: "var(--sage-700)", barColor: "var(--sage-400)", barWidth: "58%" },
  { subject: "Fine motor", badge: "Growing right now", chipBg: "var(--sky-100)", chipInk: "var(--sky-600)", barColor: "var(--sky-500)", barWidth: "34%" },
];

export function ReportPreview() {
  return (
    <a
      href="/onboarding/sample"
      aria-label="See the full sample report"
      className="group relative mx-auto block w-full max-w-[24rem] focus-visible:outline-none lg:mx-0 lg:max-w-none"
    >
      <Doodle
        name="star"
        size={30}
        color="var(--gold-400)"
        rotate={-12}
        style={{ position: "absolute", top: -13, left: -11, zIndex: 2 }}
      />

      <div className="rotate-[1.5deg] overflow-hidden rounded-lg border border-border-subtle bg-card shadow-[var(--shadow-xl)] transition-transform duration-(--dur-base) ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-0 group-focus-visible:shadow-[var(--shadow-focus)]">
        <div className="px-6 pb-5 pt-6" style={{ background: "var(--band-sky)" }}>
          <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--pop-navy)" }}>
            Sample {"\u00b7"} made for Maya
          </p>
          {/* Second person, not the sample kid's name (founder screenshot
              2026-07-08): the mock sells what YOUR child gets; Maya stays
              in the eyebrow and note as the worked example. Sentence case
              per house style. */}
          <p className="mt-1.5 font-display text-2xl font-bold leading-tight text-strong">
            Your child&apos;s <span style={{ color: "var(--clay-600)" }}>progress report</span>
          </p>
          <p className="mt-1.5 font-mono text-[0.6875rem]" style={{ color: "var(--pop-navy)" }}>
            age 4y 2m {"\u00b7"} 16 subjects {"\u00b7"} national benchmarks
          </p>
        </div>

        <div className="space-y-2.5 p-5">
          {PREVIEW_ROWS.map((row) => (
            <div key={row.subject} className="rounded-md border border-border-subtle px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-strong">{row.subject}</span>
                <span
                  className="whitespace-nowrap rounded-pill px-2.5 py-1 text-[0.6875rem] font-bold"
                  style={{ background: row.chipBg, color: row.chipInk }}
                >
                  {row.badge}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-[var(--stone-100)]">
                <div className="h-full rounded-pill" style={{ width: row.barWidth, background: row.barColor }} />
              </div>
            </div>
          ))}

          <div className="rounded-md bg-[var(--accent-sage-soft)] px-3.5 py-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--sage-700)" }}>
              A note from Homa
            </p>
            <p className="mt-1 text-sm leading-snug text-body">
              Language is Maya&apos;s strongest start. Fine motor is growing right now, right on
              rhythm for four.
            </p>
          </div>

          <p className="pt-0.5 text-center text-xs text-subtle">+ 12 more subjects inside</p>
        </div>
      </div>

      <div
        className="absolute -right-2 top-32 rotate-[3deg] rounded-pill bg-card px-3 py-1.5 text-xs font-bold shadow-[var(--shadow-md)]"
        style={{ color: "var(--sage-600)" }}
      >
        {"\u25b2"} +4 mo since June
      </div>
    </a>
  );
}
