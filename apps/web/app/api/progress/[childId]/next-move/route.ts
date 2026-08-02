import { liveProgressEnabled } from "../../../../../lib/child-progress/flag";
import {
  createNativeProgressNextMoveDismissHandler,
  createNativeProgressNextMoveHandler,
  type NativeProgressNextMoveDependencies,
} from "../../../../../lib/child-progress/native-next-move-handler";
import { prepareProgressNextMove } from "../../../../../lib/child-progress/next-move-prepare";
import { loadProgressNextMoveSnapshot } from "../../../../../lib/child-progress/next-move-snapshot";
import { dismissProgressNextMove } from "../../../../../lib/child-progress/next-move-store";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyWithAiConsentFromBearer } from "../../../../../lib/map/session";

const dependencies: NativeProgressNextMoveDependencies = {
  enabled: liveProgressEnabled,
  ipRateLimited: (request: Request) =>
    rateLimited(`progress-next-move-ip:${clientIp(request)}`, 240),
  familyRateLimited: (input: {
    familyId: string;
    childId: string;
  }) =>
    rateLimited(
      `progress-next-move-family:${input.familyId}:${input.childId}`,
      30,
    ),
  authenticate: async (request) => {
    const access = await requireFamilyWithAiConsentFromBearer(request);
    return access
      ? {
          familyId: access.family.id,
          aiProcessingConsented: access.aiProcessingConsented,
        }
      : null;
  },
  prepare: prepareProgressNextMove,
  dismiss: async ({ familyId, childId, contextFingerprint }) => {
    const snapshot = await loadProgressNextMoveSnapshot({ familyId, childId });
    if (!snapshot || snapshot.contextFingerprint !== contextFingerprint) {
      return false;
    }
    return await dismissProgressNextMove({
      familyId,
      childId,
      contextFingerprint,
      sourceRevision: snapshot.sourceRevision,
      timeZone: snapshot.view.timeZone,
      nextMove: {
        kind: "none",
        childId,
        sourceRevision: snapshot.sourceRevision.toString(),
        reason: "dismissed",
      },
    });
  },
  logError: (message, error) => {
    console.error(
      `${message}:`,
      error instanceof Error ? error.message : error ?? "unknown",
    );
  },
};

export const POST = createNativeProgressNextMoveHandler(dependencies);
export const DELETE = createNativeProgressNextMoveDismissHandler(dependencies);
