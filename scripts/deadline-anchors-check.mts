/**
 * Re-verifies every shipped deadline anchor against the reviewed state
 * snapshots, with no model and no network (gh#342).
 *
 * This is the half of models-judge-code-verifies that has to keep
 * running forever. The build script's verification happened once, on
 * somebody's laptop, against whatever the snapshots said that day; this
 * runs in CI on every push, so a state-requirements refresh that changes
 * a deadline string can never leave a stale calendar date behind in a
 * family's compliance document. A drifted anchor fails the build rather
 * than shipping a date the source no longer supports.
 *
 * Usage: pnpm check:deadline-anchors
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DEADLINE_ANCHORS } from "../apps/web/lib/compliance/deadline-anchors.generated";
import {
  quoteAppearsVerbatim,
  verifyDeadlineProposal,
} from "../apps/web/lib/compliance/deadline-anchor-verify";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STATES_DIR = `${REPO_ROOT}data/state-requirements/states`;

const failures: string[] = [];
let checked = 0;

for (const [code, entry] of Object.entries(DEADLINE_ANCHORS)) {
  let payload: {
    pathways?: {
      is_default?: boolean;
      notification?: { deadline?: string | null; required?: boolean };
    }[];
  };
  try {
    payload = JSON.parse(readFileSync(`${STATES_DIR}/${code}.json`, "utf8"));
  } catch {
    failures.push(`${code}: no snapshot file, but anchors ship for it`);
    continue;
  }
  const pathways = payload.pathways ?? [];
  const dflt = pathways.find((p) => p.is_default) ?? pathways[0];
  const source = dflt?.notification?.deadline ?? null;

  if (typeof source !== "string" || source.trim().length === 0) {
    failures.push(
      `${code}: anchors ship, but the default pathway now has no deadline text`,
    );
    continue;
  }
  if (source.trim() !== entry.source) {
    failures.push(
      `${code}: deadline text changed upstream.\n      shipped: ${JSON.stringify(entry.source)}\n      current: ${JSON.stringify(source.trim())}\n      Re-run pnpm build:deadline-anchors and review the diff.`,
    );
    continue;
  }
  // Every shipped anchor must still pass the exact rules that admitted
  // it, read back from the generated module as if freshly proposed.
  const verdict = verifyDeadlineProposal(code, source.trim(), {
    kind: entry.kind,
    anchors: entry.anchors,
  });
  if (!verdict.ok) {
    failures.push(`${code}: shipped anchors fail verification (${verdict.reason})`);
    continue;
  }
  for (const anchor of entry.anchors) {
    if (!quoteAppearsVerbatim(entry.source, anchor.quote)) {
      failures.push(
        `${code}: quote ${JSON.stringify(anchor.quote)} is not verbatim in the shipped source`,
      );
    }
  }
  checked += 1;
}

console.log(
  `deadline-anchors-check: ${checked} jurisdiction(s) verified against their snapshots.`,
);
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log("All shipped deadline anchors still match their source text.");
