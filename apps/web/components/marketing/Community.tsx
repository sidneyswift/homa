import { ArrowRight, MapPin } from "lucide-react";

import { Badge } from "./ds/Badge";
import { Button } from "./ds/Button";
import { Squiggle } from "./ds/Squiggle";
import { Eyebrow } from "./dividers";

/**
 * Community section, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: nearby families,
 * co-ops, and park days.
 */
export function Community() {
  return (
    <section className="lp-pad" style={{ padding: "120px 40px 104px", maxWidth: 1140, margin: "0 auto", position: "relative" }}>
      <div className="lp-2col" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center" }}>
        <div data-reveal="">
          <Eyebrow color="var(--sage-700)">Find your people</Eyebrow>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 2.6rem)",
              fontWeight: 700,
              color: "var(--text-strong)",
              margin: "8px 0 14px",
            }}
          >
            You don&rsquo;t have to do this alone.
          </h2>
          <Squiggle style={{ maxWidth: 300 }} color="var(--sage-600)" />
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "18px 0 24px", maxWidth: 440 }}>
            Homa will introduce you to nearby families, co-ops, and park days, matched to your
            kids&rsquo; ages and what you&rsquo;re teaching.
          </p>
          <Button variant="secondary" href="/onboarding" iconRight={<ArrowRight size={16} aria-hidden="true" />}>
            Join the first families
          </Button>
        </div>
        {/* Honest roadmap card (ruling C2: no invented families or stats;
            journeys/07 open question 7: community is roadmap language only). */}
        <div
          data-reveal=""
          className="rv-d1"
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-md)",
            padding: "26px 28px",
            transform: "rotate(-0.6deg)",
          }}
        >
          <Badge tone="sage">On the roadmap</Badge>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, color: "var(--text-strong)", lineHeight: 1.3, marginTop: 14 }}>
            Homa families near you: co-ops, park days, friends who get it.
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: 8, lineHeight: 1.5 }}>
            Coming as the first families grow. Opt-in, always.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, color: "var(--text-subtle)", fontSize: "0.85rem" }}>
            <MapPin size={14} aria-hidden="true" /> Wherever you homeschool
          </div>
        </div>
      </div>
    </section>
  );
}
