import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CalendarExportItem } from "./device-calendar-export";
import { calendarExportFingerprint } from "./device-calendar-export";
import { outcomeResults, saveCalendarExports } from "./device-calendar-runner";

function item(sourceKey: string): CalendarExportItem {
  return {
    sourceKey,
    sourceKind: "family-event",
    title: sourceKey,
    startsOn: "2026-08-10",
    endsOn: "2026-08-10",
    startTime: null,
    endTime: null,
    timeZone: "America/New_York",
    notes: null,
    childScope: "Whole family",
    recurrence: null,
  };
}

describe("device calendar export outcomes", () => {
  it("reports saved, duplicate, and failed items independently", async () => {
    const saved = item("family-event/saved");
    const duplicate = item("family-event/duplicate");
    const failed = item("family-event/failed");
    const remembered: string[] = [];
    const results = await saveCalendarExports(
      "family-1",
      [saved, duplicate, failed],
      new Set([calendarExportFingerprint(duplicate)]),
      {
        id: "calendar-1",
        title: "Family",
        async create(payload) {
          if (payload.title.includes("failed")) throw new Error("Device rejected the event.");
          return "device-event-1";
        },
      },
      async (_familyId, fingerprint) => {
        remembered.push(fingerprint);
      },
    );
    assert.deepEqual(results.map((result) => result.outcome), ["saved", "duplicate", "failed"]);
    assert.deepEqual(remembered, [calendarExportFingerprint(saved)]);
  });

  it("reports denial and cancellation without claiming a save", () => {
    const events = [item("one"), item("two")];
    assert.deepEqual(outcomeResults(events, "denied", "No access.").map((result) => result.outcome), ["denied", "denied"]);
    assert.deepEqual(outcomeResults(events, "canceled", "No calendar chosen.").map((result) => result.outcome), ["canceled", "canceled"]);
  });

  it("keeps a successful device write saved when the durable ledger fails", async () => {
    const exported = item("family-event/ledger-failure");
    let createCount = 0;
    const destination = {
      id: "calendar-1",
      title: "Family",
      async create() {
        createCount += 1;
        return "device-event-1";
      },
    };
    const remember = async () => {
      throw new Error("Storage unavailable.");
    };

    const first = await saveCalendarExports(
      "family-ledger-failure",
      [exported],
      new Set(),
      destination,
      remember,
    );
    assert.equal(first[0]?.outcome, "saved");
    assert.match(first[0]?.detail ?? "", /could not record duplicate protection/);

    const retry = await saveCalendarExports(
      "family-ledger-failure",
      [exported],
      new Set(),
      destination,
      remember,
    );
    assert.equal(retry[0]?.outcome, "duplicate");
    assert.equal(retry[0]?.detail, "Already saved in this Homa session.");
    assert.equal(createCount, 1);
  });
});
