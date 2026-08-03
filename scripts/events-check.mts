/**
 * Events-registry parity check (MJ-08). Two jobs, one exit code:
 *   1. Every event name emitted in apps/web or apps/mobile exists in the typed registry
 *      (packages/core/src/events.ts EVENT_SCHEMAS): emitters cannot invent
 *      names or shapes.
 *   2. Every registry event has an emitter somewhere in apps/web, so the
 *      registry never silently carries dead entries. An event declared
 *      ahead of its feature goes in STAGED_EVENTS below with its ticket.
 *
 * Usage: pnpm check:events   (tsx scripts/events-check.mts)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  CAPTURE_LOOP_EVENT_NAME,
  EVENT_SCHEMAS,
} from "../packages/core/src/index";
import {
  analyzeCaptureLoopUsage,
  captureLoopStagingMatches,
} from "./events-check-lib.mts";

/** Registry entries allowed to have no emitter yet: [name, ticket]. */
const STAGED_EVENTS: ReadonlyArray<readonly [string, string]> = [
  [
    "product.loop_stage_recorded",
    "gh#532, gh#304, and gh#347 emit; gh#392 and gh#394 consume",
  ],
  [
    "chat.prompt_suggestions_shown",
    "gh#737 (prompt suggestion redesign; currently paused)",
  ],
  [
    "chat.prompt_suggestion_tapped",
    "gh#737 (prompt suggestion redesign; currently paused)",
  ],
  // The one-planner arc registers ahead of its emitters (gh#257 PR B0
  // registers the namespace; later arc PRs bring the code paths).
  ["planner.week_repaired", "gh#259 (arc C: reshuffle receipt with undo)"],
  ["planner.offer_shown", "gh#258 (arc B1: governed scheduling offers)"],
  ["planner.offer_accepted", "gh#258 (arc B1: governed scheduling offers)"],
  ["planner.checkoff", "gh#258 (arc B1: rail/grid registers; per-toggle op is gh#259)"],
];

const failures: string[] = [];

function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

const ROOTS = [
  "apps/web/app",
  "apps/web/components",
  "apps/web/lib",
  "apps/web/agent",
  "apps/mobile/src",
];
const SKIP_DIRS = new Set(["node_modules", ".next", ".eve"]);

function* walkSourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walkSourceFiles(path);
    } else if (
      /\.[cm]?[jt]sx?$/u.test(entry) &&
      !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(entry)
    ) {
      yield path;
    }
  }
}

// The first quoted dotted name after an emit call is the event name; sink
// object literals never contain dotted string literals, so a 200-char
// window after the call open is safe for emitEvent, emitMapEvent,
// emitFamilyEvent, and the Once variants (same name-first shape).
const EMIT_CALL = /emit(?:Map|Family)?Event(?:Once)?\s*(?:<[^>]*>)?\(\s*[\s\S]{0,200}?"([a-z_]+\.[a-z_]+)"/g;

const emittedEventSites = new Map<string, string[]>();
const sourceFiles: string[] = [];
for (const root of ROOTS) {
  for (const file of walkSourceFiles(root)) {
    sourceFiles.push(file);
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(EMIT_CALL)) {
      const name = match[1];
      const sites = emittedEventSites.get(name) ?? [];
      sites.push(file);
      emittedEventSites.set(name, sites);
    }
  }
}
const captureLoopUsage = analyzeCaptureLoopUsage({
  sourceFiles,
  wrapperModuleFiles: [
    "apps/mobile/src/lib/capture-loop-events.ts",
    "apps/web/lib/capture-loop-events.ts",
  ],
  captureContractFile: "packages/core/src/capture-loop.ts",
  allowedLowLevelFiles: [
    "apps/mobile/src/lib/capture-loop-events.ts",
    "apps/web/lib/capture-loop-events.ts",
    "apps/web/app/api/mobile/event/route.ts",
    "apps/web/lib/mobile-family-events.ts",
  ],
});
const captureLoopWrapperSites = captureLoopUsage.wrapperCallSites;
if (captureLoopWrapperSites.size > 0) {
  emittedEventSites.set(
    CAPTURE_LOOP_EVENT_NAME,
    [...captureLoopWrapperSites],
  );
}

report(
  "emit-call scanner found call sites",
  emittedEventSites.size > 0,
  "zero emit calls found; the scanner roots or regex are broken",
);

const registryNames = new Set(Object.keys(EVENT_SCHEMAS));

for (const [name, sites] of [...emittedEventSites.entries()].sort()) {
  report(
    `emitted "${name}" is in the registry`,
    registryNames.has(name),
    `emitted in ${sites.join(", ")} but not declared in packages/core/src/events.ts`,
  );
}

const stagedNames = new Set(STAGED_EVENTS.map(([name]) => name));
const captureLoopIsStaged = stagedNames.has(CAPTURE_LOOP_EVENT_NAME);
report(
  "capture-loop wrapper call sites match registry staging",
  captureLoopStagingMatches(captureLoopIsStaged, captureLoopWrapperSites),
  captureLoopIsStaged
    ? `staged event is emitted in ${[...captureLoopWrapperSites].join(", ")}`
    : "event is live but neither canonical wrapper has a non-test call site",
);
report(
  "capture-loop wrappers are called directly",
  captureLoopUsage.unsupportedWrapperSites.size === 0,
  `unsupported wrapper syntax hides call sites in ${[
    ...captureLoopUsage.unsupportedWrapperSites,
  ].join(", ")}`,
);
report(
  "capture-loop scanner resolved every canonical symbol",
  captureLoopUsage.configurationFailures.length === 0,
  captureLoopUsage.configurationFailures.join(", "),
);
report(
  "capture-loop journeys cannot bypass canonical adapters",
  captureLoopUsage.lowLevelBypassSites.size === 0,
  `low-level capture-loop calls appear in ${[
    ...captureLoopUsage.lowLevelBypassSites,
  ].join(", ")}`,
);
for (const name of [...registryNames].sort()) {
  if (stagedNames.has(name)) continue;
  report(
    `registry "${name}" has an emitter`,
    emittedEventSites.has(name),
    "declared in EVENT_SCHEMAS but never emitted in apps/web; emit it or add it to STAGED_EVENTS with its ticket",
  );
}

for (const [name] of STAGED_EVENTS) {
  report(
    `staged "${name}" is still unemitted`,
    !emittedEventSites.has(name),
    "now emitted; remove it from STAGED_EVENTS",
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} events check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll events checks passed.");
