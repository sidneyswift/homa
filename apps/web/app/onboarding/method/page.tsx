import type { Metadata } from "next";
import Link from "next/link";

import { MAP_BANK_VERSION, MAP_DOMAINS, MAP_SOURCES } from "@homa/core";

import { Logo } from "../../../components/brand/Logo";

/**
 * /onboarding/method: how the progress report is made. The credibility page for the
 * fact-checkers (persona P4): plain method, resolvable sources per domain,
 * the honest list of what the map is not, and the current bank version.
 */

export const metadata: Metadata = {
  title: "How the progress report is made",
  description:
    "The progress report is built from a parent's observations, checked against published national benchmarks. Here is the method, the sources, and what it is not.",
  alternates: { canonical: "/onboarding/method" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://thankshoma.com" },
    {
      "@type": "ListItem",
      position: 2,
      name: "How the progress report is made",
      item: "https://thankshoma.com/onboarding/method",
    },
  ],
};

export default function MethodPage() {
  return (
    <div className="min-h-screen bg-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/" aria-label="Homa home" className="inline-flex">
          <Logo size={26} />
        </Link>

        <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-strong">
          How the progress report is made
        </h1>
        <p className="mt-4 text-body">
          You answer a short questionnaire about what you&apos;ve seen your child do, day to day.
          Nothing is asked of your child, ever.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">The method</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-body">
          <li>
            Every question is tied to the age when that skill is typical: its benchmark. The
            benchmarks come from the published sources below, the same ones schools and
            pediatricians use.
          </li>
          <li>
            You answer each question with &ldquo;Easily&rdquo;, &ldquo;Getting there&rdquo;,
            &ldquo;Not yet&rdquo;, or &ldquo;Not sure&rdquo;, or you skip it.
            &ldquo;Easily&rdquo; on something typical of an older child counts as months ahead,
            and &ldquo;Getting there&rdquo; counts partway. &ldquo;Not sure&rdquo; and skips are
            never held against a child. They mean less certainty, and the report says so.
          </li>
          <li>
            A high number takes several confirmations. Each harder question appears only after
            an &ldquo;Easily&rdquo;, so a strong result comes from a run of yes answers, never
            from one lucky answer.
          </li>
          <li>
            Each subject&apos;s number compares the typical age of the strongest skill
            you&apos;ve confirmed with your child&apos;s age today. Where research gives a
            typical age range for a skill, we count from the early end of that range, so the
            number stays conservative.
          </li>
          <li>
            The number is capped at 24 months ahead, and for younger kids at about a third of
            their age (for a 2-year-old, that&apos;s 8 months at most). A short questionnaire has
            limits, and we would rather understate than overclaim.
          </li>
          <li>
            When a skill hasn&apos;t arrived yet, the report says so: that subject is marked
            &ldquo;growing right now&rdquo;, and the specific next step is named. You will always
            know where to begin; we never write it as a verdict on a child.
          </li>
          <li>
            The scoring is plain arithmetic, written and reviewed by people. The same answers
            always produce the same numbers. Homa writes the words around your numbers, and every
            sentence is checked against our safety rules (never &ldquo;behind&rdquo;, never a
            diagnosis, never a number that is not in your answers) before you see it.
          </li>
        </ol>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What the report is not</h2>
        <p className="mt-3 text-body">
          Not a test. Not a medical or developmental evaluation. Not advice. It is your own
          observations, organized and compared with national benchmarks. Every child grows in
          their own order. A first report is an estimate, and it improves as you answer more.
          If something ever worries you, your pediatrician is the right person to ask.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Sources</h2>
        <ul className="mt-3 space-y-2 text-body">
          {Object.entries(MAP_SOURCES).map(([key, source]) => (
            <li key={key}>
              <a href={source.url} className="text-brand underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
                {source.label}
              </a>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Coverage today</h2>
        <p className="mt-3 text-body">
          The questionnaire covers ages 2 to 16 across {MAP_DOMAINS.length} subjects
          ({MAP_DOMAINS.map((domain) => domain.displayName).join(", ")}). Early ages use
          developmental milestones; school ages use national grade standards. Every question is
          asked as something a parent has seen (work on the table, habits around the house),
          never as a quiz question for the child. Under 2, we save what you share and email you
          when they turn 2.
        </p>
        <p className="mt-3 text-body">
          If we ever correct a benchmark, your existing report stays exactly as it was scored;
          nothing changes until you answer again. (Each report records the question-bank version
          that scored it, currently {MAP_BANK_VERSION}.)
        </p>

        <p className="mt-10">
          <Link
            href="/onboarding"
            className="inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
          >
            Get your free progress report
          </Link>
        </p>
      </main>
    </div>
  );
}
