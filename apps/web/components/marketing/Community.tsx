import { ArrowRight, MapPin } from "lucide-react";

import { Avatar } from "./ds/Avatar";
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
            Homa introduces you to nearby families, co-ops, and park days, matched to your kids&rsquo; ages and what
            you&rsquo;re teaching.
          </p>
          <Button variant="secondary" href="/waitlist" iconRight={<ArrowRight size={16} aria-hidden="true" />}>
            Find families near you
          </Button>
        </div>
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
          <div style={{ display: "flex", marginBottom: 14 }}>
            {["Ana M", "Dana K", "June P", "Sara T"].map((n, i) => (
              <span key={n} style={{ marginLeft: i ? -10 : 0 }}>
                <Avatar name={n} size={40} />
              </span>
            ))}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 500, color: "var(--text-strong)", lineHeight: 1.3 }}>
            4 Homa families homeschool within 5 miles.
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: 6, lineHeight: 1.5 }}>
            Two are planning park days this month.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
            <Badge tone="sage">Park day &middot; Sat 10 am</Badge>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-subtle)", fontSize: "0.85rem" }}>
              <MapPin size={14} aria-hidden="true" /> Austin, TX
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
