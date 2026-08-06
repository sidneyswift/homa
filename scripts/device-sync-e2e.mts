/**
 * Device sync end-to-end harness, run against the disposable sandbox:
 *
 *   pnpm eval:sandbox --exec pnpm tsx scripts/device-sync-e2e.mts
 *
 * The sandbox boots vanilla Postgres, replays every migration (including
 * 20260725150000_device_sync.sql), and sets HOMA_EVAL_DATABASE_URL so
 * mapDb() targets the throwaway cluster. This harness then exercises the
 * whole pipe in process: seed a fixture family, mint a device, ingest a
 * batch through the real store (valid, duplicate, malformed, oversized,
 * parked, unknown-child), drain through the real applier, and read the
 * pull delta, asserting on every outcome. Nothing here can reach
 * production: without the sandbox variable, mapDb() under isolation
 * refuses the pooler outright.
 */

import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";

if (!process.env.HOMA_EVAL_DATABASE_URL) {
  throw new Error(
    "device-sync-e2e requires HOMA_EVAL_DATABASE_URL from pnpm eval:sandbox",
  );
}

process.env.HOMA_DEVICE_SYNC_ENABLED = "true";

const { mapDb } = await import("../apps/web/lib/map/db");
const { ingestSyncEvents, resolveSyncDevice } = await import("../apps/web/lib/sync/store");
const { runSyncApplier } = await import("../apps/web/lib/sync/apply");
const { getSyncPullDelta } = await import("../apps/web/lib/sync/pull");

const sql = mapDb();

function envelope(kind: string, dedupeKey: string, payload: Record<string, unknown>) {
  return {
    kind,
    schemaVersion: 1,
    dedupeKey,
    producedAt: new Date().toISOString(),
    payload,
  };
}

async function main() {
  // 1. Fixture family + child + device (server-side seed, sandbox only).
  const [family] = await sql<{ id: string }[]>`
    insert into public.families (name, email, time_zone, sandbox)
    values ('Sync E2E family', 'sync-e2e@example.test', 'America/New_York', true)
    returning id
  `;
  const [child] = await sql<{ id: string }[]>`
    insert into public.children (family_id, name, birth_month)
    values (${family.id}, 'Testchild', '2022-11-01')
    returning id
  `;
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`
    insert into public.sync_devices (family_id, name, token_hash)
    values (${family.id}, 'e2e-mini', ${tokenHash})
  `;

  // 2. Token resolution: right token resolves, wrong token does not.
  const device = await resolveSyncDevice(token);
  assert.ok(device, "device token must resolve");
  assert.equal(device.familyId, family.id);
  assert.equal(await resolveSyncDevice("f".repeat(64)), null, "unknown token must not resolve");
  assert.equal(await resolveSyncDevice("not-hex"), null, "malformed token must not resolve");

  // 3. Ingest a mixed batch.
  const batch = [
    envelope("memory.what_works", "wk-1", {
      content: "Counting to 30 sticks best during car games on the way to co-op.",
      childName: "Testchild",
    }),
    envelope("memory.fact", "fact-1", {
      content: "Loves dinosaurs, currently obsessed with triceratops.",
      childName: "Testchild",
    }),
    envelope("child.profile_patch", "prof-1", {
      childName: "Testchild",
      interests: ["dinosaurs", "car games", "idk"],
      focus: "counting to 30",
    }),
    envelope("journal.day_summary", "2026-07-24", {
      childName: "Testchild",
      localDate: "2026-07-24",
      summary: "Practiced letters T and R with chalk outside; T is now solid.",
    }),
    envelope("benchmark.weekly_scores", "2026-W30", { scores: { counting: 3 } }),
    envelope("memory.fact", "unknown-child", {
      content: "This memory names a child who is not in the family.",
      childName: "Nobody",
    }),
    { kind: "memory.fact", dedupeKey: "malformed" },
    envelope("memory.fact", "oversized", {
      content: "x".repeat(400),
      childName: "Testchild",
    }),
  ];
  const ingest = await ingestSyncEvents(device, batch);
  assert.equal(ingest.received, 8);
  assert.equal(ingest.inserted, 6, "six valid envelopes insert");
  assert.equal(ingest.invalid, 2, "malformed and oversized reject individually");

  // 4. Replaying the same batch is free: all duplicates, nothing new.
  const replay = await ingestSyncEvents(device, batch);
  assert.equal(replay.inserted, 0);
  assert.equal(replay.duplicates, 6);

  // 5. Drain. Expect: 2 memories + 1 profile + 1 journal applied, the
  // benchmark parked, the unknown-child skipped.
  const drained = await runSyncApplier();
  assert.equal(drained.applied, 4, `applied 4, got ${JSON.stringify(drained)}`);
  assert.equal(drained.parked, 1);
  assert.equal(drained.skipped, 1);
  assert.equal(drained.errored, 0);

  // 6. Domain state landed through the gates.
  const memories = await sql<{ kind: string; content: string; session_id: string | null }[]>`
    select kind, content, session_id from public.family_memories
    where family_id = ${family.id} order by created_at asc
  `;
  assert.equal(memories.length, 3, "two memories plus the journal summary");
  assert.ok(memories.every((row) => row.session_id?.startsWith("mini-sync:")));
  const [profiled] = await sql<{ profile: Record<string, unknown> }[]>`
    select profile from public.children where id = ${child.id}
  `;
  assert.deepEqual(profiled.profile.interests, ["dinosaurs", "car games"], "non-answer filtered");
  assert.equal(profiled.profile.focus, "counting to 30");

  // 7. Draining again is a no-op (no pending rows left).
  const redrain = await runSyncApplier();
  assert.deepEqual(redrain, { applied: 0, skipped: 0, parked: 0, errored: 0, retrying: 0 });

  // 8. Journal collision: with progress evidence on the date, the
  // summary skips as cloud-captured.
  await sql`
    insert into public.child_progress_evidence
      (child_id, family_id, item_id, answer, source, idempotency_key, created_at)
    values
      (${child.id}, ${family.id}, 'CNT-1', 'easily', 'check_in', 'e2e-evidence-1', '2026-07-23T18:00:00Z')
  `;
  const collision = await ingestSyncEvents(device, [
    envelope("journal.day_summary", "2026-07-23", {
      childName: "Testchild",
      localDate: "2026-07-23",
      summary: "A second summary for a day the cloud already captured.",
    }),
  ]);
  assert.equal(collision.inserted, 1);
  const collisionDrain = await runSyncApplier();
  assert.equal(collisionDrain.skipped, 1, "cloud-captured day skips");

  // 9. Pull delta: memories, child profile, and cursors round-trip.
  const fullDelta = await getSyncPullDelta(family.id, { since: null });
  assert.equal(fullDelta.memories.length, 3);
  assert.equal(fullDelta.children.length, 1);
  const cursor = fullDelta.serverTime;
  const emptyDelta = await getSyncPullDelta(family.id, { since: cursor });
  assert.equal(emptyDelta.memories.length, 0, "cursor advances cleanly");

  // 10. Tenancy: a second family's delta never shows this family's rows.
  const [otherFamily] = await sql<{ id: string }[]>`
    insert into public.families (name, email, time_zone, sandbox)
    values ('Other family', 'other@example.test', 'America/New_York', true)
    returning id
  `;
  const otherDelta = await getSyncPullDelta(otherFamily.id, { since: null });
  assert.equal(otherDelta.memories.length, 0);
  assert.equal(otherDelta.children.length, 0);

  // 11. Revoked device stops resolving.
  await sql`update public.sync_devices set revoked_at = now() where token_hash = ${tokenHash}`;
  assert.equal(await resolveSyncDevice(token), null, "revoked token must not resolve");

  console.log("device-sync e2e: all assertions passed");
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error("device-sync e2e FAILED:", error);
  process.exit(1);
}
