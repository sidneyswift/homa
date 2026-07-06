import type { Metadata } from "next";
import Link from "next/link";

import {
  ageInMonths,
  ageLabel,
  domainLine,
  getMapDomain,
  growingActivityFor,
  homaNote,
  MAP_SOURCES,
  reportSubtitle,
  type DomainScore,
} from "@homa/core";

import { Logo } from "../../../../components/brand/Logo";
import { getReportByToken } from "../../../../lib/map/store";
import { ReportActions } from "./report-actions";
import { ReportChart } from "./report-chart";

/**
 * The child's map (report page). Strengths first, always; growth areas
 * arrive with an activity attached; every domain cites its framework; no
 * red, no "behind", ever (BUILD.md law #4). Printable via the browser.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your child's progress report",
  robots: { index: false },
};

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await getReportByToken(token);

  if (!report) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-20">
        <Logo size={26} />
        <h1 className="mt-8 font-display text-2xl font-bold text-strong">
          This report link isn&apos;t active.
        </h1>
        <p className="mt-3 text-body">
          Want your own child&apos;s progress report? It takes about five minutes, from what you&apos;ve
          already seen them do.
        </p>
        <Link
          href="/map"
          className="mt-6 inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
        >
          Get your free progress report
        </Link>
      </main>
    );
  }

  const months = ageInMonths(report.birthMonth);
  const scores = report.scores.domains;
  const byId = new Map(scores.map((score) => [score.domainId, score]));
  const ordered: DomainScore[] = [
    ...report.scores.strengthOrder.map((id) => byId.get(id)).filter((s): s is DomainScore => Boolean(s)),
    ...scores.filter((score) => score.position === "not_mapped"),
  ];
  const strengths = ordered
    .filter((score) => score.position === "ahead" && !score.exposureBased)
    .slice(0, 3);
  const growing = scores.filter((score) => score.position === "growing" && !score.exposureBased);
  const sourceKeys = new Set<string>();
  for (const score of scores) {
    if (score.position === "not_mapped") continue;
    const domain = getMapDomain(score.domainId);
    domain?.items.forEach((item) => item.sources.forEach((key) => sourceKeys.add(key)));
  }
  const generatedDate = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-page pb-16">
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lg print:border-0 print:shadow-none">
          {/* Header band */}
          <div style={{ background: "var(--band-sky)" }} className="px-7 pb-7 pt-8 sm:px-10">
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="font-mono text-xs uppercase tracking-widest text-strong/70">
                made for {report.childName} {"\u00b7"} {generatedDate}
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold leading-none tracking-tight text-strong sm:text-5xl">
              {report.childName}&apos;s <span style={{ color: "var(--clay-600)" }}>progress report</span>
            </h1>
            <p className="mt-2 font-serif text-lg italic text-strong/75">{reportSubtitle(months)}</p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-strong/70">
              <span>
                age <b className="text-strong">{ageLabel(months)}</b>
              </span>
              <span>
                domains mapped <b className="text-strong">{report.scores.mappedCount} of {report.scores.totalDomains}</b>
              </span>
              <span>
                your observations <b className="text-strong">{report.scores.observationCount}</b>
              </span>
              <span>
                benchmarks <b className="text-strong">national</b>
              </span>
            </div>
          </div>

          <div className="px-7 py-7 sm:px-10">
            {/* Note from Homa */}
            <div className="flex gap-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "var(--sage-500)", fontFamily: "var(--font-wordmark)" }}
              >
                h
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-widest text-sage">
                  A note from Homa
                </p>
                <p className="mt-1 text-body">
                  {homaNote(report.scores, report.childName, report.parentFirstName ?? undefined)}
                </p>
              </div>
            </div>

            {/* Strengths first */}
            {strengths.length > 0 ? (
              <>
                <h2 className="mt-9 font-display text-xl font-semibold text-strong">
                  {report.childName}&apos;s strengths, first
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Where {report.childName} is working ahead of what&apos;s typical for {ageLabel(months)}.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {strengths.map((score) => {
                    const domain = getMapDomain(score.domainId);
                    const line = domainLine(score, report.childName);
                    return (
                      <div key={score.domainId} className="rounded-lg p-4" style={{ background: "var(--gold-100)" }}>
                        <p className="font-semibold" style={{ color: "var(--gold-ink-strong)" }}>
                          {domain?.displayName} <span aria-hidden="true">{"\u2605"}</span>
                        </p>
                        <p className="mt-1 font-mono text-2xl" style={{ color: "var(--gold-ink)" }}>
                          +{score.monthsAhead}
                          <span className="text-sm"> mo ahead</span>
                        </p>
                        {score.strongestObservedStatement ? (
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--gold-ink)" }}>
                            You&apos;ve seen it: {score.strongestObservedStatement.charAt(0).toLowerCase()}{score.strongestObservedStatement.slice(1)}.
                          </p>
                        ) : (
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--gold-ink)" }}>
                            {line.sentence}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {/* The whole map */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">The whole map</h2>
            <p className="mt-1 text-sm text-muted">
              One dot per domain. The line is &ldquo;typical for {ageLabel(months)}&rdquo;. Gold is
              ahead, sage is right in the band, sky is growing right now, with something to try
              below.
            </p>
            <div className="mt-4 rounded-lg border border-border-subtle bg-card p-4">
              <ReportChart scores={ordered} />
            </div>

            {/* Domain by domain */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">Domain by domain</h2>
            <p className="mt-1 text-sm text-muted">
              Every line is grounded in your answers and the national benchmark it was checked
              against.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {ordered.map((score) => {
                const domain = getMapDomain(score.domainId);
                const line = domainLine(score, report.childName);
                const badgeStyle =
                  score.position === "ahead"
                    ? { background: "var(--gold-100)", color: "var(--gold-ink)" }
                    : score.position === "on_track"
                      ? { background: "var(--accent-sage-soft)", color: "var(--sage-700)" }
                      : score.position === "growing"
                        ? { background: "var(--info-soft)", color: "var(--sky-600)" }
                        : { background: "var(--surface-sunken)", color: "var(--text-muted)" };
                const sourceLabels = Array.from(
                  new Set(domain?.items.flatMap((item) => [...item.sources]) ?? []),
                )
                  .slice(0, 3)
                  .map((key) => MAP_SOURCES[key]?.label.split(",")[0] ?? key)
                  .join(" \u00b7 ");
                return (
                  <div key={score.domainId} className="flex items-start gap-3 rounded-md border border-border-subtle p-4">
                    <span
                      className="mt-0.5 flex-shrink-0 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-bold"
                      style={badgeStyle}
                    >
                      {line.badge}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-strong">{domain?.displayName}</p>
                      <p className="mt-0.5 text-sm text-muted">{line.sentence}</p>
                      <p className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-subtle">
                        benchmark: {sourceLabels}
                      </p>
                    </div>
                    <span className="flex-shrink-0 pt-0.5 font-mono text-sm text-strong">
                      {line.numberLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Things to try */}
            {growing.length > 0 ? (
              <>
                <h2 className="mt-9 font-display text-xl font-semibold text-strong">
                  {growing.length === 1 ? "One thing" : "A couple of things"} worth trying this week
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Free, five minutes, aimed at exactly what&apos;s growing. Offers, never homework.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {growing.slice(0, 2).map((score) => {
                    const domain = getMapDomain(score.domainId);
                    if (!domain) return null;
                    const activity = growingActivityFor(domain, months);
                    return (
                      <div key={score.domainId} className="rounded-lg p-4" style={{ background: "var(--info-soft)" }}>
                        <p className="font-mono text-[0.65rem] uppercase tracking-widest" style={{ color: "var(--sky-600)" }}>
                          {domain.displayName}
                        </p>
                        <p className="mt-1 font-semibold text-strong">{activity.title}</p>
                        <p className="mt-1 text-sm text-body">{activity.description}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {/* Methodology */}
            <div className="mt-9 rounded-lg bg-[var(--surface-sunken)] p-5 text-sm">
              <h3 className="font-display text-base font-semibold text-strong">
                How this map is made (and what it is not)
              </h3>
              <p className="mt-2 text-muted">
                Your answers describe what {report.childName} does day to day. Each one is checked
                against published national benchmarks for their age, the same sources schools and
                pediatric milestones draw from. Where you said &ldquo;not sure&rdquo;, the report says
                so instead of guessing.
              </p>
              <p className="mt-2 text-muted">
                This is a progress report built from a parent&apos;s observations, not a test and not medical
                advice. Every child grows in their own order, and a first report is an estimate: it
                sharpens with more observations over time.
              </p>
              <p className="mt-3 font-mono text-[0.65rem] leading-relaxed text-subtle">
                SOURCES {"\u00b7"} {Array.from(sourceKeys).map((key) => MAP_SOURCES[key]?.label).filter(Boolean).join(" \u00b7 ")} {"\u00b7"} bank {report.bankVersion} {"\u00b7"}{" "}
                <Link href="/map/method" className="text-brand underline">
                  how the map works, in full
                </Link>
              </p>
            </div>

            {/* CTA band */}
            <div className="mt-9 rounded-lg p-6 print:hidden" style={{ background: "var(--surface-inverse)" }}>
              <h3 className="font-display text-2xl font-bold" style={{ color: "#fff" }}>
                This report is the &ldquo;before&rdquo; picture.
              </h3>
              <p className="mt-2 max-w-lg" style={{ color: "var(--stone-300)" }}>
                Homa is the assistant that moves it: materials made for exactly what&apos;s growing,
                hours tracked for your state, and this report redrawn as {report.childName} grows,
                so you can watch the numbers move.
              </p>
              <p
                className="mt-4 inline-flex items-center rounded-pill px-5 py-2.5 text-sm font-bold"
                style={{ background: "var(--accent-sage-soft)", color: "var(--sage-700)" }}
              >
                You&apos;re on the founding families list {"\u2713"}
              </p>
              <p className="mt-3 text-xs" style={{ color: "var(--stone-400)" }}>
                We invite families a few at a time. Your invite comes by email, and{" "}
                {report.childName}&apos;s report will be waiting inside.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            <span>made with Homa for {report.childName}</span>
            <ReportActions
              leadId={report.leadId}
              childId={report.childId}
              childName={report.childName}
              token={report.token}
            />
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-subtle print:hidden">
          <Link href="/map" className="text-brand underline-offset-2 hover:underline">
            back to your family
          </Link>
        </p>
      </main>
    </div>
  );
}
