"use client";

import { emitEvent } from "@homa/core";
import type { UserContent } from "ai";
import { Client } from "eve/client";
import { useEveAgent, type EveMessage } from "eve/react";
import { ArrowDown, ArrowUp, ChevronDown, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import { ThinkingMark } from "../../components/brand/ThinkingMark";
import { sendWallBeacon } from "../../components/billing/wall-beacon";
import { WallModal } from "../../components/billing/wall-modal";
import type { WallCheckout } from "../../lib/billing/wall-types";
import {
  appOpensWithBasics,
  browserTimeZone,
  clearKickoffSent,
  kickoffAlreadySent,
  kickoffDirectiveFor,
  kickoffLockIsStale,
  markKickoffSent,
  ONBOARDING_WELCOME,
  type OnboardingChatConfig,
} from "./onboarding-chat";
import {
  ChecklistCard,
  latestChecklistRequest,
  latestReportReveal,
} from "./onboarding-cards";
import { AnotherKidCard } from "./another-kid-card";
import {
  cardWantsComposer,
  DetailCard,
  latestDetailRequest,
  NO_STYLES_SUMMARY,
  type DetailCardKind,
} from "./detail-card";
import { VoiceMode } from "./voice-mode";
import { VoiceModeButton } from "./voice-mode-button";
import { spokenTurnMessage, type VoiceTranscriptLine } from "./voice-transcript";
import { ChecklistTakeover } from "./checklist-takeover";
import { formatHiddenDirective } from "../../lib/onboarding/directives";
import {
  archiveFromServerHistory,
  type ChatHistoryPayload,
} from "../../lib/chat-history-model";
import { messageModalityHeaders } from "../../lib/web-message-modality";
import type { PromptSuggestionSet } from "../../lib/chat-suggestions/contract";
import type { SlashSkillItem } from "../../lib/slash-skills";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import {
  AttachMenuButton,
  CameraButton,
  PendingAttachmentChips,
  prepareAttachmentsForSend,
  summarizeOutgoingParts,
  useChatAttachments,
  type ChatAttachmentReceipt,
} from "./chat-attachments";
import {
  archiveMessages,
  foldEventsToMessages,
  prepareChat,
  pruneMessageTimes,
  saveChat,
  stampMessageTimes,
  updateSavedPromptSuggestionSet,
  type ArchivedMessage,
} from "./chat-storage";
import {
  hydrationSafeTranscriptSources,
  useHydrated,
} from "./chat-hydration";
import {
  composerPrimaryAction,
  appendPreparedChatSendToQueue,
  flushChatQueue,
  focusChatComposerInput,
  isSendLineOccupied,
  prepareChatSend,
  type ChatSendAcceptance,
  type ChatSendSource,
  type ChatTurnModality,
  type QueuedChatMessage,
} from "./chat-send-policy";
import {
  DictationRow,
  MicButton,
  DICTATION_CUTOFF_MESSAGE,
  RECORDING_HINT_MESSAGE,
  useDictation,
} from "./dictation";
import {
  activeToolName,
  busyLabel,
  busyMood,
  countLastTurnToolCalls,
  messageSaysSomething,
  messageSpeaksWords,
  MessageView,
} from "./message-parts";
import {
  beginProgressAction,
  createProgressActionLifecycleState,
  progressActionUnavailableKeys,
  releaseProgressAction,
  settleProgressAction,
  type ProgressActionLifecycleState,
} from "./progress-action-lifecycle";
import {
  latestProgressMessageInteraction,
  type ProgressMessageInteraction,
} from "./progress-interaction-policy";
import { requestPromptSuggestionSet } from "./prompt-suggestion-client";
import {
  executePromptSuggestionLifecycleAction,
  promptSuggestionActionForLifecycleEvent,
  type PromptSuggestionLifecycleHandlers,
} from "./prompt-suggestion-lifecycle";
import {
  promptSuggestionRequestForMessages,
  restorePromptSuggestionSetForVisibleMessages,
} from "./prompt-suggestion-policy";
import {
  PromptSuggestionRail,
  type PromptSuggestionPhase,
} from "./prompt-suggestion-rail";
import {
  latestPlannerOpen,
  planEditCount,
  PlannerCanvasPanel,
  type PlannerOpenSignal,
} from "./planner-canvas";
import { SlashComposer } from "./slash-composer";
import { latestQuestionRequest } from "./question-card";
import { latestSnapRequest } from "./snap-card";
import { buildTranscript } from "./transcript-days";
import { markTurnStarted, takeTurnLatencyMs } from "./turn-clock";
import { recoverLostTurn } from "./turn-recovery";
import { createReattachableEveSession } from "./reattachable-eve-session";

/**
 * The chat surface, the main column inside the /app frame: the sidebar
 * and phone top bar come from the layout, so this component fills the
 * rest of the viewport and keeps the composer pinned to the bottom while
 * the transcript scrolls inside. useEveAgent drives session state
 * against the same-origin eve routes; auth rides as a bearer token
 * resolved fresh per request. Homa's per-family context (family,
 * children, memories) is injected server-side on every turn by
 * agent/instructions/family-context.ts, so even a brand-new session
 * starts already knowing the family.
 *
 * One thread, fresh mornings (founder direction 2026-07-10 evening):
 * the transcript is ONE continuous history under day separators (the
 * Slack-channel reading of the one chat), while the model session
 * rotates at the first visit after 4am local (chat-storage.ts). Old
 * days stay scrollable above; the morning lands on a clean "today" with
 * the suggestion chips back. The durable record is Postgres
 * (conversation_messages via the persist hook + recall); localStorage
 * is the render cache (M1-02 replaces it as the render source).
 *
 * Never stuck (founder bug report 2026-07-10 night, phone testing:
 * "it kept not letting me respond"): a phone that locks or backgrounds
 * mid-turn kills the NDJSON stream, and a half-open connection can hang
 * without ever erroring, which left status "streaming" and the send
 * button disabled forever, with no busy label once the last text part
 * looked complete. Three defenses, all client-side (the turn itself is
 * durable server-side, and the resumable stream replays missed events
 * from the session's streamIndex on the next send):
 *   1. while Homa works the composer never goes dead: an empty composer
 *      shows Stop; a typed one shows Stop AND Send (founder ruling
 *      2026-07-10, the Claude/Cursor composer shape), and Send while
 *      busy QUEUES the message, delivered the moment the turn ends
 *      (texting model: her thought is never rejected, it just sends
 *      when the line is free);
 *   2. returning to a visible tab with a stream that has been silent
 *      past the stall window waits one grace beat for the stream's own
 *      reconnect to land, then aborts if it never does;
 *   3. a watchdog does the same for streams that die without the tab
 *      ever hiding (radio handoffs), sized generously past the longest
 *      normal tool run.
 *
 * The reconnect itself (incident 2026-07-11, Alessa's worksheet turns):
 * iOS kills the socket when Safari suspends, and WebKit surfaces that
 * as TypeError "Load failed", which eve's stock client treated as a
 * terminal error instead of a disconnect, skipping its own resume and
 * erroring the turn while the durable run finished fine server-side.
 * patches/eve@0.19.0.patch broadens the classifier so those deaths
 * reconnect and replay from streamIndex; maxReconnectAttempts is sized
 * for a phone sleeping repeatedly through a long worksheet turn.
 *
 * Never forked (GH #170, co-founder incidents 2026-07-24/25, a subway
 * losing signal mid-turn): when reconnecting genuinely exhausts itself,
 * or a stream dies before it can even open (no reconnect attempt covers
 * that gap), eve's own client wipes its local session cursor rather than
 * keeping the id (advanceSession in eve's session-utils, no fix
 * available from here). The durable turn is usually still finishing
 * server-side regardless, and lost-turn recovery above exists to find
 * that out, but it can take up to RECOVERY_DEADLINE_MS to decide. A
 * manual send used to see no session id and no "busy" status in that
 * window and start a brand new eve session, forking the conversation in
 * two: whichever session she was not looking at when its reply landed
 * read as "my message vanished". isSendLineOccupied (chat-send-policy.ts)
 * folds `recovering` into the same queue gate as `busy`, so a send
 * during that undecided window queues instead of forking, and
 * flushQueuedMessages delivers it the moment recovery settles either way.
 * Message-level pending/failed status (message-parts.tsx, sourced from
 * eve's own optimistic `client.message.submitted`/`client.message.failed`
 * projection, never a parallel tracker) gives her a retry affordance
 * instead of a message that silently disappears.
 */

// agent.ts pins the gateway model: the mid tier in journeys/06 terms.
const MODEL_TIER = "mid" as const;

const PROMPT_SUGGESTION_LOADING_DELAY_MS = 500;

const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

/** One-time flag for the filing tag's self-introduction. */
const FILING_HINT_STORAGE_KEY = "homa-chat-filing-hint";

/** A backgrounded phone kills the stream within seconds; a stream this
 *  quiet when the tab comes back is dead, not thinking. */
const VISIBLE_STALL_MS = 20_000;

/** How long a just-woken tab waits for the reconnecting stream to show
 *  life before giving up and aborting (incident 2026-07-11: iOS kills
 *  the socket on suspend; the client reconnects and replays from
 *  streamIndex, but that round trip needs a moment). */
const WAKE_GRACE_MS = 5_000;

/** Foreground watchdog: past the longest normal tool run (image-heavy
 *  printables stream nothing while the render runs, ~60-90s). */
const WATCHDOG_STALL_MS = 180_000;

/** Stream reconnects per turn. The default (3) is sized for blips; a
 *  phone that sleeps repeatedly through a 2-minute worksheet turn burns
 *  one per wake, and every retry is cheap (replay resumes from the last
 *  received event, nothing is recomputed). */
const STREAM_RECONNECT_ATTEMPTS = 8;

/** How long lost-turn recovery may keep trying before the plain error
 *  banner wins: past the longest normal turn with slack, so a reply
 *  that is still being written server-side gets its chance to land. */
const RECOVERY_DEADLINE_MS = 240_000;

function currentTimeMs(): number {
  return Date.now();
}

export function ChatClient({
  storageKey,
  familyId,
  timeZone,
  parentName,
  focusChildName,
  focusChildId = null,
  initialDraft,
  kids,
  slashSkills,
  serverHistory = null,
  wall = null,
  onboarding = null,
}: {
  storageKey: string;
  familyId: string | null;
  timeZone: string;
  parentName: string | null;
  /** The per-adult scrollback from Postgres (lib/chat-history.ts):
   * messages plus the sessions' material cards, the same on every
   * device. Null when the fetch failed or the flag is off; the
   * localStorage archive renders instead, exactly as before the M1-02
   * render slice. */
  serverHistory?: ChatHistoryPayload | null;
  /** The wall (plans/2026-07-11-the-wall.md): checkout URLs when this
   * family is walled, null when the composer is open (the default, and
   * always the case while HOMA_WALL_ENABLED is off). */
  wall?: WallCheckout | null;
  /** The kid selected in the context switcher, or null for the whole
   * family. Display only: the agent learns the focus server-side from
   * the same cookie, this just keeps the composer honest about it. */
  focusChildName?: string | null;
  /** The same selection's id: where attachments get filed ("About
   * Maya" = saved in Maya's binder). Verified server-side against the
   * family's own children before any row is written. */
  focusChildId?: string | null;
  /** Pre-fills the composer (the journal email's deep link); the parent
   * still edits and sends herself, nothing auto-sends. */
  initialDraft?: string;
  /** The composer's "/" menu: kids to mention + the advertised skills. */
  kids?: { id: string; name: string; avatarUrl: string | null }[];
  slashSkills?: SlashSkillItem[];
  /** Chat-first onboarding (plans/2026-07-21-chat-first-onboarding.md).
   * Null on every ordinary /app visit, which is every visit until the
   * HOMA_CHAT_ONBOARDING flag is on. Non-null turns this same surface
   * into the first-days surface: a deterministic welcome renders before
   * the model can answer, and one machine message opens the
   * conversation. It is the same component on purpose. A parallel "lean"
   * chat would re-implement lost-turn recovery, the stall triad, and the
   * 4am rotation, and would do it exactly where a first-session parent
   * has the least patience for a dropped turn. */
  onboarding?: OnboardingChatConfig | null;
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  // Load + rotation decision, once per mount (fresh morning = fresh
  // session; the old session's messages fold into the archive).
  const [prepared] = useState(() => prepareChat(storageKey, timeZone));
  const hydrated = useHydrated();
  // A saved event log without a session id is a dead half-turn: the
  // eve client wipes the id when a stream dies without reaching a
  // boundary event. With the server record on screen those events
  // would render the same turn twice (the Vega duplicate bubble,
  // 2026-07-13), and there is nothing to resume anyway, so the server
  // record wins and the store starts clean. Without server history the
  // local events stay: half a transcript beats none.
  const staleSessionlessEvents =
    Boolean(serverHistory) &&
    !prepared.initialSession?.sessionId &&
    prepared.initialEvents.length > 0;
  const [reattachableSession] = useState(() => {
    const client = new Client({
      auth: {
        bearer: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? "";
        },
      },
      host: "",
      maxReconnectAttempts: STREAM_RECONNECT_ATTEMPTS,
    });
    return createReattachableEveSession({
      createSession: (state) => client.session(state),
      initialSession: staleSessionlessEvents
        ? undefined
        : prepared.initialSession,
    });
  });
  const initialLiveMessages = staleSessionlessEvents
    ? []
    : foldEventsToMessages(prepared.initialEvents);
  const serverArchived = useMemo(
    () =>
      serverHistory ? archiveFromServerHistory(serverHistory, []) : [],
    [serverHistory],
  );
  // Scrollback: the server record when the page load carried it (one
  // thread, same on every device), the localStorage cache otherwise.
  // Server rows stay unless the live reducer has the exact same turn.
  // A partial local replay can therefore never hide durable work.
  const [archived, setArchived] = useState<ArchivedMessage[]>(() =>
    serverHistory
      ? archiveFromServerHistory(serverHistory, initialLiveMessages)
      : prepared.archived,
  );
  const [restoredPromptSuggestionSet] =
    useState<PromptSuggestionSet | null>(() =>
      restorePromptSuggestionSetForVisibleMessages({
        archivedMessages: archived.map(({ message }) => message),
        currentMessages: initialLiveMessages,
        promptSuggestionSet: prepared.promptSuggestions,
        staleSessionlessEvents,
      }),
    );
  const [promptSuggestionSet, setPromptSuggestionSet] =
    useState<PromptSuggestionSet | null>(restoredPromptSuggestionSet);
  const [promptSuggestionPhase, setPromptSuggestionPhase] =
    useState<PromptSuggestionPhase>(
      restoredPromptSuggestionSet ? "ready" : "idle",
    );
  const promptSuggestionAbortRef = useRef<AbortController | null>(null);
  const promptSuggestionLoadingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptSuggestionRequestStartedAtRef = useRef<number | null>(null);
  const suggestionSetIdForTurnRef = useRef<string | null>(null);
  // Message id -> arrival time. State (not a ref) because the transcript
  // grouping reads it during render.
  const [liveTimes, setLiveTimes] = useState<Record<string, number>>(() => ({
    ...prepared.messageTimes,
  }));
  const messagesRef = useRef<readonly EveMessage[]>([]);
  const archivedRef = useRef(archived);
  const reportedErrorRef = useRef<Error | null>(null);
  /** Last moment the stream showed signs of life (0 = none yet). */
  const lastStreamActivityRef = useRef(0);
  /** Messages sent while a turn was running; flushed as one message the
   *  moment the line is free. */
  const [queued, setQueued] = useState<QueuedChatMessage[]>([]);
  /** Mirrors `queued` for the recovery callback below, which is memoized
   *  independently of render and would otherwise read a stale queue. */
  const queuedRef = useRef<QueuedChatMessage[]>(queued);
  /** The store's send, held by ref so onFinish can deliver the queue
   *  without capturing `agent` inside its own initializer (the React
   *  Compiler rejects that self-capture on mobile; twins stay alike). */
  const sendRef = useRef<
    ((input: {
      message: string | UserContent;
      headers?: Readonly<Record<string, string>>;
    }) => Promise<void>) | null
  >(null);
  /** Lost-turn recovery, held by ref for onFinish (same reason). */
  const startRecoveryRef = useRef<(() => void) | null>(null);
  // The attach flow (approved chat redesign): staged files upload to
  // the family's own blob space as she picks them; send trades URLs
  // for model parts and binder receipts.
  const attachments = useChatAttachments(familyId);
  const [preparingAttachments, setPreparingAttachments] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  /** Save receipts keyed by the sent message's summary text, so the
   *  receipt chips render under the exact user bubble that carried the
   *  files (live-session state; scrollback shows media without them). */
  const [receiptsBySummary, setReceiptsBySummary] = useState<
    Record<string, ChatAttachmentReceipt[]>
  >({});
  /** Message id -> turn duration in whole seconds, the worked-for
   *  line's count. Client-observed, live session only. */
  const [turnSeconds, setTurnSeconds] = useState<Record<string, number>>({});
  /** Progress-card partKey -> the answer she tapped, so the spent card
   *  reads past tense (live-session state, like the receipts). */
  const [progressAnswers, setProgressAnswers] = useState<Record<string, string>>(
    {},
  );
  /** Choice-card partKey -> what she sent from it, so the spent card
   *  reads past tense (live-session state, like progressAnswers). */
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>(
    {},
  );
  /** The planner canvas beside the chat: open with a focus (or null for
   *  closed). Opens when a NEW open_planner result streams in, reopens
   *  from any planner card in the transcript, closes with its X. */
  const [plannerCanvas, setPlannerCanvas] = useState<PlannerOpenSignal | null>(
    null,
  );
  /** The newest open_planner part already acted on. Starts undefined so
   *  the first pass records whatever a restored session carries WITHOUT
   *  opening it: a mid-day reload should not throw the panel back up. */
  const handledPlannerPartKeyRef = useRef<string | null | undefined>(undefined);
  /** One kickoff per mount. See the kickoff effect for the other two locks. */
  const kickoffSentRef = useRef(false);
  /** sendMessage is declared below the effects that need it, and the
   *  React Compiler rejects an effect capturing it directly, the same
   *  reason sendRef exists for onFinish. */
  const sendMessageRef = useRef<
    ((text: string, source: ChatSendSource) => ChatSendAcceptance) | null
  >(null);
  /** The child whose questions have taken over the screen, or null. */
  const [checklistTakeover, setChecklistTakeover] = useState<string | null>(null);
  /** True while the app-chained homeschool card holds the composer slot
   *  (set the moment the basics card saves during onboarding), with the
   *  basics summary parked until the chained card settles. */
  const [chainedHomeschool, setChainedHomeschool] = useState(false);
  const chainedBasicsSummaryRef = useRef<string | null>(null);
  /**
   * The kid chain: the app asks "any other kids?" and draws the next
   * child card itself, so a family of three costs one model turn instead
   * of three (founder walk, 2026-07-28).
   *
   * "choice" is the between-children question; "card" is a fresh child
   * card the app docked rather than the model. Their summaries collect
   * here and go to Homa as ONE message once she says that is everyone,
   * so Homa reacts to the family rather than to each child in turn.
   */
  const [kidChainStage, setKidChainStage] = useState<"choice" | "card" | null>(
    null,
  );
  const kidSummariesRef = useRef<string[]>([]);
  /** Whether the docked card's CURRENT question is open ended. Reported
   *  by the card itself, since only it knows which step is showing. */
  const [cardStepOpenEnded, setCardStepOpenEnded] = useState(false);
  const lastKidNameRef = useRef<string>("");
  /**
   * True while the app's OWN basics card holds the slot, drawn on mount
   * instead of waiting on a model turn for a constant (appOpensWithBasics).
   *
   * Initialised from the prop rather than set in an effect: an effect runs
   * after paint, so the parent would get one frame of an empty footer
   * under the welcome, which is the flicker this whole change exists to
   * delete. Once the card saves it chains onward exactly as the model's
   * card did, through the same parked-summary path.
   */
  const [appBasics, setAppBasics] = useState(() =>
    onboarding ? appOpensWithBasics(onboarding) : false,
  );
  const turnStartedAtRef = useRef<number | null>(null);
  const childNameById = useMemo(
    () => new Map((kids ?? []).map((kid) => [kid.id, kid.name])),
    [kids],
  );
  const progressAnswersMap = useMemo(
    () => new Map(Object.entries(progressAnswers)),
    [progressAnswers],
  );
  const questionAnswersMap = useMemo(
    () => new Map(Object.entries(questionAnswers)),
    [questionAnswers],
  );
  // Whether dictation fed the current draft, and the modality of the
  // turn in flight (read later by onFinish / the error effect). Refs,
  // not state: nothing renders from them.
  const draftFromVoiceRef = useRef(false);
  const turnModalityRef = useRef<ChatTurnModality>("text");
  const progressActionLifecycleRef =
    useRef<ProgressActionLifecycleState>(
      createProgressActionLifecycleState(),
    );
  const [
    progressActionLifecycle,
    setProgressActionLifecycle,
  ] = useState<ProgressActionLifecycleState>(
    createProgressActionLifecycleState,
  );
  // Lost-turn recovery bookkeeping (turn-recovery.ts): the durable
  // stream cursor (session streamIndex at mount + one per received
  // event, surviving localStorage event trimming), what the last send
  // carried, and the in-flight recovery's abort handle.
  const durableCursorRef = useRef(
    staleSessionlessEvents ? 0 : prepared.initialSession?.streamIndex ?? 0,
  );
  const lastSendRef = useRef<{ text: string; atMs: number } | null>(null);
  const recoveryRef = useRef<AbortController | null>(null);
  const [recovering, setRecovering] = useState(false);
  /**
   * Dev only, and only ever set to a time we can prove: when a turn
   * fails on localhost, ask whether this machine's gateway credential is
   * the reason before blaming the product. Null in production, where the
   * route it reads 404s. See app/api/dev/oidc-status/route.ts.
   */
  const [staleOidcAt, setStaleOidcAt] = useState<number | null>(null);
  /** True between a stall auto-stop (watchdog / wake grace) and the
   *  onFinish it causes: the one stop that should trigger recovery,
   *  because nobody chose it and the durable turn may have finished. */
  const autoStoppedRef = useRef(false);

  const clearPromptSuggestionLoadingTimer = useCallback(() => {
    if (promptSuggestionLoadingTimerRef.current === null) return;
    clearTimeout(promptSuggestionLoadingTimerRef.current);
    promptSuggestionLoadingTimerRef.current = null;
  }, []);

  const cancelPromptSuggestionRequest = useCallback(() => {
    const controller = promptSuggestionAbortRef.current;
    promptSuggestionAbortRef.current = null;
    controller?.abort();
    clearPromptSuggestionLoadingTimer();
    promptSuggestionRequestStartedAtRef.current = null;
  }, [clearPromptSuggestionLoadingTimer]);

  const clearPromptSuggestionState = useCallback(() => {
    cancelPromptSuggestionRequest();
    setPromptSuggestionSet(null);
    setPromptSuggestionPhase("idle");
    updateSavedPromptSuggestionSet(storageKey, null);
  }, [cancelPromptSuggestionRequest, storageKey]);

  const emitPromptSuggestionsShown = useCallback(
    async (suggestionSet: PromptSuggestionSet, latencyMs: number) => {
      if (!familyId) return;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return;
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      await emitEvent(
        { supabaseUrl: url, supabaseKey: key, accessToken, familyId },
        "chat.prompt_suggestions_shown",
        {
          suggestion_set_id: suggestionSet.setId,
          prompt_version: suggestionSet.promptVersion,
          source: suggestionSet.source,
          count: suggestionSet.suggestions.length,
          latency_ms: latencyMs,
        },
      );
    },
    [familyId, supabase],
  );

  const emitPromptSuggestionTapped = useCallback(
    async (suggestionSet: PromptSuggestionSet, position: number) => {
      if (!familyId) return;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return;
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      await emitEvent(
        { supabaseUrl: url, supabaseKey: key, accessToken, familyId },
        "chat.prompt_suggestion_tapped",
        {
          suggestion_set_id: suggestionSet.setId,
          prompt_version: suggestionSet.promptVersion,
          source: suggestionSet.source,
          position,
        },
      );
    },
    [familyId, supabase],
  );

  const requestPromptSuggestionsForMessages = useCallback(
    async (messages: readonly EveMessage[]): Promise<void> => {
      clearPromptSuggestionState();
      const request = promptSuggestionRequestForMessages(messages);
      if (!request) return;

      const controller = new AbortController();
      const startedAt = currentTimeMs();
      promptSuggestionAbortRef.current = controller;
      promptSuggestionRequestStartedAtRef.current = startedAt;
      setPromptSuggestionPhase("pending");
      promptSuggestionLoadingTimerRef.current = setTimeout(() => {
        if (
          promptSuggestionAbortRef.current === controller
          && !controller.signal.aborted
        ) {
          setPromptSuggestionPhase("loading");
        }
      }, PROMPT_SUGGESTION_LOADING_DELAY_MS);

      try {
        const suggestionSet = await requestPromptSuggestionSet(request, {
          signal: controller.signal,
        });
        if (
          promptSuggestionAbortRef.current !== controller
          || controller.signal.aborted
        ) {
          return;
        }

        const requestStartedAt =
          promptSuggestionRequestStartedAtRef.current ?? startedAt;
        clearPromptSuggestionLoadingTimer();
        promptSuggestionAbortRef.current = null;
        promptSuggestionRequestStartedAtRef.current = null;
        setPromptSuggestionSet(suggestionSet);
        setPromptSuggestionPhase("ready");
        updateSavedPromptSuggestionSet(storageKey, suggestionSet);
        void emitPromptSuggestionsShown(
          suggestionSet,
          Math.max(0, currentTimeMs() - requestStartedAt),
        );
      } catch (error) {
        if (
          promptSuggestionAbortRef.current !== controller
          || controller.signal.aborted
          || (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        clearPromptSuggestionLoadingTimer();
        promptSuggestionAbortRef.current = null;
        promptSuggestionRequestStartedAtRef.current = null;
        setPromptSuggestionPhase("idle");
      }
    },
    [
      clearPromptSuggestionLoadingTimer,
      clearPromptSuggestionState,
      emitPromptSuggestionsShown,
      storageKey,
    ],
  );

  const promptSuggestionLifecycleHandlers =
    useMemo<PromptSuggestionLifecycleHandlers<EveMessage>>(
      () => ({
        clear: clearPromptSuggestionState,
        requestMessages: (messages) => {
          void requestPromptSuggestionsForMessages(messages);
        },
        startRecovery: () => {
          startRecoveryRef.current?.();
        },
      }),
      [
        clearPromptSuggestionState,
        requestPromptSuggestionsForMessages,
      ],
    );

  const emitTurnCompleted = useCallback(
    async (
      status: "ok" | "error",
      errorClass?: "turn_failed" | "send_failed" | "unknown",
    ) => {
      const suggestionSetId = suggestionSetIdForTurnRef.current;
      suggestionSetIdForTurnRef.current = null;
      if (!familyId) return;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return;
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      await emitEvent(
        { supabaseUrl: url, supabaseKey: key, accessToken, familyId },
        "chat.turn_completed",
        {
          status,
          ...(errorClass ? { error_class: errorClass } : {}),
          modality: turnModalityRef.current,
          latency_ms: takeTurnLatencyMs(),
          model_tier: MODEL_TIER,
          tool_calls: countLastTurnToolCalls(messagesRef.current),
          ...(suggestionSetId
            ? { suggestion_set_id: suggestionSetId }
            : {}),
        },
      );
    },
    [familyId, supabase],
  );

  const agent = useEveAgent({
    initialEvents: staleSessionlessEvents ? [] : prepared.initialEvents,
    session: reattachableSession.session,
    onEvent() {
      lastStreamActivityRef.current = currentTimeMs();
      durableCursorRef.current += 1;
    },
    onFinish(snapshot) {
      // Stamp this turn's new message ids with the clock (the only time
      // source the transcript has; eve events carry sequence numbers,
      // not times), then persist. Callbacks refresh every render (eve's
      // hook contract), so this closure's liveTimes is current.
      const stamped = pruneMessageTimes(
        stampMessageTimes(liveTimes, snapshot.data.messages),
        snapshot.data.messages,
      );
      setLiveTimes(stamped);
      // The worked-for line's count: how long this turn ran, keyed by
      // the reply it produced.
      const lastMessage = snapshot.data.messages.at(-1);
      if (lastMessage?.role === "assistant" && turnStartedAtRef.current !== null) {
        const seconds = Math.floor(
          (currentTimeMs() - turnStartedAtRef.current) / 1000,
        );
        setTurnSeconds((current) => ({ ...current, [lastMessage.id]: seconds }));
      }
      turnStartedAtRef.current = null;
      saveChat(storageKey, {
        archived: archivedRef.current,
        events: snapshot.events,
        session: snapshot.session,
        messageTimes: stamped,
        lastActivityAt: currentTimeMs(),
      });
      // onFinish fires for failed turns too; those already emit their
      // own error event (the agent.error effect), so an unconditional
      // "ok" here double-counted every failure (seen live 2026-07-11).
      // Consume the stall marker before choosing a suggestion action.
      // A partial auto-stopped reply belongs to recovery, never generation.
      const autoStopped = autoStoppedRef.current;
      autoStoppedRef.current = false;
      const promptSuggestionAction =
        promptSuggestionActionForLifecycleEvent({
          type: "turn_finished",
          hasError: Boolean(snapshot.error),
          autoStopped,
          hasQueuedFollowup: queued.length > 0,
        });
      if (!snapshot.error) void emitTurnCompleted("ok");
      executePromptSuggestionLifecycleAction(
        promptSuggestionAction,
        snapshot.data.messages,
        promptSuggestionLifecycleHandlers,
      );
      // The post-turn review trigger (M2-13): fire-and-forget; the server
      // decides whether enough new conversation accumulated to review.
      const sessionId = snapshot.session?.sessionId;
      if (familyId && sessionId) {
        void fetch("/api/learning/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {
          // Best effort: a missed review re-arms on the next turn.
        });
      }
      // Deliver the queue: messages she sent while Homa was working go
      // out as ONE follow-up turn the moment the line is free (also
      // after Stop, which is often pressed exactly to jump the line).
      // A failed turn holds the queue; her next manual send carries it.
      if (!snapshot.error) flushQueuedMessages();
    },
  });
  const agentError = agent.error;
  const agentReset = agent.reset;
  const agentSend = agent.send;
  const agentStop = agent.stop;

  useEffect(() => {
    sendRef.current = agentSend;
  }, [agentSend]);

  // Only on a failure, so the happy path never pays for it, and only
  // when the answer is certain: an unreadable or missing token leaves
  // this null, because "we could not check" must never render as "your
  // token expired". In production the route 404s and this is a no-op.
  useEffect(() => {
    // No synchronous clear: the render is gated on agent.error anyway, so
    // a leftover value cannot show, and setting state in an effect body
    // is what cascading renders are made of. Every write happens after
    // the answer comes back, including the write back to null.
    if (!agentError) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/dev/oidc-status");
        if (cancelled) return;
        if (!response.ok) {
          setStaleOidcAt(null);
          return;
        }
        const data = (await response.json()) as {
          expired?: boolean;
          expiresAt?: number | null;
        };
        if (cancelled) return;
        const confirmed =
          data.expired === true && typeof data.expiresAt === "number";
        setStaleOidcAt(confirmed ? (data.expiresAt as number) : null);
      } catch {
        // No route, no network, no opinion.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentError]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  useEffect(() => {
    if (
      prepared.promptSuggestions !== null
      && restoredPromptSuggestionSet === null
    ) {
      updateSavedPromptSuggestionSet(storageKey, null);
    }
  }, [prepared.promptSuggestions, restoredPromptSuggestionSet, storageKey]);

  useEffect(() => {
    return () => {
      promptSuggestionAbortRef.current?.abort();
      if (promptSuggestionLoadingTimerRef.current !== null) {
        clearTimeout(promptSuggestionLoadingTimerRef.current);
      }
    };
  }, []);

  const [draft, setDraft] = useState(initialDraft ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const firstScrollDoneRef = useRef(false);
  // The way home from a scrollback: one centered arrow, shown only when
  // she is genuinely away from now (founder cut 2026-07-12: no words,
  // just the arrow).
  const transcriptRef = useRef<HTMLElement | null>(null);
  const [showBackToNow, setShowBackToNow] = useState(false);
  // The top edge fades the past into "everything above" (approved
  // redesign, the founder's dim rule); it lifts at the very top, where
  // there is nothing left to fade into.
  const [topFaded, setTopFaded] = useState(false);
  const handleTranscriptScroll = useCallback(() => {
    const el = transcriptRef.current;
    if (!el) return;
    setShowBackToNow(el.scrollHeight - el.clientHeight - el.scrollTop > 600);
    setTopFaded(el.scrollTop > 8);
  }, []);
  const busy = agent.status === "submitted" || agent.status === "streaming";
  // The wall (plans/2026-07-11-the-wall.md): the chat door. One
  // door-tap beacon per visit (the ref), and a walled family's send
  // opens the offer instead of the turn, draft intact.
  const [wallOpen, setWallOpen] = useState(false);
  const chatDoorTappedRef = useRef(false);
  // The filing tag's plain-words hint: opens once by itself the first
  // time the tag ever appears, then only on tap. After first paint on
  // purpose (no SSR mismatch, no setState-in-effect cascade).
  const [filingHintOpen, setFilingHintOpen] = useState(false);
  /** The in-app voice conversation (#283). Mounted only while open so the
   * socket and the microphone exist exactly as long as she is talking. */
  const [voiceOpen, setVoiceOpen] = useState(false);
  /** Turns said out loud this visit, in the order they were said.
   *
   * They render as ordinary bubbles in the thread, because that is what
   * they are. They deliberately do NOT go through eve: text Homa must not
   * answer what voice Homa just said (founder direction 2026-07-29). The
   * voice route writes each one to conversation_messages, so a refresh
   * brings them back through server history like any other message, and
   * the next thing the parent TYPES sees them as context.
   */
  const [spoken, setSpoken] = useState<ArchivedMessage[]>([]);
  const appendSpokenTurn = useCallback((line: VoiceTranscriptLine) => {
    setSpoken((previous) => [
      ...previous,
      {
        at: currentTimeMs(),
        // Numbered by how many turns this VISIT has heard, which is not the
        // same as the turn's sequence in its conversation. She can talk,
        // stop, and talk again, and each conversation numbers itself from
        // zero; this id has to stay unique across all of them, because it is
        // what React renders the thread by.
        message: spokenTurnMessage(line, previous.length) as EveMessage,
        channel: "web",
        modality: "voice",
      },
    ]);
  }, []);
  useEffect(() => {
    if (!focusChildName) return;
    const frame = requestAnimationFrame(() => {
      try {
        if (window.localStorage.getItem(FILING_HINT_STORAGE_KEY)) return;
        window.localStorage.setItem(FILING_HINT_STORAGE_KEY, "shown");
        setFilingHintOpen(true);
      } catch {
        // Storage blocked: the tag still opens the hint on tap.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [focusChildName]);

  // Voice input (FR-4's dictation leg): the transcript joins whatever
  // is already typed, and she reviews the words before sending. The
  // draft setter reads current state so back-to-back takes stack.
  const dictation = useDictation((transcript) => {
    draftFromVoiceRef.current = true;
    setDraft((current) =>
      current.trim().length === 0 ? transcript : `${current.trimEnd()} ${transcript}`,
    );
  });

  // Elapsed seconds beside the busy label (the reference transcript's
  // "· 19s"): long waits read as work in progress, not a hang. Reset
  // happens in sendMessage (an event handler), so this effect only ticks.
  const [busySeconds, setBusySeconds] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const startedAt = currentTimeMs();
    const timer = setInterval(() => {
      setBusySeconds(Math.floor((currentTimeMs() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    messagesRef.current = agent.data.messages;
  }, [agent.data.messages]);

  useEffect(() => {
    archivedRef.current = archived;
  }, [archived]);

  useEffect(() => {
    queuedRef.current = queued;
  }, [queued]);

  /**
   * flushQueuedMessages(): delivers the head of the queue as the next
   * turn, the one place besides the composer's own send that starts a
   * turn. Shared by onFinish (a normal turn just ended) and lost-turn
   * recovery's three exits (recovered, failed, or timed out): whichever
   * way the line becomes free again, whatever she typed while it was
   * occupied goes out the moment it is.
   */
  const flushQueuedMessages = useCallback(() => {
    if (queuedRef.current.length === 0) return;
    const flush = flushChatQueue(queuedRef.current);
    const message = flush.outgoing;
    setQueued(flush.remaining);
    if (message === null) return;
    // Next tick: this can run inside the previous send's own teardown
    // (onFinish) or inside a recovery's async close-out, and eve rejects
    // overlapping sends.
    setTimeout(() => {
      setBusySeconds(0);
      turnModalityRef.current = flush.modality;
      lastSendRef.current = { text: message, atMs: currentTimeMs() };
      turnStartedAtRef.current = currentTimeMs();
      markTurnStarted();
      void sendRef.current?.({
        message,
        headers: messageModalityHeaders(turnModalityRef.current),
      });
    }, 0);
  }, []);

  /**
   * Lost-turn recovery (incident 2026-07-11 follow-up): the durable
   * run usually outlives a dead stream, so replay the session
   * server-side and fold the finished conversation, reply and material
   * cards included, back into the transcript. Shared by the error
   * banner path and the stall auto-stop path; no-ops while a recovery
   * is already running.
   *
   * Session-fork fix (GH #170, the 2026-07-24/25 co-founder incidents):
   * a manual send used to stand down a running recovery and start
   * sending on whatever session state was left (the eve client wipes its
   * session cursor the moment the stream dies without a closing boundary
   * event, so that state has no session id). That raced the durable old
   * turn, which was usually still finishing server-side, into a second,
   * unrelated eve session for the same family: two live sessions, and
   * whichever one she was not looking at when its reply landed read as
   * "my message vanished". Recovery now runs to its own conclusion
   * (recovered, failed, or timed out) with sends queued instead of
   * forking (isSendLineOccupied in chat-send-policy.ts), and
   * flushQueuedMessages delivers whatever she typed the moment recovery
   * settles, exactly like a normal turn's onFinish.
   */
  const startLostTurnRecovery = useCallback(() => {
    const lastSend = lastSendRef.current;
    if (!lastSend || recoveryRef.current) return;
    executePromptSuggestionLifecycleAction(
      promptSuggestionActionForLifecycleEvent({
        type: "recovery_started",
      }),
      null,
      promptSuggestionLifecycleHandlers,
    );
    const controller = new AbortController();
    recoveryRef.current = controller;
    const deadline = setTimeout(() => controller.abort(), RECOVERY_DEADLINE_MS);
    setRecovering(true);
    void (async () => {
      const recovered = await recoverLostTurn({
        supabase,
        sentText: lastSend.text,
        sentAtMs: lastSend.atMs,
        minBoundaryIndex: durableCursorRef.current,
        bearer: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? "";
        },
        signal: controller.signal,
      });
      clearTimeout(deadline);
      if (recoveryRef.current === controller) recoveryRef.current = null;
      if (controller.signal.aborted) {
        executePromptSuggestionLifecycleAction(
          promptSuggestionActionForLifecycleEvent({
            type: "recovery_finished",
            outcome: "aborted",
          }),
          null,
          promptSuggestionLifecycleHandlers,
        );
        setRecovering(false);
        // Gave up without a server answer, but the client still knows
        // what it saw before the stream died (GH #466: this branch used
        // to return here with no archive and no reset, so the stale live
        // messages sat in agent.data.messages forever, un-cleared, while
        // a fresh send below appended straight past them. A message with
        // no stamped time renders as "now" every render, and eve's own
        // session-cursor wipe on the dead stream meant a later page load
        // asked the server for the wrong session, so both the ordering
        // and the disappearance traced back to this same gap.) Fold
        // whatever is still live into the archive, same shape as the
        // recovered branch below, just sourced from local state since
        // the server never confirmed one way or the other.
        const stillLive = messagesRef.current;
        if (stillLive.length > 0) {
          const stamped = stampMessageTimes(liveTimes, stillLive);
          const nextArchived = [
            ...archivedRef.current,
            ...archiveMessages(stillLive, stamped),
          ];
          setArchived(nextArchived);
          archivedRef.current = nextArchived;
          setLiveTimes({});
          saveChat(storageKey, {
            archived: nextArchived,
            events: [],
            session: undefined,
            messageTimes: {},
            lastActivityAt: currentTimeMs(),
          });
          agentReset();
          durableCursorRef.current = 0;
        }
        // Same fresh-session fallback a failed recovery gets below, so
        // whatever she typed while waiting still goes out.
        flushQueuedMessages();
        return;
      }
      if (recovered) {
        // The fresh-start move done for her: the whole recovered session
        // folds into the archive (reply included), then the store adopts
        // the recovered cursor before its visible projection resets. The
        // next send therefore continues this durable session instead of
        // minting a replacement (GH #493). Nothing is lost or forked.
        const messages = foldEventsToMessages(recovered.events);
        const stamped = stampMessageTimes(liveTimes, messages);
        const nextArchived = [
          ...archivedRef.current,
          ...archiveMessages(messages, stamped),
        ];
        setArchived(nextArchived);
        archivedRef.current = nextArchived;
        setLiveTimes({});
        reattachableSession.adopt(recovered.session);
        saveChat(storageKey, {
          archived: nextArchived,
          events: [],
          session: recovered.session,
          messageTimes: {},
          lastActivityAt: currentTimeMs(),
        });
        agentReset();
        durableCursorRef.current = recovered.session.streamIndex;
        lastSendRef.current = null;
        executePromptSuggestionLifecycleAction(
          promptSuggestionActionForLifecycleEvent({
            type: "recovery_finished",
            outcome: "recovered",
          }),
          messages,
          promptSuggestionLifecycleHandlers,
        );
      } else {
        executePromptSuggestionLifecycleAction(
          promptSuggestionActionForLifecycleEvent({
            type: "recovery_finished",
            outcome: "failed",
          }),
          null,
          promptSuggestionLifecycleHandlers,
        );
      }
      setRecovering(false);
      // Whichever way it resolved, the line is free again: send anything
      // she typed while it was undecided (a fresh session either way,
      // since eve already wiped this one's session id when the stream
      // died, or agentReset just did on a clean recovery above).
      flushQueuedMessages();
    })();
  }, [
    agentReset,
    flushQueuedMessages,
    liveTimes,
    promptSuggestionLifecycleHandlers,
    reattachableSession,
    storageKey,
    supabase,
  ]);

  useEffect(() => {
    startRecoveryRef.current = startLostTurnRecovery;
  }, [startLostTurnRecovery]);

  useEffect(() => {
    if (!agentError || agentError === reportedErrorRef.current) return;
    reportedErrorRef.current = agentError;
    void emitTurnCompleted("error", "turn_failed");
    startLostTurnRecovery();
  }, [agentError, emitTurnCompleted, startLostTurnRecovery]);

  // Give up a running recovery when she leaves the page.
  useEffect(() => {
    return () => recoveryRef.current?.abort();
  }, []);

  // Dead-stream recovery (defenses 2 and 3 from the header): abort a
  // stream that has clearly stopped flowing so the composer never locks.
  // stop() flips status back to ready; the durable turn continues
  // server-side and its events replay from streamIndex on the next send.
  // Since the eve stream reconnects on its own (patched disconnect
  // classifier + maxReconnectAttempts above), a just-woken tab first
  // gets a grace window: if the reconnect delivers any event, the turn
  // is alive and nothing aborts.
  useEffect(() => {
    if (!busy) return;
    // The turn just started; that counts as activity (the stall clock
    // must never inherit a stamp from a previous turn).
    lastStreamActivityRef.current = currentTimeMs();
    let wakeGraceTimer: ReturnType<typeof setTimeout> | null = null;
    const isStale = (stallMs: number) =>
      currentTimeMs() - lastStreamActivityRef.current > stallMs;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!isStale(VISIBLE_STALL_MS) || wakeGraceTimer !== null) return;
      wakeGraceTimer = setTimeout(() => {
        wakeGraceTimer = null;
        // Still nothing after the grace: the stream really is dead.
        if (isStale(VISIBLE_STALL_MS)) {
          autoStoppedRef.current = true;
          agentStop();
        }
      }, WAKE_GRACE_MS);
    };
    const watchdog = setInterval(() => {
      if (isStale(WATCHDOG_STALL_MS)) {
        autoStoppedRef.current = true;
        agentStop();
      }
    }, 15_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(watchdog);
      if (wakeGraceTimer !== null) clearTimeout(wakeGraceTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [agentStop, busy]);

  // prepareChat reads localStorage in the browser, but localStorage does
  // not exist during SSR. Rendering that restored state immediately made
  // React compare the server's durable transcript with a different client
  // tree and regenerate the whole chat during hydration (GH #405). Keep
  // the first client snapshot on server-known data, then add the local
  // live-session overlay once useSyncExternalStore reports hydration.
  const renderSources = hydrationSafeTranscriptSources({
    hydrated,
    serverArchived,
    clientArchived: archived,
    clientLive: agent.data.messages,
    clientLiveTimes: liveTimes,
    clientSpoken: spoken,
  });
  const renderMessages = renderSources.live;
  const renderBusy = hydrated && busy;
  const transcript = buildTranscript({
    archived: renderSources.archived,
    live: renderMessages,
    liveTimes: renderSources.liveTimes,
    spoken: renderSources.spoken,
    timeZone,
  });
  const liveMessageSet = new Set<EveMessage>(renderMessages);
  const progressSessionKey =
    agent.session?.sessionId ??
    prepared.initialSession?.sessionId ??
    "pending";
  const progressInteraction = latestProgressMessageInteraction({
    messages: renderMessages,
    sessionKey: progressSessionKey,
    unavailableActionKeys: progressActionUnavailableKeys(
      progressActionLifecycle,
    ),
  });
  const hasAnyMessages = transcript.some((item) => item.kind === "message");
  // The opening directive is a transcript item that renders nothing, and
  // so is a turn that died before writing a word. Neither counts as the
  // conversation having started, and neither does a turn that only called
  // a tool: a lone "Worked on it" eyebrow is work, not hello.
  const hasVisibleMessages = transcript.some(
    (item) => item.kind === "message" && messageSaysSomething(item.message),
  );
  /**
   * The opening moment: onboarding, and she has not said anything yet.
   *
   * The transcript layout is right for turn fifty and wrong for turn one.
   * With a single paragraph and a single card it stretches the two to
   * opposite ends of the phone, leaving 600px of nothing between the
   * sentence and the ask, and empty reads as unfinished rather than calm
   * on the one screen that has to feel composed (founder note,
   * 2026-07-28). So while this holds, the welcome and the docked card
   * center as one group instead.
   *
   * It spans exactly the introduction: the welcome, the basics card, and
   * the homeschool card chained behind it. Her combined answer is the
   * first thing anybody says, so the layout hands over to the
   * conversation at the moment she joins it, which is the seam that means
   * something.
   *
   * Neither of the two cheaper predicates above can express that.
   * hasAnyMessages goes true on mount, because the kickoff is a hidden
   * directive: a real message that renders as nothing. hasVisibleMessages
   * goes true the instant the first card lands, because a card counts as
   * an assistant item, and the card is the one thing this layout exists
   * to compose. Asking that question shipped a screen that centered while
   * Homa was working and snapped apart as the ask arrived (founder walk,
   * 2026-07-28).
   */
  const openingMoment =
    onboarding !== null &&
    !transcript.some(
      (item) => item.kind === "message" && messageSpeaksWords(item.message),
    );
  // The chips return whenever a session has no words in it yet: the
  // first run, and a fresh morning over yesterday's scrollback.
  const showSuggestions =
    renderMessages.length === 0 && !renderBusy && onboarding === null;
  // The snap card's dim rule (founder call): while Homa's camera ask is
  // the live question, everything above it steps back. The only full
  // dim in the product; the card's own message stays full strength.
  const activeSnap = renderBusy ? null : latestSnapRequest(renderMessages);
  // The live choice card, if any: only the newest unanswered card takes
  // taps, and only while the line is free.
  const activeQuestion = renderBusy
    ? null
    : latestQuestionRequest(renderMessages);
  // Computed here, above the rail gate that reads them; the docking
  // logic further down shares these same values.
  // The one checklist card that may still open the questions, and the
  // one report reveal that may still open the report. Same rule as the
  // snap card: newest, nothing from her after it, and only while the
  // line is free.
  // Two questions, and conflating them was a bug the founder hit: "ok
  // this didnt make a card". The card HAD been made. Because `active`
  // was gated on `busy`, it rendered as its own spent pill for the rest
  // of the turn, so what she saw where a card should be was the grey
  // receipt that means "already done".
  //
  // So: latest decides whether it renders as a card at all, and busy
  // only decides whether it can be tapped yet.
  const latestChecklist = latestChecklistRequest(renderMessages);
  const activeChecklist = renderBusy ? null : latestChecklist;
  const activeReport = latestReportReveal(renderMessages);
  const promptSuggestionRailAllowed =
    !renderBusy
    && !recovering
    && promptSuggestionPhase !== "idle"
    && progressInteraction === null
    && activeSnap === null
    && activeQuestion === null
    // Never during onboarding. The arc has exactly one next thing at
    // every beat, and the rail is a second voice proposing a different
    // one: the founder's walk ended on a card saying "Start the
    // questions", a chip saying "Explain next step", and an open box,
    // three answers to what-do-I-do-now. The rail also knew the word
    // "step", which the mode bans Homa herself from saying.
    && onboarding === null
    // And never while any card holds the floor, onboarding or not. The
    // list knew snap and question cards but was never taught the
    // checklist invite or the report reveal.
    && activeChecklist === null
    && activeReport === null
    && draft.trim().length === 0
    && attachments.staged.length === 0
    && dictation.phase === "idle";
  const showPromptSuggestionRail =
    hydrated
    && promptSuggestionRailAllowed
    && (
      promptSuggestionPhase === "loading"
      || (
        promptSuggestionPhase === "ready"
        && (promptSuggestionSet?.suggestions.length ?? 0) > 0
      )
    );

  useEffect(() => {
    // First paint lands at the bottom instantly (yesterday above the
    // fold, today in view); later updates glide.
    bottomRef.current?.scrollIntoView({
      behavior: firstScrollDoneRef.current ? "smooth" : "auto",
    });
    firstScrollDoneRef.current = true;
  }, [agent.data.messages, archived, queued]);

  const focusComposer = useCallback(() => {
    focusChatComposerInput(composerFormRef.current);
  }, []);

  // The whole report, from the reveal card. It is a real page with a
  // real URL, so it opens as one: the conversation is still here when
  // she comes back, and the link is hers to keep.
  const openChildReport = useCallback((childId: string) => {
    window.location.assign(`/app/${childId}/report`);
  }, []);

  // A filled facts card hands the conversation back. It goes through the
  // directive lane, not as her message: she did not type this, and a
  // summary of her own form arriving as her chat bubble is exactly the
  // failure the lane exists to prevent. The values are a hint only, so
  // Homa reacts to the right person; family context carries the truth.
  const handleDetailsSaved = useCallback((summary: string) => {
    sendMessageRef.current?.(
      formatHiddenDirective("details_saved", { summary }),
      { kind: "directive" },
    );
  }, []);

  // Canvas auto-open: a NEW open_planner result opens the panel with the
  // tool's own focus. The first pass only records what a restored
  // session already carried, so a reload never re-throws the panel up;
  // the transcript's planner cards reopen it on purpose instead.
  const queuedParentMessages = queued
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.lane !== "directive");
  // The composer becomes the card (founder note, 2026-07-21 walk).
  //
  // A card floating in the transcript with a message box under it asks
  // her to work out which one is the question. There is only ever one
  // place to answer, so the box turns into the card and turns back when
  // the card is done. It also means the card is always where her thumb
  // already is, which on a phone is the whole ballgame.
  //
  // Only cards that ASK dock here. The report reveal is something to
  // read, not something to answer, so it stays in the transcript where
  // she can scroll back to it.
  // Progressive chrome (founder note, 2026-07-21 walk). A brand new
  // conversation opens as close to bare as it can: Homa's words, and
  // nothing else. Every affordance appears at the moment it first means
  // something, rather than sitting there from the start looking like a
  // form she has to fill in.
  //
  // The day separator is the first to go. It separates two days, and on
  // the opening screen there is no day before it to separate from, so it
  // is a rule with nothing on the other side of it.
  const suppressLeadingSeparator =
    Boolean(onboarding) && renderSources.archived.length === 0;
  // Everything before the first real message is a rule with nothing on
  // the other side of it. Computed once rather than tracked with a flag
  // during the map, which the React Compiler rejects and which breaks
  // silently the moment the list is rendered twice.
  const firstMessageIndex = transcript.findIndex((item) => item.kind === "message");
  // The one facts card still taking answers.
  //
  // NOT gated on busy, unlike the snap and question cards. Those go
  // inert during a turn because their answers travel through the model,
  // so taking one mid-turn would race it. This card posts to its own
  // route and saves itself, so there is nothing to race: she can keep
  // filling it in while Homa works, which is what she will try to do.
  const activeDetail = latestDetailRequest(renderMessages);
  const dockedDetail = activeDetail;
  // The chained card run (loop iteration 4). The persona walk measured
  // the 12-16 second model turn between the basics card and the
  // homeschool card as pure dead air: a still screen after six taps,
  // bought back with one sentence. So during onboarding the app chains
  // the homeschool card itself the moment basics saves, no model turn in
  // between, and Homa hears ONE combined answer when both have settled.
  // She reacts once and turns to the kids, which is the same words she
  // was spending two turns to say.
  //
  // Small accepted window: if she reloads after basics saved but before
  // the chained card settles, the model's family_basics card is still
  // the latest ask and docks again; every field coalesces server-side,
  // so refilling costs taps, never data.
  const dockedChained = chainedHomeschool && onboarding;
  // The checklist invite docks for the same reason the facts card does,
  // and the founder hit the un-docked version live: the invite in the
  // transcript, an open composer under it, and a suggestion chip between
  // them, three different answers to "what do I do now" on one screen.
  // Docking is also what retires the other two: the composer and its
  // rail hide while any card is docked, so the card is the whole ask.
  // activeChecklist is already null while a turn runs, so during
  // streaming the composer stays and nothing flickers.
  // latestChecklist, not activeChecklist: it docks the moment it exists,
  // including mid-turn. The button below stays disabled until the line
  // is free, which is the honest split between "here is the ask" and
  // "you may answer it now".
  const dockedChecklist =
    dockedDetail === null &&
    !dockedChained &&
    !appBasics &&
    kidChainStage === null
      ? latestChecklist
      : null;
  /**
   * True when the thing in the dock is one of onboarding's own cards, and
   * therefore a bottom sheet on a phone rather than a floating card.
   *
   * Deliberately not "onboarding is active": the checklist invite shares
   * this slot and is not a sheet, so a footer that dropped its padding
   * for it would leave it touching the screen edges.
   */
  const sheetDock =
    onboarding !== null &&
    (appBasics ||
      Boolean(dockedChained) ||
      kidChainStage !== null ||
      dockedDetail !== null);
  /** Which card is in the dock, whoever put it there. */
  const dockedCardKind: DetailCardKind | null = appBasics
    ? "family_basics"
    : dockedChained
      ? "homeschool_profile"
      : kidChainStage === "card"
        ? "child"
        : (dockedDetail?.card.kind ?? null);
  /**
   * The composer keeps the card company only when the card cannot say
   * everything she might need to (cardWantsComposer).
   *
   * Read from the card KIND rather than the field on screen, so it does
   * not appear and disappear as she steps through a card's questions.
   */
  /**
   * The composer sits beside a card only on a question the card cannot
   * enumerate, which is a fact about the STEP she is on rather than the
   * card she is in.
   *
   * Keyed on the card kind, this put a text box under "What is your
   * child's first name?" the moment the child card grew an interests
   * step, so one question had two places to type it and two buttons to
   * send it (founder walk, 2026-07-28). The card reports each step up as
   * she moves, and the slot follows.
   */
  const composerBesideCard =
    onboarding !== null && kidChainStage !== "choice" && cardStepOpenEnded;
  /**
   * The composer appears when there is something to reply to.
   *
   * Onboarding's cards no longer take the slot to themselves (founder
   * call, 2026-07-28, against a reference where a card and a composer
   * stack): the card asks, and the composer under it stays open for a
   * parent who would rather just say it. That reverses the 2026-07-22
   * docking ruling on purpose, and the thing that ruling killed is still
   * dead. What it hit was THREE answers to "what do I do now" on one
   * screen, the ask, an open composer and a suggestion chip. This is two,
   * ordered, and the second one says in its own placeholder that it is
   * the alternative rather than the point.
   *
   * The checklist invite keeps the old rule. It is a door into a
   * full-screen takeover rather than a question with an answer, so a
   * composer beside it is offering to reply to something nobody asked.
   *
   * Outside onboarding nothing changes at all.
   */
  const showComposer =
    dockedChecklist === null &&
    // While the questions are open the slot is theirs.
    checklistTakeover === null &&
    (composerBesideCard ||
      (dockedDetail === null &&
        !dockedChained &&
        !appBasics &&
        kidChainStage === null &&
        (!onboarding || hasVisibleMessages)));
  const planEditsSeen = planEditCount(renderMessages);
  useEffect(() => {
    const latest = latestPlannerOpen(agent.data.messages);
    if (handledPlannerPartKeyRef.current === undefined) {
      handledPlannerPartKeyRef.current = latest?.partKey ?? null;
      return;
    }
    if (!latest || latest.partKey === handledPlannerPartKeyRef.current) return;
    handledPlannerPartKeyRef.current = latest.partKey;
    setPlannerCanvas(latest.signal);
  }, [agent.data.messages]);

  // The opening machine message (plans/2026-07-21-chat-first-onboarding.md
  // §2.4.4). Idempotence has four locks, because a doubled kickoff means
  // Homa says hello twice and reads as forgetting she already had.
  //   1. A ref, for a re-render inside this mount.
  //   2. A live session that already carries messages, for a remount
  //      over a conversation in progress.
  //   3. Server history for this family, for a remount on a new device
  //      or after the 4am rotation, where nothing local survives.
  //   4. A localStorage flag keyed by family, because the first three
  //      all die with the component and a remount is not exotic: strict
  //      mode does it every mount in development, and it double-fired
  //      here on the first real walk.
  // A visit whose gap is short enough to be a pause sends nothing at
  // all: she gets her screen back, not a greeting.
  useEffect(() => {
    if (!onboarding || kickoffSentRef.current) return;
    if (agent.data.messages.length > 0) return;
    if (archived.length > 0 && onboarding.firstVisit) return;
    if (
      kickoffAlreadySent(onboarding.familyId) &&
      !kickoffLockIsStale({
        liveMessageCount: agent.data.messages.length,
        archivedCount: archived.length,
      })
    ) {
      kickoffSentRef.current = true;
      return;
    }
    // A lock over an empty conversation is a kickoff that never landed.
    // Drop it rather than leave a new parent on a blank screen forever.
    clearKickoffSent(onboarding.familyId);
    const directive = kickoffDirectiveFor(onboarding, browserTimeZone());
    if (directive === null) {
      kickoffSentRef.current = true;
      return;
    }
    kickoffSentRef.current = true;
    markKickoffSent(onboarding.familyId);
    sendMessageRef.current?.(directive, { kind: "directive" });
    // Sending exactly once per mount, gated on its own ref: re-running
    // when messages arrive is the doubled-hello bug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding]);

  function updateProgressActionLifecycle(
    next: ProgressActionLifecycleState,
  ): void {
    progressActionLifecycleRef.current = next;
    setProgressActionLifecycle(next);
  }

  function beginCurrentProgressInteraction(
    partKey: string,
  ): ProgressMessageInteraction | null {
    const interaction = latestProgressMessageInteraction({
      messages: agent.data.messages,
      sessionKey: progressSessionKey,
      unavailableActionKeys: progressActionUnavailableKeys(
        progressActionLifecycleRef.current,
      ),
    });
    if (!interaction || interaction.partKey !== partKey) return null;
    const started = beginProgressAction(
      progressActionLifecycleRef.current,
      interaction.actionKey,
    );
    if (!started.accepted) return null;
    updateProgressActionLifecycle(started.state);
    return interaction;
  }

  function sendProgressCardAction(
    partKey: string,
    text: string,
  ): void {
    const interaction = beginCurrentProgressInteraction(partKey);
    if (!interaction) return;
    const result = sendMessage(text, {
      kind: "progress_card",
      progressActionKey: interaction.actionKey,
    });
    if (result !== "rejected") {
      // The answered card reads past tense from here on ("You said:
      // Easily"), reader-gate fix: a spent button must never look live.
      setProgressAnswers((current) => ({ ...current, [partKey]: text }));
    }
    updateProgressActionLifecycle(
      settleProgressAction(
        progressActionLifecycleRef.current,
        interaction.actionKey,
        result,
      ),
    );
  }

  function focusComposerFromProgressCard(partKey: string): void {
    const interaction = beginCurrentProgressInteraction(partKey);
    if (!interaction) return;
    focusComposer();
    updateProgressActionLifecycle(
      settleProgressAction(
        progressActionLifecycleRef.current,
        interaction.actionKey,
        "sent",
      ),
    );
  }

  /**
   * A finished choice card sends its answers as ONE ordinary message.
   * The card then reads past tense, so a spent option never looks
   * pressable (the same reader gate the progress cards answer to).
   */
  function sendQuestionCardAnswers(partKey: string, text: string): void {
    if (text.trim().length === 0) {
      // Everything skipped: nothing to say, so say nothing and give her
      // the composer instead of sending an empty turn.
      focusComposer();
      return;
    }
    if (sendMessage(text, { kind: "question_card" }) === "rejected") return;
    setQuestionAnswers((current) => ({ ...current, [partKey]: text }));
  }

  function releaseQueuedProgressAction(
    progressActionKey: string | null,
  ): void {
    if (progressActionKey === null) return;
    updateProgressActionLifecycle(
      releaseProgressAction(
        progressActionLifecycleRef.current,
        progressActionKey,
      ),
    );
  }

  /**
   * A child card just saved: keep the summary and ask for the next one.
   *
   * The name is lifted off the front of the summary ("Story, born
   * October 4, 2020") purely so the question can say it back. Nothing
   * downstream reads it, and the child itself was already written by the
   * card's own authenticated POST, so a bad split costs a nicety and
   * never a record.
   */
  function enterKidChain(summary: string): void {
    kidSummariesRef.current = [...kidSummariesRef.current, summary];
    lastKidNameRef.current = summary.split(",")[0]?.trim() || "That one";
    setKidChainStage("choice");
  }

  function sendMessage(
    text: string,
    source: ChatSendSource = { kind: "composer" },
  ): ChatSendAcceptance {
    // She answered in prose instead of filling the card in, so the card
    // steps aside. Leaving it up would sit a form asking her name over a
    // reply where she just gave it, which is the ambiguity the composer
    // was kept out of this slot to avoid in the first place.
    //
    // Only her own typing retires it: a card_answer send IS the card, and
    // a directive is the app talking to itself. Nothing is lost either
    // way, because Homa can put the card back up with ask_for_details,
    // and any basics she already saved are durable server-side and reach
    // the next turn through family context rather than through this card.
    if (source.kind === "composer" && onboarding) {
      setAppBasics(false);
      setChainedHomeschool(false);
      chainedBasicsSummaryRef.current = null;
      setKidChainStage(null);
      kidSummariesRef.current = [];
    }
    const plan = prepareChatSend({
      text,
      // Occupied by an active stream OR by lost-turn recovery still
      // deciding whether the previous, interrupted turn already
      // finished (chat-send-policy.ts's isSendLineOccupied; GH #170).
      // Either way a send here must queue, never start a second eve
      // session racing the one that might still be finishing.
      busy: isSendLineOccupied({ busy, recovering }),
      draftFromVoice: draftFromVoiceRef.current,
      source,
    });
    if (!plan) return "rejected";
    // The chat door's tap beacon, once per visit, wall on or off (the
    // paywall decision wants baseline tap-through data).
    if (!chatDoorTappedRef.current) {
      chatDoorTappedRef.current = true;
      sendWallBeacon({ kind: "door_tap", door: "chat" });
    }
    // Walled: the offer opens and her words stay in the composer. The
    // eve turn never starts, so nothing is half-sent behind the wall.
    if (wall) {
      setWallOpen(true);
      return "rejected";
    }
    clearPromptSuggestionState();
    if (plan.clearDraft) dictation.clearCutoffNotice();
    if (plan.resetDraftFromVoice) draftFromVoiceRef.current = false;
    if (plan.clearDraft) setDraft("");
    // Sending mid-turn queues instead of refusing (texting model,
    // founder ruling 2026-07-10 night): the bubble waits by the
    // composer and goes out the moment the line is free.
    if (plan.destination === "queue") {
      setQueued((current) =>
        appendPreparedChatSendToQueue(current, plan),
      );
      return "queued";
    }
    // Reaching here means the line reads as free (not busy, not
    // recovering), so any recovery handle left over is already spent or
    // is the vanishingly small same-tick race between an error landing
    // and its `recovering` state committing; abort is a defensive no-op
    // in the ordinary case, not the mechanism that keeps sends from
    // forking a session anymore (see isSendLineOccupied above).
    recoveryRef.current?.abort();
    // A fresh session (first turn, or the reset after a failed one)
    // restarts the durable event cursor.
    if (!agent.session?.sessionId) durableCursorRef.current = 0;
    // A queue held back by a failed turn rides along with the next
    // manual send, in the order she wrote everything. A directive in
    // that queue still goes alone: it is the app's sentence, and gluing
    // it to hers is the exact failure the lane exists to prevent.
    const flush = flushChatQueue(queued, {
      text: plan.message,
      lane: plan.lane,
      modality: plan.modality,
      progressActionKey: plan.progressActionKey,
    });
    const outgoing = flush.outgoing;
    if (outgoing === null) return "rejected";
    setQueued(flush.remaining);
    setBusySeconds(0);
    autoStoppedRef.current = false;
    turnModalityRef.current = flush.modality;
    lastSendRef.current = { text: outgoing, atMs: currentTimeMs() };
    turnStartedAtRef.current = currentTimeMs();
    markTurnStarted();
    void agent.send({
      message: outgoing,
      headers: messageModalityHeaders(turnModalityRef.current),
    });
    return "sent";
  }

  function sendPromptSuggestion(index: number, suggestion: string): void {
    const suggestionSet = promptSuggestionSet;
    if (suggestionSet?.suggestions[index] !== suggestion) return;
    const result = sendMessage(suggestion);
    if (result === "rejected") return;
    suggestionSetIdForTurnRef.current = suggestionSet.setId;
    void emitPromptSuggestionTapped(suggestionSet, index);
  }

  /**
   * The retry affordance on a "Not sent" bubble (GH #170, part 2: a
   * dropped connection used to erase her words with nothing on screen
   * to say so). A tap on a card, not typing (chat-send-policy.ts): it
   * leaves whatever she is mid-typing in the composer untouched and
   * resends the failed bubble's exact words. sendMessage's own
   * isSendLineOccupied gate already keeps this from forking a session if
   * a recovery for the earlier failure happens to still be running
   * (part 1 of the same fix), and queues it instead, same as anything
   * else typed in that window.
   */
  function retryFailedMessage(text: string): void {
    sendMessage(text, { kind: "card_answer" });
  }

  /**
   * The attach send path: trades the staged blob URLs for model parts,
   * marker text, and binder receipts (/api/chat/attachments), then
   * sends ONE turn carrying text + media parts. Runs only while idle
   * (the send button holds staged files back during a running turn, so
   * the queue stays text-only).
   */
  async function sendMessageWithAttachments(text: string): Promise<void> {
    // Attachments hold for the idle line already (no queueing for
    // files); recovering counts as occupied for the same session-fork
    // reason sendMessage's plan does (GH #170).
    if (isSendLineOccupied({ busy, recovering }) || preparingAttachments) {
      return;
    }
    if (!chatDoorTappedRef.current) {
      chatDoorTappedRef.current = true;
      sendWallBeacon({ kind: "door_tap", door: "chat" });
    }
    if (wall) {
      setWallOpen(true);
      return;
    }
    setPreparingAttachments(true);
    setAttachError(null);
    try {
      const prepared = await prepareAttachmentsForSend(
        attachments.staged,
        focusChildId,
      );
      const trimmed = text.trim();
      const turnText = [
        ...(trimmed.length > 0 ? [trimmed] : []),
        ...prepared.textBlocks,
      ].join("\n\n");
      const parts: UserContent = [
        { type: "text", text: turnText },
        ...prepared.parts,
      ];
      const summary = summarizeOutgoingParts(parts);
      if (prepared.receipts.length > 0) {
        setReceiptsBySummary((current) => ({
          ...current,
          [summary]: prepared.receipts,
        }));
      }
      clearPromptSuggestionState();
      dictation.clearCutoffNotice();
      setDraft("");
      draftFromVoiceRef.current = false;
      attachments.clear();
      recoveryRef.current?.abort();
      if (!agent.session?.sessionId) durableCursorRef.current = 0;
      setBusySeconds(0);
      autoStoppedRef.current = false;
      turnModalityRef.current = "text";
      lastSendRef.current = { text: summary, atMs: currentTimeMs() };
      turnStartedAtRef.current = currentTimeMs();
      markTurnStarted();
      void agent.send({
        message: parts,
        headers: messageModalityHeaders("text"),
      });
    } catch {
      // Files stay staged; her words stay in the composer. One quiet
      // line under the composer says to try again.
      setAttachError(
        "That didn't attach. Everything is still here, try once more.",
      );
    } finally {
      setPreparingAttachments(false);
    }
  }

  function removeQueuedMessage(
    index: number,
    entry: QueuedChatMessage,
  ): void {
    releaseQueuedProgressAction(entry.progressActionKey);
    setQueued((current) =>
      current.filter((_, at) => at !== index),
    );
  }

  return (
    // 3.5rem is /app's phone top bar (h-14); on desktop the sidebar sits
    // beside this column, so the full viewport height is ours. The planner
    // canvas, when open, shares this row on desktop (the chat column
    // narrows) and overlays the phone.
    //
    // Onboarding has no top bar to subtract: ChatStep mounts this inside
    // its own fixed inset-0, so reserving the 56px left a strip of bare
    // page under the dock, which a floating card hid and a flush bottom
    // sheet cannot.
    <div className={onboarding ? "flex h-dvh" : "flex h-[calc(100dvh-3.5rem)] lg:h-dvh"}>
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      {/* The morning scrolls into everything above it: a soft fade at
          the top edge whenever there is more past to scroll to. This
          lives outside the scrollable <main> as a plain absolute
          overlay pinned to the column, not a sticky child of the
          scroll container: sticky plus a counteracting negative
          margin (the previous approach) only lines up with the true
          scroll edge when both move in lockstep, and WebKit drifted
          the two apart, leaving the fade low with a hard cutoff edge
          instead of flush at the top. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-[54px] bg-gradient-to-b from-page to-transparent transition-opacity duration-(--dur-base) ${topFaded ? "opacity-100" : "opacity-0"}`}
      />
      {/* 780px is the kit's transcript measure (ChatView.jsx). Turns get
          gap-6 so the flat replies and bubbles keep a clear rhythm. */}
      <main
        ref={transcriptRef}
        onScroll={handleTranscriptScroll}
        // More air above the first line than below the last (founder
        // note, 2026-07-22). The opening screen has no day separator and
        // nothing else above it, so at pt-6 Homa's hello started almost
        // against the top edge, which reads as cramped on the one screen
        // that should feel calm.
        // justify-center during the opening: the sheet anchors the bottom
        // of the screen by itself, so the welcome takes the middle of what
        // is left rather than crowding down onto it. This column is
        // flex-1, so "what is left" is exactly the space above the dock.
        className={`mx-auto flex w-full max-w-[780px] flex-1 flex-col gap-6 overflow-y-auto px-4 pt-10 sm:px-6 ${
          openingMoment ? "ob-open-column justify-center pb-4" : "pb-6"
        }`}
      >
        {!hasAnyMessages && !onboarding ? (
          <div className="my-auto text-center">
            <h1 className="font-display text-2xl font-semibold text-strong">
              {parentName ? `Hi ${parentName}, I'm Homa.` : "Hi, I'm Homa."}
            </h1>
            <p className="mt-2 text-lg text-muted">
              Ask me anything about your homeschool day.
            </p>
          </div>
        ) : (
          <>
            {onboarding ? (
              // The pre-warmed welcome (§6.1: first bubble in <400ms).
              // Rendered by the app the moment the page exists, so
              // arrival is never a blank screen while the first model
              // turn travels; a live walk measured 11 to 17 seconds of
              // thinking dot before the model's own hello, and the model
              // no longer writes one (onboarding-mode tells it this text
              // is already on screen). Deterministic, not a message row:
              // it costs nothing, needs no lock, and cannot double.
              // The entrance rides the first arrival only. On a return
              // visit this same welcome sits above real scrollback, where
              // animating it would re-announce a hello she already had.
              // The entrance rides the first arrival only. On a return
              // visit this same welcome sits above real scrollback, where
              // animating it would re-announce a hello she already had.
              <div
                className={`flex w-full items-start gap-2.5 ${
                  openingMoment ? "ob-open-line" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 inline-flex shrink-0 opacity-70 ${
                    openingMoment ? "ob-open-mark" : ""
                  }`}
                >
                  <Logo size={20} variant="mark" />
                </span>
                <p className="min-w-0 flex-1 leading-relaxed text-body">
                  {ONBOARDING_WELCOME}
                </p>
              </div>
            ) : null}
            {transcript.map((item, itemIndex) => {
              // One row for one turn (founder note, 2026-07-22: the mark
              // "starts at one spot, then moves down a little bit and
              // then moves back up when it answers").
              //
              // Measured: the mark sat at 305, jumped to 329, came back
              // to 305. The 24 is exactly the transcript's gap-6, which
              // is the giveaway. Mid-turn the assistant message mounts
              // carrying only a tool call, so it renders its bare
              // "Worked on it" eyebrow ABOVE the busy row, and for a
              // beat two rows both say Homa is working. Then text
              // streams, busyLabel goes null, the busy row leaves, and
              // everything springs back.
              //
              // While the busy row is up it IS her presence, so a
              // message with nothing to show yet renders nothing. It
              // comes back the moment it has words, or when the turn
              // ends and the eyebrow becomes an honest receipt.
              if (
                renderBusy &&
                item.kind === "message" &&
                itemIndex === transcript.length - 1 &&
                item.message.role === "assistant" &&
                !messageSaysSomething(item.message)
              ) {
                return null;
              }
              // Dim rule: everything above the live snap card steps
              // back; the card's own message stays full strength.
              const dimmed =
                activeSnap !== null &&
                (item.kind === "separator" ||
                  item.message !== activeSnap.message);
              if (item.kind === "separator") {
                if (suppressLeadingSeparator && itemIndex < firstMessageIndex) {
                  return null;
                }
                return (
                  <div
                    key={item.key}
                    className={dimmed ? "opacity-45 transition-opacity" : undefined}
                  >
                    <DaySeparator label={item.label} />
                  </div>
                );
              }
              const isLiveMessage = liveMessageSet.has(item.message);
              const actionableInteraction =
                isLiveMessage &&
                item.message.id === progressInteraction?.messageId
                  ? progressInteraction
                  : null;
              const userSummary =
                item.message.role === "user"
                  ? item.message.parts
                      .map((part) => (part.type === "text" ? part.text : ""))
                      .join("")
                      .trim()
                  : null;
              const messageView = (
                <MessageView
                  message={item.message}
                  timeZone={timeZone}
                  familyId={familyId}
                  childNameById={childNameById}
                  attachmentReceipts={
                    userSummary !== null && isLiveMessage
                      ? receiptsBySummary[userSummary]
                      : undefined
                  }
                  workedForSeconds={
                    isLiveMessage ? turnSeconds[item.message.id] ?? null : null
                  }
                  onRetryFailedMessage={
                    isLiveMessage ? retryFailedMessage : undefined
                  }
                  progressAnswers={progressAnswersMap}
                  activeSnapPartKey={
                    isLiveMessage ? activeSnap?.partKey : undefined
                  }
                  onSnapAddFiles={attachments.addFiles}
                  onSnapTypeInstead={focusComposer}
                  questionAnswers={questionAnswersMap}
                  activeQuestionPartKey={
                    isLiveMessage ? activeQuestion?.partKey : undefined
                  }
                  onSendQuestionAnswers={
                    activeQuestion
                      ? (text) =>
                          sendQuestionCardAnswers(activeQuestion.partKey, text)
                      : undefined
                  }
                  onQuestionTypeInstead={focusComposer}
                  onOpenPlanner={setPlannerCanvas}
                  activeChecklistPartKey={
                    isLiveMessage ? latestChecklist?.partKey : undefined
                  }
                  onOpenChecklist={
                    activeChecklist === null ? undefined : setChecklistTakeover
                  }
                  activeReportPartKey={
                    isLiveMessage ? activeReport?.partKey : undefined
                  }
                  onOpenReport={openChildReport}
                  activeDetailPartKey={
                    isLiveMessage ? activeDetail?.partKey : undefined
                  }
                  dockedDetailPartKey={
                    isLiveMessage ? dockedDetail?.partKey : undefined
                  }
                  dockedChecklistPartKey={
                    isLiveMessage ? dockedChecklist?.partKey : undefined
                  }
                  onDetailsSaved={handleDetailsSaved}
                  actionableProgressPartKey={
                    actionableInteraction?.partKey
                  }
                  onSendSuggestion={
                    actionableInteraction
                      ? (text) =>
                          sendProgressCardAction(
                            actionableInteraction.partKey,
                            text,
                          )
                      : undefined
                  }
                  onFocusComposer={
                    actionableInteraction
                      ? () =>
                          focusComposerFromProgressCard(
                            actionableInteraction.partKey,
                          )
                      : undefined
                  }
                />
              );
              // The source tag: a quiet chip under a bubble that arrived
              // from another surface (texted, by email, Homa's tasks),
              // shown where the surface changes (transcript-days.ts).
              return (
                <div
                  key={item.key}
                  className={`flex flex-col gap-1.5 ${dimmed ? "opacity-45 transition-opacity" : ""}`}
                >
                  {messageView}
                  {item.sourceLabel ? (
                    <p
                      className={
                        item.message.role === "user"
                          ? "flex justify-end"
                          : "flex"
                      }
                    >
                      <span className="inline-flex items-center rounded-pill border border-border-subtle bg-card px-2.5 py-0.5 text-[11px] font-semibold text-subtle">
                        {item.sourceLabel}
                      </span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </>
        )}
        {renderBusy && busyLabel(renderMessages, busySeconds) ? (
          // The mark is awake while Homa thinks, so the wait is never a
          // blank page (tester ask, evidence memo 1; MJ-06). Goes still
          // under reduced motion; the label still reads what is happening.
          //
          // The clock leads. It is the part that actually moves every
          // second, so it anchors the row and the words become the thing
          // that changes occasionally rather than the thing being stared
          // at. The label shimmers and escalates with the same clock, so
          // twenty five seconds reads as work rather than as a hang.
          //
          // The character escalates on that same clock too, and this is
          // the only place all three meet: seconds, mood and words are
          // one reading of one wait, never three opinions about it.
          <div className="flex items-baseline gap-2.5 text-muted">
            <ThinkingMark
              size={28}
              mood={busyMood(busySeconds)}
              seconds={busySeconds}
              tool={activeToolName(renderMessages)}
              className="self-center"
            />
            {busySeconds > 0 ? (
              <span className="font-mono text-sm tabular-nums text-subtle">
                {busySeconds}s
              </span>
            ) : null}
            <span className="chat-busy-label">
              {busyLabel(renderMessages, busySeconds)}
            </span>
          </div>
        ) : null}
        {queuedParentMessages.length > 0 ? (
          // Messages sent mid-turn wait here as dimmed bubbles (the
          // Cursor queue, in texting clothes) and go out on turn end;
          // the X pulls one back before it sends. "Send now" interrupts:
          // stopping the turn is all it takes, the flush in onFinish
          // delivers the queue the moment the abort settles.
          // A queued directive is not one of her messages, so it shows
          // nothing here and carries its true queue index with it: the
          // X removes what she pointed at, not whatever sits at that
          // position in a shorter list.
          <div className="flex flex-col items-end gap-2">
            {queuedParentMessages.map(({ entry, index }) => (
              <div
                key={`${index}:${entry.text.slice(0, 24)}`}
                className="flex max-w-[76%] items-center gap-2"
              >
                <button
                  type="button"
                  aria-label="Remove from queue"
                  onClick={() => removeQueuedMessage(index, entry)}
                  className="text-subtle transition-colors hover:text-strong"
                >
                  <X size={14} aria-hidden="true" />
                </button>
                <div className="rounded-lg rounded-br-sm bg-brand px-[18px] py-3.5 text-[0.95rem] leading-normal text-on-brand opacity-70">
                  <p className="whitespace-pre-wrap">
                    {entry.text}
                  </p>
                </div>
              </div>
            ))}
            <p className="flex items-center gap-3 text-xs text-subtle">
              Sends when Homa finishes
              {renderBusy ? (
                <button
                  type="button"
                  onClick={() => agent.stop()}
                  className="font-semibold text-brand transition-colors hover:underline"
                >
                  Send now
                </button>
              ) : null}
            </p>
          </div>
        ) : null}
        {recovering ? (
          // The stream died but the turn is durable server-side; while
          // the replay runs, the wait reads as work, not as a failure.
          <div className="flex items-center gap-2.5 text-muted" role="status">
            <ThinkingMark size={28} mood="digging" />
            <span>Reconnecting&hellip;</span>
          </div>
        ) : agent.error && staleOidcAt !== null ? (
          // Localhost only, and only once the dev route has confirmed it.
          // Deliberately not in Homa's voice and deliberately ugly: this
          // is a note to whoever is running the server, and the moment it
          // reads like product copy is the moment it gets mistaken for a
          // parent-facing string. Sits above the two below so a stale
          // credential never masquerades as either.
          <p
            className="mx-auto max-w-md rounded-md border border-border bg-card px-3 py-2 text-center font-mono text-xs text-body"
            role="alert"
          >
            DEV: the Vercel OIDC token expired at{" "}
            {new Date(staleOidcAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            , so every agent turn is failing at the gateway. Not a product
            bug. Run <code>pnpm dev:token</code>.
          </p>
        ) : agent.error && onboarding && !hasVisibleMessages ? (
          // The opening turn died, so she is looking at an empty screen.
          // The ordinary line below is wrong twice here: she never sent a
          // message, and there is no composer to send one with, because
          // the chrome does not arrive until Homa has spoken. Telling a
          // brand new parent to try sending it again names an action she
          // cannot take, on her first ten seconds with the product.
          <div className="flex flex-col items-center gap-3" role="alert">
            <p className="text-center text-sm text-danger">
              Homa did not manage to start. Nothing is lost.
            </p>
            <button
              type="button"
              // A reload, not a second send path: the kickoff already
              // retries itself on load when the conversation is empty,
              // and that path is the tested one.
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-pill border border-border bg-card px-5 py-2 text-sm font-bold text-strong shadow-sm transition-colors hover:border-brand"
            >
              Try again
            </button>
          </div>
        ) : agent.error ? (
          <p className="text-center text-sm text-danger" role="alert">
            Your conversation is safe; that last message didn&apos;t go through. Try
            sending it again.
          </p>
        ) : null}
        {/* The scroll target, and the one empty box in this column that
            has to keep its place: the opening layout collapses empty
            children to kill their phantom gap, and a display:none anchor
            is one scrollIntoView nobody can see. */}
        <div ref={bottomRef} data-scroll-anchor="" />
      </main>

      {showBackToNow ? (
        // Floats over the transcript's bottom edge, centered: the way
        // back to now after reading old days, no words needed.
        <div className="relative">
          <button
            type="button"
            aria-label="Back to now"
            onClick={() =>
              bottomRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="absolute -top-14 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-strong shadow-md transition-colors hover:border-brand hover:text-brand"
          >
            <ArrowDown size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* The redesigned composer (chat-refined, approved 2026-07-13):
          docked suggestion chips, then a soft card holding the pending
          attachment chips, the input, and a toolbar rail (+, camera,
          the About tag, mic, send). Typing stays enabled while Homa
          works, and sending mid-turn queues; staged files hold Send
          until the line is free (the queue stays text-only). */}
      <footer
        // The rule belongs to the composer, which is a low box that needs
        // an edge to sit against. A docked card brings its own border and
        // shadow, so the line above it is a second edge a few pixels from
        // the first, and it cuts the card off from the sentence that
        // asked for it (founder note, 2026-07-22).
        // Onboarding's docked cards are bottom sheets on a phone, so the
        // footer gives up its side and bottom padding at that size and
        // the card reaches the edges itself. Everything from sm up, and
        // everything outside onboarding, keeps the padded dock.
        className={`pt-3 sm:bg-page sm:px-6 sm:pb-5 sm:pt-3 ${
          sheetDock
            ? "ob-dock-sheet px-0 pb-0 sm:rounded-none sm:border-t-0 sm:shadow-none"
            : `bg-page px-4 pb-5 ${showComposer ? "border-t border-border-subtle" : ""}`
        }`}
      >
        {showSuggestions ? (
          // The chips dock quietly by the keyboard (D1 steal, founder
          // pick) instead of floating mid-transcript.
          <div className="mx-auto mb-2.5 flex w-full max-w-[780px] flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendMessage(suggestion)}
                className="rounded-pill bg-[var(--stone-100)] px-3.5 py-1.5 text-[0.8rem] text-muted transition-colors hover:bg-[var(--stone-200)] hover:text-strong"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {checklistTakeover !== null ? (
          // The questions, docked where the composer was, so answering
          // them never leaves the conversation (founder note,
          // 2026-07-22). Ahead of the other two because while she is
          // answering, nothing else may take the slot.
          <div className="mx-auto w-full max-w-[780px]">
            <ChecklistTakeover
              childId={checklistTakeover}
              onClose={(exit) => {
                setChecklistTakeover(null);
                if (!exit) return;
                // The handoff. It carries hints, never facts: the counts
                // are re-derived server-side, and this only tells Homa
                // which child the parent was just answering for and
                // roughly where she got to, so her next line is about
                // the right kid.
                sendMessageRef.current?.(
                  formatHiddenDirective("checklist_complete", {
                    childId: exit.childId,
                    answered: exit.answered,
                    remaining: exit.remaining,
                  }),
                  { kind: "directive" },
                );
              }}
            />
          </div>
        ) : appBasics ? (
          // The app's own basics card, laid out in the same frame as the
          // welcome. No model turn was spent to be handed a constant, so
          // there is no "working on it" between Homa saying hello and Homa
          // asking the first question: she arrives to a finished screen
          // with one thing on it to do.
          //
          // Mounted and focusable from the first frame, fading in on its
          // own 140ms offset. Nothing is gated on the animation, so its
          // height holds the centered group still rather than arriving
          // late and re-centering it under the sentence she is reading.
          <div
            className={`ob-dock-card mx-auto w-full max-w-[780px] ${
              openingMoment ? "ob-open-card" : ""
            }`}
          >
            <DetailCard
              key="app-basics"
              card={{ kind: "family_basics", intro: null }}
              active
              docked
              onStepOpenEnded={setCardStepOpenEnded}
              onSaved={(summary) => {
                // Straight into the chained homeschool card, the same
                // hand-off the model's card made, so her answer still
                // reaches Homa as one combined message once both settle.
                chainedBasicsSummaryRef.current = summary;
                setAppBasics(false);
                setChainedHomeschool(true);
              }}
            />
          </div>
        ) : dockedChained ? (
          // The app-chained homeschool card: docked by the client the
          // moment basics saved, no model turn in between. Keyed so its
          // step state can never inherit the basics card's.
          <div className="ob-dock-card mx-auto w-full max-w-[780px]">
            <DetailCard
              key="chained-homeschool"
              card={{ kind: "homeschool_profile", intro: null }}
              active
              docked
              onStepOpenEnded={setCardStepOpenEnded}
              onSaved={(summary) => {
                const basics = chainedBasicsSummaryRef.current;
                chainedBasicsSummaryRef.current = null;
                setChainedHomeschool(false);
                // A skipped style stays out of her bubble: "Sidney,
                // District of Columbia, Nothing in particular" is a
                // sentence nobody said.
                const combined =
                  summary === NO_STYLES_SUMMARY || basics === null
                    ? basics ?? summary
                    : `${basics} · ${summary}`;
                sendMessage(combined, { kind: "card_answer" });
                // And straight on to her kids, without waiting to be
                // handed the card. Homa's reaction to the setup is a
                // real model turn and a live walk clocked it at 20.7
                // seconds (2026-07-29): twenty seconds of spinner
                // between a parent skipping an optional question and
                // anything asking her for something. Her reaction still
                // arrives, above the card, while Rachel is already
                // filling it in. The wait stops being a wall and
                // becomes something that happens behind her work.
                setKidChainStage("card");
              }}
            />
          </div>
        ) : kidChainStage === "choice" ? (
          <div className="ob-dock-card mx-auto w-full max-w-[780px]">
            <AnotherKidCard
              justAdded={lastKidNameRef.current}
              onAddAnother={() => setKidChainStage("card")}
              onDone={() => {
                // Every child in one message, in the order she added
                // them, so Homa meets the family at once.
                const all = kidSummariesRef.current.join(" · ");
                kidSummariesRef.current = [];
                setKidChainStage(null);
                sendMessage(all, { kind: "card_answer" });
              }}
            />
          </div>
        ) : kidChainStage === "card" ? (
          <div className="ob-dock-card mx-auto w-full max-w-[780px]">
            <DetailCard
              // Keyed by how many are already in, so each new child card
              // mounts fresh instead of inheriting the last one's answers.
              key={`app-child-${kidSummariesRef.current.length}`}
              // The card says who it is about itself. Homa's own handover
              // sentence is a model turn behind it now, so relying on
              // her for the introduction put "Now let's talk about your
              // kids" on screen 22 seconds AFTER the card had already
              // asked for a name (walk, 2026-07-29).
              card={{
                kind: "child",
                intro:
                  kidSummariesRef.current.length === 0
                    ? "Now your kids."
                    : null,
              }}
              active
              docked
              onStepOpenEnded={setCardStepOpenEnded}
              onSaved={(summary) => enterKidChain(summary)}
            />
          </div>
        ) : dockedDetail ? (
          // The morph: same width, same corner radius, same shadow and
          // the same spot on screen the box occupied a second ago, so it
          // reads as one object changing shape rather than two objects
          // swapping.
          //
          // Except during onboarding's introduction, where the composer
          // is below it rather than behind it, so there is nothing to
          // morph from. It slides open there as the second beat instead.
          <div
            className={`ob-dock-card mx-auto w-full max-w-[780px] ${
              openingMoment ? "ob-open-card" : ""
            }`}
          >
            <DetailCard
              card={dockedDetail.card}
              active
              docked
              onStepOpenEnded={setCardStepOpenEnded}
              onSaved={(summary) => {
                // Basics chains straight into the homeschool card during
                // onboarding: her summary parks here and sends as one
                // combined answer when the chained card settles, which
                // deletes the dead-air model turn between the two.
                if (dockedDetail.card.kind === "family_basics" && onboarding) {
                  chainedBasicsSummaryRef.current = summary;
                    setChainedHomeschool(true);
                  return;
                }
                // A child parks too, and the app asks for the next one
                // itself rather than spending a turn on a question whose
                // answer changes nothing about what Homa says.
                if (dockedDetail.card.kind === "child" && onboarding) {
                  enterKidChain(summary);
                  return;
                }
                sendMessage(summary, { kind: "card_answer" });
              }}
            />
          </div>
        ) : dockedChecklist ? (
          <div className="mx-auto w-full max-w-[780px]">
            <ChecklistCard
              card={dockedChecklist.card}
              active
              docked
              // Disabled while Homa is still talking, for the same
              // reason the transcript copy is: the ask is visible, the
              // answer waits for the line to be free.
              onOpen={activeChecklist === null ? undefined : setChecklistTakeover}
            />
          </div>
        ) : null}
        <div
          className={`mx-auto w-full max-w-[780px] rounded-[22px] shadow-md ${
            // Inside the phone sheet this is a zone, not a box: the CSS
            // strips its chrome and gives it a hairline instead. From sm
            // up it is the second of two floating boxes, so it takes a
            // gap to sit in.
            composerBesideCard ? "ob-dock-composer sm:mt-2.5" : ""
          } ${showComposer ? "" : "hidden"}`}
        >
          {voiceOpen ? (
            // Above the composer, not over it: the thread is where the
            // conversation is appearing, turn by turn, so it has to stay
            // visible while she talks. The panel is just the microphone.
            <div className="mb-2">
              <VoiceMode
                onTurn={appendSpokenTurn}
                onClose={() => setVoiceOpen(false)}
              />
            </div>
          ) : null}
          {showPromptSuggestionRail ? (
            <PromptSuggestionRail
              phase={promptSuggestionPhase}
              suggestions={promptSuggestionSet?.suggestions ?? []}
              onSelect={sendPromptSuggestion}
            />
          ) : null}
          <form
            ref={composerFormRef}
            className={`w-full border border-border-subtle bg-card px-3 pb-2 pt-2.5 transition-shadow focus-within:ring-2 focus-within:ring-brand/30 ${
              showPromptSuggestionRail
                ? "-mt-px rounded-b-[22px] rounded-t-none"
                : "rounded-[22px]"
            }`}
            onSubmit={(event) => {
              event.preventDefault();
              if (attachments.readyCount > 0) {
                // Enter can submit past a disabled button; the same guard
                // the button uses holds here.
                if (busy || attachments.anyUploading || preparingAttachments) return;
                void sendMessageWithAttachments(draft);
              } else {
                sendMessage(draft);
              }
            }}
          >
          <PendingAttachmentChips
            staged={attachments.staged}
            onRemove={attachments.remove}
          />
          {dictation.phase !== "idle" ? (
            // Talking replaces typing for the moment: the listening row
            // takes the input's place, X drops the take, the check turns
            // it into editable words. Nothing sends until she sends.
            <div className="flex min-h-10 items-center px-1">
              <DictationRow
                phase={dictation.phase}
                seconds={dictation.seconds}
                onCancel={dictation.cancel}
                onAccept={dictation.accept}
              />
            </div>
          ) : (
            <div className="px-1">
              <SlashComposer
                kids={kids ?? []}
                skills={slashSkills ?? []}
                draft={draft}
                onDraftChange={setDraft}
                placeholder={
                  attachments.staged.length > 0
                    ? "Add a caption…"
                    : composerBesideCard
                      ? // Under a card it is the alternative, not the
                        // point, and its own words are what say so. The
                        // ruling this arrangement reversed was about
                        // ambiguity, and an equally confident second box
                        // is exactly how that comes back.
                        "Or just tell me…"
                      : "Tell Homa about your day…"
                }
              />
            </div>
          )}
          {filingHintOpen && focusChildName ? (
            <p className="mb-1.5 ml-[52px] w-fit rounded-md bg-[var(--stone-900)] px-2.5 py-1.5 text-xs font-medium text-[var(--stone-50)]">
              Photos and files you send are saved in {focusChildName}&apos;s
              binder. Change kids at the top right.
            </p>
          ) : null}
          <div className="relative mt-0.5 flex items-center gap-0.5">
            <AttachMenuButton
              onFiles={attachments.addFiles}
              disabled={!familyId}
            />
            <CameraButton onFiles={attachments.addFiles} disabled={!familyId} />
            {focusChildName ? (
              // The filing tag (reader-gate fix: it must explain
              // itself): tap toggles the plain-words hint above.
              <button
                type="button"
                aria-label={`Attachments save to ${focusChildName}'s binder; tap for details`}
                onClick={() => setFilingHintOpen((current) => !current)}
                className="ml-1 inline-flex min-h-8 items-center gap-1 rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-semibold text-[var(--clay-700)]"
              >
                About {focusChildName}
                <ChevronDown size={12} aria-hidden="true" />
              </button>
            ) : null}
            <span className="flex-1" />
            {dictation.phase === "idle" && dictation.supported ? (
              <MicButton onStart={dictation.start} />
            ) : null}
            {/* The Claude-composer shape (founder ruling 2026-07-10
                night): while Homa works, an empty composer shows Stop;
                a typed one shows Stop AND Send, where Send queues the
                message for the moment the turn ends. Idle shows Send. */}
            {renderBusy ? (
              <>
                <button
                  type="button"
                  aria-label="Stop"
                  onClick={() => agent.stop()}
                  className={
                    draft.trim().length > 0
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-strong shadow-sm transition-colors hover:border-brand"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
                  }
                >
                  <Square size={14} fill="currentColor" aria-hidden="true" />
                </button>
                {draft.trim().length > 0 && attachments.staged.length === 0 ? (
                  <button
                    type="submit"
                    aria-label="Send"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
                  >
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                ) : null}
              </>
            ) : composerPrimaryAction({
                draft,
                readyAttachments: attachments.readyCount,
              }) === "voice" ? (
              // Empty composer: the primary action is starting a voice
              // conversation, not a Send with nothing to send (founder
              // direction 2026-07-29). It swaps back to Send on the first
              // character, so the two never compete for the same tap.
              <VoiceModeButton onStart={() => setVoiceOpen(true)} />
            ) : (
              <button
                type="submit"
                aria-label="Send"
                disabled={
                  attachments.readyCount > 0
                    ? attachments.anyUploading || preparingAttachments
                    : draft.trim().length === 0 || attachments.anyUploading
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                <ArrowUp size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          </form>
        </div>
        {attachError ? (
          <p className="mx-auto mt-2 w-full max-w-[780px] text-sm text-danger" role="alert">
            {attachError}
          </p>
        ) : null}
        {renderBusy && attachments.staged.length > 0 ? (
          <p className="mx-auto mt-2 w-full max-w-[780px] text-sm text-subtle" role="status">
            Your files go out when Homa finishes this reply.
          </p>
        ) : null}
        {dictation.phase === "recording" ? (
          // The contract, visible while she talks (reader gate
          // 2026-07-10: "does the check send my raw words?"): the check
          // ends the take, and sending stays hers.
          <p className="mx-auto mt-2 w-full max-w-[780px] text-sm text-subtle" role="status">
            {RECORDING_HINT_MESSAGE}
          </p>
        ) : dictation.autoStopped && dictation.phase === "idle" ? (
          // The cap ended her take (gh#351). It used to end it silently,
          // and a one-line composer hides a mid-word cut, so a parent
          // lost a long dictated list without ever being told why.
          <p className="mx-auto mt-2 w-full max-w-[780px] text-sm text-muted" role="status">
            {DICTATION_CUTOFF_MESSAGE}
          </p>
        ) : dictation.error ? (
          // Fail-soft (M1-05's law): a blocked mic or an unclear take
          // becomes a quiet hint, and typing is always right there.
          <p className="mx-auto mt-2 w-full max-w-[780px] text-sm text-muted" role="status">
            {dictation.error}
          </p>
        ) : null}
      </footer>
      {wall ? (
        <WallModal
          door="chat"
          checkout={wall}
          open={wallOpen}
          onClose={() => setWallOpen(false)}
        />
      ) : null}
    </div>
    {plannerCanvas ? (
      <PlannerCanvasPanel
        childId={plannerCanvas.childId}
        refreshSignal={planEditsSeen}
        onClose={() => setPlannerCanvas(null)}
        variant={onboarding ? "onboarding" : "app"}
      />
    ) : null}
    </div>
  );
}

/** The Slack-style date rule: a quiet centered label between days, so
 *  the past reads as the past without a card or a banner. */
function DaySeparator({ label }: { label: string }) {
  return (
    <div role="separator" aria-label={label} className="flex items-center gap-3">
      <span aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
      <span aria-hidden="true" className="text-xs font-semibold text-subtle">
        {label}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}
