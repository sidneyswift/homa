import { BenchmarkDemo } from "../components/marketing/benchmark/BenchmarkDemo";
import { Community } from "../components/marketing/Community";
import { CtaBand } from "../components/marketing/CtaBand";
import { Ribbon, Wave } from "../components/marketing/dividers";
import { Faq } from "../components/marketing/Faq";
import { Features } from "../components/marketing/Features";
import { Footer } from "../components/marketing/Footer";
import { Hero } from "../components/marketing/Hero";
import { Nav } from "../components/marketing/Nav";
import { RevealObserver } from "../components/marketing/RevealObserver";
import { Stories } from "../components/marketing/Stories";
import { Pricing } from "../components/marketing/Pricing";
import { HowThread } from "../components/marketing/thread/HowThread";

/**
 * Landing page (BUILD.md Deliverable 0), a full port of the designed page at
 * docs/homa-design/ui_kits/landing/LandingPage.jsx, every section in the
 * kit's order: sticky nav, hero (with the 15s brand film overlay), ribbon,
 * feature grid, the story thread, the benchmark demo, community, stories,
 * pricing, FAQ, sunshine CTA band, footer. Section seams are the kit's
 * waves/ribbons (a ribbon IS the seam; never stack a wave at the same
 * boundary). Motion follows the emil-design-eng / review-animations skills:
 * brand ease-out + duration tokens, transform/opacity reveals armed by JS
 * with reduced-motion fallbacks, press scale on every pressable. Every CTA
 * routes to /waitlist, the live conversion path until invites open.
 */
export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg-page)", fontFamily: "var(--font-sans)", overflowX: "hidden" }}>
      <RevealObserver />
      <Nav />
      <Hero />
      <Ribbon text="LESS ADMIN · MORE TEACHING" color="var(--pop-cobalt)" phase={0} top="var(--band-sky)" bottom="var(--bg-page)" />
      <Features />
      <Wave color="var(--bg-page-warm)" flip />
      <HowThread />
      <Wave color="var(--bg-page-warm)" />
      <BenchmarkDemo />
      <Ribbon text="YOU DON'T HAVE TO DO THIS ALONE" color="var(--brand)" phase={1} />
      <Community />
      <Wave color="var(--band-blush)" flip />
      <Stories />
      <Wave color="var(--band-blush)" />
      <Pricing />
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
