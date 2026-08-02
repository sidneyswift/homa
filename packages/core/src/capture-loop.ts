import { z } from "zod";

/**
 * The cross-surface product loop contract. One canonical event name keeps
 * web and native analytics compatible while the stage enum carries the
 * lifecycle meaning. Domain events remain the authoritative operational
 * receipts for the effect itself.
 */
export const CAPTURE_LOOP_CONTRACT_VERSION = 1 as const;
export const CAPTURE_LOOP_EVENT_NAMES = [
  "product.loop_stage_recorded",
] as const;
export const CAPTURE_LOOP_EVENT_NAME = CAPTURE_LOOP_EVENT_NAMES[0];

export const CAPTURE_LOOP_STAGES = [
  "entry_intent",
  "capture_accepted",
  "proposal_ready",
  "review_presented",
  "approval_recorded",
  "effect_attempted",
  "outcome_verified",
  "correction_or_undo_verified",
  "safe_abandonment",
  "interrupted",
  "resumed",
  "failed_before_effect",
  "rollback_verified",
  "outcome_uncertain",
] as const;
export type CaptureLoopStage = (typeof CAPTURE_LOOP_STAGES)[number];

export const CAPTURE_LOOP_PROFILES = [
  "proposed_effect",
  "direct_mutation",
  "device_mutation",
  "device_handoff",
  "capture_confirmation",
  "passive_delivery",
  "background_observation",
] as const;
export type CaptureLoopProfile = (typeof CAPTURE_LOOP_PROFILES)[number];

export const CAPTURE_LOOP_INTENTS = [
  "ask_homa",
  "complete_onboarding",
  "capture_for_later",
  "create_material",
  "print_material",
  "share_material",
  "prepare_day",
  "plan_learning",
  "schedule_learning",
  "complete_learning",
  "record_observation",
  "record_hours",
  "manage_record",
  "open_task_result",
  "correct_or_undo",
] as const;
export type CaptureLoopIntent = (typeof CAPTURE_LOOP_INTENTS)[number];

export const CAPTURE_LOOP_SURFACES = [
  "chat",
  "voice",
  "onboarding",
  "today",
  "planner",
  "calendar_export",
  "material_card",
  "material_detail",
  "binder",
  "progress",
  "hours",
  "tasks",
  "notification",
  "background",
] as const;
export type CaptureLoopSurface = (typeof CAPTURE_LOOP_SURFACES)[number];

export const CAPTURE_LOOP_BRANCH_SCOPES = [
  "family",
  "single_child",
  "multiple_children",
  "multi_child_aggregate",
] as const;
export type CaptureLoopBranchScope =
  (typeof CAPTURE_LOOP_BRANCH_SCOPES)[number];

export const CAPTURE_LOOP_OBJECT_KINDS = [
  "none",
  "conversation",
  "material",
  "plan",
  "plan_activity",
  "family_event",
  "progress_operation",
  "hours_record",
  "compliance_record",
  "task_run",
] as const;
export type CaptureLoopObjectKind =
  (typeof CAPTURE_LOOP_OBJECT_KINDS)[number];

export const CAPTURE_LOOP_OUTCOME_KINDS = [
  "durable_change",
  "artifact_ready",
] as const;
export type CaptureLoopOutcomeKind =
  (typeof CAPTURE_LOOP_OUTCOME_KINDS)[number];

export const CAPTURE_LOOP_RESULT_STATES = [
  "not_applicable",
  "complete",
  "partial",
] as const;
export type CaptureLoopResultState =
  (typeof CAPTURE_LOOP_RESULT_STATES)[number];

export const CAPTURE_LOOP_RECEIPT_KINDS = [
  "none",
  "database_receipt",
  "artifact_receipt",
] as const;
export type CaptureLoopReceiptKind =
  (typeof CAPTURE_LOOP_RECEIPT_KINDS)[number];

export const CAPTURE_LOOP_CORRECTION_RESULTS = [
  "corrected",
  "reversed",
] as const;
export type CaptureLoopCorrectionResult =
  (typeof CAPTURE_LOOP_CORRECTION_RESULTS)[number];

export const CAPTURE_LOOP_EXIT_REASONS = [
  "parent_declined",
  "parent_cancelled",
  "permission_denied",
  "validation_rejected",
  "app_backgrounded",
  "offline",
  "provider_unavailable",
  "timeout",
  "superseded",
  "duplicate",
  "unknown",
] as const;
export type CaptureLoopExitReason =
  (typeof CAPTURE_LOOP_EXIT_REASONS)[number];

const CODE_VERSION_SCHEMA = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._+-]+$/u);
const APP_VERSION_SCHEMA = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u);
const IOS_BUILD_SCHEMA = z
  .string()
  .min(1)
  .max(30)
  .regex(/^[0-9]+(?:\.[0-9]+){0,2}$/u);
const ANDROID_BUILD_SCHEMA = z.string().min(1).max(30).regex(/^[0-9]+$/u);
const EXPO_RUNTIME_FINGERPRINT_SCHEMA = z.string().regex(/^[a-f0-9]{40}$/u);
const UUID_SCHEMA = z.uuid().transform((value) => value.toLowerCase());

/**
 * This is a code identity, never a device identity. Native clients must send
 * Expo's fingerprint-policy runtimeVersion plus the installed app and build
 * versions. update_id is nullable for an embedded launch.
 */
export const captureLoopClientContextSchema = z.discriminatedUnion("client", [
  z
    .object({
      client: z.literal("web"),
      app_version: CODE_VERSION_SCHEMA,
      build_number: z.null(),
      runtime_version: z.null(),
      update_id: z.null(),
    })
    .strict(),
  z
    .object({
      client: z.literal("ios"),
      app_version: APP_VERSION_SCHEMA,
      build_number: IOS_BUILD_SCHEMA,
      runtime_version: EXPO_RUNTIME_FINGERPRINT_SCHEMA,
      update_id: UUID_SCHEMA.nullable(),
    })
    .strict(),
  z
    .object({
      client: z.literal("android"),
      app_version: APP_VERSION_SCHEMA,
      build_number: ANDROID_BUILD_SCHEMA,
      runtime_version: EXPO_RUNTIME_FINGERPRINT_SCHEMA,
      update_id: UUID_SCHEMA.nullable(),
    })
    .strict(),
]);
export type CaptureLoopClientContext = z.infer<
  typeof captureLoopClientContextSchema
>;
export type CaptureLoopNativeClientContext = Extract<
  CaptureLoopClientContext,
  { client: "ios" | "android" }
>;

export interface CaptureLoopNativeReleaseIdentity {
  platform: string;
  appVersion: string | null;
  buildNumber: string | number | null;
  runtimeVersion: string | null;
  updateId: string | null;
}

/**
 * Normalizes Expo's release metadata without reading globals. Keeping this
 * builder pure lets the contract test the actual iOS and Android values while
 * the mobile adapter remains responsible only for gathering them.
 */
export function buildCaptureLoopNativeClientContext(
  identity: CaptureLoopNativeReleaseIdentity,
): CaptureLoopNativeClientContext | null {
  if (
    (identity.platform !== "ios" && identity.platform !== "android") ||
    identity.appVersion === null ||
    identity.buildNumber === null ||
    identity.runtimeVersion === null
  ) {
    return null;
  }

  const parsed = captureLoopClientContextSchema.safeParse({
    client: identity.platform,
    app_version: identity.appVersion,
    build_number: String(identity.buildNumber),
    runtime_version: identity.runtimeVersion,
    update_id: identity.updateId,
  });
  return parsed.success && parsed.data.client !== "web" ? parsed.data : null;
}

const CAPTURE_LOOP_EVENT_FIELDS = {
  contract_version: z.literal(CAPTURE_LOOP_CONTRACT_VERSION),
  event_id: UUID_SCHEMA,
  loop_id: UUID_SCHEMA,
  parent_loop_id: UUID_SCHEMA.nullable(),
  branch_id: UUID_SCHEMA.nullable(),
  branch_scope: z.enum(CAPTURE_LOOP_BRANCH_SCOPES),
  profile: z.enum(CAPTURE_LOOP_PROFILES),
  intent: z.enum(CAPTURE_LOOP_INTENTS),
  stage: z.enum(CAPTURE_LOOP_STAGES),
  sequence: z.number().int().min(1).max(10_000),
  surface: z.enum(CAPTURE_LOOP_SURFACES),
  object_kind: z.enum(CAPTURE_LOOP_OBJECT_KINDS),
  object_id: UUID_SCHEMA.nullable(),
  client_context: captureLoopClientContextSchema,
  outcome_kind: z.enum(CAPTURE_LOOP_OUTCOME_KINDS).nullable(),
  result_state: z.enum(CAPTURE_LOOP_RESULT_STATES),
  receipt_kind: z.enum(CAPTURE_LOOP_RECEIPT_KINDS),
  receipt_id: UUID_SCHEMA.nullable(),
  revision: z.number().int().min(1).max(10_000).nullable(),
  revision_id: UUID_SCHEMA.nullable(),
  corrects_event_id: UUID_SCHEMA.nullable(),
  correction_result: z.enum(CAPTURE_LOOP_CORRECTION_RESULTS).nullable(),
  exit_reason: z.enum(CAPTURE_LOOP_EXIT_REASONS).nullable(),
} as const;

interface CaptureLoopOutcomeRule {
  receipt: CaptureLoopReceiptKind;
  combinations: ReadonlyArray<{
    profile: CaptureLoopProfile;
    intent: CaptureLoopIntent;
    object: CaptureLoopObjectKind;
  }>;
}

function directMutationCombination(
  intent: CaptureLoopIntent,
  object: CaptureLoopObjectKind,
): CaptureLoopOutcomeRule["combinations"][number] {
  return { profile: "direct_mutation", intent, object };
}

const OUTCOME_RULES: Record<CaptureLoopOutcomeKind, CaptureLoopOutcomeRule> = {
  durable_change: {
    receipt: "database_receipt",
    combinations: [
      {
        profile: "proposed_effect",
        intent: "prepare_day",
        object: "plan",
      },
      {
        profile: "proposed_effect",
        intent: "plan_learning",
        object: "plan",
      },
      directMutationCombination("schedule_learning", "plan_activity"),
      directMutationCombination("complete_learning", "progress_operation"),
      directMutationCombination("record_observation", "progress_operation"),
      directMutationCombination("record_hours", "hours_record"),
      {
        profile: "proposed_effect",
        intent: "manage_record",
        object: "compliance_record",
      },
    ],
  },
  artifact_ready: {
    receipt: "artifact_receipt",
    combinations: [
      {
        profile: "proposed_effect",
        intent: "create_material",
        object: "material",
      },
    ],
  },
};

const RECEIPT_OBJECTS: Record<
  Exclude<CaptureLoopReceiptKind, "none">,
  ReadonlySet<CaptureLoopObjectKind>
> = {
  database_receipt: new Set([
    "plan",
    "plan_activity",
    "family_event",
    "progress_operation",
    "hours_record",
    "compliance_record",
    "task_run",
  ]),
  artifact_receipt: new Set(["material"]),
};

const EXIT_STAGES = new Set<CaptureLoopStage>([
  "safe_abandonment",
  "interrupted",
  "failed_before_effect",
  "rollback_verified",
  "outcome_uncertain",
]);

const EXIT_REASONS_BY_STAGE = {
  safe_abandonment: new Set<CaptureLoopExitReason>([
    "parent_declined",
    "parent_cancelled",
  ]),
  interrupted: new Set<CaptureLoopExitReason>([
    "app_backgrounded",
    "offline",
  ]),
  failed_before_effect: new Set<CaptureLoopExitReason>([
    "permission_denied",
    "validation_rejected",
    "offline",
    "provider_unavailable",
    "timeout",
    "superseded",
    "duplicate",
  ]),
  rollback_verified: new Set<CaptureLoopExitReason>([
    "parent_cancelled",
    "validation_rejected",
    "provider_unavailable",
    "timeout",
    "superseded",
  ]),
  outcome_uncertain: new Set<CaptureLoopExitReason>([
    "app_backgrounded",
    "offline",
    "provider_unavailable",
    "timeout",
    "unknown",
  ]),
} as const satisfies Record<
  Extract<
    CaptureLoopStage,
    | "safe_abandonment"
    | "interrupted"
    | "failed_before_effect"
    | "rollback_verified"
    | "outcome_uncertain"
  >,
  ReadonlySet<CaptureLoopExitReason>
>;

const REVISIONED_PROFILES = new Set<CaptureLoopProfile>([
  "proposed_effect",
  "device_mutation",
  "device_handoff",
  "capture_confirmation",
  "passive_delivery",
  "background_observation",
]);

const REVISION_STAGES = new Set<CaptureLoopStage>([
  "proposal_ready",
  "review_presented",
  "approval_recorded",
  "effect_attempted",
  "outcome_verified",
]);

function validateCaptureLoopEvent(
  event: {
    event_id: string;
    loop_id: string;
    profile: CaptureLoopProfile;
    stage: CaptureLoopStage;
    intent: CaptureLoopIntent;
    parent_loop_id: string | null;
    branch_id: string | null;
    branch_scope: CaptureLoopBranchScope;
    object_kind: CaptureLoopObjectKind;
    object_id: string | null;
    client_context: CaptureLoopClientContext;
    outcome_kind: CaptureLoopOutcomeKind | null;
    result_state: CaptureLoopResultState;
    receipt_kind: CaptureLoopReceiptKind;
    receipt_id: string | null;
    revision: number | null;
    revision_id: string | null;
    corrects_event_id: string | null;
    correction_result: CaptureLoopCorrectionResult | null;
    exit_reason: CaptureLoopExitReason | null;
  },
  context: z.RefinementCtx,
): void {
  if (event.event_id === event.loop_id) {
    context.addIssue({
      code: "custom",
      path: ["event_id"],
      message: "event_id and loop_id must identify different records",
    });
  }
  if (event.parent_loop_id === event.loop_id) {
    context.addIssue({
      code: "custom",
      path: ["parent_loop_id"],
      message: "a loop cannot be its own parent",
    });
  }

  const branchNeedsId =
    event.branch_scope === "single_child" ||
    event.branch_scope === "multiple_children";
  if (branchNeedsId !== (event.branch_id !== null)) {
    context.addIssue({
      code: "custom",
      path: ["branch_id"],
      message: "child-scoped branches need one opaque branch id",
    });
  }

  if (event.object_kind === "none" && event.object_id !== null) {
    context.addIssue({
      code: "custom",
      path: ["object_id"],
      message: "object_id must be null when object_kind is none",
    });
  }

  const revisionRequired =
    REVISIONED_PROFILES.has(event.profile) &&
    REVISION_STAGES.has(event.stage);
  if (
    revisionRequired !==
    (event.revision !== null && event.revision_id !== null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["revision"],
      message: revisionRequired
        ? "this lifecycle stage needs the exact proposal revision and id"
        : "this profile or stage cannot claim a proposal revision or id",
    });
  }
  if ((event.revision === null) !== (event.revision_id === null)) {
    context.addIssue({
      code: "custom",
      path: ["revision_id"],
      message: "proposal revision number and id must appear together",
    });
  }

  if (event.stage === "outcome_verified") {
    if (event.object_kind === "none" || event.object_id === null) {
      context.addIssue({
        code: "custom",
        path: ["object_id"],
        message: "a verified outcome needs an authoritative object id",
      });
    }
    if (event.outcome_kind === null) {
      context.addIssue({
        code: "custom",
        path: ["outcome_kind"],
        message: "a verified outcome needs a closed outcome kind",
      });
    } else {
      const rule = OUTCOME_RULES[event.outcome_kind];
      if (
        rule.receipt !== event.receipt_kind ||
        !rule.combinations.some(
          (combination) =>
            combination.profile === event.profile &&
            combination.intent === event.intent &&
            combination.object === event.object_kind,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["outcome_kind"],
          message: "profile, intent, object, outcome, and receipt are incompatible",
        });
      }
    }
    if (event.result_state === "not_applicable") {
      context.addIssue({
        code: "custom",
        path: ["result_state"],
        message: "a verified outcome must declare complete or partial",
      });
    }
    if (
      event.profile === "proposed_effect" &&
      event.intent === "manage_record" &&
      event.object_kind === "compliance_record" &&
      event.revision !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["revision"],
        message: "each approved compliance packet is one exact revision row",
      });
    }
  } else if (event.outcome_kind !== null) {
    context.addIssue({
      code: "custom",
      path: ["outcome_kind"],
      message: "only outcome_verified may carry an outcome kind",
    });
  }
  if (
    event.stage !== "outcome_verified" &&
    event.result_state !== "not_applicable"
  ) {
    context.addIssue({
      code: "custom",
      path: ["result_state"],
      message: "only outcome_verified may declare a result state",
    });
  }

  const receiptStage =
    event.stage === "outcome_verified" ||
    event.stage === "correction_or_undo_verified" ||
    event.stage === "rollback_verified";
  if (!receiptStage && event.receipt_kind !== "none") {
    context.addIssue({
      code: "custom",
      path: ["receipt_kind"],
      message: "this stage cannot carry an effect receipt",
    });
  }
  if (receiptStage !== (event.receipt_id !== null)) {
    context.addIssue({
      code: "custom",
      path: ["receipt_id"],
      message: receiptStage
        ? "a verified receipt stage needs its authoritative receipt id"
        : "only a verified receipt stage may carry a receipt id",
    });
  }

  if (event.stage === "correction_or_undo_verified") {
    if (
      event.intent !== "correct_or_undo" ||
      event.parent_loop_id === null ||
      event.corrects_event_id === null ||
      event.correction_result === null ||
      event.receipt_kind === "none" ||
      event.receipt_id === null ||
      event.object_kind === "none" ||
      event.object_id === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["corrects_event_id"],
        message: "a correction needs its parent loop, prior event, and receipt",
      });
    }
    if (event.corrects_event_id === event.event_id) {
      context.addIssue({
        code: "custom",
        path: ["corrects_event_id"],
        message: "a correction cannot target itself",
      });
    }
    if (
      event.receipt_kind !== "none" &&
      !RECEIPT_OBJECTS[event.receipt_kind].has(event.object_kind)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receipt_kind"],
        message: "the correction receipt cannot verify this object kind",
      });
    }
    const supportedCorrection =
      (event.correction_result === "corrected" &&
        event.receipt_kind === "artifact_receipt" &&
        event.object_kind === "material") ||
      (event.correction_result === "reversed" &&
        event.receipt_kind === "database_receipt" &&
        [
          "progress_operation",
          "plan_activity",
          "hours_record",
        ].includes(event.object_kind));
    if (!supportedCorrection) {
      context.addIssue({
        code: "custom",
        path: ["correction_result"],
        message: "this correction has no deterministic product receipt linkage",
      });
    }
  } else if (
    event.corrects_event_id !== null ||
    event.correction_result !== null
  ) {
    context.addIssue({
      code: "custom",
      path: ["correction_result"],
      message: "only a verified correction may classify a prior outcome",
    });
  }

  if (
    event.stage === "rollback_verified" &&
    (event.receipt_kind === "none" ||
      event.receipt_id === null ||
      event.object_kind === "none" ||
      event.object_id === null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["receipt_kind"],
      message: "a verified rollback needs an authoritative object receipt",
    });
  }
  if (
    event.stage === "rollback_verified" &&
    event.intent === "correct_or_undo"
  ) {
    context.addIssue({
      code: "custom",
      path: ["intent"],
      message: "an undo receipt must be classified as a verified reversal",
    });
  }
  if (
    event.stage === "rollback_verified" &&
    event.receipt_kind !== "none" &&
    !RECEIPT_OBJECTS[event.receipt_kind].has(event.object_kind)
  ) {
    context.addIssue({
      code: "custom",
      path: ["receipt_kind"],
      message: "the rollback receipt cannot verify this object kind",
    });
  }
  if (
    event.stage === "rollback_verified" &&
    (event.receipt_kind !== "database_receipt" ||
      ![
        "progress_operation",
        "plan_activity",
        "family_event",
        "hours_record",
      ].includes(event.object_kind))
  ) {
    context.addIssue({
      code: "custom",
      path: ["receipt_kind"],
      message: "this rollback has no deterministic product receipt linkage",
    });
  }
  if (
    event.stage === "rollback_verified" &&
    !(
      (event.intent === "schedule_learning" &&
        ["plan_activity", "family_event"].includes(event.object_kind)) ||
      (["complete_learning", "record_observation"].includes(event.intent) &&
        event.object_kind === "progress_operation") ||
      (event.intent === "record_hours" && event.object_kind === "hours_record")
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["intent"],
      message: "the rollback intent and object kind are incompatible",
    });
  }

  if (EXIT_STAGES.has(event.stage) !== (event.exit_reason !== null)) {
    context.addIssue({
      code: "custom",
      path: ["exit_reason"],
      message: "exit stages need one closed reason and other stages need none",
    });
  }
  if (
    EXIT_STAGES.has(event.stage) &&
    event.exit_reason !== null &&
    !EXIT_REASONS_BY_STAGE[
      event.stage as keyof typeof EXIT_REASONS_BY_STAGE
    ].has(event.exit_reason)
  ) {
    context.addIssue({
      code: "custom",
      path: ["exit_reason"],
      message: "the exit reason does not prove this lifecycle state",
    });
  }
}

export const captureLoopEventPropsSchema = z
  .object(CAPTURE_LOOP_EVENT_FIELDS)
  .strict()
  .superRefine(validateCaptureLoopEvent);
export type CaptureLoopEventProps = z.infer<
  typeof captureLoopEventPropsSchema
>;

/**
 * The authenticated mobile relay accepts interaction facts, never verified
 * outcomes. A bearer-authenticated app can report that an effect was attempted,
 * but no current native receipt is independently resolvable by Homa's server.
 */
export const nativeCaptureLoopEventPropsSchema =
  captureLoopEventPropsSchema.superRefine((event, context) => {
    if (event.client_context.client === "web") {
      context.addIssue({
        code: "custom",
        path: ["client_context", "client"],
        message: "the native relay requires native release identity",
      });
    }
    if (event.stage === "outcome_verified") {
      context.addIssue({
        code: "custom",
        path: ["stage"],
        message: "native cannot self-certify a verified outcome",
      });
    }
    if (
      (event.stage === "correction_or_undo_verified" ||
        event.stage === "rollback_verified")
    ) {
      context.addIssue({
        code: "custom",
        path: ["stage"],
        message: "native cannot self-certify a corrective receipt",
      });
    }
  });

const CONTROL_STAGES = [
  "safe_abandonment",
  "interrupted",
  "resumed",
  "failed_before_effect",
  "rollback_verified",
  "outcome_uncertain",
  "correction_or_undo_verified",
] as const satisfies ReadonlyArray<CaptureLoopStage>;

export interface CaptureLoopProfileManifest {
  ordered_path: ReadonlyArray<CaptureLoopStage>;
  success_path: ReadonlyArray<CaptureLoopStage> | null;
  allowed_stages: ReadonlyArray<CaptureLoopStage>;
}

function profileManifest(
  successPath: ReadonlyArray<CaptureLoopStage>,
): CaptureLoopProfileManifest {
  return {
    ordered_path: successPath,
    success_path: successPath,
    allowed_stages: [...successPath, ...CONTROL_STAGES],
  };
}

function nonOutcomeProfile(
  orderedPath: ReadonlyArray<CaptureLoopStage>,
): CaptureLoopProfileManifest {
  return {
    ordered_path: orderedPath,
    success_path: null,
    allowed_stages: [...orderedPath, ...CONTROL_STAGES],
  };
}

/**
 * Required success paths are profile-specific. A direct checkbox must not
 * fake a proposal or approval, while a proposed plan must prove the exact
 * revision was presented and approved before the effect.
 */
export const CAPTURE_LOOP_PROFILE_MANIFESTS = {
  proposed_effect: profileManifest([
    "entry_intent",
    "capture_accepted",
    "proposal_ready",
    "review_presented",
    "approval_recorded",
    "effect_attempted",
    "outcome_verified",
  ]),
  direct_mutation: profileManifest([
    "entry_intent",
    "effect_attempted",
    "outcome_verified",
  ]),
  device_mutation: nonOutcomeProfile([
    "entry_intent",
    "review_presented",
    "approval_recorded",
    "effect_attempted",
  ]),
  device_handoff: nonOutcomeProfile([
    "entry_intent",
    "review_presented",
    "approval_recorded",
    "effect_attempted",
  ]),
  capture_confirmation: nonOutcomeProfile([
    "entry_intent",
    "capture_accepted",
    "proposal_ready",
    "review_presented",
    "approval_recorded",
    "effect_attempted",
  ]),
  passive_delivery: nonOutcomeProfile([
    "proposal_ready",
    "effect_attempted",
    "review_presented",
  ]),
  background_observation: nonOutcomeProfile([
    "capture_accepted",
    "proposal_ready",
    "review_presented",
    "approval_recorded",
    "effect_attempted",
  ]),
} as const satisfies Record<CaptureLoopProfile, CaptureLoopProfileManifest>;

const TERMINAL_STAGES = new Set<CaptureLoopStage>([
  "outcome_verified",
  "correction_or_undo_verified",
  "safe_abandonment",
  "failed_before_effect",
  "rollback_verified",
]);

function hasOrderedStages(
  actual: ReadonlyArray<CaptureLoopStage>,
  required: ReadonlyArray<CaptureLoopStage>,
): boolean {
  let cursor = 0;
  for (const stage of actual) {
    if (stage === required[cursor]) cursor += 1;
  }
  return cursor === required.length;
}

function hasOrderedRevisionStages(
  actual: ReadonlyArray<CaptureLoopEventProps>,
  required: ReadonlyArray<CaptureLoopStage>,
  revision: number,
  revisionId: string,
): boolean {
  let cursor = 0;
  for (const event of actual) {
    if (
      event.stage === required[cursor] &&
      event.revision === revision &&
      event.revision_id === revisionId
    ) {
      cursor += 1;
    }
  }
  return cursor === required.length;
}

/**
 * Validates a single loop after sorting by the explicit sequence. Database
 * arrival order is never lifecycle order, and an incomplete trace is not an
 * abandonment. Only a claimed terminal result must prove its whole path.
 */
export function captureLoopTraceIssues(
  rawEvents: ReadonlyArray<unknown>,
): string[] {
  if (rawEvents.length === 0) return ["trace is empty"];

  const events: CaptureLoopEventProps[] = [];
  const issues: string[] = [];
  for (const [index, raw] of rawEvents.entries()) {
    const parsed = captureLoopEventPropsSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`event ${index + 1} does not match the canonical schema`);
      continue;
    }
    events.push(parsed.data);
  }
  if (events.length !== rawEvents.length) return issues;

  const eventIds = new Set<string>();
  const sequences = new Set<number>();
  const first = events[0];
  for (const event of events) {
    if (eventIds.has(event.event_id)) issues.push("event_id is duplicated");
    if (sequences.has(event.sequence)) issues.push("sequence is duplicated");
    eventIds.add(event.event_id);
    sequences.add(event.sequence);
    if (event.loop_id !== first.loop_id) issues.push("trace mixes loop ids");
    if (event.profile !== first.profile) issues.push("trace mixes profiles");
    if (event.intent !== first.intent) issues.push("trace mixes intents");
    if (event.parent_loop_id !== first.parent_loop_id) {
      issues.push("trace mixes parent loop ids");
    }
    if (event.branch_scope !== first.branch_scope) {
      issues.push("trace mixes branch scopes");
    }
    if (event.branch_id !== first.branch_id) {
      issues.push("trace mixes branch ids");
    }
  }

  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  for (const [index, event] of ordered.entries()) {
    if (event.sequence !== index + 1) {
      issues.push("sequence must be contiguous and start at one");
      break;
    }
  }

  let establishedObjectKind: CaptureLoopObjectKind = "none";
  let establishedObjectId: string | null = null;
  for (const event of ordered) {
    if (establishedObjectKind === "none" && event.object_kind !== "none") {
      establishedObjectKind = event.object_kind;
    } else if (
      establishedObjectKind !== "none" &&
      event.object_kind !== establishedObjectKind
    ) {
      issues.push("trace changes object kind");
    }

    if (establishedObjectId === null && event.object_id !== null) {
      establishedObjectId = event.object_id;
    } else if (
      establishedObjectId !== null &&
      event.object_id !== establishedObjectId
    ) {
      issues.push("trace changes object id");
    }
  }

  const stages = ordered.map((event) => event.stage);
  const manifest = CAPTURE_LOOP_PROFILE_MANIFESTS[first.profile];
  for (const stage of stages) {
    if (!manifest.allowed_stages.includes(stage)) {
      issues.push(`${stage} is not allowed for ${first.profile}`);
    }
  }
  for (const [index, event] of ordered.entries()) {
    const milestone = manifest.ordered_path.indexOf(event.stage);
    if (milestone < 0) continue;
    const requiredPrefix = manifest.ordered_path.slice(0, milestone + 1);
    if (!hasOrderedStages(stages.slice(0, index + 1), requiredPrefix)) {
      issues.push(`${event.stage} is missing required ${first.profile} predecessors`);
    }
    if (
      event.revision !== null &&
      event.revision_id !== null &&
      REVISION_STAGES.has(event.stage)
    ) {
      const requiredRevisionStages = requiredPrefix.filter((stage) =>
        REVISION_STAGES.has(stage),
      );
      if (
        !hasOrderedRevisionStages(
          ordered.slice(0, index + 1),
          requiredRevisionStages,
          event.revision,
          event.revision_id,
        )
      ) {
        issues.push(`${event.stage} does not follow the exact proposal revision`);
      }
    }
  }
  let highestRevision = 0;
  const revisionIds = new Map<number, string>();
  for (const event of ordered) {
    if (event.revision === null || event.revision_id === null) continue;
    const establishedRevisionId = revisionIds.get(event.revision);
    if (
      establishedRevisionId !== undefined &&
      establishedRevisionId !== event.revision_id
    ) {
      issues.push("one proposal revision cannot change revision id");
    } else {
      revisionIds.set(event.revision, event.revision_id);
    }
    if (event.revision < highestRevision) {
      issues.push("proposal revision cannot move backward");
    }
    highestRevision = Math.max(highestRevision, event.revision);
  }

  const terminalIndexes = ordered
    .map((event, index) => (TERMINAL_STAGES.has(event.stage) ? index : -1))
    .filter((index) => index >= 0);
  if (terminalIndexes.length > 1) issues.push("trace has multiple terminal stages");
  if (
    terminalIndexes.length === 1 &&
    terminalIndexes[0] !== ordered.length - 1
  ) {
    issues.push("trace continues after a terminal stage");
  }

  let unmatchedInterruptions = 0;
  for (const stage of stages) {
    if (stage === "interrupted") unmatchedInterruptions += 1;
    if (stage === "resumed") {
      if (unmatchedInterruptions === 0) {
        issues.push("resumed has no preceding interruption");
      } else {
        unmatchedInterruptions -= 1;
      }
    }
  }
  if (
    unmatchedInterruptions > 0 &&
    ordered.at(-1)?.stage !== "interrupted"
  ) {
    issues.push("trace continues without resuming its interruption");
  }

  const terminal = ordered.at(-1);
  if (terminal?.stage === "outcome_verified") {
    if (manifest.success_path === null) {
      issues.push(`${first.profile} cannot claim a verified outcome`);
    } else if (!hasOrderedStages(stages, manifest.success_path)) {
      issues.push(`${first.profile} outcome is missing required stages`);
    }
  }
  if (terminal?.stage === "safe_abandonment") {
    if (!stages.slice(0, -1).includes(manifest.ordered_path[0])) {
      issues.push("safe abandonment needs a recorded journey entry");
    }
    if (stages.includes("effect_attempted")) {
      issues.push("safe abandonment cannot follow an unresolved effect attempt");
    }
  }
  if (terminal?.stage === "failed_before_effect") {
    if (!stages.slice(0, -1).includes(manifest.ordered_path[0])) {
      issues.push("failure needs a recorded journey entry");
    }
    if (stages.includes("effect_attempted")) {
      issues.push("failed_before_effect cannot follow an effect attempt");
    }
  }
  if (
    terminal?.stage === "rollback_verified" &&
    !stages.slice(0, -1).includes("effect_attempted")
  ) {
    issues.push("verified rollback needs a preceding effect attempt");
  }
  for (const [index, stage] of stages.entries()) {
    if (
      stage === "outcome_uncertain" &&
      !stages.slice(0, index).includes("effect_attempted")
    ) {
      issues.push("outcome uncertainty needs a preceding effect attempt");
    }
  }
  if (terminal?.stage === "correction_or_undo_verified") {
    const requiredCorrectionPath: CaptureLoopStage[] = [
      "entry_intent",
      "effect_attempted",
      "correction_or_undo_verified",
    ];
    if (
      first.intent !== "correct_or_undo" ||
      !hasOrderedStages(stages, requiredCorrectionPath)
    ) {
      issues.push("verified correction is missing its compensating path");
    }
  }

  return [...new Set(issues)];
}

const NORTH_STAR_OUTCOMES = new Set<CaptureLoopOutcomeKind>([
  "durable_change",
  "artifact_ready",
]);

/**
 * Emitters cannot claim value with a boolean. The reporting layer derives
 * eligibility from an intact trace and this closed outcome whitelist.
 * Advice, passive delivery, background capture, and handoff remain visible
 * diagnostics but never become a family win.
 */
export function captureLoopTraceQualifiesForNorthStar(
  rawEvents: ReadonlyArray<unknown>,
): boolean {
  if (captureLoopTraceIssues(rawEvents).length > 0) return false;
  const events = rawEvents
    .map((event) => captureLoopEventPropsSchema.parse(event))
    .sort((left, right) => left.sequence - right.sequence);
  const terminal = events.at(-1);
  if (
    terminal?.stage !== "outcome_verified" ||
    terminal.outcome_kind === null ||
    terminal.result_state !== "complete" ||
    !NORTH_STAR_OUTCOMES.has(terminal.outcome_kind)
  ) {
    return false;
  }
  if (
    terminal.profile === "passive_delivery" ||
    terminal.profile === "background_observation" ||
    terminal.branch_scope === "multi_child_aggregate"
  ) {
    return false;
  }
  return ![
    "ask_homa",
    "capture_for_later",
    "correct_or_undo",
  ].includes(terminal.intent);
}

/**
 * Stabilizes one provisional family win against separately recorded,
 * family-scoped correction loops. A reversal removes the original win while
 * preserving its audit trail. A correction that leaves the completed outcome
 * intact retains one win rather than manufacturing a second one.
 */
export function captureLoopTraceQualifiesForStabilizedNorthStar(
  rawEvents: ReadonlyArray<unknown>,
  relatedCorrectionTraces: ReadonlyArray<ReadonlyArray<unknown>>,
): boolean {
  if (!captureLoopTraceQualifiesForNorthStar(rawEvents)) return false;

  const original = rawEvents
    .map((event) => captureLoopEventPropsSchema.parse(event))
    .sort((left, right) => left.sequence - right.sequence)
    .at(-1);
  if (original?.stage !== "outcome_verified") return false;

  for (const rawCorrection of relatedCorrectionTraces) {
    if (captureLoopTraceIssues(rawCorrection).length > 0) return false;
    const correctionEvents = rawCorrection
      .map((event) => captureLoopEventPropsSchema.parse(event))
      .sort((left, right) => left.sequence - right.sequence);
    const correction = correctionEvents.at(-1);
    const correctionEntry = correctionEvents[0];
    if (
      correctionEntry?.intent !== "correct_or_undo" ||
      correctionEntry.parent_loop_id !== original.loop_id
    ) {
      return false;
    }
    if (correction?.stage === "outcome_uncertain") return false;
    if (correction?.stage !== "correction_or_undo_verified") {
      const effectWasAttempted = correctionEvents.some(
        (event) => event.stage === "effect_attempted",
      );
      if (
        effectWasAttempted &&
        correction?.stage !== "rollback_verified"
      ) {
        return false;
      }
      continue;
    }
    if (
      correction.parent_loop_id !== original.loop_id ||
      correction.corrects_event_id !== original.event_id ||
      correction.object_kind !== original.object_kind ||
      correction.object_id !== original.object_id ||
      correction.receipt_kind !== original.receipt_kind ||
      correction.correction_result === null
    ) {
      return false;
    }
    if (correction.correction_result === "reversed") {
      const usesAppendOnlyProgressUndo =
        correction.object_kind === "progress_operation" &&
        original.receipt_id === original.object_id &&
        correction.receipt_id !== original.receipt_id;
      const reusesMutableReceipt =
        correction.object_kind !== "progress_operation" &&
        correction.receipt_id === original.receipt_id;
      if (!usesAppendOnlyProgressUndo && !reusesMutableReceipt) return false;
      return false;
    }
  }

  return true;
}
