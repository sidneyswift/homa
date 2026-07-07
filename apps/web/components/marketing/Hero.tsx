import Image from "next/image";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";

import { Button } from "./ds/Button";
import { Doodle } from "./Doodle";

/**
 * Landing hero, ported from docs/homa-design/ui_kits/landing/LandingPage.jsx
 * and since slimmed by founder calls (2026-07-05 "say exactly what it is",
 * 2026-07-06 "remove watch the film, remove the trust line"): brand-named
 * promise headline, one CTA into /onboarding, three scattered doodles. The
 * brand-film modal left with its button; no state remains, so this is a
 * server component.
 *
 * Background per founder screenshot 2026-07-06: warm page cream with a
 * soft gold-100 glow rising from the top-right corner (was flat band-sky).
 * Lives on the page-level wrapper (app/page.tsx), not this section: it
 * wraps Nav + Hero together so the glow reads through the transparent nav
 * instead of stopping at Hero's own top edge. This section used to also
 * carry its own copy of the same gradient, which is harmless where the
 * two colors agree but silently painted over anything else layered onto
 * the wrapper underneath it (found while adding the sky-100 accent
 * below), so it was removed here.
 *
 * Photo per founder screenshot 2026-07-06 (second pass): plain rounded
 * rectangle (radius-xl + shadow-xl), not the earlier organic blob crop,
 * with a floating "proof" stat card at its bottom-left corner echoing
 * Features' "Proof it's working" card (same ChartLine icon, sage tint,
 * same "12 points since April" number) so the hero previews that payoff
 * before the visitor ever scrolls to it. The heart doodle that lived in
 * that corner moved out to make room.
 *
 * Copy per founder call 2026-07-06 (third pass): headline leads with "Meet
 * Homa" instead of "Homa is", the warmer introduction of the two while
 * keeping the 07-05 ruling (name the product, say exactly what it is); the
 * subhead adopts the reference's longer version, minus its em dash (house
 * style, AGENTS.md: never one, anywhere), the hero CTA reads "Get started
 * for free" (T2: no pricing exists yet, so "free" is accurate, not a claim).
 */
export function Hero() {
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
        className="lp-hero-grid lp-pad"
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: 48,
          alignItems: "center",
          padding: "116px 40px 108px",
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
            }}
          >
            <Sparkles size={15} aria-hidden="true" /> In your corner, every school day
          </span>
          {/* Brand-named headline (founder call 2026-07-06, third pass),
              continuing the 2026-07-05 clarity ruling: say exactly what it
              is, now with "Meet Homa" as the warmer opener. */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.6rem, 7vw, 3.9rem)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              color: "var(--text-strong)",
              margin: "22px 0 0",
            }}
          >
            Meet Homa,
            <br />
            your homeschool <span style={{ color: "var(--clay-600)" }}>assistant</span>.
          </h1>
          <p style={{ fontSize: "1.22rem", color: "var(--stone-700)", lineHeight: 1.55, margin: "24px 0 0", maxWidth: 470 }}>
            Homa plans your week, makes materials for each kid, and tracks your hours for
            your state, so Sunday-night prep becomes a five-minute check-in.
          </p>
          <div style={{ marginTop: 32 }}>
            <Button variant="primary" size="lg" href="/onboarding" iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}>
              Get started for free
            </Button>
          </div>
        </div>
        <div data-reveal="" className="rv-d1" style={{ position: "relative" }}>
          <div style={{ borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-xl)" }}>
            <Image
              src="/images/hero-family.png"
              alt="A mom and her son working through a workbook together at the kitchen table"
              width={760}
              height={440}
              priority
              sizes="(max-width: 880px) 100vw, 540px"
              style={{ width: "100%", height: 440, objectFit: "cover", display: "block" }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: -16,
              bottom: -24,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--surface-card)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-md)",
              padding: "12px 18px 12px 12px",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--sage-50)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <TrendingUp size={19} color="var(--sage-600)" aria-hidden="true" />
            </span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  color: "var(--sage-600)",
                  lineHeight: 1.1,
                }}
              >
                {"\u25b2"} 12 pts
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Maya {"\u00b7"} Math, since April
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
