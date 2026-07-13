import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z } from "zod";

import {
  createProgressToolContext,
  DISABLED_PROGRESS_NOTE,
  manageChildProgressInputSchema,
  manageChildProgressResultSchema,
  manageChildProgressToolInputSchema,
  progressOperationIdempotencyKey,
} from "./tool-contract";
import {
  executeChildProgressCommand,
  executeChildProgressTool,
  type ChildProgressToolOperations,
} from "./tool-adapter";

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHECK_IN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONFLICT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const EVIDENCE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-11T23:55:00.000Z");

function throwingOperations(
  overrides: Partial<ChildProgressToolOperations> = {},
): ChildProgressToolOperations {
  const unexpected = async (): Promise<never> => {
    throw new Error("Unexpected child progress operation");
  };
  return {
    startCheckIn: unexpected,
    respondCheckIn: unexpected,
    pauseCheckIn: unexpected,
    resumeCheckIn: unexpected,
    stopCheckIn: unexpected,
    takeoverCheckIn: unexpected,
    recordJournalEvidence: unexpected,
    resolveConflict: unexpected,
    undoProgressUpdate: unexpected,
    markObservationUsed: unexpected,
    listFamilyCheckIns: async () => [],
    getChildProgressView: async () => null,
    ...overrides,
  };
}

describe("trusted progress command schema", () => {
  it("publishes a provider-compatible top-level object schema", () => {
    const jsonSchema = z.toJSONSchema(
      manageChildProgressToolInputSchema,
    );

    assert.equal(jsonSchema.type, "object");
    assert.ok(jsonSchema.properties?.action);
  });

  it("accepts commands without model-owned revision, quote, or idempotency", () => {
    const commands = [
      {
        action: "start_check_in",
        childId: CHILD_ID,
        purpose: "whole_map_refresh",
      },
      {
        action: "respond_check_in",
        checkInId: CHECK_IN_ID,
        answer: "getting_there",
      },
      {
        action: "pause_check_in",
        checkInId: CHECK_IN_ID,
        reason: "topic_change",
      },
      { action: "resume_check_in", checkInId: CHECK_IN_ID },
      { action: "stop_check_in", checkInId: CHECK_IN_ID },
      { action: "takeover_check_in", checkInId: CHECK_IN_ID },
      {
        action: "record_journal_evidence",
        childId: CHILD_ID,
        subjectId: "literacy",
      },
      {
        action: "resolve_conflict",
        conflictId: CONFLICT_ID,
        answer: "easily",
      },
      {
        action: "undo_progress_update",
        operationId: EVIDENCE_ID,
      },
    ];

    for (const command of commands) {
      assert.equal(
        manageChildProgressInputSchema.safeParse(command).success,
        true,
        command.action,
      );
    }
  });

  it("rejects model-owned quote, revision, idempotency, and malformed UUIDs", () => {
    const forbidden = [
      {
        action: "record_journal_evidence",
        childId: CHILD_ID,
        parentQuote: "Fabricated by the model",
      },
      {
        action: "respond_check_in",
        checkInId: CHECK_IN_ID,
        answer: "easily",
        expectedRevision: 7,
      },
      {
        action: "start_check_in",
        childId: CHILD_ID,
        purpose: "whole_map_refresh",
        idempotencyKey: "model-key",
      },
      {
        action: "resolve_conflict",
        conflictId: "not-a-uuid",
        answer: "easily",
      },
      {
        action: "undo_progress_update",
        operationId: "not-a-uuid",
      },
    ];

    for (const command of forbidden) {
      assert.equal(
        manageChildProgressInputSchema.safeParse(command).success,
        false,
      );
    }
  });
});

describe("disabled progress result", () => {
  it("accepts only the strict disabled note", () => {
    assert.deepEqual(
      manageChildProgressResultSchema.parse({
        kind: "disabled",
        note: DISABLED_PROGRESS_NOTE,
      }),
      {
        kind: "disabled",
        note: DISABLED_PROGRESS_NOTE,
      },
    );
    assert.equal(
      manageChildProgressResultSchema.safeParse({
        kind: "disabled",
        note: DISABLED_PROGRESS_NOTE,
        familyId: FAMILY_ID,
      }).success,
      false,
    );
  });
});

describe("trusted progress runtime context", () => {
  it("carries server session, turn, and canonical inbound provenance", () => {
    const context = createProgressToolContext({
      access: { familyId: FAMILY_ID },
      attributes: {
        memberUserId: MEMBER_ID,
        channel: "sms",
        providerMessageId: "provider-1",
        episodeId: "episode-1",
        canonicalInboundText:
          "Maya read the whole early reader by herself.",
        canonicalInboundMessageId: MESSAGE_ID,
      },
      sessionId: "session-1",
      turnId: "turn-1",
      now: NOW,
    });

    assert.deepEqual(context, {
      familyId: FAMILY_ID,
      memberUserId: MEMBER_ID,
      channel: "sms",
      providerMessageId: "provider-1",
      repliedDeliveryId: null,
      episodeId: "episode-1",
      runtimeSessionId: "session-1",
      turnId: "turn-1",
      canonicalInboundText:
        "Maya read the whole early reader by herself.",
      inboundMessageId: MESSAGE_ID,
      taskRunId: null,
      now: NOW.toISOString(),
    });
  });

  it("derives stable operation keys from trusted provenance", () => {
    const providerContext = createProgressToolContext({
      access: { familyId: FAMILY_ID },
      attributes: {
        memberUserId: MEMBER_ID,
        channel: "sms",
        providerMessageId: "provider-1",
      },
      sessionId: "session-1",
      turnId: "turn-1",
      now: NOW,
    });
    const sessionContext = {
      ...providerContext,
      providerMessageId: null,
    };

    assert.equal(
      progressOperationIdempotencyKey(
        providerContext,
        "respond_check_in",
      ),
      progressOperationIdempotencyKey(
        { ...providerContext, runtimeSessionId: "other-session" },
        "respond_check_in",
      ),
    );
    assert.notEqual(
      progressOperationIdempotencyKey(
        sessionContext,
        "respond_check_in",
      ),
      progressOperationIdempotencyKey(
        { ...sessionContext, turnId: "turn-2" },
        "respond_check_in",
      ),
    );
  });

  it("rejects missing runtime prompt identity", () => {
    assert.throws(
      () =>
        createProgressToolContext({
          access: { familyId: FAMILY_ID },
          attributes: { memberUserId: MEMBER_ID },
          sessionId: "",
          turnId: "",
          now: NOW,
        }),
      /session and turn/u,
    );
  });
});

describe("trusted progress adapter", () => {
  it("returns disabled before context or operations when the flag is off", async () => {
    const previous = process.env.HOMA_LIVE_PROGRESS_ENABLED;
    try {
      for (const flag of [undefined, "false"]) {
        if (flag === undefined) {
          delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
        } else {
          process.env.HOMA_LIVE_PROGRESS_ENABLED = flag;
        }
        let contextCalls = 0;
        const result = await executeChildProgressTool({
          command: {
            action: "start_check_in",
            childId: CHILD_ID,
            purpose: "whole_map_refresh",
          },
          createContext: () => {
            contextCalls += 1;
            throw new Error("disabled context reached");
          },
          operations: throwingOperations(),
        });

        assert.deepEqual(result, {
          kind: "disabled",
          note: DISABLED_PROGRESS_NOTE,
        });
        assert.equal(contextCalls, 0);
      }
    } finally {
      if (previous === undefined) {
        delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
      } else {
        process.env.HOMA_LIVE_PROGRESS_ENABLED = previous;
      }
    }
  });

  it("enters trusted context only for the exact enabled value", async () => {
    const previous = process.env.HOMA_LIVE_PROGRESS_ENABLED;
    process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
    let contextCalls = 0;
    try {
      await assert.rejects(
        executeChildProgressTool({
          command: {
            action: "start_check_in",
            childId: CHILD_ID,
            purpose: "whole_map_refresh",
          },
          createContext: () => {
            contextCalls += 1;
            throw new Error("enabled context reached");
          },
          operations: throwingOperations(),
        }),
        /enabled context reached/u,
      );
      assert.equal(contextCalls, 1);
    } finally {
      if (previous === undefined) {
        delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
      } else {
        process.env.HOMA_LIVE_PROGRESS_ENABLED = previous;
      }
    }
  });

  it("passes trusted journal text and a derived key, never a model quote", async () => {
    const context = createProgressToolContext({
      access: { familyId: FAMILY_ID },
      attributes: {
        memberUserId: MEMBER_ID,
        channel: "email",
        canonicalInboundText:
          "Maya read the whole early reader by herself.",
        canonicalInboundMessageId: MESSAGE_ID,
      },
      sessionId: "session-1",
      turnId: "turn-1",
      now: NOW,
    });
    let captured: unknown;

    await executeChildProgressCommand(
      {
        action: "record_journal_evidence",
        childId: CHILD_ID,
      },
      context,
      throwingOperations({
        recordJournalEvidence: async (
          receivedContext,
          input,
        ) => {
          captured = { context: receivedContext, input };
          return { status: "activity_only" };
        },
      }),
    );

    assert.deepEqual(captured, {
      context,
      input: {
        childId: CHILD_ID,
        idempotencyKey: progressOperationIdempotencyKey(
          context,
          "record_journal_evidence",
        ),
      },
    });
    assert.equal(
      JSON.stringify(captured).includes("parentQuote"),
      false,
    );
  });

  it("refuses interactive writes from dispatch without calling services", async () => {
    const context = createProgressToolContext({
      access: { familyId: FAMILY_ID },
      attributes: {
        memberUserId: MEMBER_ID,
        channel: "dispatch",
        canonicalInboundText:
          "Maya read the whole early reader by herself.",
        canonicalInboundMessageId: MESSAGE_ID,
      },
      sessionId: "session-1",
      turnId: "turn-1",
      now: NOW,
    });
    let calls = 0;

    const result = await executeChildProgressCommand(
      {
        action: "record_journal_evidence",
        childId: CHILD_ID,
      },
      context,
      throwingOperations({
        recordJournalEvidence: async () => {
          calls += 1;
          return { status: "activity_only" };
        },
      }),
    );

    assert.equal(result.kind, "refused");
    assert.equal(calls, 0);
  });
});
