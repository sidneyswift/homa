import { generateObject } from "ai";
import { z } from "zod";

/**
 * Layer 1: Signal Classification.
 * Classifies conversation messages into signal types (bugs, feature
 * requests, confusion, delight, churn risk, knowledge gaps, repeated
 * asks). Uses a cheap model to keep costs low: this runs on every
 * conversation, so it must be lightweight.
 */

const SIGNAL_TYPES = [
  "bug",
  "feature_request",
  "confusion",
  "delight",
  "churn_risk",
  "knowledge_gap",
  "repeated_ask",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export interface ClassifiedSignal {
  signalType: SignalType;
  confidence: number;
  evidence: string;
  messageId?: string;
}

interface ConversationMessage {
  id?: string;
  role: string;
  content: string;
}

const signalSchema = z.object({
  signals: z.array(
    z.object({
      signalType: z.enum(SIGNAL_TYPES),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(500),
      messageIndex: z.number().int().min(0).optional(),
    }),
  ),
});

/**
 * Classify a conversation for signals. Returns an array of detected
 * signals with confidence scores and supporting evidence.
 */
export async function classifyConversation(
  sessionId: string,
  familyId: string,
  messages: ConversationMessage[],
): Promise<ClassifiedSignal[]> {
  if (messages.length === 0) return [];

  // Only classify conversations with user messages
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return [];

  // Build a compact transcript for classification
  const transcript = messages
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n");

  // Use a cheap model for classification to keep costs low.
  const classifyModel = process.env.HOMA_CLASSIFY_MODEL ?? "openai/gpt-5.6-terra";

  const { object } = await generateObject({
    model: classifyModel as Parameters<typeof generateObject>[0]["model"],
    schema: signalSchema,
    prompt: `Analyze this homeschool assistant conversation for signals. Be conservative: only flag signals with confidence >= 0.6.

Signal types:
- bug: User encountered a technical problem or error
- feature_request: User wants something the system does not do
- confusion: User is confused about how to use the system or what it said
- delight: User expresses genuine satisfaction or excitement
- churn_risk: User shows signs of disengagement or frustration
- knowledge_gap: The assistant could not answer or gave a weak answer on a topic
- repeated_ask: User is asking the same thing they asked before (repetition)

Conversation:
${transcript}

Return only signals with confidence >= 0.6. Each signal needs a short evidence quote from the conversation.`,
  });

  return object.signals.map((s) => ({
    signalType: s.signalType,
    confidence: s.confidence,
    evidence: s.evidence,
    messageId:
      s.messageIndex !== undefined ? messages[s.messageIndex]?.id : undefined,
  }));
}
