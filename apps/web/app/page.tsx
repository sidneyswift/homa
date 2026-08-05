import type { Metadata } from "next";
import { FAQ_ITEMS } from "../components/marketing/faq-items";
import { HERO_COPY, MEMBERSHIP_ITEMS } from "../components/marketing/landing-content";
import { QuietLanding } from "../components/marketing/QuietLanding";

/* ── Answer capsules & freshness signals ────────────────────────── */
export const metadata: Metadata = {
  title: "Homeschool, handled.",
  description:
    "Homa is an AI assistant for homeschool parents. Plan the week, make practice pages, and keep your homeschool records together.",
  // Self-referencing canonical: crawlers treat fragment URLs (/#how,
  // /#features) as separate documents with identical content unless the
  // page names its one preferred URL.
  alternates: { canonical: "/" },
  other: {
    "answer-capsule": `${HERO_COPY.body} ${HERO_COPY.primaryActionNote}`,
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Homa",
  url: "https://thankshoma.com",
  description:
    "Homa is an AI assistant for homeschool parents. She plans the week, makes practice pages, and keeps homeschool records together.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any",
  offers: MEMBERSHIP_ITEMS.map((membership) => ({
    "@type": "Offer",
    name: membership.name,
    price: String(membership.monthlyPrice),
    priceCurrency: "USD",
    description: `${membership.body} ${HERO_COPY.primaryActionNote}`,
  })),
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
 * Public landing page and lead magnet entry point. The route uses the Quiet
 * authority composition: one clear product promise, one live weekly-plan
 * preview, and a restrained paper, mineral, midnight, and coral role system.
 * Signup actions open the shared onboarding popup, while the sample-report
 * action remains a direct public demonstration link. JSON-LD stays server
 * rendered so search and answer-capsule consumers receive the same claims as
 * the visible page. The route intentionally keeps no decorative dependency
 * on the former landing composition; artifact previews are retained only as
 * evidence of real Homa work.
 */
export default function LandingPage() {
  return (
    <>
      {/* Structured data for agent discoverability */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <QuietLanding />
    </>
  );
}
