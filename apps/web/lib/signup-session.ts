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

export async function resolveSignupSession(
  attributes: unknown,
): Promise<SignupSession | null> {
  const attrs = (attributes ?? {}) as {
    channel?: string;
    familyId?: string;
    phoneNumber?: string;
  };
  if (attrs.channel !== "sms") return null;
  const phoneE164 = normalizeUsPhoneE164(attrs.phoneNumber ?? "");
  if (!phoneE164) return null;
  const familyId = attrs.familyId ?? (await findFamilyIdByPhone(phoneE164));
  return { phoneE164, familyId };
}
