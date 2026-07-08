"use client";

import { emitEvent } from "@homa/core";
import type { HandleMessageStreamEvent, SessionState } from "eve/client";
import { useEveAgent, type EveMessage } from "eve/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { busyLabel, countLastTurnToolCalls, MessageView } from "./message-parts";
import { markTurnStarted, takeTurnLatencyMs } from "./turn-clock";

/**
 * The chat surface (trimmed M1-04). useEveAgent drives session state against
 * the same-origin eve routes; auth rides as a bearer token resolved fresh
 * per request from the Supabase browser client. Homa's per-family context
 * (family, children, memories) is injected server-side on every turn by
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
}: {
  storageKey: string;
  familyId: string | null;
  parentName: string | null;
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
    },
  });

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = agent.status === "submitted" || agent.status === "streaming";

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
    markTurnStarted();
    void agent.send({ message });
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle bg-card px-6 py-3">
        {/* The wordmark is a home link everywhere (tester ask, evidence memo 2). */}
        <Link href="/home" aria-label="Home" className="inline-flex rounded-md">
          <Logo size={24} />
        </Link>
        <div className="flex gap-2">
          {agent.data.messages.length > 0 ? (
            <button
              type="button"
              onClick={startNewChat}
              disabled={busy}
              className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand disabled:opacity-60"
            >
              New chat
            </button>
          ) : null}
          <Link
            href="/home"
            className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        {agent.data.messages.length === 0 ? (
          <div className="my-auto text-center">
            <h1 className="font-display text-2xl font-semibold text-strong">
              {parentName ? `Hi ${parentName}, I'm Homa.` : "Hi, I'm Homa."}
            </h1>
            <p className="mt-2 text-body">
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
          <div className="flex justify-start">
            {/* The mark bobs while Homa thinks, so the wait is never a blank
                page (tester ask, evidence memo 1; MJ-06). Goes still under
                reduced motion; the label still reads what is happening. */}
            <div className="flex items-center gap-2.5 rounded-lg rounded-bl-sm bg-card px-4 py-3 text-muted shadow-sm">
              <span className="chat-think-mark inline-flex" aria-hidden="true">
                <Logo size={20} variant="mark" />
              </span>
              <span>{busyLabel(agent.data.messages)}</span>
            </div>
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

      <footer className="border-t border-border-subtle bg-card px-4 py-3">
        <form
          className="mx-auto flex w-full max-w-2xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tell Homa about your day…"
            disabled={busy}
            className="min-h-12 flex-1 rounded-pill border border-border px-5 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="min-h-12 rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
