import Link from "next/link";

import { getMapDomain, MONTH_PLAN_DOMAIN } from "@homa/core";

import type { DashboardPlan, DashboardReport } from "../../lib/dashboard";

/**
 * "Your month": every built plan across the family with its synced
 * check-offs and re-check date. This frame replaces the template's
 * weekly-rhythm chart until an hours log exists; check-offs are the
 * parent's own work, counted by code, positive-only (unchecked boxes
 * say nothing).
 */

function subjectLabel(domainId: string): string {
  if (domainId === MONTH_PLAN_DOMAIN) return "the month";
  return (getMapDomain(domainId)?.displayName ?? domainId).toLowerCase();
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MonthCard({
  plans,
  reports,
  childNames,
}: {
  plans: DashboardPlan[];
  reports: Map<string, DashboardReport>;
  childNames: Map<string, string>;
}) {
  if (plans.length === 0) return null;
  const rows = plans.slice(0, 4);
  const nowMs = new Date().getTime();
  return (
    <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <p className="text-[0.8rem] font-semibold text-muted">Your month</p>
      <div className="mt-2 flex flex-col">
        {rows.map((plan, index) => {
          const token = reports.get(plan.childId)?.token;
          const kidName = childNames.get(plan.childId) ?? "";
          const due = new Date(plan.retestAt).getTime() <= nowMs;
          const percent = plan.total > 0 ? (plan.done / plan.total) * 100 : 0;
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-body">
                  {kidName} {"\u00b7"} {subjectLabel(plan.domainId)}
                </span>
                <span className="font-mono text-xs text-subtle">
                  {plan.done} of {plan.total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-pill bg-[var(--stone-100)]">
                <div
                  className="h-full rounded-pill bg-[var(--sage-400)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]" style={{ color: due ? "var(--clay-600)" : "var(--text-subtle)" }}>
                {due ? "ready to re-check" : `re-check ${shortDate(plan.retestAt)}`}
              </p>
            </>
          );
          const rowClass = `${index < rows.length - 1 ? "border-b border-[var(--stone-100)] " : ""}block py-3 first:pt-1 last:pb-0`;
          return token ? (
            <Link
              key={`${plan.childId}-${plan.domainId}`}
              href={`/onboarding/r/${token}/plan/${plan.domainId}`}
              className={`${rowClass} -mx-2 rounded-md px-2 transition-colors duration-(--dur-fast) ease-out hover:bg-page`}
            >
              {body}
            </Link>
          ) : (
            <div key={`${plan.childId}-${plan.domainId}`} className={rowClass}>
              {body}
            </div>
          );
        })}
      </div>
      {plans.length > rows.length ? (
        <p className="mt-2 text-xs text-subtle">
          + {plans.length - rows.length} more in the reports
        </p>
      ) : null}
    </section>
  );
}
