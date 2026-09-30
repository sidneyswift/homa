import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  assertCleanRuntimePrompt,
  buildAgentPrompts,
  PROMPT_TARGETS,
  renderAgentPrompt,
  VOICE_MARKER,
} from "./build-agent-prompts.mts";

test("shared rules reach each role without changing its surrounding text", () => {
  for (const { source } of PROMPT_TARGETS) {
    const template = `${source}\n\n${VOICE_MARKER}\n\nOnly ${source}.\n`;
    assert.equal(renderAgentPrompt(template, "One shared rule.\n"),
      `${source}\n\nOne shared rule.\n\nOnly ${source}.\n`);
    assert.equal(renderAgentPrompt(template, "Revised shared rule.\n"),
      `${source}\n\nRevised shared rule.\n\nOnly ${source}.\n`);
  }
});

test("a missing or duplicate shared-rule slot fails closed", () => {
  for (const template of ["No slot", `${VOICE_MARKER}\n${VOICE_MARKER}`]) {
    assert.throws(() => renderAgentPrompt(template, "Rule"), /exactly once/);
  }
});

test("developer comments, broken comments, and unexpanded slots cannot ship", () => {
  for (const comment of ["<!-- note -->\nText", "Text <!-- note --> text", "Text\n<!-- note -->", "Text <!--", "Text -->"]) {
    assert.throws(() => assertCleanRuntimePrompt(comment, "test"), /developer comments/);
    assert.throws(() => renderAgentPrompt(`${VOICE_MARKER}\n${comment}`, "Rule"), /developer comments/);
    assert.throws(() => renderAgentPrompt(VOICE_MARKER, comment), /developer comments/);
  }
  assert.throws(() => renderAgentPrompt(`${VOICE_MARKER}\n@@missing-source@@`, "Rule"), /unresolved/);
  assert.throws(() => renderAgentPrompt(VOICE_MARKER, "\n"), /empty/);
});

test("check mode catches stale sources and manual output edits without rewriting them", () => {
  const root = mkdtempSync(path.join(tmpdir(), "homa-prompts-"));
  const sources = path.join(root, "apps/web/prompt-sources");
  const outputs = path.join(root, "apps/web/agent");
  try {
    mkdirSync(sources, { recursive: true });
    mkdirSync(outputs, { recursive: true });
    writeFileSync(path.join(sources, "voice-rules.md"), "Shared rule.\n");
    for (const { source } of PROMPT_TARGETS) {
      writeFileSync(path.join(sources, source), `${source}\n${VOICE_MARKER}\n`);
    }
    buildAgentPrompts(root, false);
    buildAgentPrompts(root, true);
    writeFileSync(path.join(sources, "voice-rules.md"), "Changed rule.\n");
    assert.throws(() => buildAgentPrompts(root, true), /stale/);
    buildAgentPrompts(root, false);
    for (const { output } of PROMPT_TARGETS) {
      const target = path.join(outputs, output);
      const generated = readFileSync(target, "utf8");
      writeFileSync(target, `${generated}Manual edit.\n`);
      assert.throws(() => buildAgentPrompts(root, true), /stale/);
      assert.equal(readFileSync(target, "utf8"), `${generated}Manual edit.\n`);
      writeFileSync(target, generated);
    }
    buildAgentPrompts(root, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
