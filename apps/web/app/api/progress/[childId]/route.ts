import { getChildProgressView } from "../../../../lib/child-progress";
import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import { createNativeProgressReadHandler } from "../../../../lib/child-progress/native-read-handler";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamilyFromBearer } from "../../../../lib/map/session";

/**
 * The canonical native Progress read. Unlike a direct table read, the
 * ChildProgress service rejects stale cached projections and rebuilds a
 * current view before this route validates and returns it.
 */
export const GET = createNativeProgressReadHandler({
  enabled: liveProgressEnabled,
  rateLimited: (request) =>
    rateLimited(`progress-read:${clientIp(request)}`, 120),
  authenticate: async (request) => {
    const family = await requireFamilyFromBearer(request);
    return family ? { familyId: family.id } : null;
  },
  loadView: getChildProgressView,
  logError: (message, error) => {
    console.error(
      `${message}:`,
      error instanceof Error ? error.message : error ?? "unknown",
    );
  },
});
