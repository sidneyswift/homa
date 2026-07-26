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
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
}
/* Crop choreography: the pan (custom property) slides the cover window
   away from the laptop on the photo's right; the desktop zoom finishes
   the job where the wide window would otherwise show nearly the whole
   frame, so the eyebrow's no-screens promise and the imagery agree. */
.lp-hero2-photo-crop img {
  object-position: var(--hero-crop-x, 18%) 42%;
}
@media (min-width: 1101px) and (max-width: 1199px) {
  .lp-hero2-photo-crop img {
    transform: scale(1.12);
    transform-origin: 10% 25%;
  }
}
@media (min-width: 1200px) {
  .lp-hero2-photo-crop img {
    transform: scale(1.26);
    transform-origin: 10% 25%;
  }
}
/* 881-1100: the phone pins bottom-left, so the pan stops where the
   daughter's face keeps clear air off the bezel. */
@media (min-width: 881px) and (max-width: 1100px) {
  .lp-hero2-photo-crop { --hero-crop-x: 26%; }
}
/* Stacked phones: the window is narrow enough that a fuller pan drops
   the laptop to a sliver while the mom's face keeps margin from the
   right edge. */
@media (max-width: 540px) {
  .lp-hero2-photo-crop { --hero-crop-x: 22%; }
}
/* 541-880 (iPad portrait band): the wide stacked window shows nearly the
   whole frame, so only the desktop zoom technique clears the laptop off
   the right edge while the eyebrow's no-screens promise sits above. */
@media (min-width: 541px) and (max-width: 880px) {
  .lp-hero2-photo-crop img {
    transform: scale(1.32);
    transform-origin: 12% 30%;
  }
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
  left: 218px;
  bottom: -42px;
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
/* Tablet band only: globals hides the shell doodles below 881px, which
   leaves the rail right of the copy column bare at 541-880px. A star+sun
   pair anchored to the copy column's bottom (the fine-print and chips
   zone) carries the same hand-placed language as the desktop shell pair
   and tracks the content instead of a magic offset; hidden everywhere
   else so wider layouts keep their own doodles. */
.lp-hero2-tablet-doodle { display: none; pointer-events: none; }
@media (min-width: 541px) and (max-width: 880px) {
  .lp-hero2-tablet-doodle {
    display: inline-block;
    position: absolute;
  }
  .lp-hero2-tablet-doodle--sun { right: 30px; bottom: 26px; }
  .lp-hero2-tablet-doodle--star { right: 78px; bottom: 132px; }
}
/* Laptop widths: the column narrows before the stack collapses, so the
   phone shrinks and hugs the corner to keep the daughter's face and
   writing hand clear of its right bezel. */
@media (min-width: 881px) and (max-width: 1100px) {
  /* bottom sits above the slab's own -22px overhang so the device stays
     inside the mint silhouette and the photo keeps visual primacy. left
     stays at -14px minimum: -34px put the bezel within 10px of the body
     copy's right edge at 900px. */
  .lp-hero2-phone-float {
    left: -14px;
    bottom: -14px;
    transform: rotate(-2.5deg) scale(0.56);
  }
  /* The note drops fully below the photo edge here. The phone pins
     bottom-left in this band, so the note slides toward it until the
     arrow tip lands at the device's lower corner (the proof it
     annotates) instead of gesturing up into the photo's book stack. */
  .lp-hero2-note {
    left: auto;
    right: 90px;
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
  /* left overlaps the frame edge so no pinched sliver of photo (the
     dark chalkboard) survives between the bezel and the card edge; the
     overhang echoes the desktop placement's language. */
  .lp-hero2-phone-float {
    left: -10px;
    bottom: -24px;
    transform: rotate(-2.5deg) scale(0.66);
  }
}
/* Tablet only (the note goes static below 541px): the note drops far
   enough that both wrapped lines clear the slab's -22px overhang onto
   cream, and the shell's bottom padding grows to match so the section's
   overflow: hidden never clips the descender. */
@media (min-width: 541px) and (max-width: 880px) {
  .lp-hero-grid { padding-bottom: 88px !important; }
  .lp-hero2-note { left: 246px; bottom: -74px; font-size: 1.25rem; }
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
        <div style={{ position: "relative" }}>
          <span className="lp-hero2-tablet-doodle lp-hero2-tablet-doodle--sun" aria-hidden="true">
            <Doodle name="sun" size={30} color="var(--gold-500)" />
          </span>
          <span className="lp-hero2-tablet-doodle lp-hero2-tablet-doodle--star" aria-hidden="true">
            <Doodle name="star" size={18} rotate={14} />
          </span>
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
          <div
            className="lp-hero-actions"
            style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 26, marginBottom: 28 }}
          >
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
        <div className="lp-hero-visual lp-hero2-visual">
          <div className="lp-hero2-slab" aria-hidden="true" />
          <div className="lp-hero2-photo">
            <div className="lp-hero2-photo-crop">
              {/* object-position lives in HERO_CSS (per-band custom
                  property) so each breakpoint pans the crop away from
                  the laptop without inline-style fights. */}
              <Image
                src="/images/hero-family.png"
                alt="A mom and her daughter working through a workbook together at the kitchen table"
                width={760}
                height={440}
                priority
                sizes="(max-width: 880px) 100vw, 680px"
                style={{ width: "100%", height: 440, objectFit: "cover", display: "block" }}
              />
              {/* Two blend washes pull the stock photo into the page's warm
                  paper palette: a sand multiply and a faint clay soft-light.
                  Opacities stay whisper-low so skin tones read natural. */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: "var(--stone-200)",
                  mixBlendMode: "multiply",
                  opacity: 0.1,
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: "var(--clay-600)",
                  mixBlendMode: "soft-light",
                  opacity: 0.06,
                }}
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
            {/* NBSP keeps "this morning" together: without it the note
                widows "morning" alone on line two at >=1101px and <=540px. */}
            {"made for Maya this\u00A0morning"}
          </p>
        </div>
      </div>
    </section>
  );
}
