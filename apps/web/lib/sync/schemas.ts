import { z } from "zod";

/**
 * The device sync wire protocol, v1 (spec: mac-mini
 * operations/spec-vault-move-and-cloud-sync.md Part 2 v2).
 *
 * Envelope parsing is deliberately per-event: one malformed envelope
 * rejects that event alone, never the batch (the per-item rule belongs in
 * the validator, not the transport schema). The batch schema below only
 * bounds the outer shape.
 *
 * Applied kinds write through existing gate libraries; parked kinds land
 * as status='parked' rows with zero domain writes, so the plumbing can be
 * proven in production before any judgment about where their content
 * belongs (benchmark provenance and schedule creation are founder
 * decisions, not sync decisions).
 */

export const SYNC_SCHEMA_VERSION = 1;

export const APPLIED_SYNC_KINDS = [
  "memory.fact",
  "memory.what_works",
  "journal.day_summary",
  "child.profile_patch",
] as const;

export const PARKED_SYNC_KINDS = [
  "benchmark.weekly_scores",
  "schedule.proposal",
  "curriculum.note_upsert",
] as const;

export const SYNC_KINDS = [...APPLIED_SYNC_KINDS, ...PARKED_SYNC_KINDS] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

/** Matches the app-side memory cap (MEMORY_ENTRY_MAX_CHARS = 300); the
 * database check at 500 stays the backstop. */
export const SYNC_MEMORY_MAX_CHARS = 300;

export const syncMemoryPayload = z.object({
  content: z.string().min(4).max(SYNC_MEMORY_MAX_CHARS),
  childName: z.string().min(1).max(80).optional(),
});

export const syncJournalDaySummaryPayload = z.object({
  childName: z.string().min(1).max(80),
  /** Family-local date the summary describes, YYYY-MM-DD. */
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().min(4).max(SYNC_MEMORY_MAX_CHARS),
});

export const syncProfilePatchPayload = z.object({
  childName: z.string().min(1).max(80),
  /** Full replacement, same contract as update_child_profile. */
  interests: z.array(z.string().min(1).max(40)).max(8).optional(),
  focus: z.string().min(1).max(160).optional(),
});

const PAYLOAD_SCHEMAS: Record<SyncKind, z.ZodTypeAny> = {
  "memory.fact": syncMemoryPayload,
  "memory.what_works": syncMemoryPayload,
  "journal.day_summary": syncJournalDaySummaryPayload,
  "child.profile_patch": syncProfilePatchPayload,
  // Parked kinds are stored, never applied; shape stays loose on purpose
  // so the mini can evolve them without a cloud deploy. The 32KB payload
  // cap in the table is the backstop.
  "benchmark.weekly_scores": z.record(z.string(), z.unknown()),
  "schedule.proposal": z.record(z.string(), z.unknown()),
  "curriculum.note_upsert": z.record(z.string(), z.unknown()),
};

export const syncEnvelopeSchema = z.object({
  kind: z.enum(SYNC_KINDS),
  schemaVersion: z.number().int().min(1),
  dedupeKey: z.string().min(1).max(200),
  producedAt: z.iso.datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()),
});

export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;

export const syncBatchSchema = z.object({
  events: z.array(z.unknown()).min(1).max(200),
});

export type EnvelopeCheck =
  | { ok: true; envelope: SyncEnvelope }
  | { ok: false; reason: string };

/**
 * Validate one raw event: envelope shape, then the kind's payload schema.
 * A schemaVersion above ours is not an error, the applier skips it later;
 * an unknown kind or bad payload rejects here so junk never lands.
 */
export function checkSyncEnvelope(raw: unknown): EnvelopeCheck {
  const envelope = syncEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    return { ok: false, reason: `envelope: ${envelope.error.issues[0]?.message ?? "invalid"}` };
  }
  if (envelope.data.schemaVersion === SYNC_SCHEMA_VERSION) {
    const payload = PAYLOAD_SCHEMAS[envelope.data.kind].safeParse(envelope.data.payload);
    if (!payload.success) {
      return { ok: false, reason: `payload: ${payload.error.issues[0]?.message ?? "invalid"}` };
    }
  }
  return { ok: true, envelope: envelope.data };
}
