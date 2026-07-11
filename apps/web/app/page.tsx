import type { Metadata } from "next";
import { CtaBand } from "../components/marketing/CtaBand";
import { Ribbon, Wave } from "../components/marketing/dividers";
import { Faq } from "../components/marketing/Faq";
import { Features } from "../components/marketing/Features";
import { Footer } from "../components/marketing/Footer";
import { Hero } from "../components/marketing/Hero";
import { HowHomaWorksCard } from "../components/marketing/HowHomaWorksCard";
import { Nav } from "../components/marketing/Nav";
import { RevealObserver } from "../components/marketing/RevealObserver";
import { ScrollCta } from "../components/marketing/ScrollCta";
import { SignupPopupProvider } from "../components/marketing/SignupPopupProvider";
import { Stories } from "../components/marketing/Stories";
import { HowThread } from "../components/marketing/thread/HowThread";
import { FAQ_ITEMS } from "../components/marketing/faq-items";

/* ── Answer capsules & freshness signals ────────────────────────── */
export const metadata: Metadata = {
  description:
    "Homa is an AI homeschool assistant that tracks developmental progress for children ages 2 to 16 and generates personalized printable materials.",
  // Self-referencing canonical: crawlers treat fragment URLs (/#how,
  // /#features) as separate documents with identical content unless the
  // page names its one preferred URL.
  alternates: { canonical: "/" },
  other: {
    "last-modified": new Date().toISOString(),
    "answer-capsule":
      "Get a free progress report showing exactly where your child stands. Takes five minutes.",
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Homa",
  url: "https://thankshoma.com",
  description:
    "The calm homeschool assistant. Homa learns each child, makes printable materials just for them, tracks hours for your state, and shows you it\u2019s working.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free developmental progress report",
  },
  // @id ties into the Organization node in the root layout's site-wide
  // graph; name stays inline for validators that don't resolve across
  // script blocks.
  author: { "@type": "Organization", "@id": "https://thankshoma.com/#organization", name: "Homa" },
  publisher: { "@type": "Organization", "@id": "https://thankshoma.com/#organization", name: "Homa" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

/**
 * Landing page (BUILD.md Deliverable 0 + lead magnet v2), built on the
 * designed page at docs/homa-design/ui_kits/landing/LandingPage.jsx with
 * the claims pass applied: no fabricated social proof (C2), no pricing
 * (T2), and every CTA routes to /onboarding, the child's-map flow that
 * replaced the bare waitlist. Section seams are the kit's waves/ribbons (a
 * ribbon IS the seam; never stack a wave at the same boundary). Motion
 * follows the emil-design-eng / review-animations skills: brand ease-out +
 * duration tokens, transform/opacity reveals armed by JS with
 * reduced-motion fallbacks, press scale on every pressable. Invite-only
 * framing was retired from this page (founder call 2026-07-07): ScrollCta
 * replaces the old InviteBand section with a scroll-triggered nudge back
 * to /onboarding instead. The Community section ("Find your people") and
 * its "you don't have to do this alone" ribbon were removed the same day
 * (founder screenshot 2026-07-07): community is roadmap-only (journeys/07
 * open question 7), so the page no longer sells it.
 */
export default function LandingPage() {
  // overflowX is clip, not hidden: hidden would make this div a scroll
  // container, which silently turns the sticky Nav static (an ancestor
  // with overflow hidden becomes what sticky sticks to, and this div
  // never scrolls). clip fences the decorative bleed (ribbons, waves)
  // without creating a scroll container, so the nav pins for real.
  return (
    <div style={{ background: "var(--bg-page)", fontFamily: "var(--font-sans)", overflowX: "clip" }}>
      {/* Structured data for agent discoverability */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <RevealObserver />
      <SignupPopupProvider>
        {/* Nav sits OUTSIDE the gradient wrapper: sticky never escapes its
            containing block, so a nav nested in a hero-height wrapper got
            shoved off screen as soon as the hero scrolled past (it pinned
            for one screen, then vanished). Instead the nav is a direct
            child of the page root (containing block = the whole page) and
            the wrapper pulls itself up under the transparent bar by the
            nav's own height, so the glow still starts at the true top of
            the page and reads through the nav with no hard seam, exactly
            as before. The gradient's geometry is untouched: the wrapper
            occupies the same box on screen, padding standing in for the
            nav's old slot. A second, much smaller echo of the same
            gold-100 glow (not a second color) sits mid-left, just enough
            to keep that side from reading flat next to the top-right one.
            No overflow here on purpose: Hero clips its own doodles, and
            overflow hidden on this wrapper was one of the two things that
            kept the sticky nav from ever pinning on this page. */}
        <Nav />
        <div
          style={{
            position: "relative",
            marginTop: "calc(-1 * var(--lp-nav-height))",
            paddingTop: "var(--lp-nav-height)",
            background:
              "radial-gradient(18% 22% at 8% 58%, var(--gold-100) 0%, transparent 68%), " +
              "radial-gradient(100% 130% at 88% 0%, var(--gold-100) 0%, var(--bg-page) 58%)",
          }}
        >
          <Hero />
        </div>
        <Ribbon text="LESS ADMIN · MORE TEACHING" color="var(--pop-cobalt)" phase={0} top="var(--bg-page)" bottom="var(--bg-page)" />
        <Features />
        <ScrollCta />
        <Wave color="var(--bg-page-warm)" flip />
        <HowThread />
        <Wave color="var(--bg-page-warm)" />
        <HowHomaWorksCard />
        <Wave color="var(--band-blush)" flip />
        <Stories />
        <Wave color="var(--band-blush)" />
        <Faq />
        <Ribbon text="PLAN LESS · BREATHE MORE" color="var(--pop-navy)" ink="var(--gold-400)" phase={0} top="var(--bg-page)" bottom="var(--band-sunshine)" />
        <CtaBand />
        <div style={{ background: "var(--band-sunshine)" }}>
          <Wave color="var(--pop-navy)" flip />
        </div>
        <Footer />
      </SignupPopupProvider>
    </div>
  );
}
