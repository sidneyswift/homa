import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import { busyLabel, chipDate, memoryChipFor } from "./message-parts";

/**
 * The planner-family receipts and busy labels (issue #257, arc PR B0).
 * Before B0, schedule_plan_activity and all four event tools rendered
 * NOTHING in the transcript: no busy label while running, no
 * named-effect chip after, breaking the MJ-02 visible-effect pattern
 * that remember/edit_plan/log_hours already carry. These tests pin the
 * chip predicates (success flags only, never errors or streams) and
 * the label coverage, so a renamed output field cannot silently return
 * the tools to invisibility.
 */

function toolPart(
  toolName: string,
  output: Record<string, unknown> | undefined,
  state = "output-available",
): EveMessagePart {
  return { type: "dynamic-tool", toolName, state, output } as EveMessagePart;
}

describe("chipDate", () => {
  it("renders the calendar day the string names, never the UTC eve", () => {
    // new Date("2026-07-28") is midnight UTC, which is July 27 in any
    // US timezone; the chip must say the day the parent scheduled.
    assert.equal(chipDate("2026-07-28").includes("28"), true);
    assert.equal(chipDate("2026-07-28").includes("Jul"), true);
  });
});

describe("planner-family receipt chips", () => {
  it("schedule_plan_activity gets a named-effect chip with day and activity", () => {
    const chip = memoryChipFor(
      toolPart("schedule_plan_activity", {
        scheduled: true,
        activityText: "Count to 20 out loud",
        scheduledDate: "2026-07-28",
      }),
    );
    assert.ok(chip);
    assert.equal(chip.label, "Scheduled");
    assert.equal(chip.detail?.includes("Count to 20 out loud"), true);
    assert.equal(chip.detail?.includes("28"), true);
  });

  it("add_family_event gets a chip naming the event and its day", () => {
    const chip = memoryChipFor(
      toolPart("add_family_event", {
        added: true,
        eventId: "e1",
        title: "Dentist appointment",
        startsOn: "2026-07-29",
      }),
    );
    assert.ok(chip);
    assert.equal(chip.label, "On the calendar");
    assert.equal(chip.detail?.includes("Dentist appointment"), true);
  });

  it("update_family_event gets a chip naming the event", () => {
    const chip = memoryChipFor(
      toolPart("update_family_event", {
        updated: true,
        event: { title: "Dentist appointment" },
      }),
    );
    assert.ok(chip);
    assert.equal(chip.label, "Calendar updated");
    assert.equal(chip.detail, "Dentist appointment");
  });

  it("remove_family_event gets a chip naming what came off", () => {
    const chip = memoryChipFor(
      toolPart("remove_family_event", { removed: true, title: "Co-op day" }),
    );
    assert.ok(chip);
    assert.equal(chip.label, "Off the calendar");
    assert.equal(chip.detail, "Co-op day");
  });

  it("curriculum approval gets an exact units-and-additions receipt", () => {
    const chip = memoryChipFor(
      toolPart("approve_curriculum_mapping", {
        approved: true,
        unitAssets: [{ id: "unit-1" }, { id: "unit-2" }],
        plannerTargets: [{ week: 1 }],
      }),
    );
    assert.deepEqual(chip, {
      label: "Units saved",
      detail: "2 units · 1 Planner addition",
    });
  });

  it("failures, refusals, and unfinished calls never chip", () => {
    assert.equal(
      memoryChipFor(toolPart("schedule_plan_activity", { scheduled: false, note: "no plan" })),
      null,
    );
    assert.equal(
      memoryChipFor(toolPart("add_family_event", { added: false, note: "bad date" })),
      null,
    );
    assert.equal(
      memoryChipFor(toolPart("update_family_event", { updated: false, note: "not found" })),
      null,
    );
    assert.equal(
      memoryChipFor(toolPart("remove_family_event", { removed: false, note: "not found" })),
      null,
    );
    assert.equal(
      memoryChipFor(toolPart("schedule_plan_activity", undefined, "input-available")),
      null,
    );
    // list is a read: label only, never a receipt.
    assert.equal(memoryChipFor(toolPart("list_family_events", { events: [] })), null);
  });
});

describe("planner-family busy labels", () => {
  function labelWhileRunning(toolName: string): string | null {
    const message = {
      id: "m1",
      role: "assistant",
      parts: [toolPart(toolName, undefined, "input-available")],
    } as unknown as EveMessage;
    return busyLabel([message]);
  }

  it("every planner-family tool names its work while running", () => {
    assert.equal(labelWhileRunning("schedule_plan_activity"), "putting it on the calendar…");
    assert.equal(labelWhileRunning("add_family_event"), "adding it to the calendar…");
    assert.equal(labelWhileRunning("update_family_event"), "updating the calendar…");
    assert.equal(labelWhileRunning("remove_family_event"), "taking it off the calendar…");
    assert.equal(labelWhileRunning("list_family_events"), "checking the calendar…");
    assert.equal(
      labelWhileRunning("approve_curriculum_mapping"),
      "saving what you approved…",
    );
  });
});
