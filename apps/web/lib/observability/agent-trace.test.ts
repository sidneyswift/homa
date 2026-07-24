import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  boundedCapturedJson,
  findStuckToolCalls,
  reportStuckToolCalls,
  sanitizeCapturedJson,
  stuckToolCallLine,
} from "./agent-trace";

describe("agent trace capture sanitizer", () => {
  it("keeps ordinary tool args intact", () => {
    const args = { title: "Skye's Big O Practice", kind: "worksheet", count: 3, final: true };
    assert.deepEqual(sanitizeCapturedJson(args), args);
  });

  it("truncates a material-sized html string instead of storing it", () => {
    const args = { title: "page", html: "x".repeat(50_000) };
    const out = sanitizeCapturedJson(args) as { html: string };
    assert.ok(out.html.length < 2100);
    assert.ok(out.html.includes("[truncated 50000 chars]"));
  });

  it("caps depth and array width without throwing", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 12; i += 1) deep = { next: deep };
    const out = sanitizeCapturedJson({ deep, wide: new Array(200).fill(1) }) as {
      wide: unknown[];
    };
    assert.equal(out.wide.length, 50);
  });

  it("falls back to a preview when even sanitized JSON overruns the budget", () => {
    const value = { rows: new Array(50).fill("y".repeat(1900)) };
    const out = boundedCapturedJson(value, 4000) as { truncated?: boolean; preview?: string };
    assert.equal(out.truncated, true);
    assert.ok((out.preview ?? "").length <= 4000);
  });
});

describe("stuck tool call signal", () => {
  it("reports counts an operator can act on", () => {
    const line = stuckToolCallLine({
      tool: "find_materials",
      channel: "dispatch",
      sessions: 1,
      calls: 3,
      oldestMinutes: 158,
    });
    assert.equal(
      line,
      "[agent_tool_calls] stuck tool=find_materials channel=dispatch " +
        "calls=3 sessions=1 oldest_minutes=158",
    );
  });

  it("names an absent channel instead of printing null", () => {
    const line = stuckToolCallLine({
      tool: "mark_material_final",
      channel: null,
      sessions: 2,
      calls: 4,
      oldestMinutes: 30,
    });
    assert.match(line, /channel=unknown/);
    assert.ok(!line.includes("null"));
  });

  it("carries no family content, only our own identifiers and counts", () => {
    // The line goes to runtime logs, which are not a tenant-scoped surface.
    // Tool and channel names are ours; a family id or session id here would
    // leak one family's activity into an operator log.
    const line = stuckToolCallLine({
      tool: "create_printable",
      channel: "web",
      sessions: 9,
      calls: 12,
      oldestMinutes: 20,
    });
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}/.test(line), "no uuid");
    assert.ok(!/wrun_/.test(line), "no session id");
  });

  it("returns nothing rather than breaking the sweep when the database is unreachable", async () => {
    // Telemetry never breaks the feature emitting it. With no database env
    // the query throws inside findStuckToolCalls, and the hourly cron must
    // still finish its other sweeps.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const password = process.env.SUPABASE_DB_PASSWORD;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_DB_PASSWORD;
    try {
      assert.deepEqual(await findStuckToolCalls(), []);
      assert.equal(await reportStuckToolCalls(), 0);
    } finally {
      if (url !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      if (password !== undefined) process.env.SUPABASE_DB_PASSWORD = password;
    }
  });
});
