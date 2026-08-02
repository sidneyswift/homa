import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const mobileEmitterPath = new URL(
  "../apps/mobile/src/lib/events.ts",
  import.meta.url,
);
const relayRoutePath = new URL(
  "../apps/web/app/api/mobile/event/route.ts",
  import.meta.url,
);
const relayHandlerPath = new URL(
  "../apps/web/lib/mobile-family-events.ts",
  import.meta.url,
);

test("native family events use the authenticated server relay", () => {
  const source = readFileSync(mobileEmitterPath, "utf8");

  assert.doesNotMatch(
    source,
    /\bemitEvent\s*\(/u,
    "direct Data API emission is rejected by the chat-only events RLS policy",
  );
  assert.match(source, /\/api\/mobile\/event/u);
  assert.match(source, /Authorization/u);
});

test("the relay authenticates and re-scopes every event to the caller", () => {
  assert.equal(existsSync(relayRoutePath), true, "mobile event route is missing");
  assert.equal(
    existsSync(relayHandlerPath),
    true,
    "mobile event relay handler is missing",
  );

  const route = readFileSync(relayRoutePath, "utf8");
  const handler = readFileSync(relayHandlerPath, "utf8");

  assert.match(route, /createMobileFamilyEventHandler/u);
  assert.match(route, /requireFamilyFromBearer/u);
  assert.match(route, /persistMapEvent/u);
  assert.match(handler, /mobileFamilyEventRequestSchema/u);
  assert.match(handler, /family_id:\s*family\.id/u);
  assert.match(handler, /dependencies\.persist/u);
});
