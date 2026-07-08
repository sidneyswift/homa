/**
 * The "Call Homa" curriculum (founder decision 2026-07-07, build-log):
 * LLM-authored and richer than the deterministic four-week plan
 * (packages/core/src/map/plans.ts, "the curriculum" per the 2026-07-06
 * founder ruling), whatever length Homa judges the family needs after a
 * voice call. The two coexist on purpose: the four-week plan is the fast,
 * deterministic, zero-model on-ramp from the report page; this is the
 * deeper, conversational, LLM-authored artifact from an actual call.
 */

export interface CurriculumWeek {
  theme: string;
  focus: string;
  /** 2 to 4 concrete, doable activities. */
  activities: string[];
  /** Anything this specific week needs beyond the consolidated list. */
  materials: string[];
}

export interface CurriculumSubject {
  subjectName: string;
  /** A short paragraph: why this approach, tied to what was actually
   * discussed on the call, never a fabricated observation. */
  approach: string;
  weeks: CurriculumWeek[];
}

export interface Curriculum {
  title: string;
  /** Homa's own plain-language call on scope: "4 weeks", "6 weeks",
   * "this season". Never a fixed constant. */
  durationLabel: string;
  overview: string;
  subjects: CurriculumSubject[];
  /** Consolidated shopping/prep list across every subject. */
  materialsList: string[];
  parentNote: string;
}
