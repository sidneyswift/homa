import type { FamilyTaskKind } from "./kinds";

export const TASK_DELIVERY_VERSIONS = [
  "legacy",
  "research_brief_v2",
] as const;

export type TaskDeliveryVersion = (typeof TASK_DELIVERY_VERSIONS)[number];

/**
 * Reads exact rollout flags and server-loaded sandbox eligibility once at
 * task-run creation. Every later decision uses the value persisted on that
 * run.
 */
export function deliveryVersionForNewTaskRun(
  kind: FamilyTaskKind,
  environment: Record<string, string | undefined> = process.env,
  familySandbox = false,
): TaskDeliveryVersion {
  const v2Enabled =
    environment.HOMA_RESEARCH_BRIEF_V2_ENABLED === "true" ||
    (
      environment.HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY === "true" &&
      familySandbox
    );
  return kind === "morning_brief" && v2Enabled
    ? "research_brief_v2"
    : "legacy";
}

export function usesResearchBriefV2Delivery(
  version: TaskDeliveryVersion,
): boolean {
  return version === "research_brief_v2";
}
