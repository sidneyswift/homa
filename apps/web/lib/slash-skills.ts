import {
  loadSkillLibraryCaller,
  resolveAdvertisedSkillRows,
} from "./agent-skills-store";
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

export async function getSlashMenuSkills(familyId: string | null): Promise<SlashSkillItem[]> {
  if (!familyId) return BUILT_IN_SKILLS;

  const supabase = await createSupabaseServerClient();
  try {
    const rows = await loadSkillLibraryCaller(supabase, familyId);
    if (!rows) return BUILT_IN_SKILLS;

    const merged = resolveAdvertisedSkillRows(rows).map((row) => ({
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
