import type { MobileBootstrapStage } from "@homa/core";
import * as Network from "expo-network";

import {
  runBootstrapStep,
  type BootstrapResult,
} from "./bootstrap";

/** Supplies the native network state to the platform-independent runner. */
export function runMobileBootstrapStep<T>(
  stage: MobileBootstrapStage,
  work: () => Promise<T>,
): Promise<BootstrapResult<T>> {
  return runBootstrapStep(stage, work, {
    getNetworkState: Network.getNetworkStateAsync,
  });
}
