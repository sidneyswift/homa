import { US_STATES } from "@homa/core";
import { z } from "zod";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamilyWithActorFromRequest } from "../../../../lib/map/session";
import { saveFamilyBasics } from "../../../../lib/onboarding/store";

/**
 * POST /api/onboarding/basics
 * The basics card's own write, so filling it in costs no model turn.
 *
 * Not /api/map/family: that route is the create-your-family FORM. It
 * demands the whole shape (family name, parent name, address, phone,
 * avatar) and short-circuits once profile_completed_at is set, which is
 * correct for a step that runs once and wrong for a conversation where
 * she might mention her state on Tuesday and correct it on Thursday.
 * This one takes whatever the card collected and coalesces the rest.
 *
 * The family comes from the resume cookie or the session, never the
 * body (tenancy law).
 */

const US_STATE_CODES: ReadonlySet<string> = new Set<string>(
  US_STATES.map((state) => state.code),
);

const basicsSchema = z
  .object({
    callMeName: z.string().trim().min(1).max(60).optional(),
    familyName: z.string().trim().min(1).max(80).optional(),
    usState: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase())
      .refine((value) => US_STATE_CODES.has(value), "not a US state code")
      .optional(),
    timeZone: z.string().trim().min(3).max(60).optional(),
    // The basics card's photo step. Uploaded client-side to the avatars
    // bucket (uploadAvatarPhoto) before this POST fires; this field only
    // ever carries a URL already in our own bucket.
    avatarUrl: z.string().trim().url().max(600).optional(),
  })
  .refine(
    (value) =>
      value.callMeName !== undefined ||
      value.familyName !== undefined ||
      value.usState !== undefined ||
      value.timeZone !== undefined ||
      value.avatarUrl !== undefined,
    "nothing to save",
  );

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-basics:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let actor;
  try {
    actor = await requireFamilyWithActorFromRequest(request);
  } catch {
    return Response.json({ ok: false, reason: "auth-error" }, { status: 401 });
  }
  if (!actor) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const { family, memberUserId } = actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const parsed = basicsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    const { savedFields } = await saveFamilyBasics(family.id, parsed.data, memberUserId);
    // The same event the form step emits, so the funnel counts one
    // family-setup whichever surface collected it.
    if (!family.profile_completed_at) {
      await emitMapEvent("map.family_setup", {
        family_id: family.id,
        has_address: false,
        has_phone: false,
        has_avatar: parsed.data.avatarUrl !== undefined,
      });
    }
    return Response.json({ ok: true, savedFields });
  } catch (error) {
    console.error(
      "onboarding/basics failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
