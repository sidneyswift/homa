import { mapDb } from "../map/db";
import type { WallCheckout } from "./wall-types";

/**
 * The wall (plans/2026-07-11-the-wall.md): the paywall between the free
 * progress report and the acting product, built DARK behind
 * HOMA_WALL_ENABLED. Placement, decided 2026-07-11: the report stays
 * free forever; the card comes out at the first tap on a door (building
 * a plan or month, a curriculum call, the first chat message). Viewing
 * content that already exists stays open; only new action is gated.
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

/** Live links first (set only in Vercel production), TEST for local dev
 *  and previews. The monthly link must exist or the wall stays down: a
 *  wall with a broken checkout door would strand her. Annual is
 *  optional (founder ruling 2026-07-18: the flip starts $19 monthly
 *  only; the $99 sticker sits exactly on Homeschool Fox's price and
 *  waits for that read). */
function paymentLinkBases(): { monthly: string; annual: string | null } | null {
  const monthly =
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL ||
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL;
  const annual =
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ANNUAL_URL ||
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ANNUAL_URL;
  if (!monthly) return null;
  return { monthly, annual: annual || null };
}

function checkoutUrl(base: string, familyId: string, email: string | null): string {
  const url = new URL(base);
  // Stripe carries this through to the checkout session; the confirm
  // route verifies it against the signed-in family before unlocking.
  url.searchParams.set("client_reference_id", familyId);
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}

/**
 * familyWallCheckout(familyId): WallCheckout | null
 * The one wall question every door asks: null means the door is open
 * (flag off, links unconfigured, family exempt, or trial started);
 * a WallCheckout means show the wall with these checkout URLs.
 */
export async function familyWallCheckout(familyId: string): Promise<WallCheckout | null> {
  if (!wallEnabled()) return null;

  const links = paymentLinkBases();
  if (!links) {
    // Fail open on purpose: never block a family because an env var is
    // missing. The founder flips the flag only after the links exist.
    console.error("wall: HOMA_WALL_ENABLED is on but Payment Link envs are missing; doors stay open");
    return null;
  }

  try {
    const sql = mapDb();
    const rows = await sql<
      { trial_started_at: string | null; billing_exempt: boolean; email: string | null }[]
    >`
      select trial_started_at::text as trial_started_at, billing_exempt, email
      from public.families
      where id = ${familyId}
    `;
    const row = rows[0];
    if (!row || row.billing_exempt || row.trial_started_at) return null;

    return {
      monthlyUrl: checkoutUrl(links.monthly, familyId, row.email),
      annualUrl: links.annual ? checkoutUrl(links.annual, familyId, row.email) : null,
    };
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
 * startFamilyTrial(familyId, stripeCustomerId): boolean
 * Stamps trial_started_at once (the unlock). Returns true only on the
 * first stamp so billing.trial_started never double-fires when the
 * confirmation URL is revisited.
 */
export async function startFamilyTrial(
  familyId: string,
  stripeCustomerId: string | null,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.families
    set trial_started_at = now(),
        stripe_customer_id = coalesce(${stripeCustomerId}, stripe_customer_id)
    where id = ${familyId} and trial_started_at is null
    returning id
  `;
  return rows.length > 0;
}
