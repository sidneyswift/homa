import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import { latestReportOpen, parseReportOpenPart } from "./report-open";

function toolPart(
  output: Record<string, unknown> | undefined,
  state: "input-available" | "output-available" = "output-available",
): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolName: "open_progress_report",
    state,
    output,
  } as unknown as EveMessagePart;
}

function assistantMessage(id: string, parts: EveMessagePart[]): EveMessage {
  return { id, role: "assistant", parts } as EveMessage;
}

describe("parseReportOpenPart", () => {
  it("accepts a completed authenticated report open", () => {
    assert.deepEqual(parseReportOpenPart(toolPart({ opened: true, childId: "kid-1" })), {
      childId: "kid-1",
    });
  });

  it("rejects an unresolved or failed report action", () => {
    assert.equal(parseReportOpenPart(toolPart({ opened: false, childId: "kid-1" })), null);
    assert.equal(parseReportOpenPart(toolPart({ opened: true }, "input-available")), null);
  });
});

describe("latestReportOpen", () => {
  it("uses only the newest successful report action", () => {
    const latest = latestReportOpen([
      assistantMessage("m1", [toolPart({ opened: true, childId: "first" })]),
      { id: "u1", role: "user", parts: [] } as unknown as EveMessage,
      assistantMessage("m2", [toolPart({ opened: true, childId: "second" })]),
    ]);
    assert.deepEqual(latest, { partKey: "m2:0", signal: { childId: "second" } });
  });
});
