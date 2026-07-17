import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  PreparedResearchBriefAggregateRecoveryResult,
  PreparedResearchBriefDeliveryResult,
} from "./research-brief-delivery";
import {
  emitResearchBriefDispatchCompletion,
  emitResearchBriefRecoveryCompletion,
} from "./research-brief-events";

const doneDelivery = {
  status: "done" as const,
  deliveredChannel: "sms" as const,
  deliveredCount: 1,
  failedCount: 0,
};

describe("morning research brief completion events", () => {
  it("emits normal durable completion once and ignores the replay result", async () => {
    const events: Array<{ name: string; props: object }> = [];
    const emit = async (name: string, props: object) => {
      events.push({ name, props });
    };
    const completed = {
      status: "completed",
      prepared: {
        familyId: "family-1",
        taskRunId: "run-1",
        childId: "child-1",
        knowledgeId: "knowledge-1",
        draft: "draft",
        sourceSnapshot: {
          kind: "knowledge_cited",
          id: "knowledge-1",
          title: "Research",
          sourceNames: ["Source"],
          citationUrls: ["https://example.test"],
          topic: "reading",
          claims: ["Claim"],
          topicType: "subject",
          lens: "current_study",
          stage: "early_elem",
          confidence: "high",
          sourceTier: 1,
        },
      },
      message: { id: "message-1", episodeId: "episode-1" },
      delivery: doneDelivery,
    } satisfies PreparedResearchBriefDeliveryResult;

    await emitResearchBriefDispatchCompletion(
      "family-1",
      completed,
      emit,
    );
    await emitResearchBriefDispatchCompletion(
      "family-1",
      { status: "failed_before_transport" },
      emit,
    );

    assert.deepEqual(events, [
      {
        name: "tasks.run_completed",
        props: {
          family_id: "family-1",
          kind: "morning_brief",
          status: "done",
        },
      },
      {
        name: "research.brief_sent",
        props: { family_id: "family-1", channel: "sms" },
      },
    ]);
  });

  it("emits recovery completion once and ignores not-found replay", async () => {
    const events: Array<{ name: string; props: object }> = [];
    const emit = async (name: string, props: object) => {
      events.push({ name, props });
    };
    const recovered = {
      status: "recovered",
      delivery: {
        status: "partial_uncertain",
        deliveredChannel: "email",
        deliveredCount: 1,
        failedCount: 0,
      },
    } satisfies PreparedResearchBriefAggregateRecoveryResult;

    await emitResearchBriefRecoveryCompletion(
      "family-1",
      recovered,
      emit,
    );
    await emitResearchBriefRecoveryCompletion(
      "family-1",
      { status: "not_found" },
      emit,
    );

    assert.deepEqual(events, [
      {
        name: "tasks.run_completed",
        props: {
          family_id: "family-1",
          kind: "morning_brief",
          status: "partial_uncertain",
        },
      },
      {
        name: "research.brief_sent",
        props: { family_id: "family-1", channel: "email" },
      },
    ]);
  });

  it("emits only task completion for failed and save-only outcomes", async () => {
    const events: Array<{ name: string; props: object }> = [];
    const emit = async (name: string, props: object) => {
      events.push({ name, props });
    };
    for (const delivery of [
      {
        status: "failed" as const,
        deliveredChannel: null,
        deliveredCount: 0,
        failedCount: 1,
      },
      {
        status: "done" as const,
        deliveredChannel: "none" as const,
        deliveredCount: 1,
        failedCount: 0,
      },
    ]) {
      await emitResearchBriefDispatchCompletion(
        "family-1",
        { status: "delivery_not_accepted", delivery },
        emit,
      );
    }
    assert.deepEqual(
      events.map((event) => event.name),
      ["tasks.run_completed", "tasks.run_completed"],
    );
  });

  it("uses every durable normal-path status and sends only confirmed transport events", async () => {
    const events: Array<{ name: string; props: Record<string, unknown> }> = [];
    const emit = async (
      name: string,
      props: Record<string, unknown>,
    ) => {
      events.push({ name, props });
    };
    const deliveries = [
      {
        status: "done" as const,
        deliveredChannel: "sms" as const,
        deliveredCount: 1,
        failedCount: 0,
      },
      {
        status: "partial" as const,
        deliveredChannel: "email" as const,
        deliveredCount: 1,
        failedCount: 1,
      },
      {
        status: "partial_uncertain" as const,
        deliveredChannel: "sms" as const,
        deliveredCount: 1,
        failedCount: 0,
      },
      {
        status: "uncertain" as const,
        deliveredChannel: null,
        deliveredCount: 0,
        failedCount: 0,
      },
      {
        status: "failed" as const,
        deliveredChannel: null,
        deliveredCount: 0,
        failedCount: 1,
      },
    ];
    for (const [index, delivery] of deliveries.entries()) {
      const result: PreparedResearchBriefDeliveryResult =
        delivery.deliveredCount > 0
          ? {
              status: "completed",
              prepared: {
                familyId: "family-1",
                taskRunId: `run-${index}`,
                childId: "child-1",
                knowledgeId: "knowledge-1",
                draft: "draft",
                sourceSnapshot: {
                  kind: "knowledge_cited",
                  id: "knowledge-1",
                  title: "Research",
                  sourceNames: ["Source"],
                  citationUrls: ["https://example.test"],
                  topic: "reading",
                  claims: ["Claim"],
                  topicType: "subject",
                  lens: "current_study",
                  stage: "early_elem",
                  confidence: "high",
                  sourceTier: 1,
                },
              },
              message: {
                id: `message-${index}`,
                episodeId: "episode-1",
              },
              delivery,
            }
          : { status: "delivery_not_accepted", delivery };
      await emitResearchBriefDispatchCompletion("family-1", result, emit);
    }

    assert.deepEqual(
      events
        .filter((event) => event.name === "tasks.run_completed")
        .map((event) => event.props.status),
      ["done", "partial", "partial_uncertain", "uncertain", "failed"],
    );
    assert.deepEqual(
      events
        .filter((event) => event.name === "research.brief_sent")
        .map((event) => event.props.channel),
      ["sms", "email", "sms"],
    );
  });
});
