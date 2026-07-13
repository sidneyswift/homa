import { HOMESCHOOL_STYLES } from "@homa/core";

/**
 * Display labels for the homeschool style values, shared by the
 * onboarding homeschool step and the settings how-you-homeschool
 * editor so the two surfaces never drift.
 */
export const HOMESCHOOL_STYLE_LABELS: Record<(typeof HOMESCHOOL_STYLES)[number], string> = {
  montessori: "Montessori",
  charlotte_mason: "Charlotte Mason",
  classical: "Classical",
  reggio: "Reggio",
  waldorf: "Waldorf",
  unit_studies: "Unit studies",
  unschooling: "Unschooling",
  eclectic: "Eclectic (a bit of everything)",
  traditional: "Traditional",
};

/** Label for a stored style value; unknown values render as themselves. */
export function homeschoolStyleLabel(value: string): string {
  return (HOMESCHOOL_STYLE_LABELS as Record<string, string>)[value] ?? value;
}

export const STRICTNESS_LABELS: Record<string, string> = {
  closely: "pretty closely",
  loosely: "loosely",
  exploring: "just exploring it",
};
