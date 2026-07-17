import { z } from "zod";

export const PROMPT_SUGGESTION_MIN_CHARS = 4;
export const PROMPT_SUGGESTION_MAX_CHARS = 20;
export const PROMPT_SUGGESTION_MAX_COUNT = 2;
export const PROMPT_SUGGESTION_FALLBACK = "What should we try?";
export const PROMPT_SUGGESTIONS_PROMPT_VERSION = "2026.07.15.1";
export const PROMPT_SUGGESTION_ASSISTANT_FINGERPRINT_VERSION = "v1";

const FNV_1A_OFFSET_BASIS = 0x811c9dc5;
const FNV_1A_PRIME = 0x01000193;

function normalizePromptSuggestionAssistantText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .trim();
}

/**
 * Content-free cross-projection correlation for one visible assistant reply.
 * This compact hash is deterministic, not a security or integrity primitive.
 */
export function createPromptSuggestionAssistantFingerprint(
  assistantText: string,
): string {
  const bytes = new TextEncoder().encode(
    normalizePromptSuggestionAssistantText(assistantText),
  );
  let hash = FNV_1A_OFFSET_BASIS;
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, FNV_1A_PRIME) >>> 0;
  }
  return `${PROMPT_SUGGESTION_ASSISTANT_FINGERPRINT_VERSION}:${hash
    .toString(16)
    .padStart(8, "0")}`;
}

export const promptSuggestionAssistantFingerprintSchema = z
  .string()
  .regex(/^v1:[0-9a-f]{8}$/u);

export const promptSuggestionTextSchema = z
  .string()
  .trim()
  .min(PROMPT_SUGGESTION_MIN_CHARS)
  .max(PROMPT_SUGGESTION_MAX_CHARS)
  .refine((value) => !value.includes("\u2014"), "em dash is not allowed");

export const promptSuggestionListSchema = z
  .array(promptSuggestionTextSchema)
  .min(1)
  .max(PROMPT_SUGGESTION_MAX_COUNT)
  .refine(
    (values) =>
      new Set(values.map((value) => value.toLocaleLowerCase("en-US"))).size
      === values.length,
    "suggestions must be distinct",
  );

export const promptSuggestionRequestSchema = z
  .object({
    assistantMessageId: z.string().trim().min(1).max(160),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().trim().min(1).max(6_000),
          })
          .strict(),
      )
      .min(2)
      .max(6),
  })
  .strict()
  .refine(
    (value) => value.messages.at(-1)?.role === "assistant",
    "last transcript message must be the assistant reply",
  );

export type PromptSuggestionRequest = z.infer<
  typeof promptSuggestionRequestSchema
>;

export const promptSuggestionSetSchema = z
  .object({
    setId: z.uuid(),
    assistantMessageId: z.string().trim().min(1).max(160),
    assistantMessageFingerprint: promptSuggestionAssistantFingerprintSchema,
    promptVersion: z.string().trim().min(1).max(40),
    source: z.enum(["model", "fallback"]),
    suggestions: promptSuggestionListSchema,
  })
  .strict();

export type PromptSuggestionSet = z.infer<
  typeof promptSuggestionSetSchema
>;

export function parsePromptSuggestionSet(
  value: unknown,
): PromptSuggestionSet | null {
  const parsed = promptSuggestionSetSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function createFallbackPromptSuggestionSet(
  assistantMessageId: string,
  assistantText: string,
): PromptSuggestionSet {
  return {
    setId: crypto.randomUUID(),
    assistantMessageId,
    assistantMessageFingerprint:
      createPromptSuggestionAssistantFingerprint(assistantText),
    promptVersion: PROMPT_SUGGESTIONS_PROMPT_VERSION,
    source: "fallback",
    suggestions: [PROMPT_SUGGESTION_FALLBACK],
  };
}
