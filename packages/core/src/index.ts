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
  emitEvent,
  type EventName,
  type EventProps,
  type EventSink,
} from "./events";

export { US_STATES, type UsStateCode } from "./us-states";

export { formatUsPhone, normalizeUsPhoneE164 } from "./phone";

export {
  ageInMonths,
  ageLabel,
  CAPTURE_MAX_MONTHS,
  isInScoredRange,
  isValidBirthDate,
  MONTHS_AHEAD_CAP,
  SCORED_MAX_MONTHS,
  SCORED_MIN_MONTHS,
} from "./map/bands";

export {
  DEEP_DIVE_CAP,
  getMapDomain,
  getMapItem,
  growingActivityFor,
  ladderRungs,
  MAP_ANSWERS,
  MAP_BANK_VERSION,
  MAP_DOMAINS,
  MAP_SOURCES,
  nextDeepDiveItem,
  planQuestions,
  type LadderRung,
  type MapAnswer,
  type MapDomain,
  type MapItem,
  type MapQuestionPlan,
} from "./map/bank";

export { reportStaleness, type ReportStaleness } from "./map/staleness";

export {
  buildFourWeekPlan,
  type FourWeekPlan,
  type PlanContext,
  type PlanWeek,
} from "./map/plans";

export {
  AHEAD_THRESHOLD_MONTHS,
  maxQuestionsForAge,
  scoreMap,
  type DomainScore,
  type MapAnswerInput,
  type MapPosition,
  type MapScores,
} from "./map/scoring";

export {
  domainLine,
  homaNote,
  reportEmailPreview,
  reportEmailSubject,
  reportSubtitle,
  tryHeading,
  type DomainLine,
} from "./map/sentences";

export { BANNED_WORDS, EM_DASH, GENDERED_PRONOUNS } from "./map/copy-laws";

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
  mapPlanConsentSchema,
  mapPlanProgressSchema,
  mapReportCorrectionSchema,
  mapResumeRequestSchema,
  mapScoreRequestSchema,
  mapSignupSchema,
  mapStartSchema,
  type MapAnswerPayload,
  type MapChildExtras,
  type MapChildInput,
  type MapClaimInput,
  type MapFamilyExtras,
  type MapPlanConsent,
  type MapPlanProgress,
  type MapReportCorrection,
  type MapSignupInput,
  type MapStartInput,
} from "./map/schemas";
