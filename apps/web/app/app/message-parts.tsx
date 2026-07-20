"use client";

import type { EveMessage, EveMessagePart } from "eve/react";

import { parseAttachmentMarkers } from "../../lib/attachments/markers";
import {
  AttachmentReceiptChips,
  UserAttachmentDisplay,
} from "./attachment-message-parts";
import type { ChatAttachmentReceipt } from "./chat-attachments";
import { MarkdownText } from "./markdown-text";
import { MaterialCard, type MaterialArtifact } from "./material-card";
import { ProgressConflictCard } from "./progress-conflict-card";
import {
  parseProgressMessagePart,
  type ProgressAssistantItem,
} from "./progress-message-parts";
import { ProgressQuestionCard } from "./progress-question-card";
import { ProgressUpdateChip } from "./progress-update-chip";
import {
  parsePlannerOpenPart,
  PlannerCard,
  type PlannerOpenSignal,
} from "./planner-canvas";
import { parseSnapCardPart, SnapCard, type SnapCardData } from "./snap-card";
import { WorkedForLine, workedForSteps } from "./worked-for";

/**
 * Message rendering for the chat transcript (approved chat redesign
 * 2026-07-13, the scrapbook direction calmed): the parent's messages
 * sit in a soft coral bubble on the right (calmer than the old brand
 * fill: strong coral now belongs to actions), photos she sent display
 * big on white with their caption handwritten underneath, and files
 * ride as quiet chips. Homa's replies render FLAT on the page, no card;
 * the work behind a reply folds into one "Worked for N seconds" line
 * (worked-for.tsx) that opens into plain-words steps, plus the
 * named-effect memory chips and material cards (the MJ-02 confirmation
 * spirit: when Homa saves, updates, or deletes something durable, the
 * effect is visible in the transcript, not silent).
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
  if (
    part.toolName === "edit_plan" &&
    output.updated === true &&
    typeof output.summary === "string"
  ) {
    return { label: "Planner updated", detail: output.summary };
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

/** What one assistant message renders as, in part order: flowing
 * markdown text, material cards, memory chips, and progress cards. The
 * work itself (every tool call) folds into the message's single
 * worked-for line, rendered above these items. */
type SourcedProgressAssistantItem = ProgressAssistantItem & {
  sourcePartIndex: number;
  sourceActionKey: string;
};

type AssistantItem =
  | { kind: "text"; text: string }
  | { kind: "material"; material: MaterialArtifact }
  | { kind: "chip"; chip: MemoryChipContent }
  | { kind: "snap"; card: SnapCardData; sourceActionKey: string }
  | { kind: "planner"; signal: PlannerOpenSignal }
  | SourcedProgressAssistantItem;

function assistantItems(message: EveMessage): AssistantItem[] {
  const items: AssistantItem[] = [];
  for (const [partIndex, part] of message.parts.entries()) {
    if (part.type === "text") {
      if (part.text.trim().length > 0) items.push({ kind: "text", text: part.text });
      continue;
    }
    if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
    const progressItem = parseProgressMessagePart(part);
    if (progressItem) {
      items.push({
        ...progressItem,
        sourcePartIndex: partIndex,
        sourceActionKey: `${message.id}:${partIndex}`,
      });
      continue;
    }
    const snapCard = parseSnapCardPart(part);
    if (snapCard) {
      items.push({
        kind: "snap",
        card: snapCard,
        sourceActionKey: `${message.id}:${partIndex}`,
      });
      continue;
    }
    const plannerSignal = parsePlannerOpenPart(part);
    if (plannerSignal) {
      items.push({ kind: "planner", signal: plannerSignal });
      continue;
    }
    if (
      part.toolName === "create_printable" ||
      part.toolName === "show_material" ||
      part.toolName === "create_worksheet"
    ) {
      // show_material re-surfaces an existing material as the same
      // card; create_worksheet is the retired v1 name: restored
      // localStorage transcripts may still carry its parts, shaped
      // {worksheet}.
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
  }
  return items;
}

function AssistantItemView({
  item,
  onSendSuggestion,
  onFocusComposer,
  actionableProgressPartKey,
  timeZone,
  progressAnswers,
  activeSnapPartKey,
  onSnapAddFiles,
  onSnapTypeInstead,
  childNameById,
  onOpenPlanner,
}: {
  item: AssistantItem;
  onSendSuggestion?: (message: string) => void;
  onFocusComposer?: () => void;
  actionableProgressPartKey?: string;
  timeZone: string;
  progressAnswers?: ReadonlyMap<string, string>;
  activeSnapPartKey?: string;
  onSnapAddFiles?: (files: readonly File[]) => void;
  onSnapTypeInstead?: () => void;
  childNameById?: ReadonlyMap<string, string>;
  onOpenPlanner?: (signal: PlannerOpenSignal) => void;
}) {
  const progressPartIsActionable =
    "sourceActionKey" in item &&
    item.sourceActionKey === actionableProgressPartKey;
  const progressSendSuggestion = progressPartIsActionable
    ? onSendSuggestion
    : undefined;
  const progressFocusComposer = progressPartIsActionable
    ? onFocusComposer
    : undefined;
  switch (item.kind) {
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
    case "snap":
      return (
        <SnapCard
          card={item.card}
          active={item.sourceActionKey === activeSnapPartKey}
          onAddFiles={
            item.sourceActionKey === activeSnapPartKey ? onSnapAddFiles : undefined
          }
          onTypeInstead={
            item.sourceActionKey === activeSnapPartKey
              ? onSnapTypeInstead
              : undefined
          }
        />
      );
    case "planner":
      return (
        <PlannerCard
          childName={
            item.signal.childId
              ? childNameById?.get(item.signal.childId) ?? null
              : null
          }
          onOpen={onOpenPlanner ? () => onOpenPlanner(item.signal) : undefined}
        />
      );
    case "progress_update":
      return (
        <ProgressUpdateChip
          update={item.update}
          onSendSuggestion={progressSendSuggestion}
        />
      );
    case "progress_question":
      return (
        <ProgressQuestionCard
          card={item.card}
          onSendSuggestion={progressSendSuggestion}
          onFocusComposer={progressFocusComposer}
          answeredLabel={progressAnswers?.get(item.sourceActionKey) ?? null}
        />
      );
    case "progress_conflict":
      return (
        <ProgressConflictCard
          card={item.card}
          timeZone={timeZone}
          onSendSuggestion={progressSendSuggestion}
        />
      );
    case "progress_workflow":
      return (
        <div className="flex max-w-full flex-col items-start gap-2">
          {item.update ? (
            <ProgressUpdateChip
              update={item.update}
              onSendSuggestion={progressSendSuggestion}
            />
          ) : null}
          <p className="inline-flex min-h-8 items-center rounded-pill border border-border-subtle bg-page px-3 py-1.5 text-sm font-semibold text-muted">
            {item.label}
          </p>
        </div>
      );
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
}

export function MessageView({
  message,
  onSendSuggestion,
  onFocusComposer,
  actionableProgressPartKey,
  timeZone,
  familyId = null,
  attachmentReceipts,
  childNameById,
  workedForSeconds = null,
  progressAnswers,
  activeSnapPartKey,
  onSnapAddFiles,
  onSnapTypeInstead,
  onOpenPlanner,
}: {
  message: EveMessage;
  onSendSuggestion?: (message: string) => void;
  onFocusComposer?: () => void;
  actionableProgressPartKey?: string;
  timeZone: string;
  /** The render wall for attachment markers; media only draws from this
   * family's own chat blob space. */
  familyId?: string | null;
  /** Save receipts for the attachments this user message carried
   * (live-session state; scrollback shows the media without them). */
  attachmentReceipts?: readonly ChatAttachmentReceipt[];
  childNameById?: ReadonlyMap<string, string>;
  /** Turn duration for the worked-for line, when the client observed it. */
  workedForSeconds?: number | null;
  /** Progress-card partKey -> the tapped answer, for spent cards. */
  progressAnswers?: ReadonlyMap<string, string>;
  /** The one snap card still answerable, plus its handlers. */
  activeSnapPartKey?: string;
  onSnapAddFiles?: (files: readonly File[]) => void;
  onSnapTypeInstead?: () => void;
  /** Reopens the planner canvas from a transcript planner card. */
  onOpenPlanner?: (signal: PlannerOpenSignal) => void;
}) {
  if (message.role === "user") {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    const { visibleText, markers } = parseAttachmentMarkers(text);
    if (visibleText.length === 0 && markers.length === 0) return null;
    return (
      <div className="flex flex-col gap-2">
        <UserAttachmentDisplay markers={markers} familyId={familyId} />
        {visibleText.length > 0 ? (
          <div className="flex justify-end">
            {/* The calmer coral bubble (founder pick): soft fill, dark
                text, radius-lg with a tucked bottom-right corner. */}
            <div className="max-w-[76%] rounded-lg rounded-br-sm bg-[var(--brand-soft-2)] px-[15px] py-2.5 text-[0.9rem] leading-normal text-strong">
              <p className="whitespace-pre-wrap">{visibleText}</p>
            </div>
          </div>
        ) : null}
        {attachmentReceipts && attachmentReceipts.length > 0 ? (
          <AttachmentReceiptChips
            receipts={attachmentReceipts}
            childNameById={childNameById ?? new Map()}
          />
        ) : null}
      </div>
    );
  }

  const items = assistantItems(message);
  const steps = workedForSteps(message);
  if (items.length === 0 && steps.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-3">
      <WorkedForLine steps={steps} seconds={workedForSeconds} />
      {items.map((item, index) => (
        <AssistantItemView
          key={index}
          item={item}
          onSendSuggestion={onSendSuggestion}
          onFocusComposer={onFocusComposer}
          actionableProgressPartKey={actionableProgressPartKey}
          timeZone={timeZone}
          progressAnswers={progressAnswers}
          activeSnapPartKey={activeSnapPartKey}
          onSnapAddFiles={onSnapAddFiles}
          onSnapTypeInstead={onSnapTypeInstead}
          childNameById={childNameById}
          onOpenPlanner={onOpenPlanner}
        />
      ))}
    </div>
  );
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  get_children: "checking your family's info…",
  create_printable: "putting the page together…",
  show_material: "bringing the page back…",
  generate_image: "making the image…",
  search_photos: "looking for real photos…",
  keep_photo: "saving the photo…",
  find_materials: "looking through your materials…",
  mark_material_final: "keeping the final version…",
  remember: "saving a note…",
  forget: "tidying my notes…",
  update_child_profile: "updating the profile…",
  save_skill: "saving that as a skill…",
  forget_skill: "removing the skill…",
  // "looking up how we do this…" read as checking the manual for its
  // own job (copy-review 2026-07-13); plain setup language instead.
  load_skill: "getting set up…",
  manage_child_progress: "updating progress…",
  open_planner: "opening the planner…",
  edit_plan: "updating the planner…",
};

/** The skill whose load marks a material build starting; the studio
 *  tools themselves are the other signals. */
const MATERIALS_SKILL_NAME = "materials-studio";

function isMaterialsBuildSignal(part: EveMessagePart): boolean {
  if (part.type !== "dynamic-tool") return false;
  if (
    part.toolName === "create_printable" ||
    part.toolName === "create_worksheet" ||
    part.toolName === "generate_image"
  ) {
    return true;
  }
  if (part.toolName !== "load_skill") return false;
  const input = (part.input ?? {}) as { skill?: unknown };
  return (
    typeof input.skill === "string" &&
    input.skill.trim().toLowerCase() === MATERIALS_SKILL_NAME
  );
}

/** Where a material build stands, judged from the turn's parts in
 *  order (the last signal wins): "designing" until something concrete
 *  exists, "writing" once a generated image is in hand and the model is
 *  composing the page around it (a forward step, never a repeat, per
 *  the 2026-07-13 copy review), "revising" when the finished page came
 *  back with quality issues the agent will fix, "delivering" once a
 *  passing page exists and the reply is being written. Null when no
 *  build is in flight. */
type MaterialsBuildPhase = "designing" | "writing" | "revising" | "delivering";

function isCreateToolName(toolName: string): boolean {
  return toolName === "create_printable" || toolName === "create_worksheet";
}

/** Whether a finished create call left a page the agent must redo:
 *  the quality check flagged it, or the tool refused outright. */
function createOutputNeedsFix(output: unknown): boolean {
  const record = (output ?? {}) as {
    created?: unknown;
    review?: { pass?: unknown } | null;
  };
  if (record.created !== true) return true;
  return Boolean(record.review && record.review.pass === false);
}

function materialsBuildPhase(message: EveMessage): MaterialsBuildPhase | null {
  let phase: MaterialsBuildPhase | null = null;
  let imageInHand = false;
  for (const part of message.parts) {
    if (!isMaterialsBuildSignal(part)) continue;
    if (part.type !== "dynamic-tool") continue;
    if (part.toolName === "generate_image" && part.state === "output-available") {
      const output = (part.output ?? {}) as { generated?: unknown };
      if (output.generated === true) imageInHand = true;
    }
    if (isCreateToolName(part.toolName) && part.state === "output-available") {
      phase = createOutputNeedsFix(part.output) ? "revising" : "delivering";
      continue;
    }
    phase = imageInHand ? "writing" : "designing";
  }
  return phase;
}

function materialsPhaseLabel(phase: MaterialsBuildPhase): string {
  switch (phase) {
    case "designing":
      return "designing the page…";
    case "writing":
      return "writing the page…";
    case "revising":
      return "fixing a detail…";
    case "delivering":
      return "almost done…";
    default: {
      const exhaustive: never = phase;
      throw new Error(`unhandled materials phase: ${String(exhaustive)}`);
    }
  }
}

/** Whether the newest create call is redoing a page this turn already
 *  produced and flagged. The active render then keeps the "fixing a
 *  detail…" label instead of repeating "putting the page together…"
 *  (the copy review's rerun complaint); a second page for another
 *  request in the same turn (last outcome clean) keeps the normal
 *  label. */
function activeCreateIsAFix(message: EveMessage): boolean {
  let lastOutcomeNeedsFix = false;
  for (const part of message.parts.slice(0, -1)) {
    if (part.type !== "dynamic-tool") continue;
    if (!isCreateToolName(part.toolName)) continue;
    if (part.state !== "output-available") continue;
    lastOutcomeNeedsFix = createOutputNeedsFix(part.output);
  }
  return lastOutcomeNeedsFix;
}

/** The label for a gap between parts (model reasoning, a finished
 *  tool, a step boundary): the build phase when a material is in
 *  flight, plain "thinking…" otherwise. */
function gapLabel(message: EveMessage): string {
  const phase = materialsBuildPhase(message);
  return phase ? materialsPhaseLabel(phase) : "thinking…";
}

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
 *
 * Gaps used to collapse to "thinking…" no matter what the turn was
 * doing, which read as stuck across a 60-90s material build (the
 * 2026-07-13 "thinking… 68s" report). Gaps now name the build phase
 * when the turn's own tool parts show a material in flight; everything
 * else keeps the old labels.
 */
export function busyLabel(messages: readonly EveMessage[]): string | null {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return "thinking…";
  const part = last.parts.at(-1);
  if (!part) return "thinking…";
  if (part.type === "dynamic-tool") {
    if (part.state === "input-streaming" || part.state === "input-available") {
      // A create call redoing a flagged page keeps the fixing label she
      // is already reading; a repeated step name reads as a do-over.
      if (isCreateToolName(part.toolName) && activeCreateIsAFix(last)) {
        return materialsPhaseLabel("revising");
      }
      return TOOL_STATUS_LABELS[part.toolName] ?? "working on it…";
    }
    // Tool finished; the model is composing what comes next.
    return gapLabel(last);
  }
  if (part.type === "text") {
    if (part.text.trim().length === 0) return gapLabel(last);
    // A streaming text block with content is already visible; no extra line.
    if (part.state === "streaming") return null;
    // A completed sentence with the turn still going: only a material
    // build says anything here, so the moment after a final reply
    // stays quiet exactly as before.
    const phase = materialsBuildPhase(last);
    return phase ? materialsPhaseLabel(phase) : null;
  }
  // Reasoning parts and step boundaries: the long quiet stretches.
  return gapLabel(last);
}

/** Tool calls in the latest assistant message (chat.turn_completed prop). */
export function countLastTurnToolCalls(messages: readonly EveMessage[]): number {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return 0;
  return last.parts.filter((part) => part.type === "dynamic-tool").length;
}
