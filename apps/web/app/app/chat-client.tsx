"use client";

import { emitEvent } from "@homa/core";
import type { HandleMessageStreamEvent, SessionState } from "eve/client";
import { useEveAgent, type EveMessage } from "eve/react";
import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { busyLabel, countLastTurnToolCalls, MessageView } from "./message-parts";
import { markTurnStarted, takeTurnLatencyMs } from "./turn-clock";

/**
 * The chat surface (trimmed M1-04), the main column inside the /app
 * frame: the sidebar and phone top bar come from the layout, so this
 * component fills the rest of the viewport (100dvh minus the top bar's
 * h-14 on phones, full height beside the sidebar on desktop) and keeps
 * the composer pinned to the bottom while the transcript scrolls inside.
 * useEveAgent drives session state against the same-origin eve routes;
 * auth rides as a bearer token resolved fresh per request from the
 * Supabase browser client. Homa's per-family context (family, children,
 * memories) is injected server-side on every turn by
 * agent/instructions/family-context.ts, so even a brand-new session starts
 * already knowing the family.
 *
 * The transcript + session cursor persist to localStorage per user (the
 * eve-documented resumable-sessions pattern); M1-02's Postgres conversations
 * table replaces this. chat.turn_completed events emit per journeys/06 §4.4
 * under the caller's own token (events policy, migration #13).
 */

// agent.ts pins anthropic/claude-sonnet-5: the mid tier in journeys/06 terms.
const MODEL_TIER = "mid" as const;

interface SavedChat {
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
}

function loadSavedChat(storageKey: string): SavedChat {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SavedChat) : {};
  } catch {
    return {};
  }
}

const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

export function ChatClient({
  storageKey,
  familyId,
  parentName,
  initialDraft,
}: {
  storageKey: string;
  familyId: string | null;
  parentName: string | null;
  /** Pre-fills the composer (the journal email's deep link); the parent
   * still edits and sends herself, nothing auto-sends. */
  initialDraft?: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const [saved] = useState<SavedChat>(() => loadSavedChat(storageKey));
  const messagesRef = useRef<readonly EveMessage[]>([]);
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
    initialEvents: saved.events ?? [],
    initialSession: saved.session,
    onFinish(snapshot) {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ events: snapshot.events, session: snapshot.session }),
        );
      } catch {
        // Storage full or blocked: the durable session still lives server-side.
      }
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
    if (agent.error && agent.error !== reportedErrorRef.current) {
      reportedErrorRef.current = agent.error;
      void emitTurnCompleted("error", "turn_failed");
    }
    // emitTurnCompleted is re-created per render; agent.error is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.error]);

  function startNewChat() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Best effort; reset() clears the in-memory state regardless.
    }
    agent.reset();
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agent.data.messages]);

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
      {agent.data.messages.length > 0 ? (
        <header className="flex justify-end border-b border-border-subtle bg-page px-4 py-2.5">
          <button
            type="button"
            onClick={startNewChat}
            disabled={busy}
            className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand disabled:opacity-60"
          >
            New chat
          </button>
        </header>
      ) : null}

      {/* 780px is the kit's transcript measure (ChatView.jsx). Turns get
          gap-6 so the flat replies and bubbles keep a clear rhythm. */}
      <main className="mx-auto flex w-full max-w-[780px] flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
        {agent.data.messages.length === 0 ? (
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
          agent.data.messages.map((message) => (
            <MessageView key={message.id} message={message} />
          ))
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
        <form
          className="mx-auto flex w-full max-w-[780px] items-center gap-2.5 rounded-pill border border-border-subtle bg-card py-2 pl-5 pr-2 shadow-md transition-shadow focus-within:ring-2 focus-within:ring-brand/30"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <Sparkles size={20} className="shrink-0 text-brand" aria-hidden="true" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tell Homa about your day…"
            className="min-h-10 min-w-0 flex-1 bg-transparent text-base text-strong outline-none placeholder:text-subtle"
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
