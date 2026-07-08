import { mapFamilySetupSchema, normalizeUsPhoneE164 } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { saveFamilySetup } from "../../../../lib/map/store";
import { setFamilyPhone } from "../../../../lib/family-phone";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * POST /api/map/family
 * The create-your-family step, right after S1's account moment (founder
 * call 2026-07-08: one onboarding for every door). Saves the family's
 * display name, the parent's name, the address, the cell number, and the
 * optional avatar, then stamps profile_completed_at so the step shows
 * exactly once. The family comes from the resume cookie or session, never
 * the body (tenancy law).
 *
 * The phone rides in two places on purpose: families.phone_e164 (plain
 * contact info, always saved) and family_phones (the texting ROUTING
 * table, unique across families). If another family already claimed the
 * number for texting, the link quietly stands down, the contact column
 * still saves, and the /home texting card can sort it out later; setup
 * never blocks on it.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`family:${clientIp(request)}`, 15)) {
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

  const parsed = mapFamilySetupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const input = parsed.data;

  let phoneE164: string | undefined;
  if (input.phone) {
    const normalized = normalizeUsPhoneE164(input.phone);
    if (!normalized) {
      return Response.json({ ok: false, reason: "bad-phone" }, { status: 400 });
    }
    phoneE164 = normalized;
  }

  // The avatar must live in OUR public avatars bucket; anything else is
  // dropped rather than stored (never persist an arbitrary URL).
  const avatarPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
  const avatarUrl =
    input.avatarUrl && input.avatarUrl.startsWith(avatarPrefix) ? input.avatarUrl : undefined;

  const [firstName, ...rest] = input.parentName.replace(/\s+/g, " ").split(" ");
  const lastName = rest.join(" ") || undefined;

  try {
    await saveFamilySetup(family.id, {
      familyName: input.familyName,
      firstName,
      lastName,
      addressLine: input.addressLine,
      city: input.city,
      usState: input.usState,
      zip: input.zip,
      phoneE164,
      avatarUrl,
    });

    if (phoneE164) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // Taken by another family = quiet stand-down (see module doc).
      await setFamilyPhone({
        familyId: family.id,
        phoneE164,
        addedBy: user?.id ?? null,
        source: "signup",
      });
    }

    await emitMapEvent("map.family_setup", {
      family_id: family.id,
      has_address: Boolean(input.addressLine),
      has_phone: Boolean(phoneE164),
      has_avatar: Boolean(avatarUrl),
    });

    return Response.json({ ok: true });
  } catch (error) {
    // No address or phone in server logs, ever.
    console.error("map/family failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
