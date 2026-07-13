/**
 * Fixed copy for the built-in task kinds, shared by the card list
 * (tasks-view) and the editor dialog (task-edit-overlay). Copy passed
 * both gates 2026-07-10 and again 2026-07-12 when schedules became
 * editable (the descriptions dropped their cadence words then: the
 * schedule line under each card is the one place that says when, so an
 * edited schedule never contradicts the description). Vocabulary law
 * for this surface: the morning artifact is a "brief" (its card title
 * carries the name, nothing else renames it), parent-created things
 * are "tasks", and results are "saved to this page".
 */

/** How many runs the page loads and History shows. Shared here (a
 * directive-free module) so the server page's query and the client
 * feed's end-of-list line can never disagree. */
export const HISTORY_RUN_LIMIT = 30;

export const BUILT_IN_COPY: Record<
  "morning_brief" | "journal_prompt",
  { label: string; description: string }
> = {
  morning_brief: {
    label: "Morning research brief",
    description: "One thing Homa looked into for your kids, and why it matters.",
  },
  journal_prompt: {
    label: "Evening check-in",
    description: "One easy question. Answer in a sentence and Homa remembers the day.",
  },
};
