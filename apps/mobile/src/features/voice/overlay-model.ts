import type { EveMessagePart } from "eve/react";

import type { MaterialArtifact } from "../chat/material-card";
import {
  parsePreparedPrintRequest,
  type PreparedPrintRequest,
} from "../materials/material-print-contract";
import { memoryChipFor } from "../chat/message-utils";
import {
  parseQuestionCardPart,
  type QuestionCardData,
} from "../chat/question-card-model";
import type { StateRecordAction } from "../../lib/state-records";
import {
  parseMonthPlanPreview,
  type MonthPlanPreview,
} from "../planner/month-plan-preview-model";

/**
 * Overlay signals for the voice-first screen: pure derivation from the
 * live session's messages, no rendering. A completed dynamic-tool part
 * is an open/refresh SIGNAL, never the data source; the overlay bodies
 * (overlay-host.tsx) read the real rows through the parent's own
 * RLS-scoped queries.
 *
 * Dedup follows the web planner-canvas idiom
 * (apps/web/app/app/chat-client.tsx, handledPlannerPartKeyRef): at mount
 * the caller seeds handledKeys with every key already present, so a
 * restored session never replays its overlays; only parts that stream in
 * after mount fire. Silence on a real effect is the ruled-against
 * failure mode (MJ-02), so anything not in the small internal ignore set
 * lands as at least a receipt.
 */

/** The chat material payload, reused verbatim (material-card.tsx owns it). */
export type MaterialCardPayload = MaterialArtifact;

export type OverlaySignal =
  | { kind: "planner"; key: string; refreshCount: number }
  | {
      kind: "material";
      key: string;
      material: MaterialCardPayload;
      printRequest?: PreparedPrintRequest;
    }
  | { kind: "question"; key: string; card: QuestionCardData }
  | { kind: "hours"; key: string }
  | { kind: "state_records"; key: string; action: StateRecordAction }
  | { kind: "monthPlan"; key: string; preview: MonthPlanPreview }
  | {
      kind: "receipt";
      key: string;
      toolName: string;
      summary: string;
      materialId?: string;
    };

/** A receipt toast's signal, the shape OverlayHost's onReceiptPress
 * hands back to the screen. */
export type ReceiptSignal = Extract<OverlaySignal, { kind: "receipt" }>;

export interface OverlayModelState {
  active: OverlaySignal | null;
  receipts: OverlaySignal[];
}

export const EMPTY_OVERLAY_MODEL: OverlayModelState = {
  active: null,
  receipts: [],
};

/** Plan-writing tools and the output flag marking a real write, the
 * same pairs web's planner canvas refreshes on (planner-canvas.tsx). */
const PLAN_WRITE_TOOLS: Record<string, string> = {
  edit_plan: "updated",
  schedule_plan_activity: "scheduled",
};

/** create_worksheet is the retired v1 name still present in legacy
 * transcripts; show_material re-surfaces an existing material (the same
 * alias list message-view.tsx renders as a card). */
const MATERIAL_TOOLS = new Set([
  "create_printable",
  "show_material",
  "create_worksheet",
  "prepare_material_print",
]);

/**
 * Internals that stay quiet, mirroring what the chat transcript
 * deliberately hides (message-view.tsx renders none of these):
 * reads feed Homa's spoken reply and the reply is their surface,
 * conversation furniture belongs to the transcript, journaling is a
 * deliberately quiet background capture, and making internals resolve
 * into the material overlay that follows them.
 */
const IGNORED_TOOLS = new Set([
  // Reads and lookups.
  "recall",
  "load_skill",
  "get_children",
  "find_materials",
  "find_attachments",
  "find_hours",
  "find_lesson_recordings",
  "find_curriculum_profile",
  "search_photos",
  "list_tasks",
  "list_family_events",
  "explore_child_map",
  "describe_attachment",
  "web_fetch",
  "get_agent_job_status",
  // Conversation furniture the transcript owns. ask_user_questions is
  // only here as a backstop: a LIVE ask becomes the question sheet
  // (liveQuestionIn below); this entry keeps spent and malformed asks
  // from falling through to a "Done: ask user questions" receipt.
  "ask_user_questions",
  "ask_for_photo",
  "ask_for_details",
  "start_checklist",
  "start_first_making",
  // Journal internals: progress journaling is a quiet background capture.
  "manage_child_progress",
  // Making internals: the material overlay is the delivery.
  "generate_image",
  // Sandbox internals.
  "bash",
  "write_file",
  "read_file",
  "glob",
  "grep",
]);

/** Output flags that mark success across Homa's tools. When an output
 * carries any of these and every one present is false, the effect did
 * not happen and Homa narrates that herself; no receipt. */
const SUCCESS_FLAGS = [
  "done",
  "logged",
  "saved",
  "updated",
  "added",
  "created",
  "scheduled",
  "sent",
  "removed",
  "deleted",
  "finalized",
  "opened",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface CompletedToolPart {
  toolName: string;
  output: Record<string, unknown>;
  raw: unknown;
}

function completedToolPart(part: unknown): CompletedToolPart | null {
  if (!isRecord(part)) return null;
  if (part.type !== "dynamic-tool" || part.state !== "output-available") {
    return null;
  }
  if (typeof part.toolName !== "string") return null;
  return {
    toolName: part.toolName,
    output: isRecord(part.output) ? part.output : {},
    raw: part,
  };
}

function materialPayload(
  output: Record<string, unknown>,
): MaterialCardPayload | null {
  // previewUrl guards out refusals and pre-studio legacy payloads, the
  // same rule message-utils.ts's partIsRenderable applies.
  const candidate = output.material ?? output.worksheet;
  if (!isRecord(candidate)) return null;
  if (typeof candidate.previewUrl !== "string" || candidate.previewUrl.length === 0) {
    return null;
  }
  return candidate as unknown as MaterialCardPayload;
}

function receiptSummaryFor(part: CompletedToolPart): string | null {
  const { toolName, output } = part;
  if (toolName === "log_hours") {
    if (output.logged !== true) return null;
    if (typeof output.subject === "string" && typeof output.minutes === "number") {
      return `Hours saved: ${output.subject}, ${output.minutes} min`;
    }
    // The double-log guard path returns logged without the fields; the
    // block is on the record either way.
    return "Hours saved";
  }
  // Named-effect chips (remember, forget, update_child_profile,
  // save_skill, forget_skill, mark_material_final) reuse the transcript
  // wording so voice and chat say the same thing about the same effect.
  const chip = memoryChipFor(part.raw as EveMessagePart);
  if (chip) {
    return chip.detail ? truncate(`${chip.label}: ${chip.detail}`) : chip.label;
  }
  // Calendar effects, worded like web's transcript receipts
  // (apps/web/app/app/message-parts.tsx).
  if (toolName === "add_family_event") {
    if (output.added !== true || typeof output.title !== "string") return null;
    return truncate(`On the calendar: ${output.title}`);
  }
  if (toolName === "update_family_event") {
    const title = isRecord(output.event) ? output.event.title : undefined;
    if (output.updated !== true || typeof title !== "string") return null;
    return truncate(`Calendar updated: ${title}`);
  }
  if (toolName === "remove_family_event") {
    if (output.removed !== true || typeof output.title !== "string") return null;
    return truncate(`Off the calendar: ${output.title}`);
  }
  // Generic fallback: any other completed tool gets a one-line receipt
  // unless its own output says the effect did not happen.
  if (typeof output.error === "string" && output.error.length > 0) return null;
  const presentFlags = SUCCESS_FLAGS.filter(
    (flag) => typeof output[flag] === "boolean",
  );
  if (presentFlags.length > 0 && !presentFlags.some((flag) => output[flag] === true)) {
    return null;
  }
  return `Done: ${toolName.replace(/_/g, " ")}`;
}

/**
 * An ask_user_questions part as a card, whatever state the part sits
 * in. eve fact: the turn can END with the part still at
 * "input-available" (Homa stops there and waits for the answer), and
 * the tool's execute is a pure echo of its input, so a complete input
 * already carries the whole card. Both states route through chat's own
 * parser (question-card-model.ts), never a second implementation: an
 * input-available part is reshaped to the output parseQuestionCardPart
 * expects, so option and question validation stay single-homed.
 */
function questionCardFromPart(raw: unknown): QuestionCardData | null {
  if (!isRecord(raw)) return null;
  if (raw.type !== "dynamic-tool" || raw.toolName !== "ask_user_questions") {
    return null;
  }
  if (raw.state === "output-available") {
    return parseQuestionCardPart(raw as unknown as EveMessagePart);
  }
  if (raw.state !== "input-available") return null;
  const input = isRecord(raw.input) ? raw.input : {};
  return parseQuestionCardPart({
    type: "dynamic-tool",
    toolName: "ask_user_questions",
    state: "output-available",
    output: { asked: true, questions: input.questions },
  } as unknown as EveMessagePart);
}

interface LiveQuestion {
  key: string;
  card: QuestionCardData;
}

/**
 * The one card that may still be answered, chat's latestQuestionRequest
 * rule verbatim (question-card-model.ts): the newest question with no
 * user message after it. Anything older or already answered never
 * becomes a sheet, so a spent card cannot invite a second tap from the
 * voice surface either.
 */
function liveQuestionIn(messages: unknown[]): LiveQuestion | null {
  let latest: LiveQuestion | null = null;
  messages.forEach((message, messageIndex) => {
    if (!isRecord(message)) return;
    if (message.role === "user") {
      latest = null;
      return;
    }
    if (message.role !== "assistant") return;
    if (!Array.isArray(message.parts)) return;
    const messageId =
      typeof message.id === "string" ? message.id : `m${messageIndex}`;
    message.parts.forEach((rawPart, partIndex) => {
      const card = questionCardFromPart(rawPart);
      if (card !== null) {
        latest = { key: `${messageId}:${partIndex}`, card };
      }
    });
  });
  return latest;
}

function buildSignal(
  part: CompletedToolPart,
  key: string,
  planWrites: number,
): { signal: OverlaySignal; planWrites: number } | null {
  const { toolName, output } = part;
  if (toolName === "open_planner") {
    if (output.opened !== true) return null;
    return {
      signal: { kind: "planner", key, refreshCount: planWrites },
      planWrites,
    };
  }
  if (toolName === "open_state_records") {
    if (output.opened !== true) return null;
    const action = output.action;
    if (action !== "view" && action !== "generate_pack" && action !== "generate_filing") {
      return null;
    }
    return {
      signal: { kind: "state_records", key, action },
      planWrites,
    };
  }
  if (toolName === "preview_month_plan") {
    if (output.previewed !== true) return null;
    const preview = parseMonthPlanPreview(output.preview);
    if (preview === null) return null;
    return {
      signal: { kind: "monthPlan", key, preview },
      planWrites,
    };
  }
  const planWriteFlag = PLAN_WRITE_TOOLS[toolName];
  if (planWriteFlag !== undefined) {
    if (output[planWriteFlag] !== true) return null;
    // A write while the planner is already up arrives as a planner
    // signal with a higher refreshCount: applyOverlaySignal keeps the
    // sheet mounted and the body refetches instead of reopening.
    const next = planWrites + 1;
    return { signal: { kind: "planner", key, refreshCount: next }, planWrites: next };
  }
  if (MATERIAL_TOOLS.has(toolName)) {
    const material = materialPayload(output);
    if (material === null) return null;
    const printRequest = toolName === "prepare_material_print"
      ? parsePreparedPrintRequest(output.printRequest)
      : null;
    if (toolName === "prepare_material_print" && !printRequest) return null;
    return {
      signal: {
        kind: "material",
        key,
        material,
        ...(printRequest ? { printRequest } : {}),
      },
      planWrites,
    };
  }
  if (IGNORED_TOOLS.has(toolName)) return null;
  const summary = receiptSummaryFor(part);
  if (summary === null) return null;
  return {
    signal: {
      kind: "receipt",
      key,
      toolName,
      summary,
      ...(toolName === "mark_material_final" && typeof output.materialId === "string"
        ? { materialId: output.materialId }
        : {}),
    },
    planWrites,
  };
}

/**
 * Walks eve UIMessage-shaped objects for dynamic-tool parts with
 * state === "output-available" and turns them into overlay signals.
 *
 * Returns every signal-worthy part's session-scoped key in `keys`
 * (handled or not, so a mount can seed its handled set with all of
 * them), and in `signals` only the ones NOT yet in handledKeys, in
 * message-then-part order. Plan-write counting spans the whole walk,
 * handled parts included, so refreshCount stays monotonic across the
 * session.
 *
 * ask_user_questions parts are special two ways: only the LIVE card
 * can signal (liveQuestionIn's newest-unanswered rule, so an answered
 * card never re-opens), and the part may still sit at "input-available"
 * when the turn ends waiting on the parent. "hours" never derives from
 * messages at all: no tool opens it, the screen does (a receipt tap),
 * so this walk only ever yields planner, material, question, and
 * receipt.
 */
export function deriveOverlaySignals(
  messages: unknown[],
  handledKeys: ReadonlySet<string>,
): { signals: OverlaySignal[]; keys: string[] } {
  const signals: OverlaySignal[] = [];
  const keys: string[] = [];
  let planWrites = 0;
  const liveQuestion = liveQuestionIn(messages);
  messages.forEach((message, messageIndex) => {
    if (!isRecord(message)) return;
    if (message.role !== "assistant") return;
    if (!Array.isArray(message.parts)) return;
    const messageId =
      typeof message.id === "string" ? message.id : `m${messageIndex}`;
    message.parts.forEach((rawPart, partIndex) => {
      const key = `${messageId}:${partIndex}`;
      if (liveQuestion !== null && key === liveQuestion.key) {
        keys.push(key);
        if (!handledKeys.has(key)) {
          signals.push({ kind: "question", key, card: liveQuestion.card });
        }
        return;
      }
      const part = completedToolPart(rawPart);
      if (part === null) return;
      const built = buildSignal(part, key, planWrites);
      if (built === null) return;
      planWrites = built.planWrites;
      keys.push(key);
      if (!handledKeys.has(key)) signals.push(built.signal);
    });
  });
  return { signals, keys };
}

/**
 * One overlay at a time. Sheets (planner, material, question, hours)
 * take the stage immediately, so a question replaces whatever sheet is
 * up; receipts wait their turn in FIFO order while anything else is up,
 * so a toast never tears down the sheet the parent is looking at. A
 * planner signal landing while the planner is active simply becomes the
 * new active signal: same kind, higher refreshCount, so the mounted
 * sheet refetches instead of reanimating open.
 */
export function applyOverlaySignal(
  state: OverlayModelState,
  signal: OverlaySignal,
): OverlayModelState {
  if (signal.kind === "receipt") {
    const active = signal.toolName === "mark_material_final"
      && signal.materialId
      && state.active?.kind === "material"
      && state.active.material.id === signal.materialId
      ? {
          ...state.active,
          material: { ...state.active.material, status: "final" as const },
        }
      : state.active;
    if (active === null) return { active: signal, receipts: state.receipts };
    return { active, receipts: [...state.receipts, signal] };
  }
  return { active: signal, receipts: state.receipts };
}

/** Dismissing the active overlay promotes the oldest queued receipt. */
export function dismissActiveOverlay(state: OverlayModelState): OverlayModelState {
  const [next, ...rest] = state.receipts;
  return { active: next ?? null, receipts: rest };
}
