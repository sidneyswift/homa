import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { ProgressNextMove } from "@homa/core";
import postgres from "postgres";

import { EVAL_FIXTURE_FAMILY_ID } from "../apps/web/lib/family-context-eval-fixture";
import { mapDb } from "../apps/web/lib/map/db";
import {
  claimProgressNextMove,
  completeProgressNextMove,
  dismissProgressNextMove,
  failProgressNextMove,
  loadStoredProgressNextMove,
  reserveProgressNextMoveStart,
  setProgressNextMoveRuntimeSession,
} from "../apps/web/lib/child-progress/next-move-store";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2 });
const fingerprintA = "a".repeat(64);
const fingerprintB = "b".repeat(64);
const fingerprintC = "c".repeat(64);

function move(childId: string, evidenceId: string): ProgressNextMove {
  return {
    kind: "move",
    childId,
    sourceRevision: "11",
    targetItemId: "literacy.reads-short-early-reader",
    targetStatement: "Reads a short early reader",
    minutes: 10,
    activity:
      "Read one familiar page together. Give the word when help is needed, then invite one relaxed reread.",
    why: "This practices the exact reading skill that was shared today.",
    evidence: [
      {
        evidenceId,
        itemId: "literacy.reads-short-early-reader",
        statement: "Reads a short early reader",
        answer: "getting_there",
        derivation: "direct",
        sourceKind: "checklist",
        adultDisplayName: "Rachel",
        observedAt: "2026-08-02T15:00:00.000Z",
        receipt: "From Rachel's Aug 2 progress checklist answer",
      },
    ],
    chatDraft:
      "Help me adjust this ten-minute reading idea for Maya: read one familiar page together, help with a word when needed, then invite one relaxed reread.",
  };
}

try {
  const [child] = await sql<{ id: string }[]>`
    select id
    from public.children
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and name = 'Maya'
    limit 1
  `;
  assert.ok(child?.id, "the eval fixture includes Maya");

  const first = await claimProgressNextMove({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: child.id,
    contextFingerprint: fingerprintA,
    sourceRevision: 11n,
  });
  assert.equal(first.status, "pending");
  assert.equal(first.sourceRevision, 11n);

  const repeated = await claimProgressNextMove({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: child.id,
    contextFingerprint: fingerprintA,
    sourceRevision: 11n,
  });
  assert.equal(repeated.contextFingerprint, fingerprintA);

  const reservations = await Promise.all([
    reserveProgressNextMoveStart({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintA,
    }),
    reserveProgressNextMoveStart({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintA,
    }),
  ]);
  assert.deepEqual(reservations.sort(), [false, true]);
  assert.equal(
    await setProgressNextMoveRuntimeSession({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintA,
      sessionId: "progress-next-move-e2e",
    }),
    true,
  );
  assert.equal(
    await setProgressNextMoveRuntimeSession({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintA,
      sessionId: "should-not-replace",
    }),
    false,
  );

  const proposal = move(child.id, randomUUID());
  assert.equal(
    await completeProgressNextMove({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintA,
      sourceRevision: 12n,
      nextMove: proposal,
    }),
    null,
  );
  const completed = await completeProgressNextMove({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: child.id,
    contextFingerprint: fingerprintA,
    sourceRevision: 11n,
    nextMove: proposal,
  });
  assert.equal(completed?.status, "ready");
  assert.deepEqual(completed?.nextMove, proposal);
  assert.equal(
    await completeProgressNextMove({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintA,
      sourceRevision: 11n,
      nextMove: proposal,
    }),
    null,
  );

  assert.equal(
    await dismissProgressNextMove({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintA,
      sourceRevision: 11n,
      timeZone: "America/New_York",
      nextMove: proposal,
    }),
    true,
  );
  assert.equal(
    (
      await loadStoredProgressNextMove({
        familyId: EVAL_FIXTURE_FAMILY_ID,
        childId: child.id,
        contextFingerprint: fingerprintA,
      })
    )?.status,
    "dismissed",
  );
  const [dismissal] = await sql<{
    dismissed_at: string;
    dismissed_until: string;
    local_until: string;
  }[]>`
    select dismissed_at::text as dismissed_at,
           dismissed_until::text as dismissed_until,
           to_char(
             dismissed_until at time zone 'America/New_York',
             'YYYY-MM-DD HH24:MI:SS'
           ) as local_until
    from public.child_progress_next_moves
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and child_id = ${child.id}
      and context_fingerprint = ${fingerprintA}
  `;
  assert.ok(
    Date.parse(dismissal.dismissed_until) > Date.parse(dismissal.dismissed_at),
  );
  assert.match(dismissal.local_until, / 00:00:00$/u);

  await sql`
    update public.child_progress_next_moves
    set dismissed_until = now() - interval '1 second'
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and child_id = ${child.id}
      and context_fingerprint = ${fingerprintA}
  `;
  const reactivated = await claimProgressNextMove({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: child.id,
    contextFingerprint: fingerprintA,
    sourceRevision: 11n,
  });
  assert.equal(reactivated.status, "pending");
  assert.equal(reactivated.nextMove, null);

  const failed = await failProgressNextMove({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: child.id,
    contextFingerprint: fingerprintA,
    sourceRevision: 11n,
  });
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.nextMove, null);
  const cachedFailure = await claimProgressNextMove({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: child.id,
    contextFingerprint: fingerprintA,
    sourceRevision: 11n,
  });
  assert.equal(cachedFailure.status, "failed");
  const retriedFailure = await claimProgressNextMove({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: child.id,
    contextFingerprint: fingerprintA,
    sourceRevision: 11n,
    retryFailed: true,
  });
  assert.equal(retriedFailure.status, "pending");
  assert.equal(retriedFailure.nextMove, null);

  const concurrentClaims = await Promise.all([
    claimProgressNextMove({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintB,
      sourceRevision: 12n,
    }),
    claimProgressNextMove({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: child.id,
      contextFingerprint: fingerprintC,
      sourceRevision: 13n,
    }),
  ]);
  assert.equal(concurrentClaims.length, 2);
  const [live] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.child_progress_next_moves
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and child_id = ${child.id}
      and status in ('pending', 'ready', 'clarify', 'none', 'failed')
  `;
  assert.equal(live.count, 1, "one child has exactly one live fingerprint");

  const [foreignChild] = await sql<{ id: string; family_id: string }[]>`
    select id, family_id
    from public.children
    where family_id <> ${EVAL_FIXTURE_FAMILY_ID}
    limit 1
  `;
  assert.ok(foreignChild?.id, "the eval fixtures include a foreign-family child");
  await assert.rejects(
    claimProgressNextMove({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: foreignChild.id,
      contextFingerprint: "d".repeat(64),
      sourceRevision: 14n,
    }),
    /child does not belong to family/u,
  );
  await assert.rejects(
    sql`
      insert into public.child_progress_next_moves (
        family_id, child_id, context_fingerprint, source_revision,
        prompt_version, status
      ) values (
        ${EVAL_FIXTURE_FAMILY_ID}, ${foreignChild.id}, ${"d".repeat(64)},
        14, 'progress-next-move-v1', 'pending'
      )
    `,
    /child_progress_next_moves_child_family_fk/u,
  );

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`set local role authenticated`;
      await transaction`select * from public.child_progress_next_moves limit 1`;
    }),
    /permission denied/u,
  );

  console.log("PASS  progress-next-move idempotent lifecycle");
  console.log("PASS  progress-next-move family-local dismissal expiry");
  console.log("PASS  progress-next-move result-free failure retry");
  console.log("PASS  progress-next-move one-live-fingerprint concurrency");
  console.log("PASS  progress-next-move tenant FK and deny-all Data API boundary");
} finally {
  await Promise.all([
    sql.end({ timeout: 5 }),
    mapDb().end({ timeout: 5 }),
  ]);
}
