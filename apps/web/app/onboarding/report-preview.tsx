import { Doodle } from "../../components/marketing/Doodle";

/**
 * Decorative, at-a-glance mock of the progress report for the entry
 * screen's right column (founder call 2026-07-06: "build a sample report
 * mock ui so they can visualize what they get"). Not the real component,
 * but truthful to it: same header band, semantic position language, and
 * Quiet authority tokens as report-view.tsx.
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
  { subject: "Language", badge: "Ahead \u00b7 +9 mo", chipBg: "var(--homa-highlight-tint)", chipInk: "var(--homa-highlight-ink)", barColor: "var(--homa-highlight-ink)", barWidth: "88%" },
  { subject: "Math", badge: "Ahead \u00b7 +4 mo", chipBg: "var(--homa-highlight-tint)", chipInk: "var(--homa-highlight-ink)", barColor: "var(--homa-highlight-ink)", barWidth: "72%" },
  { subject: "Reading", badge: "On track", chipBg: "var(--homa-constructive-tint)", chipInk: "var(--homa-constructive-ink)", barColor: "var(--homa-constructive-ink)", barWidth: "58%" },
  { subject: "Fine motor", badge: "Growing right now", chipBg: "var(--homa-info-tint)", chipInk: "var(--homa-info-ink)", barColor: "var(--homa-info-ink)", barWidth: "34%" },
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
      color="var(--homa-visual-coral)"
        rotate={-12}
        style={{ position: "absolute", top: -13, left: -11, zIndex: 2 }}
      />

      <div data-brand-surface="report-preview" className="quiet-report-preview rotate-[1.5deg] overflow-hidden rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] shadow-[var(--shadow-xl)] transition-transform duration-(--homa-motion-base) ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-0 group-focus-visible:shadow-[var(--shadow-focus)]">
        <div className="relative px-6 pb-5 pt-6" style={{ background: "var(--homa-info-tint)" }}>
          <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--homa-info-ink)" }}>
            Sample {"\u00b7"} made for Maya
          </p>
          {/* Second person, not the sample kid's name (founder screenshot
              2026-07-08): the mock sells what YOUR child gets; Maya stays
              in the eyebrow and note as the worked example. Sentence case
              per house style. */}
          {/* nowrap keeps "progress report" wrapping as a unit; a mid-width
              break set the coral word alone at the start of line 2. */}
          <p className="mt-1.5 font-display text-2xl font-bold leading-tight text-strong">
            Your child&apos;s <span style={{ color: "var(--homa-brand-text)", whiteSpace: "nowrap" }}>progress report</span>
          </p>
          <p className="mt-1.5 font-mono text-[0.6875rem]" style={{ color: "var(--homa-info-ink)" }}>
            age 4y 2m {"\u00b7"} 16 subjects {"\u00b7"} national benchmarks
          </p>
          {/* Anchored to the header seam, not the card: a fixed top offset
              landed on the wrapped meta line at narrow widths and sliced
              "national benchmarks" mid-word. */}
          <div
            className="absolute -bottom-3.5 right-3 rotate-[3deg] whitespace-nowrap rounded-[var(--homa-radius-control)] bg-[var(--homa-paper)] px-3 py-1.5 text-xs font-bold shadow-[var(--shadow-md)]"
            style={{ color: "var(--homa-constructive-ink)" }}
          >
            {"\u25b2"} +4 mo since June
          </div>
        </div>

        <div className="space-y-2.5 p-5">
          {PREVIEW_ROWS.map((row) => (
            <div key={row.subject} className="rounded-[var(--homa-radius-control)] border border-[var(--homa-soft-boundary)] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="whitespace-nowrap text-sm font-semibold text-strong">{row.subject}</span>
                <span
                  className="whitespace-nowrap rounded-[var(--homa-radius-control)] px-2.5 py-1 text-[0.6875rem] font-bold"
                  style={{ background: row.chipBg, color: row.chipInk }}
                >
                  {row.badge}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-[var(--homa-soft-boundary)]">
                <div className="h-full rounded-pill" style={{ width: row.barWidth, background: row.barColor }} />
              </div>
            </div>
          ))}

          <div className="rounded-[var(--homa-radius-control)] bg-[var(--homa-constructive-tint)] px-3.5 py-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--homa-constructive-ink)" }}>
              A note from Homa
            </p>
            <p className="mt-1 text-sm leading-snug text-body">
              Language is Maya&apos;s strongest start. Fine motor is growing right now, right on
              rhythm for four.
            </p>
          </div>

          {/* Closes the card in the same micro-label ritual as the header
              eyebrow and the Homa note, so the last line reads designed
              rather than defaulted. */}
          <p
            className="pt-1 text-center font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em]"
            style={{ color: "var(--homa-muted-ink)" }}
          >
            + 12 more subjects inside
          </p>
        </div>
      </div>
    </a>
  );
}
