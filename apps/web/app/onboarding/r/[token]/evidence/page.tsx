import type { Metadata } from "next";

import {
  ageInMonths,
  ageLabel,
  subjectLine,
  getMapSubject,
  MAP_SOURCES,
  type MapAnswer,
} from "@homa/core";

import { Logo } from "../../../../../components/brand/Logo";
import { QuietAction } from "../../../../../components/design/QuietAction";
import { QuietFrame } from "../../../../../components/design/QuietFrame";
import { getReportByToken } from "../../../../../lib/map/store";
import { movementBetween } from "../growth-story";

/**
 * The evidence pack: the same deterministic facts as the report,
 * re-rendered for a third-party reader (an evaluator, a registrar, a
 * skeptical relative who wants receipts). Composite framing first
 * (state thresholds read composites, and NY explicitly ignores
 * subscores), dated growth lines, then every question, answer,
 * benchmark, standards code, and citation. Print-first, deterministic,
 * zero model calls, and explicitly NOT a compliance instrument: the
 * boundary is printed on the document itself.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Growth evidence pack",
  robots: { index: false },
};

const ANSWER_LABELS: Record<MapAnswer, string> = {
  easily: "Easily",
  getting_there: "Getting there",
  not_yet: "Not yet",
  not_sure: "Not sure",
  skip: "Skipped",
};

export default async function EvidencePackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getReportByToken(token);

  if (!report) {
    return (
      <main
        data-brand-surface="report-evidence"
        className="quiet-print-surface mx-auto w-full max-w-xl px-6 py-20"
      >
        <Logo size={26} />
        <h1 className="quiet-artifact__title mt-8">This link isn&apos;t active.</h1>
      </main>
    );
  }

  const months = ageInMonths(report.birthMonth);
  const scores = report.scores;
  const generatedDate = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const positions = {
    ahead: scores.subjects.filter((s) => s.position === "ahead" && !s.exposureBased).length,
    onTrack: scores.subjects.filter((s) => s.position === "on_track" && !s.exposureBased).length,
    growing: scores.subjects.filter((s) => s.position === "growing" && !s.exposureBased).length,
  };

  // Dated growth lines across the whole archive, oldest pair first.
  const eras = [
    ...[...report.history].reverse().map((entry) => ({ at: entry.generated_at, scores: entry.scores })),
    { at: report.generatedAt, scores },
  ];
  const growthLines: string[] = [];
  for (let index = 1; index < eras.length; index += 1) {
    const moved = movementBetween(eras[index - 1].scores, eras[index].scores);
    if (moved.length === 0) continue;
    const from = new Date(eras[index - 1].at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const to = new Date(eras[index].at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    growthLines.push(`${from} to ${to}: ${moved.join(", ")}`);
  }

  const answersByDomain = new Map<string, { statement: string; typicalMonths: number; answer: MapAnswer; standards: readonly string[]; sources: readonly string[] }[]>();
  for (const entry of report.answers) {
    const found = getMapSubject(entry.itemId.split(".")[0]);
    const item = found?.items.find((candidate) => candidate.id === entry.itemId);
    if (!found || !item) continue;
    const list = answersByDomain.get(found.id) ?? [];
    list.push({
      statement: item.statement,
      typicalMonths: item.typicalMonths,
      answer: entry.answer,
      standards: item.standards ?? [],
      sources: item.sources,
    });
    answersByDomain.set(found.id, list);
  }

  const allSourceKeys = new Set<string>();
  for (const rows of answersByDomain.values()) {
    for (const row of rows) row.sources.forEach((key) => allSourceKeys.add(key));
  }

  return (
    <div
      data-brand-surface="report-evidence"
      className="quiet-report quiet-print-surface min-h-screen bg-[var(--homa-canvas)] pb-16 print:bg-[var(--homa-paper)]"
    >
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        <QuietFrame
          as="div"
          tone="paper"
          className="overflow-hidden rounded-[var(--homa-radius-card)] border-[var(--homa-control-boundary)] shadow-lg print:border-0 print:shadow-none"
        >
          <div className="quiet-report__hero px-7 pb-6 pt-8 sm:px-10" style={{ background: "var(--homa-canvas)" }}>
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="quiet-artifact__meta">
                growth evidence pack {"\u00b7"} {generatedDate}
              </span>
            </div>
            <h1 className="quiet-artifact__title mt-4">
              {report.childName}, {ageLabel(months)}
            </h1>
            <p className="quiet-artifact__lede mt-1">
              Prepared from a parent&apos;s structured observations, each checked against published
              national benchmarks (bank {report.bankVersion}). Not a test; every claim below cites
              its source.
            </p>
          </div>

          <div className="px-7 py-7 sm:px-10">
            <h2 className="quiet-artifact__section-title">Composite picture</h2>
            <ul className="quiet-artifact__body-copy mt-2 flex flex-col gap-1">
              <li>
                <strong>{scores.mappedCount} of {scores.totalSubjects}</strong> subjects mapped, from{" "}
                <strong>{scores.observationCount}</strong> parent observations.
              </li>
              <li>
                Against age-typical anchors: <strong>{positions.ahead}</strong> past typical,{" "}
                <strong>{positions.onTrack}</strong> at typical, <strong>{positions.growing}</strong> approaching
                typical (in progress).
              </li>
            </ul>

            {growthLines.length > 0 ? (
              <>
                <h2 className="quiet-artifact__section-title mt-7">Documented growth between check-ins</h2>
                <ul className="quiet-artifact__body-copy mt-2 flex flex-col gap-1">
                  {growthLines.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </>
            ) : null}

            <h2 className="quiet-artifact__section-title mt-7">Subject-by-subject record</h2>
            <div className="mt-3 flex flex-col gap-4">
              {scores.strengthOrder.map((subjectId) => {
                const score = scores.subjects.find((entry) => entry.subjectId === subjectId);
                const domain = getMapSubject(subjectId);
                if (!score || !domain) return null;
                const line = subjectLine(score, report.childName);
                const rows = answersByDomain.get(subjectId) ?? [];
                return (
                  <div key={subjectId} className="quiet-artifact__record">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="quiet-artifact__record-title">{domain.displayName}</h3>
                      <span className="quiet-artifact__record-badge">{line.badge}</span>
                      {line.numberLabel ? <span className="quiet-artifact__record-badge">{line.numberLabel}</span> : null}
                    </div>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {rows
                        .sort((a, b) => a.typicalMonths - b.typicalMonths)
                        .map((row) => (
                          <li key={row.statement} className="quiet-artifact__record-line">
                            <span className="font-semibold">{row.statement}?</span>{" "}
                            <strong className="quiet-artifact__answer">{ANSWER_LABELS[row.answer]}</strong>
                            <span className="quiet-artifact__fine">
                              {" "}{"\u00b7"} typical by {ageLabel(row.typicalMonths)}
                              {row.standards.length > 0 ? ` \u00b7 ${row.standards.join(", ")}` : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <h2 className="quiet-artifact__section-title mt-7">Benchmark sources</h2>
            <ul className="quiet-artifact__body-copy mt-2 flex flex-col gap-1">
              {Array.from(allSourceKeys).map((key) => {
                const source = MAP_SOURCES[key];
                if (!source) return null;
                return <li key={key}>{source.label}</li>;
              })}
            </ul>

            <div className="quiet-artifact__notice mt-7">
              <p>
                <strong>What this document is, and is not.</strong> This record was built from a
                parent&apos;s own observations, organized and checked against the published national
                benchmarks listed above. It is not a standardized test, not a medical or
                developmental evaluation, and it does not satisfy any state requirement of any
                kind. Numbers describe distance from age-typical anchors; every child grows in
                their own order.
              </p>
              <p className="mt-2">
                Method, in full:{" "}
                <a className="quiet-artifact__link" href="/onboarding/method">
                  thankshoma.com/onboarding/method
                </a>
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
              back to the report
            </QuietAction>
          </footer>
        </QuietFrame>
      </main>
    </div>
  );
}
