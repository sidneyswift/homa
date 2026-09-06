import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createHoursExportGet } from "./route";
import { HoursRecordChildNotFound, type HoursExportRecord } from "../../../../lib/hours-export";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const CHILD_B = "44444444-4444-4444-8444-444444444444";
const actor = async () => ({ family: { id: FAMILY_ID }, memberUserId: "22222222-2222-4222-8222-222222222222" }) as never;
const record: HoursExportRecord = {
  children: [{ id: CHILD_ID, name: "Same" }, { id: CHILD_B, name: "Same" }],
  rows: [
    { id: "entry-a", childId: CHILD_ID, childName: "Same", happenedOn: "2026-09-01", subject: "reading", customLabel: "Narnia", minutes: 20, source: "chat", note: 'Chapter "one" 📖' },
    { id: "entry-b", childId: CHILD_B, childName: "Same", happenedOn: "2026-09-01", subject: "math", customLabel: null, minutes: 30, source: "chat", note: null },
    { id: "entry-shared", childId: null, childName: null, happenedOn: "2026-09-02", subject: "art", customLabel: null, minutes: 10, source: "chat", note: null },
  ],
};

describe("GET /api/hours/export", () => {
  it("rejects a request before reading records when no family is signed in", async () => {
    let read = false;
    const get = createHoursExportGet({
      resolveActor: async () => null,
      getRecord: async () => {
        read = true;
        return { rows: [], children: [] };
      },
    });
    const response = await get(new Request("https://thankshoma.com/api/hours/export"));
    assert.equal(response.status, 401);
    assert.equal(read, false);
  });

  it("scopes the complete download to the signed-in family", async () => {
    let requestedFamilyId: string | null = null;
    const get = createHoursExportGet({
      resolveActor: async () => ({
        family: { id: FAMILY_ID },
        memberUserId: "22222222-2222-4222-8222-222222222222",
      }) as never,
      getRecord: async (familyId) => {
        requestedFamilyId = familyId;
        return { rows: [], children: [] };
      },
    });
    const response = await get(new Request("https://thankshoma.com/api/hours/export"));
    assert.equal(requestedFamilyId, FAMILY_ID);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="homa-school-hours.csv"',
    );
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });

  it("does not let an anonymous onboarding resume cookie download records", async () => {
    let read = false;
    const get = createHoursExportGet({
      resolveActor: async () => ({ family: { id: FAMILY_ID }, memberUserId: null }) as never,
      getRecord: async () => {
        read = true;
        return { rows: [], children: [] };
      },
    });
    const response = await get(new Request("https://thankshoma.com/api/hours/export"));
    assert.equal(response.status, 401);
    assert.equal(read, false);
  });

  it("validates dates and repeated parameters before reading the record", async () => {
    let reads = 0;
    const get = createHoursExportGet({ resolveActor: actor, getRecord: async () => { reads++; return record; } });
    for (const query of ["from=2026-02-29", "from=2026-09-03&through=2026-09-01", "child=bad", "from=&from=", "familyId=foreign"]) {
      assert.equal((await get(new Request(`https://thankshoma.com/api/hours/export?${query}`))).status, 400);
    }
    assert.equal(reads, 0);
  });

  it("forwards the exact inclusive child/shared scope under the authenticated family", async () => {
    const get = createHoursExportGet({ resolveActor: actor, getRecord: async (familyId, scope) => {
      assert.equal(familyId, FAMILY_ID);
      assert.deepEqual(scope, { childId: CHILD_ID, from: "2026-09-01", through: "2026-09-02", includeShared: false });
      return { children: record.children, rows: [record.rows[0]] };
    } });
    const response = await get(new Request(`https://thankshoma.com/api/hours/export?child=${CHILD_ID}&from=2026-09-01&through=2026-09-02&shared=exclude&format=preview`));
    const preview = await response.json();
    assert.equal(preview.totalMinutes, 20);
    assert.equal(preview.entryCount, 1);
    assert.deepEqual(preview.byChild, [{ childId: CHILD_ID, childName: "Same", recordedDays: 1, minutes: 20 }]);
  });

  it("refuses a foreign child and incomplete reader failure without a partial CSV", async () => {
    for (const [error, status] of [[new HoursRecordChildNotFound(), 404], [new Error("timeout"), 503]] as const) {
      const get = createHoursExportGet({ resolveActor: actor, getRecord: async () => { throw error; } });
      const response = await get(new Request(`https://thankshoma.com/api/hours/export?child=${CHILD_ID}`));
      assert.equal(response.status, status);
      assert.equal(response.headers.get("content-disposition"), null);
    }
  });

  it("previews once-per-family entries and per-child days, preserving duplicate identities in CSV", async () => {
    const get = createHoursExportGet({ resolveActor: actor, getRecord: async () => record });
    const preview = await (await get(new Request("https://thankshoma.com/api/hours/export?format=preview"))).json();
    assert.equal(preview.entryCount, 3);
    assert.equal(preview.totalMinutes, 60);
    assert.equal(preview.recordedDays, 2);
    assert.deepEqual(preview.byChild, [
      { childId: CHILD_ID, childName: "Same", recordedDays: 2, minutes: 30 },
      { childId: CHILD_B, childName: "Same", recordedDays: 2, minutes: 40 },
    ]);
    const entries = await (await get(new Request(`https://thankshoma.com/api/hours/export?revision=${preview.revision}`))).text();
    assert.equal(entries.trimEnd().split("\r\n").length, 4);
    assert.match(entries, /Chapter ""one"" 📖/u);
    const days = await (await get(new Request(`https://thankshoma.com/api/hours/export?format=days&revision=${preview.revision}`))).text();
    assert.equal(days.trimEnd().split("\r\n").length, 5);
    assert.ok(days.includes(CHILD_ID) && days.includes(CHILD_B));
  });

  it("refuses a changed record or renamed child after preview instead of downloading a different snapshot", async () => {
    let current = record;
    const get = createHoursExportGet({ resolveActor: actor, getRecord: async () => current });
    const preview = await (await get(new Request("https://thankshoma.com/api/hours/export?format=preview"))).json();
    for (const next of [
      { ...record, rows: record.rows.map((row, index) => index ? row : { ...row, minutes: 21 }) },
      { ...record, children: [{ ...record.children[0], name: "Renamed" }, record.children[1]] },
    ]) {
      current = next;
      const response = await get(new Request(`https://thankshoma.com/api/hours/export?revision=${preview.revision}`));
      assert.equal(response.status, 409);
      assert.equal(response.headers.get("content-disposition"), null);
    }
  });

  it("does not truncate the CSV at the screen's 3,000-row cap", async () => {
    const rows = Array.from({ length: 3001 }, (_, index) => ({ ...record.rows[0], id: `entry-${index}` }));
    const get = createHoursExportGet({ resolveActor: actor, getRecord: async () => ({ children: record.children, rows }) });
    const csv = await (await get(new Request("https://thankshoma.com/api/hours/export"))).text();
    assert.equal(csv.trimEnd().split("\r\n").length, 3002);
    const preview = await (await get(new Request("https://thankshoma.com/api/hours/export?format=preview"))).json();
    assert.equal(preview.entryCount, 3001);
    assert.equal(preview.entries.length, 20);
    assert.equal(preview.totalMinutes, 60020);
  });
});
