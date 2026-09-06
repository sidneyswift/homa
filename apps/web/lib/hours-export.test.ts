import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderHoursCsv, type HoursExportRow } from "./hours-export";

const ROW: HoursExportRow = {
  id: "33333333-3333-4333-8333-333333333333",
  childId: "11111111-1111-4111-8111-111111111111",
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
    const csv = renderHoursCsv([ROW, { ...ROW, childId: null, childName: null, minutes: 60, note: null }]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /"Date","Child","Child ID","Subject","Category","Minutes","Hours","Source","Note","Entry ID"/u);
    assert.match(csv, /"Maya","11111111-1111-4111-8111-111111111111","Math","","45","0\.75","chat"/u);
    assert.match(csv, /"Whole family","","Math","","60","1","chat",""/u);
    assert.match(csv, /"Fractions, cups, and ""quarters"""/u);
  });

  it("exports her own word for an other block instead of the generic bucket", () => {
    const csv = renderHoursCsv([{ ...ROW, subject: "other", customLabel: "Portuguese" }]);
    assert.match(csv, /"Other","Portuguese","45"/u);
  });

  it("neutralizes spreadsheet formulas in parent-written fields", () => {
    const csv = renderHoursCsv([{ ...ROW, childName: "=2+2", note: "@SUM(A1:A2)" }]);
    assert.match(csv, /"'=2\+2"/u);
    assert.match(csv, /"'@SUM\(A1:A2\)"/u);
  });
});
