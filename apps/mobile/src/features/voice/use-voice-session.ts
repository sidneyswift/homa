import { LiveSessionDiagnostics, LiveVoiceConversation, waitForLiveIce, type ActiveObjectReference, type LiveCaption } from "@homa/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EveMessage } from "eve/react";
import { AppState } from "react-native";
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, type MediaStream } from "react-native-webrtc";
import { prepareVoiceAudioForConversation } from "../../../modules/homa-voice-audio";
import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { appendUniqueVoiceToolEffects, messagesFromVoiceToolEffects, parseVoiceToolBridgeOutput, type VoiceToolEffect } from "./realtime-tool-effects";
import { readRemoteAudioLevel, smoothVoiceLevel, visualVoiceLevel, type AudioEnergySample } from "./remote-audio-level";

type VoiceStatus = "idle" | "connecting" | "listening" | "working" | "speaking" | "paused" | "failed";
export interface VoiceSession {
  messages: readonly EveMessage[];
  status: VoiceStatus;
  assistantAudioLevel: number | null;
  turnActive: boolean;
  muted: boolean;
  pauseReason: string | null;
  assistantTextStreaming: boolean;
  busyDetail: string | null;
  lastUserText: string | null;
  lastAssistantText: string | null;
  failed: boolean;
  recovering: boolean;
  speaking: boolean;
  handoffReady: boolean;
  start: () => void;
  end: () => void;
  retry: () => void;
  sendText: (message: string) => boolean;
  announceResult: (message: string) => void;
  toggleMute: () => void;
  pauseForMicrophoneOwner: (reason: string) => void;
  resume: () => void;
}
const REASONS: Record<string, string> = {
  "no-session": "Your session expired. Sign in again and we can talk.",
  walled: "Talking out loud comes with a paid plan.",
  "not-included": "Voice is not part of your plan yet.",
  "rate-limited": "We have talked a lot today. Let's pick this up tomorrow.",
  "not-configured": "My voice is not set up right now.",
};
interface Connection {
  stream?: MediaStream;
  conversation: LiveVoiceConversation;
  stop: () => Promise<void>;
  ready: boolean;
  send: (event: Record<string, unknown>) => void;
  working: boolean;
}

/** Native Live media stays on WebRTC. Shared protocol handling keeps exact
 * transcript source identities and delegates to the authenticated Homa agent. */
export function useVoiceSession(activeObject: ActiveObjectReference | null = null): VoiceSession {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [assistantAudioLevel, setAssistantAudioLevel] = useState<number | null>(null);
  const [turns, setTurns] = useState<LiveCaption[]>([]);
  const [toolEffects, setToolEffects] = useState<readonly VoiceToolEffect[]>([]);
  const activeObjectRef = useRef(activeObject);
  const connectionRef = useRef<Connection | null>(null);
  const logicalSessionRef = useRef<LiveVoiceConversation | null>(null);
  const changeStatus = useCallback((next: VoiceStatus) => { setStatus(next); }, []);
  useEffect(() => { activeObjectRef.current = activeObject; }, [activeObject]);

  const authenticatedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("no-session");
    return fetch(`${env.apiUrl.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...EVE_CHANNEL_HEADER, ...(init.headers ?? {}) },
    });
  }, []);

  const end = useCallback(() => {
    const current = connectionRef.current;
    connectionRef.current = null;
    void current?.stop();
    setMuted(false);
    setPauseReason(null);
    changeStatus("idle");
  }, [changeStatus]);

  const connect = useCallback((resume: boolean) => {
    if (connectionRef.current) return;
    if (!resume) { setTurns([]); setToolEffects([]); }
    setError(null);
    setPauseReason(null);
    setMuted(false);
    changeStatus("connecting");
    let cancelled = false;
    let peer: RTCPeerConnection | undefined;
    let stream: MediaStream | undefined;
    let channel: ReturnType<RTCPeerConnection["createDataChannel"]> | undefined;
    let handle: { sessionId: string; closeToken: string } | undefined;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let audioTimer: ReturnType<typeof setInterval> | undefined;
    let closeResolve: (() => void) | undefined;
    let stopping: Promise<void> | undefined;
    const diagnostics = new LiveSessionDiagnostics();
    const id = `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const conversation = resume && logicalSessionRef.current ? logicalSessionRef.current : new LiveVoiceConversation(id, {
      fetch: authenticatedFetch,
      send: (event) => connectionRef.current?.send(event),
      onCaption: (caption) => setTurns((current) => {
        const exists = current.some((row) => row.sessionId === caption.sessionId && row.sequence === caption.sequence);
        return exists ? current.map((row) => row.sessionId === caption.sessionId && row.sequence === caption.sequence ? caption : row) : [...current, caption];
      }),
      onEffects: (value) => {
        const output = parseVoiceToolBridgeOutput(value);
        if (output) setToolEffects((current) => appendUniqueVoiceToolEffects(current, output.effects));
      },
      onError: (message) => setError(message),
      onWorking: (value) => {
        const current = connectionRef.current;
        if (current) { current.working = value; if (current.ready) changeStatus(value ? "working" : "listening"); }
      },
      activeObject: () => activeObjectRef.current,
    });
    logicalSessionRef.current = conversation;
    if (resume) conversation.resume();
    const release = async () => {
      if (!handle) return;
      const current = handle;
      handle = undefined;
      try {
        const result = await authenticatedFetch("/api/voice/live/session", {
          method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current), signal: AbortSignal.timeout(12_000),
        });
        if (!result.ok) setError("Voice closed, but its final shutdown could not be confirmed.");
      } catch { setError("Voice closed, but its final shutdown could not be confirmed."); }
    };
    const connection: Connection = {
      conversation, ready: false, working: false,
      send: (event) => { if (!cancelled && channel?.readyState === "open") { channel.send(JSON.stringify(event)); diagnostics.sent(event); } },
      stop: () => {
        if (stopping) return stopping;
        cancelled = true;
        const finished = conversation.finish();
        stream?.getTracks().forEach((track) => track.stop());
        if (startTimer) clearTimeout(startTimer);
        if (audioTimer) clearInterval(audioTimer);
        stopping = (async () => {
          // Stop local playback immediately; keep data alive for final usage.
          peer?.getReceivers().forEach((receiver) => { if (receiver.track) receiver.track.enabled = false; });
          if (connection.ready && !diagnostics.snapshot().finalized && channel?.readyState === "open") {
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
          await finished;
        })();
        return stopping;
      },
    };
    connectionRef.current = connection;
    const fail = (message: string) => {
      if (cancelled) return;
      if (connectionRef.current === connection) connectionRef.current = null;
      setError(message);
      changeStatus("failed");
      void connection.stop();
    };
    void (async () => {
      try {
        await prepareVoiceAudioForConversation();
        if (cancelled) return;
        stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        connection.stream = stream;
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        peer = new RTCPeerConnection();
        stream.getTracks().forEach((track) => peer!.addTrack(track, stream!));
        channel = peer.createDataChannel("oai-events");
        channel.onclose = () => fail("Our voice connection ended. Please start a new conversation.");
        channel.onerror = () => fail("Our voice connection was interrupted. Please start a new conversation.");
        channel.onmessage = ({ data }: { data: string }) => {
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
              connection.ready = true;
              if (startTimer) clearTimeout(startTimer);
              changeStatus("listening");
            }
            conversation.receive(event);
            if (event.type === "error" && !connection.ready) fail("I could not complete the voice connection. Please try again.");
          } catch { /* Ignore malformed provider events. */ }
        };
        peer.onconnectionstatechange = () => {
          if (peer?.connectionState === "failed" || peer?.connectionState === "disconnected") fail("Something interrupted our connection. Please try again.");
        };
        const offer = await peer.createOffer({ offerToReceiveAudio: true });
        await peer.setLocalDescription(offer);
        await waitForLiveIce(() => peer?.iceGatheringState === "complete" || cancelled);
        if (cancelled) return;
        const response = await authenticatedFetch("/api/voice/live/session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdp: peer.localDescription?.sdp }), signal: AbortSignal.timeout(40_000),
        });
        const body = await response.json();
        if (!response.ok || typeof body.sdp !== "string" || typeof body.sessionId !== "string" || typeof body.closeToken !== "string") throw new Error(REASONS[body.reason] ?? "I could not connect our call just now.");
        handle = { sessionId: body.sessionId, closeToken: body.closeToken };
        if (cancelled) { await release(); return; }
        startTimer = setTimeout(() => fail("Voice took too long to connect. Please try again."), 20_000);
        await peer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: body.sdp }));
        if (cancelled) { peer.close(); return; }
        let polling = false;
        let previousEnergy: AudioEnergySample | null = null;
        audioTimer = setInterval(() => {
          if (polling || cancelled || !connection.ready) return;
          polling = true;
          void peer!.getStats().then((report) => {
            if (cancelled) return;
            const reading = readRemoteAudioLevel(report, previousEnergy);
            previousEnergy = reading.energy;
            if (reading.level === null) return;
            const visualLevel = visualVoiceLevel(reading.level);
            setAssistantAudioLevel((current) => smoothVoiceLevel(current ?? 0, visualLevel));
            changeStatus(visualLevel > 0 ? "speaking" : connection.working ? "working" : "listening");
          }).catch(() => {}).finally(() => { polling = false; });
        }, 80);
      } catch (cause) { fail(cause instanceof Error ? (REASONS[cause.message] ?? cause.message) : "I could not start listening just now."); }
    })();
  }, [authenticatedFetch, changeStatus]);

  const pause = useCallback((reason: string) => {
    if (!connectionRef.current) return;
    const current = connectionRef.current;
    connectionRef.current = null;
    void current.stop();
    setMuted(false);
    setPauseReason(reason);
    changeStatus("paused");
  }, [changeStatus]);
  const resume = useCallback(() => { connect(true); }, [connect]);
  const toggleMute = useCallback(() => {
    const stream = connectionRef.current?.stream;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }, [muted]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") pause("Voice paused while Homa is in the background. Tap resume when you are ready.");
    });
    return () => subscription.remove();
  }, [pause]);
  useEffect(() => end, [end]);
  const sendText = useCallback((message: string) => connectionRef.current?.ready ? connectionRef.current.conversation.sendText(message) : false, []);
  const announceResult = useCallback((message: string) => { if (connectionRef.current?.ready) connectionRef.current.conversation.say(message); }, []);
  const turnActive = ["connecting", "listening", "working", "speaking"].includes(status);
  return {
    messages: messagesFromVoiceToolEffects(toolEffects), status,
    assistantAudioLevel: status === "speaking" ? assistantAudioLevel : null,
    turnActive, muted, pauseReason, assistantTextStreaming: status === "speaking",
    busyDetail: error ?? (status === "connecting" ? "getting ready" : status === "working" ? "working on that" : null),
    lastUserText: turns.slice().reverse().find((row) => row.role === "user")?.text ?? null,
    lastAssistantText: turns.slice().reverse().find((row) => row.role === "assistant")?.text ?? null,
    failed: status === "failed", recovering: false, speaking: status === "speaking", handoffReady: status === "listening",
    start: () => connect(false), end, retry: () => connect(true), sendText, announceResult, toggleMute,
    pauseForMicrophoneOwner: (reason: string) => pause(reason), resume,
  };
}
