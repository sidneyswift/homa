import { embed } from "ai";

import { gatewayAttribution, recordModelUsage } from "../model-usage";

/**
 * Best-effort embeddings for the archive (migration #38). One rule
 * everywhere: an embedding is an ENHANCEMENT, never a dependency. Every
 * caller tolerates null (row stays findable by FTS), no write path ever
 * fails because the embedding model was unavailable, and the vector is
 * passed to Postgres as pgvector's string literal form.
 *
 * Usage ledger (MS-6): each successful embed records a model_usage row
 * and tags the Gateway request; callers pass the family when they have
 * one so per-family totals include the archive's upkeep.
 */

const EMBEDDING_DIMS = 1536;
const EMBED_MAX_CHARS = 8000;

/** Gateway-routed embedding model; override for model-mix experiments. */
export function embeddingModelId(): string {
  return process.env.HOMA_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
}

/** Returns the pgvector literal ('[0.1,0.2,...]') or null on any failure. */
export async function embedText(
  text: string,
  attribution?: { familyId: string | null; signal?: AbortSignal },
): Promise<string | null> {
  const value = text.trim().slice(0, EMBED_MAX_CHARS);
  if (value.length < 3) return null;
  const familyId = attribution?.familyId ?? null;
  const model = embeddingModelId();
  const started = Date.now();
  try {
    const result = await embed({
      model,
      value,
      maxRetries: 1,
      abortSignal: attribution?.signal
        ? AbortSignal.any([attribution.signal, AbortSignal.timeout(20_000)]) : undefined,
      providerOptions: {
        gateway: gatewayAttribution(familyId, "embedding"),
      },
    });
    const vector = result.embedding;
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMS) return null;

    await recordModelUsage({
      familyId,
      surface: "embedding",
      model,
      modality: "embedding",
      inputTokens: result.usage.tokens,
      durationMs: Date.now() - started,
    });

    return `[${vector.join(",")}]`;
  } catch (error) {
    console.error(
      "embedText failed (row stays FTS-only):",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
