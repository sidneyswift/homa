import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { Logo } from "../../../../../../components/brand/Logo";
import { WallOffer } from "../../../../../../components/billing/wall-offer";
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
  getReportEventIdsByToken,
  planExists,
} from "../../../../../../lib/map/store";
import { NarrativeBeat } from "../../narrative-beat";
import { reportButtonClass } from "../../report-button";
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
  searchParams: Promise<{ rebuilt?: string; built?: string; cleared?: string }>;
}) {
  const { token, subjectId } = await params;
  const { rebuilt, built, cleared } = await searchParams;
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
          <main className="mx-auto w-full max-w-xl px-6 py-20">
            <Logo size={26} />
            {isOwner ? (
              <div className="mt-8 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
                <WallOffer door="plan" checkout={checkout} />
              </div>
            ) : (
              <div className="mt-8">
                <h1 className="font-display text-2xl font-bold text-strong">
                  {WALL_SIGNIN_HEADLINE}
                </h1>
                <p className="mt-3 text-body">{WALL_SIGNIN_BODY}</p>
                <Link
                  href={`/signin?next=${encodeURIComponent(`/onboarding/r/${token}/plan/${subjectId}`)}`}
                  className={reportButtonClass(
                    "primary",
                    "mt-6 inline-flex min-h-12 items-center px-6 py-3 text-base font-semibold",
                  )}
                >
                  {WALL_SIGNIN_BUTTON}
                </Link>
              </div>
            )}
            <p className="mt-4 text-sm">
              <Link
                href={`/onboarding/r/${token}`}
                className="text-brand underline-offset-2 hover:underline"
              >
                back to the report
              </Link>
            </p>
          </main>
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
      // ?cleared=1 carries the rebuild's calendar receipt across the
      // redirect: the rebuild took the old month's placed days off the
      // calendar (issue #256), and the banner below says so.
      const clearedParam = rebuiltPlan.clearedScheduledDays > 0 ? "&cleared=1" : "";
      redirect(`/onboarding/r/${token}/plan/${subjectId}?built=1${clearedParam}`);
    }
  }

  const result = domain || isMonth ? await getOrBuildPlan(token, subjectId) : null;

  if (!result) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-20">
        <Logo size={26} />
        <h1 className="mt-8 font-display text-2xl font-bold text-strong">
          This plan link isn&apos;t active.
        </h1>
        <p className="mt-3 text-body">
          Start with your child&apos;s progress report and every subject gets a plan button.
        </p>
        <Link
          href="/onboarding"
          className={reportButtonClass(
            "primary",
            "mt-6 inline-flex min-h-12 items-center px-6 py-3 text-base font-semibold",
          )}
        >
          Start your free trial
        </Link>
      </main>
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
      <div className="min-h-screen bg-page">
        <main className="mx-auto w-full max-w-xl px-6 py-16">
          <Logo size={26} />
          <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-strong">
            Homa is building the four-week plan
          </h1>
          <p className="mt-2 text-body">
            The month&apos;s targets are set. Now the plan gets written for {childName}{" "}
            specifically.
          </p>
          <div className="mt-6">
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
    <div className="min-h-screen bg-page pb-16">
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lg print:border-0 print:shadow-none">
          <div style={{ background: "var(--band-mint)" }} className="px-7 pb-7 pt-8 sm:px-10">
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="font-mono text-xs uppercase tracking-widest text-strong/70">
                a four-week plan {"\u00b7"} made for {childName}
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold leading-none tracking-tight text-strong">
              {isMonth ? (
                <>
                  {childName}&apos;s <span style={{ color: "var(--sage-700)" }}>month</span>
                </>
              ) : (
                <>
                  {childName}&apos;s <span style={{ color: "var(--sage-700)" }}>{plan.subjectName.toLowerCase()}</span> month
                </>
              )}
            </h1>
            <p className="mt-2 font-serif text-lg italic text-strong/75">
              {isMonth
                ? "an add-on to what you already do: the smallest moves that show up in the numbers"
                : "four weeks, a few minutes a day, then a retest to see what moved"}
            </p>
          </div>

          <div className="px-7 py-7 sm:px-10">
            {built === "1" ? (
              <p className="mb-4 rounded-md px-4 py-3 text-sm font-semibold" style={{ background: "var(--gold-100)", color: "var(--gold-ink)" }}>
                Built from your deep dive: this month aims at exactly what you just pinned down.
                {cleared === "1"
                  ? " The new month starts fresh, so the calendar days placed for the old one came off with it. You can put the new weeks on real days whenever you like."
                  : null}
              </p>
            ) : null}
            {introText ? (
              <div className="rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-4">
                <p
                  className="font-mono text-[0.65rem] uppercase tracking-widest"
                  style={{ color: "var(--sage-700)" }}
                >
                  This month, in short
                </p>
                <p className="mt-1 whitespace-pre-line text-body">{introText}</p>
              </div>
            ) : plan.startingLine ? (
              <div className="rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-4">
                <p
                  className="font-mono text-[0.65rem] uppercase tracking-widest"
                  style={{ color: "var(--sage-700)" }}
                >
                  The starting line (already solid)
                </p>
                <p className="mt-1 text-body">
                  {plan.startingLine}. That&apos;s real footing. The month builds on top of it.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-4">
                <p className="text-body">
                  We&apos;re starting fresh here, and that&apos;s a fine place to start. Week one
                  finds the footing.
                </p>
              </div>
            )}

            {/* When the written intro exists it already carries the aim
                (read-through: intro + targets read twice); the formal
                targets fold away as the fine print. */}
            {introText ? (
              <details className="mt-4">
                <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                  The formal targets behind this month
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-body">
                  {plan.targets.map((target) => (
                    <li key={target}>{target}</li>
                  ))}
                </ol>
              </details>
            ) : (
              <>
                <h2 className="mt-7 font-display text-xl font-semibold text-strong">
                  What this month aims at
                </h2>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-body">
                  {plan.targets.map((target) => (
                    <li key={target}>{target}</li>
                  ))}
                </ol>
              </>
            )}
            {plan.styleNote ? <p className="mt-2 text-sm text-muted">{plan.styleNote}</p> : null}

            <PlanWeeks
              weeks={plan.weeks}
              weekLines={weekLines}
              reportToken={token}
              subjectId={subjectId}
              initialChecks={result.progress}
            />

            <div className="mt-7 rounded-lg p-5" style={{ background: "var(--gold-100)" }}>
              <p className="font-semibold" style={{ color: "var(--gold-ink-strong)" }}>
                Retest week: around {retestDate}
              </p>
              {closingText ? (
                <p className="mt-1 whitespace-pre-line text-sm" style={{ color: "var(--gold-ink)" }}>
                  {closingText}
                </p>
              ) : (
                <p className="mt-1 text-sm" style={{ color: "var(--gold-ink)" }}>
                  I&apos;ll email you a two-minute re-check so you can see what moved on{" "}
                  {childName}&apos;s report. A slower month is normal too. The numbers are a map,
                  never a grade.
                </p>
              )}
            </div>

            <div className="mt-7 rounded-lg p-6 print:hidden" style={{ background: "var(--surface-inverse)" }}>
              <p className="font-display text-xl font-bold" style={{ color: "#fff" }}>
                Homa runs a month like this for every subject at once.
              </p>
              <p className="mt-2 max-w-lg text-sm" style={{ color: "var(--stone-300)" }}>
                Materials made for {childName}, woven around your family, numbers tracked for you.
                Open Homa to keep planning from the dashboard.
              </p>
              <Link
                href="/app"
                className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:bg-page"
              >
                Open Homa
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            <span>made with Homa for {childName}</span>
            <Link href={`/onboarding/r/${token}`} className="text-brand underline-offset-2 hover:underline print:hidden">
              back to the report
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
