import { TIER_NAMES, tierDelta } from "../../../components/billing/wall-copy";
import type { FamilyPlanState } from "../../../lib/billing/wall";
import { SectionHeading } from "./section-heading";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";

/**
 * Which plan she is on, and the way to add Homa Plus (gh#412).
 *
 * This exists because of a sentence. The channel gate tells a parent who
 * texts on the base plan: "Everything is waiting for you on the web, and
 * texting with Homa is part of Homa Plus. You can add it whenever you
 * like, in your settings." Settings had no plan anything. Its only
 * billing control was a portal link shown to families with a Stripe
 * customer, which was 1 of 82. So the parent the gate turned away was
 * precisely the parent for whom this page was empty.
 *
 * Copy is reused verbatim, never rewritten and never edited in flight.
 * TIER_NAMES and tierDelta are the sanctioned per-tier promises and they
 * carry rulings about what may and may not be claimed: the Plus row's
 * exact words were argued down to eight, and the reason email is missing
 * from them is a line-wrap decision recorded above the string. String
 * surgery here would quietly reopen all of that.
 *
 * No price on the button. tierMonthlyButton exists for the paywall,
 * where a parent is deciding whether to buy at all; here she is deciding
 * whether to add something to an account she already has, and the
 * checkout page states the charge before she commits.
 */
export function PlanSection({ plan }: { plan: FamilyPlanState }) {
  const alreadyReached = plan.tier === "plus" || plan.tier === "elite";
  const upgradeUrl = plan.plusCheckout?.monthlyUrl ?? null;

  return (
    <QuietFrame as="section" className="p-6">
      <SectionHeading first>Your plan</SectionHeading>
      <p className="mt-2 text-sm font-semibold text-[color:var(--homa-ink)]">{TIER_NAMES[plan.tier]}</p>
      <p className="mt-1 text-sm text-[color:var(--homa-ink-muted)]">{tierDelta(plan.tier)}</p>

      {alreadyReached || upgradeUrl === null ? null : (
        <div className="mt-5 border-t border-[var(--homa-control-boundary)] pt-4">
          <p className="text-sm font-semibold text-[color:var(--homa-ink)]">{TIER_NAMES.plus}</p>
          <p className="mt-1 text-sm text-[color:var(--homa-ink-muted)]">{tierDelta("plus")}</p>
          <QuietAction href={upgradeUrl} className="mt-3">
            Add {TIER_NAMES.plus}
          </QuietAction>
        </div>
      )}
    </QuietFrame>
  );
}
