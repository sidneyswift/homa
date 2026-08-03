import {
  createMobileCaptureLoopOutcomeHandler,
  hasNativeScheduleReceiptBinding,
  loadNativeCaptureLoopEvents,
  loadUnresolvedNativeScheduleBindings,
} from "../../../../../lib/mobile-capture-loop-outcome";
import { persistCaptureLoopEvent } from "../../../../../lib/capture-loop-events";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyFromBearer } from "../../../../../lib/map/session";

export const POST = createMobileCaptureLoopOutcomeHandler({
  rateLimited: (request) =>
    rateLimited(`mobile-capture-loop-outcome:${clientIp(request)}`, 120),
  authenticate: requireFamilyFromBearer,
  loadEvents: loadNativeCaptureLoopEvents,
  loadReceiptBinding: hasNativeScheduleReceiptBinding,
  loadUnresolvedBindings: loadUnresolvedNativeScheduleBindings,
  persist: persistCaptureLoopEvent,
  logError: (message, error) => {
    console.error(
      `${message}:`,
      error instanceof Error ? error.message : error ?? "unknown",
    );
  },
});

export const GET = POST;
