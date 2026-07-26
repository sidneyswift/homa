"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Button } from "./ds/Button";
import { Doodle } from "./Doodle";
import { HeroProductDemo } from "./HeroProductDemo";
import { HERO_COPY } from "./landing-content";
import { PlatformStrip } from "./PlatformStrip";
import { useSignupPopup } from "./SignupPopupProvider";

const ACCENT_WORD = "assistant";

/**
 * Paints the accent word inside the pinned headline. The string itself
 * comes from landing-content.ts only; splitting at render time keeps that
 * file the single copy source.
 */
function AccentedHeadline({ text }: { text: string }) {
  const at = text.indexOf(ACCENT_WORD);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span style={{ color: "var(--clay-600)" }}>{ACCENT_WORD}</span>
      {text.slice(at + ACCENT_WORD.length)}
    </>
  );
}

/**
 * Hero-scoped rules live here (not globals.css) so the collage can restyle
 * per breakpoint without inline-style !important fights. Class names are
 * namespaced lp-hero2-* to stay clear of the retired globals rules.
 */
const HERO_CSS = `
.lp-hero2-h1 { text-wrap: balance; }
.lp-hero2-eyebrow { text-wrap: balance; }
.lp-hero2-visual { position: relative; }
.lp-hero2-slab {
  position: absolute;
  top: 30px;
  left: 36px;
  right: -18px;
  bottom: -22px;
  background: var(--sage-100);
  border-radius: var(--radius-xl);
  transform: rotate(1.3deg);
}
.lp-hero2-photo {
  position: relative;
  padding: 10px;
  background: var(--surface-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}
.lp-hero2-photo-crop {
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.lp-hero2-phone-float {
  position: absolute;
  left: -30px;
  bottom: -36px;
  width: 340px;
  transform: rotate(-2.5deg) scale(0.72);
  transform-origin: bottom left;
  filter: drop-shadow(0 20px 32px rgba(51, 42, 33, 0.22));
}
.lp-hero2-note {
  position: absolute;
  left: 240px;
  bottom: -48px;
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  max-width: 200px;
  font-family: var(--font-hand);
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 0.95;
  color: var(--sage-600);
  transform: rotate(-2.5deg);
}
.lp-hero2-cta-flourish {
  position: absolute;
  left: 50%;
  bottom: -16px;
  transform: translateX(-50%);
  pointer-events: none;
}
/* Laptop widths: the column narrows before the stack collapses, so the
   phone shrinks and hugs the corner to keep the daughter's face and
   writing hand clear of its right bezel. */
@media (min-width: 881px) and (max-width: 1100px) {
  /* bottom sits above the slab's own -22px overhang so the device stays
     inside the mint silhouette and the photo keeps visual primacy. */
  .lp-hero2-phone-float {
    left: -34px;
    bottom: -14px;
    transform: rotate(-2.5deg) scale(0.56);
  }
  /* The note drops fully below the photo edge here; pinned to the corner
     it wraps to three cramped lines and loses the margin-scribble feel. */
  .lp-hero2-note {
    left: auto;
    right: 2px;
    bottom: -60px;
    max-width: 150px;
    font-size: 1.2rem;
  }
}
@media (max-width: 880px) {
  /* page.tsx pulls the gradient wrapper up under the sticky nav and pads
     it back by the same height, so this padding is all visible cream.
     40px keeps deliberate air between the nav edge and the eyebrow chip
     without opening a dead band. */
  .lp-hero-grid { padding-top: 40px !important; }
  .lp-hero2-phone-float {
    left: 14px;
    bottom: -24px;
    transform: rotate(-2.5deg) scale(0.66);
  }
  .lp-hero2-note { left: 246px; bottom: -44px; }
}
@media (max-width: 540px) {
  .lp-hero2-visual {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .lp-hero2-slab {
    top: 18px;
    left: 16px;
    right: -8px;
    bottom: 10px;
    transform: rotate(1.1deg);
  }
  .lp-hero2-photo { align-self: stretch; }
  .lp-hero2-phone-float {
    position: static;
    width: min(300px, 88%);
    margin: -112px 0 0;
    transform: rotate(-1.8deg);
  }
  .lp-hero2-note {
    position: static;
    align-self: flex-end;
    margin: 10px 6px 0 0;
    transform: rotate(-2deg);
  }
}
@media (max-width: 540px) {
  .lp-hero2-eyebrow {
    align-items: flex-start !important;
    padding: 6px 14px !important;
    font-size: 0.78rem !important;
    border-radius: var(--radius-lg) !important;
  }
  .lp-hero2-eyebrow svg { margin-top: 2px; }
}
@media (max-width: 374px) {
  .lp-hero2-h1 { font-size: 2.15rem !important; }
  /* Body steps down with the display size so the smallest screens keep
     a roughly 2x display-to-body ratio instead of compressing to 1.76. */
  .lp-hero2-h1 + p { font-size: 1.08rem !important; }
}
`;

/**
 * Category-led landing hero. The left column carries the pinned copy plus
 * the sticker platform chips; the right column is a paper collage: framed
 * family photo on a mint slab, the fixture-safe phone demo clipping its
 * corner, and one hand note pointing at the proof. Above-the-fold content
 * renders immediately (no entrance reveal). The primary action preserves
 * the shared signup popup and link fallback.
 */
export function Hero() {
  const openPopup = useSignupPopup();
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <style>{HERO_CSS}</style>
      <div
        className="lp-hero-grid lp-hero-shell lp-pad"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: 48,
          alignItems: "center",
          padding: "104px 40px 96px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* Doodles anchor to the 1200px shell, not the viewport, so they
            never strand in the outer margins on wide screens. */}
        <div className="lp-hero-doodles" aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <Doodle name="star" size={30} rotate={-12} style={{ position: "absolute", top: 38, left: 6 }} />
          <span className="nb-float" style={{ position: "absolute", top: 24, right: 12, display: "inline-block" }}>
            <Doodle name="sun" size={34} color="var(--gold-500)" />
          </span>
        </div>
        <div>
          <span
            className="lp-hero2-eyebrow"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--surface-card)",
              color: "var(--clay-600)",
              padding: "7px 16px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-pill)",
              fontWeight: 700,
              fontSize: "0.85rem",
              boxShadow: "var(--shadow-sm)",
              maxWidth: "100%",
            }}
          >
            <Doodle name="star" size={14} color="var(--clay-600)" style={{ flexShrink: 0 }} /> {HERO_COPY.eyebrow}
          </span>
          <h1
            className="lp-hero2-h1"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.4rem, 2.2vw + 1.6rem, 3.9rem)",
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.015em",
              color: "var(--text-strong)",
              margin: "18px 0 0",
            }}
          >
            <AccentedHeadline text={HERO_COPY.headline} />
          </h1>
          <p style={{ fontSize: "1.22rem", color: "var(--stone-700)", lineHeight: 1.55, margin: "18px 0 0", maxWidth: 500 }}>
            {HERO_COPY.body}
          </p>
          <div className="lp-hero-actions" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 26 }}>
            <span style={{ position: "relative", display: "inline-flex" }}>
              {openPopup ? (
                <Button variant="primary" size="lg" onClick={openPopup} iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}>
                  {HERO_COPY.primaryAction}
                </Button>
              ) : (
                <Button variant="primary" size="lg" href="/onboarding" iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}>
                  {HERO_COPY.primaryAction}
                </Button>
              )}
              {/* The cobalt squiggle now underlines the one action on the
                  page instead of floating in dead space. */}
              <svg className="lp-hero2-cta-flourish" viewBox="0 0 96 12" width={168} height={16} aria-hidden="true">
                <path
                  d="M2 8.5 C 10 2.5, 18 2.5, 26 7.5 S 42 10.5, 50 6.5 S 66 2.5, 74 6.5 S 90 10, 94 5"
                  fill="none"
                  stroke="var(--pop-cobalt)"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "1.05rem",
              color: "var(--text-muted)",
              margin: "20px 0 0",
            }}
          >
            No card is needed. The questionnaire takes about five minutes per child.
          </p>
          <PlatformStrip />
        </div>
        <div className="lp-hero-visual lp-hero2-visual">
          <div className="lp-hero2-slab" aria-hidden="true" />
          <div className="lp-hero2-photo">
            <div className="lp-hero2-photo-crop">
              {/* objectPosition pans the crop left so the daughter sits right
                  of the floating phone instead of hidden behind it. */}
              <Image
                src="/images/hero-family.png"
                alt="A mom and her daughter working through a workbook together at the kitchen table"
                width={760}
                height={440}
                priority
                sizes="(max-width: 880px) 100vw, 540px"
                style={{ width: "100%", height: 440, objectFit: "cover", objectPosition: "30% 42%", display: "block" }}
              />
            </div>
          </div>
          {/* Slight tilt matches the hand-placed doodle language; the warm
              drop-shadow separates the device from the busy photo behind it. */}
          <div className="lp-hero2-phone-float">
            <HeroProductDemo />
          </div>
          <p className="lp-hero2-note">
            <svg viewBox="0 0 28 24" width={21} height={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M25 20 C 17 18.5, 9.5 13, 6 5.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              <path d="M3.5 10.5 L 5.8 4.8 L 11.5 6.2" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            made for Maya this morning
          </p>
        </div>
      </div>
    </section>
  );
}
