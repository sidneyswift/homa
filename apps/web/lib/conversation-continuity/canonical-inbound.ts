import { z } from "zod";

const canonicalMessageIdSchema = z.string().uuid();
const CANONICAL_INBOUND_MAX_CHARS = 8_000;

/**
 * Produces the only inbound text and message identity exposed to tools.
 */
export function canonicalInboundAuthAttributes(input: {
  text: string;
  messageId: string;
}): {
  canonicalInboundText: string;
  canonicalInboundMessageId: string;
} {
  const parsedMessageId = canonicalMessageIdSchema.safeParse(
    input.messageId,
  );
  if (!parsedMessageId.success) {
    throw new TypeError("Canonical inbound message id must be a UUID");
  }
  return {
    canonicalInboundText: Array.from(input.text.trim())
      .slice(0, CANONICAL_INBOUND_MAX_CHARS)
      .join(""),
    canonicalInboundMessageId: parsedMessageId.data,
  };
}
