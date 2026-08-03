import { z } from "zod";

import type { PlannerLearningSourceChannel } from "./planner-learning-activities";

interface PlannerToolAttributes {
  canonicalInboundText?: unknown;
  canonicalInboundMessageId?: unknown;
  channel?: unknown;
  messageModality?: unknown;
}

export interface PlannerLearningToolContext {
  canonicalInboundText: string;
  sourceMessageId: string;
  sourceChannel: PlannerLearningSourceChannel;
}

function sourceChannel(attributes: PlannerToolAttributes): PlannerLearningSourceChannel {
  if (attributes.messageModality === "voice") return "voice";
  switch (attributes.channel) {
    case "web":
      return "web";
    case "mobile":
      return "mobile";
    case "sms":
      return "sms";
    case "email":
      return "email";
    case "dispatch":
      return "dispatch";
    case "agent-job":
      return "agent-job";
    default:
      return "other";
  }
}

/** Trusted inbound text and identity come from the channel adapter, never tool input. */
export function plannerLearningToolContext(
  rawAttributes: unknown,
): PlannerLearningToolContext | null {
  const attributes = (rawAttributes ?? {}) as PlannerToolAttributes;
  const messageId = z.string().uuid().safeParse(
    attributes.canonicalInboundMessageId,
  );
  if (
    !messageId.success
    || typeof attributes.canonicalInboundText !== "string"
    || attributes.canonicalInboundText.trim().length === 0
  ) {
    return null;
  }
  return {
    canonicalInboundText: Array.from(attributes.canonicalInboundText.trim())
      .slice(0, 8_000)
      .join(""),
    sourceMessageId: messageId.data,
    sourceChannel: sourceChannel(attributes),
  };
}
