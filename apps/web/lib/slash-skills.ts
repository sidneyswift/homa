import {
  bankSkillMatchesChildren,
  childTargetingInfo,
  FAMILY_SKILLS_MAX_COUNT,
  mergeSkillRows,
  type BankSkillRow,
} from "./agent-skills";
import { ageInMonths } from "./child-age";
import type { ChildRecord } from "./family";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * The chat composer's "/" menu needs the same advertised skill set the
 * agent sees each turn (agent/skills/skill-library.ts): the family's own
 * saved skills merged with the published bank rows that target their
 * kids. Same reads, same targeting helpers, same precedence, but name +
 * description only; the markdown stays server-side where the agent reads
 * it, never in the page payload.
 */

export interface SlashSkillItem {
  name: string;
  description: string;
}

/** The agent's folder skills (apps/web/agent/skills/<name>/SKILL.md),
 * listed by hand: they ship with the app, so the menu should offer them
 * to every family. Keep names in sync with that folder. */
const BUILT_IN_SKILLS: SlashSkillItem[] = [
  {
    name: "materials-studio",
    description: "Worksheets, coloring pages, flash cards, and other printables.",
  },
];

export async function getSlashMenuSkills(
  children: ChildRecord[],
): Promise<SlashSkillItem[]> {
  const supabase = await createSupabaseServerClient();
  try {
    const [familyResult, bankResult] = await Promise.all([
      supabase
        .from("family_skills")
        .select("name, description, markdown")
        .order("created_at", { ascending: true })
        .limit(FAMILY_SKILLS_MAX_COUNT),
      supabase
        .from("skill_bank")
        .select("name, description, markdown, min_age_months, max_age_months, tags")
        .eq("published", true)
        .limit(100),
    ]);
    if (familyResult.error || bankResult.error) return [];

    const now = new Date();
    const targeting = children.map((child) =>
      childTargetingInfo(ageInMonths(child.birth_month, now), child.profile),
    );
    const bankRows = ((bankResult.data ?? []) as BankSkillRow[]).filter((row) =>
      bankSkillMatchesChildren(row, targeting),
    );

    const merged = mergeSkillRows(familyResult.data ?? [], bankRows).map((row) => ({
      name: row.name,
      description: row.description,
    }));
    // Built-ins lead the menu; a saved skill sharing a name wins, the
    // same precedence the resolver gives family rows over the bank.
    const mergedNames = new Set(merged.map((row) => row.name));
    return [
      ...BUILT_IN_SKILLS.filter((skill) => !mergedNames.has(skill.name)),
      ...merged,
    ];
  } catch {
    // The menu is a convenience; chat works without it (skill-library's
    // failure posture, applied to the composer).
    return BUILT_IN_SKILLS;
  }
}
