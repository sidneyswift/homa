import type { EveMessage } from "eve/react";

export interface VoiceToolEffect {
  callId: string;
  toolName: string;
  output: unknown;
}

export interface VoiceToolBridgeOutput {
  ok: boolean;
  spokenReply: string;
  effects: VoiceToolEffect[];
  sessionState?: VoiceHomaSessionState;
}

export interface VoiceHomaSessionState {
  streamIndex: number;
  sessionId?: string;
  continuationToken?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse the server boundary before tool results reach native UI state. */
export function parseVoiceToolBridgeOutput(
  value: unknown,
): VoiceToolBridgeOutput | null {
  if (!isRecord(value)) return null;
  if (typeof value.ok !== "boolean" || typeof value.spokenReply !== "string") {
    return null;
  }
  if (!Array.isArray(value.effects)) return null;
  const effects: VoiceToolEffect[] = [];
  for (const candidate of value.effects) {
    if (!isRecord(candidate)) return null;
    if (
      typeof candidate.callId !== "string" ||
      typeof candidate.toolName !== "string" ||
      candidate.callId.length === 0 ||
      candidate.toolName.length === 0
    ) {
      return null;
    }
    effects.push({
      callId: candidate.callId,
      toolName: candidate.toolName,
      output: candidate.output,
    });
  }
  let sessionState: VoiceHomaSessionState | undefined;
  if (value.sessionState !== undefined) {
    if (!isRecord(value.sessionState)) return null;
    if (
      !Number.isInteger(value.sessionState.streamIndex) ||
      (value.sessionState.streamIndex as number) < 0
    ) {
      return null;
    }
    if (
      value.sessionState.sessionId !== undefined &&
      typeof value.sessionState.sessionId !== "string"
    ) {
      return null;
    }
    if (
      value.sessionState.continuationToken !== undefined &&
      typeof value.sessionState.continuationToken !== "string"
    ) {
      return null;
    }
    sessionState = {
      streamIndex: value.sessionState.streamIndex as number,
      ...(typeof value.sessionState.sessionId === "string"
        ? { sessionId: value.sessionState.sessionId }
        : {}),
      ...(typeof value.sessionState.continuationToken === "string"
        ? { continuationToken: value.sessionState.continuationToken }
        : {}),
    };
  }
  return {
    ok: value.ok,
    spokenReply: value.spokenReply,
    effects,
    ...(sessionState ? { sessionState } : {}),
  };
}

/** Recreate the same dynamic-tool messages mobile chat receives from Eve. */
export function messagesFromVoiceToolEffects(
  effects: readonly VoiceToolEffect[],
): readonly EveMessage[] {
  return effects.map(
    (effect) =>
      ({
        id: `voice-tool:${effect.callId}`,
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolCallId: effect.callId,
            toolName: effect.toolName,
            state: "output-available",
            input: {},
            output: effect.output,
          },
        ],
      }) as EveMessage,
  );
}

export function appendUniqueVoiceToolEffects(
  current: readonly VoiceToolEffect[],
  incoming: readonly VoiceToolEffect[],
): readonly VoiceToolEffect[] {
  const seen = new Set(current.map((effect) => effect.callId));
  const additions = incoming.filter((effect) => !seen.has(effect.callId));
  return additions.length === 0 ? current : [...current, ...additions];
}

/** Ask the server-authored realtime persona to take the opening turn. */
export function openingResponseCreateEvent(): Record<string, unknown> {
  return { type: "response.create" };
}

/** One-response override after ask_homa. No second tool call is possible. */
export function spokenReplyResponseCreateEvent(): Record<string, unknown> {
  return {
    type: "response.create",
    response: {
      instructions:
        "The immediately preceding function output is final. Read only its spokenReply value, exactly once. Do not add, omit, summarize, explain, or paraphrase anything.",
      tools: [],
      tool_choice: "none",
    },
  };
}
