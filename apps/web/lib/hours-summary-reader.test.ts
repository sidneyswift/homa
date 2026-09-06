import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readHoursSummaryCaller, validateHoursSummaryRecord, type HoursSummaryRecord } from "./hours-summary-reader";

const familyId = "a1111111-1111-4111-8111-111111111111";
const childId = "b2222222-2222-4222-8222-222222222222";
const foreignId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-09-10T04:30:00Z");
const request = { period: "school_year" as const };
function record(): HoursSummaryRecord {
  return {
    status: "ready", familyId, timeZone: "America/New_York", schoolYearStartOn: "2020-09-10", today: "2026-09-10",
    window: { from: "2026-09-10", through: "2026-09-10", period: "school_year", schoolYearFallback: false },
    children: [{ id: childId, name: "Avery" }], entryCount: 4001, totalMinutes: 4001, recordedDays: 1,
    firstDay: "2026-09-10", lastDay: "2026-09-10", byEntryScope: [{ childId, minutes: 4001 }],
    bySubject: [{ subject: "math", minutes: 4001 }],
    recordedDaysByChild: [{ childId, childName: "Avery", recordedDays: 1, minutes: 4001 }],
    entries: Array.from({ length: 20 }, (_, index) => ({ childId, subject: "math", minutes: 1, happenedOn: "2026-09-10", source: "chat", note: `Sample ${index}`, noteTruncated: false })),
  };
}
const invalidReceipt = (error: unknown) => Boolean(error && typeof error === "object" && "reason" in error && error.reason === "invalid_receipt");

describe("complete Hours summary receipts", () => {
  it("accepts full4001-entry totals independently of the bounded20-entry sample", () => {
    const result = validateHoursSummaryRecord(record(), familyId, request, now);
    assert.equal(result.totalMinutes, 4001);
    assert.equal(result.entries.reduce((sum, entry) => sum + entry.minutes, 0), 20);
  });
  it("preserves every persisted source and refuses invented sources", () => {
    for (const source of ["chat", "sms", "call", "email", "dispatch"]) {
      const r = record();
      const entries = [{ ...r.entries[0], source }, ...r.entries.slice(1)];
      assert.equal(validateHoursSummaryRecord({ ...r, entries }, familyId, request, now).entries[0].source, source);
    }
    const r = record();
    assert.throws(() => validateHoursSummaryRecord({ ...r, entries: [{ ...r.entries[0], source: "invented" }, ...r.entries.slice(1)] }, familyId, request, now), invalidReceipt);
  });
  it("normalizes UUID spelling without changing authenticated identity", () => {
    const result = validateHoursSummaryRecord(record(), familyId.toUpperCase(), { ...request, childId: childId.toUpperCase() }, now);
    assert.equal(result.familyId, familyId);
    assert.equal(result.recordedDaysByChild[0].childId, childId);
  });
  it("rejects missing shape, foreign family/child, cropped sample, and contradictory aggregate receipts", () => {
    const r = record();
    for (const broken of [null, {}, { ...r, familyId: foreignId }, { ...r, entries: r.entries.slice(1) },
      { ...r, totalMinutes: 4000 }, { ...r, children: [] }, { ...r, byEntryScope: [{ childId: foreignId, minutes: 4001 }] },
      { ...r, recordedDaysByChild: [{ childId, childName: "A different child", recordedDays: 1, minutes: 4001 }] }]) {
      assert.throws(() => validateHoursSummaryRecord(broken, familyId, request, now), invalidReceipt);
    }
  });
  it("rejects shared attribution contradictions and impossible positive day/sample receipts", () => {
    const r = record();
    const shared = { ...r, byEntryScope: [{ childId, minutes: 3991 }, { childId: null, minutes: 10 }] };
    assert.throws(() => validateHoursSummaryRecord({ ...shared,
      recordedDaysByChild: [{ childId, childName: "Avery", recordedDays: 1, minutes: 3991 }] }, familyId, request, now), invalidReceipt);
    assert.throws(() => validateHoursSummaryRecord({ ...r, recordedDays: 0,
      recordedDaysByChild: [{ childId, childName: "Avery", recordedDays: 0, minutes: 0 }] }, familyId, request, now), invalidReceipt);
    assert.throws(() => validateHoursSummaryRecord({ ...r, entries: r.entries.map(entry => ({ ...entry, minutes: 600 })) }, familyId, request, now), invalidReceipt);
    assert.throws(() => validateHoursSummaryRecord({ ...r, firstDay: "2026-09-09", lastDay: "2026-09-09" }, familyId, {period: "all"}, now), invalidReceipt);
    assert.throws(() => validateHoursSummaryRecord({ ...r, recordedDays: 2 }, familyId, { ...request, childId }, now), invalidReceipt);
    assert.throws(() => validateHoursSummaryRecord({ ...r, bySubject: [{subject: "reading", minutes: 4001}] }, familyId, request, now), invalidReceipt);
  });
  it("enforces SQL's 200-codepoint note bound including Unicode and truncation receipts", () => {
    const r = record();
    for (const note of ["a".repeat(201), "😀".repeat(201)]) {
      assert.throws(() => validateHoursSummaryRecord({ ...r, entries: [{ ...r.entries[0], note }, ...r.entries.slice(1)] }, familyId, request, now), invalidReceipt);
    }
    const note = "😀".repeat(200);
    assert.equal(validateHoursSummaryRecord({ ...r, entries: [{ ...r.entries[0], note, noteTruncated: true }, ...r.entries.slice(1)] }, familyId, request, now).entries[0].note, note);
    assert.throws(() => validateHoursSummaryRecord({ ...r, entries: [{ ...r.entries[0], note: "Short", noteTruncated: true }, ...r.entries.slice(1)] }, familyId, request, now), invalidReceipt);
  });
  it("refuses a stale SQL window instead of silently diverging from the canonical calendar", () => {
    const r = record();
    for (const window of [{ ...r.window, from: "2025-09-10" }, { ...r.window, through: "2026-09-11" }, { ...r.window, period: "all" }, { ...r.window, schoolYearFallback: true }]) {
      assert.throws(() => validateHoursSummaryRecord({ ...r, window }, familyId, request, now), invalidReceipt);
    }
  });
  it("accepts honest complete zero without inferring any attendance", () => {
    const r = record();
    const empty = { ...r, entryCount: 0, totalMinutes: 0, recordedDays: 0, firstDay: null, lastDay: null,
      byEntryScope: [], bySubject: [], recordedDaysByChild: [{ childId, childName: "Avery", recordedDays: 0, minutes: 0 }], entries: [] };
    assert.equal(validateHoursSummaryRecord(empty, familyId, request, now).entryCount, 0);
  });
  it("uses the caller SDK scalar RPC with authenticated family and an abort signal", async () => {
    let calls = 0;
    const db = { rpc: (name: string, args: unknown) => {
      calls++;
      assert.equal(name, "read_hours_summary");
      assert.deepEqual(args, { target_family_id: familyId, requested_period: "school_year", target_child_id: null,
        include_shared: true, from_on: null, through_on: null, target_subject: null, entry_limit: 20, reference_at: now.toISOString() });
      return { abortSignal: async (signal: AbortSignal) => {
        assert.equal(signal.aborted, false);
        return { data: record(), error: null };
      } };
    } } as unknown as SupabaseClient;
    assert.equal((await readHoursSummaryCaller(db, familyId, request, now)).entryCount, 4001);
    assert.equal(calls, 1);
  });
  it("refuses invalid scope before a query and missing/failed SQL receipts without totals", async () => {
    const noRead = { rpc: () => { throw new Error("Unexpected query"); } } as unknown as SupabaseClient;
    for (const input of [{ from: "2026-02-29" }, { childId: "foreign" }, { limit: 51 }]) {
      await assert.rejects(readHoursSummaryCaller(noRead, familyId, input, now), (error: unknown) => Boolean(error && typeof error === "object" && "reason" in error && error.reason === "invalid"));
    }
    for (const response of [{ data: null, error: null }, { data: null, error: { message: "Synthetic read failure" } }, { data: { status: "not_found" }, error: null }]) {
      const db = { rpc: () => ({ abortSignal: async () => response }) } as unknown as SupabaseClient;
      await assert.rejects(readHoursSummaryCaller(db, familyId, request, now), /No complete total is available/u);
    }
  });
});
