import type { EveMessage } from "eve/client";

import type { VoiceHomaBridgeOutput } from "../../lib/voice/homa-bridge";
import type { ArchivedMessage } from "./chat-storage";
import { parseQuestionCardPart } from "./question-card";

export interface VoiceEffectContext {
  sessionId: string;
  sourceSequence: number;
}

const PREFIX = "voice-effects:";

/** Web offers a report control beside the ongoing voice conversation. The
 * native report sheet is not open here, so this exact delivery effect needs
 * web-specific wording. Other outcomes keep the agent's authored reply. */
export function webVoiceOutputForDisplay(
  output: VoiceHomaBridgeOutput,
): VoiceHomaBridgeOutput {
  if (!output.ok) return output;
  const reportReady = output.effects.some((effect) => {
    if (effect.toolName !== "open_progress_report") return false;
    const receipt = effect.output as { opened?: unknown; childId?: unknown } | null;
    return receipt?.opened === true && typeof receipt.childId === "string" &&
      receipt.childId.length > 0;
  });
  return reportReady
    ? { ...output, spokenReply: "Your report is ready. Use Open report in our chat to see it." }
    : output;
}

export function voiceEffectMessageId(context: VoiceEffectContext): string {
  return `${PREFIX}${encodeURIComponent(context.sessionId)}:${context.sourceSequence}`;
}

export function isVoiceEffectMessage(message: EveMessage): boolean {
  return message.id.startsWith(PREFIX);
}

/** Reserve the result's position when real work begins. The chat owns this
 * entry so ending a microphone session cannot hide an in-flight request. */
export function appendVoiceWork(
  current: readonly ArchivedMessage[], context: VoiceEffectContext, at: number,
): ArchivedMessage[] {
  const id = voiceEffectMessageId(context);
  if (current.some((entry) => entry.message.id === id)) return [...current];
  return [...current, {
    at, message: { id, role: "assistant", parts: [] },
    sessionId: context.sessionId, channel: "web", modality: "voice",
  }];
}

/** A source turn's receipts stay together so the ordinary material renderer
 * can select the final visible revision. Replayed call ids are immutable. */
export function appendVoiceEffects(
  current: readonly ArchivedMessage[],
  output: VoiceHomaBridgeOutput,
  context: VoiceEffectContext,
  at: number,
): ArchivedMessage[] {
  const id = voiceEffectMessageId(context);
  const existing = current.find((entry) => entry.message.id === id);
  const parts = [...(existing?.message.parts ?? [])];
  const seen = new Set(parts.flatMap((part) =>
    part.type === "dynamic-tool" ? [part.toolCallId] : [],
  ));
  for (const effect of output.effects) {
    if (seen.has(effect.callId)) continue;
    seen.add(effect.callId);
    parts.push({
      type: "dynamic-tool",
      toolCallId: effect.callId,
      toolName: effect.toolName,
      state: "output-available",
      input: {},
      output: effect.output,
    });
  }
  if (parts.length === 0 && output.spokenReply.trim()) {
    parts.push({ type: "text", text: output.spokenReply });
  }
  if (parts.length === (existing?.message.parts.length ?? 0)) return [...current];
  const entry: ArchivedMessage = {
    at: existing?.at ?? at,
    message: { id, role: "assistant", parts },
    sessionId: context.sessionId,
    channel: "web",
    modality: "voice",
  };
  return existing
    ? current.map((item) => item.message.id === id ? entry : item)
    : [...current, entry];
}

/** Choice clicks belong to the originating Eve bridge session. Until the web
 * surface has that continuation transport, expose every question for a spoken
 * answer rather than giving a button the ordinary text session's callback. */
export function voiceEffectPresentation(message: EveMessage) {
  const questions = message.parts.flatMap((part) =>
    parseQuestionCardPart(part)?.questions ?? [],
  );
  return {
    questions,
    message: {
      ...message,
      parts: message.parts.filter((part) => parseQuestionCardPart(part) === null),
    },
  };
}
