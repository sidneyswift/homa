"use client";

import { LiveSessionDiagnostics, LiveVoiceConversation, waitForLiveIce } from "@homa/core";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/design/Icon";
import { QuietAction } from "../../components/design/QuietAction";
import { QuietFrame } from "../../components/design/QuietFrame";
import type { VoiceHomaBridgeOutput } from "../../lib/voice/homa-bridge";
import { webVoiceOutputForDisplay } from "./voice-effects";
import type { VoiceTranscriptLine } from "./voice-transcript";

export function VoiceMode({ onTurn, onClose, onEffects, onNotice, onActiveChange, onWorking, onAnnouncementChange }: {
  onTurn: (line: VoiceTranscriptLine) => void;
  onClose: () => void;
  onEffects: (output: VoiceHomaBridgeOutput, context: { sessionId: string; sourceSequence: number }) => void;
  onNotice: (message: string) => void;
  onActiveChange: (active: boolean) => void;
  onWorking: (working: boolean, context: { sessionId: string; sourceSequence: number }) => void;
  onAnnouncementChange: (say: ((text: string) => void) | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isCapturing, setCapturing] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const sessionRef = useRef<LiveVoiceConversation | null>(null);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const callbacksRef = useRef({ onTurn, onClose, onEffects, onNotice, onActiveChange, onWorking, onAnnouncementChange });
  useEffect(() => { callbacksRef.current = { onTurn, onClose, onEffects, onNotice, onActiveChange, onWorking, onAnnouncementChange }; });

  const leave = async () => {
    setEnded(true);
    setSaving(true);
    await stopRef.current();
    const saved = await sessionRef.current?.finish();
    setSaving(false);
    if (saved !== false) onClose();
    else setSaveFailed(true);
  };
  const retrySave = async () => {
    setSaving(true);
    if (await sessionRef.current?.retrySave()) onClose();
    setSaving(false);
  };

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let stream: MediaStream | undefined;
    let peer: RTCPeerConnection | undefined;
    let channel: RTCDataChannel | undefined;
    let handle: { sessionId: string; closeToken: string } | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let closeResolve: (() => void) | undefined;
    let stopping: Promise<void> | undefined;
    const diagnostics = new LiveSessionDiagnostics();
    const audio = new Audio();
    audio.autoplay = true;
    const session = new LiveVoiceConversation(`voice-${crypto.randomUUID()}`, {
      fetch: (path, init) => fetch(path, init),
      send: (event) => { if (channel?.readyState === "open") { channel.send(JSON.stringify(event)); diagnostics.sent(event); } },
      onCaption: (line) => callbacksRef.current.onTurn(line),
      onEffects: (output, context) => {
        const display = webVoiceOutputForDisplay(output as VoiceHomaBridgeOutput);
        callbacksRef.current.onEffects(display, context);
        return display;
      },
      onWorking: (working, context) => callbacksRef.current.onWorking(working, context),
      onError: (message) => { setError(message); callbacksRef.current.onNotice(message); },
    });
    sessionRef.current = session;
    const release = async () => {
      if (!handle) return;
      const current = handle;
      handle = undefined;
      try {
        const result = await fetch("/api/voice/live/session", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current), keepalive: true, signal: AbortSignal.timeout(12_000) });
        if (!result.ok) callbacksRef.current.onNotice("The voice connection closed, but its final shutdown could not be confirmed.");
      } catch { callbacksRef.current.onNotice("The voice connection closed, but its final shutdown could not be confirmed."); }
    };
    const stop = () => {
      if (stopping) return stopping;
      cancelled = true;
      callbacksRef.current.onAnnouncementChange(null);
      const finished = session.finish();
      stream?.getTracks().forEach((track) => track.stop());
      audio.pause();
      if (timer) clearInterval(timer);
      if (startTimer) clearTimeout(startTimer);
      callbacksRef.current.onActiveChange(false);
      setCapturing(false);
      stopping = (async () => {
        if (started && !diagnostics.snapshot().finalized && channel?.readyState === "open") {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 5_000);
            closeResolve = () => { clearTimeout(timeout); resolve(); };
            channel!.send(JSON.stringify({ type: "session.close" }));
          });
        }
        if (!diagnostics.snapshot().finalized) {
          await release();
        }
        console.info("Live session diagnostics", diagnostics.snapshot());
        channel?.close();
        peer?.close();
        audio.srcObject = null;
        await finished;
      })();
      return stopping;
    };
    stopRef.current = stop;
    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      setEnded(true);
      callbacksRef.current.onNotice(message);
      void stop().then(() => session.finish());
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        peer = new RTCPeerConnection();
        stream.getTracks().forEach((track) => peer!.addTrack(track, stream!));
        peer.ontrack = ({ streams }) => { if (cancelled) return; audio.srcObject = streams[0]; void audio.play().catch(() => fail("Tap to allow audio, then start a new conversation.")); };
        peer.onconnectionstatechange = () => {
          if (peer?.connectionState === "failed" || peer?.connectionState === "disconnected") fail("Our voice connection ended. Please start a new conversation.");
        };
        channel = peer.createDataChannel("oai-events");
        channel.onclose = () => fail("Our voice connection ended. Please start a new conversation.");
        channel.onerror = () => fail("Our voice connection was interrupted. Please start a new conversation.");
        channel.onmessage = ({ data }) => {
          try {
            const event = JSON.parse(data);
            diagnostics.receive(event);
            if (event.type === "session.closed") {
              closeResolve?.();
              if (!cancelled) fail("The voice conversation ended. You can start another when you are ready.");
              return;
            }
            if (cancelled) return;
            if (event.type === "session.started") {
              started = true;
              if (startTimer) clearTimeout(startTimer);
              setCapturing(true);
              callbacksRef.current.onActiveChange(true);
              callbacksRef.current.onAnnouncementChange((text) => session.say(text));
            }
            session.receive(event);
            if (event.type === "error" && !started) fail("I could not complete the voice connection. Please try again.");
          } catch { /* Unknown provider events cannot crash the chat. */ }
        };
        await peer.setLocalDescription(await peer.createOffer());
        await waitForLiveIce(() => peer?.iceGatheringState === "complete" || cancelled);
        if (cancelled) return;
        const response = await fetch("/api/voice/live/session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdp: peer.localDescription?.sdp }), signal: AbortSignal.timeout(40_000),
        });
        const body = await response.json();
        if (!response.ok || typeof body.sdp !== "string" || typeof body.sessionId !== "string" || typeof body.closeToken !== "string") throw new Error("Voice could not connect. Check your plan and connection, then try again.");
        handle = { sessionId: body.sessionId, closeToken: body.closeToken };
        if (cancelled) { await release(); return; }
        startTimer = setTimeout(() => fail("Voice took too long to connect. Please try again."), 20_000);
        await peer.setRemoteDescription({ type: "answer", sdp: body.sdp });
        if (cancelled) { peer.close(); return; }
        // Live has no response-done event. Received audio levels drive this
        // indicator, independently of transcript and backend completion.
        let polling = false;
        timer = setInterval(() => {
          if (polling || cancelled) return;
          polling = true;
          void peer!.getStats().then((report) => {
            let level = 0;
            report.forEach((stat) => { if (stat.type === "inbound-rtp" && stat.kind === "audio") level = stat.audioLevel ?? 0; });
            if (!cancelled) setPlaying(level > 0.012);
          }).catch(() => {}).finally(() => { polling = false; });
        }, 100);
      } catch (cause) {
        fail(cause instanceof Error ? cause.message : "I could not start listening just now.");
      }
    })();
    return () => { void stop().then(() => session.finish()); };
  }, []);

  const connecting = !ended && error === null && !isCapturing;

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
            {error ?? (ended
              ? saving ? "Saving our conversation…" : "This conversation has ended."
              : "Talk normally. Every turn appears in your chat as you go.")}
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
