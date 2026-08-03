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
const plannerData = source("../features/planner/use-planner-data.ts");
const inlineError = source("../components/ui/inline-error.tsx");
const familyEventChildrenMigration = source(
  "../../../../supabase/migrations/20260802232000_family_event_children.sql",
);
const familyEventOccurrenceMigration = source(
  "../../../../supabase/migrations/20260803003000_family_event_occurrence_exceptions.sql",
);

describe("native durable mutation contract", () => {
  it("requires exact provider receipts before returning success", () => {
    for (const adapter of [familyEvents, hours, planSchedule]) {
      assert.match(adapter, /requireMutationReceipt/u);
      assert.doesNotMatch(adapter, /return \{ error \}/u);
    }
    assert.match(childPlans, /executePlanActivityCheck/u);
    for (const operation of [
      "create_family_event",
      "update_family_event",
      "delete_family_event",
      "move_family_event_occurrence",
      "delete_family_event_occurrence",
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
      /\.rpc\("set_plan_activity_check_v2"/u,
    );
    assert.doesNotMatch(childPlans, /toggle_plan_activity_check/u);
    assert.doesNotMatch(childPlans, /verify_plan_activity_check/u);
  });

  it("makes event creation idempotent across an ambiguous retry", () => {
    assert.match(familyEvents, /\.rpc\("save_family_event_with_children"/u);
    assert.match(familyEvents, /p_mode: "create"/u);
    assert.match(familyEvents, /p_event_id: eventId/u);
    assert.match(familyEventChildrenMigration, /on conflict \(id\) do update/u);
    assert.match(plannerRoute, /creatingEventId/u);
    assert.match(
      plannerRoute,
      /createFamilyEvent\(creatingEventId, family\.id, input\)/u,
    );
  });

  it("routes one recurring occurrence through an exact database receipt", () => {
    assert.match(familyEvents, /\.rpc\("save_family_event_occurrence_exception"/u);
    assert.match(familyEventOccurrenceMigration, /security definer/u);
    assert.match(familyEventOccurrenceMigration, /public\.is_family_event_occurrence/u);
    assert.match(familyEventOccurrenceMigration, /on conflict \(event_id, occurrence_on\) do update/u);
    assert.match(plannerRoute, /original_occurrence_on \?\? editingEvent\.starts_on/u);
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

  it("applies successful plan receipts without a follow-up read", () => {
    for (const route of [plannerRoute, voiceOverlay]) {
      assert.match(
        route,
        /if \(outcome\.status === "applied"\) \{\s*applyActivityCheck\(activity, outcome\);\s*return;\s*\}\s*await reload\(\);/u,
      );
    }
  });

  it("reloads ambiguous plan writes before surfacing their error", () => {
    for (const route of [plannerRoute, voiceOverlay]) {
      assert.match(
        route,
        /catch \(cause\) \{\s*await reconcileAfterAmbiguousWrite\(\);\s*throw cause;\s*\}/u,
      );
    }
    assert.match(plannerData, /for \(const delayMs of \[1_500, 5_000\]\)/u);
    assert.match(plannerData, /reconciliationScheduled/u);
  });

  it("rejects out-of-order Planner reads and refreshes only on refocus", () => {
    assert.match(plannerData, /const requestGeneration = \+\+reloadGeneration\.current/u);
    assert.match(
      plannerData,
      /if \(requestGeneration !== reloadGeneration\.current\) return;/u,
    );
    assert.match(plannerData, /mergeChildPlanSnapshots\(current, nextPlans\)/u);
    assert.match(plannerRoute, /useFocusEffect/u);
    assert.match(
      plannerRoute,
      /navigation\.addListener\("blur", \(\) => \{\s*hasBlurredPlanner\.current = true;/u,
    );
    assert.match(
      plannerRoute,
      /if \(!hasBlurredPlanner\.current\) return;\s*hasBlurredPlanner\.current = false;\s*void latestReload\.current\(\);/u,
    );
  });

  it("shows the intended checkbox state while its receipt is pending", () => {
    assert.match(activityRow, /setPendingDone\(!activity\.done\)/u);
    assert.match(activityRow, /const checked = pendingDone \?\? activity\.done/u);
    assert.match(
      activityRow,
      /accessibilityState=\{\{[\s\S]*checked,[\s\S]*busy: pending/u,
    );
  });

  it("freezes the visible mutation snapshot while its receipt is pending", () => {
    assert.equal(
      eventComposer.match(/editable=\{!busy\}/gu)?.length,
      2,
    );
    assert.match(
      eventComposer,
      /accessibilityState=\{\{ selected: active, disabled: busy \}\}[\s\S]*?disabled=\{busy\}/u,
    );
    assert.match(eventComposer, /<DateStepper[\s\S]*?disabled=\{busy\}/u);
    assert.match(eventComposer, /<TimeStepper[\s\S]*?disabled=\{busy\}/u);
    assert.equal(entryEditor.match(/editable=\{!busy\}/gu)?.length, 2);
    assert.equal(
      scheduleActivitySheet.match(/disabled=\{saving\}/gu)?.length,
      3,
    );
  });

  it("keeps audience and repeat defaults visible while hiding multi-day duration", () => {
    assert.match(eventComposer, /Who and repeat/u);
    assert.match(eventComposer, /\{audienceSummary\} · \{repeatSummary\}/u);
    assert.match(eventComposer, /Whole family/u);
    assert.match(eventComposer, /Does not repeat/u);
    assert.match(eventComposer, /Lasts more than one day/u);
    assert.match(eventComposer, /\{spansDays \? \([\s\S]*?Last day/u);
    assert.match(eventComposer, /Include a time/u);
    assert.doesNotMatch(eventComposer, /first day only/u);
  });

  it("shows recurring scope first and hides series fields for one occurrence", () => {
    assert.match(eventComposer, /This event/u);
    assert.match(eventComposer, /Entire series/u);
    assert.match(eventComposer, /occurrenceOnly \? null/u);
    assert.match(eventComposer, /Move this event/u);
    assert.match(eventComposer, /Delete entire series/u);
    assert.match(eventComposer, /Other dates stay/u);
    assert.match(eventComposer, /including past dates/u);
    assert.match(plannerRoute, /recurringEditScope === "occurrence"/u);
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

  it("renders one named recovery message and announces it through the shared adapter", () => {
    assert.match(inlineError, /accessibilityRole="text"/u);
    assert.match(inlineError, /accessibilityLabel=\{accessibilityMessage\}/u);
    assert.match(inlineError, /useAccessibilityAnnouncement\(accessibilityMessage\)/u);
    assert.doesNotMatch(inlineError, /accessibilityLiveRegion/u);
    assert.doesNotMatch(inlineError, /announceForAccessibility/u);
  });
});
