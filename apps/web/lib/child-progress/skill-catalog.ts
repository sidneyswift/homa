import { MAP_SUBJECTS, taxonomyScorableItems } from "@homa/core";

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
  // One abilities catalog (founder ruling 2026-07-21): the assessable
  // taxonomy topics carry a typical age too, so the model can name them
  // and they score like any other ability. Before this the model could
  // only see 225 of roughly 1,600 abilities, so everything outside the
  // bank was invisible no matter how plainly a parent described it.
  for (const { subject, item } of taxonomyScorableItems()) {
    skills.push({
      itemId: item.id,
      subjectId: subject.id,
      subjectName: subject.displayName,
      statement: item.statement,
      typicalMonths: item.typicalMonths,
    });
  }
  return skills;
}

export const SKILL_CATALOG: readonly CatalogSkill[] = buildCatalog();

export const SKILL_CATALOG_BY_ID: ReadonlyMap<string, CatalogSkill> = new Map(
  SKILL_CATALOG.map((skill) => [skill.itemId, skill]),
);

/** The validator applies this ceiling separately to each child's actual age. */
const CATALOG_MONTHS_ABOVE = 24;

/**
 * Offer every catalog line the validator could accept for any child in the
 * authenticated roster. Do not round ages down or remove early abilities:
 * a parent can confirm an earlier skill at any age. Contextual capture #1099
 * exposed both the year-bucket upper gap and the oldest-child lower cutoff.
 * This is exact age eligibility, never language interpretation or a lexical
 * shortlist. The validator still checks the proposed child's own +24 limit.
 */
export function renderSkillCatalog(ages?: number | readonly number[]): string {
  const values = ages === undefined ? undefined : typeof ages === "number" ? [ages] : ages;
  if (values?.some((age) => !Number.isSafeInteger(age) || age < 0)) {
    throw new Error("Skill catalog requires actual nonnegative whole-month ages.");
  }
  if (values?.length === 0) return "";
  const ceiling = values === undefined ? undefined : Math.max(...values) + CATALOG_MONTHS_ABOVE;
  const inBand = (skill: CatalogSkill): boolean => ceiling === undefined || skill.typicalMonths <= ceiling;
  const bySubject = new Map<string, CatalogSkill[]>();
  for (const skill of SKILL_CATALOG.filter(inBand)) {
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
