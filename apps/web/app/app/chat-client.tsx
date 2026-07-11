"use client";

import { emitEvent } from "@homa/core";
import { useEveAgent, type EveMessage } from "eve/react";
import { ArrowUp, Sparkles, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import { sendWallBeacon } from "../../components/billing/wall-beacon";
import { WallModal } from "../../components/billing/wall-modal";
import type { WallCheckout } from "../../lib/billing/wall-types";
import type { SlashSkillItem } from "../../lib/slash-skills";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import {
  archiveMessages,
  foldEventsToMessages,
  prepareChat,
  pruneMessageTimes,
  saveChat,
  stampMessageTimes,
  type ArchivedMessage,
} from "./chat-storage";
import {
  DictationRow,
  MicButton,
  RECORDING_HINT_MESSAGE,
  useDictation,
} from "./dictation";
import { busyLabel, countLastTurnToolCalls, MessageView } from "./message-parts";
import { SlashComposer } from "./slash-composer";
import { buildTranscript } from "./transcript-days";
import { markTurnStarted, takeTurnLatencyMs } from "./turn-clock";
import { recoverLostTurn } from "./turn-recovery";

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
 */

// agent.ts pins the gateway model: the mid tier in journeys/06 terms.
const MODEL_TIER = "mid" as const;

const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

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
  initialDraft,
  kids,
  slashSkills,
  wall = null,
}: {
  storageKey: string;
  familyId: string | null;
  timeZone: string | null;
  parentName: string | null;
  /** The wall (plans/2026-07-11-the-wall.md): checkout URLs when this
   * family is walled, null when the composer is open (the default, and
   * always the case while HOMA_WALL_ENABLED is off). */
  wall?: WallCheckout | null;
  /** The kid selected in the context switcher, or null for the whole
   * family. Display only: the agent learns the focus server-side from
   * the same cookie, this just keeps the composer honest about it. */
  focusChildName?: string | null;
  /** Pre-fills the composer (the journal email's deep link); the parent
   * still edits and sends herself, nothing auto-sends. */
  initialDraft?: string;
  /** The composer's "/" menu: kids to mention + the advertised skills. */
  kids?: { id: string; name: string }[];
  slashSkills?: SlashSkillItem[];
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  // Load + rotation decision, once per mount (fresh morning = fresh
  // session; the old session's messages fold into the archive).
  const [prepared] = useState(() => prepareChat(storageKey, timeZone));
  const [archived, setArchived] = useState<ArchivedMessage[]>(prepared.archived);
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
  const [queued, setQueued] = useState<string[]>([]);
  /** The store's send, held by ref so onFinish can deliver the queue
   *  without capturing `agent` inside its own initializer (the React
   *  Compiler rejects that self-capture on mobile; twins stay alike). */
  const sendRef = useRef<((input: { message: string }) => Promise<void>) | null>(
    null,
  );
  // Whether dictation fed the current draft, and the modality of the
  // turn in flight (read later by onFinish / the error effect). Refs,
  // not state: nothing renders from them.
  const draftFromVoiceRef = useRef(false);
  const turnModalityRef = useRef<"text" | "voice">("text");
  // Lost-turn recovery bookkeeping (turn-recovery.ts): the durable
  // stream cursor (session streamIndex at mount + one per received
  // event, surviving localStorage event trimming), what the last send
  // carried, and the in-flight recovery's abort handle.
  const durableCursorRef = useRef(prepared.initialSession?.streamIndex ?? 0);
  const lastSendRef = useRef<{ text: string; atMs: number } | null>(null);
  const recoveryRef = useRef<AbortController | null>(null);
  const [recovering, setRecovering] = useState(false);

  const emitTurnCompleted = useCallback(
    async (
      status: "ok" | "error",
      errorClass?: "turn_failed" | "send_failed" | "unknown",
    ) => {
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
        },
      );
    },
    [familyId, supabase],
  );

  const agent = useEveAgent({
    auth: {
      bearer: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      },
    },
    maxReconnectAttempts: STREAM_RECONNECT_ATTEMPTS,
    initialEvents: prepared.initialEvents,
    initialSession: prepared.initialSession,
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
      if (!snapshot.error) void emitTurnCompleted("ok");
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
      if (!snapshot.error && queued.length > 0) {
        const message = queued.join("\n\n");
        setQueued([]);
        // Next tick: this callback runs inside the previous send's
        // teardown, and eve rejects overlapping sends.
        setTimeout(() => {
          setBusySeconds(0);
          lastSendRef.current = { text: message, atMs: currentTimeMs() };
          markTurnStarted();
          void sendRef.current?.({ message });
        }, 0);
      }
    },
  });
  const agentError = agent.error;
  const agentReset = agent.reset;
  const agentSend = agent.send;
  const agentStop = agent.stop;

  useEffect(() => {
    sendRef.current = agentSend;
  }, [agentSend]);

  const [draft, setDraft] = useState(initialDraft ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstScrollDoneRef = useRef(false);
  const busy = agent.status === "submitted" || agent.status === "streaming";
  // The wall (plans/2026-07-11-the-wall.md): the chat door. One
  // door-tap beacon per visit (the ref), and a walled family's send
  // opens the offer instead of the turn, draft intact.
  const [wallOpen, setWallOpen] = useState(false);
  const chatDoorTappedRef = useRef(false);

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
    if (!agentError || agentError === reportedErrorRef.current) return;
    reportedErrorRef.current = agentError;
    void emitTurnCompleted("error", "turn_failed");

    // Lost-turn recovery (incident 2026-07-11 follow-up): the durable
    // run usually outlives a dead stream, so before leaving her with
    // the error banner, replay the session server-side and fold the
    // finished conversation, reply included, back into the transcript.
    const lastSend = lastSendRef.current;
    if (!lastSend || recoveryRef.current) return;
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
        setRecovering(false);
        return;
      }
      if (recovered) {
        // The fresh-start move done for her: the whole recovered session
        // folds into the archive (reply included), the store starts
        // clean, and the error clears with it. Nothing is lost.
        const messages = foldEventsToMessages(recovered.events);
        const stamped = stampMessageTimes(liveTimes, messages);
        const nextArchived = [
          ...archivedRef.current,
          ...archiveMessages(messages, stamped),
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
        lastSendRef.current = null;
      }
      setRecovering(false);
    })();
  }, [agentError, agentReset, emitTurnCompleted, liveTimes, storageKey, supabase]);

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
        if (isStale(VISIBLE_STALL_MS)) agentStop();
      }, WAKE_GRACE_MS);
    };
    const watchdog = setInterval(() => {
      if (isStale(WATCHDOG_STALL_MS)) agentStop();
    }, 15_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(watchdog);
      if (wakeGraceTimer !== null) clearTimeout(wakeGraceTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [agentStop, busy]);

  const transcript = buildTranscript({
    archived,
    live: agent.data.messages,
    liveTimes,
  });
  const hasAnyMessages = transcript.some((item) => item.kind === "message");
  // The chips return whenever a session has no words in it yet: the
  // first run, and a fresh morning over yesterday's scrollback.
  const showSuggestions = agent.data.messages.length === 0 && !busy;

  useEffect(() => {
    // First paint lands at the bottom instantly (yesterday above the
    // fold, today in view); later updates glide.
    bottomRef.current?.scrollIntoView({
      behavior: firstScrollDoneRef.current ? "smooth" : "auto",
    });
    firstScrollDoneRef.current = true;
  }, [agent.data.messages, archived, queued]);

  function sendMessage(text: string) {
    const message = text.trim();
    if (message.length === 0) return;
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
      return;
    }
    // The registry's modality signal (chat.turn_completed): "voice"
    // when dictation fed any part of this draft.
    turnModalityRef.current = draftFromVoiceRef.current ? "voice" : "text";
    draftFromVoiceRef.current = false;
    setDraft("");
    // Sending mid-turn queues instead of refusing (texting model,
    // founder ruling 2026-07-10 night): the bubble waits by the
    // composer and goes out the moment the line is free.
    if (busy) {
      setQueued((current) => [...current, message]);
      return;
    }
    // A manual send takes the composer back: a still-running recovery
    // of the previous turn stands down (its reply would land into a
    // conversation that has already moved on).
    recoveryRef.current?.abort();
    // A fresh session (first turn, or the reset after a failed one)
    // restarts the durable event cursor.
    if (!agent.session?.sessionId) durableCursorRef.current = 0;
    // A queue held back by a failed turn rides along with the next
    // manual send, in the order she wrote everything.
    const outgoing = [...queued, message].join("\n\n");
    setQueued([]);
    setBusySeconds(0);
    lastSendRef.current = { text: outgoing, atMs: currentTimeMs() };
    markTurnStarted();
    void agent.send({ message: outgoing });
  }

  return (
    // 3.5rem is the frame's phone top bar (h-14); on desktop the sidebar
    // sits beside this column, so the full viewport height is ours.
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      {/* 780px is the kit's transcript measure (ChatView.jsx). Turns get
          gap-6 so the flat replies and bubbles keep a clear rhythm. */}
      <main className="mx-auto flex w-full max-w-[780px] flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
        {!hasAnyMessages ? (
          <div className="my-auto text-center">
            <h1 className="font-display text-2xl font-semibold text-strong">
              {parentName ? `Hi ${parentName}, I'm Homa.` : "Hi, I'm Homa."}
            </h1>
            <p className="mt-2 font-serif text-lg italic text-muted">
              Ask me anything about your homeschool day.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {transcript.map((item) =>
              item.kind === "separator" ? (
                <DaySeparator key={item.key} label={item.label} />
              ) : (
                <MessageView key={item.key} message={item.message} />
              ),
            )}
            {showSuggestions ? (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
        {busy && busyLabel(agent.data.messages) ? (
          // The mark bobs while Homa thinks, so the wait is never a blank
          // page (tester ask, evidence memo 1; MJ-06). Goes still under
          // reduced motion; the label still reads what is happening. Flat
          // on the page like the replies, with elapsed seconds so long
          // tool runs read as progress.
          <div className="flex items-center gap-2.5 text-muted">
            <span className="chat-think-mark inline-flex" aria-hidden="true">
              <Logo size={20} variant="mark" />
            </span>
            <span>{busyLabel(agent.data.messages)}</span>
            {busySeconds > 0 ? (
              <span className="text-sm text-subtle">· {busySeconds}s</span>
            ) : null}
          </div>
        ) : null}
        {queued.length > 0 ? (
          // Messages sent mid-turn wait here as dimmed bubbles (the
          // Cursor queue, in texting clothes) and go out on turn end;
          // the X pulls one back before it sends. "Send now" interrupts:
          // stopping the turn is all it takes, the flush in onFinish
          // delivers the queue the moment the abort settles.
          <div className="flex flex-col items-end gap-2">
            {queued.map((text, index) => (
              <div
                key={`${index}:${text.slice(0, 24)}`}
                className="flex max-w-[76%] items-center gap-2"
              >
                <button
                  type="button"
                  aria-label="Remove from queue"
                  onClick={() =>
                    setQueued((current) => current.filter((_, at) => at !== index))
                  }
                  className="text-subtle transition-colors hover:text-strong"
                >
                  <X size={14} aria-hidden="true" />
                </button>
                <div className="rounded-lg rounded-br-sm bg-brand px-[18px] py-3.5 text-[0.95rem] leading-normal text-on-brand opacity-70">
                  <p className="whitespace-pre-wrap">{text}</p>
                </div>
              </div>
            ))}
            <p className="flex items-center gap-3 text-xs text-subtle">
              Sends when Homa finishes
              {busy ? (
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
            <span className="chat-think-mark inline-flex" aria-hidden="true">
              <Logo size={20} variant="mark" />
            </span>
            <span>Reconnecting&hellip;</span>
          </div>
        ) : agent.error ? (
          <p className="text-center text-sm text-danger" role="alert">
            Your conversation is safe; that last message didn&apos;t go through. Try
            sending it again.
          </p>
        ) : null}
        <div ref={bottomRef} />
      </main>

      {/* The kit's composer (ChatView.jsx): a white pill card on the page
          background, sparkles at the left, a borderless input, and a round
          arrow-up send button. Typing stays enabled while Homa works, and
          sending mid-turn queues; nothing ever waits on her. */}
      <footer className="border-t border-border-subtle bg-page px-4 pb-5 pt-3.5 sm:px-6">
        {focusChildName ? (
          // The context switcher has one kid selected; say so where she
          // types, so a focused chat never comes as a surprise, and name
          // the way back (reader-gate fix: the pill alone read as a
          // mystery button). The switcher lives in the top bar on phones
          // and in the sidebar on desktop, so the hint names each.
          <p className="mx-auto mb-2.5 flex w-full max-w-[780px] items-center gap-2">
            <span className="inline-flex items-center rounded-pill bg-brand-soft px-3 py-1 text-xs font-semibold text-[var(--clay-700)]">
              About {focusChildName}
            </span>
            <span className="text-xs text-subtle lg:hidden">
              Change who you&apos;re viewing from the top right.
            </span>
            <span className="hidden text-xs text-subtle lg:inline">
              Change who you&apos;re viewing from the sidebar.
            </span>
          </p>
        ) : null}
        <form
          className="mx-auto flex w-full max-w-[780px] items-center gap-2.5 rounded-pill border border-border-subtle bg-card py-2 pl-5 pr-2 shadow-md transition-shadow focus-within:ring-2 focus-within:ring-brand/30"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <Sparkles size={20} className="shrink-0 text-brand" aria-hidden="true" />
          {dictation.phase !== "idle" ? (
            // Talking replaces typing for the moment: the listening row
            // takes the input's place, X drops the take, the check turns
            // it into editable words. Nothing sends until she sends.
            <DictationRow
              phase={dictation.phase}
              seconds={dictation.seconds}
              onCancel={dictation.cancel}
              onAccept={dictation.accept}
            />
          ) : (
            <>
              <SlashComposer
                kids={kids ?? []}
                skills={slashSkills ?? []}
                draft={draft}
                onDraftChange={setDraft}
                placeholder="Tell Homa about your day…"
              />
              {dictation.supported ? <MicButton onStart={dictation.start} /> : null}
              {/* The Claude-composer shape (founder ruling 2026-07-10
                  night): while Homa works, an empty composer shows Stop;
                  a typed one shows Stop AND Send, where Send queues the
                  message for the moment the turn ends. Idle shows Send. */}
              {busy ? (
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
                  {draft.trim().length > 0 ? (
                    <button
                      type="submit"
                      aria-label="Send"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
                    >
                      <ArrowUp size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                </>
              ) : (
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={draft.trim().length === 0}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  <ArrowUp size={18} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </form>
        {dictation.phase === "recording" ? (
          // The contract, visible while she talks (reader gate
          // 2026-07-10: "does the check send my raw words?"): the check
          // ends the take, and sending stays hers.
          <p className="mx-auto mt-2 w-full max-w-[780px] text-sm text-subtle" role="status">
            {RECORDING_HINT_MESSAGE}
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
