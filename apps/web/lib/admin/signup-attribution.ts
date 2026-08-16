/**
 * Classifies a freshly created Auth account for the founder funnel.
 *
 * Auth creation is intentionally not a synonym for a new Homa family:
 * a parent may resume an existing family, run a sandbox rehearsal, or
 * leave before the browser links an account to a family. Keeping these
 * states separate prevents a false conversion denominator.
 */
export type SignupAttribution =
  | "new_family"
  | "sandbox_family"
  | "existing_family"
  | "deleted_family"
  | "internal_fixture"
  | "unlinked_account";

const NEW_FAMILY_WINDOW_MS = 5 * 60 * 1000;

export function classifySignupAttribution({
  userCreatedAt,
  familyCreatedAt,
  sandbox,
  deletedFamilyOnly = false,
  internalFixture = false,
}: {
  userCreatedAt: string;
  familyCreatedAt: string | null;
  sandbox: boolean;
  /** An old deleted family is history, never current signup abandonment. */
  deletedFamilyOnly?: boolean;
  /** Reserved non-deliverable fixture accounts are never customer demand. */
  internalFixture?: boolean;
}): SignupAttribution {
  if (familyCreatedAt === null && deletedFamilyOnly) return "deleted_family";
  if (familyCreatedAt === null && internalFixture) return "internal_fixture";
  if (!familyCreatedAt) return "unlinked_account";
  if (sandbox) return "sandbox_family";

  const createdGap = Math.abs(Date.parse(familyCreatedAt) - Date.parse(userCreatedAt));
  return createdGap <= NEW_FAMILY_WINDOW_MS ? "new_family" : "existing_family";
}
