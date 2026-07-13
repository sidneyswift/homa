import { ArrowRight } from "lucide-react";

import { ReportPreview } from "../../app/onboarding/report-preview";
import { Button } from "./ds/Button";
import { Eyebrow } from "./dividers";
import { SAMPLE_REPORT_COPY } from "./landing-content";

/** The free progress report is the page's primary proof and lowest-risk door. */
export function SampleReportProof() {
  return (
    <section id="sample-report" className="lp-pad" style={{ padding: "92px 40px 112px" }}>
      <div
        className="lp-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "0.9fr 1.1fr",
          gap: 72,
          alignItems: "center",
          maxWidth: 1080,
          margin: "0 auto",
          padding: "54px clamp(24px, 5vw, 64px)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-2xl)",
          background: "var(--surface-card)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div data-reveal="">
          <Eyebrow>{SAMPLE_REPORT_COPY.eyebrow}</Eyebrow>
          <h2
            style={{
              maxWidth: 520,
              margin: "10px 0 0",
              color: "var(--text-strong)",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 2.75rem)",
              fontWeight: 700,
              lineHeight: 1.08,
            }}
          >
            {SAMPLE_REPORT_COPY.headline}
          </h2>
          <p
            style={{
              maxWidth: 500,
              margin: "22px 0 0",
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              background: "var(--sage-50)",
              color: "var(--sage-700)",
              fontWeight: 650,
              lineHeight: 1.5,
            }}
          >
            {SAMPLE_REPORT_COPY.reassurance}
          </p>
          <p style={{ maxWidth: 510, margin: "18px 0 0", color: "var(--text-body)", fontSize: "1.05rem", lineHeight: 1.65 }}>
            {SAMPLE_REPORT_COPY.body}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
            <Button
              variant="primary"
              size="lg"
              href={SAMPLE_REPORT_COPY.href}
              iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}
            >
              {SAMPLE_REPORT_COPY.action}
            </Button>
          </div>
        </div>
        <div data-reveal="" className="rv-d1" style={{ minWidth: 0 }}>
          <ReportPreview />
        </div>
      </div>
    </section>
  );
}
