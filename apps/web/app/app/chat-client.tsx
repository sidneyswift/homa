"use client";

import { emitEvent } from "@homa/core";
import { useEveAgent, type EveMessage } from "eve/react";
import { ArrowUp, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import type { SlashSkillItem } from "../../lib/slash-skills";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import {
  archiveMessages,
  prepareChat,
  pruneMessageTimes,
  saveChat,
  stampMessageTimes,
  type ArchivedMessage,
} from "./chat-storage";
import { busyLabel, countLastTurnToolCalls, MessageView } from "./message-parts";
import { SlashComposer } from "./slash-composer";
import { buildTranscript } from "./transcript-days";
import { markTurnStarted, takeTurnLatencyMs } from "./turn-clock";

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
 * the suggestion chips back. "New chat" is the same move done manually:
 * it archives the visible conversation and starts a fresh session, it
 * no longer erases anything. The durable record is Postgres
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
 *   1. the send button becomes a Stop button while Homa works, so she
 *      can always take the wheel back;
 *   2. returning to a visible tab with a stream that has been silent
 *      past the stall window quietly aborts the dead stream;
 *   3. a watchdog does the same for streams that die without the tab
 *      ever hiding (radio handoffs), sized generously past the longest
 *      normal tool run.
 */

// agent.ts pins the gateway model: the mid tier in journeys/06 terms.
const MODEL_TIER = "mid" as const;

const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

export function ChatClient({
  storageKey,
  familyId,
  parentName,
  focusChildName,
  initialDraft,
  kids,
  slashSkills,
}: {
  storageKey: string;
  familyId: string | null;
  parentName: string | null;
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
  const supabase = createSupabaseBrowserClient();
  // Load + rotation decision, once per mount (fresh morning = fresh
  // session; the old session's messages fold into the archive).
  const [prepared] = useState(() => prepareChat(storageKey));
  const [archived, setArchived] = useState<ArchivedMessage[]>(prepared.archived);
  // Message id -> arrival time. State (not a ref) because the transcript
  // grouping reads it during render.
  const [liveTimes, setLiveTimes] = useState<Record<string, number>>(() => ({
    ...prepared.messageTimes,
  }));
  const messagesRef = useRef<readonly EveMessage[]>([]);
  const archivedRef = useRef(archived);
  const reportedErrorRef = useRef<Error | null>(null);

  async function emitTurnCompleted(
    status: "ok" | "error",
    errorClass?: "turn_failed" | "send_failed" | "unknown",
  ) {
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
        modality: "text",
        latency_ms: takeTurnLatencyMs(),
        model_tier: MODEL_TIER,
        tool_calls: countLastTurnToolCalls(messagesRef.current),
      },
    );
  }

  const agent = useEveAgent({
    auth: {
      bearer: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      },
    },
    initialEvents: prepared.initialEvents,
    initialSession: prepared.initialSession,
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
        lastActivityAt: Date.now(),
      });
      void emitTurnCompleted("ok");
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
    },
  });

  const [draft, setDraft] = useState(initialDraft ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstScrollDoneRef = useRef(false);
  const busy = agent.status === "submitted" || agent.status === "streaming";

  // Elapsed seconds beside the busy label (the reference transcript's
  // "· 19s"): long waits read as work in progress, not a hang. Reset
  // happens in sendMessage (an event handler), so this effect only ticks.
  const [busySeconds, setBusySeconds] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setBusySeconds(Math.floor((Date.now() - startedAt) / 1000));
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
    if (agent.error && agent.error !== reportedErrorRef.current) {
      reportedErrorRef.current = agent.error;
      void emitTurnCompleted("error", "turn_failed");
    }
    // emitTurnCompleted is re-created per render; agent.error is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.error]);

  /** The manual fresh start: archive what is on screen, rotate the
   *  session, keep every word visible above. Nothing is erased. */
  function startNewChat() {
    const nextArchived = [
      ...archivedRef.current,
      ...archiveMessages(
        agent.data.messages,
        stampMessageTimes(liveTimes, agent.data.messages),
      ),
    ];
    setArchived(nextArchived);
    archivedRef.current = nextArchived;
    setLiveTimes({});
    saveChat(storageKey, {
      archived: nextArchived,
      events: [],
      session: undefined,
      messageTimes: {},
      lastActivityAt: Date.now(),
    });
    agent.reset();
  }

  const transcript = buildTranscript({
    archived,
    live: agent.data.messages,
    liveTimes,
  });
  const hasAnyMessages = transcript.some((item) => item.kind === "message");
  // The chips return whenever a session has no words in it yet: the
  // first run, a fresh morning over yesterday's scrollback, and right
  // after "New chat".
  const showSuggestions = agent.data.messages.length === 0 && !busy;

  useEffect(() => {
    // First paint lands at the bottom instantly (yesterday above the
    // fold, today in view); later updates glide.
    bottomRef.current?.scrollIntoView({
      behavior: firstScrollDoneRef.current ? "smooth" : "auto",
    });
    firstScrollDoneRef.current = true;
  }, [agent.data.messages, archived]);

  function sendMessage(text: string) {
    const message = text.trim();
    if (message.length === 0 || busy) return;
    setDraft("");
    setBusySeconds(0);
    markTurnStarted();
    void agent.send({ message });
  }

  return (
    // 3.5rem is the frame's phone top bar (h-14); on desktop the sidebar
    // sits beside this column, so the full viewport height is ours.
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      {hasAnyMessages ? (
        <header className="flex justify-end border-b border-border-subtle bg-page px-4 py-2.5">
          <button
            type="button"
            onClick={startNewChat}
            disabled={busy || agent.data.messages.length === 0}
            className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand disabled:opacity-60"
          >
            New chat
          </button>
        </header>
      ) : null}

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
        {agent.error ? (
          <p className="text-center text-sm text-danger" role="alert">
            Your conversation is safe; that last message didn&apos;t go through. Try
            sending it again.
          </p>
        ) : null}
        <div ref={bottomRef} />
      </main>

      {/* The kit's composer (ChatView.jsx): a white pill card on the page
          background, sparkles at the left, a borderless input, and a round
          arrow-up send button. Typing stays enabled while Homa works; only
          sending waits. */}
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
          <SlashComposer
            kids={kids ?? []}
            skills={slashSkills ?? []}
            draft={draft}
            onDraftChange={setDraft}
            placeholder="Tell Homa about your day…"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={busy || draft.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </form>
      </footer>
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
