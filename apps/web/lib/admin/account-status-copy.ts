/**
 * Founder-console labels for families.status + profile_completed_at.
 * DB keeps open/claimed; English follows the parent funnel:
 * landing → signup → family setup. See pmf-focus reality-checks denominators.
 */

export type FamilyDbStatus = "open" | "complete" | "claimed" | "deleted";

export type AccountStatusTone = "sky" | "gold" | "sage" | "stone" | "outline";

export interface AccountStatusCopy {
  label: string;
  tone: AccountStatusTone;
  hint: string;
}

/**
 * accountStatusCopy({ status, profileCompletedAt }): AccountStatusCopy
 * Maps a family row to the console pill. "Signup not finished" is only for
 * status=open (session bootstrapped, Google/email never completed).
 * Setup done wins over plain "Signed up" once profile_completed_at is set.
 */
export function accountStatusCopy(input: {
  status: string | null | undefined;
  profileCompletedAt: string | null | undefined;
}): AccountStatusCopy {
  const status = (input.status ?? "open").toLowerCase();
  if (status === "deleted") {
    return {
      label: "Deleted",
      tone: "outline",
      hint: "Family marked deleted; hidden from normal funnels",
    };
  }
  if (status === "open") {
    return {
      label: "Signup not finished",
      tone: "gold",
      hint: "Opened Google or email/password signup; never completed account creation. Not a signed-up family.",
    };
  }
  // claimed, complete (legacy), or anything else with an account path
  if (input.profileCompletedAt) {
    return {
      label: "Setup done",
      tone: "sage",
      hint: "Signed up and finished create-your-family (name, address, phone)",
    };
  }
  return {
    label: "Signed up",
    tone: "sky",
    hint: "Completed Google or email/password; family setup not finished yet",
  };
}
