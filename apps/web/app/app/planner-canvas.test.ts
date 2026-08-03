import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import {
  latestPlannerOpen,
  parsePlannerOpenPart,
  planEditCount,
} from "./planner-canvas";

/**
 * The canvas's open signal is an open_planner tool-output part, exactly
 * the snap-card seam: these tests pin the parse rules so a refusal, an
 * error result, or a half-streamed call can never open the panel.
 */

function toolPart(
  toolName: string,
  output: Record<string, unknown> | undefined,
  state = "output-available",
): EveMessagePart {
  return { type: "dynamic-tool", toolName, state, output } as EveMessagePart;
}

function assistantMessage(id: string, parts: EveMessagePart[]): EveMessage {
  return { id, role: "assistant", parts } as EveMessage;
}

describe("parsePlannerOpenPart", () => {
  it("accepts a finished open with a child focus", () => {
    const signal = parsePlannerOpenPart(
      toolPart("open_planner", { opened: true, childId: "kid-1" }),
    );
    assert.deepEqual(signal, { childId: "kid-1" });
  });

  it("treats a family-wide open as a null focus", () => {
    const signal = parsePlannerOpenPart(toolPart("open_planner", { opened: true }));
    assert.deepEqual(signal, { childId: null });
  });

  it("rejects errors, other tools, and unfinished calls", () => {
    assert.equal(
      parsePlannerOpenPart(toolPart("open_planner", { error: "no_family" })),
      null,
    );
    assert.equal(
      parsePlannerOpenPart(toolPart("edit_plan", { updated: true })),
      null,
    );
    assert.equal(
      parsePlannerOpenPart(
        toolPart("open_planner", undefined, "input-available"),
      ),
      null,
    );
  });
});

describe("latestPlannerOpen", () => {
  it("returns the newest open across the session with its part key", () => {
    const messages = [
      assistantMessage("m1", [toolPart("open_planner", { opened: true, childId: "a" })]),
      { id: "u1", role: "user", parts: [] } as unknown as EveMessage,
      assistantMessage("m2", [
        toolPart("edit_plan", { updated: true, summary: "x" }),
        toolPart("open_planner", { opened: true, childId: "b" }),
      ]),
    ];
    const latest = latestPlannerOpen(messages);
    assert.ok(latest);
    assert.equal(latest.partKey, "m2:1");
    assert.equal(latest.signal.childId, "b");
  });

  it("is null when the session never opened the planner", () => {
    assert.equal(latestPlannerOpen([]), null);
  });
});

describe("planEditCount", () => {
  it("counts only applied edit_plan results", () => {
    const messages = [
      assistantMessage("m1", [
        toolPart("edit_plan", { updated: true, summary: "a" }),
        toolPart("edit_plan", { error: "no_plan" }),
        toolPart("edit_plan", undefined, "input-available"),
        toolPart("edit_plan", { updated: true, summary: "b" }),
      ]),
    ];
    assert.equal(planEditCount(messages), 2);
  });

  it("counts every plan-writing tool, not just edit_plan (issue #257)", () => {
    // A scheduled date is a plan write the parent should watch land on
    // the panel; before B0 the canvas refreshed only on edit_plan, so
    // Homa could schedule math to Tuesday while the board sat still.
    const messages = [
      assistantMessage("m1", [
        toolPart("edit_plan", { updated: true, summary: "a" }),
        toolPart("schedule_plan_activity", {
          scheduled: true,
          scheduledDate: "2026-07-28",
        }),
        toolPart("schedule_plan_activity", { scheduled: false, note: "no plan" }),
        toolPart("schedule_plan_activity", undefined, "input-available"),
      ]),
    ];
    assert.equal(planEditCount(messages), 2);
  });

  it("never counts reads or other tools", () => {
    const messages = [
      assistantMessage("m1", [
        toolPart("open_planner", { opened: true }),
        toolPart("list_family_events", { events: [] }),
        toolPart("add_family_event", { added: true }),
      ]),
    ];
    assert.equal(planEditCount(messages), 0);
  });
});

describe("Planner canvas request ordering", () => {
  it("allows only the newest board request to update the panel", () => {
    const source = readFileSync(
      new URL("./planner-canvas.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /latestBoardRequestRef\.current !== requestId/u);
    assert.match(source, /latestBoardRequestRef\.current \+= 1/u);
  });
});
