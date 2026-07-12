"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import {
  deleteTaskAction,
  updateTaskScheduleAction,
  type TaskActionState,
} from "./actions";
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
 * only the schedule: which days, what time, text or email.
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
        <DeliveryChoice
          values={["text", "email"]}
          defaultValue={task.deliveryPref === "email" ? "email" : "text"}
          textingLinked={textingLinked}
        />
      </div>
      {state.error ? <p className="text-sm text-muted">{state.error}</p> : null}
      <TaskFormButtons pending={pending} submitLabel="Save changes" onCancel={onDone} />
    </form>
  );
}

function DeleteTaskButton({ task, onDone }: { task: TaskRowView; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const name = task.label ?? "Your task";
  return (
    <div className="mt-4 border-t border-border-subtle pt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
          startTransition(async () => {
            const result = await deleteTaskAction(task.id);
            if (result.error === null) {
              onDone();
              router.refresh();
            }
          });
        }}
        className="text-xs font-semibold text-muted hover:underline disabled:opacity-60"
      >
        Delete this task
      </button>
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    function focusableElements(): HTMLElement[] {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.tabIndex >= 0);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!active || !dialogRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const builtIn = task && task.kind !== "custom" ? BUILT_IN_COPY[task.kind] : null;
  const heading = builtIn ? builtIn.label : task ? "Edit task" : "Add a task";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,42,33,0.42)] p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] border border-border-subtle bg-card p-5 shadow-[var(--shadow-xl)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="task-edit-title" className="font-display text-xl font-semibold text-strong">
            {heading}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-page hover:text-body"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {builtIn && task ? (
          <>
            {/* One sentence on what the task does, the card's own
                description (founder ruling 2026-07-12; it replaced a
                three-sentence you-decide explainer). */}
            <p className="mt-1 text-sm text-muted">{builtIn.description}</p>
            <div className="mt-4">
              <BuiltInScheduleForm
                task={task}
                textingLinked={textingLinked}
                onDone={onClose}
              />
            </div>
          </>
        ) : (
          <div className="mt-4">
            <TaskForm
              task={task ?? undefined}
              textingLinked={textingLinked}
              onDone={onClose}
            />
            {task ? <DeleteTaskButton task={task} onDone={onClose} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
