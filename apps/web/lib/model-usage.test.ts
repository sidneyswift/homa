import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  USAGE_SURFACES,
  usageSurfaceFromAttributes,
} from "./model-usage";

describe("model usage surfaces", () => {
  it("registers morning briefs for reporting and Gateway attribution", () => {
    assert.ok(USAGE_SURFACES.includes("morning_brief"));
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
