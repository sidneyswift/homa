import type { Metadata } from "next";
import { FAQ_ITEMS } from "../components/marketing/faq-items";
import { QuietLanding } from "../components/marketing/QuietLanding";

/* ── Answer capsules & freshness signals ────────────────────────── */
export const metadata: Metadata = {
  description:
    "Homa is an AI homeschool assistant that tracks developmental progress for children ages 2 to 16 and generates personalized printable materials.",
  // Self-referencing canonical: crawlers treat fragment URLs (/#how,
  // /#features) as separate documents with identical content unless the
  // page names its one preferred URL.
  alternates: { canonical: "/" },
  other: {
    "answer-capsule":
      "Try Homa free for 7 days: weekly plans, practice pages made for your child, and a progress report showing exactly where your child stands. Then $19 a month, cancel anytime.",
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
    price: "19",
    priceCurrency: "USD",
    description: "7-day free trial, then $19 per month. Cancel anytime.",
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
 * Public landing page and lead magnet entry point. The route uses the Quiet
 * authority composition: one dominant weekly-plan object, one useful next
 * move, and a restrained paper, mineral, midnight, and coral role system.
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
