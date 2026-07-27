import { normalizeUsPhoneE164 } from "@homa/core";

import { findFamilyIdByPhone } from "./family-phone";

/**
 * Shared resolution for the text-signup tools (sms-onboarding-plan
 * SO-2): the SESSION's phone number is the identity, and the family
 * comes from the channel's stamped attributes or the phone mapping,
 * never from model input. Non-SMS sessions are refused wholesale; the
 * web flow has its own onboarding.
 */

export interface SignupSession {
  phoneE164: string;
  familyId: string | null;
}

export const NOT_SMS_REFUSAL =
  "Text signup only works over SMS. On the web, the parent signs up at /onboarding; do not use this tool here.";

/** Deterministic gate, not just prose: while the signup paywall is on
 *  (founder directive 2026-07-26), text signup would hand out the
 *  account and report the web gate exists to hold, so every signup_*
 *  tool refuses (sms-mode.ts's front-door block steers the model to the
 *  web trial before it ever gets here). Keep the flag read in step with
 *  signupPaywallEnabled() in lib/billing/wall.ts (duplicated here so
 *  this module stays free of the billing module's database imports). */
export function textSignupPaywalled(): boolean {
  const value = (process.env.HOMA_SIGNUP_PAYWALL_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

/** begin_text_signup's honest refusal while the gate is on: the generic
 *  NOT_SMS_REFUSAL would tell an actual SMS session that SMS is the
 *  wrong channel, which is confusing and steers the model badly. */
export const TEXT_SIGNUP_PAYWALLED_REFUSAL =
  "Text signup is closed while every plan starts on the website. Offer the trial at thankshoma.com/onboarding instead; entering this phone number during signup links her texts automatically.";

export async function resolveSignupSession(
  attributes: unknown,
): Promise<SignupSession | null> {
  const attrs = (attributes ?? {}) as {
    channel?: string;
    familyId?: string;
    familySmsInviteLookupFailed?: string;
    familySmsInviteState?: string;
    phoneNumber?: string;
  };
  if (
    attrs.channel !== "sms" ||
    attrs.familySmsInviteLookupFailed === "true" ||
    attrs.familySmsInviteState ||
    textSignupPaywalled()
  ) {
    return null;
  }
  const phoneE164 = normalizeUsPhoneE164(attrs.phoneNumber ?? "");
  if (!phoneE164) return null;
  const familyId = attrs.familyId ?? (await findFamilyIdByPhone(phoneE164));
  return { phoneE164, familyId };
}
