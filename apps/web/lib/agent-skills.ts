/**
 * Historical targeting/merge invariants for the retired family-skill
 * library (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md).
 * public.family_skills and public.skill_bank are preserved as dormant data;
 * no runtime code reads or writes them anymore. This file stays, unused by
 * product code, only so scripts/skills-targeting-check.mjs keeps exercising
 * the merge/targeting logic as a regression guard through Phase C; both
 * are retired together once the dormant window closes.
 */

export interface FamilySkillRow {
  id: string;
  name: string;
  description: string;
  markdown: string;
  source: string;
  created_at: string;
}

/** A published row from the shared skills bank (migration #15). */
export interface BankSkillRow {
  name: string;
  description: string;
  markdown: string;
  min_age_months: number | null;
  max_age_months: number | null;
  tags: string[];
}

/** What targeting needs to know about one child. */
export interface ChildTargetingInfo {
  ageMonths: number;
  /** Lowercased focus + interests text, the capability haystack. */
  haystack: string;
}

/** Advertised list is one description line per skill per turn; the count
 *  cap keeps that surface bounded no matter how enthusiastic the family. */
export const FAMILY_SKILLS_MAX_COUNT = 20;

/** Mirrors the DB check constraints (migration #14). */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;
export const SKILL_DESCRIPTION_MAX_CHARS = 200;
export const SKILL_MARKDOWN_MAX_CHARS = 6000;

export function childTargetingInfo(
  ageMonths: number,
  profile: { interests?: string[]; focus?: string } | null,
): ChildTargetingInfo {
  const parts = [profile?.focus ?? "", ...(profile?.interests ?? [])];
  return { ageMonths, haystack: parts.join(" ").toLowerCase() };
}

/**
 * bankSkillMatchesChildren(skill, children): boolean
 * A bank skill advertises to a family when at least one child passes every
 * gate the skill sets: inside the age band (when set) AND matching a
 * capability tag (when set). Both gates on the SAME child on purpose: a
 * letter-sounds skill banded 3 to 7 should not load because a teen's focus
 * mentions letters. A skill with no gates is general and always advertises.
 * Tags are lowercase stems ("letter", "count") substring-matched against
 * the child's focus + interests text.
 */
export function bankSkillMatchesChildren(
  skill: Pick<BankSkillRow, "min_age_months" | "max_age_months" | "tags">,
  children: ChildTargetingInfo[],
): boolean {
  const hasAgeGate = skill.min_age_months !== null || skill.max_age_months !== null;
  const hasTagGate = skill.tags.length > 0;
  if (!hasAgeGate && !hasTagGate) return true;

  return children.some((child) => {
    if (hasAgeGate) {
      if (skill.min_age_months !== null && child.ageMonths < skill.min_age_months) return false;
      if (skill.max_age_months !== null && child.ageMonths > skill.max_age_months) return false;
    }
    if (hasTagGate) {
      const tagHit = skill.tags.some((tag) =>
        child.haystack.includes(tag.toLowerCase()),
      );
      if (!tagHit) return false;
    }
    return true;
  });
}

/**
 * mergeSkillRows(familyRows, bankRows): the advertised set. A family skill
 * sharing a bank skill's name overrides it for that family only, which is
 * the intended personalization behavior; distinct names union.
 */
export function mergeSkillRows(
  familyRows: Pick<FamilySkillRow, "name" | "description" | "markdown">[],
  bankRows: Pick<BankSkillRow, "name" | "description" | "markdown">[],
): { name: string; description: string; markdown: string }[] {
  const familyNames = new Set(familyRows.map((row) => row.name));
  return [
    ...familyRows,
    ...bankRows.filter((row) => !familyNames.has(row.name)),
  ].map(({ name, description, markdown }) => ({ name, description, markdown }));
}
