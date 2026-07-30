"use client";

import { openai } from "@ai-sdk/openai";
import { experimental_useRealtime as useRealtime } from "@ai-sdk/react";
import { Mic, MicOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  settledTurns,
  voiceTurns,
  type VoiceTranscriptLine,
  type VoiceTurn,
} from "./voice-transcript";

/**
 * The in-app voice conversation (issue #283, founder direction 2026-07-29).
 *
 * She taps the composer's voice button and talks. Each turn appears in the
 * THREAD as it is spoken, hers as her message and Homa's as Homa's, exactly
 * like a typed exchange. Chat with voice activation, not a phone call:
 * Telnyx stays for someone who wants to dial a number.
 *
 * This component no longer produces a transcript. The first version bundled
 * the whole conversation into one "here is what we said out loud" message,
 * sent it through eve as if she had typed it, and text Homa replied to it,
 * which is how you get Homa answering a transcript with "that's a very
 * short call!". A spoken turn is not a message ABOUT a conversation, it is
 * a turn IN one, so each one is handed up the moment it settles (`onTurn`)
 * and written to the same table typed turns live in.
 *
 * Turn by turn rather than all at the end, deliberately. A dropped socket
 * after ten minutes would otherwise lose all ten, and the realtime session
 * does not resume on reconnect.
 *
 * No eve turn is ever run from here. Text Homa must not answer what voice
 * Homa just said, which would be Homa replying to herself in front of the
 * parent. The turns reach her as context for the next thing the parent
 * TYPES, through the per-turn context block.
 *
 * Nothing about Homa's persona, her limits, or which family she is talking
 * about is decided here. All of it is pinned into the minted credential by
 * /api/voice/realtime/token, so this component cannot change who she is.
 * The `model` below is only the codec that translates events on the wire.
 */

const MODEL_ID = "gpt-realtime-2.1";

/** A session id for one spoken conversation. Called from an effect, never
 * during render: both reads are impure. */
function newVoiceSessionId(): string {
  return `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reasons the token route can refuse, in the parent's words. */
const REASONS: Record<string, string> = {
  "no-session": "Your session expired. Sign in again and we can talk.",
  "no-family": "I could not find your family account.",
  walled: "Talking out loud comes with a paid plan.",
  "not-included": "Voice is not part of your plan yet.",
  "rate-limited": "We have talked a lot today. Let's pick this up tomorrow.",
  "not-configured": "My voice is not set up right now.",
};

export function VoiceMode({
  onTurn,
  onClose,
}: {
  /** Called once per settled turn, in order, so the thread can render it
   * live. The component also persists it; this is the render path. */
  onTurn: (line: VoiceTranscriptLine) => void;
  /** The conversation is over. The panel closes; the turns already handed
   * over stay in the thread. */
  onClose: () => void;
}) {
  const model = useMemo(() => openai.experimental_realtime(MODEL_ID), []);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closedRef = useRef(false);

  const {
    status,
    messages,
    isCapturing,
    isPlaying,
    connect,
    disconnect,
    startAudioCapture,
    stopAudioCapture,
  } = useRealtime({
    model,
    api: { token: "/api/voice/realtime/token" },
    // Every tool call is executed server-side, never here: the arguments
    // are model output, so the only place they can be trusted is behind
    // that route's own authentication. familyId is not sent; the route
    // reads it from the caller's own membership row.
    onToolCall: async ({ toolCall }) => {
      const response = await fetch("/api/voice/realtime/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: toolCall.toolName, args: toolCall.args }),
      });
      const body = (await response.json().catch(() => null)) as
        | { output?: unknown }
        | null;
      // A refusal is still an answer the model can speak. Returning
      // nothing would leave it waiting mid-sentence.
      return body?.output ?? { note: "That did not go through just now." };
    },
    onError: () => {
      setError("Something interrupted us. Worth trying again.");
    },
  });

  const turns = useMemo(() => voiceTurns(messages), [messages]);

  /** The realtime session these turns belong to, so they group as one
   * exchange and (sessionId, sequence) can carry the write's idempotency.
   *
   * Minted on the first settled turn, not during render: a clock read and a
   * random draw are impure, and React may render this component more than
   * once per open. Once set it never changes, so every turn of one
   * conversation shares it. */
  const sessionIdRef = useRef<string | null>(null);
  /** Position after the last turn handed to the thread. */
  const cursorRef = useRef(0);

  /** Hand up and persist every turn that has settled since last time.
   * Fire-and-forget on the write: she is mid-conversation, so a failed row
   * is worth a log and never an interruption. */
  const flushTurns = useCallback(
    (available: readonly VoiceTurn[], finished: boolean) => {
      const { cursor, lines } = settledTurns(
        available,
        cursorRef.current,
        finished,
      );
      cursorRef.current = cursor;
      if (lines.length === 0) return;
      sessionIdRef.current ??= newVoiceSessionId();
      const sessionId = sessionIdRef.current;
      for (const { sequence, line } of lines) {
        onTurn(line);
        void fetch("/api/voice/realtime/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            sequence,
            role: line.role,
            content: line.text,
          }),
        }).catch(() => {
          // Logged server-side; nothing useful to say to her mid-sentence.
        });
      }
    },
    [onTurn],
  );

  // Turns settle as the conversation moves on, so this runs on every change
  // to the store rather than at the end.
  useEffect(() => {
    flushTurns(turns, false);
  }, [flushTurns, turns]);

  /** One way out, whatever caused it, so the last turn is never dropped on
   * a path somebody forgot to handle. */
  const leave = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    stopAudioCapture();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    disconnect();
    // Nothing more is coming, so the turn that was still arriving is now
    // settled and belongs in the thread.
    flushTurns(voiceTurns(messages), true);
    onClose();
  }, [disconnect, flushTurns, messages, onClose, stopAudioCapture]);

  // Open the session and the microphone together: she tapped a button that
  // says talk, so being connected but deaf is a state with no purpose.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await connect();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        startAudioCapture(stream);
      } catch {
        if (cancelled) return;
        // Either the token route refused or she declined the microphone.
        // Ask the route directly so the reason is hers, not a guess.
        try {
          const probe = await fetch("/api/voice/realtime/token", { method: "POST" });
          if (!probe.ok) {
            const body = (await probe.json().catch(() => null)) as
              | { reason?: string }
              | null;
            setError(
              (body?.reason ? REASONS[body.reason] : null)
                ?? "I could not start listening just now.",
            );
            return;
          }
        } catch {
          // Fall through to the microphone message below.
        }
        setError(
          "I could not hear your microphone. Check the browser's permission and try again.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // Once, on open. `leave` owns teardown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Release the microphone even if this unmounts without a tap on Done: an
  // orphaned capture leaves the browser's recording indicator on, which
  // reads as Homa still listening.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const connecting = status !== "connected" && error === null;

  return (
    <section
      aria-label="Talking with Homa"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={
            isPlaying
              ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
              : "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[var(--clay-700)]"
          }
        >
          {isCapturing ? <Mic size={17} /> : <MicOff size={17} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-strong">
            {error
              ? "We got cut off"
              : connecting
                ? "Getting ready…"
                : isPlaying
                  ? "Homa is talking"
                  : "Listening"}
          </span>
          <span className="block text-sm text-muted">
            {error ?? "Talk normally. Every turn appears in your chat as you go."}
          </span>
        </span>
        <button
          type="button"
          onClick={leave}
          aria-label="End the conversation"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-strong transition-colors hover:border-brand"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
