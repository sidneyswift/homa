/**
 * The chat composer's "/" menu, restricted to parent-invocable repo
 * packages. Filesystem-first fleet skills
 * (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md):
 * there is no per-family or founder-curated runtime skill source anymore,
 * so this menu is a static list, name + description only. Keep it in sync
 * with apps/web/agent/skills/<name>/SKILL.md by hand; scripts/fleet-skills-check.mts
 * enforces that every entry here resolves to a discovered package.
 *
 * Dispatch-only packages (research-brief) are deliberately absent: a parent
 * never invokes those on purpose, so they never belong in this menu.
 */

export interface SlashSkillItem {
  name: string;
  description: string;
}

export const BUILT_IN_SKILLS: SlashSkillItem[] = [
  {
    name: "materials-studio",
    description: "Worksheets, coloring pages, flash cards, and other printables.",
  },
];

export async function getSlashMenuSkills(): Promise<SlashSkillItem[]> {
  return BUILT_IN_SKILLS;
}
