import { persistMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamilyFromBearer } from "../../../../lib/map/session";
import { createMobileFamilyEventHandler } from "../../../../lib/mobile-family-events";

export const POST = createMobileFamilyEventHandler({
  rateLimited: (request) =>
    rateLimited(`mobile-event:${clientIp(request)}`, 240),
  authenticate: requireFamilyFromBearer,
  persist: (name, props, familyId) =>
    persistMapEvent(name, props, { familyId }),
  logError: (message, error) => {
    console.error(
      `${message}:`,
      error instanceof Error ? error.message : error ?? "unknown",
    );
  },
});
