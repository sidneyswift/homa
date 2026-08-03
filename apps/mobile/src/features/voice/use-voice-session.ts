import type { ActiveObjectReference } from "@homa/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EveMessage } from "eve/react";
import { AppState, Linking } from "react-native";
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
} from "react-native-webrtc";

import { prepareVoiceAudioForConversation } from "../../../modules/homa-voice-audio";
import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  applyRealtimeTranscriptEvent,
  sourceTurnFromRealtimeEvent,
} from "./realtime-transcript";
import {
  appendUniqueVoiceToolEffects,
  messagesFromVoiceToolEffects,
  openingResponseCreateEvent,
  parseVoiceToolBridgeOutput,
  spokenReplyResponseCreateEvent,
  type VoiceHomaSessionState,
  type VoiceToolEffect,
} from "./realtime-tool-effects";
import {
  readRemoteAudioLevel,
  smoothVoiceLevel,
  visualVoiceLevel,
  type AudioEnergySample,
} from "./remote-audio-level";
import { settledTurns, type VoiceTurn } from "./voice-transcript";

/** The client secret is scoped and short lived. It is safe to use only for
 * the OpenAI WebRTC offer, never as a general OpenAI credential. */
interface RealtimeTokenResponse {
  token?: unknown;
  tools?: unknown;
  reason?: unknown;
}

type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "working"
  | "speaking"
  | "paused"
  | "failed";

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
  microphonePermissionNeeded: boolean;
  start: () => void;
  end: (options?: { persist?: boolean }) => void;
  retry: () => void;
  openMicrophoneSettings: () => Promise<void>;
  sendText: (message: string) => boolean;
  announceResult: (message: string) => void;
  toggleMute: () => void;
  pauseForMicrophoneOwner: (reason: string) => void;
  resume: () => void;
}

const REASONS: Record<string, string> = {
  "no-session": "Your session expired. Sign in again and we can talk.",
  "no-family": "I could not find your family account.",
  walled: "Talking out loud comes with a paid plan.",
  "not-included": "Voice is not part of your plan yet.",
  "rate-limited": "We have talked a lot today. Let's pick this up tomorrow.",
  "not-configured": "My voice is not set up right now.",
};

const VOICE_CONNECT_TIMEOUT_MS = 15_000;

function apiUrl(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

function sessionId(): string {
  return `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function lastText(turns: readonly VoiceTurn[], role: "user" | "assistant"): string | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role === role && turn.text.length > 0) return turn.text;
  }
  return null;
}

function awaitConnectionStep<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  onLateValue?: (value: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("voice-connect-timeout"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        if (settled) {
          onLateValue?.(value);
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      },
      (cause) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(cause);
      },
    );
  });
}

/**
 * Native gpt-realtime-2.1 session. WebRTC owns microphone capture and remote
 * audio playback. The data channel carries only model events and guarded tool
 * calls, while every transcript line is persisted through Homa's server.
 */
export function useVoiceSession(
  activeObject: ActiveObjectReference | null = null,
  ownerUserId: string | null = null,
): VoiceSession {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [assistantAudioLevel, setAssistantAudioLevel] = useState<number | null>(null);
  const [microphonePermissionNeeded, setMicrophonePermissionNeeded] = useState(false);
  const [turns, setTurns] = useState<readonly VoiceTurn[]>([]);
  const [toolEffects, setToolEffects] = useState<readonly VoiceToolEffect[]>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<RTCPeerConnection["createDataChannel"]> | null>(null);
  const turnsRef = useRef<readonly VoiceTurn[]>([]);
  const cursorRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const closedRef = useRef(false);
  const homaSessionStateRef = useRef<VoiceHomaSessionState | undefined>(undefined);
  const pendingTextRef = useRef<{ text: string; sequence: number } | null>(null);
  const activeObjectRef = useRef<ActiveObjectReference | null>(activeObject);
  const statusRef = useRef<VoiceStatus>(status);
  const connectingRef = useRef(false);
  const connectionAttemptRef = useRef(0);
  const connectAbortRef = useRef<AbortController | null>(null);
  const resumeOnForegroundRef = useRef(false);
  const openingResponseRequestedRef = useRef(false);

  useEffect(() => {
    activeObjectRef.current = activeObject;
  }, [activeObject]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== "speaking") return;

    const peer = peerRef.current;
    if (!peer) return;
    let cancelled = false;
    let polling = false;
    let previousEnergy: AudioEnergySample | null = null;

    const sample = async () => {
      if (cancelled || polling) return;
      polling = true;
      try {
        const report = await peer.getStats();
        if (cancelled) return;
        const reading = readRemoteAudioLevel(report, previousEnergy);
        previousEnergy = reading.energy;
        if (reading.level === null) return;
        const visualLevel = visualVoiceLevel(reading.level);
        setAssistantAudioLevel((current) =>
          smoothVoiceLevel(current ?? 0, visualLevel),
        );
      } catch {
        // Some WebRTC builds omit audio stats. The aura keeps its calm
        // speaking fallback instead of interrupting the conversation.
      } finally {
        polling = false;
      }
    };

    void sample();
    const interval = setInterval(() => void sample(), 80);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  const authenticatedFetch = useCallback(async (
    path: string,
    init: RequestInit = {},
    expectedUserId: string | null = null,
  ) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("no-session");
    if (expectedUserId && data.session?.user.id !== expectedUserId) {
      throw new Error("auth-user-changed");
    }
    return fetch(apiUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...EVE_CHANNEL_HEADER,
        ...(init.headers ?? {}),
      },
    });
  }, []);

  const persistSettledTurns = useCallback(
    (finished: boolean) => {
      const { cursor, lines } = settledTurns(turnsRef.current, cursorRef.current, finished);
      cursorRef.current = cursor;
      if (lines.length === 0 || !ownerUserId) return;
      sessionIdRef.current ??= sessionId();
      for (const { sequence, line } of lines) {
        void authenticatedFetch("/api/voice/realtime/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            sequence,
            role: line.role,
            content: line.text,
          }),
        }, ownerUserId).catch(() => {
          // The live audio conversation remains useful if one ledger write
          // is lost. The server records the failure without interrupting her.
        });
      }
    },
    [authenticatedFetch, ownerUserId],
  );

  const acceptEvent = useCallback(
    (event: unknown) => {
      const next = applyRealtimeTranscriptEvent(turnsRef.current, event);
      if (next !== turnsRef.current) {
        turnsRef.current = next;
        setTurns(next);
        persistSettledTurns(false);
      }
      pendingTextRef.current = sourceTurnFromRealtimeEvent(
        next,
        event,
        pendingTextRef.current,
      );
      if (typeof event !== "object" || event === null) return;
      const type = (event as { type?: unknown }).type;
      if (type === "output_audio_buffer.started") {
        setAssistantAudioLevel(null);
        setStatus("speaking");
      }
      if (type === "output_audio_buffer.stopped") setStatus("listening");
    },
    [persistSettledTurns],
  );

  const closeTransport = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
  }, []);

  const end = useCallback((options: { persist?: boolean } = {}) => {
    const shouldPersist = options.persist !== false;
    if (closedRef.current && statusRef.current === "idle" && shouldPersist) return;
    closedRef.current = true;
    resumeOnForegroundRef.current = false;
    connectionAttemptRef.current += 1;
    connectingRef.current = false;
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    if (shouldPersist) {
      persistSettledTurns(true);
    } else {
      cursorRef.current = 0;
      sessionIdRef.current = null;
      turnsRef.current = [];
      setTurns([]);
      setToolEffects([]);
      homaSessionStateRef.current = undefined;
      pendingTextRef.current = null;
      openingResponseRequestedRef.current = false;
      setAssistantAudioLevel(null);
    }
    closeTransport();
    setMuted(false);
    setPauseReason(null);
    setError(null);
    setStatus("idle");
  }, [closeTransport, persistSettledTurns]);

  const executeTool = useCallback(
    async (event: { name?: unknown; arguments?: unknown; call_id?: unknown }) => {
      const channel = channelRef.current;
      if (!channel || typeof event.name !== "string" || typeof event.call_id !== "string") return;
      let args: unknown = {};
      try {
        args = typeof event.arguments === "string" ? JSON.parse(event.arguments) : {};
      } catch {
        args = {};
      }
      setStatus("working");
      try {
        const pendingText = pendingTextRef.current;
        const response = await authenticatedFetch("/api/voice/realtime/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: event.name,
            args,
            sessionId: sessionIdRef.current ?? "voice",
            sourceText: pendingText?.text ?? null,
            sourceSequence: pendingText?.sequence ?? null,
            homaSessionState: homaSessionStateRef.current,
            activeObject: activeObjectRef.current,
          }),
        }, ownerUserId);
        const body = (await response.json().catch(() => null)) as
          | { output?: unknown }
          | null;
        const output = parseVoiceToolBridgeOutput(body?.output) ?? {
          ok: false,
          spokenReply: "That did not go through just now. Nothing changed.",
          effects: [],
        };
        setToolEffects((current) =>
          appendUniqueVoiceToolEffects(current, output.effects),
        );
        homaSessionStateRef.current = output.sessionState;
        pendingTextRef.current = null;
        channel.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: event.call_id,
              output: JSON.stringify(output),
            },
          }),
        );
        channel.send(JSON.stringify(spokenReplyResponseCreateEvent()));
      } catch {
        pendingTextRef.current = null;
        channel.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: event.call_id,
              output: JSON.stringify({
                ok: false,
                spokenReply: "That did not go through just now. Nothing changed.",
                effects: [],
              }),
            },
          }),
        );
        channel.send(JSON.stringify(spokenReplyResponseCreateEvent()));
      }
    },
    [authenticatedFetch, ownerUserId],
  );

  const connect = useCallback((preserveLogicalSession: boolean) => {
    if (connectingRef.current) return;
    if (["listening", "working", "speaking"].includes(statusRef.current)) return;
    connectingRef.current = true;
    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    closedRef.current = false;
    closeTransport();
    if (!preserveLogicalSession || !sessionIdRef.current) {
      cursorRef.current = 0;
      sessionIdRef.current = sessionId();
      turnsRef.current = [];
      setTurns([]);
      setToolEffects([]);
      homaSessionStateRef.current = undefined;
      pendingTextRef.current = null;
      openingResponseRequestedRef.current = false;
    }
    setError(null);
    setPauseReason(null);
    setMuted(false);
    setMicrophonePermissionNeeded(false);
    setStatus("connecting");

    const connectAbort = new AbortController();
    connectAbortRef.current = connectAbort;
    const connectTimeout = setTimeout(
      () => connectAbort.abort(),
      VOICE_CONNECT_TIMEOUT_MS,
    );

    const returnIfStaleOrThrowIfTimedOut = () => {
      if (closedRef.current || connectionAttemptRef.current !== attempt) return true;
      if (connectAbort.signal.aborted) {
        throw new Error("voice-connect-timeout");
      }
      return false;
    };

    void (async () => {
      try {
        const tokenResponse = await awaitConnectionStep(
          authenticatedFetch("/api/voice/realtime/token", {
            method: "POST",
            signal: connectAbort.signal,
          }, ownerUserId),
          connectAbort.signal,
        );
        const tokenBody = (await awaitConnectionStep(
          tokenResponse.json().catch(() => null),
          connectAbort.signal,
        )) as RealtimeTokenResponse | null;
        if (!tokenResponse.ok || typeof tokenBody?.token !== "string") {
          const reason = typeof tokenBody?.reason === "string" ? tokenBody.reason : "";
          throw new Error(REASONS[reason] ?? "I could not start listening just now.");
        }

        if (returnIfStaleOrThrowIfTimedOut()) return;
        await awaitConnectionStep(
          prepareVoiceAudioForConversation(),
          connectAbort.signal,
        );
        if (returnIfStaleOrThrowIfTimedOut()) return;
        const stream = await awaitConnectionStep(
          mediaDevices.getUserMedia({ audio: true, video: false }),
          connectAbort.signal,
          (lateStream) => lateStream.getTracks().forEach((track) => track.stop()),
        );
        if (closedRef.current || connectionAttemptRef.current !== attempt) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (connectAbort.signal.aborted) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error("voice-connect-timeout");
        }
        streamRef.current = stream;
        const peer = new RTCPeerConnection();
        peerRef.current = peer;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const channel = peer.createDataChannel("oai-events");
        channelRef.current = channel;
        channel.onopen = () => {
          if (connectionAttemptRef.current !== attempt || connectAbort.signal.aborted) return;
          channel.send(JSON.stringify({ type: "session.update", session: { tools: tokenBody.tools ?? [] } }));
          if (!openingResponseRequestedRef.current) {
            openingResponseRequestedRef.current = true;
            channel.send(JSON.stringify(openingResponseCreateEvent()));
          }
          setStatus("listening");
        };
        channel.onmessage = ({ data }: { data: string }) => {
          if (connectionAttemptRef.current !== attempt || connectAbort.signal.aborted) return;
          try {
            const event = JSON.parse(data as string) as { type?: string; name?: unknown; arguments?: unknown; call_id?: unknown };
            acceptEvent(event);
            if (event.type === "response.function_call_arguments.done") {
              void executeTool(event);
            }
          } catch {
            // A malformed model event cannot become a client crash.
          }
        };
        peer.onconnectionstatechange = () => {
          if (connectionAttemptRef.current !== attempt || connectAbort.signal.aborted) return;
          if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
            closeTransport();
            setError("Something interrupted us. Worth trying again.");
            setStatus("failed");
          }
        };
        const offer = await awaitConnectionStep(
          peer.createOffer({ offerToReceiveAudio: true }),
          connectAbort.signal,
        );
        if (returnIfStaleOrThrowIfTimedOut()) return;
        await awaitConnectionStep(
          peer.setLocalDescription(offer),
          connectAbort.signal,
        );
        if (returnIfStaleOrThrowIfTimedOut()) return;
        const answer = await awaitConnectionStep(
          fetch("https://api.openai.com/v1/realtime/calls", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenBody.token}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp ?? "",
            signal: connectAbort.signal,
          }),
          connectAbort.signal,
        );
        if (!answer.ok) throw new Error("I could not connect our call just now.");
        if (returnIfStaleOrThrowIfTimedOut()) return;
        const answerSdp = await awaitConnectionStep(
          answer.text(),
          connectAbort.signal,
        );
        if (returnIfStaleOrThrowIfTimedOut()) return;
        await awaitConnectionStep(
          peer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp })),
          connectAbort.signal,
        );
        if (returnIfStaleOrThrowIfTimedOut()) return;
      } catch (caught) {
        if (closedRef.current || connectionAttemptRef.current !== attempt) return;
        const rawMessage = caught instanceof Error ? caught.message : "";
        const message = connectAbort.signal.aborted
          ? "Voice took too long to connect. Try again, or use text chat."
          : /permission|denied|not allowed/iu.test(rawMessage)
            ? "Homa needs microphone permission. Allow it in Settings, then try again."
            : rawMessage || "I could not start listening just now.";
        setMicrophonePermissionNeeded(
          !connectAbort.signal.aborted && /permission|denied|not allowed/iu.test(rawMessage),
        );
        setError(message === "no-session" ? REASONS[message] : message);
        setStatus("failed");
        closeTransport();
      } finally {
        clearTimeout(connectTimeout);
        if (connectAbortRef.current === connectAbort) {
          connectAbortRef.current = null;
        }
        if (connectionAttemptRef.current === attempt) connectingRef.current = false;
      }
    })();
  }, [acceptEvent, authenticatedFetch, closeTransport, executeTool]);

  const start = useCallback(() => connect(false), [connect]);
  const retry = useCallback(() => connect(true), [connect]);
  const openMicrophoneSettings = useCallback(
    () => Linking.openSettings().then(() => undefined),
    [],
  );

  const pause = useCallback((reason: string, resumeOnForeground: boolean) => {
    if (!["connecting", "listening", "working", "speaking", "failed"].includes(statusRef.current)) return;
    resumeOnForegroundRef.current = resumeOnForeground;
    connectionAttemptRef.current += 1;
    connectingRef.current = false;
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    persistSettledTurns(true);
    closeTransport();
    setMuted(false);
    setError(null);
    setPauseReason(reason);
    setStatus("paused");
  }, [closeTransport, persistSettledTurns]);

  const pauseForMicrophoneOwner = useCallback((reason: string) => {
    pause(reason, false);
  }, [pause]);

  const resume = useCallback(() => {
    resumeOnForegroundRef.current = false;
    connect(true);
  }, [connect]);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !["listening", "working", "speaking"].includes(statusRef.current)) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }, [muted]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        if (["connecting", "listening", "working", "speaking"].includes(statusRef.current)) {
          pause("Voice paused while Homa is in the background.", true);
        }
        return;
      }
      if (resumeOnForegroundRef.current && statusRef.current === "paused") {
        resumeOnForegroundRef.current = false;
        connect(true);
      }
    });
    return () => subscription.remove();
  }, [connect, pause]);

  useEffect(() => end, [end]);

  const sendText = useCallback((message: string) => {
    const text = message.trim();
    const channel = channelRef.current;
    if (!channel || text.length === 0) return false;
    try {
      channel.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text }],
          },
        }),
      );
      channel.send(JSON.stringify({ type: "response.create" }));
      pendingTextRef.current = { text, sequence: turnsRef.current.length };
      setStatus("working");
      return true;
    } catch {
      return false;
    }
  }, []);

  const announceResult = useCallback((message: string) => {
    const text = message.trim();
    const channel = channelRef.current;
    if (!channel || text.length === 0) return;
    channel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: `Say exactly this sentence and nothing else: ${JSON.stringify(text)}`,
          tools: [],
          tool_choice: "none",
        },
      }),
    );
  }, []);

  const turnActive =
    status === "connecting" ||
    status === "listening" ||
    status === "working" ||
    status === "speaking";
  return {
    messages: messagesFromVoiceToolEffects(toolEffects),
    status,
    assistantAudioLevel: status === "speaking" ? assistantAudioLevel : null,
    turnActive,
    muted,
    pauseReason,
    assistantTextStreaming: status === "speaking",
    busyDetail:
      status === "connecting"
        ? "getting ready"
        : status === "working"
          ? "working on that"
          : error,
    lastUserText: lastText(turns, "user"),
    lastAssistantText: lastText(turns, "assistant"),
    failed: status === "failed",
    recovering: false,
    speaking: status === "speaking",
    handoffReady: status === "listening",
    microphonePermissionNeeded,
    start,
    end,
    retry,
    openMicrophoneSettings,
    sendText,
    announceResult,
    toggleMute,
    pauseForMicrophoneOwner,
    resume,
  };
}
