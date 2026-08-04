import { Doodle } from "../../components/marketing/Doodle";
import { QuietFrame } from "../../components/design";

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
      className="group relative mx-auto block min-w-0 w-full max-w-[24rem] focus-visible:outline-none lg:mx-0 lg:max-w-none"
    >
      <Doodle
        name="star"
        size={30}
      color="var(--homa-visual-coral)"
        rotate={-12}
        style={{ position: "absolute", top: -13, left: -11, zIndex: 2 }}
      />

      <QuietFrame as="article" data-brand-surface="report-preview" className="quiet-report-preview rotate-[1.5deg] overflow-hidden transition-transform duration-(--homa-motion-base) ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-0 group-focus-visible:shadow-[var(--shadow-focus)]">
        <div className="quiet-report-preview__header relative">
          <p className="quiet-report-preview__eyebrow" style={{ color: "var(--homa-info-ink)" }}>
            Sample {"\u00b7"} made for Maya
          </p>
          {/* Second person, not the sample kid's name (founder screenshot
              2026-07-08): the mock sells what YOUR child gets; Maya stays
              in the eyebrow and note as the worked example. Sentence case
              per house style. */}
          {/* nowrap keeps "progress report" wrapping as a unit; a mid-width
              break set the coral word alone at the start of line 2. */}
          <p className="quiet-report-preview__title">
            Your child&apos;s <span style={{ color: "var(--homa-brand-text)", whiteSpace: "nowrap" }}>progress report</span>
          </p>
          <p className="quiet-report-preview__meta" style={{ color: "var(--homa-info-ink)" }}>
            age 4y 2m {"\u00b7"} 16 subjects {"\u00b7"} national benchmarks
          </p>
          {/* Anchored to the header seam, not the card: a fixed top offset
              landed on the wrapped meta line at narrow widths and sliced
              "national benchmarks" mid-word. */}
          <div className="quiet-report-preview__delta" style={{ color: "var(--homa-constructive-ink)" }}>
            {"\u25b2"} +4 mo since June
          </div>
        </div>

        <div className="quiet-report-preview__body">
          {PREVIEW_ROWS.map((row) => (
            <div key={row.subject} className="quiet-report-preview__row">
              <div className="quiet-report-preview__row-head">
                <span className="quiet-report-preview__subject">{row.subject}</span>
                <span
                  className="quiet-report-preview__chip"
                  style={{ background: row.chipBg, color: row.chipInk }}
                >
                  {row.badge}
                </span>
              </div>
              <div className="quiet-report-preview__bar" aria-hidden="true">
                <div className="quiet-report-preview__bar-fill" style={{ width: row.barWidth, background: row.barColor }} />
              </div>
            </div>
          ))}

          <div className="quiet-report-preview__note">
            <p className="quiet-report-preview__note-eyebrow" style={{ color: "var(--homa-constructive-ink)" }}>
              A note from Homa
            </p>
            <p className="quiet-report-preview__note-copy">
              Language is Maya&apos;s strongest start. Fine motor is growing right now, right on
              rhythm for four.
            </p>
          </div>

          {/* Closes the card in the same micro-label ritual as the header
              eyebrow and the Homa note, so the last line reads designed
              rather than defaulted. */}
          <p className="quiet-report-preview__footer" style={{ color: "var(--homa-muted-ink)" }}>
            + 12 more subjects inside
          </p>
        </div>
      </QuietFrame>
    </a>
  );
}
