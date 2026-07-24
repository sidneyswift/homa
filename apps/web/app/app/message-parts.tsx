"use client";

import type { EveMessage, EveMessagePart } from "eve/react";

import { Logo } from "../../components/brand/Logo";
import { parseAttachmentMarkers } from "../../lib/attachments/markers";
import {
  isNarratedPause,
  isStageDirection,
  stripTrailingNarration,
} from "./assistant-text";
import { isHiddenDirective } from "../../lib/onboarding/directives";
import {
  AttachmentReceiptChips,
  UserAttachmentDisplay,
} from "./attachment-message-parts";
import type { ChatAttachmentReceipt } from "./chat-attachments";
import { MarkdownText } from "./markdown-text";
import { MaterialCard, type MaterialArtifact } from "./material-card";
import { selectParentVisibleMaterialMessageParts } from "./material-message-parts";
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
import {
  parseQuestionCardPart,
  QuestionCard,
  type QuestionCardData,
} from "./question-card";
import {
  ChecklistCard,
  FirstMakingCard,
  parseChecklistCardPart,
  parseFirstMakingCardPart,
  parseReportCardPart,
  type ChecklistCardData,
  type FirstMakingCardData,
  type ReportCardData,
} from "./onboarding-cards";
import {
  DetailCard,
  parseDetailCardPart,
  type DetailCardData,
} from "./detail-card";
import { ReportRevealCard } from "./report-reveal-card";
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
    // "Profile updated" is product-speak: a parent does not think of her
    // child as having a profile, and she had just told Homa that Story
    // likes animals, which is not an update to anything she can see.
    return { label: "Saved", detail: `about ${output.childName}` };
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
  // The receipt fan's own chip
  // (plans/2026-07-21-chat-first-onboarding.md §6.4). Logging hours is
  // the keystone habit, and until now it was the only named effect in
  // the product that left no visible trace: she typed a sentence about
  // her day and got a paragraph back, with nothing to show that it
  // landed anywhere. The chip is the proof the loop is worth repeating.
  if (
    part.toolName === "log_hours" &&
    output.logged === true &&
    typeof output.subject === "string" &&
    typeof output.minutes === "number"
  ) {
    return {
      // "Hours logged" next to "45 min" read as a unit mismatch, and for
      // a homeschool mom "logged" raises a question the chip never
      // answered: logged where, and is this the record my state asks for.
      label: "Hours saved",
      detail: `${output.subject}, ${output.minutes} min`,
    };
  }
  return null;
}

/**
 * A receipt, not a badge (founder note, 2026-07-22: "confusing and too
 * colorful").
 *
 * It was a filled sage pill with a border, which is the visual weight of
 * a call to action, sitting next to a sentence that already said the
 * same thing in Homa's own words. Two problems at once: it looked like
 * something to press, and it was louder than the fact it was reporting.
 *
 * Now a quiet line with one small sage dot. The dot keeps the "this
 * landed" signal that MJ-02 asks a named effect to carry; everything
 * else steps back so the sentence above it does the talking.
 */
function MemoryChip({ chip }: { chip: MemoryChipContent }) {
  return (
    <p className="inline-flex max-w-full items-baseline gap-2 self-start text-xs text-subtle">
      <span
        aria-hidden="true"
        className="mb-px h-1.5 w-1.5 shrink-0 self-center rounded-pill bg-sage"
      />
      <span className="font-medium">{chip.label}</span>
      {chip.detail ? <span className="truncate text-muted">{chip.detail}</span> : null}
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
  | { kind: "questions"; card: QuestionCardData; sourceActionKey: string }
  | { kind: "planner"; signal: PlannerOpenSignal }
  | { kind: "checklist"; card: ChecklistCardData; sourceActionKey: string }
  | { kind: "report"; card: ReportCardData; sourceActionKey: string }
  | { kind: "making"; card: FirstMakingCardData }
  | { kind: "details"; card: DetailCardData; sourceActionKey: string }
  | SourcedProgressAssistantItem;

/**
 * Tools whose result says "END TURN. Emit no text after this tool call."
 *
 * The contract has been in both tool descriptions since they were
 * written. Nothing enforced it, and it turns out nothing the model can
 * do would satisfy it: eve runs a SECOND step after the tool result, and
 * a step has no way to produce nothing. Asked to be silent, the model
 * must still emit a terminal message, so it emits the only thing left,
 * something meta.
 *
 * That one slot is where every leak of this session came from. Proved
 * from the raw event log of one opening turn:
 *
 *   step 0  finish=tool-calls  "Hey, I'm Homa. Your homeschool helper..."
 *   step 0  calls ask_for_details
 *   step 1  finish=stop        "(no further text, waiting for her to
 *                               fill in the card)"
 *
 * On the founder's run the same slot held a verbatim sentence out of
 * agent/instructions/onboarding-mode.ts, which is prompt text on a
 * parent's screen. Earlier runs held "(waiting for her response)",
 * "Noted, waiting for her to fill that in", "I'm here whenever you're
 * ready". Four narration regexes chased four of those and the fifth was
 * a prompt echo no vocabulary rule could ever have caught.
 *
 * So the rule is structural instead: after one of these tool calls, this
 * message has said everything it is going to say. Cheap, total, and it
 * cannot be outrun by a new phrasing.
 */
const ENDS_THE_TURN = new Set(["ask_for_details", "start_checklist"]);

function endsTheTurn(part: EveMessagePart): boolean {
  return part.type === "dynamic-tool" && ENDS_THE_TURN.has(part.toolName);
}

function assistantItems(message: EveMessage): AssistantItem[] {
  const items: AssistantItem[] = [];
  // Set once a card has claimed the screen; every later text part in
  // this message is the model filling a silence it was told to keep.
  let turnEnded = false;
  const materialByPartIndex = new Map(
    selectParentVisibleMaterialMessageParts(message.parts).map((entry) => [
      entry.sourcePartIndex,
      entry.material,
    ]),
  );
  // Text already shown in THIS message, so a model that restates itself
  // around a tool call does not print the same paragraph twice. Seen
  // live on the opening turn: one sentence, rendered above and below the
  // card, word for word (assistant-text.ts).
  const shownText = new Set<string>();
  for (const [partIndex, part] of message.parts.entries()) {
    if (part.type === "text") {
      // The card already asked. Whatever this is, she was not meant to
      // read it, and it is the one slot that has leaked all session.
      if (turnEnded) continue;
      // Trailing narration goes first: "Take your time, I'm here
      // whenever you're ready." shipped as paragraph two of a real
      // reply, where the whole-part predicates below can never reach.
      const trimmed = stripTrailingNarration(part.text).trim();
      if (trimmed.length === 0) continue;
      // Homa narrating her own silence is not something to show a
      // parent, wrapped in asterisks or not. Both checks live here
      // rather than behind visibleAssistantTexts because this loop needs
      // the part index; keeping the predicates shared is what stops the
      // two paths from drifting, and the drift is exactly how
      // "I'll continue once she replies." reached a real screen.
      if (isStageDirection(trimmed) || isNarratedPause(trimmed)) continue;
      const key = trimmed.replace(/\s+/g, " ");
      if (shownText.has(key)) continue;
      shownText.add(key);
      items.push({ kind: "text", text: trimmed });
      continue;
    }
    // Set on the CALL, not on the output, so a card still streaming has
    // already closed the turn to text. The card itself is parsed below
    // from the same part once its output lands.
    if (endsTheTurn(part)) turnEnded = true;
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
    const questionCard = parseQuestionCardPart(part);
    if (questionCard) {
      items.push({
        kind: "questions",
        card: questionCard,
        sourceActionKey: `${message.id}:${partIndex}`,
      });
      continue;
    }
    const plannerSignal = parsePlannerOpenPart(part);
    if (plannerSignal) {
      items.push({ kind: "planner", signal: plannerSignal });
      continue;
    }
    const checklistCard = parseChecklistCardPart(part);
    if (checklistCard) {
      items.push({
        kind: "checklist",
        card: checklistCard,
        sourceActionKey: `${message.id}:${partIndex}`,
      });
      continue;
    }
    const detailCard = parseDetailCardPart(part);
    if (detailCard) {
      items.push({
        kind: "details",
        card: detailCard,
        sourceActionKey: `${message.id}:${partIndex}`,
      });
      continue;
    }
    const reportCard = parseReportCardPart(part);
    if (reportCard) {
      items.push({
        kind: "report",
        card: reportCard,
        sourceActionKey: `${message.id}:${partIndex}`,
      });
      continue;
    }
    const makingCard = parseFirstMakingCardPart(part);
    if (makingCard) {
      items.push({ kind: "making", card: makingCard });
      continue;
    }
    if (
      part.toolName === "create_printable" ||
      part.toolName === "show_material" ||
      part.toolName === "create_worksheet"
    ) {
      const material = materialByPartIndex.get(partIndex);
      if (material) {
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

/**
 * messageRendersSomething(message): would this message put anything on
 * screen at all?
 *
 * Exported because the welcome has to know. A hidden directive and a
 * turn that died before writing anything both produce a transcript item
 * that renders null, and counting those as "the conversation has
 * started" hid the opening lines behind nothing and left a brand new
 * parent staring at an empty screen. The logic lives here, next to the
 * renderer whose behavior it has to match, rather than being guessed at
 * by the caller.
 */
export function messageRendersSomething(message: EveMessage): boolean {
  if (message.role === "user") {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    if (isHiddenDirective(text)) return false;
    const { visibleText, markers } = parseAttachmentMarkers(text);
    return visibleText.length > 0 || markers.length > 0;
  }
  return assistantItems(message).length > 0 || workedForSteps(message).length > 0;
}

/**
 * messageSaysSomething(message): has anybody actually said anything?
 *
 * The stricter sibling of the above, and the difference between them is
 * one row: a turn that only called a tool renders a collapsed "Worked on
 * it" eyebrow, which is something on screen but is not Homa speaking.
 *
 * Onboarding's progressive chrome asks the second question, not the
 * first. A first turn that spends itself loading a skill and writes no
 * words was enough to bring the composer up under an otherwise empty
 * screen, so a brand new parent was invited to type before Homa had said
 * hello. The eyebrow is a receipt for work; the chrome waits for words.
 */
export function messageSaysSomething(message: EveMessage): boolean {
  if (message.role === "user") return messageRendersSomething(message);
  return assistantItems(message).length > 0;
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
  activeQuestionPartKey,
  onSendQuestionAnswers,
  onQuestionTypeInstead,
  questionAnswers,
  childNameById,
  onOpenPlanner,
  activeChecklistPartKey,
  onOpenChecklist,
  activeReportPartKey,
  onOpenReport,
  activeDetailPartKey,
  onDetailsSaved,
  dockedDetailPartKey,
  dockedChecklistPartKey,
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
  activeQuestionPartKey?: string;
  onSendQuestionAnswers?: (message: string) => void;
  onQuestionTypeInstead?: () => void;
  questionAnswers?: ReadonlyMap<string, string>;
  childNameById?: ReadonlyMap<string, string>;
  onOpenPlanner?: (signal: PlannerOpenSignal) => void;
  activeChecklistPartKey?: string;
  onOpenChecklist?: (childId: string) => void;
  activeReportPartKey?: string;
  onOpenReport?: (childId: string) => void;
  activeDetailPartKey?: string;
  onDetailsSaved?: (summary: string) => void;
  dockedDetailPartKey?: string;
  /** Same contract for the checklist invite. */
  dockedChecklistPartKey?: string;
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
    case "checklist":
      // Docked: the composer is rendering it, so the transcript renders
      // nothing. Same rule as the details card below. The founder hit
      // the un-docked version live: the invite card, an open composer,
      // and a suggestion chip all asking for her next move at once.
      if (item.sourceActionKey === dockedChecklistPartKey) return null;
      return (
        <ChecklistCard
          card={item.card}
          active={item.sourceActionKey === activeChecklistPartKey}
          onOpen={
            item.sourceActionKey === activeChecklistPartKey ? onOpenChecklist : undefined
          }
        />
      );
    case "details":
      // Docked: the composer is rendering it, so the transcript renders
      // nothing. Two copies of one question is the confusion this whole
      // change exists to remove.
      if (item.sourceActionKey === dockedDetailPartKey) return null;
      return (
        <DetailCard
          card={item.card}
          active={item.sourceActionKey === activeDetailPartKey}
          onSaved={
            item.sourceActionKey === activeDetailPartKey ? onDetailsSaved : undefined
          }
        />
      );
    case "report":
      return (
        <ReportRevealCard
          card={item.card}
          active={item.sourceActionKey === activeReportPartKey}
          onOpenReport={
            item.sourceActionKey === activeReportPartKey ? onOpenReport : undefined
          }
        />
      );
    case "making":
      // Transcript-resident, never docked: while it makes there is
      // nothing to press, and when it is ready it becomes the material
      // itself, which stays useful in scrollback like any other page.
      return <FirstMakingCard card={item.card} />;
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
    case "questions":
      return (
        <QuestionCard
          card={item.card}
          active={item.sourceActionKey === activeQuestionPartKey}
          onSendAnswers={
            item.sourceActionKey === activeQuestionPartKey
              ? onSendQuestionAnswers
              : undefined
          }
          onTypeInstead={
            item.sourceActionKey === activeQuestionPartKey
              ? onQuestionTypeInstead
              : undefined
          }
          answeredSummary={questionAnswers?.get(item.sourceActionKey) ?? null}
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
  activeQuestionPartKey,
  onSendQuestionAnswers,
  onQuestionTypeInstead,
  questionAnswers,
  onOpenPlanner,
  activeChecklistPartKey,
  onOpenChecklist,
  activeReportPartKey,
  onOpenReport,
  activeDetailPartKey,
  onDetailsSaved,
  dockedDetailPartKey,
  dockedChecklistPartKey,
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
  /** The one choice card still answerable, plus its handlers. */
  activeQuestionPartKey?: string;
  onSendQuestionAnswers?: (message: string) => void;
  onQuestionTypeInstead?: () => void;
  /** Choice-card partKey -> what she sent, for spent cards. */
  questionAnswers?: ReadonlyMap<string, string>;
  /** Reopens the planner canvas from a transcript planner card. */
  onOpenPlanner?: (signal: PlannerOpenSignal) => void;
  /** The one checklist card that may still open the questions. */
  activeChecklistPartKey?: string;
  onOpenChecklist?: (childId: string) => void;
  /** The one report reveal that may still open the report. */
  activeReportPartKey?: string;
  onOpenReport?: (childId: string) => void;
  /** The one facts card still accepting answers. */
  activeDetailPartKey?: string;
  onDetailsSaved?: (summary: string) => void;
  /** The facts card the composer is currently standing in for. */
  dockedDetailPartKey?: string;
  /** Same contract for the checklist invite. */
  dockedChecklistPartKey?: string;
}) {
  if (message.role === "user") {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    // A hidden onboarding directive is the app talking on her behalf
    // (lib/onboarding/directives.ts). eve renders the submitted message
    // optimistically, so without this it appears as HER bubble, in
    // brackets, seconds after she taps something.
    if (isHiddenDirective(text)) return null;
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
  // While everything this turn produced is docked in the composer slot,
  // the card IS the turn's presence on screen, and the row here would
  // render nothing but the worked-for eyebrow. A receipt with no words
  // above the very first card read as the app talking to its engineers
  // (founder call 2026-07-23, closing the drop-off loop), so the row
  // waits: the moment the card is spent or superseded it returns as an
  // honest work receipt in scrollback.
  const allDocked =
    items.length > 0 &&
    items.every(
      (item) =>
        (item.kind === "details" &&
          item.sourceActionKey === dockedDetailPartKey) ||
        (item.kind === "checklist" &&
          item.sourceActionKey === dockedChecklistPartKey),
    );
  if (allDocked) return null;
  return (
    // The mark stays. It bobs through the wait and then settles here, in
    // the same size and the same place, so the one thing on screen that
    // is visibly HER does not disappear at the exact moment she starts
    // speaking. Before this it vanished on arrival, which read as the
    // logo going away rather than as a reply landing.
    <div className="flex w-full items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex shrink-0 opacity-70"
      >
        <Logo size={20} variant="mark" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
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
          activeQuestionPartKey={activeQuestionPartKey}
          onSendQuestionAnswers={onSendQuestionAnswers}
          onQuestionTypeInstead={onQuestionTypeInstead}
          questionAnswers={questionAnswers}
          childNameById={childNameById}
          onOpenPlanner={onOpenPlanner}
          activeChecklistPartKey={activeChecklistPartKey}
          onOpenChecklist={onOpenChecklist}
          activeReportPartKey={activeReportPartKey}
          onOpenReport={onOpenReport}
          activeDetailPartKey={activeDetailPartKey}
          onDetailsSaved={onDetailsSaved}
          dockedDetailPartKey={dockedDetailPartKey}
          dockedChecklistPartKey={dockedChecklistPartKey}
        />
      ))}
      </div>
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
  add_child: "adding them…",
  save_family_basics: "saving what you told me…",
  save_homeschool_profile: "saving what you told me…",
  start_checklist: "getting the questions ready…",
  start_first_making: "getting a page started…",
  ask_for_details: "putting up a few fields…",
  // The one wait that is worth narrating rather than labelling. The
  // reveal card takes over from here and says the rest.
  score_child_report: "reading the answers…",
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
function gapLabel(message: EveMessage, generic: string): string {
  const phase = materialsBuildPhase(message);
  return phase ? materialsPhaseLabel(phase) : generic;
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
/**
 * The generic wait, in her language, escalating with the clock.
 *
 * "thinking…" held for twenty five seconds stops reading as thought and
 * starts reading as a hang. Each of these is true of any turn at the
 * moment it appears, which is the constraint: a wait label may never
 * claim work that is not happening, so none of them names a step.
 */
export function genericBusyLabel(seconds: number): string {
  if (seconds < 5) return "thinking…";
  if (seconds < 15) return "working on it…";
  if (seconds < 45) return "still working…";
  return "this one is taking a while…";
}

export function busyLabel(
  messages: readonly EveMessage[],
  seconds = 0,
): string | null {
  const generic = genericBusyLabel(seconds);
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return generic;
  const part = last.parts.at(-1);
  if (!part) return generic;
  if (part.type === "dynamic-tool") {
    if (part.state === "input-streaming" || part.state === "input-available") {
      // A create call redoing a flagged page keeps the fixing label she
      // is already reading; a repeated step name reads as a do-over.
      if (isCreateToolName(part.toolName) && activeCreateIsAFix(last)) {
        return materialsPhaseLabel("revising");
      }
      return TOOL_STATUS_LABELS[part.toolName] ?? generic;
    }
    // Tool finished; the model is composing what comes next.
    return gapLabel(last, generic);
  }
  if (part.type === "text") {
    if (part.text.trim().length === 0) return gapLabel(last, generic);
    // A streaming text block with content is already visible; no extra line.
    if (part.state === "streaming") return null;
    // A completed sentence with the turn still going: only a material
    // build says anything here, so the moment after a final reply
    // stays quiet exactly as before.
    const phase = materialsBuildPhase(last);
    return phase ? materialsPhaseLabel(phase) : null;
  }
  // Reasoning parts and step boundaries: the long quiet stretches.
  return gapLabel(last, generic);
}

/** Tool calls in the latest assistant message (chat.turn_completed prop). */
export function countLastTurnToolCalls(messages: readonly EveMessage[]): number {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return 0;
  return last.parts.filter((part) => part.type === "dynamic-tool").length;
}
