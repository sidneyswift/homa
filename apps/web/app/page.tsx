import { Community } from "../components/marketing/Community";
import { CtaBand } from "../components/marketing/CtaBand";
import { Ribbon, Wave } from "../components/marketing/dividers";
import { Faq } from "../components/marketing/Faq";
import { Features } from "../components/marketing/Features";
import { Footer } from "../components/marketing/Footer";
import { Hero } from "../components/marketing/Hero";
import { HowHomaWorksCard } from "../components/marketing/HowHomaWorksCard";
import { InviteBand } from "../components/marketing/InviteBand";
import { Nav } from "../components/marketing/Nav";
import { RevealObserver } from "../components/marketing/RevealObserver";
import { Stories } from "../components/marketing/Stories";
import { HowThread } from "../components/marketing/thread/HowThread";

/**
 * Landing page (BUILD.md Deliverable 0 + lead magnet v2), built on the
 * designed page at docs/homa-design/ui_kits/landing/LandingPage.jsx with
 * the claims pass applied: no fabricated social proof (C2), no pricing
 * (T2), invite-only framing, and every CTA routes to /map, the
 * child's-map flow that replaced the bare waitlist. Section seams are the
 * kit's waves/ribbons (a ribbon IS the seam; never stack a wave at the
 * same boundary). Motion follows the emil-design-eng / review-animations
 * skills: brand ease-out + duration tokens, transform/opacity reveals
 * armed by JS with reduced-motion fallbacks, press scale on every
 * pressable.
 */
export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg-page)", fontFamily: "var(--font-sans)", overflowX: "hidden" }}>
      <RevealObserver />
      {/* The gradient wraps Nav + Hero together (not just Hero): now that
          Nav is transparent, anchoring the glow to Hero's own top edge left
          a hard seam right under the nav, where the flat page background
          behind it met the gradient starting abruptly below. Originating
          the gradient from the true top of the page reads through the
          transparent nav continuously instead. A second, much smaller echo
          of the same gold-100 glow (not a second color) sits mid-left,
          just enough to keep that side from reading flat next to the
          top-right one. */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(18% 22% at 8% 58%, var(--gold-100) 0%, transparent 68%), " +
            "radial-gradient(100% 130% at 88% 0%, var(--gold-100) 0%, var(--bg-page) 58%)",
        }}
      >
        <Nav />
        <Hero />
      </div>
      <Ribbon text="LESS ADMIN · MORE TEACHING" color="var(--pop-cobalt)" phase={0} top="var(--bg-page)" bottom="var(--bg-page)" />
      <Features />
      <Wave color="var(--bg-page-warm)" flip />
      <HowThread />
      <Wave color="var(--bg-page-warm)" />
      <HowHomaWorksCard />
      <Ribbon text="YOU DON'T HAVE TO DO THIS ALONE" color="var(--brand)" phase={1} />
      <Community />
      <Wave color="var(--band-blush)" flip />
      <Stories />
      <Wave color="var(--band-blush)" />
      <InviteBand />
      <Faq />
      <Ribbon text="PLAN LESS · BREATHE MORE" color="var(--pop-navy)" ink="var(--gold-400)" phase={0} top="var(--bg-page)" bottom="var(--band-sunshine)" />
      <CtaBand />
      <div style={{ background: "var(--band-sunshine)" }}>
        <Wave color="var(--pop-navy)" flip />
      </div>
      <Footer />
    </div>
  );
}
