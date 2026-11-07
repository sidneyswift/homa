import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessagePart } from "eve/react";

import { parseStateRecordsCardPart } from "./state-records-card-model";

function toolPart(output: unknown, toolName = "open_state_records"): EveMessagePart {
  return { type: "dynamic-tool", toolName, toolCallId: "t1", state: "output-available", input: {}, output } as unknown as EveMessagePart;
}

describe("state records card in chat", () => {
  it("draws for a result that really opened", () => {
    assert.deepEqual(parseStateRecordsCardPart(toolPart({ opened: true, action: "generate_pack", state: "OH" })), { action: "generate_pack" });
  });

  it("draws nothing when nothing opened or the action is unknown", () => {
    assert.equal(parseStateRecordsCardPart(toolPart({ opened: false, error: "no_state" })), null);
    assert.equal(parseStateRecordsCardPart(toolPart({ opened: false, error: "no_native_view" })), null);
    assert.equal(parseStateRecordsCardPart(toolPart({ opened: true, action: "submit_to_state" })), null);
    assert.equal(parseStateRecordsCardPart(toolPart({ opened: true, action: "view" }, "open_planner")), null);
  });
});
