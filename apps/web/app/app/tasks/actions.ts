"use server";

import { revalidatePath } from "next/cache";

import { getMyFamily } from "../../../lib/family";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  createCustomTask,
  deleteCustomTask,
  setTaskPaused,
  updateCustomTask,
  updateTaskSchedule,
  type CustomTaskInput,
  type TaskScheduleInput,
} from "../../../lib/tasks/custom";

/**
 * /app/tasks server actions (HT-5/HT-6). Same posture as the settings
 * actions: agent_schedules has no Data API write policies, so writes go
 * through lib/tasks/custom on the server connection, with familyId
 * derived from the caller's OWN membership (getMyFamily under RLS),
 * never from the form.
 */

export interface TaskActionState {
  error: string | null;
}

async function requireFamilyId(): Promise<string | null> {
  const family = await getMyFamily();
  return family?.id ?? null;
}

/** The signed-in adult creating the task, who becomes its one delivery
 * recipient (founder ruling 2026-07-12). */
async function callerUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function parseScheduleFields(
  formData: FormData,
): { weekdays: number[]; localHour: number } | { error: string } {
  const weekdays = [
    ...new Set(
      formData
        .getAll("weekdays")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
    ),
  ].sort((left, right) => left - right);
  const localHour = Number(formData.get("localHour"));

  if (weekdays.length === 0) return { error: "Pick at least one day." };
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23) {
    return { error: "Pick a time." };
  }
  return { weekdays, localHour };
}

function parseTaskForm(formData: FormData): CustomTaskInput | { error: string } {
  const label = String(formData.get("label") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const deliveryRaw = String(formData.get("deliveryPref") ?? "text");
  const deliveryPref =
    deliveryRaw === "email" || deliveryRaw === "none" ? deliveryRaw : ("text" as const);

  if (label.length < 3) return { error: "Give the task a short name (at least 3 characters)." };
  if (prompt.length < 10) return { error: "Tell Homa what to do in a sentence or two." };
  const schedule = parseScheduleFields(formData);
  if ("error" in schedule) return schedule;
  return { label, prompt, ...schedule, deliveryPref };
}

function parseTaskScheduleForm(formData: FormData): TaskScheduleInput | { error: string } {
  const schedule = parseScheduleFields(formData);
  if ("error" in schedule) return schedule;
  const deliveryRaw = String(formData.get("deliveryPref") ?? "text");
  return { ...schedule, deliveryPref: deliveryRaw === "email" ? "email" : "text" };
}

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const parsed = parseTaskForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await createCustomTask(familyId, parsed, "parent", await callerUserId());
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function updateTaskAction(
  taskId: string,
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const parsed = parseTaskForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await updateCustomTask(familyId, taskId, parsed);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

/** Built-in tasks (morning brief, evening check-in): the words are
 * Homa's, the schedule is the parent's. Only days, hour, and channel
 * move here; label and prompt stay untouched. */
export async function updateTaskScheduleAction(
  taskId: string,
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const parsed = parseTaskScheduleForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await updateTaskSchedule(familyId, taskId, parsed);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function setTaskPausedAction(
  taskId: string,
  paused: boolean,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const result = await setTaskPaused(familyId, taskId, paused);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function deleteTaskAction(taskId: string): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const result = await deleteCustomTask(familyId, taskId);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}
