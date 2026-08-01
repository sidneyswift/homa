import { useCallback, useEffect, useRef, useState } from "react";
import type { EveMessage } from "eve/react";
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
} from "react-native-webrtc";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  applyRealtimeTranscriptEvent,
  sourceTurnFromRealtimeEvent,
} from "./realtime-transcript";
import {
  appendUniqueVoiceToolEffects,
  messagesFromVoiceToolEffects,
  parseVoiceToolBridgeOutput,
  spokenReplyResponseCreateEvent,
  type VoiceHomaSessionState,
  type VoiceToolEffect,
} from "./realtime-tool-effects";
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
  | "failed";

export interface VoiceSession {
  messages: readonly EveMessage[];
  turnActive: boolean;
  assistantTextStreaming: boolean;
  busyDetail: string | null;
  lastUserText: string | null;
  lastAssistantText: string | null;
  failed: boolean;
  recovering: boolean;
  start: () => void;
  end: () => void;
  retry: () => void;
  sendText: (message: string) => void;
}

const REASONS: Record<string, string> = {
  "no-session": "Your session expired. Sign in again and we can talk.",
  "no-family": "I could not find your family account.",
  walled: "Talking out loud comes with a paid plan.",
  "not-included": "Voice is not part of your plan yet.",
  "rate-limited": "We have talked a lot today. Let's pick this up tomorrow.",
  "not-configured": "My voice is not set up right now.",
};

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

/**
 * Native gpt-realtime-2.1 session. WebRTC owns microphone capture and remote
 * audio playback. The data channel carries only model events and guarded tool
 * calls, while every transcript line is persisted through Homa's server.
 */
export function useVoiceSession(): VoiceSession {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
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

  const authenticatedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("no-session");
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
      if (lines.length === 0) return;
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
        }).catch(() => {
          // The live audio conversation remains useful if one ledger write
          // is lost. The server records the failure without interrupting her.
        });
      }
    },
    [authenticatedFetch],
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
      if (type === "output_audio_buffer.started") setStatus("speaking");
      if (type === "output_audio_buffer.stopped") setStatus("listening");
    },
    [persistSettledTurns],
  );

  const end = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    persistSettledTurns(true);
    channelRef.current?.close();
    channelRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    setStatus("idle");
  }, [persistSettledTurns]);

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
          }),
        });
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
    [authenticatedFetch],
  );

  const start = useCallback(() => {
    if (
      status === "connecting" ||
      status === "listening" ||
      status === "working" ||
      status === "speaking"
    ) return;
    closedRef.current = false;
    cursorRef.current = 0;
    sessionIdRef.current = sessionId();
    turnsRef.current = [];
    setTurns([]);
    setToolEffects([]);
    homaSessionStateRef.current = undefined;
    pendingTextRef.current = null;
    setError(null);
    setStatus("connecting");

    void (async () => {
      try {
        const tokenResponse = await authenticatedFetch("/api/voice/realtime/token", {
          method: "POST",
        });
        const tokenBody = (await tokenResponse.json().catch(() => null)) as RealtimeTokenResponse | null;
        if (!tokenResponse.ok || typeof tokenBody?.token !== "string") {
          const reason = typeof tokenBody?.reason === "string" ? tokenBody.reason : "";
          throw new Error(REASONS[reason] ?? "I could not start listening just now.");
        }

        const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        if (closedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const peer = new RTCPeerConnection();
        peerRef.current = peer;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const channel = peer.createDataChannel("oai-events");
        channelRef.current = channel;
        channel.onopen = () => {
          channel.send(JSON.stringify({ type: "session.update", session: { tools: tokenBody.tools ?? [] } }));
          setStatus("listening");
        };
        channel.onmessage = ({ data }: { data: string }) => {
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
          if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
            setError("Something interrupted us. Worth trying again.");
            setStatus("failed");
          }
        };
        const offer = await peer.createOffer({ offerToReceiveAudio: true });
        await peer.setLocalDescription(offer);
        const answer = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenBody.token}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp ?? "",
        });
        if (!answer.ok) throw new Error("I could not connect our call just now.");
        await peer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: await answer.text() }));
      } catch (caught) {
        if (closedRef.current) return;
        const message = caught instanceof Error ? caught.message : "I could not start listening just now.";
        setError(message === "no-session" ? REASONS[message] : message);
        setStatus("failed");
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        peerRef.current?.close();
        peerRef.current = null;
      }
    })();
  }, [acceptEvent, authenticatedFetch, executeTool, status]);

  useEffect(() => end, [end]);

  const sendText = useCallback((message: string) => {
    const text = message.trim();
    const channel = channelRef.current;
    if (!channel || text.length === 0) return;
    pendingTextRef.current = { text, sequence: turnsRef.current.length };
    setStatus("working");
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
  }, []);

  const turnActive =
    status === "connecting" ||
    status === "listening" ||
    status === "working" ||
    status === "speaking";
  return {
    messages: messagesFromVoiceToolEffects(toolEffects),
    turnActive,
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
    start,
    end,
    retry: start,
    sendText,
  };
}
