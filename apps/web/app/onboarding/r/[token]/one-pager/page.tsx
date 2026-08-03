import type { Metadata } from "next";
import Link from "next/link";

import { ageInMonths, ageLabel, getMapSubject, MAP_SOURCES } from "@homa/core";

import { Logo } from "../../../../../components/brand/Logo";
import { getReportByToken } from "../../../../../lib/map/store";
import { ReportChart } from "../report-chart";

/**
 * The one-page summary: the same deterministic numbers, shaped for the
 * reader who has ninety seconds and a raised eyebrow (a spouse, a
 * grandparent, the co-op table). Strengths first, the chart, hard
 * counts, citations, done. Deliberately excludes everything the parent
 * volunteered privately (helpWith, whats-working notes, the letter
 * addressed to her): D6, sensitive context never in shareable artifacts
 * unasked. First name only, print-first, zero model calls.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progress summary",
  robots: { index: false },
};

export default async function OnePagerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getReportByToken(token);

  if (!report) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-20">
        <Logo size={26} />
        <h1 className="mt-8 font-display text-2xl font-bold text-strong">
          This link isn&apos;t active.
        </h1>
      </main>
    );
  }

  const months = ageInMonths(report.birthMonth);
  const scores = report.scores;
  const byId = new Map(scores.subjects.map((score) => [score.subjectId, score]));
  const ordered = scores.strengthOrder
    .map((id) => byId.get(id))
    .filter((score): score is NonNullable<typeof score> => Boolean(score));
  const strengths = ordered.filter((s) => s.position === "ahead" && !s.exposureBased).slice(0, 3);
  const generatedDate = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sourceKeys = new Set<string>();
  for (const score of scores.subjects) {
    if (score.position === "not_mapped") continue;
    getMapSubject(score.subjectId)?.items.forEach((item) =>
      item.sources.forEach((key) => sourceKeys.add(key)),
    );
  }

  return (
    <div data-brand-surface="report-one-pager" className="quiet-report quiet-print-surface min-h-screen bg-[var(--homa-canvas)] pb-16 print:bg-[var(--homa-paper)]">
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        <div className="quiet-frame overflow-hidden rounded-[var(--homa-radius-card)] border-[var(--homa-control-boundary)] shadow-lg print:border-0 print:shadow-none">
          <div className="quiet-report__hero px-7 pb-6 pt-8 sm:px-10" style={{ background: "var(--homa-info-tint)" }}>
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="font-mono text-xs uppercase tracking-widest text-strong/70">
                progress summary {"\u00b7"} {generatedDate}
              </span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-strong">
              {report.childName}, {ageLabel(months)}: one honest page
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-strong/70">
              <span>
                subjects mapped <b className="text-strong">{scores.mappedCount} of {scores.totalSubjects}</b>
              </span>
              <span>
                observations <b className="text-strong">{scores.observationCount}</b>
              </span>
              <span>
                benchmarks <b className="text-strong">national, cited</b>
              </span>
            </div>
          </div>

          <div className="px-7 py-7 sm:px-10">
            {strengths.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {strengths.map((score) => {
                  const domain = getMapSubject(score.subjectId);
                  return (
                    <div key={score.subjectId} className="rounded-[var(--homa-radius-control)] p-4" style={{ background: "var(--homa-highlight-tint)" }}>
                      <p className="font-semibold" style={{ color: "var(--homa-highlight-ink)" }}>
                        {domain?.displayName}
                      </p>
                      <p className="mt-1 font-mono text-2xl" style={{ color: "var(--homa-highlight-ink)" }}>
                        +{score.monthsAhead}
                        <span className="text-sm"> mo past typical</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <h2 className="mt-7 font-display text-lg font-semibold text-strong">
              Every subject, one chart
            </h2>
            <p className="mt-1 text-sm text-muted">
              One dot per subject against what&apos;s typical for {ageLabel(months)}. The warm
              highlight marks past typical, constructive marks at typical, and info marks growth
              toward typical.
            </p>
            <div className="mt-3 rounded-[var(--homa-radius-control)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-4">
              <ReportChart scores={ordered} prior={null} variant="wide" />
            </div>

            <div className="mt-7 rounded-[var(--homa-radius-control)] bg-[var(--homa-canvas)] p-4 text-xs text-[var(--homa-muted-ink)]">
              <p>
                Built from a parent&apos;s structured observations, each checked against published
                national benchmarks: the same sources schools and pediatricians use. Not a test
                and not medical advice, and every child grows in their own order. Full receipts
                (every question, answer, and citation) live on the full report.
              </p>
              <p className="mt-2 font-mono text-[0.65rem] leading-relaxed text-subtle">
                SOURCES {"\u00b7"}{" "}
                {Array.from(sourceKeys)
                  .map((key) => MAP_SOURCES[key]?.label)
                  .filter(Boolean)
                  .slice(0, 6)
                  .join(" \u00b7 ")}
                {sourceKeys.size > 6 ? ` \u00b7 and ${sourceKeys.size - 6} more` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--homa-soft-boundary)] px-7 py-4 text-sm text-[var(--homa-muted-ink)] sm:px-10">
            <span>made with Homa for {report.childName}</span>
            <Link
              href={`/onboarding/r/${token}`}
              className="text-[var(--homa-brand-text)] underline-offset-2 hover:underline print:hidden"
            >
              see the full report
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
