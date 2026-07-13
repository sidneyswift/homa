import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { boundedCapturedJson, sanitizeCapturedJson } from "./agent-trace";

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
