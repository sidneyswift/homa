"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { QuietAction } from "../../../components/design/QuietAction";
import { QuietStatus } from "../../../components/design/QuietStatus";

import {
  deleteTaskAction,
  runTaskNowAction,
  updateTaskScheduleAction,
  type TaskActionState,
} from "./actions";
import { DialogShell } from "./dialog-shell";
import { BUILT_IN_COPY } from "./task-copy";
import {
  DeliveryChoice,
  HourField,
  TaskForm,
  TaskFormButtons,
  WeekdayChips,
} from "./task-form";
import type { TaskRowView } from "./tasks-view";

/**
 * The task editor dialog: clicking a task card (or "Add a task") opens
 * it. Focus-trap and Escape behavior mirror the Binder's
 * MaterialDetailOverlay, the house pattern for centered dialogs.
 * Custom tasks get the full form plus delete; built-in kinds
 * (morning brief, evening check-in) keep their fixed words and expose
 * only the schedule: which days, what time, and how it reaches her
 * (text, email, or saved to the page).
 */

const INITIAL_STATE: TaskActionState = { error: null };

function BuiltInScheduleForm({
  task,
  textingLinked,
  onDone,
}: {
  task: TaskRowView;
  textingLinked: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: TaskActionState, formData: FormData) => {
      const result = await updateTaskScheduleAction(task.id, prev, formData);
      if (result.error === null) {
        onDone();
        router.refresh();
      }
      return result;
    },
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <WeekdayChips defaultSelected={new Set(task.weekdays)} />
      <div className="flex flex-wrap gap-4">
        <HourField defaultHour={task.localHour} />
        {/* All three doors for built-ins too (founder ruling 2026-07-12
            evening): text, email, or just the web page. */}
        <DeliveryChoice
          values={["text", "email", "none"]}
          defaultValue={task.deliveryPref}
          textingLinked={textingLinked}
        />
      </div>
      {state.error ? <QuietStatus tone="error" className="text-sm">{state.error}</QuietStatus> : null}
      <TaskFormButtons pending={pending} submitLabel="Save changes" onCancel={onDone} />
    </form>
  );
}

/** One immediate run, any kind. Success closes the dialog: the run
 * appears in History as "Working on it now", which is the feedback. A
 * refusal (already running, not eligible yet) stays in the dialog. */
function RunNowSection({ task, onDone }: { task: TaskRowView; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
          Homa runs this task right away, exactly as saved. The result shows
          up in History. The schedule stays the same.
        </p>
        <QuietAction
          kind="secondary"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await runTaskNowAction(task.id);
              if (result.error === null) {
                onDone();
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
          className="shrink-0"
        >
          {pending ? "Starting\u2026" : "Run now"}
        </QuietAction>
      </div>
      {error ? <QuietStatus tone="error" className="mt-2 text-sm">{error}</QuietStatus> : null}
    </div>
  );
}

/** Two taps to delete, both inside the dialog: the browser's own
 * confirm box was the one grey system popup in a product of house
 * dialogs (reader gate 2026-07-13). */
function DeleteTaskButton({ task, onDone }: { task: TaskRowView; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const name = task.label ?? "Your task";

  if (!confirming) {
    return (
      <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
        <QuietAction kind="quiet" className="px-0 text-xs" onClick={() => setConfirming(true)}>
          Delete this task
        </QuietAction>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
          {`Delete "${name}"? This can't be undone.`}
        </p>
        <div className="flex shrink-0 gap-2">
          <QuietAction
            kind="secondary"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await deleteTaskAction(task.id);
                if (result.error === null) {
                  onDone();
                  router.refresh();
                }
              });
            }}
            className="text-xs"
          >
            {pending ? "Deleting\u2026" : "Delete"}
          </QuietAction>
          <QuietAction kind="quiet" className="text-xs" onClick={() => setConfirming(false)}>
            Keep
          </QuietAction>
        </div>
      </div>
    </div>
  );
}

/** task = null means create a new custom task. */
export function TaskEditOverlay({
  task,
  textingLinked,
  onClose,
}: {
  task: TaskRowView | null;
  textingLinked: boolean;
  onClose: () => void;
}) {
  const builtIn = task && task.kind !== "custom" ? BUILT_IN_COPY[task.kind] : null;
  const heading = builtIn ? builtIn.label : task ? "Edit task" : "Add a task";

  return (
    <DialogShell titleId="task-edit-title" heading={heading} onClose={onClose}>
      {builtIn && task ? (
        <>
          {/* One sentence on what the task does, the card's own
              description (founder ruling 2026-07-12; it replaced a
              three-sentence you-decide explainer). */}
          <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">{builtIn.description}</p>
          <div className="mt-4">
            <BuiltInScheduleForm
              task={task}
              textingLinked={textingLinked}
              onDone={onClose}
            />
            <RunNowSection task={task} onDone={onClose} />
          </div>
        </>
      ) : (
        <div className="mt-4">
          <TaskForm
            task={task ?? undefined}
            textingLinked={textingLinked}
            onDone={onClose}
          />
          {task ? <RunNowSection task={task} onDone={onClose} /> : null}
          {task ? <DeleteTaskButton task={task} onDone={onClose} /> : null}
        </div>
      )}
    </DialogShell>
  );
}
