import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  modelUsageAttributionError,
  USAGE_RESOURCE_KINDS,
  USAGE_SURFACES,
  usageSurfaceFromAttributes,
} from "./model-usage";

describe("model usage surfaces", () => {
  it("registers morning briefs for reporting and Gateway attribution", () => {
    assert.ok(USAGE_SURFACES.includes("morning_brief"));
  });

  it("keeps the resource attribution vocabulary closed", () => {
    assert.deepEqual(USAGE_RESOURCE_KINDS, [
      "attachment",
      "call_transcript",
      "conversation_message",
      "curriculum",
      "family",
      "family_asset",
      "family_memory",
      "inbound_message",
      "lesson",
      "lesson_media",
      "lesson_segment",
      "learning_review",
      "material",
      "month_plan",
      "progress_report",
      "semantic_search",
    ]);
  });

  it("requires either a session or a complete resource identity", () => {
    assert.equal(
      modelUsageAttributionError({
        sessionId: "session-1",
        turnId: "turn-1",
        resourceKind: null,
        resourceId: null,
      }),
      null,
    );
    assert.equal(
      modelUsageAttributionError({
        sessionId: null,
        turnId: null,
        resourceKind: "material",
        resourceId: "material-1",
      }),
      null,
    );
    assert.equal(
      modelUsageAttributionError({
        sessionId: null,
        turnId: "turn-1",
        resourceKind: null,
        resourceId: null,
      } as never),
      "turn_id requires session_id",
    );
    assert.equal(
      modelUsageAttributionError({
        sessionId: null,
        turnId: null,
        resourceKind: null,
        resourceId: null,
      } as never),
      "session_id or resource attribution is required",
    );
  });

  it("classifies an authenticated morning brief task by task kind", () => {
    assert.equal(
      usageSurfaceFromAttributes({
        channel: "dispatch",
        familyId: "family-1",
        taskRunId: "run-1",
        taskKind: "morning_brief",
        deliveryVersion: "research_brief_v2",
      }),
      "morning_brief",
    );
  });

  it("keeps other channels, missing identity, and generic dispatch as chat", () => {
    const cases = [
      {
        channel: "web",
        familyId: "family-1",
        taskRunId: "run-1",
        taskKind: "morning_brief",
      },
      {
        channel: "sms",
        familyId: "family-1",
        taskRunId: "run-1",
        taskKind: "morning_brief",
      },
      {
        channel: "email",
        familyId: "family-1",
        taskRunId: "run-1",
        taskKind: "morning_brief",
      },
      {
        channel: "dispatch",
        taskRunId: "run-1",
        taskKind: "morning_brief",
      },
      {
        channel: "dispatch",
        familyId: "",
        taskRunId: "run-1",
        taskKind: "morning_brief",
      },
      {
        channel: "dispatch",
        familyId: "family-1",
        taskKind: "morning_brief",
      },
      {
        channel: "dispatch",
        familyId: "family-1",
        taskRunId: "",
        taskKind: "morning_brief",
      },
      {
        channel: "dispatch",
        familyId: "family-1",
        taskRunId: "run-1",
        taskKind: "journal_prompt",
        deliveryVersion: "research_brief_v2",
      },
      {
        channel: "dispatch",
        familyId: "family-1",
        taskRunId: "run-1",
        taskKind: "morning_brief",
        deliveryVersion: "legacy",
      },
      {
        channel: "dispatch",
        familyId: "family-1",
        taskRunId: "run-1",
      },
      undefined,
    ];

    for (const attributes of cases) {
      assert.equal(usageSurfaceFromAttributes(attributes), "chat");
    }
  });
});
