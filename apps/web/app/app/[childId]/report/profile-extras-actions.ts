"use server";

import { revalidatePath } from "next/cache";

import { normalizeUsPhoneE164 } from "@homa/core";

import { addFamilyPhone } from "../../../../lib/family-phone";
import { getMyFamily } from "../../../../lib/family";
import { setFamilyAddress } from "../../../../lib/family-profile";
import { setFamilyTimeZone, timeZoneFromState } from "../../../../lib/family-time-zone";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * The post-report "complete your profile" step (funnel work 2026-07-20,
 * docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md). The
 * mailing address and cell number left the signup family card, which was
 * costing ~17% of new accounts before they answered a single question.
 * They land here instead, AFTER the first report is on screen, both
 * entirely optional, each with its own honest value framing.
 *
 * Both are optional on purpose: skipping saves nothing and is a first-
 * class outcome, never an error. The family always comes from the caller's
 * OWN membership (getMyFamily under RLS), never the form (BUILD.md law #1),
 * and the state is read from the family row, not the client, because the
 * signup card already captured it.
 */

export interface ProfileExtrasState {
  error: string | null;
  saved?: boolean;
}

export async function saveProfileExtrasAction(
  _prev: ProfileExtrasState,
  formData: FormData,
): Promise<ProfileExtrasState> {
  const addressLine = String(formData.get("address_line") ?? "").trim();
  const city = String(formData.get("address_city") ?? "").trim();
  const zip = String(formData.get("address_zip") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  // A mailing address is all or nothing: a lone street line with no city
  // or ZIP cannot be mailed to. Any one filled means we ask for the rest,
  // and none filled is a clean skip.
  const anyAddress = Boolean(addressLine || city || zip);
  if (anyAddress && (!addressLine || !city || !zip)) {
    return {
      error:
        "Add the whole mailing address, street, city, and ZIP, or leave it blank for now.",
    };
  }
  if (anyAddress && !family.us_state) {
    return { error: "Add your state in settings first, then your mailing address." };
  }

  let phoneE164: string | null = null;
  if (rawPhone) {
    phoneE164 = normalizeUsPhoneE164(rawPhone);
    if (!phoneE164) {
      return {
        error:
          "That doesn't look like a US cell number, it needs all ten digits, or leave it blank.",
      };
    }
  }

  if (anyAddress && family.us_state) {
    await setFamilyAddress(family.id, {
      addressLine,
      city,
      usState: family.us_state,
      zip,
    });
    // The address names the clock when we have no zone yet (same rule as
    // the settings family-details editor); a state already on file keeps
    // whatever zone the device capture set.
    const derivedZone = timeZoneFromState(family.us_state);
    if (derivedZone && !family.time_zone) {
      await setFamilyTimeZone(family.id, derivedZone);
    }
  }

  if (phoneE164) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // A number already routing to another family never blocks this
    // optional save: the contact still counts as offered, and the settings
    // texting card handles the verified claim later (U7), so we don't
    // hard-fail the card on a taken number.
    await addFamilyPhone({
      familyId: family.id,
      phoneE164,
      addedBy: user?.id ?? null,
      source: "home",
    });
  }

  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}
