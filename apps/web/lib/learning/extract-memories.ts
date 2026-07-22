import { readFileSync } from "node:fs";
import path from "node:path";

import { generateObject } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { MEMORY_ENTRY_MAX_CHARS } from "../agent-memory";
import { loadFamilyContextPinned, renderFamilyContext } from "../family-context";
import { gatewayAttribution, recordModelUsage } from "../model-usage";
import { saveFamilyMemory } from "./save-memory";

/**
 * The shared memory-extraction engine behind both learning loops
 * (agentic ladder items 3 and 8, 15-agentic-architecture.md): the model
 * reads a raw conversation and DECIDES what deserves remembering; this
 * module enforces the same guardrails the chat remember tool applies, so
 * background writes are never more powerful than foreground ones:
 *
 *   - injection scan on every entry (scanMemoryContent, M2-14 floor),
 *   - exact-content dedupe against existing rows,
 *   - a hard cap of entries per run (delta guard, M2-13 posture),
 *   - child attribution only by exact name match inside THIS family.
 *
 * Writes are auto-applied with a visible undo surface (/app memories
 * card), per founder decision 2026-07-09 (PRD FR-9 posture).
 */

export type ExtractionSource = "call" | "review";

export interface ExtractionOutcome {
  saved: { content: string; kind: "fact" | "what_works"; childName?: string }[];
  skipped: { content: string; reason: string }[];
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  model: string;
}

/** Delta guard: one conversation may add at most this many memories. */
export const MAX_MEMORIES_PER_EXTRACTION = 5;

/** Below this many transcript characters there is nothing to learn. */
export const MIN_TEXT_CHARS_FOR_EXTRACTION = 200;

const extractionSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z
          .string()
          .min(4)
          .max(MEMORY_ENTRY_MAX_CHARS)
          .describe("One compact self-contained sentence."),
        kind: z.enum(["fact", "what_works"]),
        childName: z
          .string()
          .max(60)
          .optional()
          .describe("Exactly one child's name from the family context, only when the fact is about that child."),
      }),
    )
    .max(MAX_MEMORIES_PER_EXTRACTION)
    .describe("Durable facts worth keeping. An empty array is a correct answer."),
});

let cachedPrompt: string | null = null;

/** agent/memory-extractor.md; cwd is apps/web under the Next server. */
function extractorPrompt(): string {
  if (cachedPrompt) return cachedPrompt;
  cachedPrompt = readFileSync(path.join(process.cwd(), "agent", "memory-extractor.md"), "utf8");
  return cachedPrompt;
}

/** Gateway model for background extraction; override with a cheaper id
 * once the model-mix experiments pick one (T2). */
export function extractionModel(): string {
  return process.env.HOMA_EXTRACTION_MODEL ?? HOMA_MODEL;
}

/**
 * Runs one extraction over raw conversation text and applies the guarded
 * writes. familyId always comes from the caller's own resolution (a
 * transcript row's phone mapping or a session's auth attributes), never
 * from model output.
 */
export async function extractMemoriesFromText(input: {
  familyId: string;
  source: ExtractionSource;
  text: string;
  conversationLabel: string;
  /** The reviewed session, when one exists (provenance stamp). */
  sessionId?: string | null;
}): Promise<ExtractionOutcome> {
  const model = extractionModel();
  const started = Date.now();

  const context = await loadFamilyContextPinned(input.familyId);

  const result = await generateObject({
    model,
    system: extractorPrompt(),
    prompt: [
      `The family context as Homa currently knows it (existing memories included; never duplicate them):`,
      renderFamilyContext(context),
      ``,
      `The conversation to review (${input.conversationLabel}):`,
      `<conversation>${input.text.slice(0, 24000)}</conversation>`,
    ].join("\n"),
    schema: extractionSchema,
    // Sonnet 5 thinks before answering and that reasoning is charged to
    // the SAME output budget: compaction, an easier task than this one,
    // was observed burning 2,414 thinking tokens against a 24,000 char
    // input. A cap of 1,500 could not survive that, and the failure mode
    // is nasty: generateObject throws, extractCallMemories un-claims the
    // row, and the next cron pass retries the same doomed call forever.
    // No family has hit it yet (15 of 15 transcripts extracted), so this
    // is the hazard closed before it fires, not an outage.
    maxOutputTokens: 8000,
    maxRetries: 2,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(input.familyId, "memory_extraction"),
      },
    },
  });

  await recordModelUsage({
    familyId: input.familyId,
    surface: "memory_extraction",
    model,
    modality: "text",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - started,
  });

  const outcome: ExtractionOutcome = {
    saved: [],
    skipped: [],
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
    durationMs: Date.now() - started,
    model,
  };

  for (const entry of result.object.memories) {
    const content = entry.content.trim();
    // The one guarded write path (save-memory.ts): scan, dedupe, budget
    // (background loops never evict; consolidation stays a foreground,
    // parent-visible move), and in-family child resolution.
    const saved = await saveFamilyMemory({
      familyId: input.familyId,
      content,
      kind: entry.kind,
      source: input.source,
      childName: entry.childName ?? null,
      sessionId: input.sessionId ?? null,
    });
    if (saved.saved) {
      outcome.saved.push({
        content,
        kind: entry.kind,
        ...(entry.childName ? { childName: entry.childName } : {}),
      });
    } else {
      outcome.skipped.push({ content, reason: saved.reason });
    }
  }

  return outcome;
}
