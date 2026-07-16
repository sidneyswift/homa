"use client";

import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "./ds/Button";
import { Doodle } from "./Doodle";
import { HeroProductDemo } from "./HeroProductDemo";
import { HERO_COPY } from "./landing-content";
import { PlatformStrip } from "./PlatformStrip";
import { useSignupPopup } from "./SignupPopupProvider";

/**
 * Category-led landing hero. The fixture-safe product demo replaces the
 * lifestyle-only image so a first-time visitor can see what using Homa means.
 * The primary action preserves the shared signup popup and link fallback.
 */
export function Hero() {
  const openPopup = useSignupPopup();
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <Doodle name="star" size={34} rotate={-12} style={{ position: "absolute", top: 46, left: "4%" }} />
      <Doodle name="sun" size={34} color="var(--gold-500)" style={{ position: "absolute", top: 40, left: "46%" }} />
      <Doodle
        name="squiggle"
        size={44}
        color="var(--pop-cobalt)"
        style={{ position: "absolute", bottom: 52, left: "44%" }}
      />
      <div
        className="lp-hero-grid lp-hero-shell lp-pad"
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: 48,
          alignItems: "center",
          padding: "104px 40px 96px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div data-reveal="">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--surface-card)",
              color: "var(--clay-600)",
              padding: "7px 16px",
              borderRadius: "var(--radius-pill)",
              fontWeight: 700,
              fontSize: "0.85rem",
              boxShadow: "var(--shadow-sm)",
              maxWidth: "100%",
            }}
          >
            <Sparkles size={15} aria-hidden="true" style={{ flexShrink: 0 }} /> {HERO_COPY.eyebrow}
          </span>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.6rem, 7vw, 3.9rem)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              color: "var(--text-strong)",
              margin: "18px 0 0",
            }}
          >
            The homeschool <span style={{ color: "var(--clay-600)" }}>assistant</span> that does the
            prep.
          </h1>
          <p style={{ fontSize: "1.22rem", color: "var(--stone-700)", lineHeight: 1.55, margin: "18px 0 0", maxWidth: 500 }}>
            {HERO_COPY.body}
          </p>
          <div className="lp-hero-actions" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 24 }}>
            {openPopup ? (
              <Button variant="primary" size="lg" onClick={openPopup} iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}>
                {HERO_COPY.primaryAction}
              </Button>
            ) : (
              <Button variant="primary" size="lg" href="/onboarding" iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}>
                {HERO_COPY.primaryAction}
              </Button>
            )}
          </div>
          <PlatformStrip />
        </div>
        <div data-reveal="" className="rv-d1" style={{ position: "relative" }}>
          <HeroProductDemo />
        </div>
      </div>
    </section>
  );
}
