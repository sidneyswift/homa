import { ArrowRight } from "lucide-react";

import { ReportPreview } from "../../app/onboarding/report-preview";
import { Button } from "./ds/Button";
import { Squiggle } from "./ds/Squiggle";
import { Eyebrow } from "./dividers";
import { SAMPLE_REPORT_COPY } from "./landing-content";

/** The free progress report is the page's primary proof and lowest-risk door. */
export function SampleReportProof() {
  return (
    <section id="sample-report" className="lp-pad lp-section" style={{ padding: "72px 40px 88px" }}>
      {/* Below 880px lp-2col stacks and the card moves under the text, so the
          gold wash follows it to the bottom corner; !important outranks the
          inline background. */}
      <style>{`@media (max-width: 880px) { .lp-report-panel { background: radial-gradient(560px 420px at 86% 100%, var(--gold-100) 0%, transparent 70%), var(--surface-card) !important; } }
@media (max-width: 400px) { #sample-report .lp-h2 { font-size: 1.85rem; } }`}</style>
      <div
        className="lp-2col lp-report-panel"
        style={{
          display: "grid",
          gridTemplateColumns: "0.9fr 1.1fr",
          gap: "clamp(48px, 6vw, 72px)",
          alignItems: "center",
          maxWidth: 1080,
          margin: "0 auto",
          padding: "54px clamp(24px, 5vw, 64px)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-2xl)",
          // The hero's gold-100 corner wash, echoed on the panel behind the
          // report mock's top-right; the element's own background, so the
          // rounded corner clips it with no overflow tricks.
          background:
            "radial-gradient(560px 420px at 86% 0%, var(--gold-100) 0%, transparent 70%), var(--surface-card)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div data-reveal="">
          <Eyebrow>{SAMPLE_REPORT_COPY.eyebrow}</Eyebrow>
          {/* Shares the page-wide .lp-h2 ritual; the scoped 400px override
              in the style tag above keeps the 1.85rem floor that stops
              "report" landing alone on its own line at 320px. */}
          <h2 className="lp-h2" style={{ maxWidth: 520, margin: "10px 0 14px", color: "var(--text-strong)" }}>
            {SAMPLE_REPORT_COPY.headline}
          </h2>
          <Squiggle line={false} color="var(--brand)" style={{ width: "auto" }} />
          <p
            style={{
              maxWidth: 500,
              margin: "22px 0 0",
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--sage-100)",
              background: "var(--sage-50)",
              color: "var(--sage-700)",
              // The sage box carries the emphasis; a bold block under the
              // display H2 read as the loudest element in the column.
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {SAMPLE_REPORT_COPY.reassurance}
          </p>
          <p style={{ maxWidth: 500, margin: "18px 0 0", color: "var(--text-body)", fontSize: "1.05rem", lineHeight: 1.65 }}>
            {SAMPLE_REPORT_COPY.body}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
            <Button
              variant="primary"
              size="lg"
              href={SAMPLE_REPORT_COPY.href}
              iconRight={<ArrowRight size={18} color="currentColor" aria-hidden="true" />}
            >
              {SAMPLE_REPORT_COPY.action}
            </Button>
          </div>
          {/* A hand-note tilt (static transform, safe under reduced motion)
              echoes the report mock's sticker language across the gutter. */}
          <div style={{ display: "inline-block", margin: "14px 0 0", transform: "rotate(-1deg)" }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "1.15rem",
                color: "var(--stone-700)",
              }}
            >
              Free, and no card is needed.
            </p>
            <Squiggle line={false} segments={4} color="var(--gold-400)" style={{ width: "auto", marginTop: 3 }} />
          </div>
        </div>
        <div data-reveal="" className="rv-d1" style={{ minWidth: 0 }}>
          <ReportPreview />
        </div>
      </div>
    </section>
  );
}
