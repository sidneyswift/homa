#!/usr/bin/env node --experimental-strip-types
/**
 * Every tool declares a deadline (2026-07-23).
 *
 * eve 0.19.0 gives authored tools no timeout and no abort signal, so a
 * tool call that never settles freezes the whole turn until the 2h
 * task-run reaper notices. Production has done this twice: 3 stuck
 * find_materials calls on 07-19 and 4 stuck mark_material_final calls on
 * 07-22. lib/agent-tool-deadline.ts is the fix; this guard is what keeps
 * it from decaying, because the failure it prevents is invisible until a
 * parent is already staring at a dead chat.
 *
 * Four deterministic checks over apps/web/agent/tools, no network:
 *   1. No tool file imports eve's bare defineTool.
 *   2. Every tool built with defineBoundedTool declares a deadlineMs.
 *   3. Every declared deadline is a known TOOL_DEADLINE tier, or a bare
 *      number carrying a comment that says what measured it.
 *   4. Every tool declares `repeatable`, which decides whether the timeout
 *      message invites a retry. There is no default on purpose: guessing
 *      true for a tool that texts a parent sends the text twice, so an
 *      author has to state it.
 *
 * Usage: node --experimental-strip-types scripts/tool-deadline-check.mts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS_DIR = path.join("apps", "web", "agent", "tools");
const DEADLINE_MODULE = path.join("apps", "web", "lib", "agent-tool-deadline.ts");

const problems: string[] = [];

/** The tiers lib/agent-tool-deadline.ts actually exports. Read from the
 * module rather than restated here, so renaming a tier fails loudly
 * instead of quietly widening what this guard accepts. */
function declaredTiers(): string[] {
  const source = readFileSync(path.join(repoRoot, DEADLINE_MODULE), "utf8");
  const block = source.match(/export const TOOL_DEADLINE = \{([\s\S]*?)\n\} as const;/);
  if (!block) {
    console.error(`FAIL ${DEADLINE_MODULE}: could not find the TOOL_DEADLINE table.`);
    process.exit(1);
  }
  const tiers = [...block[1].matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
  if (tiers.length === 0) {
    console.error(`FAIL ${DEADLINE_MODULE}: TOOL_DEADLINE declares no tiers.`);
    process.exit(1);
  }
  return tiers;
}

const TIERS = declaredTiers();
const files = readdirSync(path.join(repoRoot, TOOLS_DIR))
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .sort();

let bounded = 0;
let disabled = 0;
let repeatableCount = 0;

for (const name of files) {
  const relativePath = path.join(TOOLS_DIR, name);
  const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
  const slug = name.replace(/\.ts$/, "");

  // A disableTool() sentinel removes a framework tool; there is no
  // execute to bound.
  if (/\bdisableTool\(\)/.test(source) && !/\bdefineTool\b|\bdefineBoundedTool\b/.test(source)) {
    disabled += 1;
    continue;
  }

  if (/\bdefineTool\b/.test(source)) {
    problems.push(
      `${relativePath}: uses eve's defineTool. Use defineBoundedTool from ` +
        `lib/agent-tool-deadline so a hung call fails instead of freezing the turn.`,
    );
    continue;
  }

  const definitions = [...source.matchAll(/\bdefineBoundedTool\(\{/g)];
  if (definitions.length === 0) {
    problems.push(
      `${relativePath}: defines no tool and is not a disableTool() sentinel. ` +
        `If it is a helper, move it to lib/.`,
    );
    continue;
  }

  const deadlines = [...source.matchAll(/^\s*deadlineMs:\s*([^,\n]+),/gm)];
  if (deadlines.length !== definitions.length) {
    problems.push(
      `${relativePath}: ${definitions.length} tool definition(s) but ` +
        `${deadlines.length} deadlineMs declaration(s). Every tool declares its own.`,
    );
    continue;
  }

  const repeatables = [...source.matchAll(/^\s*repeatable:\s*(true|false),$/gm)];
  if (repeatables.length !== definitions.length) {
    problems.push(
      `${relativePath}: ${definitions.length} tool definition(s) but ` +
        `${repeatables.length} \`repeatable: true|false\` declaration(s). State whether a ` +
        `second call after an unknown outcome can reach the parent, spend money, or ` +
        `duplicate a record. When unsure, false.`,
    );
    continue;
  }

  for (const [, value] of deadlines) {
    const tier = value.trim().match(/^TOOL_DEADLINE\.(\w+)$/);
    if (tier) {
      if (!TIERS.includes(tier[1])) {
        problems.push(
          `${relativePath}: TOOL_DEADLINE.${tier[1]} is not a declared tier ` +
            `(${TIERS.join(", ")}).`,
        );
      }
      continue;
    }
    // A bare number is allowed, but only with a comment above it saying
    // what measured it. Numbers chosen by feel are how a ceiling ends up
    // either useless or cutting off real work.
    const literal = value.trim().match(/^[\d_]+$/);
    if (!literal) {
      problems.push(
        `${relativePath}: deadlineMs must be a TOOL_DEADLINE tier or a numeric ` +
          `literal, got \`${value.trim()}\`.`,
      );
      continue;
    }
    const preceding = source.slice(0, source.indexOf(`deadlineMs: ${value.trim()}`));
    const lastLine = preceding.split("\n").at(-2) ?? "";
    if (!/\/\/|\*/.test(lastLine)) {
      problems.push(
        `${relativePath}: deadlineMs ${value.trim()} is a bare number with no comment. ` +
          `Say what measured it, or use a TOOL_DEADLINE tier.`,
      );
    }
  }

  // A tool claiming to be repeatable must not visibly send, spend, or
  // insert. This is a deny-list, and a deny-list is a poor judge of what
  // code means, so it is deliberately only a floor: the real control is
  // the author stating `repeatable` and this file explaining the bar. It
  // fails safe, because the only way to trip it is to claim a retry is
  // harmless in a file that texts somebody. Anything it flags wrongly is
  // resolved by moving the effect out or marking the tool false, never by
  // widening this list.
  if (repeatables.some(([, value]) => value === "true")) {
    const effects = [
      ...source.matchAll(/\b(send[A-Z]\w*|upload[A-Z]\w*|insert[A-Z]\w*|create[A-Z]\w*|save[A-Z]\w*)\(/g),
    ]
      .map((match) => match[1])
      .filter((name) => !name.startsWith("createHash") && !name.startsWith("createContext"));
    if (effects.length > 0) {
      problems.push(
        `${relativePath}: marked repeatable but calls ${[...new Set(effects)].join(", ")}. ` +
          `A retry after an unknown outcome would run that again. Mark it false, or move ` +
          `the effect out of the tool.`,
      );
      continue;
    }
    repeatableCount += 1;
  }

  bounded += 1;
}

if (problems.length > 0) {
  console.error("Tool deadline guard failed:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\nWhy this matters: eve has no per-tool timeout, so an unbounded tool ` +
      `call parks the parent's turn until the 2h reaper fails it.\n`,
  );
  process.exit(1);
}

console.log(
  `Tool deadline guard passed: ${bounded} bounded tool file(s) ` +
    `(${repeatableCount} repeatable, ${bounded - repeatableCount} not), ` +
    `${disabled} disabled sentinel(s), tiers ${TIERS.join("/")}.`,
);
