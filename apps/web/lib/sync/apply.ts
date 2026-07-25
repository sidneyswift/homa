import { scanMemoryContent } from "../agent-memory";
import { updateChildProfilePinned } from "../agent-pinned";
import { saveFamilyMemory } from "../learning/save-memory";
import { emitMapEvent } from "../map/events";
import { mapDb } from "../map/db";
import { isProfileNonAnswer } from "../profile-quality";
import {
  syncJournalDaySummaryPayload,
  syncMemoryPayload,
  syncProfilePatchPayload,
  SYNC_SCHEMA_VERSION,
  type SyncKind,
  APPLIED_SYNC_KINDS,
  PARKED_SYNC_KINDS,
} from "./schemas";
import {
  drainSyncEvents,
  type PendingSyncEvent,
  type SyncEventOutcome,
} from "./store";

/**
 * The device sync applier: drains pending mailbox rows into domain state
 * through the existing gate libraries, never raw table writes. Handlers
 * are idempotent (saveFamilyMemory dedupes exact content; profile patch
 * converges on replay), so at-least-once delivery yields effectively-once
 * outcomes. Unknown kinds and future schema versions skip, never throw: a
 * newer mini can never wedge an older cloud.
 */

const APPLIED = new Set<string>(APPLIED_SYNC_KINDS);
const PARKED = new Set<string>(PARKED_SYNC_KINDS);

/** Provenance stamp for the founder deep view: which sync event taught
 * this row. Rides family_memories.session_id. */
function syncSessionId(event: PendingSyncEvent): string {
  return `mini-sync:${event.id}`;
}

async function applyMemory(
  event: PendingSyncEvent,
  kind: "fact" | "what_works",
): Promise<SyncEventOutcome> {
  const payload = syncMemoryPayload.safeParse(event.payload);
  if (!payload.success) return { status: "skipped", reason: "payload-invalid" };

  const result = await saveFamilyMemory({
    familyId: event.familyId,
    content: payload.data.content,
    kind,
    source: "homa",
    childName: payload.data.childName ?? null,
    sessionId: syncSessionId(event),
  });
  if (result.saved) return { status: "applied" };
  // Every save refusal is terminal for this event: the same input will
  // refuse again tomorrow, so retrying is noise.
  return { status: "skipped", reason: result.reason };
}

async function applyJournalDaySummary(event: PendingSyncEvent): Promise<SyncEventOutcome> {
  const payload = syncJournalDaySummaryPayload.safeParse(event.payload);
  if (!payload.success) return { status: "skipped", reason: "payload-invalid" };

  // Collision rule (spec v2.5): cloud-captured wins, device fills gaps.
  // If the cloud already holds progress evidence for this child on this
  // family-local date, the day was captured on the cloud side (check-in,
  // lesson listen, conversation) and the mini's summary stays home.
  const sql = mapDb();
  const captured = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from public.child_progress_evidence evidence
      join public.children child
        on child.id = evidence.child_id and child.family_id = evidence.family_id
      join public.families family on family.id = child.family_id
      where evidence.family_id = ${event.familyId}
        and lower(child.name) = lower(${payload.data.childName})
        and (evidence.created_at at time zone coalesce(family.time_zone, 'America/New_York'))::date
              = ${payload.data.localDate}::date
    ) as exists
  `;
  if (captured[0]?.exists) {
    return { status: "skipped", reason: "cloud-captured" };
  }

  const result = await saveFamilyMemory({
    familyId: event.familyId,
    content: payload.data.summary,
    kind: "what_works",
    source: "homa",
    childName: payload.data.childName,
    sessionId: syncSessionId(event),
  });
  if (result.saved) return { status: "applied" };
  return { status: "skipped", reason: result.reason };
}

async function applyProfilePatch(event: PendingSyncEvent): Promise<SyncEventOutcome> {
  const payload = syncProfilePatchPayload.safeParse(event.payload);
  if (!payload.success) return { status: "skipped", reason: "payload-invalid" };
  if (payload.data.interests === undefined && payload.data.focus === undefined) {
    return { status: "skipped", reason: "empty-patch" };
  }

  // The pinned lib does not scan or quality-filter (the chat tool does);
  // this path applies the same floor before calling it.
  const interests = payload.data.interests?.filter(
    (interest) => !isProfileNonAnswer(interest) && scanMemoryContent(interest) === null,
  );
  const focus =
    payload.data.focus !== undefined &&
    !isProfileNonAnswer(payload.data.focus) &&
    scanMemoryContent(payload.data.focus) === null
      ? payload.data.focus
      : undefined;
  if ((interests === undefined || interests.length === 0) && focus === undefined) {
    return { status: "skipped", reason: "blocked-by-scan" };
  }

  const sql = mapDb();
  const children = await sql<{ id: string; name: string }[]>`
    select id, name from public.children where family_id = ${event.familyId}
  `;
  const wanted = payload.data.childName.trim().toLowerCase();
  const child = children.find((row) => row.name.trim().toLowerCase() === wanted);
  if (!child) return { status: "skipped", reason: "unknown-child" };

  const result = await updateChildProfilePinned({
    familyId: event.familyId,
    childId: child.id,
    ...(interests !== undefined && interests.length > 0 ? { interests } : {}),
    ...(focus !== undefined ? { focus } : {}),
  });
  if (!result.updated) return { status: "skipped", reason: "unknown-child" };
  return { status: "applied" };
}

async function handleSyncEvent(event: PendingSyncEvent): Promise<SyncEventOutcome> {
  if (event.schemaVersion > SYNC_SCHEMA_VERSION) {
    return { status: "skipped", reason: "schema-version-ahead" };
  }
  if (PARKED.has(event.kind)) return { status: "parked" };
  if (!APPLIED.has(event.kind)) return { status: "skipped", reason: "unknown-kind" };

  const kind = event.kind as SyncKind;
  if (kind === "memory.fact") return applyMemory(event, "fact");
  if (kind === "memory.what_works") return applyMemory(event, "what_works");
  if (kind === "journal.day_summary") return applyJournalDaySummary(event);
  if (kind === "child.profile_patch") return applyProfilePatch(event);
  return { status: "skipped", reason: "unknown-kind" };
}

export interface SyncDrainSummary {
  applied: number;
  skipped: number;
  parked: number;
  errored: number;
  retrying: number;
}

/** One applier pass. Called by the sync cron; safe to call concurrently
 * (row claims use for update skip locked). */
export async function runSyncApplier(limit = 100): Promise<SyncDrainSummary> {
  const outcomes: { familyId: string; kind: string; status: string; reason?: string }[] = [];
  const counts = await drainSyncEvents(async (event) => {
    const outcome = await handleSyncEvent(event);
    outcomes.push({
      familyId: event.familyId,
      kind: event.kind,
      status: outcome.status,
      ...(outcome.status === "skipped" ? { reason: outcome.reason } : {}),
    });
    return outcome;
  }, limit);

  // Typed telemetry after the claim transaction commits; best-effort by
  // law, and props carry kinds and counts, never content.
  for (const outcome of outcomes) {
    if (outcome.status === "applied") {
      await emitMapEvent("mini_sync.event_applied", {
        family_id: outcome.familyId,
        kind: outcome.kind,
      });
    } else if (outcome.status === "skipped") {
      await emitMapEvent("mini_sync.event_rejected", {
        family_id: outcome.familyId,
        kind: outcome.kind,
        reason: outcome.reason ?? "unknown",
      });
    }
  }
  return counts;
}
