import type { TaskRunView } from "../../lib/tasks";

/**
 * Pure view-model helpers, ported from apps/web/app/app/tasks/
 * {tasks-view.tsx,task-copy.ts,task-history.tsx} and
 * apps/web/lib/tasks/research-brief-feedback-contract.ts's eligibility
 * rule. No IO here; that lives in use-tasks-data.ts and lib/tasks.ts.
 */

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

export function hourLabel(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${hour < 12 ? "am" : "pm"}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdaysLabel(weekdays: number[]): string {
  const set = new Set(weekdays);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return [...set]
    .sort((a, b) => a - b)
    .map((day) => DAY_SHORT[day])
    .join(", ");
}

export function nextRunLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

const RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEYS = [
  "done:sms",
  "done:email",
  "done:none",
  "partial:sms",
  "partial:email",
  "partial_uncertain:sms",
  "partial_uncertain:email",
];

/** Deterministic verification, not judgment: mirrors the database
 * constraint exactly (research-brief-feedback-contract.ts), so it stays
 * plain code rather than anything model-driven. */
export function isResearchBriefFeedbackEligible(run: TaskRunView): boolean {
  const outcomeKey = `${run.status}:${run.deliveredChannel ?? ""}`;
  return run.kind === "morning_brief" && RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEYS.includes(outcomeKey);
}

/** Failure copy stays calm by design law: no red, no alarm. */
export function statusNote(run: TaskRunView): string | null {
  switch (run.status) {
    case "done":
      return run.deliveredChannel === "sms"
        ? "Sent by text."
        : run.deliveredChannel === "email"
          ? "Sent by email."
          : run.deliveredChannel === "none"
            ? "Saved to this page."
            : null;
    case "skipped":
      return "Skipped: this task's scheduled time had passed. It is scheduled again at its next time.";
    case "partial":
      return "It reached at least one family member. It is available on this page.";
    case "partial_uncertain":
      return "It reached at least one family member. Homa can't tell yet whether other deliveries arrived. It is available on this page.";
    case "uncertain":
      return "Homa couldn't confirm delivery. Nothing else needs your attention right now.";
    case "failed":
      return "This task did not send.";
    case "running":
      return "Homa is preparing this task now.";
    default:
      return null;
  }
}

export function showsAskHoma(run: TaskRunView): boolean {
  return run.status === "done";
}

function dayKey(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

export function timeLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export interface TaskRunDayGroup {
  key: string;
  label: string;
  runs: TaskRunView[];
}

/** One group per family-local day, newest first (assumes runs already
 * arrive newest-first, the API's own order). */
export function groupRunsByDay(runs: TaskRunView[], timeZone: string, now: Date): TaskRunDayGroup[] {
  const todayKey = dayKey(now, timeZone);
  const yesterdayKey = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);

  const groups: TaskRunDayGroup[] = [];
  for (const run of runs) {
    const started = new Date(run.startedAt);
    const key = dayKey(started, timeZone);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.runs.push(run);
      continue;
    }
    groups.push({
      key,
      label:
        key === todayKey
          ? "Today"
          : key === yesterdayKey
            ? "Yesterday"
            : started.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone,
              }),
      runs: [run],
    });
  }
  return groups;
}
