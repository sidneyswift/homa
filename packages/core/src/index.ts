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

export { ACTION_COSTS } from "./action-costs";

export {
  CHILD_PROGRESS_PROJECTION_VERSION,
  childProgressViewSchema,
  parseChildProgressView,
  progressEvidenceAnswerSchema,
  progressSourceKindSchema,
  type ChildProgressView,
  type OpenProgressConflictView,
  type ProgressConflictAdultAnswerView,
  type ProgressDomainView,
  type ProgressEvidenceAnswer,
  type ProgressEvidenceSourceView,
  type ProgressSourceKind,
  type ProgressSubjectSummary,
  type ProgressSubjectView,
  type ProgressTopicView,
} from "./child-progress-view";

export { parseOffsetIsoTimestampEpochNanoseconds } from "./offset-timestamp";

export {
  ACTIVE_OBJECT_CURRENT_VERSION,
  ACTIVE_OBJECT_KINDS,
  activeObjectKey,
  activeObjectReferenceSchema,
  parseActiveObjectReference,
  type ActiveObjectKind,
  type ActiveObjectReference,
} from "./active-object";

export {
  APPLE_PRODUCT_IDS,
  APPLE_PROVIDER_PRODUCTS,
  BILLING_PERIODS,
  BILLING_PROVIDERS,
  GOOGLE_PROVIDER_PRODUCTS,
  HOMA_PLANS,
  PLAN_TIERS,
  isBillingPeriod,
  isBillingProvider,
  isPlanTier,
  planDefinition,
  providerProduct,
  weeklyEquivalentUsd,
  type BillingPeriod,
  type BillingProvider,
  type PlanDefinition,
  type PlanTier,
  type ProviderProduct,
} from "./billing-catalog";

export {
  EVENT_SCHEMAS,
  MAP_FLOW_STEPS,
  MOBILE_BOOTSTRAP_FAILURE_REASONS,
  MOBILE_BOOTSTRAP_STAGES,
  PLANNER_EVENT_CLIENTS,
  PLANNER_EVENT_SURFACES,
  PLANNER_OFFER_VENUES,
  WALL_DOORS,
  emitEvent,
  type EventName,
  type EventProps,
  type EventSink,
  type MapFlowStep,
  type MobileBootstrapFailureReason,
  type MobileBootstrapStage,
  type PlannerEventClient,
  type PlannerEventSurface,
  type WallDoor,
} from "./events";

export { US_STATES, type UsStateCode } from "./us-states";

export { formatUsPhone, normalizeUsPhoneE164 } from "./phone";

export {
  DIRECTIVE_NAMESPACE,
  formatHiddenDirective,
  hasVisibleText,
  isHiddenDirective,
  parseHiddenDirective,
  type DirectiveName,
  type HiddenDirective,
} from "./hidden-directives";

export {
  ageInMonths,
  ageLabel,
  aheadCapForAge,
  isInScoredRange,
  isValidBirthDate,
  MONTHS_AHEAD_CAP,
  RESEARCH_STAGES,
  SCORED_MAX_MONTHS,
  SCORED_MIN_MONTHS,
  stageForAgeMonths,
  type ResearchStage,
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

export {
  getScorableItem,
  isTaxonomyScorable,
  taxonomyScorableItems,
} from "./map/scorable";
export { PERSONALIZATION_EXCEPTION_IDS, personalizeStatement } from "./map/personalize";

export { reportStaleness, type ReportStaleness } from "./map/staleness";

export {
  selectSubjectLessonTarget,
  selectSubjectPlanTargets,
  type SubjectLessonTarget,
} from "./map/lesson-target";

export {
  blendTypicalWithAnswers,
  buildAgeTemplatePlan,
  buildFourWeekPlan,
  buildMonthPlan,
  MONTH_PLAN_SUBJECT,
  typicalAnswersForAge,
  type FourWeekPlan,
  type PlanContext,
  type PlanWeek,
} from "./map/plans";

export {
  MAP_SCORER_VERSION,
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
  freeReportSubjects,
  lockedReportSubjects,
  REPORT_LOCK_CORE_SUBJECTS,
  REPORT_LOCK_FREE_COUNT,
} from "./map/report-lock";

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
export {
  findOutboundChildFramingCandidate,
  OUTBOUND_CHILD_FRAMING_FALLBACK,
  protectOutboundChildFraming,
  visibleOutboundChildFramingText,
  type OutboundChildFramingChannel,
  type OutboundChildFramingResult,
} from "./outbound-child-framing";
export {
  BANK_ITEM_DOMAINS,
  domainForBankItem,
} from "./map/item-domains";

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
  mapSubjectLessonBuildSchema,
  mapSubjectLessonMutationSchema,
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
