import { QuietFrame } from "../../components/design";

/**
 * Decorative, at-a-glance mock of the progress report for the entry
 * screen's right column (founder call 2026-07-06: "build a sample report
 * mock ui so they can visualize what they get"). Not the real component,
 * but truthful to it: same header band, parent-provided evidence, useful
 * next steps, and Quiet authority tokens as report-view.tsx.
 * The whole card links to the real /onboarding/sample so the tease pays
 * off in one tap.
 */

const PREVIEW_ROWS: ReadonlyArray<{
  subject: string;
  evidence: string;
  nextStep: string;
  chipBg: string;
  chipInk: string;
}> = [
  { subject: "Language", evidence: "Retells a familiar event in order", nextStep: "Ask what happened next", chipBg: "var(--homa-highlight-tint)", chipInk: "var(--homa-highlight-ink)" },
  { subject: "Math", evidence: "Shares six blocks evenly between two toys", nextStep: "Try eight blocks with two toys", chipBg: "var(--homa-highlight-tint)", chipInk: "var(--homa-highlight-ink)" },
  { subject: "Reading", evidence: "Recognizes her name and familiar signs", nextStep: "Look for one new word on a label", chipBg: "var(--homa-constructive-tint)", chipInk: "var(--homa-constructive-ink)" },
  { subject: "Drawing", evidence: "Draws lines and closed circles", nextStep: "Trace one curved line together", chipBg: "var(--homa-info-tint)", chipInk: "var(--homa-info-ink)" },
];

export function ReportPreview() {
  return (
    <a
      href="/onboarding/sample"
      aria-label="See the full sample report"
      className="quiet-report-preview-link"
    >
      <QuietFrame as="article" data-brand-surface="report-preview" className="quiet-report-preview">
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
            age 4 {"\u00b7"} from her parent&apos;s answers
          </p>
          {/* Anchored to the header seam, not the card so a wrapped meta
              line cannot collide with the next-step label. */}
          <div className="quiet-report-preview__delta" style={{ color: "var(--homa-constructive-ink)" }}>
            What to try next
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
                  From you
                </span>
              </div>
              <p className="quiet-report-preview__evidence">{row.evidence}</p>
              <p className="quiet-report-preview__next">Try next: {row.nextStep}</p>
            </div>
          ))}

          <div className="quiet-report-preview__note">
            <p className="quiet-report-preview__note-eyebrow" style={{ color: "var(--homa-constructive-ink)" }}>
              A note from Homa
            </p>
            <p className="quiet-report-preview__note-copy">
              You said Maya retells familiar events in order. Next time you share a story, ask what happened next.
            </p>
          </div>

          {/* The whole card is one link. Close with its destination, not a
              hidden subject count that makes the report feel like a test. */}
          <p className="quiet-report-preview__footer" style={{ color: "var(--homa-muted-ink)" }}>
            See the full sample report
          </p>
        </div>
      </QuietFrame>
    </a>
  );
}
