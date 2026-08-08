import {
  planAvailableForPurchase,
  type BillingPeriod,
  type BillingProvider,
} from "@homa/core";

import {
  familyBillingEntitlement,
  LAPSED_BILLING_STATUSES,
  recordBillingSubscription,
  type FamilyBillingEntitlement,
} from "./entitlements";
import { mapDb } from "../map/db";
import { familyOnboardingActive } from "../onboarding/state";
import { isPlanTier } from "./wall-types";
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
 * card-upfront 7-day trial the door wall already sells; this flag only
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
 *  and previews. A tier must first be available in the shared catalog,
 *  then its monthly link must exist or the tier doesn't
 *  render at all (regular's absence downs the whole wall; Plus's
 *  absence narrows the offer). Max remains receipt-recognized but is
 *  intentionally unavailable for new purchases. Annual is optional
 *  per tier. Every tier's annual price is 20% off its monthly price
 *  times twelve, rounded to the nearest dollar (founder ruling
 *  2026-07-26); prices live in wall-copy.ts's TIER_PRICES.
 *
 *  Written as literal per-tier `process.env.NEXT_PUBLIC_...` accesses on
 *  purpose, never a templated key: Next.js only inlines NEXT_PUBLIC_ vars
 *  it can statically see at build time, so `process.env[computedKey]`
 *  would read as undefined in production. */
function tierPaymentLinkBases(tier: PlanTier): { monthly: string; annual: string | null } | null {
  if (!planAvailableForPurchase(tier)) return null;
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
    return null;
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

/**
 * tierForStripeProductRecognized(productId): the tier, or null when this
 * map has never heard of the product (gh#298).
 *
 * tierForStripeProduct answers "regular" for an unknown id, which is the
 * right default for a CONFIRM route: a buyer standing on the receipt
 * page should get the base plan rather than an error. It is the wrong
 * default for a writer that runs unattended, because plan_tier is
 * written with coalesce, so "regular" overwrites and null leaves alone.
 * A webhook that resolved an unmapped id to "regular" would silently
 * downgrade a Plus family, which is the exact failure the checkout
 * handler's own comment warns about.
 *
 * Rule of thumb: a caller that can show a human the result may use
 * tierForStripeProduct; a caller that writes plan_tier on its own uses
 * this one and passes the null straight through.
 */
export function tierForStripeProductRecognized(
  productId: string | null | undefined,
): PlanTier | null {
  if (!productId) return null;
  for (const tier of Object.keys(TIER_PRODUCT_IDS) as PlanTier[]) {
    if (TIER_PRODUCT_IDS[tier].includes(productId)) return tier;
  }
  return null;
}

/** Convert Stripe's verified recurring interval into Homa's term vocabulary. */
export function billingPeriodForStripeInterval(
  interval: string | null | undefined,
): BillingPeriod | null {
  if (interval === "month") return "monthly";
  if (interval === "year") return "annual";
  return null;
}

function checkoutUrl(base: string, familyId: string, email: string | null): string {
  const url = new URL(base);
  // Stripe carries this through to the checkout session; the confirm
  // route verifies it against the signed-in family before unlocking.
  url.searchParams.set("client_reference_id", familyId);
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}

/** The available checkout bundle for one family, or null when the
 *  regular tier's links are missing (the wall/gate fails open upstream).
 *  Known but unavailable tiers remain null for new purchases. */
export function buildWallCheckout(familyId: string, email: string | null): WallCheckout | null {
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
    elite: null,
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
 * (flags off, links unconfigured, or an exemption above); a WallCheckout
 * means show the wall with these checkout URLs.
 *
 * Under the signup paywall (2026-07-26) this question answers for BOTH
 * gates: an account-walled family (no trial, or a lapsed subscription)
 * is walled at every door regardless of HOMA_WALL_ENABLED and of the
 * door wall's own exemptions, so the plan/lesson/call/report-lock
 * routes and the tokenized report buttons inherit the account gate
 * without per-route edits (the dc4ab64b lesson: one decision, every
 * surface).
 */
export async function familyWallCheckout(familyId: string): Promise<WallCheckout | null> {
  const accountGateOn = signupPaywallEnabled();
  if (!wallEnabled() && !accountGateOn) return null;

  const regularLinks = tierPaymentLinkBases("regular");
  if (!regularLinks) {
    // Fail open on purpose: never block a family because an env var is
    // missing. The founder flips the flags only after the links exist.
    console.error("wall: a wall flag is on but regular Payment Link envs are missing; doors stay open");
    return null;
  }

  try {
    const sql = mapDb();
    const rows = await sql<
      {
        trial_started_at: string | null;
        billing_exempt: boolean;
        stripe_subscription_status: string | null;
        apple_subscription_status: string | null;
        created_at_ms: number | null;
        email: string | null;
        profile_completed_at: string | null;
        context: unknown;
      }[]
    >`
      select trial_started_at::text as trial_started_at, billing_exempt,
             stripe_subscription_status, apple_subscription_status,
             extract(epoch from created_at) * 1000 as created_at_ms, email,
             profile_completed_at::text as profile_completed_at, context
      from public.families
      where id = ${familyId}
    `;
    const row = rows[0];
    if (!row) return null;
    const entitlement = accountGateOn ? await familyBillingEntitlementOrNull(familyId) : null;

    // The account gate outranks every door exemption: an account-walled
    // family has no standing at any door, whatever the door wall's own
    // flags and bypasses say. In particular the onboarding exemption
    // cannot apply (under this gate the conversation starts after the
    // card) and trial_started alone cannot either (a lapsed
    // subscription ends it).
    if (
      accountGateOn &&
      accountAccessDecisionWithEntitlement(
        {
          billingExempt: row.billing_exempt,
          trialStartedAt: row.trial_started_at,
          stripeSubscriptionStatus: row.stripe_subscription_status,
          appleSubscriptionStatus: row.apple_subscription_status,
          createdAtMs: row.created_at_ms,
        },
        signupPaywallSince(),
        entitlement,
      ) === null
    ) {
      return buildWallCheckout(familyId, row.email);
    }

    if (!wallEnabled()) return null;

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
 *
 * Shared across both providers on purpose: Apple's App Store Server
 * status vocabulary is different from Stripe's, so the Apple webhook
 * (POST /api/billing/apple/webhook) normalizes it into these same four
 * strings when it writes apple_subscription_status, rather than this set
 * growing a second, parallel Apple vocabulary that providerState below
 * would have to know about. A revoked or expired Apple subscription is
 * written here as "canceled".
 */
export interface AccountAccessRow {
  billingExempt: boolean;
  trialStartedAt: string | null;
  stripeSubscriptionStatus: string | null;
  /** Apple's mirrored App Store Server status (20260728200000_apple_billing.sql).
   *  Null for every family that has never touched the iOS purchase, which
   *  today is all of them; this field exists so a family who lapses on one
   *  provider and re-subscribes on the other is never walled while paying
   *  (see accountAccessDecision's provider-state note). */
  appleSubscriptionStatus: string | null;
  /** families.created_at as epoch milliseconds (extracted in SQL so no
   *  Postgres-text-timestamp parsing happens in JS), for the grandfather
   *  cutoff below. */
  createdAtMs: number | null;
}

/** Why the account is open, or null when the signup paywall applies. */
export type AccountAccessGrant = "billing_exempt" | "grandfathered" | "trial";

/**
 * The grandfather cutoff: families created before this instant are never
 * account-gated (the door wall still applies to them as before). Set it
 * to the flag-flip moment to scope the test to new signups only; leave
 * it unset to gate every non-exempt family, existing ones included.
 * An unparseable value is ignored (nobody gets locked out by a typo).
 */
export function signupPaywallSince(): number | null {
  const raw = (process.env.HOMA_SIGNUP_PAYWALL_SINCE ?? "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    console.error(`wall: HOMA_SIGNUP_PAYWALL_SINCE is not a date (${raw}); grandfathering ignored`);
    return null;
  }
  return parsed;
}

/** A provider's mirrored status, reduced to what accountAccessDecision
 *  needs: "absent" (never recorded, the mirror has nothing to say and
 *  reads as fine, matching the original single-provider null-is-fine
 *  behavior), "lapsed" (recorded and in the lapsed set), or "active"
 *  (recorded and not lapsed: trialing, active, past_due, or any other
 *  live status). */
type ProviderState = "absent" | "lapsed" | "active";

function providerState(status: string | null): ProviderState {
  if (status === null) return "absent";
  return LAPSED_BILLING_STATUSES.has(status) ? "lapsed" : "active";
}

/**
 * accountAccessDecision(row, sinceMs): the account-level entitlement,
 * with no I/O (callers pass signupPaywallSince()).
 *
 * Unlike the door wall there is NO onboarding exemption: the signup
 * paywall exists precisely to meet the family before the product does.
 * billing_exempt still wins first (the founder's comp switch outranks
 * everything), then the grandfather cutoff, then a started trial counts
 * as long as it has not lapsed on every provider that has ever recorded
 * one for this family.
 *
 * Two providers (Stripe and Apple, ios-iap-priority): a family is open
 * if EITHER provider currently reads active, or if NEITHER provider has
 * ever recorded anything (the original single-provider "webhook dark
 * reads as fine" tolerance, unchanged for the 100% of families who have
 * never touched Apple billing). A family is walled only when at least
 * one provider has recorded something and none of the providers that
 * have ever recorded anything currently reads active. This is what lets
 * a family who lapses on one provider and re-subscribes on the other
 * unlock immediately, the same bug class recordFamilySubscription exists
 * to prevent within Stripe alone (a re-subscribing family's fresh
 * checkout must never stay walled behind a stale lapsed mirror).
 */
export function accountAccessDecision(
  row: AccountAccessRow,
  sinceMs: number | null,
): AccountAccessGrant | null {
  if (row.billingExempt) return "billing_exempt";
  if (sinceMs !== null && row.createdAtMs !== null && row.createdAtMs < sinceMs) {
    return "grandfathered";
  }
  if (!row.trialStartedAt) return null;

  const stripeState = providerState(row.stripeSubscriptionStatus);
  const appleState = providerState(row.appleSubscriptionStatus);
  const anyActive = stripeState === "active" || appleState === "active";
  const anyRecorded = stripeState !== "absent" || appleState !== "absent";
  if (!anyActive && anyRecorded) return null;

  return "trial";
}

/**
 * New billing writes live in the provider-neutral ledger. Until its additive
 * migration is present everywhere, a failed ledger read falls back to the
 * old Stripe-and-Apple mirror decision below. That makes rollout safe while
 * preserving the same fail-open posture for an unavailable billing read.
 */
function accountAccessDecisionWithEntitlement(
  row: AccountAccessRow,
  sinceMs: number | null,
  entitlement: FamilyBillingEntitlement | null,
): AccountAccessGrant | null {
  if (entitlement === null) return accountAccessDecision(row, sinceMs);
  if (row.billingExempt) return "billing_exempt";
  if (sinceMs !== null && row.createdAtMs !== null && row.createdAtMs < sinceMs) {
    return "grandfathered";
  }
  if (!row.trialStartedAt || !entitlement.active) return null;
  return "trial";
}

async function familyBillingEntitlementOrNull(
  familyId: string,
): Promise<FamilyBillingEntitlement | null> {
  try {
    return await familyBillingEntitlement(familyId);
  } catch (error) {
    // The ledger migration is additive and leads this deploy. Falling back
    // here keeps preview environments and a temporarily unavailable ledger
    // on the proven legacy access path instead of changing access by error.
    console.error(
      "wall: canonical entitlement read failed, using compatibility mirror:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
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
        apple_subscription_status: string | null;
        created_at_ms: number | null;
        email: string | null;
      }[]
    >`
      select trial_started_at::text as trial_started_at, billing_exempt,
             stripe_subscription_status, apple_subscription_status,
             extract(epoch from created_at) * 1000 as created_at_ms, email
      from public.families
      where id = ${familyId}
    `;
    const row = rows[0];
    if (!row) return ACCOUNT_OPEN;
    const entitlement = await familyBillingEntitlementOrNull(familyId);
    if (
      accountAccessDecisionWithEntitlement(
        {
          billingExempt: row.billing_exempt,
          trialStartedAt: row.trial_started_at,
          stripeSubscriptionStatus: row.stripe_subscription_status,
          appleSubscriptionStatus: row.apple_subscription_status,
          createdAtMs: row.created_at_ms,
        },
        signupPaywallSince(),
        entitlement,
      )
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

/** What the settings plan card needs to tell the truth (gh#412). */
export interface FamilyPlanState {
  tier: PlanTier;
  /** The active purchase rail, when the canonical ledger is available. */
  billingProvider: BillingProvider | null;
  /** Legacy Plus checkout metadata for existing account flows. New offer
   *  visibility comes only from the purchasable-plan catalog. */
  plusCheckout: TierCheckout | null;
  /** True once she has a Stripe customer, which is what the portal needs. */
  hasBillingRelationship: boolean;
}

/**
 * familyPlanState(familyId): her plan, and the way to change it.
 *
 * Deliberately NOT familyWallCheckout. That one answers "should a door
 * be closed in front of her", so it returns null for an exempt family,
 * a paying family, and a flags-off environment alike. Settings is not a
 * door: a parent looking at her own account should see which plan she is
 * on whether or not anything is currently being withheld.
 *
 * This lets settings show the recorded plan and payment-management path
 * without reusing wall-admission logic. Existing Plus stays recognizable;
 * new offer visibility comes only from the purchasable-plan catalog.
 */
export async function familyPlanState(familyId: string): Promise<FamilyPlanState> {
  const sql = mapDb();
  try {
    const rows = await sql<{ plan_tier: string | null; email: string | null; stripe_customer_id: string | null }[]>`
      select plan_tier, email, stripe_customer_id
      from public.families
      where id = ${familyId}
    `;
    const row = rows[0];
    const links = tierPaymentLinkBases("plus");
    let tier: PlanTier = isPlanTier(row?.plan_tier) ? row.plan_tier : "regular";
    let billingProvider: BillingProvider | null = null;
    try {
      const entitlement = await familyBillingEntitlement(familyId);
      if (entitlement?.active) {
        tier = entitlement.tier;
        billingProvider = entitlement.provider;
      }
    } catch (error) {
      console.error(
        "familyPlanState: canonical entitlement read failed, using compatibility mirror:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return {
      tier,
      billingProvider,
      plusCheckout: links
        ? {
            monthlyUrl: checkoutUrl(links.monthly, familyId, row?.email ?? null),
            annualUrl: links.annual
              ? checkoutUrl(links.annual, familyId, row?.email ?? null)
              : null,
          }
        : null,
      hasBillingRelationship: Boolean(row?.stripe_customer_id),
    };
  } catch (error) {
    // Settings must never fail to render because billing had a bad day.
    console.error(
      "familyPlanState failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      tier: "regular",
      billingProvider: null,
      plusCheckout: null,
      hasBillingRelationship: false,
    };
  }
}

/**
 * recordFamilySubscription(familyId, sub): mirrors a verified checkout's
 * subscription onto the families row BY FAMILY ID. The webhook's
 * customer.subscription.* handler matches by stripe_customer_id, which
 * fails for a re-subscribing lapsed family: Stripe mints a NEW customer
 * for the fresh Payment Link checkout and emits subscription.created
 * before checkout.session.completed pins the new id, so the mirror
 * update matched zero rows and the row kept its stale "canceled" status,
 * leaving a family that JUST PAID walled at the gate. Stamping the
 * mirror from the checkout itself (confirm route and the webhook's
 * completed handler, both of which know the family) closes that window.
 * Never throws: mirror freshness must not break the unlock path.
 */
export async function recordFamilySubscription(
  familyId: string,
  sub: {
    id: string;
    status: string;
    priceId: string | null;
    productId: string | null;
    customerId: string | null;
    tier: PlanTier | null;
    period: BillingPeriod | null;
    currentPeriodEndSec: number | null;
  },
): Promise<void> {
  const sql = mapDb();
  try {
    await sql`
      update public.families
      set stripe_subscription_id = ${sub.id},
          stripe_subscription_status = ${sub.status},
          stripe_price_id = ${sub.priceId},
          stripe_current_period_end = ${sub.currentPeriodEndSec ? new Date(sub.currentPeriodEndSec * 1000) : null},
          billing_updated_at = now()
      where id = ${familyId}
    `;
  } catch (error) {
    console.error(
      "wall: subscription compatibility mirror stamp failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  // An unknown Stripe product still refreshes the old mirror but does not
  // enter the canonical ledger. That prevents an unattended webhook from
  // silently replacing a paid Plus or Max entitlement with regular. Keep the
  // ledger write separate so an additive migration can trail the code deploy
  // without turning a successful Stripe purchase into a failed confirmation.
  if (sub.tier) {
    try {
      await recordBillingSubscription(familyId, {
        provider: "stripe",
        providerSubscriptionId: sub.id,
        providerCustomerId: sub.customerId,
        providerProductId: sub.productId,
        tier: sub.tier,
        period: sub.period,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEndSec
          ? new Date(sub.currentPeriodEndSec * 1000).toISOString()
          : null,
      });
    } catch (error) {
      console.error(
        "wall: canonical Stripe subscription stamp failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
}

/** Postgres unique_violation, matching families_apple_original_transaction_id_key
 *  (20260728200000_apple_billing.sql): another family already claimed this
 *  Apple subscription's original transaction id. */
export class AppleTransactionClaimedError extends Error {
  constructor(originalTransactionId: string) {
    super(`Apple original_transaction_id ${originalTransactionId} already belongs to another family`);
    this.name = "AppleTransactionClaimedError";
  }
}

/**
 * recordFamilyAppleSubscription(familyId, sub): the Apple twin of
 * recordFamilySubscription, called from the confirm route (the
 * authenticated purchaser, verified via appAccountToken) and the App
 * Store Server Notifications webhook (matched by original_transaction_id
 * instead), so a re-subscribing family's fresh mirror is never left
 * waiting on whichever one arrives second, the same race
 * recordFamilySubscription exists to close for Stripe.
 *
 * Unlike recordFamilySubscription this DOES throw, deliberately: a
 * unique_violation here means original_transaction_id already belongs
 * to a different family (families_apple_original_transaction_id_key),
 * which is not a transient failure to swallow, it is a caller that must
 * not be granted entitlement on this write. Every other error is
 * still just logged and rethrown so the caller decides the response,
 * rather than silently trusting a write that may not have happened.
 */
export async function recordFamilyAppleSubscription(
  familyId: string,
  sub: {
    originalTransactionId: string;
    status: string;
    productId: string;
    tier: PlanTier;
    period: BillingPeriod;
    expiresAtMs: number | null;
  },
): Promise<void> {
  const sql = mapDb();
  try {
    await sql`
      update public.families
      set apple_original_transaction_id = ${sub.originalTransactionId},
          apple_subscription_status = ${sub.status},
          apple_product_id = ${sub.productId},
          apple_expires_at = ${sub.expiresAtMs ? new Date(sub.expiresAtMs) : null},
          billing_updated_at = now()
      where id = ${familyId}
    `;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      throw new AppleTransactionClaimedError(sub.originalTransactionId);
    }
    console.error(
      "wall: apple subscription mirror stamp failed:",
      error instanceof Error ? error.message : "unknown",
    );
    throw error;
  }

  // The family-row write above owns the cross-family transaction claim and
  // therefore remains authoritative during rollout. A canonical ledger write
  // is best-effort until its additive migration has landed; once present, the
  // webhook will keep retrying it on future lifecycle notifications.
  try {
    await recordBillingSubscription(familyId, {
      provider: "apple",
      providerSubscriptionId: sub.originalTransactionId,
      providerCustomerId: null,
      providerProductId: sub.productId,
      tier: sub.tier,
      period: sub.period,
      status: sub.status,
      currentPeriodEnd: sub.expiresAtMs ? new Date(sub.expiresAtMs).toISOString() : null,
    });
  } catch (error) {
    console.error(
      "wall: canonical Apple subscription stamp failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export interface StripeCustomerFamily {
  id: string;
  email: string | null;
  firstName: string | null;
  planTier: PlanTier;
  timeZone: string | null;
  billingExempt: boolean;
}

/**
 * familyForStripeCustomer(customerId): the reverse lookup.
 *
 * Every other billing read goes family -> Stripe. A subscription webhook
 * arrives the other way round, carrying only a customer id, so this is
 * the one place that resolves it back. Returns null for an unknown
 * customer rather than throwing: Stripe sends events for objects this
 * database has never heard of (a dashboard-created subscription, a
 * customer from before the mirror), and none of them are errors.
 */
export async function familyForStripeCustomer(
  customerId: string,
): Promise<StripeCustomerFamily | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      email: string | null;
      first_name: string | null;
      plan_tier: string | null;
      time_zone: string | null;
      billing_exempt: boolean;
    }[]
  >`
    select id, email, first_name, plan_tier, time_zone, billing_exempt
    from public.families
    where stripe_customer_id = ${customerId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    planTier: isPlanTier(row.plan_tier) ? row.plan_tier : "regular",
    timeZone: row.time_zone,
    billingExempt: row.billing_exempt,
  };
}

/**
 * familyIdForAppleOriginalTransaction(originalTransactionId): the Apple
 * twin of familyForStripeCustomer, narrower because the webhook only
 * needs the id to call recordFamilyAppleSubscription. A notification for
 * a transaction id this database has never recorded (a sandbox test
 * notification, a transaction whose confirm call has not landed yet) is
 * not an error; the caller acknowledges it and moves on, the same
 * posture the Stripe webhook takes for an unknown customer.
 */
export async function familyIdForAppleOriginalTransaction(
  originalTransactionId: string,
): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.families
    where apple_original_transaction_id = ${originalTransactionId}
    limit 1
  `;
  return rows[0]?.id ?? null;
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
