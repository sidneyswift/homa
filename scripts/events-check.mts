/**
 * Events-registry parity check (MJ-08). Two jobs, one exit code:
 *   1. Every event name emitted in apps/web exists in the typed registry
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

import { EVENT_SCHEMAS } from "../packages/core/src/index";

/** Registry entries allowed to have no emitter yet: [name, ticket]. */
const STAGED_EVENTS: ReadonlyArray<readonly [string, string]> = [
  // The chat attachments stream is mid-build (2026-07-13,
  // docs/notes/chat-redesign-attachments-implementation.md); its schema
  // rode into the registry with the child-photos commit. Remove this
  // entry when the attachments emitter lands.
  ["chat.attachment_processed", "chat-attachments-2026-07-13"],
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
];
const SKIP_DIRS = new Set(["node_modules", ".next", ".eve"]);

function* walkSourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walkSourceFiles(path);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield path;
    }
  }
}

// The first quoted dotted name after an emit call is the event name; sink
// object literals never contain dotted string literals, so a 200-char
// window after the call open is safe for both emitEvent and emitMapEvent.
const EMIT_CALL = /emit(?:Map)?Event\s*(?:<[^>]*>)?\(\s*[\s\S]{0,200}?"([a-z_]+\.[a-z_]+)"/g;

const emittedEventSites = new Map<string, string[]>();
for (const root of ROOTS) {
  for (const file of walkSourceFiles(root)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(EMIT_CALL)) {
      const name = match[1];
      const sites = emittedEventSites.get(name) ?? [];
      sites.push(file);
      emittedEventSites.set(name, sites);
    }
  }
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
