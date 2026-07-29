#!/usr/bin/env node --experimental-strip-types
/**
 * A dynamic TOOL resolves on step.started, never on turn.started or
 * session.started (2026-07-28, gh#345).
 *
 * eve persists a turn- or session-scoped dynamic tool as durable
 * metadata and replays it on later steps by looking its execute up in a
 * step registry that lives on `globalThis`. Tools authored in this repo
 * have no bundler-generated step function, so eve registers a fallback
 * into that registry at resolve time, inside whichever lambda isolate
 * happened to serve the resolve. Any later step served by a different
 * isolate finds nothing, drops the tool, and logs one line nobody reads:
 *
 *   [eve:dynamic-tools] Dynamic tool "create_printable" references step
 *   function "eve:framework-dynamic:create_printable:_single" which is
 *   not registered, skipping on this step.
 *
 * (that log line is reproduced with its dash normalized, so grep for
 * "references step function" rather than the whole sentence)
 *
 * The model is simply not given the tool, so it truthfully tells the
 * parent it cannot make a worksheet. That is what a co-founder hit
 * repeatedly on 2026-07-26 and 07-27, and what the fleet was still
 * hitting nightly when this guard was written. eve documents the rule in
 * its own types: LiveStepToolsKey exists so "framework tools (which lack
 * bundler step-function metadata) work", re-resolved every step.
 *
 * Resolvers must therefore stay cheap and free of side effects: they run
 * once per step, not once per turn.
 *
 * This guard reads apps/web/agent/tools only. Dynamic INSTRUCTIONS are a
 * different mechanism (no step function, no replay) and may keep using
 * turn.started; they are not scanned.
 *
 * Usage: node --experimental-strip-types scripts/dynamic-tool-events-check.mts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS_DIR = path.join("apps", "web", "agent", "tools");

/** Events that survive a cold isolate for a repo-authored tool. */
const ALLOWED_EVENT = "step.started";
/** Events eve accepts but that silently drop these tools on replay. */
const REPLAYED_EVENTS = ["turn.started", "session.started"];

const problems: string[] = [];
let scanned = 0;
let dynamic = 0;

for (const entry of readdirSync(path.join(repoRoot, TOOLS_DIR)).sort()) {
  if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
  scanned += 1;
  const relative = path.join(TOOLS_DIR, entry);
  const source = readFileSync(path.join(repoRoot, relative), "utf8");
  if (!source.includes("defineDynamic(")) continue;
  dynamic += 1;

  for (const event of REPLAYED_EVENTS) {
    if (!source.includes(`"${event}"`)) continue;
    problems.push(
      `${relative}: dynamic tool resolves on "${event}". Repo-authored ` +
        `tools have no bundler step function, so eve drops this tool on ` +
        `any step served by a cold isolate and the model loses the ` +
        `ability entirely. Use "${ALLOWED_EVENT}".`,
    );
  }

  if (!source.includes(`"${ALLOWED_EVENT}"`)) {
    problems.push(
      `${relative}: defineDynamic with no "${ALLOWED_EVENT}" handler. ` +
        `A dynamic tool that never resolves on a step is never callable.`,
    );
  }
}

if (dynamic === 0) {
  console.error(
    `FAIL ${TOOLS_DIR}: found no dynamic tools at all. This guard has ` +
      `nothing to protect, which means it is silently passing. Delete it ` +
      `or fix the scan.`,
  );
  process.exit(1);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  console.error(
    `\n${problems.length} problem(s). Background: gh#345, and the header ` +
      `comment in this file.`,
  );
  process.exit(1);
}

console.log(
  `OK dynamic tool events: ${dynamic} dynamic tool(s) of ${scanned} scanned ` +
    `resolve on ${ALLOWED_EVENT}.`,
);
