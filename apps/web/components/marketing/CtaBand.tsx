"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "./ds/Button";
import { Doodle } from "./Doodle";
import { HERO_COPY } from "./landing-content";
import { useSignupPopup } from "./SignupPopupProvider";

/**
 * Sunshine CTA band, grown from the kit band in
 * docs/homa-design/ui_kits/landing/LandingPage.jsx. `data-final-cta` lets
 * ScrollCta.tsx find this section without a prop link, so it can retire
 * its own nudge once the page's real CTA is already on screen. The main
 * CTA opens the signup popup (founder call 2026-07-08); it stays the one
 * action of this moment. Type on solid gold uses var(--gold-ink-strong),
 * the documented ink for gold-400/500 surfaces. The headline shares the
 * finale display variant with HowThread's H2 so the page's two big
 * display moments match. The dot field fades out toward the center
 * (mask, transparent in the middle) so the headline sits on clean gold.
 */
export function CtaBand() {
  const openPopup = useSignupPopup();
  const dotMask =
    "radial-gradient(ellipse 62% 78% at 50% 44%, transparent 34%, #000 76%)";
  return (
    <section
      data-final-cta=""
      className="lp-pad"
      style={{ background: "var(--band-sunshine)", padding: "116px 40px 96px", position: "relative", overflow: "hidden", textAlign: "center" }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(var(--gold-ink) 1.7px, transparent 1.7px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "24px 16px",
          opacity: 0.14,
          WebkitMaskImage: dotMask,
          maskImage: dotMask,
          pointerEvents: "none",
        }}
      />
      <Doodle name="star" size={38} color="var(--pop-cobalt)" rotate={-14} style={{ position: "absolute", top: 52, left: "9%" }} />
      {/* Twinkle lives on the wrapper, rotate on the doodle, so the two transforms never fight.
          The small gold star below it holds steady while the sparkle dips, so the
          corner keeps weight through the animation's low phase. */}
      <span className="nb-twinkle" style={{ position: "absolute", top: 52, right: "11%", display: "inline-flex" }}>
        <Doodle name="sparkle" size={32} color="#fff" rotate={20} />
      </span>
      <Doodle name="star" size={16} color="var(--gold-ink)" rotate={18} style={{ position: "absolute", top: 96, right: "9.5%", opacity: 0.45 }} />
      <Doodle name="heart" size={30} color="var(--clay-600)" rotate={12} style={{ position: "absolute", bottom: 64, right: "9%" }} />
      <Doodle name="flower" size={40} color="var(--gold-ink)" rotate={-12} style={{ position: "absolute", bottom: 56, left: "9%", opacity: 0.44 }} />
      {/* Below 560px the squiggle slides behind the centered button and the loop
          clumps against the heart, so both step aside; the flower and heart hold
          one clean mark per corner on phones. */}
      <style>{
        ".cta-band-squiggle, .cta-band-loop { display: inline-flex; } " +
        "@media (max-width: 559px) { .cta-band-squiggle, .cta-band-loop { display: none; } .cta-h2-br { display: none; } }"
      }</style>
      <span className="cta-band-squiggle" aria-hidden="true" style={{ position: "absolute", bottom: 110, left: "17%", opacity: 0.3 }}>
        <Doodle name="squiggle" size={44} color="var(--gold-ink)" rotate={8} />
      </span>
      {/* Sits at 24% so it bridges the corner marks toward the center third
          instead of pinning the edge. The flower runs a touch heavier (0.44)
          so the bottom-left answers the heart-plus-loop pair on the right;
          the squiggle stays the lightest mark at 0.3 since it sits highest. */}
      <span className="cta-band-loop" aria-hidden="true" style={{ position: "absolute", bottom: 56, right: "24%", opacity: 0.38 }}>
        <Doodle name="loop" size={48} color="var(--gold-ink)" rotate={-9} />
      </span>
      <div style={{ position: "relative", maxWidth: 820, margin: "0 auto" }}>
        <div data-reveal="" style={{ lineHeight: 0 }}>
          <Doodle name="sun" size={30} color="var(--gold-ink-strong)" />
        </div>
        <h2
          data-reveal=""
          className="lp-h2 lp-h2-finale"
          style={{ color: "var(--gold-ink-strong)", margin: "16px 0 14px" }}
        >
          {/* The forced break lands the desktop split after "report", never
              after the hanging verb "is"; phones drop it (see the style tag
              above) and keep their balanced three-line wrap. */}
          The free <span style={{ whiteSpace: "nowrap" }}>progress report</span>
          <br className="cta-h2-br" /> is the place to start.
        </h2>
        <p
          data-reveal=""
          className="rv-d1"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, fontSize: "clamp(1.3rem, 1.15rem + 0.5vw, 1.5rem)", color: "var(--gold-ink-strong)", margin: "0 0 34px" }}
        >
          {/* The nowrap span keeps a 560-600px wrap from stranding "child."
              as a widow; the phrase is ~200px at this size so it can never
              overflow a 320px viewport. */}
          No card is needed. The questionnaire takes about{" "}
          <span style={{ whiteSpace: "nowrap" }}>five minutes per child.</span>
        </p>
        <div data-reveal="" className="rv-d2" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
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
      </div>
    </section>
  );
}
