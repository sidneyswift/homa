export {
  KID_AGE_BANDS,
  KID_AGE_BAND_LABELS,
  KID_COUNT_MAX,
  WAITLIST_SOURCES,
  waitlistSubmissionSchema,
  type KidAgeBand,
  type WaitlistSource,
  type WaitlistSubmission,
} from "./waitlist";

export {
  EVENT_SCHEMAS,
  WALL_DOORS,
  emitEvent,
  type EventName,
  type EventProps,
  type EventSink,
  type WallDoor,
} from "./events";

export { US_STATES, type UsStateCode } from "./us-states";

export { formatUsPhone, normalizeUsPhoneE164 } from "./phone";

export {
  ageInMonths,
  ageLabel,
  aheadCapForAge,
  isInScoredRange,
  isValidBirthDate,
  MONTHS_AHEAD_CAP,
  SCORED_MAX_MONTHS,
  SCORED_MIN_MONTHS,
} from "./map/bands";

export {
  CORE_SUBJECT_IDS,
  CORE_LADDER_RUNGS,
  DEEP_DIVE_CAP,
  getMapSubject,
  getMapItem,
  MAX_LADDER_RUNGS,
  growingActivityFor,
  MAP_ANSWERS,
  MAP_BANK_VERSION,
  MAP_SUBJECTS,
  MAP_SOURCES,
  cdcChecklistUrl,
  nextDeepDiveItem,
  planQuestions,
  type LadderRung,
  type MapAnswer,
  type MapSubject,
  type MapItem,
  type MapQuestionPlan,
} from "./map/bank";

export { PERSONALIZATION_EXCEPTION_IDS, personalizeStatement } from "./map/personalize";

export { reportStaleness, type ReportStaleness } from "./map/staleness";

export {
  buildFourWeekPlan,
  buildMonthPlan,
  MONTH_PLAN_SUBJECT,
  type FourWeekPlan,
  type PlanContext,
  type PlanWeek,
} from "./map/plans";

export {
  maxQuestionsForAge,
  scoreMap,
  type SubjectScore,
  type MapAnswerInput,
  type MapPosition,
  type MapScores,
} from "./map/scoring";

export {
  buildMapQuestionQueue,
  isMapChecklistComplete,
  type MapQueueEntry,
} from "./map/question-queue";

export {
  subjectLine,
  homaNote,
  noteGreeting,
  notePlanSentence,
  reportEmailPreview,
  reportEmailSubject,
  type SubjectLine,
} from "./map/sentences";

export { BANNED_WORDS, EM_DASH, GENDERED_PRONOUNS } from "./map/copy-laws";
export { BANK_ITEM_DOMAINS } from "./map/item-domains";

export type {
  Curriculum,
  CurriculumSubject,
  CurriculumWeek,
} from "./map/curriculum";

export {
  validateCurriculum,
  type CurriculumGateVerdict,
} from "./map/curriculum-gate";

export {
  type NarrativeMeta,
  type PlanNarrative,
  type ReportNarrative,
} from "./map/narrative";

export {
  NARRATIVE_LENGTH_CAPS,
  validateNarrative,
  validatePlanNarrative,
  type NarrativeGateContext,
  type NarrativeVerdicts,
} from "./map/narrative-gate";

export {
  HOMESCHOOL_STYLES,
  MAP_INTERESTS_CAP,
  MAP_KID_CAP,
  mapAnswerSchema,
  mapChildExtrasSchema,
  mapChildRemoveSchema,
  mapChildSchema,
  mapClaimSchema,
  mapExtrasSchema,
  mapFamilyExtrasSchema,
  mapFamilySetupSchema,
  mapPlanConsentSchema,
  mapPlanProgressSchema,
  mapReportCorrectionSchema,
  mapResumeRequestSchema,
  mapScoreRequestSchema,
  mapStartSchema,
  type MapAnswerPayload,
  type MapChildExtras,
  type MapChildInput,
  type MapClaimInput,
  type MapFamilyExtras,
  type MapFamilySetupInput,
  type MapPlanConsent,
  type MapPlanProgress,
  type MapReportCorrection,
  type MapStartInput,
} from "./map/schemas";
