import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DeliveryAttempt } from "../conversation-continuity/delivery-ledger";
import {
  deliverTaskMessage,
  type TaskDeliveryLedger,
} from "../conversation-continuity/task-delivery";
import {
  aggregateResearchBriefDeliveryAttempts,
  deliverPreparedResearchBrief,
  handlePreparedResearchBriefTerminalEvent,
  isPreparedResearchBriefTerminalMessage,
  recoverPreparedResearchBriefFromDurableDelivery,
  preparedResearchBriefOwnsCanonicalPersistence,
  type PreparedResearchBrief,
} from "./research-brief-delivery";

class InMemoryDeliveryLedger implements TaskDeliveryLedger {
  private readonly attempts = new Map<string, DeliveryAttempt>();
  private sequence = 0;

  async beginAttempt(
    input: Omit<
      DeliveryAttempt,
      "id" | "existingStatus" | "shouldSend"
    >,
  ): Promise<DeliveryAttempt> {
    const key = `${input.channel}:${input.destination}`;
    const existing = this.attempts.get(key);
    if (existing) return { ...existing, shouldSend: false };
    this.sequence += 1;
    const attempt: DeliveryAttempt = {
      ...input,
      id: `attempt-${this.sequence}`,
      existingStatus: "pending",
      shouldSend: true,
    };
    this.attempts.set(key, attempt);
    return attempt;
  }

  async finishAttempt(
    attempt: DeliveryAttempt,
    outcome:
      | { delivered: true; providerMessageId?: string | null }
      | { delivered: false; error?: string | null; uncertain?: boolean },
  ): Promise<void> {
    this.attempts.set(`${attempt.channel}:${attempt.destination}`, {
      ...attempt,
      existingStatus: outcome.delivered
        ? "sent"
        : outcome.uncertain
          ? "uncertain"
          : "failed",
      shouldSend: false,
    });
  }

  async openLoop(): Promise<void> {}
}

class FailingFinishDeliveryLedger implements TaskDeliveryLedger {
  attempt: DeliveryAttempt | null = null;

  async beginAttempt(
    input: Omit<
      DeliveryAttempt,
      "id" | "existingStatus" | "shouldSend"
    >,
  ): Promise<DeliveryAttempt> {
    this.attempt = {
      ...input,
      id: "attempt-1",
      existingStatus: "pending",
      shouldSend: true,
    };
    return this.attempt;
  }

  async finishAttempt(): Promise<void> {
    throw new Error("delivery ledger update failed");
  }

  async openLoop(): Promise<void> {}
}

const prepared: PreparedResearchBrief = {
  familyId: "family-1",
  taskRunId: "run-1",
  childId: "child-1",
  knowledgeId: "knowledge-1",
  draft: "The stored prepared draft",
  sourceSnapshot: {
    kind: "knowledge_cited",
    id: "knowledge-1",
    title: "Research title",
    sourceNames: ["Research source"],
    citationUrls: ["https://example.test/source"],
    topic: "reading",
    claims: ["Research claim"],
    topicType: "subject",
    lens: "current_study",
    stage: "early_elem",
    confidence: "high",
    sourceTier: 1,
  },
};

describe("research brief prepared delivery", () => {
  it("aggregates durable multi-recipient delivery as partial", () => {
    assert.deepEqual(
      aggregateResearchBriefDeliveryAttempts([
        {
          recipientKey: "member-1",
          channel: "sms",
          status: "sent",
        },
        {
          recipientKey: "member-2",
          channel: "sms",
          status: "failed",
        },
      ]),
      {
        status: "partial",
        deliveredChannel: "sms",
        deliveredCount: 1,
        failedCount: 1,
      },
    );
  });

  it("treats pending recipients as partial uncertainty when another delivery sent", () => {
    assert.deepEqual(
      aggregateResearchBriefDeliveryAttempts([
        {
          recipientKey: "member-1",
          channel: "email",
          status: "sent",
        },
        {
          recipientKey: "member-2",
          channel: "sms",
          status: "pending",
        },
      ]),
      {
        status: "partial_uncertain",
        deliveredChannel: "email",
        deliveredCount: 1,
        failedCount: 0,
      },
    );
  });

  it("reserves generic persistence from the run's pinned delivery version", () => {
    const attributes = {
      channel: "dispatch",
      taskKind: "morning_brief",
      deliveryVersion: "research_brief_v2",
    };
    assert.equal(
      preparedResearchBriefOwnsCanonicalPersistence(attributes),
      true,
    );
    assert.equal(
      preparedResearchBriefOwnsCanonicalPersistence(
        { ...attributes, deliveryVersion: "legacy" },
      ),
      false,
    );
    assert.equal(
      preparedResearchBriefOwnsCanonicalPersistence(
        { ...attributes, taskKind: "custom" },
      ),
      false,
    );
  });

  it("waits through interim blocks and fails empty completed turns immediately", async () => {
    assert.equal(
      isPreparedResearchBriefTerminalMessage({
        finishReason: "tool-calls",
        message: "I will prepare this now.",
      }),
      false,
    );
    assert.equal(
      isPreparedResearchBriefTerminalMessage({
        finishReason: "stop",
        message: "   ",
      }),
      false,
    );
    assert.equal(
      isPreparedResearchBriefTerminalMessage({
        finishReason: "stop",
        message: null,
      }),
      false,
    );
    const failures: string[] = [];
    await handlePreparedResearchBriefTerminalEvent(
      {
        eventType: "turn.completed",
        enabled: true,
        state: { transportAccepted: false, delivered: false },
      },
      async (reason) => {
        failures.push(reason);
      },
    );
    assert.deepEqual(failures, ["morning brief delivery did not complete"]);
  });

  it("finishes failed turn and session events without touching legacy or accepted sends", async () => {
    const failures: string[] = [];
    for (const eventType of [
      "turn.failed",
      "session.failed",
    ] as const) {
      await handlePreparedResearchBriefTerminalEvent(
        {
          eventType,
          enabled: true,
          state: { transportAccepted: false, delivered: false },
        },
        async (reason) => {
          failures.push(`${eventType}:${reason}`);
        },
      );
    }
    await handlePreparedResearchBriefTerminalEvent(
      {
        eventType: "turn.completed",
        enabled: false,
        state: { transportAccepted: false, delivered: false },
      },
      async () => assert.fail("legacy behavior must be untouched"),
    );
    await handlePreparedResearchBriefTerminalEvent(
      {
        eventType: "turn.failed",
        enabled: true,
        state: { transportAccepted: true, delivered: false },
      },
      async () => assert.fail("accepted transport must stay recoverable"),
    );
    assert.deepEqual(failures, [
      "turn.failed:morning brief delivery did not complete",
      "session.failed:morning brief delivery did not complete",
    ]);
  });

  it("fails immediately with a PII-free reason when preparation loading throws", async () => {
    const failedReasons: string[] = [];
    const failedPhases: string[] = [];
    const state = { transportAccepted: false, delivered: false };

    const result = await deliverPreparedResearchBrief(
      {
        familyId: "family-1",
        taskRunId: "run-1",
        state,
      },
      {
        loadPrepared: async () => {
          throw new Error("database included a parent email");
        },
        persistCanonical: async () => assert.fail("must not persist"),
        deliver: async () => assert.fail("must not deliver"),
        recordAcceptance: async () => assert.fail("must not accept"),
        finalize: async () => assert.fail("must not finalize"),
        failRun: async (reason) => {
          failedReasons.push(reason);
        },
        logFailure: (phase) => failedPhases.push(phase),
        logRecoveryPending: () => assert.fail("must not log recovery"),
      },
    );

    assert.deepEqual(result, { status: "failed_before_transport" });
    assert.deepEqual(failedReasons, ["morning brief delivery did not complete"]);
    assert.deepEqual(failedPhases, ["preparation_load"]);
    assert.deepEqual(state, { transportAccepted: false, delivered: false });
  });

  it("keeps an accepted send recoverable when finalization fails", async () => {
    const calls: string[] = [];
    const state = { transportAccepted: false, delivered: false };

    const result = await deliverPreparedResearchBrief(
      {
        familyId: "family-1",
        taskRunId: "run-1",
        state,
      },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async () => ({
          id: "message-1",
          episodeId: "episode-1",
        }),
        deliver: async (_draft, _message, markTransportAccepted) => {
          markTransportAccepted();
          calls.push("transport");
          return {
            status: "done",
            deliveredChannel: "sms",
            deliveredCount: 1,
            failedCount: 0,
          };
        },
        recordAcceptance: async () => undefined,
        finalize: async () => {
          calls.push("finalize");
          assert.equal(state.delivered, false);
          throw new Error("database unavailable");
        },
        failRun: async () => assert.fail("accepted transport must not fail"),
        logRecoveryPending: (phase) =>
          calls.push(`recovery-pending:${phase}`),
      },
    );

    assert.deepEqual(result, { status: "recovery_pending" });
    assert.deepEqual(calls, [
      "transport",
      "finalize",
      "recovery-pending:finalization",
    ]);
    assert.deepEqual(state, { transportAccepted: true, delivered: false });
  });

  it("passes the canonical message id into one atomic finalization boundary", async () => {
    const finalizedMessageIds: string[] = [];
    const state = { transportAccepted: false, delivered: false };
    const result = await deliverPreparedResearchBrief(
      { familyId: "family-1", taskRunId: "run-1", state },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async () => ({
          id: "message-1",
          episodeId: "episode-1",
        }),
        deliver: async (_draft, _message, markTransportAccepted) => {
          markTransportAccepted();
          return {
            status: "done",
            deliveredChannel: "sms",
            deliveredCount: 1,
            failedCount: 0,
          };
        },
        recordAcceptance: async () => undefined,
        finalize: async (_prepared, message) => {
          finalizedMessageIds.push(message.id);
          return {
            prepared,
            delivery: {
              status: "done",
              deliveredChannel: "sms",
              deliveredCount: 1,
              failedCount: 0,
            },
          };
        },
        failRun: async () => assert.fail("accepted delivery must not fail"),
        logRecoveryPending: () => assert.fail("finalization completed"),
      },
    );

    assert.equal(result.status, "completed");
    assert.deepEqual(finalizedMessageIds, ["message-1"]);
    assert.deepEqual(state, { transportAccepted: true, delivered: true });
  });

  it("uses the atomic finalization aggregate and performs no later run finish", async () => {
    const state = { transportAccepted: false, delivered: false };
    const finalDelivery = {
      status: "partial" as const,
      deliveredChannel: "sms" as const,
      deliveredCount: 1,
      failedCount: 1,
    };
    const result = await deliverPreparedResearchBrief(
      { familyId: "family-1", taskRunId: "run-1", state },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async () => ({
          id: "message-atomic-status",
          episodeId: "episode-1",
        }),
        deliver: async (_draft, _message, markTransportAccepted) => {
          markTransportAccepted();
          return {
            status: "done",
            deliveredChannel: "email",
            deliveredCount: 1,
            failedCount: 0,
          };
        },
        recordAcceptance: async () => undefined,
        finalize: async () => ({
          prepared,
          delivery: finalDelivery,
        }),
        failRun: async () => assert.fail("atomic finalization succeeded"),
        logRecoveryPending: () =>
          assert.fail("atomic finalization succeeded"),
      },
    );

    assert.equal(result.status, "completed");
    if (result.status === "completed") {
      assert.deepEqual(result.delivery, finalDelivery);
    }
    assert.deepEqual(state, {
      transportAccepted: true,
      delivered: true,
    });
  });

  it("records save-only acceptance before atomic finalization", async () => {
    const calls: string[] = [];
    const state = { transportAccepted: false, delivered: false };
    const result = await deliverPreparedResearchBrief(
      { familyId: "family-1", taskRunId: "run-1", state },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async () => ({
          id: "message-1",
          episodeId: "episode-1",
        }),
        deliver: async (_draft, _message, markTransportAccepted) => {
          markTransportAccepted();
          return {
            status: "done",
            deliveredChannel: "none",
            deliveredCount: 1,
            failedCount: 0,
          };
        },
        recordAcceptance: async (_prepared, delivery) => {
          calls.push(`accepted:${delivery.deliveredChannel}`);
        },
        finalize: async () => {
          calls.push("finalize");
          throw new Error("finalization unavailable");
        },
        failRun: async () => assert.fail("save-only was accepted"),
        logRecoveryPending: () => calls.push("recovery-pending"),
      },
    );
    assert.deepEqual(result, { status: "recovery_pending" });
    assert.deepEqual(calls, [
      "accepted:none",
      "finalize",
      "recovery-pending",
    ]);
  });

  it("keeps provider acceptance recoverable when ledger finalization leaves pending", async () => {
    const ledger = new FailingFinishDeliveryLedger();
    const state = { transportAccepted: false, delivered: false };
    let transportCalls = 0;
    let recoveryLogs = 0;
    const result = await deliverPreparedResearchBrief(
      { familyId: "family-1", taskRunId: "run-1", state },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async () => ({
          id: "message-1",
          episodeId: "episode-1",
        }),
        deliver: async (draft, message, markTransportAccepted) => {
          return await deliverTaskMessage(
            {
              familyId: prepared.familyId,
              episodeId: message.episodeId,
              messageId: message.id,
              taskRunId: prepared.taskRunId,
              kind: "morning_brief",
              text: draft,
              recipients: [
                {
                  recipientKey: "member-1",
                  memberUserId: "member-1",
                  displayName: "Parent",
                  phoneNumbers: ["+15550000001"],
                  email: "parent@example.test",
                },
              ],
            },
            {
              ledger,
              transports: {
                sendSms: async () => {
                  transportCalls += 1;
                  return { status: "submitted", messageId: "sms-1" };
                },
                sendEmail: async () => assert.fail("SMS was accepted"),
              },
              onTransportAccepted: () => markTransportAccepted(),
            },
          );
        },
        recordAcceptance: async () => assert.fail("ledger did not confirm sent"),
        finalize: async () => {
          throw new Error("delivery aggregate is still pending");
        },
        failRun: async () => assert.fail("provider accepted the message"),
        logRecoveryPending: () => {
          recoveryLogs += 1;
        },
      },
    );
    assert.deepEqual(result, { status: "recovery_pending" });
    assert.equal(transportCalls, 1);
    assert.equal(ledger.attempt?.existingStatus, "pending");
    assert.equal(recoveryLogs, 1);
    assert.deepEqual(state, { transportAccepted: true, delivered: false });
  });

  it("retries after post-send failure without duplicating transport or effects", async () => {
    const ledger = new InMemoryDeliveryLedger();
    const state = { transportAccepted: false, delivered: false };
    let transportCalls = 0;
    let finalizeCalls = 0;
    let effects = 0;
    const runDelivery = async () => {
      return await deliverPreparedResearchBrief(
        { familyId: "family-1", taskRunId: "run-1", state },
        {
          loadPrepared: async () => prepared,
          persistCanonical: async () => ({
            id: "message-1",
            episodeId: "episode-1",
          }),
          deliver: async (draft, message, markTransportAccepted) => {
            return await deliverTaskMessage(
              {
                familyId: prepared.familyId,
                episodeId: message.episodeId,
                messageId: message.id,
                taskRunId: prepared.taskRunId,
                kind: "morning_brief",
                text: draft,
                recipients: [
                  {
                    recipientKey: "member-1",
                    memberUserId: "member-1",
                    displayName: "Parent",
                    phoneNumbers: ["+15550000001"],
                    email: "parent@example.test",
                  },
                ],
              },
              {
                ledger,
                transports: {
                  sendSms: async () => {
                    transportCalls += 1;
                    return { status: "submitted", messageId: "sms-1" };
                  },
                  sendEmail: async () => assert.fail("SMS succeeded"),
                },
                onTransportAccepted: () => markTransportAccepted(),
              },
            );
          },
          recordAcceptance: async () => undefined,
          finalize: async () => {
            finalizeCalls += 1;
            if (finalizeCalls === 1) {
              throw new Error("finalization unavailable");
            }
            effects += 1;
            return {
              prepared,
              delivery: {
                status: "done",
                deliveredChannel: "sms",
                deliveredCount: 1,
                failedCount: 0,
              },
            };
          },
          failRun: async () => assert.fail("transport was already accepted"),
          logRecoveryPending: () => undefined,
        },
      );
    };

    assert.deepEqual(await runDelivery(), { status: "recovery_pending" });
    assert.deepEqual(await runDelivery(), {
      status: "completed",
      prepared,
      message: { id: "message-1", episodeId: "episode-1" },
      delivery: {
        status: "done",
        deliveredChannel: "sms",
        deliveredCount: 1,
        failedCount: 0,
      },
    });
    assert.equal(transportCalls, 1);
    assert.equal(effects, 1);
    assert.deepEqual(state, { transportAccepted: true, delivered: true });
  });

  it("keeps recovery pending when accepted-delivery finalization still fails", async () => {
    const calls: string[] = [];
    const result = await recoverPreparedResearchBriefFromDurableDelivery(
      { familyId: "family-1", taskRunId: "run-1" },
      {
        loadDelivery: async () => ({
          messageId: "message-1",
          delivery: {
            status: "done",
            deliveredChannel: "email",
            deliveredCount: 1,
            failedCount: 0,
          },
        }),
        finalize: async () => {
          calls.push("finalize");
          throw new Error("database unavailable");
        },
        logRecoveryPending: () => calls.push("recovery-pending"),
      },
    );
    assert.deepEqual(result, { status: "recovery_pending" });
    assert.deepEqual(calls, ["finalize", "recovery-pending"]);
  });

  it("keeps recovery pending when durable delivery lookup fails", async () => {
    const calls: string[] = [];
    const result = await recoverPreparedResearchBriefFromDurableDelivery(
      { familyId: "family-1", taskRunId: "run-1" },
      {
        loadDelivery: async () => {
          throw new Error("database unavailable");
        },
        finalize: async () => assert.fail("must not finalize"),
        logRecoveryPending: () => calls.push("recovery-pending"),
      },
    );
    assert.deepEqual(result, { status: "recovery_pending" });
    assert.deepEqual(calls, ["recovery-pending"]);
  });

  it("atomically finalizes the full partial delivery aggregate", async () => {
    const delivery = {
      status: "partial" as const,
      deliveredChannel: "sms" as const,
      deliveredCount: 1,
      failedCount: 1,
    };
    const calls: string[] = [];
    const result = await recoverPreparedResearchBriefFromDurableDelivery(
      { familyId: "family-1", taskRunId: "run-1" },
      {
        loadDelivery: async () => ({ messageId: "message-1", delivery }),
        finalize: async (snapshot) => {
          calls.push(`finalize:${snapshot.delivery.status}`);
          return { prepared, delivery: snapshot.delivery };
        },
        logRecoveryPending: () => assert.fail("recovery completed"),
      },
    );
    assert.deepEqual(result, { status: "recovered", delivery });
    assert.deepEqual(calls, ["finalize:partial"]);
  });

  it("atomically finalizes pending-only delivery as uncertain without evidence", async () => {
    const delivery = {
      status: "uncertain" as const,
      deliveredChannel: null,
      deliveredCount: 0,
      failedCount: 0,
    };
    const result = await recoverPreparedResearchBriefFromDurableDelivery(
      { familyId: "family-1", taskRunId: "run-1" },
      {
        loadDelivery: async () => ({ messageId: "message-1", delivery }),
        finalize: async (snapshot) => {
          assert.equal(snapshot.delivery.status, "uncertain");
          return { prepared, delivery: snapshot.delivery };
        },
        logRecoveryPending: () => assert.fail("uncertain is terminal"),
      },
    );
    assert.deepEqual(result, { status: "recovered", delivery });
  });

  it("atomically finalizes all-failed attempts without evidence", async () => {
    const delivery = aggregateResearchBriefDeliveryAttempts([
      {
        recipientKey: "member-1",
        channel: "sms",
        status: "failed",
      },
      {
        recipientKey: "member-2",
        channel: "email",
        status: "failed",
      },
    ]);
    const result = await recoverPreparedResearchBriefFromDurableDelivery(
      { familyId: "family-1", taskRunId: "run-1" },
      {
        loadDelivery: async () => ({ messageId: "message-1", delivery }),
        finalize: async (snapshot) => {
          assert.equal(snapshot.delivery.status, "failed");
          return { prepared, delivery: snapshot.delivery };
        },
        logRecoveryPending: () => assert.fail("failed is terminal"),
      },
    );
    assert.deepEqual(result, {
      status: "recovered",
      delivery: {
        status: "failed",
        deliveredChannel: null,
        deliveredCount: 0,
        failedCount: 2,
      },
    });
  });

  it("does not persist or transport a v2 brief without preparation", async () => {
    const calls: string[] = [];
    const result = await deliverPreparedResearchBrief(
      {
        familyId: "family-1",
        taskRunId: "run-1",
        state: { transportAccepted: false, delivered: false },
      },
      {
        loadPrepared: async () => null,
        persistCanonical: async () => {
          calls.push("persist");
          return { id: "message-1", episodeId: "episode-1" };
        },
        deliver: async () => {
          calls.push("deliver");
          return {
            status: "done",
            deliveredCount: 1,
            deliveredChannel: "sms",
            failedCount: 0,
          };
        },
        recordAcceptance: async () => {
          calls.push("accepted");
        },
        finalize: async () => {
          calls.push("finalize");
          return {
            prepared,
            delivery: {
              status: "done",
              deliveredCount: 1,
              deliveredChannel: "sms",
              failedCount: 0,
            },
          };
        },
        failRun: async () => {
          calls.push("failed");
        },
        logRecoveryPending: () => calls.push("recovery-pending"),
      },
    );

    assert.deepEqual(result, { status: "failed_before_transport" });
    assert.deepEqual(calls, ["failed"]);
  });

  it("persists and delivers only the stored prepared draft", async () => {
    const persisted: string[] = [];
    const delivered: string[] = [];
    const state = { transportAccepted: false, delivered: false };
    let finalized = false;
    const result = await deliverPreparedResearchBrief(
      { familyId: "family-1", taskRunId: "run-1", state },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async (text) => {
          persisted.push(text);
          return { id: "message-1", episodeId: "episode-1" };
        },
        deliver: async (text, _message, markTransportAccepted) => {
          delivered.push(text);
          markTransportAccepted();
          return {
            status: "done",
            deliveredCount: 1,
            deliveredChannel: "sms",
            failedCount: 0,
          };
        },
        recordAcceptance: async () => undefined,
        finalize: async (_prepared, message) => {
          assert.equal(message.id, "message-1");
          assert.equal(state.delivered, false);
          finalized = true;
          return {
            prepared,
            delivery: {
              status: "done",
              deliveredCount: 1,
              deliveredChannel: "sms",
              failedCount: 0,
            },
          };
        },
        failRun: async () => assert.fail("should not fail"),
        logRecoveryPending: () => assert.fail("should not need recovery"),
      },
    );

    assert.deepEqual(result, {
      status: "completed",
      prepared,
      message: { id: "message-1", episodeId: "episode-1" },
      delivery: {
        status: "done",
        deliveredCount: 1,
        deliveredChannel: "sms",
        failedCount: 0,
      },
    });
    assert.equal(finalized, true);
    assert.deepEqual(persisted, [prepared.draft]);
    assert.deepEqual(delivered, [prepared.draft]);
    assert.deepEqual(state, { transportAccepted: true, delivered: true });
  });

  it("falls back from definitive SMS rejection to email with the prepared draft", async () => {
    const ledger = new InMemoryDeliveryLedger();
    const smsBodies: string[] = [];
    const emailBodies: string[] = [];
    const state = { transportAccepted: false, delivered: false };

    const result = await deliverPreparedResearchBrief(
      { familyId: "family-1", taskRunId: "run-1", state },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async () => ({
          id: "message-1",
          episodeId: "episode-1",
        }),
        deliver: async (draft, message, markTransportAccepted) => {
          return await deliverTaskMessage(
            {
              familyId: prepared.familyId,
              episodeId: message.episodeId,
              messageId: message.id,
              taskRunId: prepared.taskRunId,
              kind: "morning_brief",
              text: draft,
              recipients: [
                {
                  recipientKey: "member-1",
                  memberUserId: "member-1",
                  displayName: "Parent",
                  phoneNumbers: ["+15550000001"],
                  email: "parent@example.test",
                },
              ],
            },
            {
              ledger,
              transports: {
                sendSms: async (_phone, text) => {
                  smsBodies.push(text);
                  return { status: "rejected", reason: "provider rejected" };
                },
                sendEmail: async (_email, text) => {
                  emailBodies.push(text);
                  return {
                    status: "submitted",
                    providerSubmissionId: "email-1",
                    retrieveProviderMessageId: async () => null,
                  };
                },
              },
              onTransportAccepted: () => markTransportAccepted(),
            },
          );
        },
        recordAcceptance: async () => undefined,
        finalize: async () => ({
          prepared,
          delivery: {
            status: "done",
            deliveredCount: 1,
            deliveredChannel: "email",
            failedCount: 0,
          },
        }),
        failRun: async () => assert.fail("email fallback succeeded"),
        logRecoveryPending: () => assert.fail("email fallback finalized"),
      },
    );

    assert.equal(result.status, "completed");
    if (result.status !== "completed") assert.fail("delivery did not complete");
    assert.equal(result.delivery.deliveredChannel, "email");
    assert.deepEqual(smsBodies, [prepared.draft]);
    assert.deepEqual(emailBodies, [prepared.draft]);
    assert.deepEqual(state, { transportAccepted: true, delivered: true });
  });

  it("does not finalize source or observation effects after every delivery fails", async () => {
    let finalized = false;
    const result = await deliverPreparedResearchBrief(
      {
        familyId: "family-1",
        taskRunId: "run-1",
        state: { transportAccepted: false, delivered: false },
      },
      {
        loadPrepared: async () => prepared,
        persistCanonical: async () => ({
          id: "message-1",
          episodeId: "episode-1",
        }),
        deliver: async () => ({
          status: "failed",
          deliveredCount: 0,
          deliveredChannel: null,
          failedCount: 1,
        }),
        recordAcceptance: async () => assert.fail("nothing was accepted"),
        finalize: async () => {
          finalized = true;
          return {
            prepared,
            delivery: {
              status: "failed",
              deliveredCount: 0,
              deliveredChannel: null,
              failedCount: 1,
            },
          };
        },
        failRun: async () => undefined,
        logRecoveryPending: () => assert.fail("nothing was accepted"),
      },
    );

    assert.deepEqual(result, {
      status: "delivery_not_accepted",
      delivery: {
        status: "failed",
        deliveredCount: 0,
        deliveredChannel: null,
        failedCount: 1,
      },
    });
    assert.equal(finalized, true);
  });
});
