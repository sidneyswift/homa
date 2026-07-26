import { mapDb } from "../map/db";
import { familyOnboardingActive } from "../onboarding/state";
import type { PlanTier, TierCheckout, WallCheckout } from "./wall-types";

/**
 * The wall (plans/2026-07-11-the-wall.md): the paywall between the free
 * progress report and the acting product, built DARK behind
 * HOMA_WALL_ENABLED. Placement, decided 2026-07-11: the report stays
 * free forever; the card comes out at the first tap on a door (building
 * a plan or month, a curriculum call, the first chat message). Viewing
 * content that already exists stays open; only new action is gated.
 *
 * Superseded for NEW families twice since: the report lock (2026-07-18,
 * four free subjects) and the signup paywall (founder directive
 * 2026-07-26, signupPaywallEnabled below), which holds the whole account
 * behind a card-upfront trial before any report exists. The door wall
 * stays as written for families that predate each change.
 *
 * Flag off = familyWallCheckout returns null before touching the
 * database, so the conference-era product runs exactly as before, zero
 * added queries. The tenancy law holds: familyId always arrives from
 * auth context (requireFamily / RLS-scoped reads), never a request body.
 */

export function wallEnabled(): boolean {
  const value = (process.env.HOMA_WALL_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

/**
 * The report lock (plans/2026-07-18-report-lock.md), layered ON the
 * wall: with both flags up, a walled family's report renders the free
 * four subjects in full and holds the rest for membership. Its own
 * flag so the founder can kill the lock (the pre-committed kill test)
 * while the doors wall stays up.
 */
export function reportLockEnabled(): boolean {
  const value = (process.env.HOMA_REPORT_LOCK_ENABLED ?? "").trim().toLowerCase();
  return (value === "1" || value === "true") && wallEnabled();
}

/**
 * The signup paywall (founder directive 2026-07-26): the card comes out
 * right after the account is created, before the questionnaire, the
 * report, or any conversation. Every plan starts with the same
 * card-upfront 30-day trial the door wall already sells; this flag only
 * moves WHERE the ask happens. Ships dark; the founder flips it after
 * verifying the Payment Links. It does not require HOMA_WALL_ENABLED:
 * the account gate replaces the door wall for new families rather than
 * layering on it.
 *
 * This supersedes two recorded placements for new families while it is
 * on: "the report stays free forever" (2026-07-11) and chat-first
 * onboarding's "onboarding families never see the wall" (section 7).
 * Ruling recorded in docs/homa-planning/build-log.md, 2026-07-26.
 */
export function signupPaywallEnabled(): boolean {
  const value = (process.env.HOMA_SIGNUP_PAYWALL_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

/** Live links first (set only in Vercel production), TEST for local dev
 *  and previews. A tier's monthly link must exist or the tier doesn't
 *  render at all (regular's absence downs the whole wall; plus/elite's
 *  absence just narrows the offer to fewer tiers). Annual is optional
 *  per tier. Every tier's annual price is 20% off its monthly price
 *  times twelve, rounded to the nearest dollar (founder ruling
 *  2026-07-26); prices live in wall-copy.ts's TIER_PRICES.
 *
 *  Written as literal per-tier `process.env.NEXT_PUBLIC_...` accesses on
 *  purpose, never a templated key: Next.js only inlines NEXT_PUBLIC_ vars
 *  it can statically see at build time, so `process.env[computedKey]`
 *  would read as undefined in production. */
function tierPaymentLinkBases(tier: PlanTier): { monthly: string; annual: string | null } | null {
  let monthly: string | undefined;
  let annual: string | undefined;
  if (tier === "regular") {
    monthly =
      process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL ||
      process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL;
    annual =
      process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ANNUAL_URL ||
      process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ANNUAL_URL;
  } else if (tier === "plus") {
    monthly =
      process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_MONTHLY_URL ||
      process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_MONTHLY_URL;
    annual =
      process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_ANNUAL_URL ||
      process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_ANNUAL_URL;
  } else {
    monthly =
      process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_MONTHLY_URL ||
      process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_MONTHLY_URL;
    annual =
      process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_ANNUAL_URL ||
      process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_ANNUAL_URL;
  }
  if (!monthly) return null;
  return { monthly, annual: annual || null };
}

/**
 * Which Stripe Product backs each tier, live and test. Used only to read
 * back which tier a completed checkout session bought (billing/confirm),
 * never to build a checkout URL (Payment Links already carry that).
 * Product ids are stable identity, unlike price nicknames, so a future
 * price change for a tier never breaks this mapping.
 */
const TIER_PRODUCT_IDS: Record<PlanTier, readonly string[]> = {
  regular: ["prod_Uq02Zo8DUidRnH", "prod_Uq01TGhJROfVQ5"],
  plus: ["prod_Uq3Syk3GadgBVg", "prod_Uq3StPBgPdzwMX"],
  elite: ["prod_Ux4oRdW3a7ug6H", "prod_Ux4pENEFJNpBt5"],
};

/** tierForStripeProduct(productId): the plan tier a checkout session's
 *  product belongs to, or "regular" if the product is unrecognized (the
 *  safe default: never over-grant a paid tier from an unmapped id). */
export function tierForStripeProduct(productId: string | null | undefined): PlanTier {
  if (!productId) return "regular";
  for (const tier of Object.keys(TIER_PRODUCT_IDS) as PlanTier[]) {
    if (TIER_PRODUCT_IDS[tier].includes(productId)) return tier;
  }
  return "regular";
}

function checkoutUrl(base: string, familyId: string, email: string | null): string {
  const url = new URL(base);
  // Stripe carries this through to the checkout session; the confirm
  // route verifies it against the signed-in family before unlocking.
  url.searchParams.set("client_reference_id", familyId);
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}

/** The three-tier checkout bundle for one family, or null when the
 *  regular tier's links are missing (the wall/gate fails open upstream). */
function buildWallCheckout(familyId: string, email: string | null): WallCheckout | null {
  const regularLinks = tierPaymentLinkBases("regular");
  if (!regularLinks) return null;
  function tierCheckout(links: { monthly: string; annual: string | null } | null): TierCheckout | null {
    if (!links) return null;
    return {
      monthlyUrl: checkoutUrl(links.monthly, familyId, email),
      annualUrl: links.annual ? checkoutUrl(links.annual, familyId, email) : null,
    };
  }
  return {
    regular: tierCheckout(regularLinks) as TierCheckout,
    plus: tierCheckout(tierPaymentLinkBases("plus")),
    elite: tierCheckout(tierPaymentLinkBases("elite")),
  };
}

export interface WallAccessRow {
  billingExempt: boolean;
  trialStartedAt: string | null;
  profileCompletedAt: string | null;
  context: unknown;
}

/** Why a door stayed open, or null when the wall applies. Named so the
 *  order is testable: a silently mis-ordered exemption either walls a
 *  paying family or opens the wall for everyone. */
export type WallExemption = "billing_exempt" | "trial_started" | "onboarding";

/**
 * wallExemption(row): the ordered exemption decision, with no I/O.
 *
 * Order matters and is deliberate: an exempt family is exempt whatever
 * else is true, a trialing family has already given a card, and only
 * then does the onboarding bypass apply. Onboarding sits last so it can
 * never mask a billing state the founder set by hand.
 */
export function wallExemption(row: WallAccessRow): WallExemption | null {
  if (row.billingExempt) return "billing_exempt";
  if (row.trialStartedAt) return "trial_started";
  if (
    familyOnboardingActive({
      profileCompletedAt: row.profileCompletedAt,
      context: row.context,
    })
  ) {
    return "onboarding";
  }
  return null;
}

/**
 * familyWallCheckout(familyId): WallCheckout | null
 * The one wall question every door asks: null means the door is open
 * (flag off, links unconfigured, or an exemption above); a WallCheckout
 * means show the wall with these checkout URLs.
 */
export async function familyWallCheckout(familyId: string): Promise<WallCheckout | null> {
  if (!wallEnabled()) return null;

  const regularLinks = tierPaymentLinkBases("regular");
  if (!regularLinks) {
    // Fail open on purpose: never block a family because an env var is
    // missing. The founder flips the flag only after the links exist.
    console.error("wall: HOMA_WALL_ENABLED is on but regular Payment Link envs are missing; doors stay open");
    return null;
  }

  try {
    const sql = mapDb();
    const rows = await sql<
      {
        trial_started_at: string | null;
        billing_exempt: boolean;
        email: string | null;
        profile_completed_at: string | null;
        context: unknown;
      }[]
    >`
      select trial_started_at::text as trial_started_at, billing_exempt, email,
             profile_completed_at::text as profile_completed_at, context
      from public.families
      where id = ${familyId}
    `;
    const row = rows[0];
    if (!row) return null;
    // Chat-first onboarding (plans/2026-07-21-chat-first-onboarding.md
    // §7): the first chat door tap IS Homa's opening message once
    // onboarding is a conversation, so a walled family would meet the
    // paywall before meeting Homa. Onboarding families never see the
    // door wall; what they see instead, and when, is the credit lockout
    // that the P1 ruling still has to authorize. Behind
    // HOMA_CHAT_ONBOARDING, so nothing changes until the flow ships.
    if (
      wallExemption({
        billingExempt: row.billing_exempt,
        trialStartedAt: row.trial_started_at,
        profileCompletedAt: row.profile_completed_at,
        context: row.context,
      })
    ) {
      return null;
    }

    return buildWallCheckout(familyId, row.email);
  } catch (error) {
    // Fail open, always: a billing read must never take a family's
    // product down (this also covers a flag flipped before migration
    // 20260711200000 landed). The founder loses a wall, never a family.
    console.error(
      "wall: access read failed, doors stay open:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/**
 * The subscription statuses that end access under the signup paywall.
 * trialing and active keep the doors open; past_due stays open too while
 * Stripe's smart retries run (dunning is Stripe's job, not a lockout);
 * these four mean the relationship ended or never completed. Mirrored
 * onto families by the billing webhook; null (webhook dark, or a family
 * from before the mirror) reads as fine, never as lapsed.
 */
const LAPSED_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
  "paused",
]);

export interface AccountAccessRow {
  billingExempt: boolean;
  trialStartedAt: string | null;
  subscriptionStatus: string | null;
}

/** Why the account is open, or null when the signup paywall applies. */
export type AccountAccessGrant = "billing_exempt" | "trial";

/**
 * accountAccessDecision(row): the account-level entitlement, with no I/O.
 *
 * Unlike the door wall there is NO onboarding exemption: the signup
 * paywall exists precisely to meet the family before the product does.
 * billing_exempt still wins first (the founder's comp switch outranks
 * everything), then a started trial counts as long as the mirrored
 * subscription status has not lapsed. This is the first reader of
 * stripe_subscription_status: under the account gate, canceling really
 * ends access at the period boundary instead of leaving the old
 * permanent trial_started_at unlock in place.
 */
export function accountAccessDecision(row: AccountAccessRow): AccountAccessGrant | null {
  if (row.billingExempt) return "billing_exempt";
  if (!row.trialStartedAt) return null;
  if (row.subscriptionStatus && LAPSED_SUBSCRIPTION_STATUSES.has(row.subscriptionStatus)) {
    return null;
  }
  return "trial";
}

export interface AccountGateState {
  /** null means the account is open (flag off, links unconfigured, or
   *  an entitlement above); a WallCheckout means hold the whole account
   *  behind the trial gate at /onboarding/trial. */
  checkout: WallCheckout | null;
  /** True when a walled family once HAD a trial that has since lapsed
   *  (canceled, unpaid, paused): the gate greets her as a returning
   *  member instead of a stranger and offers the billing portal. */
  lapsed: boolean;
}

const ACCOUNT_OPEN: AccountGateState = { checkout: null, lapsed: false };

/**
 * familyAccountGate(familyId): the account gate's one question. Fail
 * posture matches the door wall on purpose: a missing env or a
 * billing-read error opens the account, because the founder loses a
 * gate, never a family.
 */
export async function familyAccountGate(familyId: string): Promise<AccountGateState> {
  if (!signupPaywallEnabled()) return ACCOUNT_OPEN;

  if (!tierPaymentLinkBases("regular")) {
    console.error(
      "wall: HOMA_SIGNUP_PAYWALL_ENABLED is on but regular Payment Link envs are missing; accounts stay open",
    );
    return ACCOUNT_OPEN;
  }

  try {
    const sql = mapDb();
    const rows = await sql<
      {
        trial_started_at: string | null;
        billing_exempt: boolean;
        stripe_subscription_status: string | null;
        email: string | null;
      }[]
    >`
      select trial_started_at::text as trial_started_at, billing_exempt,
             stripe_subscription_status, email
      from public.families
      where id = ${familyId}
    `;
    const row = rows[0];
    if (!row) return ACCOUNT_OPEN;
    if (
      accountAccessDecision({
        billingExempt: row.billing_exempt,
        trialStartedAt: row.trial_started_at,
        subscriptionStatus: row.stripe_subscription_status,
      })
    ) {
      return ACCOUNT_OPEN;
    }
    return {
      checkout: buildWallCheckout(familyId, row.email),
      lapsed: row.trial_started_at !== null,
    };
  } catch (error) {
    console.error(
      "wall: account access read failed, account stays open:",
      error instanceof Error ? error.message : "unknown",
    );
    return ACCOUNT_OPEN;
  }
}

/**
 * familyAccountCheckout(familyId): WallCheckout | null
 * The gate question for callers that only need open-or-walled (the /app
 * admission read, /onboarding's redirect).
 */
export async function familyAccountCheckout(familyId: string): Promise<WallCheckout | null> {
  return (await familyAccountGate(familyId)).checkout;
}

/**
 * startFamilyTrial(familyId, stripeCustomerId, tier): boolean
 * Stamps trial_started_at once (the unlock) and records which tier was
 * bought. Returns true only on the first stamp so billing.trial_started
 * never double-fires when the confirmation URL is revisited. plan_tier
 * always reflects the CURRENT checkout on every call, first or repeat:
 * a family upgrading tiers reaches this same confirm route on their new
 * Payment Link, and the tier they just bought must win, not the one
 * recorded on their original trial. A caller that does NOT know the
 * tier (the webhook's checkout.session.completed handler, which has no
 * expanded line items) passes null and leaves plan_tier untouched:
 * defaulting it to "regular" here used to let a webhook arriving after
 * the confirm route silently downgrade a Plus or Max purchase.
 */
export async function startFamilyTrial(
  familyId: string,
  stripeCustomerId: string | null,
  tier: PlanTier | null = null,
): Promise<boolean> {
  const sql = mapDb();
  // The `was` CTE reads trial_started_at from the same pre-statement
  // snapshot the UPDATE itself starts from, so it is the row's value
  // BEFORE this call touches it, never racing against the update below.
  const rows = await sql<{ was_first: boolean }[]>`
    with was as (
      select trial_started_at from public.families where id = ${familyId}
    ),
    updated as (
      update public.families
      set trial_started_at = coalesce(trial_started_at, now()),
          stripe_customer_id = coalesce(${stripeCustomerId}, stripe_customer_id),
          plan_tier = coalesce(${tier}, plan_tier)
      where id = ${familyId}
      returning id
    )
    select (select trial_started_at from was) is null as was_first
    from updated
  `;
  return rows[0]?.was_first === true;
}
