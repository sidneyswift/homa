/**
 * Derived lifecycle stages for the founder console (MJ-14). families.status
 * exists but app code almost never writes it (blind spot 3 in the
 * 2026-07-12 founder-dashboard lab), so stage is computed from timestamps
 * that ARE maintained: profile_completed_at, children rows,
 * child_reports.generated_at, and the last user-authored
 * conversation_messages row. Pure function so pnpm check:admin covers it.
 */

export type FamilyStage = "new" | "onboarding" | "activated" | "steady" | "quiet";

export interface StageInputs {
  createdAt: Date;
  profileCompletedAt: Date | null;
  childCount: number;
  hasReport: boolean;
  lastUserActivityAt: Date | null;
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const QUIET_AFTER_DAYS = 14;
const ACTIVATED_WINDOW_DAYS = 21;

/**
 * deriveFamilyStage(inputs): FamilyStage
 * Order matters: an unfinished setup is "new" whatever its age; a family
 * that finished setup but went silent for 14+ days is "quiet" (the call
 * list) even when the report never happened; otherwise the report and
 * signup age split onboarding / activated / steady.
 */
export function deriveFamilyStage(inputs: StageInputs): FamilyStage {
  const ageDays = (inputs.now.getTime() - inputs.createdAt.getTime()) / DAY_MS;
  const quietDays = inputs.lastUserActivityAt
    ? (inputs.now.getTime() - inputs.lastUserActivityAt.getTime()) / DAY_MS
    : ageDays;

  if (!inputs.profileCompletedAt || inputs.childCount === 0) return "new";
  if (ageDays >= QUIET_AFTER_DAYS && quietDays >= QUIET_AFTER_DAYS) return "quiet";
  if (!inputs.hasReport) return "onboarding";
  return ageDays <= ACTIVATED_WINDOW_DAYS ? "activated" : "steady";
}

/** Console vocabulary and tone per stage. Quiet is a call list, never a
 * "behind" list; no danger tone exists here on purpose (house rule). The
 * hint spells out what the derived stage actually means, because the
 * label alone reads as a mystery ("Onboarding since when? stuck where?"),
 * founder ask 2026-07-14. */
export const STAGE_COPY: Record<
  FamilyStage,
  { label: string; tone: "sky" | "gold" | "sage" | "stone" | "outline"; hint: string }
> = {
  new: { label: "New", tone: "sky", hint: "Signed up; family setup or kids not finished yet" },
  onboarding: {
    label: "Onboarding",
    tone: "gold",
    hint: "Setup and kids done; no report generated yet. The kid rows below show how far the questions got.",
  },
  activated: { label: "Activated", tone: "sage", hint: "First report generated within 21 days of signup" },
  steady: { label: "Steady", tone: "stone", hint: "Has a report; more than 21 days since signup" },
  quiet: { label: "Quiet 14d+", tone: "outline", hint: "Nothing heard from the family in 14+ days" },
};

export const STAGE_ORDER: FamilyStage[] = ["new", "onboarding", "quiet", "activated", "steady"];
