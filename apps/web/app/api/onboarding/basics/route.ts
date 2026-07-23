import { HOMESCHOOL_STYLES, US_STATES } from "@homa/core";
import { z } from "zod";

import { emitMapEvent } from "../../../../lib/map/events";
import { saveFamilyContext } from "../../../../lib/map/store";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
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
    // The basics card's third, optional step (founder call: fold it in
    // here rather than leave it purely to chance mid-conversation). An
    // empty array is what "asked, nothing picked" looks like, so it is
    // its own branch below rather than "nothing to save".
    homeschoolStyles: z.array(z.enum(HOMESCHOOL_STYLES)).max(HOMESCHOOL_STYLES.length).optional(),
  })
  .refine(
    (value) =>
      value.callMeName !== undefined ||
      value.familyName !== undefined ||
      value.usState !== undefined ||
      value.timeZone !== undefined ||
      value.homeschoolStyles !== undefined,
    "nothing to save",
  );

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-basics:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

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
    const { savedFields } = await saveFamilyBasics(family.id, parsed.data);
    // Same merge path save_homeschool_profile uses in conversation, so a
    // style picked here and one mentioned in passing land in one bag
    // rather than two shapes. An empty array still counts as answered:
    // it means she saw the chips and picked none, which the tool path
    // has no way to express (it only ever writes what was volunteered).
    if (parsed.data.homeschoolStyles !== undefined) {
      await saveFamilyContext(family.id, { styles: parsed.data.homeschoolStyles });
      savedFields.push("homeschoolStyles");
    }
    // The same event the form step emits, so the funnel counts one
    // family-setup whichever surface collected it.
    if (!family.profile_completed_at) {
      await emitMapEvent("map.family_setup", {
        family_id: family.id,
        has_address: false,
        has_phone: false,
        has_avatar: false,
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
