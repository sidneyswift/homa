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
  return (
    <div style={{ background: "var(--bg-page)", fontFamily: "var(--font-sans)", overflowX: "hidden" }}>
      {/* Structured data for agent discoverability */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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
    </div>
  );
}
