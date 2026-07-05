import { Check } from "lucide-react";

import { Badge } from "./ds/Badge";
import { Button } from "./ds/Button";

/**
 * Pricing tiers, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx (Solo / Family / Co-op).
 */

const TIERS: ReadonlyArray<readonly [string, string, string, string, readonly string[], boolean]> = [
  ["Solo", "$9", "/mo", "For one learner", ["1 child", "Weekly planning", "Progress tracking", "Worksheet generator"], false],
  ["Family", "$19", "/mo", "Most popular", ["Up to 5 children", "Everything in Solo", "Standards benchmarking", "Priority support"], true],
  ["Co-op", "$39", "/mo", "For groups", ["Unlimited children", "Shared plans", "Group reporting", "Admin tools"], false],
];

export function Pricing() {
  return (
    <section id="pricing" className="lp-pad" style={{ padding: "112px 40px 88px", maxWidth: 1100, margin: "0 auto" }}>
      <h2
        data-reveal=""
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 5vw, 2.6rem)",
          fontWeight: 700,
          color: "var(--text-strong)",
          textAlign: "center",
          margin: "0 0 56px",
        }}
      >
        Simple, family-friendly pricing
      </h2>
      <div data-reveal-kids="" className="lp-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "start" }}>
        {TIERS.map(([name, price, per, tag, feats, hot]) => (
          <div
            key={name}
            style={{
              background: hot ? "var(--brand)" : "var(--surface-card)",
              border: hot ? "none" : "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl)",
              padding: 28,
              boxShadow: hot ? "var(--shadow-lg)" : "var(--shadow-sm)",
              transform: hot ? "scale(1.03)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: "1.1rem", color: hot ? "#fff" : "var(--text-strong)" }}>{name}</span>
              {hot ? (
                <Badge tone="gold" variant="solid">
                  {tag}
                </Badge>
              ) : (
                <span style={{ fontSize: "0.85rem", color: "var(--text-subtle)" }}>{tag}</span>
              )}
            </div>
            <div style={{ margin: "18px 0", display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: 600, color: hot ? "#fff" : "var(--text-strong)" }}>
                {price}
              </span>
              <span style={{ color: hot ? "rgba(255,255,255,0.85)" : "var(--text-subtle)" }}>{per}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              {feats.map((f) => (
                <div
                  key={f}
                  style={{ display: "flex", gap: 8, alignItems: "center", color: hot ? "rgba(255,255,255,0.95)" : "var(--text-body)", fontSize: "0.95rem" }}
                >
                  <Check size={17} color={hot ? "#fff" : "var(--sage-600)"} aria-hidden="true" /> {f}
                </div>
              ))}
            </div>
            <Button variant={hot ? "soft" : "secondary"} fullWidth href="/waitlist">
              Choose {name}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
