"use client";

import type { EveMessage, EveMessagePart } from "eve/react";

import { MarkdownText } from "./markdown-text";
import { MaterialCard, type MaterialArtifact } from "./material-card";

/**
 * Message rendering for the chat transcript, in the assistant-transcript
 * style (founder screenshot review 2026-07-09, "Claude structure, Homa
 * skin"): the parent's messages sit in the kit's brand bubble on the
 * right (ui_kits/web-app/ChatView.jsx), Homa's replies render FLAT on the
 * page, no card, and the work Homa did stays visible as quiet past-tense
 * activity lines ("Checked your family's info") plus the named-effect
 * memory chips and material cards (the MJ-02 confirmation spirit: when
 * Homa saves, updates, or deletes something durable, the effect is
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
  if (part.toolName === "save_skill" && output.saved === true && typeof output.name === "string") {
    return { label: output.updated === true ? "Skill updated" : "Skill saved", detail: output.name };
  }
  if (part.toolName === "forget_skill" && output.deleted === true && typeof output.name === "string") {
    return { label: "Skill removed", detail: output.name };
  }
  if (
    part.toolName === "mark_material_final" &&
    output.finalized === true &&
    typeof output.title === "string"
  ) {
    return { label: "Final kept", detail: output.title };
  }
  return null;
}

function MemoryChip({ chip }: { chip: MemoryChipContent }) {
  return (
    <p className="inline-flex max-w-full items-baseline gap-1.5 self-start rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs">
      <span className="font-semibold text-sage">{chip.label}</span>
      {chip.detail ? <span className="truncate text-body">{chip.detail}</span> : null}
    </p>
  );
}

/** Past-tense lines for finished tools with no visible output of their
 * own (chips and cards carry the rest). The in-flight siblings live in
 * TOOL_STATUS_LABELS below. */
const TOOL_DONE_LABELS: Record<string, string> = {
  get_children: "Checked your family's info",
  load_skill: "Looked up how we do this",
  generate_image: "Made an image",
  find_materials: "Looked through your materials",
};

/** What one assistant message renders as, in part order: quiet activity
 * lines (consecutive ones collapse into a single mid-dot line, the way
 * the reference transcript groups "used X, did Y"), flowing markdown
 * text, material cards, and memory chips. */
type AssistantItem =
  | { kind: "activity"; labels: string[] }
  | { kind: "text"; text: string }
  | { kind: "material"; material: MaterialArtifact }
  | { kind: "chip"; chip: MemoryChipContent };

function assistantItems(parts: readonly EveMessagePart[]): AssistantItem[] {
  const items: AssistantItem[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      if (part.text.trim().length > 0) items.push({ kind: "text", text: part.text });
      continue;
    }
    if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
    if (part.toolName === "create_printable" || part.toolName === "create_worksheet") {
      // create_worksheet is the retired v1 name: restored localStorage
      // transcripts may still carry its parts, shaped {worksheet}.
      const output = part.output as
        | { material?: MaterialArtifact; worksheet?: MaterialArtifact }
        | undefined;
      const material = output?.material ?? output?.worksheet;
      // previewUrl guards out refusals and pre-studio legacy payloads.
      if (material?.previewUrl) {
        items.push({ kind: "material", material });
      }
      continue;
    }
    const chip = memoryChipFor(part);
    if (chip) {
      items.push({ kind: "chip", chip });
      continue;
    }
    const label = TOOL_DONE_LABELS[part.toolName];
    if (!label) continue;
    const last = items.at(-1);
    if (last?.kind === "activity") {
      if (!last.labels.includes(label)) last.labels.push(label);
    } else {
      items.push({ kind: "activity", labels: [label] });
    }
  }
  return items;
}

function AssistantItemView({ item }: { item: AssistantItem }) {
  switch (item.kind) {
    case "activity":
      return <p className="text-sm text-subtle">{item.labels.join(" · ")}</p>;
    case "text":
      return (
        <div className="leading-relaxed text-body">
          <MarkdownText text={item.text} />
        </div>
      );
    case "material":
      return <MaterialCard material={item.material} />;
    case "chip":
      return <MemoryChip chip={item.chip} />;
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
}

export function MessageView({ message }: { message: EveMessage }) {
  if (message.role === "user") {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    if (text.length === 0) return null;
    return (
      <div className="flex justify-end">
        {/* The kit's user bubble: brand fill, radius-lg with a tucked
            bottom-right corner, at most 76% of the column. */}
        <div className="max-w-[76%] rounded-lg rounded-br-sm bg-brand px-[18px] py-3.5 text-[0.95rem] leading-normal text-on-brand shadow-sm">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  const items = assistantItems(message.parts);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-3">
      {items.map((item, index) => (
        <AssistantItemView key={index} item={item} />
      ))}
    </div>
  );
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  get_children: "checking your family's info…",
  create_printable: "putting the page together…",
  generate_image: "making the image…",
  find_materials: "looking through your materials…",
  mark_material_final: "keeping the final version…",
  remember: "saving a note…",
  forget: "tidying my notes…",
  update_child_profile: "updating the profile…",
  save_skill: "saving that as a skill…",
  forget_skill: "removing the skill…",
  load_skill: "looking up how we do this…",
};

/**
 * What Homa is doing right now, or null when nothing needs a status line
 * (plain assistant text streaming shows itself; a second line would
 * double up). A user message awaiting a reply shows "thinking…"; an
 * executing tool shows its named activity.
 *
 * Judged by the LAST part only: earlier parts are already on screen. The
 * previous scan-backwards version went blank in the gap between a finished
 * tool and the next streamed token, exactly the "is it working? is it not
 * working?" panic from the 2026-07-07 tester memos (memo 1, MJ-06). While
 * busy, something must always be visible.
 */
export function busyLabel(messages: readonly EveMessage[]): string | null {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return "thinking…";
  const part = last.parts.at(-1);
  if (!part) return "thinking…";
  if (part.type === "dynamic-tool") {
    if (part.state === "input-streaming" || part.state === "input-available") {
      return TOOL_STATUS_LABELS[part.toolName] ?? "working on it…";
    }
    // Tool finished; the model is composing what comes next.
    return "thinking…";
  }
  // A streaming text block with content is already visible; no extra line.
  if (part.type === "text") return part.text.trim().length > 0 ? null : "thinking…";
  return "thinking…";
}

/** Tool calls in the latest assistant message (chat.turn_completed prop). */
export function countLastTurnToolCalls(messages: readonly EveMessage[]): number {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return 0;
  return last.parts.filter((part) => part.type === "dynamic-tool").length;
}
