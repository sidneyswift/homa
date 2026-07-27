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

/**
 * How far below a child's age the catalog still reaches. Confirming a
 * much earlier rung is ordinary corroboration, so the floor is
 * generous; it exists only to keep a 9-year-old's prompt from carrying
 * toddler abilities.
 */
const CATALOG_MONTHS_BELOW = 60;
/**
 * How far above. Matches claim-validation's age-plausibility ceiling:
 * showing the model abilities the gate would reject anyway only invites
 * rejected claims.
 */
const CATALOG_MONTHS_ABOVE = 24;
/**
 * Age is bucketed to whole years before scoping so children of the same
 * age share one catalog string, which keeps the prompt cacheable across
 * families instead of minting a unique catalog per child.
 */
const CATALOG_BUCKET_MONTHS = 12;

/**
 * The catalog as the model reads it: grouped by subject, one line per
 * skill, with the typical age so the model can prefer the rung that
 * actually fits the child instead of the nearest words.
 *
 * Scoped to the child's age band. This is NOT the lexical pre-filtering
 * AGENTS.md warns about: nothing here reads the parent's words, so no
 * phrasing can be filtered out of consideration. It is the same age
 * rule the deterministic gate applies afterwards, moved earlier so the
 * prompt stays affordable (the full catalog is ~1,576 abilities and
 * ~144k characters).
 */
export function renderSkillCatalog(ageMonths?: number): string {
  const bucket =
    ageMonths === undefined
      ? undefined
      : Math.floor(ageMonths / CATALOG_BUCKET_MONTHS) * CATALOG_BUCKET_MONTHS;
  const inBand = (skill: CatalogSkill): boolean =>
    bucket === undefined ||
    (skill.typicalMonths >= bucket - CATALOG_MONTHS_BELOW &&
      skill.typicalMonths <= bucket + CATALOG_MONTHS_ABOVE);
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
