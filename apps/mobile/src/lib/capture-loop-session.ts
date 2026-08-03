import {
  CAPTURE_LOOP_CONTRACT_VERSION,
  type CaptureLoopBranchScope,
  type CaptureLoopEventProps,
  type CaptureLoopExitReason,
  type CaptureLoopIntent,
  type CaptureLoopObjectKind,
  type CaptureLoopProfile,
  type CaptureLoopStage,
  type CaptureLoopSurface,
} from "@homa/core";

import { createIdempotencyKey } from "./idempotency-key";

export type NativeCaptureLoopEventInput = Omit<
  CaptureLoopEventProps,
  "client_context"
>;

export type NativeCaptureLoopStage = Exclude<
  CaptureLoopStage,
  | "outcome_verified"
  | "correction_or_undo_verified"
  | "rollback_verified"
>;

export type NativeCaptureLoopStageEmitter = (
  familyId: string | null,
  input: NativeCaptureLoopEventInput,
) => void | Promise<void>;

export interface NativeCaptureLoopSessionInput {
  familyId: string | null;
  profile: CaptureLoopProfile;
  intent: CaptureLoopIntent;
  surface: CaptureLoopSurface;
  objectKind: CaptureLoopObjectKind;
  objectId: string | null;
  branchScope?: CaptureLoopBranchScope;
  branchId?: string | null;
  parentLoopId?: string | null;
  revision?: number | null;
  revisionId?: string | null;
}

export interface NativeCaptureLoopSession {
  readonly loopId: string;
  readonly hasAttemptedEffect: boolean;
  record(
    stage: NativeCaptureLoopStage,
    options?: { exitReason?: CaptureLoopExitReason | null },
  ): void;
  flush(): Promise<void>;
  abandon(): void;
}

const REVISIONED_STAGES = new Set<CaptureLoopStage>([
  "proposal_ready",
  "review_presented",
  "approval_recorded",
  "effect_attempted",
]);

const REVISIONED_PROFILES = new Set<CaptureLoopProfile>([
  "proposed_effect",
  "device_mutation",
  "device_handoff",
  "capture_confirmation",
  "passive_delivery",
  "background_observation",
]);

const TERMINAL_STAGES = new Set<NativeCaptureLoopStage>([
  "safe_abandonment",
  "failed_before_effect",
  "outcome_uncertain",
]);

export type NativeCaptureLoopIdFactory = () => string | null;

function defaultIdFactory(): string | null {
  return createIdempotencyKey();
}

function validBranchShape(
  branchScope: CaptureLoopBranchScope,
  branchId: string | null,
): boolean {
  const needsBranchId =
    branchScope === "single_child" || branchScope === "multiple_children";
  return needsBranchId === (branchId !== null);
}

/**
 * Creates a best-effort native lifecycle recorder for one parent-visible
 * action. It never emits a client-claimed outcome or corrective receipt.
 * Injecting an id factory keeps the lifecycle shape deterministic in tests
 * without adding a device identifier or a new runtime dependency.
 */
export function createNativeCaptureLoopSession(
  input: NativeCaptureLoopSessionInput,
  emit: NativeCaptureLoopStageEmitter,
  idFactory: NativeCaptureLoopIdFactory = defaultIdFactory,
): NativeCaptureLoopSession | null {
  const loopId = idFactory();
  if (!loopId) return null;

  const branchScope = input.branchScope ?? "family";
  const branchId = input.branchId ?? null;
  if (!validBranchShape(branchScope, branchId)) return null;

  let sequence = 0;
  let terminal = false;
  let attempted = false;
  let pending: Promise<void>[] = [];

  const session: NativeCaptureLoopSession = {
    loopId,
    get hasAttemptedEffect() {
      return attempted;
    },
    record(stage, options = {}) {
      if (terminal) return;

      const eventId = idFactory();
      if (!eventId || eventId === loopId) return;

      const revisioned =
        REVISIONED_PROFILES.has(input.profile) && REVISIONED_STAGES.has(stage);
      const revision = revisioned ? input.revision ?? 1 : null;
      const revisionId = revisioned ? input.revisionId ?? null : null;
      if (revisioned && revisionId === null) return;

      sequence += 1;
      const event: NativeCaptureLoopEventInput = {
        contract_version: CAPTURE_LOOP_CONTRACT_VERSION,
        event_id: eventId,
        loop_id: loopId,
        parent_loop_id: input.parentLoopId ?? null,
        branch_id: branchId,
        branch_scope: branchScope,
        profile: input.profile,
        intent: input.intent,
        stage,
        sequence,
        surface: input.surface,
        object_kind: input.objectKind,
        object_id: input.objectId,
        outcome_kind: null,
        result_state: "not_applicable",
        receipt_kind: "none",
        receipt_id: null,
        revision,
        revision_id: revisionId,
        corrects_event_id: null,
        correction_result: null,
        exit_reason: options.exitReason ?? null,
      };

      if (stage === "effect_attempted") attempted = true;
      if (TERMINAL_STAGES.has(stage)) terminal = true;
      pending.push(Promise.resolve(emit(input.familyId, event)).catch(() => undefined));
    },
    flush() {
      const current = pending;
      pending = [];
      return Promise.all(current).then(() => undefined);
    },
    abandon() {
      if (terminal || attempted) return;
      session.record("safe_abandonment", { exitReason: "parent_cancelled" });
    },
  };

  return session;
}
