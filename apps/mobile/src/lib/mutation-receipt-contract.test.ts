import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const familyEvents = source("./family-events.ts");
const hours = source("./hours.ts");
const planSchedule = source("./plan-schedule.ts");
const childPlans = source("./child-plans.ts");
const plannerRoute = source("../app/(tabs)/planner.tsx");
const hoursRoute = source("../app/(tabs)/hours.tsx");
const voiceOverlay = source("../features/voice/overlay-host.tsx");
const eventComposer = source("../features/planner/event-composer.tsx");
const scheduleActivitySheet = source("../features/planner/schedule-activity-sheet.tsx");
const entryEditor = source("../features/hours/entry-editor.tsx");
const activityRow = source("../features/planner/activity-row.tsx");
const inlineError = source("../components/ui/inline-error.tsx");

describe("native durable mutation contract", () => {
  it("requires exact provider receipts before returning success", () => {
    for (const adapter of [familyEvents, hours, planSchedule]) {
      assert.match(adapter, /requireMutationReceipt/u);
      assert.doesNotMatch(adapter, /return \{ error \}/u);
    }
    assert.match(childPlans, /requireMutationAcknowledgement/u);
    assert.match(childPlans, /requireReceiptValue/u);
    for (const operation of [
      "create_family_event",
      "update_family_event",
      "delete_family_event",
    ]) {
      assert.ok(familyEvents.includes(`requireMutationReceipt("${operation}"`));
    }
    for (const operation of ["update_hours_entry", "delete_hours_entry"]) {
      assert.ok(hours.includes(`requireMutationReceipt("${operation}"`));
    }
    for (const operation of ["schedule_plan_activity", "unschedule_plan_activity"]) {
      assert.ok(planSchedule.includes(`requireMutationReceipt("${operation}"`));
    }
    assert.match(
      childPlans,
      /requireMutationAcknowledgement\("toggle_plan_activity_check"/u,
    );
    assert.match(
      childPlans,
      /requireMutationReceipt\("verify_plan_activity_check"/u,
    );
  });

  it("makes event creation idempotent across an ambiguous retry", () => {
    assert.match(familyEvents, /\.upsert\(/u);
    assert.match(familyEvents, /onConflict: "id"/u);
    assert.match(familyEvents, /id: eventId/u);
    assert.match(plannerRoute, /creatingEventId/u);
    assert.match(
      plannerRoute,
      /createFamilyEvent\(creatingEventId, family\.id, input\)/u,
    );
  });

  it("keeps editors and checkboxes pending until their receipt resolves", () => {
    for (const editor of [eventComposer, entryEditor]) {
      assert.match(editor, /Promise<void>/u);
      assert.match(editor, /await on/u);
      assert.match(editor, /<InlineError/u);
      assert.match(editor, /busy=/u);
    }
    assert.match(activityRow, /onToggle: \(\) => Promise<void>/u);
    assert.match(activityRow, /await onToggle/u);
    assert.match(activityRow, /accessibilityState=\{\{[\s\S]*busy:/u);
  });

  it("freezes the visible mutation snapshot while its receipt is pending", () => {
    assert.equal(
      eventComposer.match(/editable=\{!busy\}/gu)?.length,
      2,
    );
    assert.match(
      eventComposer,
      /accessibilityState=\{\{ checked: active, disabled: busy \}\}[\s\S]*?disabled=\{busy\}/u,
    );
    assert.match(eventComposer, /<DateStepper[\s\S]*?disabled=\{busy\}/u);
    assert.match(eventComposer, /<TimeStepper[\s\S]*?disabled=\{busy\}/u);
    assert.equal(entryEditor.match(/editable=\{!busy\}/gu)?.length, 2);
    assert.equal(
      scheduleActivitySheet.match(/disabled=\{saving\}/gu)?.length,
      3,
    );
  });

  it("propagates rejected receipts through Planner, Hours, and Voice", () => {
    for (const route of [plannerRoute, hoursRoute, voiceOverlay]) {
      assert.match(route, /await (create|update|delete|schedule|unschedule|toggle)/u);
    }
    assert.doesNotMatch(plannerRoute, /void handleSaveEvent/u);
    assert.doesNotMatch(hoursRoute, /void handle(Create|Update|Delete)/u);
    assert.doesNotMatch(voiceOverlay, /void handle(Schedule|Unschedule|Toggle)/u);
    assert.match(voiceOverlay, /<RefreshControl[\s\S]*?onRefresh=\{\(\) => void reload\(\)\}/u);
  });

  it("makes the same recovery message readable on Android and audible on iOS", () => {
    assert.match(inlineError, /accessibilityRole="alert"/u);
    assert.match(inlineError, /accessibilityLiveRegion="polite"/u);
    assert.match(inlineError, /Platform\.OS === "ios"/u);
    assert.match(
      inlineError,
      /AccessibilityInfo\.announceForAccessibility\(message\)/u,
    );
  });
});
