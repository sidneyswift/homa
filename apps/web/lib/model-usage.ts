import { ACTION_COSTS } from "@homa/core";

import { mapDb } from "./map/db";

/**
 * The per-family AI consumption ledger (founder direction 2026-07-10:
 * track every Gateway call by family across modalities; MS-6 in
 * plans/2026-07-10-materials-studio-v2.md). One append-only row per
 * model call in public.model_usage (migration #43, deny-all RLS,
 * server-only writes through this module).
 *
 * Raw quantities only, never dollar amounts: prices drift, so the
 * future action_costs registry (08-billing-credits-design.md) joins
 * quantities to a price table at read time. Recording is fire-and
 * forget by law: telemetry never breaks the feature emitting it.
 *
 * Two capture layers, one table:
 *   1. agent/hooks/record-usage.ts catches eve's step.completed usage
 *      (chat turns on every channel, plus compaction).
 *   2. Every direct AI SDK call site records here itself and ALSO tags
 *      the Gateway request via gatewayAttribution() so Vercel's
 *      /v1/report can slice spend by surface. Family attribution stays
 *      only in Homa's deletable local ledger.
 */

export const USAGE_SURFACES = [
  "chat",
  "chat_suggestions",
  "morning_brief",
  "compaction",
  "materials_image",
  "materials_review",
  "media_caption",
  /** Re-reading an image already sent, on demand (gh#351). Separate
   *  from media_caption because a caption is one cheap sentence written
   *  once, and this is a full read a parent is waiting on. */
  "attachment_describe",
  "report_narrative",
  "plan_narrative",
  "curriculum",
  "memory_extraction",
  // Distinct from "compaction" above, which is eve compacting a long
  // conversation. This one merges a family's saved memories.
  "memory_compaction",
  // The judgment step that reads a parent's message for what it says
  // about her children (AGENTS.md "Models judge, code verifies").
  "progress_claim_extraction",
  // One read-only, evidence-grounded activity proposed for Progress.
  "progress_next_move",
  // The judgment step that proposes source-grounded metadata for one
  // family-owned Library original. Deterministic verification follows.
  "family_asset_ingestion",
  "embedding",
  "lesson_tone",
  "lesson_synthesis",
  ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface,
] as const;
export type UsageSurface = (typeof USAGE_SURFACES)[number];

export type UsageChannel =
  | "web"
  | "sms"
  | "email"
  | "dispatch"
  | "mobile"
  | "subject_lesson";

export interface ModelUsageRow {
  familyId: string | null;
  surface: UsageSurface;
  channel?: UsageChannel | null;
  model: string;
  modality: "text" | "image" | "embedding";
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheWriteTokens?: number | null;
  imagesCount?: number | null;
  imageSize?: string | null;
  durationMs?: number | null;
  sessionId?: string | null;
  turnId?: string | null;
  providerMetadata?: unknown;
}

function nonNegativeOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

/** Fire-and-forget insert; callers never await failure into their path. */
export async function recordModelUsage(row: ModelUsageRow): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      insert into public.model_usage
        (family_id, surface, channel, model, modality,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         images_count, image_size, duration_ms, session_id, turn_id,
         provider_metadata)
      values
        (${row.familyId}, ${row.surface}, ${row.channel ?? null}, ${row.model},
         ${row.modality},
         ${nonNegativeOrNull(row.inputTokens)}, ${nonNegativeOrNull(row.outputTokens)},
         ${nonNegativeOrNull(row.cacheReadTokens)}, ${nonNegativeOrNull(row.cacheWriteTokens)},
         ${nonNegativeOrNull(row.imagesCount)}, ${row.imageSize ?? null},
         ${nonNegativeOrNull(row.durationMs)}, ${row.sessionId ?? null},
         ${row.turnId ?? null},
         ${row.providerMetadata ? sql.json(row.providerMetadata as never) : null})
    `;
  } catch (error) {
    console.error(
      "recordModelUsage failed (feature unaffected):",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

/**
 * Gateway-side attribution for a direct AI SDK call. Only the product
 * surface leaves Homa. The family identifier stays in model_usage, where
 * account deletion can remove it instead of copying it into a provider's
 * reporting system without a per-user erase API.
 */
export function gatewayAttribution(
  _familyId: string | null,
  surface: UsageSurface,
): { tags: string[] } {
  return { tags: [surface] };
}

/** Session-auth attributes -> the ledger's channel value. */
export function usageChannelFromAttributes(
  attributes: unknown,
): Exclude<UsageChannel, "mobile"> {
  const channel = (attributes as { channel?: string } | undefined)?.channel;
  return channel === "sms"
    || channel === "email"
    || channel === "dispatch"
    || channel === "subject_lesson"
    ? channel
    : "web";
}

/** Model usage can distinguish native traffic without widening effect tables. */
export function modelUsageChannelFromAttributes(
  attributes: unknown,
): UsageChannel {
  const channel = (attributes as { channel?: string } | undefined)?.channel;
  return channel === "mobile" || channel === "progress_next_move"
    ? "mobile"
    : usageChannelFromAttributes(attributes);
}

/** Authenticated task-kind and internal-channel attribution for Eve model calls. */
export function usageSurfaceFromAttributes(attributes: unknown): UsageSurface {
  const candidate = attributes as
    | {
        channel?: unknown;
        modelUsageSurface?: unknown;
        familyId?: string;
        taskKind?: string;
        taskRunId?: string;
        deliveryVersion?: string;
      }
    | undefined;
  if (
    candidate?.channel === "progress_next_move" &&
    candidate.modelUsageSurface === "progress_next_move"
  ) {
    return "progress_next_move";
  }
  if (
    candidate?.channel === "subject_lesson"
    && candidate.modelUsageSurface
      === ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface
  ) {
    return ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface;
  }
  if (
    candidate?.channel === "dispatch" &&
    candidate.taskKind === "morning_brief" &&
    candidate.deliveryVersion === "research_brief_v2" &&
    typeof candidate.familyId === "string" &&
    candidate.familyId.length > 0 &&
    typeof candidate.taskRunId === "string" &&
    candidate.taskRunId.length > 0
  ) {
    return "morning_brief";
  }
  return "chat";
}
