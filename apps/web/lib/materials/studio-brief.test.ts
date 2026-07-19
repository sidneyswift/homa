import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  buildStudioBrief,
  STUDIO_REQUEST_MAX_CHARS,
  studioRequestProblem,
} from "./studio-brief";
import { isPinnedAgentChannel } from "../agent-db";

/**
 * The studio test bench's brief and channel wiring (/admin/studio,
 * direction lab 2026-07-18-material-studio-admin-directions.html). The
 * brief is the exact prompt a lab session receives, so its laws are
 * pinned here; the channel-set tests pin the 2026-07-18 finding that
 * the family-context instruction kept its own hardcoded channel list
 * and agent-job sessions hydrated the "not set up" fallback while their
 * tools worked.
 */

describe("studioRequestProblem", () => {
  it("refuses an empty or whitespace request", () => {
    assert.notEqual(studioRequestProblem(""), null);
    assert.notEqual(studioRequestProblem("   "), null);
    assert.notEqual(studioRequestProblem("ab"), null);
  });

  it("accepts a real request and refuses one past the ledger's cap", () => {
    assert.equal(studioRequestProblem("A counting worksheet with dinosaurs"), null);
    assert.notEqual(studioRequestProblem("x".repeat(STUDIO_REQUEST_MAX_CHARS + 1)), null);
  });
});

describe("buildStudioBrief", () => {
  it("carries the request verbatim and the test-run laws", () => {
    const brief = buildStudioBrief({
      request: "A letter M tracing page for a 4 year old",
      childName: "Juniper",
    });
    assert.ok(brief.includes('"A letter M tracing page for a 4 year old"'));
    assert.ok(brief.includes("materials-studio"));
    assert.ok(brief.includes("The material is for Juniper"));
    // No parent answers in a lab run: the skill's one calibrating
    // question rule must be overridden explicitly.
    assert.ok(brief.includes("do NOT ask a calibrating question"));
    // Finals are the parent's approval, never a test artifact.
    assert.ok(brief.includes("Never call mark_material_final"));
    // The bench never messages anyone.
    assert.ok(brief.includes("Do not message, text, or email anyone"));
  });

  it("asks the session to pick and name a child when none was chosen", () => {
    const brief = buildStudioBrief({ request: "A counting mat", childName: null });
    assert.ok(brief.includes("choose the best-fitting child"));
  });
});

describe("pinned agent channels", () => {
  it("include every server-originated session channel that needs family context", () => {
    for (const channel of [
      "sms",
      "email",
      "dispatch",
      "subject_lesson",
      "agent-job",
      "materials-lab",
    ]) {
      assert.ok(isPinnedAgentChannel(channel), `${channel} missing`);
    }
    assert.ok(!isPinnedAgentChannel("web"), "web is caller-token, never pinned");
    assert.ok(!isPinnedAgentChannel(undefined));
  });

  it("are the one set the family-context instruction hydrates from", async () => {
    const source = await readFile(
      new URL("../../agent/instructions/family-context.ts", import.meta.url),
      "utf8",
    );
    assert.ok(
      source.includes("isPinnedAgentChannel(attributes.channel)"),
      "family-context.ts must gate its pinned branch on the shared channel guard",
    );
    assert.ok(
      !/attributes\.channel === "sms"/.test(source),
      "family-context.ts must not keep its own hardcoded channel list",
    );
  });
});
