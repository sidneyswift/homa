"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveStudioRunFeedbackAction } from "../actions";
import { STUDIO_FEEDBACK_TAGS } from "../../../../lib/materials/studio-feedback";

/**
 * The iteration loop's capture step (founder ask 2026-07-18 evening):
 * tag chips plus prose on one test run. Saving updates the run row;
 * the Prompt for agent button beside this form copies the improvement
 * packet with this verdict inside, so the loop is tag it, write one
 * sentence, save, copy, paste into a coding agent.
 */

export function StudioFeedbackForm({
  runId,
  initialTags,
  initialFeedback,
  savedAt,
}: {
  runId: string;
  initialTags: string[];
  initialFeedback: string;
  savedAt: string | null;
}) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    );
  };

  const save = () => {
    if (pending) return;
    setNote(null);
    startTransition(async () => {
      const result = await saveStudioRunFeedbackAction(runId, tags, feedback);
      if (result.error) {
        setNote(result.error);
        return;
      }
      setNote("Saved. Copy the packet to hand this run to a coding agent.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Feedback tags">
        {STUDIO_FEEDBACK_TAGS.map((tag) => {
          const active = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(tag)}
              className={
                active
                  ? "rounded-pill border border-[var(--clay-300)] bg-brand-soft px-3 py-1.5 text-[0.76rem] font-bold text-[var(--clay-700)]"
                  : "rounded-pill border border-border-default bg-card px-3 py-1.5 text-[0.76rem] font-semibold text-muted hover:text-strong"
              }
            >
              {tag}
            </button>
          );
        })}
      </div>
      <textarea
        aria-label="Feedback"
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What should have been different about this output?"
        className="w-full rounded-md border border-border-default bg-card px-3 py-2.5 text-[0.88rem] text-body placeholder:text-subtle"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-pill bg-[var(--clay-500)] px-5 py-2 text-[0.82rem] font-bold text-white transition-colors hover:bg-[var(--clay-600)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save feedback"}
        </button>
        {note ? (
          <span className="text-[0.78rem] font-semibold text-muted">{note}</span>
        ) : savedAt ? (
          <span className="text-[0.78rem] text-subtle">Last saved {savedAt}</span>
        ) : null}
      </div>
    </div>
  );
}
