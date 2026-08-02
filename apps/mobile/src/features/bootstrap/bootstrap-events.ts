import type {
  MobileBootstrapFailureReason,
  MobileBootstrapStage,
} from "@homa/core";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";

export type BootstrapEventKind = "attempted" | "failed" | "recovered";

/**
 * Best-effort, family-free startup telemetry. The endpoint accepts only our
 * closed stage and reason enums, so no account, family, or conversation data
 * can enter the event row.
 */
export function reportBootstrapEvent(
  kind: "attempted",
  stage: MobileBootstrapStage,
): Promise<void>;
export function reportBootstrapEvent(
  kind: "failed" | "recovered",
  stage: MobileBootstrapStage,
  reason: MobileBootstrapFailureReason,
): Promise<void>;
export async function reportBootstrapEvent(
  kind: BootstrapEventKind,
  stage: MobileBootstrapStage,
  reason?: MobileBootstrapFailureReason,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    await fetch(
      `${env.apiUrl.replace(/\/+$/, "")}/api/mobile/bootstrap-event`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...EVE_CHANNEL_HEADER,
        },
        body: JSON.stringify({
          kind,
          stage,
          ...(reason ? { reason } : {}),
        }),
        signal: controller.signal,
      },
    );
  } catch {
    // Analytics never blocks startup or recovery.
  } finally {
    clearTimeout(timer);
  }
}
