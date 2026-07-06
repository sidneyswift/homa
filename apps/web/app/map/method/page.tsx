import type { Metadata } from "next";
import Link from "next/link";

import { MAP_BANK_VERSION, MAP_DOMAINS, MAP_SOURCES } from "@homa/core";

import { Logo } from "../../../components/brand/Logo";

/**
 * /map/method: how the map is made. The credibility page for the
 * fact-checkers (persona P4): plain method, resolvable sources per domain,
 * the honest list of what the map is not, and the current bank version.
 */

export const metadata: Metadata = {
  title: "How the map is made",
  description:
    "The progress report is built from a parent's observations, checked against published national benchmarks. Here is the method, the sources, and what the report is not.",
};

export default function MethodPage() {
  return (
    <div className="min-h-screen bg-page">
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/" aria-label="Homa home" className="inline-flex">
          <Logo size={26} />
        </Link>

        <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-strong">
          How the map is made
        </h1>
        <p className="mt-4 text-body">
          You answer a short checklist about what you&apos;ve seen your child do, day to day.
          Nothing is asked of your child, ever.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">The method, plainly</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-body">
          <li>
            Every checklist item is anchored to the age by which that behavior is typical,
            according to the published frameworks below (the same sources schools and pediatric
            milestone checklists draw from).
          </li>
          <li>
            When you say &ldquo;easily&rdquo; to something typical of an older child, that shows up
            as months ahead. &ldquo;Getting there&rdquo; counts as emerging. &ldquo;Not sure&rdquo;
            and skipped items are never held against a child: they simply mean less certainty, and
            the map says so.
          </li>
          <li>
            Each domain&apos;s position is the strongest behavior you&apos;ve actually observed,
            compared with your child&apos;s age in months, capped at 24 months ahead.
          </li>
          <li>
            The scoring is deterministic arithmetic, reviewed by a person. No AI model reads or
            scores your answers, and the same answers always produce the same map.
          </li>
        </ol>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What the report is not</h2>
        <p className="mt-3 text-body">
          The report is not a test, not a medical or developmental evaluation, and not advice. It is
          an organized picture of your own observations, compared with national benchmarks. Every
          child grows in their own order, and a first report is an estimate that sharpens with more
          observations over time. If something on a report ever worries you, your pediatrician is the
          right person to ask.
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
          The checklist covers ages 2 to 16 across {MAP_DOMAINS.length} domains
          ({MAP_DOMAINS.map((domain) => domain.displayName).join(", ")}). Early ages anchor to
          developmental milestones; school ages anchor to national grade-band standards, asked as
          things a parent has actually seen (work on the table, habits around the house), never as
          quiz questions for the child. For children under 2, we save what you share and email you
          the moment their checklist is ready at age 2.
        </p>
        <p className="mt-3 font-mono text-xs text-subtle">
          benchmark bank version {MAP_BANK_VERSION}. Reports record the version that scored them,
          so a later content correction never silently rewrites an existing map.
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
