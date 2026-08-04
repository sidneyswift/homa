import type { Metadata } from "next";

import { ageInMonths, ageLabel, getMapSubject, MAP_SOURCES } from "@homa/core";

import { Logo } from "../../../../../components/brand/Logo";
import { QuietAction } from "../../../../../components/design/QuietAction";
import { QuietFrame } from "../../../../../components/design/QuietFrame";
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
      <main className="quiet-print-surface mx-auto w-full max-w-xl px-6 py-20">
        <Logo size={26} />
        <h1 className="quiet-artifact__title mt-8">This link isn&apos;t active.</h1>
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
    <div
      data-brand-surface="report-one-pager"
      className="quiet-report quiet-print-surface min-h-screen bg-[var(--homa-canvas)] pb-16 print:bg-[var(--homa-paper)]"
    >
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        <QuietFrame
          as="div"
          tone="paper"
          className="overflow-hidden rounded-[var(--homa-radius-card)] border-[var(--homa-control-boundary)] shadow-lg print:border-0 print:shadow-none"
        >
          <div
            className="quiet-report__hero px-7 pb-6 pt-8 sm:px-10"
            style={{ background: "var(--homa-info-tint)" }}
          >
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="quiet-artifact__meta">
                progress summary {"\u00b7"} {generatedDate}
              </span>
            </div>
            <h1 className="quiet-artifact__title mt-4">
              {report.childName}, {ageLabel(months)}: one honest page
            </h1>
            <div className="quiet-artifact__metrics mt-3">
              <span>
                subjects mapped <strong className="quiet-artifact__metric-value">{scores.mappedCount} of {scores.totalSubjects}</strong>
              </span>
              <span>
                observations <strong className="quiet-artifact__metric-value">{scores.observationCount}</strong>
              </span>
              <span>
                benchmarks <strong className="quiet-artifact__metric-value">national, cited</strong>
              </span>
            </div>
          </div>

          <div className="px-7 py-7 sm:px-10">
            {strengths.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {strengths.map((score) => {
                  const domain = getMapSubject(score.subjectId);
                  return (
                    <div key={score.subjectId} className="quiet-artifact__strength-card">
                      <p className="quiet-artifact__strength-name">{domain?.displayName}</p>
                      <p className="quiet-artifact__strength-value">
                        +{score.monthsAhead}
                        <span className="quiet-artifact__strength-unit"> mo past typical</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <h2 className="quiet-artifact__section-title mt-7">Every subject, one chart</h2>
            <p className="quiet-artifact__body-copy mt-1">
              One dot per subject against what&apos;s typical for {ageLabel(months)}. The warm
              highlight marks past typical, constructive marks at typical, and info marks growth
              toward typical.
            </p>
            <div className="quiet-artifact__chart-frame mt-3">
              <ReportChart scores={ordered} prior={null} variant="wide" />
            </div>

            <div className="quiet-artifact__notice mt-7">
              <p>
                Built from a parent&apos;s structured observations, each checked against published
                national benchmarks: the same sources schools and pediatricians use. Not a test
                and not medical advice, and every child grows in their own order. Full receipts
                (every question, answer, and citation) live on the full report.
              </p>
              <p className="quiet-artifact__fine mt-2">
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

          <footer className="quiet-artifact__footer">
            <span>made with Homa for {report.childName}</span>
            <QuietAction
              kind="quiet"
              href={`/onboarding/r/${token}`}
              className="quiet-artifact__link quiet-print-hidden"
            >
              see the full report
            </QuietAction>
          </footer>
        </QuietFrame>
      </main>
    </div>
  );
}
