import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAppData } from "../../../../lib/app-data";
import { familyWallCheckout } from "../../../../lib/billing/wall";
import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import { progressRoutePolicy } from "../../../../lib/child-progress/route-policy";
import { narrativeEnabled } from "../../../../lib/map/narrative-flag";
import { getStateRequirements } from "../../../../lib/map/state-requirements";
import { getReportByToken } from "../../../../lib/map/store";
import { NarrativeBeat } from "../../../onboarding/r/[token]/narrative-beat";
import { ReportView } from "../../../onboarding/r/[token]/report-view";

/**
 * Legacy signed-in report route. Flag-on requests move to live Progress
 * before report data loads. Token report routes remain independent.
 */

export const metadata: Metadata = {
  title: "Progress report",
  robots: { index: false },
};

export default async function AppReportPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const policy = progressRoutePolicy(
    { surface: "child_report", childId },
    liveProgressEnabled(),
  );
  if (policy.kind === "redirect") {
    redirect(policy.href);
  }

  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const child = data.children.find((entry) => entry.id === childId);
  if (!child) notFound();

  const token = data.reports.get(childId)?.token;
  if (!token) redirect("/onboarding");
  const report = await getReportByToken(token);
  if (!report) redirect("/onboarding");

  const flagOn = narrativeEnabled();
  const meta = report.narrativeMeta;
  const ready = meta?.status === "ready" && report.narrative !== null;

  // Same honest writing beat as the token page: fresh from scoring, the
  // model may still be writing this report's words.
  if (flagOn && !ready && meta?.status !== "failed") {
    return (
      <div className="mx-auto w-full max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold leading-tight text-strong">
          Homa is writing {report.childName}&apos;s report
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
              `Looking across all ${report.scores.totalSubjects} subjects`,
              `Writing ${report.childName}'s report`,
            ]}
          />
        </div>
      </div>
    );
  }

  const stateRequirements = report.usState
    ? await getStateRequirements(report.usState).catch(() => null)
    : null;

  const narrativeView =
    flagOn && ready && report.narrative
      ? { narrative: report.narrative, rejectedPieces: meta?.rejectedPieces ?? [] }
      : null;

  // The wall (plans/2026-07-11-the-wall.md): null while the flag is off
  // (the instant no-query path), and for exempt or trialing families.
  const wall = await familyWallCheckout(data.family.id);

  return (
    <ReportView
      data={report}
      context="app"
      narrativeView={narrativeView}
      stateRequirements={stateRequirements}
      wall={wall}
    />
  );
}
