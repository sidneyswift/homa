import type { EveMessage, EveMessagePart } from "eve/react";

/**
 * Transcript display logic ported from apps/web/app/app/chat/message-parts.tsx
 * (keep the tool names and labels in sync). Pure functions, no JSX, so
 * both the message views and the analytics counter can share them.
 */

export interface MemoryChipContent {
  label: string;
  detail?: string;
}

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}

/** Named-effect chips: when Homa saves, updates, or deletes something
 * durable, the effect is visible in the transcript, not silent (MJ-02). */
export function memoryChipFor(part: EveMessagePart): MemoryChipContent | null {
  if (part.type !== "dynamic-tool" || part.state !== "output-available") {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (
    part.toolName === "remember" &&
    output.saved === true &&
    typeof output.content === "string"
  ) {
    return { label: "Noted", detail: truncate(output.content) };
  }
  if (
    part.toolName === "forget" &&
    output.deleted === true &&
    typeof output.forgot === "string"
  ) {
    return { label: "Forgot", detail: truncate(output.forgot) };
  }
  if (
    part.toolName === "update_child_profile" &&
    output.updated === true &&
    typeof output.childName === "string"
  ) {
    return { label: "Profile updated", detail: output.childName };
  }
  if (
    part.toolName === "save_skill" &&
    output.saved === true &&
    typeof output.name === "string"
  ) {
    return {
      label: output.updated === true ? "Skill updated" : "Skill saved",
      detail: output.name,
    };
  }
  if (
    part.toolName === "forget_skill" &&
    output.deleted === true &&
    typeof output.name === "string"
  ) {
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

export function partIsRenderable(part: EveMessagePart): boolean {
  if (part.type === "text") return part.text.trim().length > 0;
  if (part.type === "dynamic-tool" && part.state === "output-available") {
    if (part.toolName === "create_printable" || part.toolName === "create_worksheet") {
      const output = (part.output ?? {}) as {
        material?: { previewUrl?: unknown };
        worksheet?: { previewUrl?: unknown };
      };
      return (
        typeof (output.material ?? output.worksheet)?.previewUrl === "string"
      );
    }
    return memoryChipFor(part) !== null;
  }
  return false;
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  get_children: "checking your family's info\u2026",
  create_printable: "putting the page together\u2026",
  generate_image: "making the image\u2026",
  find_materials: "looking through your materials\u2026",
  mark_material_final: "keeping the final version\u2026",
  remember: "saving a note\u2026",
  forget: "tidying my notes\u2026",
  update_child_profile: "updating the profile\u2026",
  save_skill: "saving that as a skill\u2026",
  forget_skill: "removing the skill\u2026",
  load_skill: "looking up how we do this\u2026",
};

/**
 * What Homa is doing right now, or null when nothing needs a status
 * bubble (streaming assistant text already shows itself).
 */
export function busyLabel(messages: readonly EveMessage[]): string | null {
  const last = messages.at(-1);
  if (!last) return "thinking\u2026";
  if (last.role === "user") return "thinking\u2026";
  if (last.role === "assistant") {
    for (let i = last.parts.length - 1; i >= 0; i -= 1) {
      const part = last.parts[i];
      if (
        part.type === "dynamic-tool" &&
        (part.state === "input-streaming" || part.state === "input-available")
      ) {
        return TOOL_STATUS_LABELS[part.toolName] ?? "working on it\u2026";
      }
      // A streaming text block is already visible; no extra bubble.
      if (part.type === "text" && part.text.trim().length > 0) return null;
    }
    return null;
  }
  return "thinking\u2026";
}

/** Tool calls in the latest assistant message (chat.turn_completed prop). */
export function countLastTurnToolCalls(
  messages: readonly EveMessage[],
): number {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return 0;
  return last.parts.filter((part) => part.type === "dynamic-tool").length;
}
