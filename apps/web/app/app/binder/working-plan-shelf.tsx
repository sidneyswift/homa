import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import type { WorkingPlanBinderItem } from "../../../lib/working-plans";

export function WorkingPlanShelf({
  plans,
  timeZone,
}: {
  plans: WorkingPlanBinderItem[];
  timeZone: string;
}) {
  if (plans.length === 0) return null;
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <QuietFrame
      as="section"
      tone="paper"
      className="mb-8 p-5"
      aria-labelledby="working-plans-heading"
    >
      <h2
        id="working-plans-heading"
        className="font-display text-xl font-semibold text-[color:var(--homa-ink)]"
      >
        Month plans in progress
      </h2>
      <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
        Open a saved draft to review or change it. Your Planner stays the same
        until you approve the plan.
      </p>
      <ul className="mt-4 divide-y divide-[var(--homa-soft-boundary)]">
        {plans.map((plan) => (
          <li
            key={plan.id}
            className="flex min-h-[52px] flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
          >
            <div>
              <h3 className="font-display text-xl font-semibold text-[color:var(--homa-ink)]">
                {plan.title}
              </h3>
              <p className="mt-1 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_56%,var(--homa-canvas))]">
                Month plan · updated {dateFormatter.format(new Date(plan.updatedAt))}
              </p>
            </div>
            <div className="shrink-0">
              <QuietAction
                kind="secondary"
                href={`/app?draft=resume-month-plan&plan=${plan.id}`}
              >
                Review with Homa
              </QuietAction>
            </div>
          </li>
        ))}
      </ul>
    </QuietFrame>
  );
}
