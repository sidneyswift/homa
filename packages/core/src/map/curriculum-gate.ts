import { BANNED_WORDS, EM_DASH } from "./copy-laws";
import type { Curriculum } from "./curriculum";

/**
 * Brand-law gate for the LLM-authored curriculum, same laws as the
 * report narrative gate (map/narrative-gate.ts) minus that gate's
 * numeric-citation enforcement: a curriculum inherently proposes NEW
 * activities and materials, it does not restate computed facts, so there
 * is no fixed number allow-list to check content against. What still
 * applies unconditionally: no em dash, no deficit/diagnosis vocabulary
 * (BUILD.md law #4, #6, #7).
 */

export interface CurriculumGateVerdict {
  ok: boolean;
  /** Field paths that failed, e.g. "subjects[0].approach". */
  violations: string[];
}

function checkText(label: string, text: string, violations: string[]): void {
  if (EM_DASH.test(text)) violations.push(`${label} (em dash)`);
  if (BANNED_WORDS.test(text)) violations.push(`${label} (banned word)`);
}

export function validateCurriculum(curriculum: Curriculum): CurriculumGateVerdict {
  const violations: string[] = [];

  checkText("title", curriculum.title, violations);
  checkText("overview", curriculum.overview, violations);
  checkText("parentNote", curriculum.parentNote, violations);
  for (const item of curriculum.materialsList) {
    checkText("materialsList item", item, violations);
  }

  curriculum.subjects.forEach((subject, subjectIndex) => {
    checkText(`subjects[${subjectIndex}].subjectName`, subject.subjectName, violations);
    checkText(`subjects[${subjectIndex}].approach`, subject.approach, violations);
    subject.weeks.forEach((week, weekIndex) => {
      const prefix = `subjects[${subjectIndex}].weeks[${weekIndex}]`;
      checkText(`${prefix}.theme`, week.theme, violations);
      checkText(`${prefix}.focus`, week.focus, violations);
      week.activities.forEach((activity, activityIndex) =>
        checkText(`${prefix}.activities[${activityIndex}]`, activity, violations),
      );
      week.materials.forEach((material, materialIndex) =>
        checkText(`${prefix}.materials[${materialIndex}]`, material, violations),
      );
    });
  });

  return { ok: violations.length === 0, violations };
}
