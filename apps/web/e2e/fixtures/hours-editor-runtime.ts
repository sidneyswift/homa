import type { HoursEditContext } from "../../lib/hours-edit";
import type { HoursEntry } from "../../lib/hours-view";
import type { PlannerLearningActivity } from "../../lib/planner-learning-activities";

export const firstChild = "a0000000-0000-4000-8000-000000000001";
export const secondChild = "a0000000-0000-4000-8000-000000000002";
const activityId = "b0000000-0000-4000-8000-000000000001";
const firstHours = "c0000000-0000-4000-8000-000000000001";
const secondHours = "c0000000-0000-4000-8000-000000000002";
export const kids = [
  { id: firstChild, name: "Avery", avatar_url: null },
  { id: secondChild, name: "Alexandria Clementine Montgomery-Swift", avatar_url: null },
];
const entry = (id: string, childId: string | null, note: string, happenedOn = "2026-09-06"): HoursEntry => ({
  id, childId, childName: kids.find((kid) => kid.id === childId)?.name ?? null,
  subject: "math", customLabel: null, minutes: 10, happenedOn, source: "chat", note,
});
let entries = [
  entry(firstHours, firstChild, "We built equal groups with blocks, drew them on paper, and counted the blocks again. Avery explained why three groups of four make twelve, then found another way to group the same blocks."),
  entry(secondHours, secondChild, "A separate note for Alexandria."),
  entry("c0000000-0000-4000-8000-000000000003", null, "Family nature walk", "2026-09-07"),
];
let activities: PlannerLearningActivity[] = [{
  id: activityId, familyId: "d0000000-0000-4000-8000-000000000001", title: "Our shared math activity",
  subject: "math", activityDate: "2026-09-06", status: "completed", durationMinutes: 10,
  note: "Planner notes are separate from each child's school-time note.", sourceChannel: "web",
  sourceQuote: "We did ten minutes of math.", sourceMessageId: null, completionSourceChannel: "web",
  completionSourceQuote: null, completionSourceMessageId: null, completedAt: "2026-09-06T12:00:00Z",
  createdAt: "2026-09-06T12:00:00Z", updatedAt: "2026-09-06T12:00:00Z",
  childIds: [firstChild, secondChild], hoursEntryIds: [firstHours, secondHours],
}];
let version = 0;
const listeners = new Set<() => void>();
let finish: (() => void) | null = null;
export const fixture = {
  mode: "success",
  calls: [] as Array<{ kind: string; id: string; values?: Record<string, FormDataEntryValue> }>,
  subscribe(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; },
  snapshot() { return version; },
  refresh() { version++; listeners.forEach((callback) => callback()); },
  entries() { return entries; },
  activities() { return activities; },
  resolve() { fixture.mode = "success"; finish?.(); finish = null; },
  navigate(url: string) { history.pushState({}, "", url); fixture.refresh(); },
};

declare global { interface Window { hoursEditorFixture: typeof fixture } }
if (typeof window !== "undefined") window.hoursEditorFixture = fixture;

export async function getHoursEntryEditContextAction(id: string) {
  if (fixture.mode === "loadFailure") return { context: null, error: "That record couldn't load. Try again." };
  const row = entries.find((item) => item.id === id)!;
  const activity = activities.find((item) => item.hoursEntryIds.includes(id));
  const context: HoursEditContext = {
    result: "ready", revision: "a".repeat(32), entry: row,
    activity: activity ? { id: activity.id, title: activity.title, note: activity.note,
      children: kids.filter((kid) => activity.childIds.includes(kid.id)), hoursEntryIds: activity.hoursEntryIds } : null,
  };
  return { context, error: null };
}
async function waitForMutation() {
  if (fixture.mode === "pending") await new Promise<void>((resolve) => { finish = resolve; });
  if (fixture.mode === "throw") throw new Error("Synthetic network failure");
  return fixture.mode === "failure" ? "That change would match another time entry on this day. Nothing changed." : null;
}
export async function updateHoursEntryAction(id: string, _revision: string, data: FormData) {
  fixture.calls.push({ kind: "save", id, values: Object.fromEntries(data.entries()) });
  const error = await waitForMutation();
  if (error) return { error };
  const activity = activities.find((item) => item.hoursEntryIds.includes(id));
  const ids = activity?.hoursEntryIds ?? [id];
  const minutes = Number(data.get("minutes"));
  const subject = String(data.get("subject")) as HoursEntry["subject"];
  entries = entries.map((row) => ids.includes(row.id) ? { ...row, minutes, subject,
    ...(row.id === id ? { note: String(data.get("note")), customLabel: String(data.get("customLabel")) || null } : {}) } : row);
  activities = activities.map((row) => row.id === activity?.id ? { ...row, durationMinutes: minutes, subject } : row);
  return { error: null };
}
export async function deleteHoursEntryAction(id: string) {
  fixture.calls.push({ kind: "delete", id });
  const error = await waitForMutation();
  if (error) return { error };
  const activity = activities.find((item) => item.hoursEntryIds.includes(id));
  const ids = activity?.hoursEntryIds ?? [id];
  entries = entries.filter((row) => !ids.includes(row.id));
  activities = activities.map((row) => row.id === activity?.id ? { ...row, durationMinutes: null, hoursEntryIds: [] } : row);
  return { error: null };
}
export async function savePlannerLearningActivityAction(input: { activityId: string; expectedUpdatedAt: string; title: string; note: string; durationMinutes: number | null }) {
  fixture.calls.push({ kind: "plannerSave", id: input.activityId, values: { title: input.title, note: input.note,
    durationMinutes: String(input.durationMinutes), expectedUpdatedAt: input.expectedUpdatedAt } });
  const error = await waitForMutation();
  if (error) return { ok: false, reason: error };
  const activity = activities.find((row) => row.id === input.activityId)!;
  const updated = { ...activity, title: input.title, note: input.note, durationMinutes: input.durationMinutes,
    updatedAt: "2026-09-06T12:01:00Z" };
  activities = activities.map((row) => row.id === activity.id ? updated : row);
  entries = entries.map((row) => activity.hoursEntryIds.includes(row.id) ? { ...row, minutes: input.durationMinutes ?? row.minutes } : row);
  return { ok: true, ...updated };
}
export const setPlannerLearningActivityStatusAction = async () => ({ ok: false, reason: "Unused fixture action" });
export const deletePlannerLearningActivityAction = async () => ({ ok: false, reason: "Unused fixture action" });
export const deleteScheduledPlanActivityAction = deletePlannerLearningActivityAction;
export const createFamilyEventAction = deletePlannerLearningActivityAction;
export const deleteFamilyEventOccurrenceAction = deletePlannerLearningActivityAction;
export const deleteFamilyEventAction = deletePlannerLearningActivityAction;
export const moveFamilyEventOccurrenceAction = deletePlannerLearningActivityAction;
export const updateFamilyEventAction = deletePlannerLearningActivityAction;
