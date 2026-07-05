"use client";

import type { HandleMessageStreamEvent, SessionState } from "eve/client";
import { useEveAgent, type EveMessage, type EveMessagePart } from "eve/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { WorksheetCard, type WorksheetPayload } from "./worksheet-card";

/**
 * The chat surface (trimmed M1-04). useEveAgent drives session state against
 * the same-origin eve routes; auth rides as a bearer token resolved fresh
 * per request from the Supabase browser client (which auto-refreshes), so
 * the eve channel's supabaseAuth() can validate every call. shadcn chat
 * components arrive with M1-04 proper; this stays deliberately lean.
 *
 * The transcript + session cursor persist to localStorage per user (the
 * eve-documented resumable-sessions pattern), so a reload rejoins the same
 * durable conversation instead of silently starting a new one. Snapshots
 * save on turn finish; a reload mid-turn keeps everything up to the last
 * completed turn. M1-02's Postgres conversations table replaces this.
 */

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

function MessagePartView({ part }: { part: EveMessagePart }) {
  if (part.type === "text") {
    return <p className="whitespace-pre-wrap">{part.text}</p>;
  }
  if (
    part.type === "dynamic-tool" &&
    part.toolName === "create_worksheet" &&
    part.state === "output-available"
  ) {
    const output = part.output as { worksheet?: WorksheetPayload } | undefined;
    if (output?.worksheet) {
      return (
        <div className="mt-2">
          <WorksheetCard worksheet={output.worksheet} />
        </div>
      );
    }
  }
  return null;
}

function MessageView({ message }: { message: EveMessage }) {
  const isUser = message.role === "user";
  const hasRenderableContent = message.parts.some(
    (part) =>
      (part.type === "text" && part.text.trim().length > 0) ||
      (part.type === "dynamic-tool" &&
        part.toolName === "create_worksheet" &&
        part.state === "output-available"),
  );
  if (!hasRenderableContent) return null;

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg rounded-br-sm bg-brand px-4 py-3 text-on-brand"
            : "max-w-[85%] rounded-lg rounded-bl-sm bg-card px-4 py-3 text-body shadow-sm"
        }
      >
        {message.parts.map((part, index) => (
          <MessagePartView key={index} part={part} />
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

export function ChatClient({ storageKey }: { storageKey: string }) {
  const supabase = createSupabaseBrowserClient();
  const [saved] = useState<SavedChat>(() => loadSavedChat(storageKey));
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
    },
  });

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = agent.status === "submitted" || agent.status === "streaming";

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
    void agent.send({ message });
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle bg-card px-6 py-3">
        <Logo size={24} />
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
              Hi, I&apos;m Homa.
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
        {busy &&
        agent.data.messages.at(-1)?.role === "user" ? (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-sm bg-card px-4 py-3 text-muted shadow-sm">
              thinking&hellip;
            </div>
          </div>
        ) : null}
        {agent.error ? (
          <p className="text-center text-sm text-danger" role="alert">
            Something went wrong: {agent.error.message}
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
