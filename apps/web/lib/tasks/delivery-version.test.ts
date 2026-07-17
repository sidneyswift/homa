import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deliveryVersionForNewTaskRun,
  usesResearchBriefV2Delivery,
} from "./delivery-version";

describe("task-run delivery version", () => {
  it("pins v2 only for a morning brief whose creation flag is exactly true", () => {
    assert.equal(
      deliveryVersionForNewTaskRun("morning_brief", {
        HOMA_RESEARCH_BRIEF_V2_ENABLED: "true",
      }),
      "research_brief_v2",
    );
    assert.equal(
      deliveryVersionForNewTaskRun("morning_brief", {
        HOMA_RESEARCH_BRIEF_V2_ENABLED: "false",
      }),
      "legacy",
    );
    assert.equal(
      deliveryVersionForNewTaskRun("custom", {
        HOMA_RESEARCH_BRIEF_V2_ENABLED: "true",
      }),
      "legacy",
    );
  });

  it("uses only the persisted version after run creation", () => {
    assert.equal(usesResearchBriefV2Delivery("research_brief_v2"), true);
    assert.equal(usesResearchBriefV2Delivery("legacy"), false);
  });
});
