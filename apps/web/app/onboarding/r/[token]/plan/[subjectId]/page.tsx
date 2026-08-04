import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { Logo } from "../../../../../../components/brand/Logo";
import { WallOffer } from "../../../../../../components/billing/wall-offer";
import { QuietAction } from "../../../../../../components/design/QuietAction";
import { QuietFeedback } from "../../../../../../components/design/QuietFeedback";
import { QuietFrame } from "../../../../../../components/design/QuietFrame";
import {
  WALL_SIGNIN_BODY,
  WALL_SIGNIN_BUTTON,
  WALL_SIGNIN_HEADLINE,
} from "../../../../../../components/billing/wall-copy";
import { familyWallCheckout, wallEnabled } from "../../../../../../lib/billing/wall";
import { emitMapEvent } from "../../../../../../lib/map/events";
import { narrativeEnabled } from "../../../../../../lib/map/narrative-flag";
import { runPlanNarrative } from "../../../../../../lib/map/narrative-runner";
import { requireFamily } from "../../../../../../lib/map/session";
import {
  getOrBuildPlan,
  getPlanRebuildReceipt,
  getReportEventIdsByToken,
  planExists,
} from "../../../../../../lib/map/store";
import { NarrativeBeat } from "../../narrative-beat";
import { PlanWeeks } from "./plan-weeks";

/**
 * The four-week plan for one subject, built deterministically from the
 * child's answers + extras context on first view, retest armed for four
 * weeks out (the read-through's loop: implement, retest, watch the number
 * move). Tokenized like the report itself: printable, shareable, no login.
 * With the narrative flag on, the model writes the page's prose (intro,
 * week framing, closing) around the deterministic plan, behind its own
 * writing beat; the deterministic plan stays stored unchanged as the fact
 * record either way.
 *
 * The wall (plans/2026-07-11-the-wall.md, DARK behind
 * HOMA_WALL_ENABLED): building a NEW plan is a door, so a walled family
 * gets the offer page here instead of a fresh build. A plan that
 * already exists renders normally forever: the wall gates action, never
 * what a family already has.
 */

export const dynamic = "force-dynamic";

// The page can kick a background narrative generation (uncapped model
// call by ruling); give the function room to finish it.
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Four-week plan",
  robots: { index: false },
};

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; subjectId: string }>;
  searchParams: Promise<{ rebuilt?: string; built?: string; receipt?: string }>;
}) {
  const { token, subjectId } = await params;
  const { rebuilt, built, receipt } = await searchParams;
  const domain = getMapSubject(subjectId);
  const isMonth = subjectId === MONTH_PLAN_SUBJECT;

  // The wall stands only in front of plans that do not exist yet. Flag
  // off short-circuits before any of these queries run. On this
  // shareable URL the checkout renders ONLY when the viewer's own
  // session matches the report's family: a shared-link viewer's payment
  // could never be attributed (the confirm route unlocks the payer's
  // signed-in family), so anyone else gets sign-in instead of a
  // checkout that would charge a card and unlock nothing.
  if ((domain || isMonth) && wallEnabled()) {
    const ids = await getReportEventIdsByToken(token);
    if (ids) {
      const checkout = await familyWallCheckout(ids.familyId);
      if (checkout && !(await planExists(ids.childId, subjectId))) {
        const viewer = await requireFamily();
        const isOwner = viewer?.id === ids.familyId;
        // The funnel counts offers actually shown, not sign-in prompts.
        if (isOwner) {
          await emitMapEvent("wall.viewed", { family_id: ids.familyId, door: "plan" });
        }
        return (
          <div className="quiet-plan">
            <main className="quiet-plan__standalone">
              <Logo size={26} />
              {isOwner ? (
                <QuietFrame className="quiet-plan__wall" tone="paper">
                  <WallOffer door="plan" checkout={checkout} />
                </QuietFrame>
              ) : (
                <div className="quiet-plan__standalone-copy">
                  <h1 className="quiet-plan__state-title">
                    {WALL_SIGNIN_HEADLINE}
                  </h1>
                  <p className="quiet-plan__state-copy">{WALL_SIGNIN_BODY}</p>
                  <QuietAction
                    href={`/signin?next=${encodeURIComponent(`/onboarding/r/${token}/plan/${subjectId}`)}`}
                    size="large"
                    className="quiet-plan__state-action"
                  >
                    {WALL_SIGNIN_BUTTON}
                  </QuietAction>
                </div>
              )}
              <p className="quiet-plan__standalone-back">
                <QuietAction
                  kind="quiet"
                  href={`/onboarding/r/${token}`}
                  className="quiet-plan__footer-link"
                >
                  back to the report
                </QuietAction>
              </p>
            </main>
          </div>
        );
      }
    }
  }

  // Arriving from a deep dive rebuilds the month from the refined answers,
  // ONCE, then redirects to a URL that is safe to reload: leaving
  // ?rebuilt=1 in place meant every refresh rebuilt the month again
  // (restarting the retest clock and, with the narrative layer, resetting
  // the words the writing beat was waiting for, so it never resolved).
  if ((domain || isMonth) && rebuilt === "1") {
    const rebuiltPlan = await getOrBuildPlan(token, subjectId, { rebuild: true });
    if (rebuiltPlan) {
      const next = new URLSearchParams({ built: "1" });
      if (rebuiltPlan.rebuildHistoryId) {
        next.set("receipt", rebuiltPlan.rebuildHistoryId);
      }
      redirect(`/onboarding/r/${token}/plan/${subjectId}?${next.toString()}`);
    }
  }

  const result = domain || isMonth ? await getOrBuildPlan(token, subjectId) : null;
  const rebuildReceipt =
    built === "1" && receipt
      ? await getPlanRebuildReceipt(token, subjectId, receipt)
      : null;

  if (!result) {
    return (
      <div className="quiet-plan">
        <main className="quiet-plan__standalone">
          <Logo size={26} />
          <h1 className="quiet-plan__state-title">
            This plan link isn&apos;t active.
          </h1>
          <p className="quiet-plan__state-copy">
            Start with your child&apos;s progress report and every subject gets a plan button.
          </p>
          <QuietAction
            href="/onboarding"
            size="large"
            className="quiet-plan__state-action"
          >
            Start your free trial
          </QuietAction>
        </main>
      </div>
    );
  }

  if (result.wasNew) {
    await emitMapEvent("map.plan_built", {
      family_id: result.familyId,
      child_id: result.childId,
      subject: subjectId,
    });
  }

  const { plan, childName } = result;

  const flagOn = narrativeEnabled();
  const planMeta = result.narrativeMeta;
  const planReady = planMeta?.status === "ready" && result.narrative !== null;

  if (flagOn && !planReady && planMeta?.status !== "failed") {
    // No attempt yet (fresh or rebuilt plan) or a stale one: kick a
    // background generation; the runner's claim keeps it single-flight.
    const childId = result.childId;
    after(async () => {
      try {
        await runPlanNarrative(childId, subjectId, result.familyId);
      } catch (error) {
        console.error(
          "plan narrative kick failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    });
    return (
      <div className="quiet-plan">
        <main className="quiet-plan__standalone">
          <Logo size={26} />
          <h1 className="quiet-plan__state-title quiet-plan__state-title--loading">
            Homa is building the four-week plan
          </h1>
          <p className="quiet-plan__state-copy">
            The month&apos;s targets are set. Now the plan gets written for {childName}{" "}
            specifically.
          </p>
          <div className="quiet-plan__state-beat">
            <NarrativeBeat
              token={token}
              subjectId={subjectId}
              lines={[
                `Reading what you told me about ${childName}`,
                `Laying out the four ${plan.subjectName.toLowerCase()} weeks`,
                `Writing ${childName}'s plan`,
              ]}
            />
          </div>
        </main>
      </div>
    );
  }

  const planNarrative = flagOn && planReady ? result.narrative : null;
  const planRejected = new Set(flagOn && planReady ? (planMeta?.rejectedPieces ?? []) : []);
  const introText =
    planNarrative && !planRejected.has("intro") ? planNarrative.intro : null;
  const closingText =
    planNarrative && !planRejected.has("closing") ? planNarrative.closing : null;
  const weekLines = planNarrative
    ? planNarrative.weeks.map((line, index) => (planRejected.has(`week.${index}`) ? null : line))
    : null;

  const retestDate = new Date(result.retestAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    <div className="quiet-plan">
      <main className="quiet-plan__main">
        <article className="quiet-plan__frame">
          <header className="quiet-plan__header">
            <div className="quiet-plan__identity">
              <Logo size={24} />
              <span className="quiet-plan__eyebrow">
                a four-week plan {"\u00b7"} made for {childName}
              </span>
            </div>
            <h1 className="quiet-plan__title">
              {isMonth ? (
                <>
                  {childName}&apos;s <span className="quiet-plan__title-accent">month</span>
                </>
              ) : (
                <>
                  {childName}&apos;s <span className="quiet-plan__title-accent">{plan.subjectName.toLowerCase()}</span> month
                </>
              )}
            </h1>
            <p className="quiet-plan__subtitle">
              {isMonth
                ? "an add-on to what you already do: the smallest moves that show up in the numbers"
                : "four weeks, a few minutes a day, then a retest to see what moved"}
            </p>
          </header>

          <div className="quiet-plan__body">
            {built === "1" ? (
              <QuietFeedback
                tone="highlight"
                className="quiet-plan__update"
                title={rebuildReceipt
                  ? "Your updated four-week plan is ready."
                  : "Your four-week plan is ready."}
                aria-label="Plan update"
              >
                <p>
                  Homa {rebuildReceipt ? "rebuilt" : "built"} it from what you just shared.
                </p>
                {rebuildReceipt && rebuildReceipt.preservedDoneCount > 0 ? (
                  <p>
                    {rebuildReceipt.preservedDoneCount}{" "}
                    {rebuildReceipt.preservedDoneCount === 1
                      ? "completed activity appears"
                      : "completed activities appear"}{" "}
                    in both plans, so{" "}
                    {rebuildReceipt.preservedDoneCount === 1
                      ? "its checkmark stayed."
                      : "their checkmarks stayed."}
                  </p>
                ) : null}
                {rebuildReceipt && rebuildReceipt.archivedUnmatchedDoneCount > 0 ? (
                  <p>
                    {rebuildReceipt.archivedUnmatchedDoneCount}{" "}
                    {rebuildReceipt.archivedUnmatchedDoneCount === 1
                      ? "old checkmark does not match an activity"
                      : "old checkmarks do not match any activities"}{" "}
                    in this plan. Homa kept{" "}
                    {rebuildReceipt.archivedUnmatchedDoneCount === 1 ? "it" : "them"}{" "}
                    with the old plan, but{" "}
                    {rebuildReceipt.archivedUnmatchedDoneCount === 1
                      ? "it is not shown"
                      : "they are not shown"}{" "}
                    on this page.
                  </p>
                ) : null}
                {rebuildReceipt && rebuildReceipt.clearedScheduledDays > 0 ? (
                  <p>
                    Activities scheduled from the old plan were removed from Homa&apos;s Planner.
                  </p>
                ) : null}
                {rebuildReceipt ? <p>This plan is unscheduled.</p> : null}
                {rebuildReceipt ? (
                  <QuietAction
                    kind="quiet"
                    href="/app/planner"
                    className="quiet-plan__update-action"
                  >
                    Open Planner
                  </QuietAction>
                ) : null}
              </QuietFeedback>
            ) : null}
            {introText ? (
              <section className="quiet-plan__intro">
                <p className="quiet-plan__intro-label">This month, in short</p>
                <p className="quiet-plan__intro-copy">{introText}</p>
              </section>
            ) : plan.startingLine ? (
              <section className="quiet-plan__starting-line">
                <p className="quiet-plan__intro-label">The starting line (already solid)</p>
                <p className="quiet-plan__intro-copy">
                  {plan.startingLine}. That&apos;s real footing. The month builds on top of it.
                </p>
              </section>
            ) : (
              <section className="quiet-plan__starting-line">
                <p className="quiet-plan__intro-copy">
                  We&apos;re starting fresh here, and that&apos;s a fine place to start. Week one
                  finds the footing.
                </p>
              </section>
            )}

            {/* When the written intro exists it already carries the aim
                (read-through: intro + targets read twice); the formal
                targets fold away as the fine print. */}
            {introText ? (
              <details className="quiet-plan__details">
                <summary className="quiet-plan__details-summary">
                  The formal targets behind this month
                </summary>
                <ol className="quiet-plan__target-list">
                  {plan.targets.map((target) => (
                    <li key={target}>{target}</li>
                  ))}
                </ol>
              </details>
            ) : (
              <>
                <h2 className="quiet-plan__target-heading">
                  What this month aims at
                </h2>
                <ol className="quiet-plan__target-list">
                  {plan.targets.map((target) => (
                    <li key={target}>{target}</li>
                  ))}
                </ol>
              </>
            )}
            {plan.styleNote ? <p className="quiet-plan__style-note">{plan.styleNote}</p> : null}

            <PlanWeeks
              weeks={plan.weeks}
              weekLines={weekLines}
              reportToken={token}
              subjectId={subjectId}
              initialChecks={result.progress}
            />

            <section className="quiet-plan__retest">
              <p className="quiet-plan__retest-title">
                Retest week: around {retestDate}
              </p>
              {closingText ? (
                <p className="quiet-plan__retest-copy">
                  {closingText}
                </p>
              ) : (
                <p className="quiet-plan__retest-copy">
                  I&apos;ll email you a two-minute re-check so you can see what moved on{" "}
                  {childName}&apos;s report. A slower month is normal too. The numbers are a map,
                  never a grade.
                </p>
              )}
            </section>

            <section className="quiet-plan__invite quiet-plan__print-hidden">
              <p className="quiet-plan__invite-title">
                Homa runs a month like this for every subject at once.
              </p>
              <p className="quiet-plan__invite-copy">
                Materials made for {childName}, woven around your family, numbers tracked for you.
                Open Homa to keep planning from the dashboard.
              </p>
              <QuietAction
                href="/app"
                className="quiet-plan__invite-action"
              >
                Open Homa
              </QuietAction>
            </section>
          </div>

          <footer className="quiet-plan__footer">
            <span>made with Homa for {childName}</span>
            <QuietAction
              kind="quiet"
              href={`/onboarding/r/${token}`}
              className="quiet-plan__footer-link quiet-plan__print-hidden"
            >
              back to the report
            </QuietAction>
          </footer>
        </article>
      </main>
    </div>
  );
}
