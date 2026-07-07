import { Squiggle } from "./ds/Squiggle";
import { Eyebrow } from "./dividers";
import { FAQ_ITEMS } from "./faq-items";

/**
 * FAQ, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx. Items live in
 * faq-items.ts, shared with the FAQPage JSON-LD on the landing page.
 */

export function Faq() {
  return (
    <section className="lp-pad" style={{ padding: "48px 40px 116px", maxWidth: 1000, margin: "0 auto" }}>
      <div data-reveal="" style={{ marginBottom: 48, maxWidth: 560 }}>
        <Eyebrow color="var(--pop-cobalt)">Good to know</Eyebrow>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 600, color: "var(--text-strong)", margin: "8px 0 14px" }}>
          Questions, answered
        </h2>
        <Squiggle color="var(--pop-cobalt)" />
      </div>
      <div data-reveal-kids="" className="lp-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "26px 40px" }}>
        {FAQ_ITEMS.map(([q, a]) => (
          <div key={q}>
            <div style={{ fontWeight: 700, color: "var(--text-strong)", marginBottom: 6, fontSize: "1.02rem" }}>{q}</div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.55, fontSize: "0.95rem" }}>{a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
