import type { Metadata } from "next";
import Link from "next/link";

import { freeReportSubjects } from "@homa/core";

import { Logo } from "../../../../components/brand/Logo";
import { Doodle } from "../../../../components/marketing/Doodle";
import { familyWallCheckout, reportLockEnabled, wallEnabled } from "../../../../lib/billing/wall";
import { narrativeEnabled } from "../../../../lib/map/narrative-flag";
import { requireFamilyWithActor } from "../../../../lib/map/session";
import { getStateRequirements } from "../../../../lib/map/state-requirements";
import { getReportByToken } from "../../../../lib/map/store";
import { NarrativeBeat } from "./narrative-beat";
import { reportButtonClass } from "./report-button";
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
          className={reportButtonClass(
            "primary",
            "mt-6 inline-flex min-h-12 items-center px-6 py-3 text-base font-semibold",
          )}
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
                `Reading your ${report.scores.observationCount} answers`,
                `Looking across all ${report.scores.totalSubjects} subjects`,
                `Writing ${report.childName}'s report`,
              ]}
            />
          </div>
        </main>
      </div>
    );
  }

  // Render-time join against the compliance reference table: the report
  // row never stores a legal claim, so none can go stale on it.
  const stateRequirements = report.usState
    ? await getStateRequirements(report.usState).catch(() => null)
    : null;

  const narrativeView =
    flagOn && ready && report.narrative
      ? { narrative: report.narrative, rejectedPieces: meta?.rejectedPieces ?? [] }
      : null;

  // Session-aware action gating (founder ruling 2026-07-14, report-page
  // dead ends, option b): the letter's call offer and the month BUILD
  // button render only for a viewer whose session can complete the tap.
  // A text-born family opening its texted link has no session (no
  // Supabase account, no resume cookie), and the shareable token must
  // never become a credential for ringing the family's phone, so the
  // buttons are suppressed instead of dead-ending in a device hint.
  // The call needs a signed-in member of THIS family (the voice route
  // is Supabase-session-only); the month build accepts the resume
  // cookie too (matching /api/map/plan/consent). An already-built
  // month stays a plain tokenized link for every viewer.
  let viewerIsReportFamily = false;
  let viewerIsSignedInMember = false;
  try {
    const actor = await requireFamilyWithActor();
    if (actor && actor.family.id === report.familyId) {
      viewerIsReportFamily = true;
      viewerIsSignedInMember = actor.memberUserId !== null;
    }
  } catch {
    // Auth lookup unavailable: render the report, keep actions hidden.
  }

  // The wall (plans/2026-07-11-the-wall.md): null while the flag is off
  // (the instant no-query path), and for exempt or trialing families.
  // With the report lock on, the family's wall state is computed for
  // EVERY viewer (the held rows must hold on the shareable URL too, or
  // the emailed link becomes the bypass), but checkout URLs render
  // owner-only: a signed-in visitor from another family must never see
  // this family's checkout (her payment would carry the wrong
  // client_reference_id and unlock nothing). familyId comes from the
  // report row, server-resolved, never the request.
  const checkout =
    wallEnabled() && (viewerIsReportFamily || reportLockEnabled())
      ? await familyWallCheckout(report.familyId)
      : null;
  const wall = viewerIsReportFamily ? checkout : null;
  const reportLock =
    checkout && reportLockEnabled()
      ? {
          freeSubjects: freeReportSubjects(report.scores),
          checkout: viewerIsReportFamily ? checkout : null,
        }
      : null;

  return (
    <ReportView
      data={report}
      narrativeView={narrativeView}
      stateRequirements={stateRequirements}
      wall={wall}
      reportLock={reportLock}
      viewerActions={{
        call: viewerIsSignedInMember,
        month: viewerIsReportFamily,
      }}
    />
  );
}
