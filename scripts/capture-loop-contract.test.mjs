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
const voiceActionReceiptsPath = new URL(
  "../apps/web/lib/voice/action-receipts.ts",
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
const plannerPath = new URL(
  "../apps/mobile/src/app/(tabs)/planner.tsx",
  import.meta.url,
);
const nativeScheduleMigrationPath = new URL(
  "../supabase/migrations/20260803043000_native_capture_loop_schedule_receipts.sql",
  import.meta.url,
);
const nativeOutcomePath = new URL(
  "../apps/web/lib/mobile-capture-loop-outcome.ts",
  import.meta.url,
);
const nativeOutcomeRoutePath = new URL(
  "../apps/web/app/api/mobile/capture-loop/outcome/route.ts",
  import.meta.url,
);

test("capture loop retries are family-scoped and idempotent in storage", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  const persistence = readFileSync(persistencePath, "utf8");
  const voiceActionReceipts = readFileSync(voiceActionReceiptsPath, "utf8");

  assert.match(migration, /unique index[\s\S]*family_id[\s\S]*event_id/u);
  assert.match(migration, /events_capture_loop_positive_receipt_uidx/u);
  assert.match(migration, /events_capture_loop_lookup_idx/u);
  assert.match(migration, /events_capture_loop_stage_time_idx/u);
  assert.match(migration, /where name = 'product\.loop_stage_recorded'/u);
  assert.doesNotMatch(migration, /if not exists/u);
  assert.match(persistence, /on conflict do nothing/u);
  assert.match(persistence, /do nothing/u);
  assert.match(persistence, /child_progress_operations/u);
  assert.match(persistence, /month_plan_approvals/u);
  assert.match(persistence, /receipt\.final_revision =/u);
  assert.match(persistence, /parent_loop_in_family/u);
  assert.match(persistence, /corrected_event_matches/u);
  assert.match(persistence, /original\.props ->> 'receipt_id'/u);
  assert.match(persistence, /original\.props ->> 'receipt_kind'/u);
  assert.match(persistence, /receipt\.status = 'final'/u);
  assert.match(persistence, /receipt\.status = 'undone'/u);
  assert.match(persistence, /voice_action_receipts/u);
  assert.match(persistence, /outcome receipt is already claimed/u);
  assert.match(persistence, /existing\.props = \$\{serialized\}::jsonb/u);
  assert.match(persistence, /idempotency payload mismatch/u);
  assert.match(persistence, /captureLoopReceiptLockKey\(familyId, props\.receipt_id\)/u);
  assert.match(persistence, /pg_advisory_xact_lock/u);
  assert.match(
    voiceActionReceipts,
    /captureLoopReceiptLockKey\(input\.familyId, selected\.id\)/u,
  );
  assert.match(voiceActionReceipts, /pg_advisory_xact_lock/u);
});

test("native code identity uses Expo release metadata and no device identity", () => {
  const source = readFileSync(nativeAdapterPath, "utf8");

  assert.match(source, /Updates\.runtimeVersion/u);
  assert.match(source, /Updates\.updateId/u);
  assert.match(source, /Constants\.expoConfig\?\.version/u);
  assert.match(source, /buildNumber/u);
  assert.match(source, /buildCaptureLoopNativeClientContext/u);
  assert.match(source, /nativeCaptureLoopEventPropsSchema/u);
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

test("the canonical event is emitted by the native Planner journey", () => {
  const checker = readFileSync(checkerPath, "utf8");
  const planner = readFileSync(plannerPath, "utf8");

  assert.match(checker, /CAPTURE_LOOP_EVENT_NAME/u);
  assert.match(checker, /captureLoopWrapperSites/u);
  assert.doesNotMatch(checker, /\[\s*"product\.loop_stage_recorded"/u);
  assert.match(planner, /emitNativeCaptureLoopStage/u);
  assert.match(planner, /verifyNativeScheduleOutcome/u);
  assert.match(planner, /listUnresolvedNativeScheduleOutcomes/u);
  assert.match(planner, /if \(loop\) await loop\.flush\(\)/u);
  assert.match(planner, /captureLoopId: loop\?\.loopId/u);
  const migration = readFileSync(nativeScheduleMigrationPath, "utf8");
  assert.match(migration, /schedule_plan_activity_native_v1/u);
  assert.match(migration, /mobile_capture_loop_receipts/u);
  const outcome = readFileSync(nativeOutcomePath, "utf8");
  const outcomeRoute = readFileSync(nativeOutcomeRoutePath, "utf8");
  assert.match(outcome, /loadUnresolvedNativeScheduleBindings/u);
  assert.match(outcome, /event\.props ->> 'receipt_id'/u);
  assert.match(outcomeRoute, /export const GET = POST/u);
});
