import type { Metadata } from "next";
import Link from "next/link";

import {
  ageInMonths,
  ageLabel,
  domainLine,
  getMapDomain,
  MAP_SOURCES,
  type MapAnswer,
} from "@homa/core";

import { Logo } from "../../../../../components/brand/Logo";
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
  const generatedDate = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const positions = {
    ahead: scores.domains.filter((s) => s.position === "ahead" && !s.exposureBased).length,
    onTrack: scores.domains.filter((s) => s.position === "on_track" && !s.exposureBased).length,
    growing: scores.domains.filter((s) => s.position === "growing" && !s.exposureBased).length,
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
    const found = getMapDomain(entry.itemId.split(".")[0]);
    const item = found?.items.find((candidate) => candidate.id === entry.itemId);
    if (!found || !item) continue;
    const list = answersByDomain.get(found.id) ?? [];
    const content = found.items.find((candidate) => candidate.id === entry.itemId);
    list.push({
      statement: item.statement,
      typicalMonths: item.typicalMonths,
      answer: entry.answer,
      standards: (content as { standards?: readonly string[] } | undefined)?.standards ?? [],
      sources: item.sources,
    });
    answersByDomain.set(found.id, list);
  }

  const allSourceKeys = new Set<string>();
  for (const rows of answersByDomain.values()) {
    for (const row of rows) row.sources.forEach((key) => allSourceKeys.add(key));
  }

  return (
    <div className="min-h-screen bg-page pb-16 print:bg-card">
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lg print:border-0 print:shadow-none">
          <div className="px-7 pb-6 pt-8 sm:px-10" style={{ background: "var(--surface-sunken)" }}>
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="font-mono text-xs uppercase tracking-widest text-strong/70">
                growth evidence pack {"\u00b7"} {generatedDate}
              </span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-strong">
              {report.childName}, {ageLabel(months)}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Prepared from a parent&apos;s structured observations, each checked against published
              national benchmarks (bank {report.bankVersion}). Not a test; every claim below cites
              its source.
            </p>
          </div>

          <div className="px-7 py-7 sm:px-10">
            <h2 className="font-display text-lg font-semibold text-strong">Composite picture</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-body">
              <li>
                <b>{scores.mappedCount} of {scores.totalDomains}</b> subjects mapped, from{" "}
                <b>{scores.observationCount}</b> parent observations.
              </li>
              <li>
                Against age-typical anchors: <b>{positions.ahead}</b> past typical,{" "}
                <b>{positions.onTrack}</b> at typical, <b>{positions.growing}</b> approaching
                typical (in progress).
              </li>
            </ul>

            {growthLines.length > 0 ? (
              <>
                <h2 className="mt-7 font-display text-lg font-semibold text-strong">
                  Documented growth between check-ins
                </h2>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-body">
                  {growthLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <h2 className="mt-7 font-display text-lg font-semibold text-strong">
              Subject-by-subject record
            </h2>
            <div className="mt-3 flex flex-col gap-4">
              {scores.strengthOrder.map((domainId) => {
                const score = scores.domains.find((entry) => entry.domainId === domainId);
                const domain = getMapDomain(domainId);
                if (!score || !domain) return null;
                const line = domainLine(score, report.childName);
                const rows = answersByDomain.get(domainId) ?? [];
                return (
                  <div key={domainId} className="rounded-md border border-border-subtle p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="font-semibold text-strong">{domain.displayName}</h3>
                      <span className="font-mono text-xs text-muted">{line.badge}</span>
                      {line.numberLabel ? (
                        <span className="font-mono text-xs text-muted">{line.numberLabel}</span>
                      ) : null}
                    </div>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {rows
                        .sort((a, b) => a.typicalMonths - b.typicalMonths)
                        .map((row) => (
                          <li key={row.statement} className="text-xs text-body">
                            <span className="text-strong">{row.statement}?</span>{" "}
                            <b>{ANSWER_LABELS[row.answer]}</b>
                            <span className="text-subtle">
                              {" "}
                              {"\u00b7"} typical by {ageLabel(row.typicalMonths)}
                              {row.standards.length > 0 ? ` \u00b7 ${row.standards.join(", ")}` : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <h2 className="mt-7 font-display text-lg font-semibold text-strong">Benchmark sources</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {Array.from(allSourceKeys).map((key) => {
                const source = MAP_SOURCES[key];
                if (!source) return null;
                return (
                  <li key={key} className="text-xs text-muted">
                    {source.label}
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 rounded-md bg-[var(--surface-sunken)] p-4 text-xs text-muted">
              <p>
                <b className="text-strong">What this document is, and is not.</b> This record was
                built from a parent&apos;s own observations, organized and checked against the
                published national benchmarks listed above. It is not a standardized test, not a
                medical or developmental evaluation, and it does not satisfy any state
                requirement of any kind. Numbers describe distance from age-typical anchors;
                every child grows in their own order.
              </p>
              <p className="mt-2">
                Method, in full:{" "}
                <Link href="/onboarding/method" className="text-brand underline">
                  thankshoma.com/onboarding/method
                </Link>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            <span>made with Homa for {report.childName}</span>
            <Link
              href={`/onboarding/r/${token}`}
              className="text-brand underline-offset-2 hover:underline print:hidden"
            >
              back to the report
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
