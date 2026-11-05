import assert from "node:assert/strict";
import { test } from "node:test";
import type { AppData } from "./app-data";
import { loadWorkspacePlanner, type WorkspacePlannerReaders } from "./workspace-planner-data";

const data = { family: { id: "authenticated-family", time_zone: "America/Los_Angeles" }, children: [], plans: [] } as unknown as AppData;
function readers() {
  const calls: string[][] = [];
  const read = async (...args: string[]) => { calls.push(args); return []; };
  const api: WorkspacePlannerReaders = { events: read, schedule: read, learning: read, hours: async (family, start, end) => read(family, start, end) };
  return { api, calls };
}

test("calendar reads use the authenticated family and bounded range, ignoring client family identity", async () => {
  const { api, calls } = readers();
  const board = await loadWorkspacePlanner(data, new URLSearchParams("familyId=someone-else&date=2026-10-05&view=week"), api, new Date("2026-10-05T00:30:00Z"));
  assert.equal(board.today, "2026-10-04");
  assert.equal(board.activeDate, "2026-10-05");
  assert.equal(board.view, "week");
  assert.deepEqual(calls, Array.from({ length: 4 }, () => ["authenticated-family", "2026-10-05", "2026-10-11"]));
});

test("failed calendar reads reject instead of displaying an empty calendar", async () => {
  const { api } = readers();
  api.events = async () => { throw new Error("unavailable"); };
  await assert.rejects(loadWorkspacePlanner(data, new URLSearchParams(), api));
});

test("invalid dates are bounded and month reads include its neighboring grid days", async () => {
  const { api, calls } = readers();
  const board = await loadWorkspacePlanner(data, new URLSearchParams("date=invalid&view=month"), api, new Date("2026-10-05T12:00:00Z"));
  assert.equal(board.activeDate, "2026-10-05");
  assert.ok(calls.every(call => call[1] === "2026-09-27" && call[2] === "2026-10-31"));
});
