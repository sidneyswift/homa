"use client";

import { useActionState } from "react";

import { createTaskAction, updateTaskAction, type TaskActionState } from "./actions";
import type { TaskRowView } from "./tasks-view";

/**
 * Create/edit form for a custom task (HT-6). One form, two actions: no
 * task prop means create. Weekday chips and an hour select keep input
 * inside what the dispatcher can actually honor (on the hour, chosen
 * days, the family's own zone).
 */

const DAYS: ReadonlyArray<{ value: number; short: string }> = [
  { value: 0, short: "S" },
  { value: 1, short: "M" },
  { value: 2, short: "T" },
  { value: 3, short: "W" },
  { value: 4, short: "T" },
  { value: 5, short: "F" },
  { value: 6, short: "S" },
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function hourOption(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${hour < 12 ? "am" : "pm"}`;
}

const INITIAL_STATE: TaskActionState = { error: null };

export function TaskForm({ task, onDone }: { task?: TaskRowView; onDone: () => void }) {
  const action = task ? updateTaskAction.bind(null, task.id) : createTaskAction;
  const [state, formAction, pending] = useActionState(
    async (prev: TaskActionState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.error === null) onDone();
      return result;
    },
    INITIAL_STATE,
  );

  const defaults = {
    label: task?.label ?? "",
    prompt: task?.prompt ?? "",
    weekdays: new Set(task?.weekdays ?? [1, 2, 3, 4, 5]),
    localHour: task?.localHour ?? 9,
    deliveryPref: task?.deliveryPref ?? "text",
  };

  const inputClass =
    "w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-body outline-none focus:border-brand";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold text-strong">
        Name
        <input
          name="label"
          defaultValue={defaults.label}
          placeholder="Co-op prep reminder"
          maxLength={60}
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-strong">
        What should Homa do?
        <textarea
          name="prompt"
          defaultValue={defaults.prompt}
          placeholder="Remind me to pack the co-op bag and print this week's pages."
          maxLength={1000}
          rows={3}
          required
          className={inputClass}
        />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-strong">Which days?</legend>
        <div className="mt-1.5 flex gap-1.5">
          {DAYS.map((day, index) => (
            <label
              key={`${day.value}-${index}`}
              className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={day.value}
                defaultChecked={defaults.weekdays.has(day.value)}
                className="peer sr-only"
              />
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-card text-xs font-bold text-muted transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-[var(--clay-700)]">
                {day.short}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-strong">
          What time?
          <select name="localHour" defaultValue={defaults.localHour} className={inputClass}>
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hourOption(hour)}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-strong">How should it reach you?</legend>
          <div className="mt-1.5 flex flex-col gap-1 text-sm text-body">
            {(
              [
                { value: "text", label: "Text me (email if texting isn't set up)" },
                { value: "email", label: "Email me" },
                { value: "none", label: "Just save it on this page" },
              ] as const
            ).map((option) => (
              <label key={option.value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="deliveryPref"
                  value={option.value}
                  defaultChecked={defaults.deliveryPref === option.value}
                  className="accent-[var(--brand,#E7602F)]"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {state.error ? <p className="text-sm text-muted">{state.error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {task ? "Save changes" : "Create task"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-pill border border-border bg-card px-5 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
