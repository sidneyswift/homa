import type { Metadata } from "next";
import Link from "next/link";

import { getMapDomain } from "@homa/core";

import { Logo } from "../../../../../../components/brand/Logo";
import { emitMapEvent } from "../../../../../../lib/map/events";
import { getOrBuildPlan } from "../../../../../../lib/map/store";
import { PlanWeeks } from "./plan-weeks";

/**
 * The four-week plan for one subject, built deterministically from the
 * child's answers + extras context on first view, retest armed for four
 * weeks out (the read-through's loop: implement, retest, watch the number
 * move). Tokenized like the report itself: printable, shareable, no login.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Four-week plan",
  robots: { index: false },
};

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; domainId: string }>;
  searchParams: Promise<{ rebuilt?: string }>;
}) {
  const { token, domainId } = await params;
  const { rebuilt } = await searchParams;
  const domain = getMapDomain(domainId);
  // Arriving from a deep dive rebuilds the month from the refined answers.
  const result = domain
    ? await getOrBuildPlan(token, domainId, { rebuild: rebuilt === "1" })
    : null;

  if (!result || !domain) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-20">
        <Logo size={26} />
        <h1 className="mt-8 font-display text-2xl font-bold text-strong">
          This plan link isn&apos;t active.
        </h1>
        <p className="mt-3 text-body">
          Start with your child&apos;s free progress report and every subject gets a plan button.
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

  if (result.wasNew) {
    await emitMapEvent("map.plan_built", {
      lead_id: result.leadId,
      child_id: result.childId,
      domain: domainId,
    });
  }

  const { plan, childName } = result;
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
              {childName}&apos;s <span style={{ color: "var(--sage-700)" }}>{plan.subjectName.toLowerCase()}</span> month
            </h1>
            <p className="mt-2 font-serif text-lg italic text-strong/75">
              four weeks, a few minutes a day, then a retest to see what moved
            </p>
          </div>

          <div className="px-7 py-7 sm:px-10">
            {rebuilt === "1" ? (
              <p className="mb-4 rounded-md px-4 py-3 text-sm font-semibold" style={{ background: "var(--gold-100)", color: "var(--gold-ink)" }}>
                Built from your deep dive: this month aims at exactly what you just pinned down.
              </p>
            ) : null}
            {plan.startingLine ? (
              <div className="rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-widest text-sage">
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

            <h2 className="mt-7 font-display text-xl font-semibold text-strong">
              What this month aims at
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-body">
              {plan.targets.map((target) => (
                <li key={target}>{target}</li>
              ))}
            </ol>
            {plan.styleNote ? <p className="mt-2 text-sm text-muted">{plan.styleNote}</p> : null}

            <PlanWeeks weeks={plan.weeks} storageKey={`homa-plan-${token}-${domainId}`} />

            <div className="mt-7 rounded-lg p-5" style={{ background: "var(--gold-100)" }}>
              <p className="font-semibold" style={{ color: "var(--gold-ink-strong)" }}>
                Retest week: around {retestDate}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--gold-ink)" }}>
                I&apos;ll email you a two-minute re-check so you can see what moved on{" "}
                {childName}&apos;s report. A slower month is normal too. The numbers are a map,
                never a grade.
              </p>
            </div>

            <div className="mt-7 rounded-lg p-6 print:hidden" style={{ background: "var(--surface-inverse)" }}>
              <p className="font-display text-xl font-bold" style={{ color: "#fff" }}>
                Homa runs a month like this for every subject at once.
              </p>
              <p className="mt-2 max-w-lg text-sm" style={{ color: "var(--stone-300)" }}>
                Materials made for {childName}, woven around your family, numbers tracked for you.
                You&apos;re on the founding families list. Your invite comes by email.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            <span>made with Homa for {childName}</span>
            <Link href={`/map/r/${token}`} className="text-brand underline-offset-2 hover:underline print:hidden">
              back to the report
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
