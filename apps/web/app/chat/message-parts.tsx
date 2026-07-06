"use client";

import type { EveMessage, EveMessagePart } from "eve/react";

import { MarkdownText } from "./markdown-text";
import { WorksheetCard, type WorksheetPayload } from "./worksheet-card";

/**
 * Message rendering for the chat transcript: markdown text, worksheet
 * cards, and named-effect memory chips (the MJ-02 confirmation spirit:
 * when Homa saves, updates, or deletes something durable, the effect is
 * visible in the transcript, not silent).
 */

interface MemoryChipContent {
  label: string;
  detail?: string;
}

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function memoryChipFor(part: EveMessagePart): MemoryChipContent | null {
  if (part.type !== "dynamic-tool" || part.state !== "output-available") return null;
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (part.toolName === "remember" && output.saved === true && typeof output.content === "string") {
    return { label: "Noted", detail: truncate(output.content) };
  }
  if (part.toolName === "forget" && output.deleted === true && typeof output.forgot === "string") {
    return { label: "Forgot", detail: truncate(output.forgot) };
  }
  if (
    part.toolName === "update_child_profile" &&
    output.updated === true &&
    typeof output.childName === "string"
  ) {
    return { label: "Profile updated", detail: output.childName };
  }
  return null;
}

function MemoryChip({ chip }: { chip: MemoryChipContent }) {
  return (
    <p className="mt-2 inline-flex max-w-full items-baseline gap-1.5 rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs">
      <span className="font-semibold text-sage">{chip.label}</span>
      {chip.detail ? <span className="truncate text-body">{chip.detail}</span> : null}
    </p>
  );
}

function partIsRenderable(part: EveMessagePart): boolean {
  if (part.type === "text") return part.text.trim().length > 0;
  if (part.type === "dynamic-tool" && part.state === "output-available") {
    if (part.toolName === "create_worksheet") return true;
    return memoryChipFor(part) !== null;
  }
  return false;
}

function MessagePartView({ part, isUser }: { part: EveMessagePart; isUser: boolean }) {
  if (part.type === "text") {
    if (isUser) return <p className="whitespace-pre-wrap">{part.text}</p>;
    return <MarkdownText text={part.text} />;
  }
  if (part.type === "dynamic-tool" && part.state === "output-available") {
    if (part.toolName === "create_worksheet") {
      const output = part.output as { worksheet?: WorksheetPayload } | undefined;
      if (output?.worksheet) {
        return (
          <div className="mt-2">
            <WorksheetCard worksheet={output.worksheet} />
          </div>
        );
      }
      return null;
    }
    const chip = memoryChipFor(part);
    if (chip) return <MemoryChip chip={chip} />;
  }
  return null;
}

export function MessageView({ message }: { message: EveMessage }) {
  const isUser = message.role === "user";
  if (!message.parts.some(partIsRenderable)) return null;

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg rounded-br-sm bg-brand px-4 py-3 text-on-brand"
            : "max-w-[85%] rounded-lg rounded-bl-sm bg-card px-4 py-3 text-body shadow-sm"
        }
      >
        {message.parts.map((part, index) => (
          <MessagePartView key={index} part={part} isUser={isUser} />
        ))}
      </div>
    </div>
  );
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  get_children: "checking your family's info…",
  create_worksheet: "putting the worksheet together…",
  remember: "saving a note…",
  forget: "tidying my notes…",
  update_child_profile: "updating the profile…",
};

/**
 * What Homa is doing right now, or null when nothing needs a status bubble
 * (plain assistant text streaming shows itself; a second bubble would
 * double up). A user message awaiting a reply shows "thinking…"; an
 * executing tool shows its named activity.
 */
export function busyLabel(messages: readonly EveMessage[]): string | null {
  const last = messages.at(-1);
  if (!last) return "thinking…";
  if (last.role === "user") return "thinking…";
  if (last.role === "assistant") {
    for (let i = last.parts.length - 1; i >= 0; i -= 1) {
      const part = last.parts[i];
      if (
        part.type === "dynamic-tool" &&
        (part.state === "input-streaming" || part.state === "input-available")
      ) {
        return TOOL_STATUS_LABELS[part.toolName] ?? "working on it…";
      }
      // A streaming text block is already visible; no extra bubble.
      if (part.type === "text" && part.text.trim().length > 0) return null;
    }
    return null;
  }
  return "thinking…";
}

/** Tool calls in the latest assistant message (chat.turn_completed prop). */
export function countLastTurnToolCalls(messages: readonly EveMessage[]): number {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return 0;
  return last.parts.filter((part) => part.type === "dynamic-tool").length;
}
