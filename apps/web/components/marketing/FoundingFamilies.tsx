import { Check } from "lucide-react";

import { Button } from "./ds/Button";
import { Eyebrow } from "./dividers";

/**
 * Founding families band. Replaces the kit's three-tier pricing grid, which
 * violated two standing rulings (T2: no pricing on the page; the tiers were
 * also invented). Honest framing: invite-only cohort, the map is the first
 * step, unlimited children is real policy (decision D9).
 */

const POINTS = [
  "Start with your child's map, free, today",
  "Founding families are invited in small groups, with real attention",
  "Every plan will include unlimited children, always",
  "Your family's answers are saved, so Homa knows your kids on day one",
] as const;

export function FoundingFamilies() {
  return (
    <section id="pricing" className="lp-pad" style={{ padding: "112px 40px 88px", maxWidth: 820, margin: "0 auto" }}>
      <div data-reveal="" style={{ textAlign: "center" }}>
        <Eyebrow>Founding families</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 2.6rem)",
            fontWeight: 700,
            color: "var(--text-strong)",
            margin: "10px 0 12px",
          }}
        >
          We&rsquo;re letting families in a few at a time.
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "1.05rem", lineHeight: 1.6, margin: "0 auto", maxWidth: 560 }}>
          So every family gets real attention while Homa grows. Your child&rsquo;s map is the
          first step, and it&rsquo;s yours to keep either way.
        </p>
      </div>
      <div
        data-reveal=""
        className="rv-d1"
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-md)",
          padding: "30px 32px",
          margin: "36px auto 0",
          maxWidth: 560,
        }}
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {POINTS.map((point) => (
            <li key={point} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--text-body)", lineHeight: 1.5 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--accent-sage-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <Check size={13} color="var(--sage-600)" aria-hidden="true" />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 24 }}>
          <Button variant="primary" size="lg" fullWidth href="/map">
            Meet your child&rsquo;s map
          </Button>
        </div>
        <p style={{ textAlign: "center", color: "var(--text-subtle)", fontSize: "0.85rem", margin: "12px 0 0" }}>
          Your invite comes by email.
        </p>
      </div>
    </section>
  );
}
