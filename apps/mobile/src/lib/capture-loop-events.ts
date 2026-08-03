import {
  CAPTURE_LOOP_EVENT_NAME,
  buildCaptureLoopNativeClientContext,
  nativeCaptureLoopEventPropsSchema,
  type CaptureLoopNativeClientContext,
} from "@homa/core";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { emitFamilyEvent } from "./events";
import type { NativeCaptureLoopEventInput } from "./capture-loop-session";

export { createNativeCaptureLoopSession } from "./capture-loop-session";
export type {
  NativeCaptureLoopEventInput,
  NativeCaptureLoopIdFactory,
  NativeCaptureLoopSession,
  NativeCaptureLoopSessionInput,
  NativeCaptureLoopStage,
  NativeCaptureLoopStageEmitter,
} from "./capture-loop-session";

/**
 * Reads code identity only. Expo runtimeVersion is the fingerprint-policy
 * hash for the installed native bundle, not a device, advertising, or user
 * identifier. Development clients return null and do not emit production
 * lifecycle telemetry with invented version values.
 */
export function currentNativeCaptureLoopContext(): CaptureLoopNativeClientContext | null {
  const appVersion = Constants.expoConfig?.version ?? null;
  const runtimeVersion = Updates.runtimeVersion;
  const updateId = Updates.updateId;
  const buildNumber =
    Platform.OS === "ios"
      ? Constants.platform?.ios?.buildNumber ?? null
      : Platform.OS === "android" &&
          Constants.platform?.android?.versionCode !== undefined
        ? String(Constants.platform.android.versionCode)
        : null;

  return buildCaptureLoopNativeClientContext({
    platform: Platform.OS,
    appVersion,
    buildNumber,
    runtimeVersion,
    updateId,
  });
}

/**
 * Native adapter for the shared canonical contract. The authenticated relay
 * acknowledges the insert and makes event_id idempotent; this adapter still
 * remains best-effort so a telemetry failure cannot block the parent action.
 */
export async function emitNativeCaptureLoopStage(
  familyId: string | null,
  input: NativeCaptureLoopEventInput,
): Promise<void> {
  const clientContext = currentNativeCaptureLoopContext();
  if (!clientContext) {
    console.error("emitNativeCaptureLoopStage missing release code identity");
    return;
  }
  const parsed = nativeCaptureLoopEventPropsSchema.safeParse({
    ...input,
    client_context: clientContext,
  });
  if (!parsed.success) {
    console.error(`emitNativeCaptureLoopStage(${input.stage}) rejected invalid props`);
    return;
  }
  await emitFamilyEvent(familyId, CAPTURE_LOOP_EVENT_NAME, parsed.data);
}
