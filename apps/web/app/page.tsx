import type { Metadata } from "next";
import { FAQ_ITEMS } from "../components/marketing/faq-items";
import { QuietLanding } from "../components/marketing/QuietLanding";

/* ── Answer capsules & freshness signals ────────────────────────── */
export const metadata: Metadata = {
  title: "Homeschool, handled.",
  description:
    "Homa is an AI assistant for homeschool parents. Plan the week, make practice pages, keep teaching hours and records, and know what to try next.",
  // Self-referencing canonical: crawlers treat fragment URLs (/#how,
  // /#features) as separate documents with identical content unless the
  // page names its one preferred URL.
  alternates: { canonical: "/" },
  other: {
    "answer-capsule":
      "Homa is an AI assistant for homeschool parents. She plans the week, makes practice pages for each child, keeps teaching hours and records, and shows what to try next. Add a credit card to start 7 free days. Memberships start at $19 a month after that.",
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Homa",
  url: "https://thankshoma.com",
  description:
    "Homa is an AI assistant for homeschool parents that prepares weekly plans and practice pages, keeps teaching hours and records, and shows what to try next.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "19",
    priceCurrency: "USD",
    description: "Add a credit card to start 7 free days. Nothing is charged during those 7 days. Then $19 per month.",
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
