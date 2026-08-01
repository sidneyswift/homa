import {
  Client,
  type HandleMessageStreamEvent,
  type SessionState,
} from "eve/client";

import {
  HOMA_MESSAGE_MODALITY_HEADER,
} from "../web-message-modality";
import { voiceBridgeAuthHeaders } from "./voice-bridge-auth";

/**
 * The realtime model owns audio and turn taking. The ordinary Eve agent owns
 * every family capability. This module is the one seam between them.
 *
 * A bridge turn enters the same authenticated mobile channel as text chat, so
 * fleet skills, dynamic instructions, tool validation, tenant re-scoping, and
 * billing gates stay in their existing homes. The bridge only projects the
 * terminal reply and real tool-result receipts back to the audio session.
 */

export const VOICE_BRIDGE_TIMEOUT_MS = 290_000;

export interface VoiceHomaEffect {
  callId: string;
  toolName: string;
  output: unknown;
}

export interface VoiceHomaBridgeOutput {
  ok: boolean;
  spokenReply: string;
  effects: VoiceHomaEffect[];
  sessionId?: string;
  sessionState?: SessionState;
}

interface VoiceHomaTurnResult {
  status: "completed" | "failed" | "waiting";
  message: string | undefined;
  events: HandleMessageStreamEvent[];
  sessionId: string;
  sessionState: SessionState;
}

export interface VoiceHomaTurnRunner {
  run(input: {
    host: string;
    accessToken: string;
    message: string;
    sourceMessageId: string;
    sessionState?: SessionState;
    signal: AbortSignal;
  }): Promise<VoiceHomaTurnResult>;
}

function defaultRunner(): VoiceHomaTurnRunner {
  return {
    async run(input) {
      const client = new Client({
        host: input.host,
        auth: { bearer: input.accessToken },
        headers: {
          "x-homa-channel": "mobile",
          [HOMA_MESSAGE_MODALITY_HEADER]: "voice",
          ...voiceBridgeAuthHeaders({
            accessToken: input.accessToken,
            message: input.message,
            messageId: input.sourceMessageId,
          }),
        },
        maxReconnectAttempts: 4,
        preserveCompletedSessions: true,
        redirect: "error",
      });
      const session = client.session(input.sessionState);
      const response = await session.send({
        message: input.message,
        signal: input.signal,
      });
      return { ...(await response.result()), sessionState: session.state };
    },
  };
}

/**
 * Project only authored tool results. Skill loads and subagent bookkeeping are
 * useful to Eve, but they are not parent-visible effects and must not become
 * native receipts.
 */
export function voiceHomaEffects(
  events: readonly HandleMessageStreamEvent[],
): VoiceHomaEffect[] {
  const effects: VoiceHomaEffect[] = [];
  for (const event of events) {
    if (event.type !== "action.result") continue;
    if (event.data.status !== "completed") continue;
    const result = event.data.result;
    if (result.kind !== "tool-result" || result.isError === true) continue;
    effects.push({
      callId: result.callId,
      toolName: result.toolName,
      output: result.output,
    });
  }
  return effects;
}

function fallbackReply(
  result: Pick<VoiceHomaTurnResult, "status">,
  effects: readonly VoiceHomaEffect[],
): string {
  if (result.status === "failed") {
    return "That did not go through just now. Nothing changed.";
  }
  if (result.status === "waiting") {
    return "I need one quick answer from you. It is on the screen.";
  }
  if (effects.some((effect) => effect.toolName === "ask_user_questions")) {
    return "I need one quick answer from you. It is on the screen.";
  }
  if (effects.length > 0) {
    return "Done. You can see it on the screen.";
  }
  return "I could not finish that just now.";
}

export async function askHomaFromVoice(
  input: {
    host: string;
    accessToken: string;
    message: string;
    sourceMessageId: string;
    sessionState?: SessionState;
  },
  runner: VoiceHomaTurnRunner = defaultRunner(),
): Promise<VoiceHomaBridgeOutput> {
  const message = input.message.trim().slice(0, 8_000);
  if (message.length === 0) {
    return {
      ok: false,
      spokenReply: "I missed that. Would you say it once more?",
      effects: [],
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_BRIDGE_TIMEOUT_MS);
  try {
    const result = await runner.run({
      host: input.host,
      accessToken: input.accessToken,
      message,
      sourceMessageId: input.sourceMessageId,
      sessionState: input.sessionState,
      signal: controller.signal,
    });
    const effects = voiceHomaEffects(result.events);
    const spokenReply = result.message?.trim() || fallbackReply(result, effects);
    return {
      ok: result.status !== "failed",
      spokenReply,
      effects,
      sessionId: result.sessionId,
      sessionState: result.sessionState,
    };
  } catch (error) {
    console.error(
      "voice Homa bridge failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      ok: false,
      spokenReply: "That did not go through just now. Nothing changed.",
      effects: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseVoiceHomaSessionState(value: unknown): SessionState | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    !Number.isInteger(candidate.streamIndex) ||
    (candidate.streamIndex as number) < 0
  ) {
    return undefined;
  }
  if (
    candidate.sessionId !== undefined &&
    (typeof candidate.sessionId !== "string" || candidate.sessionId.length > 200)
  ) {
    return undefined;
  }
  if (
    candidate.continuationToken !== undefined &&
    (typeof candidate.continuationToken !== "string" ||
      candidate.continuationToken.length > 8_000)
  ) {
    return undefined;
  }
  return {
    streamIndex: candidate.streamIndex as number,
    ...(typeof candidate.sessionId === "string"
      ? { sessionId: candidate.sessionId }
      : {}),
    ...(typeof candidate.continuationToken === "string"
      ? { continuationToken: candidate.continuationToken }
      : {}),
  };
}
