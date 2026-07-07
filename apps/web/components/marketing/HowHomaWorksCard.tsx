"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { SkillWeb } from "./SkillWeb";

/**
 * "Curious how Homa works?" peek card, the surviving half of the benchmark
 * demo ported from docs/homa-design/ui_kits/landing/LandingPage.jsx (the
 * "Where would Homa start?" checklist demo above it was removed, founder
 * call 2026-07-06). The technical mechanics stay folded behind one calm
 * toggle: the panel expands via the .lp-peek grid-rows transition
 * (interruptible, reduced-motion collapses to a fade); the chevron rotates
 * at --dur-base --ease-out.
 */
export function HowHomaWorksCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="lp-pad" style={{ padding: "120px 40px 120px", maxWidth: 1140, margin: "0 auto" }}>
      <div
        data-reveal=""
        style={{ background: "var(--surface-card)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)", padding: "22px 28px", maxWidth: 860, margin: "0 auto" }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          style={{ display: "flex", alignItems: "center", gap: 20, cursor: "pointer", outline: "none" }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 600, color: "var(--text-strong)" }}>
              Curious how Homa works?
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: 3 }}>
              Homa asks, plans, and improves. A one-minute peek, no homework required.
            </div>
          </div>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--brand)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform var(--dur-base) var(--ease-out)",
            }}
          >
            <ChevronDown size={20} color="#fff" aria-hidden="true" />
          </span>
        </div>
        <div className="lp-peek" data-open={open ? "true" : "false"}>
          <div>
            <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 18, paddingTop: 22 }}>
              <div style={{ maxWidth: 700 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 600, color: "var(--text-strong)", marginBottom: 10 }}>
                  Every skill, connected.
                </div>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.62, fontSize: "0.98rem", margin: 0 }}>
                  Homa holds each child’s curriculum as one connected map: hundreds of skills, linked by what they
                  build on and mapped to your state’s standards. After each week, practice aims at the growing
                  edge, the next skill whose foundations are already solid. Learning scientists call it the zone of
                  proximal development. You’ll just see a week that fits.
                </p>
              </div>
              <div style={{ background: "var(--bg-page)", borderRadius: "var(--radius-lg)", padding: "14px 16px 8px", marginTop: 20 }}>
                <SkillWeb />
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 14, fontSize: "0.8rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--surface-card)", border: "1.5px solid var(--border-default)" }} /> coming up
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--sage-600)" }} /> secure
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#fff", border: "2.5px solid var(--clay-500)" }} /> Homa works next
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-subtle)", marginLeft: "auto" }}>
                  Mapped to all 50 states · redrawn after every week
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
