"use client";

import { gateway } from "@ai-sdk/gateway";
import { experimental_useRealtime as useRealtime } from "@ai-sdk/react";
import { Mic, MicOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { transcriptFromRealtimeMessages, type VoiceTranscriptLine } from "./voice-transcript";

/**
 * The in-app voice conversation (issue #283, founder direction 2026-07-29).
 *
 * She taps the composer's voice button, Homa talks, and the transcript
 * appears as it is spoken so she can read along. When it ends, the whole
 * conversation goes into her chat like any other. Chat with voice
 * activation, not a phone call: Telnyx stays for someone who wants to dial
 * a number.
 *
 * The transcript is written as it streams, never assembled at the end. The
 * gateway does not resume a session on reconnect, so a dropped socket after
 * a ten-minute conversation would otherwise lose all ten minutes. Every
 * line is already in state by the time it is spoken, and `onClose` hands
 * whatever exists to the chat.
 *
 * Nothing about Homa's persona, her limits, or which family she is talking
 * about is decided here. All of it is pinned into the minted credential by
 * /api/voice/realtime/token, so this component cannot change who she is.
 * The `model` below is only the codec that translates events on the wire.
 */

const MODEL_ID = "openai/gpt-realtime-2.1";

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
  onClose,
}: {
  /** Handed the transcript so the conversation lands in the chat thread.
   * Called exactly once, on the way out, with whatever was said. */
  onClose: (transcript: VoiceTranscriptLine[]) => void;
}) {
  const model = useMemo(() => gateway.experimental_realtime(MODEL_ID), []);
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

  const transcript = useMemo(
    () => transcriptFromRealtimeMessages(messages),
    [messages],
  );

  /** One way out, whatever caused it, so the transcript is never dropped
   * on a path somebody forgot to handle. */
  const leave = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    stopAudioCapture();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    disconnect();
    onClose(transcriptFromRealtimeMessages(messages));
  }, [disconnect, messages, onClose, stopAudioCapture]);

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
            {error ?? "Talk normally. Everything you say lands in this chat."}
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

      {transcript.length > 0 ? (
        <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto border-t border-border pt-3">
          {transcript.map((line, index) => (
            <li key={`${line.role}-${index}`} className="text-sm">
              <span className="font-semibold text-strong">
                {line.role === "assistant" ? "Homa" : "You"}
              </span>{" "}
              <span className="text-body">{line.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
