import type { EveMessage, EveMessagePart } from "eve/client";

import { TOOL_STATUS_LABELS } from "../app/tool-activity-labels";
import type { ConversationFeedMessage, ConversationFeedRequest } from "../../lib/conversation-feed";

type ToolPart = Extract<EveMessagePart, { type: "dynamic-tool" }>;
export type ActivityStep = { id: string; label: string; state: "active" | "finished" | "failed" | "waiting" };
export type WorkspaceActivityState = { label: string; steps: ActivityStep[] };

function activityLabel(part: ToolPart): string {
  const kind = part.toolMetadata?.eve?.kind;
  const copy = kind === "load-skill" ? "getting set up…" :
    kind === "subagent-call" ? "working on the details…" :
    TOOL_STATUS_LABELS[part.toolName] ?? "working on your request…";
  return copy.charAt(0).toUpperCase() + copy.slice(1).replace(/…$/, "");
}

function activityState(part: ToolPart): ActivityStep["state"] {
  if (part.state === "output-error" || part.state === "output-denied") return "failed";
  if (part.state === "approval-requested" || part.state === "approval-responded") return "waiting";
  if (part.state !== "output-available") return "active";
  const output = part.output;
  // A returned result can report failure without throwing a transport error.
  if (output && typeof output === "object") {
    const result = output as Record<string, unknown>;
    if (result.error || result.kind === "refused" ||
      (typeof result.exitCode === "number" && result.exitCode !== 0) ||
      ["success", "ok", "created", "generated", "saved", "updated"].some(key => result[key] === false)) return "failed";
  }
  return "finished";
}

/** Derive progress from the current turn's public tool lifecycle, never raw reasoning or arguments. */
export function workspaceActivity({ messages, busy, waitingForReply, preparing }: {
  messages: readonly EveMessage[]; busy: boolean; waitingForReply: boolean; preparing: boolean;
}): WorkspaceActivityState | null {
  if (!busy) return null;
  // Attachment preparation precedes the new optimistic message. Do not replay the previous turn.
  if (preparing) return { label: "Thinking", steps: [] };
  const lastUser = messages.findLastIndex(message => message.role === "user");
  const current = messages.slice(lastUser + 1).filter(message => message.role === "assistant");
  const parts = current.flatMap(message => message.parts);
  const tools = parts.filter((part): part is ToolPart => part.type === "dynamic-tool");
  const steps = Array.from(new Map(tools.map(part => [part.toolCallId, {
    id: part.toolCallId, label: activityLabel(part), state: activityState(part),
  }])).values());
  const active = steps.filter(step => step.state === "active");
  if (active.length) return { label: active.at(-1)!.label, steps };
  if (steps.some(step => step.state === "waiting") || parts.some(part => part.type === "authorization" && part.state === "required")) return null;
  const last = parts.at(-1);
  if (last?.type === "text" && last.text.trim()) return null;
  if (!waitingForReply && !steps.length) return null;
  return { label: steps.length ? "Considering the results" : "Thinking", steps };
}

/** The durable feed currently exposes request state, not per-tool events. */
export function durableWorkspaceActivity({ messages, requests, pending, unavailable }: {
  messages: readonly Pick<ConversationFeedMessage, "role" | "content" | "request" | "nativeInput" | "question">[];
  requests: readonly ConversationFeedRequest[];
  pending: readonly { intentId: string }[];
  unavailable: boolean;
}): WorkspaceActivityState | null {
  if (unavailable) return null;
  const running = requests.filter(request => ["queued", "leased", "executing"].includes(request.state));
  const request = running.findLast(candidate => !messages.some(message =>
    message.role === "assistant" && message.request?.requestId === candidate.requestId &&
    (message.content.trim() || message.nativeInput || message.question)));
  if (request) return { label: request.state === "executing" ? "Working on your request" : "Thinking", steps: [] };
  const unacknowledged = pending.some(intent =>
    !requests.some(request => request.intentId === intent.intentId) &&
    !messages.some(message => message.request?.intentId === intent.intentId));
  return unacknowledged ? { label: "Thinking", steps: [] } : null;
}
