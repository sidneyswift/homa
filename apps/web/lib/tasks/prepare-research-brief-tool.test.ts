import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEnabledMorningResearchBriefDispatch,
  prepareResearchBriefDispatchFailure,
} from "../../agent/tools/prepare_research_brief";

interface DispatchAttributes {
  channel?: string;
  familyId?: string;
  taskRunId?: string;
  taskKind?: string;
  deliveryVersion?: string;
}

const VALID_ATTRIBUTES: DispatchAttributes = {
  channel: "dispatch",
  familyId: "family-1",
  taskRunId: "run-1",
  taskKind: "morning_brief",
  deliveryVersion: "research_brief_v2",
};

describe("prepare_research_brief dispatch guard", () => {
  it("uses the pinned delivery version after either feature-flag flip", () => {
    assert.equal(
      isEnabledMorningResearchBriefDispatch(VALID_ATTRIBUTES),
      true,
    );
    assert.equal(
      isEnabledMorningResearchBriefDispatch(
        { ...VALID_ATTRIBUTES, deliveryVersion: "legacy" },
      ),
      false,
    );
  });

  it("requires authenticated morning dispatch attributes", () => {
    for (const attributes of [
      { ...VALID_ATTRIBUTES, channel: "chat" },
      { ...VALID_ATTRIBUTES, taskKind: "custom" },
      { ...VALID_ATTRIBUTES, familyId: undefined },
      { ...VALID_ATTRIBUTES, taskRunId: undefined },
      { ...VALID_ATTRIBUTES, deliveryVersion: undefined },
    ]) {
      assert.equal(
        isEnabledMorningResearchBriefDispatch(attributes),
        false,
      );
    }
  });

  it("returns a typed terminal failure outside a pinned v2 morning dispatch", () => {
    assert.deepEqual(prepareResearchBriefDispatchFailure(), {
      ok: false,
      retryable: false,
      category: "dispatch_unavailable",
      errors: [
        "prepare_research_brief requires enabled v2 and an authenticated morning dispatch run",
      ],
    });
  });
});
