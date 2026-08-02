import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260802230000_capture_loop_event_idempotency.sql",
  import.meta.url,
);
const persistencePath = new URL(
  "../apps/web/lib/capture-loop-events.ts",
  import.meta.url,
);
const nativeAdapterPath = new URL(
  "../apps/mobile/src/lib/capture-loop-events.ts",
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
const checkerPath = new URL("./events-check.mts", import.meta.url);

test("capture loop retries are family-scoped and idempotent in storage", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  const persistence = readFileSync(persistencePath, "utf8");

  assert.match(migration, /unique index[\s\S]*family_id[\s\S]*event_id/u);
  assert.match(migration, /events_capture_loop_lookup_idx/u);
  assert.match(migration, /events_capture_loop_stage_time_idx/u);
  assert.match(migration, /where name = 'product\.loop_stage_recorded'/u);
  assert.match(persistence, /on conflict \(family_id, \(\(props ->> 'event_id'\)\)\)/u);
  assert.match(persistence, /do nothing/u);
});

test("native code identity uses Expo release metadata and no device identity", () => {
  const source = readFileSync(nativeAdapterPath, "utf8");

  assert.match(source, /Updates\.runtimeVersion/u);
  assert.match(source, /Updates\.updateId/u);
  assert.match(source, /Constants\.expoConfig\?\.version/u);
  assert.match(source, /buildNumber/u);
  assert.doesNotMatch(
    source,
    /Constants\.deviceName|\bdevice_id\s*:|identifierForVendor|\bsessionId\b|from ["']expo-device["']/u,
  );
});

test("the authenticated relay preserves family row scope without adding it to loop props", () => {
  const route = readFileSync(relayRoutePath, "utf8");
  const handler = readFileSync(relayHandlerPath, "utf8");

  assert.match(route, /CAPTURE_LOOP_EVENT_NAME/u);
  assert.match(route, /persistCaptureLoopEvent\(familyId, props\)/u);
  assert.match(handler, /parsed\.data\.name === CAPTURE_LOOP_EVENT_NAME/u);
  assert.match(handler, /dependencies\.persist/u);
});

test("the canonical event remains staged until journey-owned emitters ship", () => {
  const checker = readFileSync(checkerPath, "utf8");

  assert.match(checker, /product\.loop_stage_recorded/u);
  for (const issue of ["gh#532", "gh#304", "gh#347", "gh#392", "gh#394"]) {
    assert.match(checker, new RegExp(issue, "u"));
  }
});
