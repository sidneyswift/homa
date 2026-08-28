import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderHoursCsv, type HoursExportRow } from "./hours-export";

const ROW: HoursExportRow = {
  happenedOn: "2026-08-14",
  childName: "Maya",
  subject: "math",
  customLabel: null,
  minutes: 45,
  source: "chat",
  note: 'Fractions, cups, and "quarters"',
};

describe("renderHoursCsv", () => {
  it("renders a spreadsheet-ready record with exact durations", () => {
    const csv = renderHoursCsv([ROW, { ...ROW, childName: null, minutes: 60, note: null }]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /"Date","Child","Subject","Minutes","Hours","Source","Note"/u);
    assert.match(csv, /"Maya","Math","45","0\.75","chat"/u);
    assert.match(csv, /"Whole family","Math","60","1","chat",""/u);
    assert.match(csv, /"Fractions, cups, and ""quarters"""/u);
  });

  it("exports her own word for an other block instead of the generic bucket", () => {
    const csv = renderHoursCsv([{ ...ROW, subject: "other", customLabel: "Portuguese" }]);
    assert.match(csv, /"Maya","Portuguese","45"/u);
  });

  it("neutralizes spreadsheet formulas in parent-written fields", () => {
    const csv = renderHoursCsv([{ ...ROW, childName: "=2+2", note: "@SUM(A1:A2)" }]);
    assert.match(csv, /"'=2\+2"/u);
    assert.match(csv, /"'@SUM\(A1:A2\)"/u);
  });
});
