import { mapDb } from "../map/db";

/**
 * The materials studio's image budget (2026-07-25 fix): generate_image
 * used to gate on lib/map/ratelimit.ts, an in-memory per-instance Map.
 * Serverless instances do not share memory and a deploy clears it, so the
 * cap was soft in both directions: production shows two families
 * exceeding 30 images in one calendar day (one hit 37, one hit 31) while
 * a family's own build could still be told "budget used up" mid-session
 * only to have the very same evening's later deploy silently refill it.
 * This counts today's already-SUCCESSFUL generations straight from
 * materials.image_generated (emitted only after generateStudioImage
 * returns ok, create_printable.ts / generate_image.ts), so the budget is
 * durable across instances and deploys, and a failed call never spends
 * it (the old limiter counted every attempt, win or lose).
 */

export const MAX_IMAGES_PER_FAMILY_PER_DAY = 30;

/** A soft heads-up appended to the model's result once this many of
 * today's images are spent, ahead of the hard cutoff. No per-turn cap
 * ships here on purpose: the founder's own steer (2026-07-24 review) was
 * "alert, don't hard-cap" for compute spend in general, and a fixed
 * per-turn image limit would risk breaking a real multi-page packet that
 * legitimately needs several. */
export const IMAGE_BUDGET_WARNING_AT = 24;

/**
 * Read-then-act, deliberately: this is checked once per generate_image
 * call, before the (slow, paid) generation itself, with no reservation
 * or lock held across it. Several calls the model fires in one burst
 * can all read the same pre-generation count and all proceed, so a
 * family can overshoot 30/day by roughly the number of concurrent calls
 * in that burst. An atomic reservation would need its own counter table
 * and a lock held across a slow external API call (which risks
 * serializing every image build for that family behind one stuck
 * request), so this accepts a small, bounded overshoot rather than add
 * that machinery for a P0 fix. It is still a strict improvement on the
 * limiter it replaces, which had no cross-instance ceiling at all.
 */
export async function imagesGeneratedToday(familyId: string): Promise<number> {
  try {
    const sql = mapDb();
    const rows = await sql<{ n: number }[]>`
      select count(*)::int as n
      from public.events
      where name = 'materials.image_generated'
        and family_id = ${familyId}
        and created_at >= date_trunc('day', now())
    `;
    return rows[0]?.n ?? 0;
  } catch (error) {
    // A budget read failure must never itself block image generation
    // (the old limiter's failure mode was "silently permissive", not
    // "silently blocking"; keep that posture). Treat as under budget.
    console.error("imagesGeneratedToday failed:", error);
    return 0;
  }
}

/** One line to append to generate_image's result, win or lose, so the
 * model can plan the rest of a multi-child, multi-page request against a
 * real number instead of discovering exhaustion mid-packet. */
export function imageBudgetNote(usedToday: number): string {
  const remaining = Math.max(0, MAX_IMAGES_PER_FAMILY_PER_DAY - usedToday);
  const warning =
    usedToday >= IMAGE_BUDGET_WARNING_AT && remaining > 0
      ? ` Getting close to today's limit: plan the rest of this request around what is left.`
      : "";
  return `Images used today: ${usedToday} of ${MAX_IMAGES_PER_FAMILY_PER_DAY}.${warning}`;
}
