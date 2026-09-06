import { isHiddenDirective, visibleOutboundChildFramingText, parseMaterialPrintPart } from "@homa/core";
import type { EveMessage, EveMessagePart } from "eve/react";

import { parseCurriculumMappingCardPart } from "./curriculum-mapping-card-model";

import { parseQuestionCardPart } from "./question-card-model";
import { parseLibrarySourceCardPart } from "./library-source-card-model";
import {
  parseChecklistCardPart,
  parseDetailCardPart,
  parseReportCardPart,
} from "./onboarding-card-model";

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
  if (
    part.toolName === "approve_curriculum_mapping" &&
    output.approved === true &&
    Array.isArray(output.unitAssets) &&
    Array.isArray(output.plannerTargets)
  ) {
    const unitCount = output.unitAssets.length;
    const additionCount = output.plannerTargets.length;
    return {
      label: output.alreadyApproved === true ? "Already saved" : "Units saved",
      detail: `${unitCount} ${unitCount === 1 ? "unit" : "units"} · ${additionCount} Planner ${additionCount === 1 ? "addition" : "additions"}`,
    };
  }
  return null;
}

/**
 * userMessageSendState(message): where a user bubble sits between typed
 * and delivered. The mobile twin of apps/web/app/app/message-parts.tsx's
 * function of the same name (GH #170 part 2): reads straight from eve's
 * own optimistic projection (`metadata.optimistic` + `metadata.status`,
 * message-reducer.js), not a parallel tracker (BUILD.md M1-04, eve
 * drives state). Before this, a message the client could not confirm
 * vanished with no sign anything went wrong, exactly the dropped-signal
 * scenario a phone hits more than a laptop.
 *
 *   "sending" - client.message.submitted: posted, not yet confirmed.
 *   "failed"  - client.message.failed: the send errored or was
 *               auto-stopped by the watchdog after a long silence. eve
 *               replaces this same bubble's event in place, never a
 *               second copy of the message.
 *   null      - anything else: a plain historical or confirmed message.
 *
 * Once the server confirms, eve retires the optimistic id (replaced by
 * the turn's own message), so "sending" never lingers past confirmation
 * and there is no separate "delivered" state to render.
 */
export function userMessageSendState(
  message: EveMessage,
): "sending" | "failed" | null {
  if (message.role !== "user" || message.metadata?.optimistic !== true) {
    return null;
  }
  if (message.metadata.status === "submitted") return "sending";
  if (message.metadata.status === "failed") return "failed";
  return null;
}

export function partIsRenderable(part: EveMessagePart): boolean {
  if (part.type === "text") {
    return part.text.trim().length > 0 && !isHiddenDirective(part.text);
  }
  if (part.type === "dynamic-tool" && part.state === "output-available") {
    if (parseMaterialPrintPart(part) !== null) return true;
    // Homa's choice card (agent/tools/ask_user_questions.ts) draws as a
    // real tappable card here; question-card-model.ts owns the parsing.
    if (parseQuestionCardPart(part) !== null) return true;
    if (parseLibrarySourceCardPart(part) !== null) return true;
    if (parseChecklistCardPart(part) !== null) return true;
    if (parseDetailCardPart(part) !== null) return true;
    if (parseReportCardPart(part) !== null) return true;
    if (parseCurriculumMappingCardPart(part) !== null) return true;
    if (
      part.toolName === "create_printable" ||
      part.toolName === "show_material" ||
      part.toolName === "create_worksheet"
    ) {
      const output = (part.output ?? {}) as {
        material?: { previewUrl?: unknown };
        worksheet?: { previewUrl?: unknown };
      };
      return (
        typeof (output.material ?? output.worksheet)?.previewUrl === "string"
      );
    }
    if (part.toolName === "open_planner") {
      const output = (part.output ?? {}) as { opened?: unknown };
      return output.opened === true;
    }
    return memoryChipFor(part) !== null;
  }
  return false;
}

export function approvedOutboundChildFramingTexts(
  parts: readonly EveMessagePart[],
): ReadonlySet<string> {
  const approved = new Set<string>();
  for (const part of parts) {
    if (
      part.type !== "dynamic-tool"
      || part.toolName !== "review_child_framing"
      || part.state !== "output-available"
    ) {
      continue;
    }
    const output = (part.output ?? {}) as Record<string, unknown>;
    if (output.accepted === true && typeof output.text === "string") {
      approved.add(output.text);
    }
  }
  return approved;
}

export function visibleMobileChildFramingText(input: {
  text: string;
  approvedTexts: ReadonlySet<string>;
  streaming: boolean;
}): string | null {
  return visibleOutboundChildFramingText({
    text: input.text,
    approvedText: input.approvedTexts.has(input.text) ? input.text : null,
    channel: "mobile",
    streaming: input.streaming,
  });
}

/** The exact completed assistant text the mobile transcript is allowed to show. */
export function visibleAssistantReplyText(message: EveMessage): string | null {
  if (message.role !== "assistant" || message.metadata?.status === "streaming") {
    return null;
  }
  const approvedTexts = approvedOutboundChildFramingTexts(message.parts);
  const visibleText = message.parts
    .flatMap((part) => {
      if (part.type !== "text") return [];
      const text = visibleMobileChildFramingText({
        text: part.text,
        approvedTexts,
        streaming: false,
      });
      return text?.trim() ? [text.trim()] : [];
    })
    .join("\n\n");
  return visibleText || toolOnlyFallback(message);
}

/** A bounded completion announcement that never bypasses display validation. */
export function chatCompletionAnnouncement(messages: readonly EveMessage[]): string {
  const latestAssistant = messages.findLast((message) => message.role === "assistant");
  const visibleReply = latestAssistant ? visibleAssistantReplyText(latestAssistant) : null;
  if (!visibleReply) return "Homa's reply is ready.";

  const plainReply = visibleReply.replace(/\s+/gu, " ").trim();
  if (plainReply.length <= 280) return `Homa replied: ${plainReply}`;
  const prefix = plainReply.slice(0, 277);
  const lastWordBoundary = prefix.lastIndexOf(" ");
  const excerpt = prefix.slice(0, lastWordBoundary > 220 ? lastWordBoundary : 277);
  return `Homa replied: ${excerpt}… Continue reading in Chat.`;
}

/**
 * Last-resort copy for a completed assistant turn whose parts would all
 * render as nothing on mobile. This is deliberately message-level: a
 * normal authored reply stays clean even when it also used internal
 * tools, while a UI tool mobile has not ported yet can never erase the
 * whole turn (GH #376).
 */
export function toolOnlyFallback(message: EveMessage): string | null {
  if (
    message.role !== "assistant"
    || message.metadata?.status === "streaming"
    || message.parts.some(partIsRenderable)
  ) {
    return null;
  }
  const completedTool = message.parts.findLast(
    (part) => part.type === "dynamic-tool" && part.state === "output-available",
  );
  if (!completedTool || completedTool.type !== "dynamic-tool") return null;

  const output = (completedTool.output ?? {}) as Record<string, unknown>;
  if (completedTool.toolName === "start_checklist" && output.started === true) {
    const childName =
      typeof output.childName === "string" ? `${output.childName}'s ` : "The ";
    return `${childName}questions are ready, but that checklist cannot open in the phone app yet.`;
  }
  if (completedTool.toolName === "ask_for_details" && output.asked === true) {
    return "That details card cannot open in the phone app yet. You can type the details here instead.";
  }
  if (completedTool.toolName === "score_child_report" && output.scored === true) {
    const childName =
      typeof output.childName === "string" ? `${output.childName}'s ` : "The ";
    return `${childName}report is ready, but that report card cannot open in the phone app yet.`;
  }
  return "I could not show a result for that in the phone app.";
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  get_children: "checking your family's info\u2026",
  create_printable: "putting the page together\u2026",
  show_material: "bringing the page back\u2026",
  generate_image: "making the image\u2026",
  find_materials: "looking through your materials\u2026",
  find_family_assets: "looking through your Library\u2026",
  get_family_asset: "opening that Library source\u2026",
  read_family_curriculum: "reading the curriculum\u2026",
  preview_curriculum_mapping: "building your review\u2026",
  approve_curriculum_mapping: "saving what you approved\u2026",
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
