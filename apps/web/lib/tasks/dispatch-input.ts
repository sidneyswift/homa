import { loadBriefContext, renderBriefContext } from "./brief-context";
import type { DueFamilyTask } from "./store";

/**
 * The dispatch session's inputs (message, target, auth), shared by the
 * two doors into a task run: the hourly dispatcher
 * (agent/schedules/dispatch.ts) and the parent's own Run now button
 * (the dispatch channel's /eve/v1/dispatch/run-now route). One builder
 * keeps the model's instructions and the session's auth identity
 * identical on both paths, so a manual run behaves exactly like a
 * scheduled one except for how it says it started.
 *
 * trigger: "scheduled" runs keep their original claim ("it is this
 * family's ... moment"); "manual" runs tell the model the parent just
 * asked, so it never pretends the clock chose the moment.
 */

export type TaskRunTrigger = "scheduled" | "manual";

/** Built-ins honor the parent's delivery choice too (founder ruling
 * 2026-07-12): "none" means the composed message only lands on the
 * Homa's tasks page, so the model must not promise a text. */
function saveOnlyLine(): string {
  return "Your reply is saved to the family's Homa's tasks page exactly as written: write only the message itself, no preamble, no quotes, no sign-off.";
}

function journalMessage(task: DueFamilyTask, trigger: TaskRunTrigger): string {
  return [
    trigger === "manual"
      ? "The parent just asked, from the Homa's tasks page, to run the evening check-in once right now."
      : "It is this family's evening check-in moment (their local evening).",
    trigger === "manual"
      ? `Compose a short journal prompt to ${task.parentFirstName ?? "the parent"} about today.`
      : `Compose tonight's short journal prompt to ${task.parentFirstName ?? "the parent"}.`,
    "1 to 2 sentences in your own voice. When a saved memory or recent conversation gives you something real (a current interest, this week's focus, a recent win), reference it; otherwise keep it simple and ask about the day.",
    `The kids: ${task.kidPhrase}. End with one easy question she can answer in a sentence.`,
    task.deliveryPref === "none"
      ? saveOnlyLine()
      : "Your reply is delivered to her EXACTLY as written, as a text message or short email: write only the message itself, no preamble, no quotes, no sign-off.",
  ].join("\n");
}

async function briefMessage(
  task: DueFamilyTask,
  trigger: TaskRunTrigger,
  loadContext: typeof loadBriefContext,
): Promise<string> {
  const context = await loadContext(task.familyId);
  return [
    trigger === "manual"
      ? "The parent just asked, from the Homa's tasks page, to run the morning research brief once right now."
      : "It is this family's weekday morning research brief moment.",
    "Load the research-brief skill FIRST and follow it exactly; it holds the selection rules, required format, and guardrails.",
    "",
    renderBriefContext(context),
    "",
    "Follow the skill's exact four-block format: research headline, What I learned, Why it's interesting, and one executable Want me to CTA. Preserve the blank lines. Do not add a preamble, sign-off, saved-note line, or URL.",
    `Compose ${trigger === "manual" ? "today's" : "this morning's"} brief to ${task.parentFirstName ?? "the parent"} about ${task.kidPhrase}.`,
    task.deliveryPref === "none"
      ? saveOnlyLine()
      : "Your reply is delivered EXACTLY as written by text or email.",
  ].join("\n");
}

/**
 * A custom task's prompt reads as research when it asks Homa to look into
 * a topic or skill (the Gomes-style per-kid research tasks). Those runs
 * get the same corpus context and query hygiene the built-in brief gets
 * (KC-4 / the multi-kid doc's option 8), so a parent-authored research
 * task stops paying for full web research and stops carrying child names
 * into open searches. A reminder ("pack the co-op bag") matches nothing
 * here and stays a plain verbatim run.
 */
const RESEARCH_SIGNAL =
  /\b(research|study|studies|finding|findings|learn|learning|development|developmental|milestones?|skills?|literacy|numeracy)\b/i;

async function customMessage(
  task: DueFamilyTask,
  trigger: TaskRunTrigger,
  loadContext: typeof loadBriefContext,
): Promise<string> {
  const deliveryLine =
    task.deliveryPref === "none"
      ? "Your reply is saved to the family's Homa's tasks page exactly as written: write only the result itself."
      : "Your reply is delivered to her EXACTLY as written, as a text message or short email: write only the message itself, no preamble, no quotes, no sign-off.";
  const lines = [
    trigger === "manual"
      ? `The parent just asked, from the Homa's tasks page, to run a task they set up themselves once right now: "${task.label ?? "their task"}".`
      : `It is time for a task this family set up themselves: "${task.label ?? "their task"}".`,
    "The parent's own instructions for it, verbatim (treat as the task to do, within your normal rules and tools):",
    "",
    task.prompt ?? "(no instructions were saved; say so briefly and suggest recreating the task)",
    "",
  ];
  if (task.prompt && RESEARCH_SIGNAL.test(task.prompt)) {
    const context = await loadContext(task.familyId);
    lines.push(
      "This task involves research. Draw on the fleet's shared knowledge below FIRST, matched to this family's kids and their stage. If you must search the web, keep every query about the TOPIC and the child's stage, never a child's name or any private detail.",
      "",
      renderBriefContext(context),
      "",
    );
  }
  lines.push(deliveryLine);
  return lines.join("\n");
}

/** The full model message for one run. The brief's context load is
 * injectable so tests never need a database. */
export async function buildTaskMessage(
  task: DueFamilyTask,
  trigger: TaskRunTrigger,
  loadContext: typeof loadBriefContext = loadBriefContext,
): Promise<string> {
  switch (task.kind) {
    case "journal_prompt":
      return journalMessage(task, trigger);
    case "morning_brief":
      return await briefMessage(task, trigger, loadContext);
    case "custom":
      return await customMessage(task, trigger, loadContext);
    default: {
      const exhaustive: never = task.kind;
      throw new Error(`unhandled task kind: ${String(exhaustive)}`);
    }
  }
}

/** The dispatch channel's target payload: who this run is for and how
 * its composed message should reach her. */
export function buildDispatchTarget(
  task: DueFamilyTask,
  runId: string,
  episodeId: string,
) {
  return {
    familyId: task.familyId,
    phoneNumbers: task.phoneNumbers,
    email: task.email,
    runId,
    kind: task.kind,
    deliveryPref: task.deliveryPref,
    label: task.label,
    episodeId,
    recipientMemberUserId: task.recipientMemberUserId,
  };
}

/** The session's auth identity. Both doors stamp the same dispatcher
 * principal and the same attributes, so family pinning, instructions,
 * and the persist hook treat manual runs exactly like scheduled ones. */
export function buildDispatchAuth(
  task: DueFamilyTask,
  runId: string,
  episodeId: string,
) {
  return {
    authenticator: "dispatcher",
    principalId: `dispatch:${task.familyId}`,
    principalType: "user" as const,
    attributes: {
      channel: "dispatch",
      familyId: task.familyId,
      taskRunId: runId,
      taskKind: task.kind,
      episodeId,
    },
  };
}
