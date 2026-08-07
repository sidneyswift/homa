// No "server-only" here, matching wall.ts: the decision function is
// pure and its tests import this module directly under node:test.
import { mapDb } from "../map/db";
import { isPlanTier, type PlanTier } from "./wall-types";

/**
 * Which channels a family's plan entitles her to (gh#298).
 *
 * The 2026-07-28 tier ruling put the three plans on one axis, how far
 * Homa comes toward you: the base plan is Homa on the web, the second
 * adds text, phone, and email, and the top adds a person and a parcel.
 * The paywall says so. Nothing enforced it, so the $49 row was selling
 * an upgrade every family already had switched on, which is the same
 * falsehood the top tier's copy was cleaned of in the same session.
 *
 * Three postures are deliberate and each one is load-bearing:
 *
 * **It fails open.** A missing env, an unparseable date, or a database
 * error admits the turn. Same rule as the account gate above it: the
 * founder loses a gate, never a family. A parent who texts and hears
 * nothing because a query timed out is a support ticket and a refund;
 * a parent who slips through a broken gate costs a few cents of model
 * time.
 *
 * **It ships dark.** HOMA_CHANNEL_GATE_ENABLED is off until a founder
 * flips it, matching how every wall door in this codebase shipped. The
 * decision function and its tests are what land first, so the flip is
 * a config change rather than a deploy.
 *
 * **Denial is never silence.** A parent who texts a number that used to
 * answer and gets nothing back concludes Homa is broken, not that she
 * is on the wrong plan. Callers must send CHANNEL_GATE_SMS_LINE (or the
 * voice equivalent) rather than dropping the turn.
 */

/** The channels this gate governs. Web chat is never gated: it is what
 *  the base plan IS, and gating it would gate the product. */
export type GatedChannel = "sms" | "voice" | "email";

/** Plans that include Homa reaching you off the web. */
const CHANNEL_ENTITLED_TIERS: ReadonlySet<PlanTier> = new Set<PlanTier>(["plus", "elite"]);

/** Mirrors LAPSED_SUBSCRIPTION_STATUSES in wall.ts: a family whose
 *  subscription ended keeps no channel it paid for. */
const LAPSED_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
  "past_due",
  "unpaid",
  "paused",
]);

export function channelGateEnabled(): boolean {
  return (process.env.HOMA_CHANNEL_GATE_ENABLED ?? "").trim() === "1";
}

/**
 * Families created before this instant keep every channel forever.
 *
 * This is not optional politeness. On the day the gate was written, 78
 * families had been texting and calling Homa for weeks on no plan at
 * all, because the channels were free and open. Taking a working phone
 * number away from someone who has been using it is a different act
 * from declining to give it to someone new, and only the second one is
 * pricing. An unparseable value is ignored, so nobody is cut off by a
 * typo.
 */
export function channelGateSince(): number | null {
  const raw = (process.env.HOMA_CHANNEL_GATE_SINCE ?? "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    console.error(
      `channel-access: HOMA_CHANNEL_GATE_SINCE is not a date (${raw}); grandfathering ignored`,
    );
    return null;
  }
  return parsed;
}

export interface ChannelAccessRow {
  planTier: PlanTier | null;
  billingExempt: boolean;
  createdAtMs: number | null;
  subscriptionStatus: string | null;
}

export type ChannelAccessGrant =
  | "billing_exempt"
  | "grandfathered"
  | "entitled_tier";

/**
 * channelAccessDecision(row, sinceMs): the whole rule, with no I/O, so
 * it is testable without a database. null means this family does not
 * have the channel on her plan.
 *
 * Order matters and matches accountAccessDecision: the founder's comp
 * switch outranks everything, then the grandfather cutoff, then the
 * plan itself. A lapsed subscription loses the channel even on a paid
 * tier, because plan_tier records what was bought and never clears
 * itself when the card stops working.
 */
export function channelAccessDecision(
  row: ChannelAccessRow,
  sinceMs: number | null,
): ChannelAccessGrant | null {
  if (row.billingExempt) return "billing_exempt";
  if (sinceMs !== null && row.createdAtMs !== null && row.createdAtMs < sinceMs) {
    return "grandfathered";
  }
  if (!row.planTier || !CHANNEL_ENTITLED_TIERS.has(row.planTier)) return null;
  if (row.subscriptionStatus && LAPSED_STATUSES.has(row.subscriptionStatus)) return null;
  return "entitled_tier";
}

/**
 * familyHasChannel(familyId): the one question a channel asks before it
 * runs a turn. True means proceed.
 *
 * Every failure path returns true on purpose (see the module comment):
 * flag off, unknown family, database error. The only false is a family
 * that was read successfully and is genuinely on a web-only plan.
 */
export async function familyHasChannel(familyId: string | null): Promise<boolean> {
  if (!channelGateEnabled()) return true;
  if (!familyId) return true;

  try {
    const sql = mapDb();
    const rows = await sql<
      {
        plan_tier: string | null;
        billing_exempt: boolean | null;
        created_at: string | null;
        stripe_subscription_status: string | null;
      }[]
    >`
      select plan_tier, billing_exempt, created_at, stripe_subscription_status
      from public.families
      where id = ${familyId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return true;

    const grant = channelAccessDecision(
      {
        planTier: isPlanTier(row.plan_tier) ? row.plan_tier : null,
        billingExempt: row.billing_exempt === true,
        createdAtMs: row.created_at ? Date.parse(row.created_at) : null,
        subscriptionStatus: row.stripe_subscription_status,
      },
      channelGateSince(),
    );
    return grant !== null;
  } catch (error) {
    console.error("channel-access: entitlement read failed; admitting the turn:", error);
    return true;
  }
}

/**
 * What a parent on the base plan hears back, instead of nothing.
 *
 * Copy laws for this line, all of them the reason it is worded exactly
 * this way (rulebook: .agents/skills/homa-copy-writer/SKILL.md).
 * Name the unavailable action first, then give the concrete web path.
 * No apology, because nothing broke. And never promise an upgrade while
 * Plus is unavailable for a new purchase.
 */
export const CHANNEL_GATE_SMS_LINE =
  "Texting with Homa isn't available on your plan. Open Homa in your phone's browser to keep going.";

/** The same fact for a caller, shortened: she is holding a phone to her
 *  ear and cannot re-read a sentence. */
export const CHANNEL_GATE_VOICE_LINE =
  "Calling Homa isn't available on your plan. Open Homa in your phone's browser to keep going.";
