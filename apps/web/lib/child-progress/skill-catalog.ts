import { MAP_SUBJECTS } from "@homa/core";

/**
 * The skill catalog the extraction model chooses from (AGENTS.md
 * "Models judge, code verifies").
 *
 * The whole bank goes to the model, deliberately. An earlier design
 * narrowed the options with a lexical pre-filter, which reintroduced
 * exactly the recall failure the model is here to fix: whatever the
 * matcher could not find, the model never got to consider. The bank is
 * roughly 225 short statements, a few thousand tokens, so passing all
 * of it costs less than one wrong answer.
 */

export interface CatalogSkill {
  itemId: string;
  subjectId: string;
  subjectName: string;
  statement: string;
  /** Age in months by which this is typical: the scoring anchor and the
   *  basis for the deterministic age-plausibility check. */
  typicalMonths: number;
}

function buildCatalog(): CatalogSkill[] {
  const skills: CatalogSkill[] = [];
  for (const subject of MAP_SUBJECTS) {
    for (const item of subject.items) {
      skills.push({
        itemId: item.id,
        subjectId: subject.id,
        subjectName: subject.displayName,
        statement: item.statement,
        typicalMonths: item.typicalMonths,
      });
    }
  }
  return skills;
}

export const SKILL_CATALOG: readonly CatalogSkill[] = buildCatalog();

export const SKILL_CATALOG_BY_ID: ReadonlyMap<string, CatalogSkill> = new Map(
  SKILL_CATALOG.map((skill) => [skill.itemId, skill]),
);

/**
 * The catalog as the model reads it: grouped by subject, one line per
 * skill, with the typical age so the model can prefer the rung that
 * actually fits the child instead of the nearest words.
 */
export function renderSkillCatalog(): string {
  const bySubject = new Map<string, CatalogSkill[]>();
  for (const skill of SKILL_CATALOG) {
    const group = bySubject.get(skill.subjectName) ?? [];
    group.push(skill);
    bySubject.set(skill.subjectName, group);
  }
  const sections: string[] = [];
  for (const [subjectName, skills] of bySubject) {
    const lines = skills
      .slice()
      .sort((left, right) => left.typicalMonths - right.typicalMonths)
      .map(
        (skill) =>
          `  ${skill.itemId} (typical by ${skill.typicalMonths} months): ` +
          skill.statement,
      );
    sections.push(`${subjectName}\n${lines.join("\n")}`);
  }
  return sections.join("\n\n");
}
