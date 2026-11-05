import assert from "node:assert/strict";
import test from "node:test";
import { toChatHistoryMaterial } from "../chat-history-model";
import { activityPlanSchema, activityPlanMinutes, activityPlanHtml, activityPlanRevisionRequest, readActivityPlan, selectedPlanActivities } from "./activity-plan";

const plan = activityPlanSchema.parse({ version: 1, introduction: "Count together", minutes: 20, swapped: [], activities: [1, 2, 3].map(n => ({ id: `step-${n}`, title: `Count ${n}`, minutes: n * 3, instructions: "Count objects", materials: ["Buttons"], alternative: { title: "Count steps", instructions: "Walk and count each step" } })) });

test("all supported budgets allocate exact positive whole minutes", () => {
  for (let minutes = 10; minutes <= 60; minutes++) {
    const result = activityPlanMinutes({ ...plan, minutes });
    assert.equal(result.reduce((a, b) => a + b, 0), minutes);
    assert.ok(result.every(value => Number.isInteger(value) && value > 0));
  }
});
test("rejects ambiguous identities, unknown alternatives and unsupported formats", () => {
  for (const value of [{ ...plan, activities: [plan.activities[0], plan.activities[0]] }, { ...plan, swapped: ["missing"] }, { ...plan, swapped: ["step-1", "step-1"] }, { ...plan, version: 2 }, { ...plan, minutes: 0 }]) assert.equal(readActivityPlan(value), undefined);
});
test("serialized saved plans preserve time and selected alternatives", () => {
  const saved = { ...plan, minutes: 31, swapped: ["step-2"] };
  const reopened = readActivityPlan(JSON.parse(JSON.stringify(saved)))!;
  assert.deepEqual(reopened, saved);
  assert.equal(selectedPlanActivities(reopened)[1].title, "Count steps");
  assert.deepEqual(selectedPlanActivities(reopened)[1].materials, []);
});
test("print rendering escapes model text and follows the selected alternative", () => {
  const html = activityPlanHtml('<script>alert("x")</script>', { ...plan, swapped: ["step-1"] });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Count steps/);
  assert.doesNotMatch(html, />1\. Count 1/);
});
test("revision requests preserve source identity and do not imply completed learning", () => {
  const request = activityPlanRevisionRequest("material-id", { ...plan, minutes: 25, swapped: ["step-3"] });
  assert.match(request, /material-id/);
  assert.match(request, /25 minutes/);
  assert.match(request, /Selected alternatives: step-3/);
  assert.match(request, /Do not schedule or log this as completed learning/);
});

test("history projection restores validated plan metadata and drops malformed payloads", () => {
  const row = { id: "saved-plan", title: "Count together", kind: "other", skill: null, preview_url: "/preview.png", pdf_url: "/plan.pdf", created_at: "2026-10-08T12:00:00Z", session_id: "session", child_name: null, status: "draft" as const, revises: null, review_pass: "true", activity_plan: plan };
  assert.deepEqual(toChatHistoryMaterial(row)?.activityPlan, plan);
  assert.equal(toChatHistoryMaterial({ ...row, activity_plan: { ...plan, swapped: ["missing"] } })?.activityPlan, undefined);
});
