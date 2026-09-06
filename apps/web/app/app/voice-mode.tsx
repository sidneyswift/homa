"use client";

import { openai } from "@ai-sdk/openai";
import { experimental_useRealtime as useRealtime } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../../components/design/Icon";
import { QuietAction } from "../../components/design/QuietAction";
import { QuietFrame } from "../../components/design/QuietFrame";
import type { VoiceHomaBridgeOutput } from "../../lib/voice/homa-bridge";
import { WebVoiceSession } from "./voice-session";
import { webVoiceOutputForDisplay } from "./voice-effects";
import type { VoiceTranscriptLine } from "./voice-transcript";

const MODEL_ID = "gpt-realtime-2.1";

/** Audio belongs to this panel; durable capabilities run through the same
 * authenticated Homa bridge as native voice. The event controller owns turn
 * identity before React or the SDK's transcript array can reorder it. */
export function VoiceMode({ onTurn, onClose, onEffects, onNotice, onActiveChange }: {
  onTurn: (line: VoiceTranscriptLine) => void;
  onClose: () => void;
  onEffects: (output: VoiceHomaBridgeOutput, context: { sessionId: string; sourceSequence: number }) => void;
  onNotice: (message: string) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const model = useMemo(() => openai.experimental_realtime(MODEL_ID), []);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<WebVoiceSession | null>(null);
  const connectionRef = useRef<Promise<void>>(Promise.resolve());
  const closedRef = useRef(false);
  const connectedRef = useRef(false);
  const endRef = useRef<() => Promise<void>>(async () => {});
  const callbacksRef = useRef({ onTurn, onEffects, onNotice, onActiveChange });
  useEffect(() => { callbacksRef.current = { onTurn, onEffects, onNotice, onActiveChange }; }, [onTurn, onEffects, onNotice, onActiveChange]);

  const {
    status, isCapturing, isPlaying, connect, disconnect,
    startAudioCapture, stopAudioCapture, stopPlayback,
  } = useRealtime({
    model,
    api: { token: "/api/voice/realtime/token" },
    onEvent: (event) => sessionRef.current?.receive(event),
    onToolCall: async ({ toolCall }) => webVoiceOutputForDisplay(await (sessionRef.current?.runTool(toolCall) ?? Promise.resolve({
      ok: false, spokenReply: "The conversation has ended. Please try again when we are talking.", effects: [],
    }))),
    onError: () => {
      const message = "Something interrupted us. Worth trying again.";
      setError(message);
      callbacksRef.current.onActiveChange(false);
      callbacksRef.current.onNotice(message);
      void endRef.current();
    },
  });

  const stopMicrophone = useCallback(() => {
    stopAudioCapture();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    callbacksRef.current.onActiveChange(false);
  }, [stopAudioCapture]);

  const leave = useCallback(async () => {
    if (closedRef.current) { onClose(); return; }
    closedRef.current = true;
    stopMicrophone();
    stopPlayback();
    disconnect();
    setEnded(true);
    setSaving(true);
    const saved = await sessionRef.current?.finish();
    setSaving(false);
    if (saved !== false) onClose();
    else setSaveFailed(true);
  }, [disconnect, onClose, stopMicrophone, stopPlayback]);

  useEffect(() => { endRef.current = leave; }, [leave]);
  useEffect(() => {
    if (status === "connected") connectedRef.current = true;
    if (status === "disconnected" && connectedRef.current && !closedRef.current) {
      callbacksRef.current.onNotice("The voice connection ended. You can start a new conversation when you are ready.");
      void endRef.current();
    }
  }, [status]);

  const retrySave = async () => {
    setSaving(true);
    if (await sessionRef.current?.retrySave()) {
      callbacksRef.current.onNotice("");
      onClose();
    }
    setSaving(false);
  };

  useEffect(() => {
    let cancelled = false;
    // Create before connect: the first response can invoke a tool before
    // any readable message has reached React.
    const session = new WebVoiceSession(`voice-${crypto.randomUUID()}`, {
      fetch,
      onTurn: (line) => callbacksRef.current.onTurn(line),
      onEffects: (output, context) => callbacksRef.current.onEffects(webVoiceOutputForDisplay(output), context),
      onError: (message) => {
        if (!cancelled) setError(message);
        callbacksRef.current.onNotice(message);
      },
    });
    const previousConnection = connectionRef.current;
    connectionRef.current = (async () => {
      // React StrictMode replays this effect. Finish a cancelled token request
      // and close its late socket before connecting the replacement instance.
      await previousConnection;
      if (cancelled || closedRef.current) return;
      sessionRef.current = session;
      try {
        await connect();
        if (cancelled || closedRef.current) {
          disconnect();
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled || closedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        startAudioCapture(stream);
        callbacksRef.current.onActiveChange(true);
      } catch (cause) {
        if (cancelled || closedRef.current) return;
        // Do not mint a second paid session just to diagnose the first.
        const message = cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was declined. Allow it in your browser to talk with Homa."
          : "I could not start listening just now. Check your connection and try again.";
        setError(message);
        callbacksRef.current.onNotice(message);
        void endRef.current();
      }
    })();
    return () => {
      cancelled = true;
      stopAudioCapture();
      stopPlayback();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      callbacksRef.current.onActiveChange(false);
      disconnect();
      void session.finish();
      if (sessionRef.current === session) sessionRef.current = null;
    };
    // One SDK session per open. SDK exposes rebound methods on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connecting = !ended && error === null && (status !== "connected" || !isCapturing);

  return (
    <QuietFrame
      as="section"
      aria-label="Talking with Homa"
      className="quiet-chat__voice-panel p-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`quiet-chat__voice-status-mark ${isPlaying ? "quiet-chat__voice-status-mark--active" : ""}`}
        >
          <Icon
            name="voice"
            size={20}
            className={isCapturing ? undefined : "opacity-65"}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="quiet-chat__voice-title">
            {ended
              ? "Conversation ended"
              : connecting
                ? "Getting ready…"
                : isPlaying
                  ? "Homa is talking"
                  : "Listening"}
          </span>
          <span className="quiet-chat__voice-copy">
            {error ?? "Talk normally. Every turn appears in your chat as you go."}
          </span>
        </span>
        <button
          type="button"
          onClick={() => { void leave(); }}
          aria-label={ended ? "Close the voice panel" : "End the conversation"}
          className="quiet-chat__voice-close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      {ended && saveFailed ? (
        <div className="mt-3">
          <QuietAction disabled={saving} kind="secondary" onClick={() => { void retrySave(); }}>
            {saving ? "Saving…" : "Try saving again"}
          </QuietAction>
        </div>
      ) : null}
    </QuietFrame>
  );
}
