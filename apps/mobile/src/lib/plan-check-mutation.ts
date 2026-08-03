import {
  planActivityCheckRpcReceiptSchema,
  type PlanActivityCheckRequest,
  type PlanActivityCheckRpcReceipt,
} from "@homa/core";

import {
  MutationReceiptError,
  requireMutationReceipt,
} from "./mutation-receipt";

const OPERATION = "set_plan_activity_check_v2";

export type PlanActivityCheckConflictReason = Extract<
  PlanActivityCheckRpcReceipt,
  { status: "conflict" }
>["reason"];

export type PlanActivityCheckInput = PlanActivityCheckRequest;

export interface PlanActivityCheckApplied {
  status: "applied";
  reason: null;
  familyId: string;
  planId: string;
  planRevision: number;
  progressRevision: number;
  progressSnapshot: Record<string, boolean>;
  progressKey: string;
  done: boolean;
  changed: boolean;
}

export interface PlanActivityCheckConflict {
  status: "conflict";
  reason: PlanActivityCheckConflictReason;
  familyId: string | null;
  planId: string | null;
  planRevision: number | null;
  progressRevision: number | null;
  progressSnapshot: JsonValue | null;
  progressKey: string;
  done: null;
  changed: null;
}

export type PlanActivityCheckOutcome =
  | PlanActivityCheckApplied
  | PlanActivityCheckConflict;

export interface PlanActivityCheckRpcArgs {
  target_child_id: string;
  target_subject_id: string;
  target_check_key: string;
  target_done: boolean;
  target_expected_text: string;
  target_plan_revision: number;
}

interface ProviderError {
  message: string;
}

interface PlanActivityCheckRpcResult {
  data: unknown | null;
  error: ProviderError | null;
}

export type PlanActivityCheckRpc = (
  args: PlanActivityCheckRpcArgs,
) => PromiseLike<PlanActivityCheckRpcResult>;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function contradictoryReceipt(): never {
  throw new MutationReceiptError(OPERATION, "contradictory_receipt");
}

function isJsonValue(value: unknown, seen = new Set<object>()): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, seen))
    : Object.values(value).every((entry) => isJsonValue(entry, seen));
  seen.delete(value);
  return valid;
}

export function parsePlanActivityCheckReceipt(
  value: unknown,
  input: PlanActivityCheckInput,
): PlanActivityCheckOutcome {
  const parsed = planActivityCheckRpcReceiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.progress_key !== input.checkKey) {
    return contradictoryReceipt();
  }
  const receipt = parsed.data;

  if (receipt.status === "applied") {
    if (
      receipt.plan_revision !== input.planRevision ||
      receipt.done !== input.done ||
      receipt.progress_snapshot[input.checkKey] !== input.done
    ) {
      return contradictoryReceipt();
    }
    return {
      status: "applied",
      reason: null,
      familyId: receipt.family_id,
      planId: receipt.plan_id,
      planRevision: receipt.plan_revision,
      progressRevision: receipt.progress_revision,
      progressSnapshot: receipt.progress_snapshot,
      progressKey: receipt.progress_key,
      done: receipt.done,
      changed: receipt.changed,
    };
  }

  if (
    (receipt.progress_snapshot !== null && !isJsonValue(receipt.progress_snapshot))
  ) {
    return contradictoryReceipt();
  }

  const reason = receipt.reason;
  const planMissingReceipt =
    receipt.family_id === null &&
    receipt.plan_id === null &&
    receipt.plan_revision === null &&
    receipt.progress_revision === null &&
    receipt.progress_snapshot === null;
  const existingPlanReceipt =
    receipt.family_id !== null &&
    receipt.plan_id !== null &&
    receipt.plan_revision !== null &&
    receipt.progress_revision !== null;
  if (
    (reason === "plan-missing" && !planMissingReceipt) ||
    (reason !== "plan-missing" && !existingPlanReceipt)
  ) {
    return contradictoryReceipt();
  }

  return {
    status: "conflict",
    reason,
    familyId: receipt.family_id,
    planId: receipt.plan_id,
    planRevision: receipt.plan_revision,
    progressRevision: receipt.progress_revision,
    progressSnapshot: receipt.progress_snapshot as JsonValue | null,
    progressKey: receipt.progress_key,
    done: null,
    changed: null,
  };
}

export async function executePlanActivityCheck(
  rpc: PlanActivityCheckRpc,
  input: PlanActivityCheckInput,
): Promise<PlanActivityCheckOutcome> {
  const args: PlanActivityCheckRpcArgs = {
    target_child_id: input.childId,
    target_subject_id: input.subjectId,
    target_check_key: input.checkKey,
    target_done: input.done,
    target_expected_text: input.expectedText,
    target_plan_revision: input.planRevision,
  };
  const receipt = requireMutationReceipt(OPERATION, await rpc(args));
  return parsePlanActivityCheckReceipt(receipt, input);
}

export class PlanActivityCheckConflictError extends Error {
  readonly outcome: PlanActivityCheckConflict;

  constructor(outcome: PlanActivityCheckConflict) {
    super(`Plan check needs a refresh (${outcome.reason})`);
    this.name = "PlanActivityCheckConflictError";
    this.outcome = outcome;
  }
}
