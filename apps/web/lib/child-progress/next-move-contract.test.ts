import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { z } from "zod";

import {
  executeTrustedProgressNextMovePersistence,
  progressNextMoveCandidateFromPersistInput,
  progressNextMovePersistInputSchema,
} from "../../agent/tools/persist_progress_next_move";

import {
  buildProgressNextMoveAuth,
  buildProgressNextMoveMessage,
  readProgressNextMoveTrustedContext,
} from "./next-move-dispatch";
import { progressNextMoveCandidateSchema } from "./next-move";
import type { ProgressNextMoveSnapshot } from "./next-move-snapshot";
import { validatedProgressNextMoveForStorage } from "./next-move-store";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "22222222-2222-4222-8222-222222222222";
const FINGERPRINT = "a".repeat(64);

function snapshot(): ProgressNextMoveSnapshot {
  return {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceRevision: BigInt(7),
    contextFingerprint: FINGERPRINT,
    view: {
      childId: CHILD_ID,
      childName: "Maya",
      birthDate: "2020-01-02",
      timeZone: "America/New_York",
      projectedAt: "2026-08-02T16:00:00.000Z",
      scores: {
        subjects: [],
        strengthOrder: [],
        mappedCount: 0,
        totalSubjects: 0,
        observationCount: 1,
      },
      subjects: [],
      conflicts: [],
    },
    ledger: {
      child: {
        id: CHILD_ID,
        name: "Maya",
        birthDate: "2020-01-02",
      },
      familyId: FAMILY_ID,
      timeZone: "America/New_York",
      sourceRevision: BigInt(7),
      evidence: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          childId: CHILD_ID,
          familyId: FAMILY_ID,
          itemId: "math.counts-to-5",
          answer: "getting_there",
          derivation: "direct",
          source: "check_in",
          memberUserId: "33333333-3333-4333-8333-333333333333",
          adultDisplayName: "Elena",
          quote: null,
          channel: "web",
          messageId: "message-1",
          checkInId: "check-in-1",
          supersedesId: null,
          supersededAt: null,
          observedAt: "2026-08-01T16:00:00.000Z",
          createdAt: "2026-08-01T16:00:01.000Z",
          idempotencyKey: "key-counts",
        },
      ],
      conflicts: [],
      selectionAnswers: [],
    },
    clarification: null,
    context: {
      child: { childId: CHILD_ID, childName: "Maya", ageMonths: 79 },
      allowedTargets: [
        {
          itemId: "math.counts-to-5",
          statement: "Counts up to 5 objects",
          subjectId: "math",
          subjectName: "Math",
          role: "current_evidence",
        },
      ],
      eligibleEvidence: [
        {
          itemId: "math.counts-to-5",
          statement: "Counts up to 5 objects",
          answer: "getting_there",
          derivation: "direct",
          sourceKind: "check_in",
          adultDisplayName: "Elena",
          observedAt: "2026-08-01T16:00:00.000Z",
          subjectId: "math",
          subjectName: "Math",
          receipt: "From Elena’s Aug 1 check-in answer",
        },
      ],
    },
  };
}

describe("Progress next-move internal task contract", () => {
  it("publishes a provider-compatible top-level object schema", () => {
    const jsonSchema = z.toJSONSchema(progressNextMovePersistInputSchema);
    assert.equal(jsonSchema.type, "object");
    assert.ok(jsonSchema.properties?.kind);
    assert.ok(jsonSchema.properties?.proposal);
  });

  it("requires exactly one move proposal or stop reason", () => {
    assert.equal(
      progressNextMovePersistInputSchema.safeParse({
        kind: "move",
        childId: CHILD_ID,
      }).success,
      false,
    );
    assert.equal(
      progressNextMovePersistInputSchema.safeParse({
        kind: "stop",
        childId: CHILD_ID,
        reason: "unsafe_activity",
      }).success,
      true,
    );
  });

  it("adapts the persisted move shape into the strict verifier candidate", () => {
    const parsed = progressNextMovePersistInputSchema.parse({
      kind: "move",
      childId: CHILD_ID,
      proposal: {
        targetItemId: "math.counts-to-5",
        evidenceItemIds: ["math.counts-to-5"],
        minutes: 5,
        activity: "Count five large blocks, then hide one and count again.",
        why: "Maya is still building confidence counting small groups.",
      },
    });
    const candidate = progressNextMoveCandidateFromPersistInput(parsed);

    assert.equal(progressNextMoveCandidateSchema.safeParse(candidate).success, true);
    assert.deepEqual(candidate, {
      childId: CHILD_ID,
      targetItemId: "math.counts-to-5",
      evidenceItemIds: ["math.counts-to-5"],
      minutes: 5,
      activity: "Count five large blocks, then hide one and count again.",
      why: "Maya is still building confidence counting small groups.",
    });
  });

  it("fails a valid-shape rejected proposal without settling unavailable", async () => {
    const source = snapshot();
    let failed = 0;
    let completed = 0;
    const result = await executeTrustedProgressNextMovePersistence(
      progressNextMovePersistInputSchema.parse({
        kind: "move",
        childId: CHILD_ID,
        proposal: {
          targetItemId: "math.small-groups",
          evidenceItemIds: ["math.small-groups"],
          minutes: 5,
          activity: "Sort five large blocks into two groups and count each group.",
          why: "This keeps the activity short and concrete.",
        },
      }),
      {
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        contextFingerprint: FINGERPRINT,
        sourceRevision: BigInt(7),
      },
      {
        loadSnapshot: async () => source,
        complete: async () => {
          completed += 1;
          return null;
        },
        fail: async () => {
          failed += 1;
          return {
            familyId: FAMILY_ID,
            childId: CHILD_ID,
            contextFingerprint: FINGERPRINT,
            sourceRevision: BigInt(7),
            status: "failed",
            nextMove: null,
            runtimeSessionId: null,
            updatedAt: "2026-08-02T16:00:00.000Z",
          };
        },
      },
    );

    assert.equal(failed, 1);
    assert.equal(completed, 0);
    assert.equal(result.persisted, true);
    assert.equal(result.status, "failed");
    assert.equal(result.nextMove, null);
    assert.equal(result.reason, "target_outside_working_edge");
  });

  it("pins one exact family, child, fingerprint, revision, and usage surface", () => {
    const auth = buildProgressNextMoveAuth(snapshot());
    assert.deepEqual(readProgressNextMoveTrustedContext(auth.attributes), {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      contextFingerprint: FINGERPRINT,
      sourceRevision: BigInt(7),
    });
    assert.equal(auth.attributes.channel, "progress_next_move");
    assert.equal(auth.attributes.modelUsageSurface, "progress_next_move");
  });

  it("rejects nearby but untrusted task attributes", () => {
    const attributes = buildProgressNextMoveAuth(snapshot()).attributes;
    assert.equal(
      readProgressNextMoveTrustedContext({ ...attributes, channel: "mobile" }),
      null,
    );
    assert.equal(
      readProgressNextMoveTrustedContext({
        ...attributes,
        progressNextMoveFingerprint: "short",
      }),
      null,
    );
    assert.equal(
      readProgressNextMoveTrustedContext({
        ...attributes,
        progressSourceRevision: "7.5",
      }),
      null,
    );
  });

  it("loads the fleet skill and calls the persistence effect once without raw quotes", () => {
    const message = buildProgressNextMoveMessage(snapshot());
    assert.match(message, /Load the progress-next-move skill FIRST/u);
    assert.equal(message.match(/persist_progress_next_move/gu)?.length, 1);
    assert.match(message, /exactly once/u);
    assert.doesNotMatch(message, /"quote"|private raw wording/u);
  });
});

describe("Progress next-move SQL boundary", () => {
  it("keeps derived results server-only and family-child scoped", async () => {
    const migration = await readFile(
      new URL(
        "../../../../supabase/migrations/20260802224000_child_progress_next_moves.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(
      migration,
      /foreign key \(child_id, family_id\)[\s\S]*references public\.children \(id, family_id\)/u,
    );
    assert.match(
      migration,
      /alter table public\.child_progress_next_moves enable row level security/u,
    );
    assert.match(
      migration,
      /revoke all on table public\.child_progress_next_moves from anon, authenticated/u,
    );
    assert.doesNotMatch(migration, /create policy/u);
  });

  it("allows a pending row to be superseded before it has a result", async () => {
    const [migration, store] = await Promise.all([
      readFile(
        new URL(
          "../../../../supabase/migrations/20260802224000_child_progress_next_moves.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("./next-move-store.ts", import.meta.url), "utf8"),
    ]);
    assert.match(migration, /or \(status = 'superseded'\)/u);
    assert.match(store, /set status = 'superseded'/u);
    assert.match(store, /and runtime_session_id = 'starting'/u);
  });

  it("keeps producer failures result-free and retryable", async () => {
    const [migration, store, channel] = await Promise.all([
      readFile(
        new URL(
          "../../../../supabase/migrations/20260802224000_child_progress_next_moves.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("./next-move-store.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../../agent/channels/progress-next-move.ts", import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(migration, /status = 'failed' and result is null/u);
    assert.match(store, /set status = 'failed', result = null/u);
    assert.match(store, /input\.retryFailed/u);
    assert.match(channel, /"message\.completed"[\s\S]*failPending/u);
    assert.match(channel, /"turn\.failed"[\s\S]*failPending/u);
    assert.match(channel, /"session\.failed"[\s\S]*failPending/u);
    assert.match(channel, /failProgressNextMove/u);
    assert.doesNotMatch(channel, /reason: "unavailable"/u);
  });

  it("rejects invalid parent copy before a ready row can be stored", () => {
    assert.equal(
      validatedProgressNextMoveForStorage({
        kind: "move",
        childId: CHILD_ID,
        sourceRevision: "7",
        targetItemId: "math.counts-to-5",
        targetStatement: "Counts up to 5 objects",
        minutes: 5,
        activity: "Count five blocks\u2014then count them again.",
        why: "This follows current counting evidence.",
        evidence: [],
        chatDraft: "Help me adjust this.",
      }),
      null,
    );
  });

  it("expands model usage to the mobile channel without dropping existing channels", async () => {
    const migration = await readFile(
      new URL(
        "../../../../supabase/migrations/20260802223000_model_usage_mobile_channel.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const channel of [
      "web",
      "sms",
      "email",
      "dispatch",
      "mobile",
      "subject_lesson",
    ]) {
      assert.match(migration, new RegExp(`'${channel}'`, "u"));
    }
  });
});
