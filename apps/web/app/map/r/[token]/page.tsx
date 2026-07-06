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
  tryHeading,
  type DomainScore,
  type MapAnswer,
} from "@homa/core";

import { Logo } from "../../../../components/brand/Logo";
import { getReportByToken } from "../../../../lib/map/store";
import { ReportActions } from "./report-actions";
import { ReportChart } from "./report-chart";
import { WhatsWorkingForm } from "./whats-working-form";

/**
 * The progress report. Strengths first, always; growing subjects arrive
 * with a named next step and an activity; every subject card expands to
 * show exactly what was asked, what she answered, and which national
 * benchmark it was checked against (read-through ruling: "where did you
 * get that benchmark?" must be answerable in two taps). No red, no
 * "behind", ever (BUILD.md law #4). Printable via the browser.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your child's progress report",
  robots: { index: false },
};

const ANSWER_LABELS: Record<MapAnswer, string> = {
  easily: "Easily",
  getting_there: "Getting there",
  not_yet: "Not yet",
  not_sure: "Not sure",
  skip: "Skipped",
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
          Want your own child&apos;s progress report? It takes about five minutes.
        </p>
        <Link
          href="/map"
          className="mt-6 inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
        >
          See where your child stands
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
  const trySection = tryHeading(growing.length);

  const answersByDomain = new Map<string, { statement: string; typicalMonths: number; answer: MapAnswer }[]>();
  for (const entry of report.answers) {
    const found = getMapDomain(entry.itemId.split(".")[0]);
    const domainId = found?.id ?? entry.itemId.split(".")[0];
    const item = found?.items.find((candidate) => candidate.id === entry.itemId);
    if (!item) continue;
    const list = answersByDomain.get(domainId) ?? [];
    list.push({ statement: item.statement, typicalMonths: item.typicalMonths, answer: entry.answer });
    answersByDomain.set(domainId, list);
  }

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
                subjects mapped <b className="text-strong">{report.scores.mappedCount} of {report.scores.totalDomains}</b>
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
            {/* Note from Homa, spoken by the little home itself. */}
            <div className="flex gap-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5">
              <div className="flex-shrink-0 pt-0.5">
                <Logo variant="mark" size={34} />
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
                  Where {report.childName} is ahead of what&apos;s typical for {ageLabel(months)}.
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
                        <WhatsWorkingForm
                          childId={report.childId}
                          domainId={score.domainId}
                          subjectName={domain?.displayName ?? score.domainId}
                          childName={report.childName}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {/* The whole picture */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">The whole picture</h2>
            <p className="mt-1 text-sm text-muted">
              One dot per subject. The line marks typical for {ageLabel(months)}. Yellow is ahead,
              green is on track, blue is growing right now.
            </p>
            <div className="mt-4 rounded-lg border border-border-subtle bg-card p-4">
              <ReportChart scores={ordered} />
            </div>

            {/* Subject by subject */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">Subject by subject</h2>
            <p className="mt-1 text-sm text-muted">
              Tap a subject to see what I asked, what you answered, and the benchmarks behind it.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {ordered.map((score) => {
                const domain = getMapDomain(score.domainId);
                const line = domainLine(score, report.childName);
                const domainAnswers = answersByDomain.get(score.domainId) ?? [];
                const badgeStyle =
                  score.position === "ahead"
                    ? { background: "var(--gold-100)", color: "var(--gold-ink)" }
                    : score.position === "on_track"
                      ? { background: "var(--accent-sage-soft)", color: "var(--sage-700)" }
                      : score.position === "growing"
                        ? { background: "var(--info-soft)", color: "var(--sky-600)" }
                        : { background: "var(--surface-sunken)", color: "var(--text-muted)" };
                const domainSources = Array.from(
                  new Set(domain?.items.flatMap((item) => [...item.sources]) ?? []),
                );
                const activity = domain ? growingActivityFor(domain, months) : null;
                return (
                  <details key={score.domainId} className="group rounded-md border border-border-subtle">
                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                      <span
                        className="mt-0.5 flex-shrink-0 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-bold"
                        style={badgeStyle}
                      >
                        {line.badge}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-strong">{domain?.displayName}</span>
                        <span className="mt-0.5 block text-sm text-muted">{line.sentence}</span>
                        <span className="mt-1 block text-xs font-medium text-brand group-open:hidden">
                          see the questions and benchmarks {"\u2193"}
                        </span>
                      </span>
                      <span className="flex-shrink-0 pt-0.5 font-mono text-sm text-strong">
                        {line.numberLabel}
                      </span>
                    </summary>
                    <div className="border-t border-border-subtle px-4 pb-4 pt-3">
                      {domainAnswers.length > 0 ? (
                        <>
                          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                            What I asked, and your answers
                          </p>
                          <ul className="mt-2 flex flex-col gap-2">
                            {domainAnswers
                              .sort((a, b) => a.typicalMonths - b.typicalMonths)
                              .map((entry) => (
                                <li key={entry.statement} className="flex items-start justify-between gap-3 text-sm">
                                  <span className="text-body">
                                    {entry.statement}?
                                    <span className="block text-xs text-subtle">
                                      typical by {ageLabel(entry.typicalMonths)}
                                    </span>
                                  </span>
                                  <span className="flex-shrink-0 rounded-pill bg-[var(--surface-sunken)] px-3 py-1 text-xs font-semibold text-strong">
                                    {ANSWER_LABELS[entry.answer]}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-sm text-muted">
                          No answers here yet. A few would fill this subject in.
                        </p>
                      )}

                      {score.position === "growing" && activity ? (
                        <div className="mt-4 rounded-md p-3" style={{ background: "var(--info-soft)" }}>
                          <p className="text-sm font-semibold text-strong">{activity.title}</p>
                          <p className="mt-0.5 text-sm text-body">{activity.description}</p>
                          <p className="mt-2 text-xs text-muted">
                            This is the kind of spot Homa builds a plan around: materials, a pace,
                            and a re-check so you can watch the number move.
                          </p>
                        </div>
                      ) : null}

                      <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                        Benchmarks checked against
                      </p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {domainSources.map((key) => {
                          const source = MAP_SOURCES[key];
                          if (!source) return null;
                          return (
                            <li key={key} className="text-xs">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand underline-offset-2 hover:underline"
                              >
                                {source.label}
                              </a>
                            </li>
                          );
                        })}
                      </ul>

                      {!score.exposureBased && score.position !== "not_mapped" ? (
                        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                          <Link
                            href={`/map/r/${report.token}/plan/${score.domainId}`}
                            className="inline-flex min-h-10 items-center rounded-pill bg-brand px-4 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover"
                          >
                            Build the 4-week plan
                          </Link>
                          <Link
                            href={`/map?dd=${report.childId}.${score.domainId}`}
                            className="inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-strong hover:border-brand"
                          >
                            Go deeper ({score.position === "growing" ? "find the exact starting line" : "see how far it goes"})
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>

            {/* Things to try */}
            {growing.length > 0 ? (
              <>
                <h2 className="mt-9 font-display text-xl font-semibold text-strong">{trySection.title}</h2>
                <p className="mt-1 text-sm text-muted">{trySection.sub}</p>
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
                How this report is made (and what it is not)
              </h3>
              <p className="mt-2 text-muted">
                Your answers describe what {report.childName} does day to day. Each one is checked
                against published national benchmarks for their age, the same sources schools and
                pediatricians use. Where you said &ldquo;not sure&rdquo;, the report says so
                instead of guessing.
              </p>
              <p className="mt-2 text-muted">
                This is built from a parent&apos;s observations. It is not a test and not medical
                advice. Every child grows in their own order, and a first report is an estimate
                that sharpens as you answer more.
              </p>
              <p className="mt-3 font-mono text-[0.65rem] leading-relaxed text-subtle">
                SOURCES {"\u00b7"} {Array.from(sourceKeys).map((key) => MAP_SOURCES[key]?.label).filter(Boolean).join(" \u00b7 ")} {"\u00b7"} bank {report.bankVersion} {"\u00b7"}{" "}
                <Link href="/map/method" className="text-brand underline">
                  how the report works, in full
                </Link>
              </p>
            </div>

            {/* CTA band */}
            <div className="mt-9 rounded-lg p-6 print:hidden" style={{ background: "var(--surface-inverse)" }}>
              <h3 className="font-display text-2xl font-bold" style={{ color: "#fff" }}>
                This report is the &ldquo;before&rdquo; picture.
              </h3>
              <p className="mt-2 max-w-lg" style={{ color: "var(--stone-300)" }}>
                Homa moves it: a plan for every blue subject, materials made for exactly
                what&apos;s growing, and this report re-drawn as {report.childName} grows, so you
                watch the numbers move.
              </p>
              <p
                className="mt-4 inline-flex items-center rounded-pill px-5 py-2.5 text-sm font-bold"
                style={{ background: "var(--accent-sage-soft)", color: "var(--sage-700)" }}
              >
                You&apos;re on the founding families list {"\u2713"}
              </p>
              <p className="mt-3 text-xs" style={{ color: "var(--stone-400)" }}>
                We invite families a few at a time. Your invite comes by email, with{" "}
                {report.childName}&apos;s report waiting inside.
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
