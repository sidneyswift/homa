import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../../../components/brand/Logo";
import { Doodle } from "../../../../components/marketing/Doodle";
import { narrativeEnabled } from "../../../../lib/map/narrative-flag";
import { getStateRequirements } from "../../../../lib/map/state-requirements";
import { getReportByToken, hasFamilyContext } from "../../../../lib/map/store";
import { NarrativeBeat } from "./narrative-beat";
import { ReportView } from "./report-view";

/**
 * The live progress report at its permanent tokenized URL. Rendering lives
 * in ReportView (shared with the public sample at /onboarding/sample).
 * With the narrative flag on, the page holds an honest writing beat while
 * the model writes this report's words (uncapped by ruling), then renders
 * them in place of the template sentences; a failed generation renders the
 * templates exactly as before.
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
          Want your own child&apos;s progress report? It takes about five minutes.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
        >
          See where your child stands
        </Link>
      </main>
    );
  }

  const flagOn = narrativeEnabled();
  const meta = report.narrativeMeta;
  const ready = meta?.status === "ready" && report.narrative !== null;

  // Writing (or not yet attempted): the beat holds the page until the
  // words exist. "failed" falls through to the template render below.
  if (flagOn && !ready && meta?.status !== "failed") {
    return (
      <div className="min-h-screen bg-page">
        <main className="mx-auto w-full max-w-xl px-6 py-16">
          <Logo size={26} />
          <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-strong">
            Homa is writing {report.childName}&apos;s{" "}
            <span className="whitespace-nowrap">
              report
              {/* One twinkling accent, same playful device as the landing
                  hero, to lift the moment the report starts coming to life. */}
              <span className="nb-twinkle ml-1.5 inline-block align-baseline">
                <Doodle name="sparkle" size={24} color="var(--gold-400)" />
              </span>
            </span>
          </h1>
          <p className="mt-2 text-body">
            The numbers are done. Now every sentence gets written for {report.childName}{" "}
            specifically.
          </p>
          <div className="mt-6">
            <NarrativeBeat
              token={token}
              lines={[
                `Reading your ${report.scores.observationCount} observations`,
                `Looking across all ${report.scores.totalDomains} subjects`,
                `Writing ${report.childName}'s report`,
              ]}
            />
          </div>
        </main>
      </div>
    );
  }

  // The relocated "About your homeschool" card shows until the family
  // context bag has anything in it (same one-shot rule the old extras
  // step used).
  const familyContextDone = await hasFamilyContext(report.leadId);

  // Render-time join against the compliance reference table: the report
  // row never stores a legal claim, so none can go stale on it.
  const stateRequirements = report.usState
    ? await getStateRequirements(report.usState).catch(() => null)
    : null;

  const narrativeView =
    flagOn && ready && report.narrative
      ? { narrative: report.narrative, rejectedPieces: meta?.rejectedPieces ?? [] }
      : null;

  return (
    <ReportView
      data={report}
      askHomeschool={!familyContextDone}
      narrativeView={narrativeView}
      stateRequirements={stateRequirements}
    />
  );
}
