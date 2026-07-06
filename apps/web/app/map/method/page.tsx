import type { Metadata } from "next";
import Link from "next/link";

import { MAP_BANK_VERSION, MAP_DOMAINS, MAP_SOURCES } from "@homa/core";

import { Logo } from "../../../components/brand/Logo";

/**
 * /map/method: how the progress report is made. The credibility page for the
 * fact-checkers (persona P4): plain method, resolvable sources per domain,
 * the honest list of what the map is not, and the current bank version.
 */

export const metadata: Metadata = {
  title: "How the progress report is made",
  description:
    "The progress report is built from a parent's observations, checked against published national benchmarks. Here is the method, the sources, and what it is not.",
};

export default function MethodPage() {
  return (
    <div className="min-h-screen bg-page">
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/" aria-label="Homa home" className="inline-flex">
          <Logo size={26} />
        </Link>

        <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-strong">
          How the progress report is made
        </h1>
        <p className="mt-4 text-body">
          You answer a short checklist about what you&apos;ve seen your child do, day to day.
          Nothing is asked of your child, ever.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">The method, plainly</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-body">
          <li>
            Every question is tied to the age when that skill is typical, per the published
            frameworks below (the same sources schools and pediatricians use).
          </li>
          <li>
            &ldquo;Easily&rdquo; on something typical of an older child counts as months ahead.
            &ldquo;Getting there&rdquo; counts as emerging. &ldquo;Not sure&rdquo; and skips are
            never held against a child; they just mean less certainty, and the report says so.
          </li>
          <li>
            Each subject&apos;s number is the strongest skill you&apos;ve seen, compared with your
            child&apos;s age in months, capped at 24 months ahead.
          </li>
          <li>
            The scoring is plain arithmetic, reviewed by a person. No AI reads or scores your
            answers, and the same answers always produce the same report.
          </li>
        </ol>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What the report is not</h2>
        <p className="mt-3 text-body">
          Not a test. Not a medical or developmental evaluation. Not advice. It is your own
          observations, organized and compared with national benchmarks. Every child grows in
          their own order, and a first report is an estimate that sharpens as you answer more.
          If something ever worries you, ask your pediatrician.
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
          The checklist covers ages 2 to 16 across {MAP_DOMAINS.length} subjects
          ({MAP_DOMAINS.map((domain) => domain.displayName).join(", ")}). Early ages use
          developmental milestones; school ages use national grade standards, asked as things a
          parent has seen (work on the table, habits around the house), never as quiz questions
          for the child. Under 2, we save what you share and email you at age 2.
        </p>
        <p className="mt-3 font-mono text-xs text-subtle">
          benchmark bank {MAP_BANK_VERSION}. Every report records the version that scored it, so
          a later correction never silently rewrites an existing report.
        </p>

        <p className="mt-10">
          <Link
            href="/map"
            className="inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
          >
            Get your free progress report
          </Link>
        </p>
      </main>
    </div>
  );
}
