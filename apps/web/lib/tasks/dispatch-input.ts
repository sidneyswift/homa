import {
  loadBriefContext,
  loadBriefV2Context,
  renderBriefContext,
  renderBriefV2Context,
  researchBriefV2ContextIsAnchorable,
} from "./brief-context";
import {
  deliveryVersionForNewTaskRun,
  usesResearchBriefV2Delivery,
  type TaskDeliveryVersion,
} from "./delivery-version";
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

export const NO_ELIGIBLE_RESEARCH_BRIEF_CANDIDATE_ERROR =
  "no eligible morning brief candidate";

/** The v2 selection query found no family-eligible research to send. */
export class NoEligibleResearchBriefCandidateError extends Error {
  constructor() {
    super(NO_ELIGIBLE_RESEARCH_BRIEF_CANDIDATE_ERROR);
    this.name = "NoEligibleResearchBriefCandidateError";
  }
}

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
  loadV2Context: typeof loadBriefV2Context,
  deliveryVersion: TaskDeliveryVersion,
): Promise<string> {
  const v2 = usesResearchBriefV2Delivery(deliveryVersion);
  let context: string;
  if (v2) {
    const v2Context = await loadV2Context(task.familyId, task.timeZone);
    // Skip before a run when no child pairs a candidate with a concrete anchor.
    // A candidate alone is not a brief: an anchorless family stalls the model at
    // preparation_load, which would finalize as a false failure (2026-07-20).
    if (!researchBriefV2ContextIsAnchorable(v2Context)) {
      throw new NoEligibleResearchBriefCandidateError();
    }
    context = renderBriefV2Context(v2Context);
  } else {
    context = renderBriefContext(await loadContext(task.familyId));
  }
  return [
    trigger === "manual"
      ? "The parent just asked, from the Homa's tasks page, to run the morning research brief once right now."
      : "It is this family's weekday morning research brief moment.",
    "Load the research-brief skill FIRST and follow it exactly; it holds the selection rules, required format, and guardrails.",
    "",
    context,
    "",
    v2
      ? "Choose exactly one child and one eligible candidate. Draft first, call prepare_research_brief with that child and candidate, then output only the accepted stored draft. Do not call recall for routine novelty. Never render citation URLs."
      : "Follow the skill's exact four-block format: research headline, What I learned, Why it's interesting, and one executable Want me to CTA. Preserve the blank lines. Do not add a preamble, sign-off, saved-note line, or URL.",
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
      "Compose the reply yourself from the parent's instructions and this knowledge. This is not the built-in prepared morning brief: do not call prepare_research_brief.",
      "",
    );
  }
  lines.push(
    "If you truly cannot do the task, tell the parent in one short warm sentence what you could not prepare today and offer one easy alternative. Never mention tools, dispatch runs, or internal state.",
    deliveryLine,
  );
  return lines.join("\n");
}

/** The full model message for one run. The brief's context load is
 * injectable so tests never need a database. */
export async function buildTaskMessage(
  task: DueFamilyTask,
  trigger: TaskRunTrigger,
  loadContext: typeof loadBriefContext = loadBriefContext,
  dependencies: {
    deliveryVersion?: TaskDeliveryVersion;
    loadV2Context?: typeof loadBriefV2Context;
    /** Ignored. Kept temporarily so flag-flip regression tests can prove the
     * persisted version, not current process state, owns this decision. */
    environment?: Record<string, string | undefined>;
  } = {},
): Promise<string> {
  switch (task.kind) {
    case "journal_prompt":
      return journalMessage(task, trigger);
    case "morning_brief":
      return await briefMessage(
        task,
        trigger,
        loadContext,
        dependencies.loadV2Context ?? loadBriefV2Context,
        dependencies.deliveryVersion ?? "legacy",
      );
    case "custom":
      return await customMessage(task, trigger, loadContext);
    default: {
      const exhaustive: never = task.kind;
      throw new Error(`unhandled task kind: ${String(exhaustive)}`);
    }
  }
}

export type TaskDispatchPreflightResult =
  | {
      outcome: "ready";
      deliveryVersion: TaskDeliveryVersion;
      message: string;
    }
  | {
      outcome: "skip";
      deliveryVersion: TaskDeliveryVersion;
      reason: typeof NO_ELIGIBLE_RESEARCH_BRIEF_CANDIDATE_ERROR;
    };

/**
 * Selects one delivery version, then builds or classifies the task before any
 * run row exists. Callers persist and dispatch only this returned version.
 */
export async function preflightTaskDispatch(
  task: DueFamilyTask,
  trigger: TaskRunTrigger,
  loadContext: typeof loadBriefContext = loadBriefContext,
  dependencies: {
    environment?: Record<string, string | undefined>;
    loadV2Context?: typeof loadBriefV2Context;
  } = {},
): Promise<TaskDispatchPreflightResult> {
  const deliveryVersion = deliveryVersionForNewTaskRun(
    task.kind,
    dependencies.environment,
    task.familySandbox,
  );
  try {
    return {
      outcome: "ready",
      deliveryVersion,
      message: await buildTaskMessage(task, trigger, loadContext, {
        deliveryVersion,
        loadV2Context: dependencies.loadV2Context,
      }),
    };
  } catch (error) {
    if (error instanceof NoEligibleResearchBriefCandidateError) {
      return {
        outcome: "skip",
        deliveryVersion,
        reason: NO_ELIGIBLE_RESEARCH_BRIEF_CANDIDATE_ERROR,
      };
    }
    throw error;
  }
}

/** The dispatch channel's target payload: who this run is for and how
 * its composed message should reach her. */
export function buildDispatchTarget(
  task: DueFamilyTask,
  runId: string,
  episodeId: string,
  deliveryVersion: TaskDeliveryVersion = "legacy",
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
    deliveryVersion,
  };
}

/** The session's auth identity. Both doors stamp the same dispatcher
 * principal and the same attributes, so family pinning, instructions,
 * and the persist hook treat manual runs exactly like scheduled ones. */
export function buildDispatchAuth(
  task: DueFamilyTask,
  runId: string,
  episodeId: string,
  deliveryVersion: TaskDeliveryVersion = "legacy",
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
      deliveryVersion,
    },
  };
}
