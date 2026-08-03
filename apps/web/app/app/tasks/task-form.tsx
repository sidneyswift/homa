"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { QuietAction } from "../../../components/design/QuietAction";
import { QuietStatus } from "../../../components/design/QuietStatus";
import { createTaskAction, updateTaskAction, type TaskActionState } from "./actions";
import type { TaskRowView } from "./tasks-view";

/**
 * Create/edit form for a custom task (HT-6). One form, two actions: no
 * task prop means create. Weekday chips and an hour select keep input
 * inside what the dispatcher can actually honor (on the hour, chosen
 * days, the family's own zone). The schedule field components are
 * exported for the built-in editor in task-edit-overlay.tsx, which
 * shares days/time/delivery but never label or prompt.
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

export const taskInputClass =
  "w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-canvas)] px-3 py-2 text-sm text-[color:var(--homa-ink)] outline-none transition-colors focus:border-[var(--homa-midnight-action)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--homa-visual-coral)_24%,transparent)]";

export function WeekdayChips({ defaultSelected }: { defaultSelected: ReadonlySet<number> }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[color:var(--homa-ink)]">Which days?</legend>
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
              defaultChecked={defaultSelected.has(day.value)}
              className="peer sr-only"
            />
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-xs font-bold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))] transition-colors peer-checked:border-[var(--homa-midnight-action)] peer-checked:bg-[var(--homa-midnight-action)] peer-checked:text-[var(--homa-paper)]">
              {day.short}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function HourField({ defaultHour }: { defaultHour: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--homa-ink)]">
      What time?
      <select name="localHour" defaultValue={defaultHour} className={taskInputClass}>
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hourOption(hour)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The "Text me" label tells the parent her own situation instead of a
 * conditional rule (reader gate 2026-07-12: "have I set up texting? The
 * app knows and this sentence won't tell me"). */
function deliveryOptions(textingLinked: boolean) {
  return [
    {
      value: "text",
      label: textingLinked
        ? "Text me."
        : "Text me. Until texting is set up, it emails you instead.",
    },
    { value: "email", label: "Email me." },
    { value: "none", label: "Just save it to this page." },
  ] as const;
}

export function DeliveryChoice({
  values,
  defaultValue,
  textingLinked,
}: {
  values: ReadonlyArray<"text" | "email" | "none">;
  defaultValue: "text" | "email" | "none";
  textingLinked: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[color:var(--homa-ink)]">How should it reach you?</legend>
      <div className="mt-1.5 flex flex-col gap-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
        {deliveryOptions(textingLinked)
          .filter((option) => values.includes(option.value))
          .map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="deliveryPref"
                value={option.value}
                defaultChecked={defaultValue === option.value}
                className="accent-[var(--homa-midnight-action)]"
              />
              {option.label}
            </label>
          ))}
        {!textingLinked ? (
          <Link
            href="/app/settings"
            className="text-xs font-semibold text-[color:var(--homa-brand-text)] hover:underline"
          >
            Set up texting in Settings
          </Link>
        ) : null}
      </div>
    </fieldset>
  );
}

export function TaskFormButtons({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <QuietAction type="submit" disabled={pending}>
        {submitLabel}
      </QuietAction>
      <QuietAction type="button" kind="secondary" onClick={onCancel}>
        Cancel
      </QuietAction>
    </div>
  );
}

export function TaskForm({
  task,
  textingLinked,
  onDone,
}: {
  task?: TaskRowView;
  textingLinked: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const action = task ? updateTaskAction.bind(null, task.id) : createTaskAction;
  const [state, formAction, pending] = useActionState(
    async (prev: TaskActionState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.error === null) {
        onDone();
        router.refresh();
      }
      return result;
    },
    INITIAL_STATE,
  );

  const defaults = {
    label: task?.label ?? "",
    prompt: task?.prompt ?? "",
    weekdays: new Set(task?.weekdays ?? [1, 2, 3, 4, 5]),
    // 3pm, not 9am: the morning brief already texts at 9, and a new
    // task should not stack on it unless she picks that on purpose
    // (reader gate 2026-07-13).
    localHour: task?.localHour ?? 15,
    deliveryPref: task?.deliveryPref ?? "text",
  };

  return (
    <form action={formAction} className="flex flex-col gap-3" data-brand-surface="task-form">
      {/* Example task swapped from a reminder to a look-it-up ask
          (reader gate 2026-07-12): reminders are the obvious use, the
          example is the one place that shows Homa can research too.
          No cadence words in the example (editor gate, same day): the
          day and time fields below are the one home for timing. */}
      <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--homa-ink)]">
        What should it be called?
        <input
          name="label"
          defaultValue={defaults.label}
          placeholder="Phonics game ideas"
          maxLength={60}
          required
          className={taskInputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--homa-ink)]">
        What should Homa do?
        <textarea
          name="prompt"
          defaultValue={defaults.prompt}
          placeholder="Find one new phonics game and explain how to play it."
          maxLength={1000}
          rows={3}
          required
          className={taskInputClass}
        />
      </label>

      <WeekdayChips defaultSelected={defaults.weekdays} />

      <div className="flex flex-wrap gap-4">
        <HourField defaultHour={defaults.localHour} />
        <DeliveryChoice
          values={["text", "email", "none"]}
          defaultValue={defaults.deliveryPref}
          textingLinked={textingLinked}
        />
      </div>

      {state.error ? <QuietStatus tone="error" className="text-sm">{state.error}</QuietStatus> : null}

      {/* "Add this task", never "Create task": the button that opened
          this dialog says "Add a task", and one action keeps one name
          (editor gate 2026-07-12). */}
      <TaskFormButtons
        pending={pending}
        submitLabel={task ? "Save changes" : "Add this task"}
        onCancel={onDone}
      />
    </form>
  );
}
