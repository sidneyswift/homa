/**
 * Regenerates apps/web/lib/compliance/deadline-anchors.generated.ts from
 * the reviewed state snapshots in data/state-requirements/ (gh#342).
 *
 * The problem this solves: the only date a state pack can show comes
 * from the payload's notification deadline, which is free-text prose
 * ("By July 1 annually, or within 14 days of commencing home
 * instruction mid-year"). Council ruling D4 forbids parsing that prose
 * at runtime, and rightly so: a regex that reads "July 1" drops the
 * mid-year branch and manufactures a wrong deadline for exactly the
 * families who start mid-year. So the pack could only echo the string,
 * and its "key dates" box held no dates at all.
 *
 * The binding pattern for turning language into structured data here is
 * models-judge-code-verifies (AGENTS.md, docs/homa-planning/
 * models-judge-code-verifies.md): a model proposes, deterministic code
 * verifies, and an unsupported proposal is DROPPED, never softened.
 * That is exactly this job, run once at build time rather than per
 * render, so the output is a reviewable artifact that ships as code:
 *
 *   1. The model reads one deadline string and proposes typed anchors,
 *      each carrying a verbatim quote from that string.
 *   2. Code verifies every proposal: the quote must appear verbatim in
 *      the source, the calendar values must be real, the anchor count
 *      must match the kind, and a relative anchor must carry a number
 *      that actually appears in the source. Any failure drops the whole
 *      state, which then renders exactly as it does today.
 *   3. The result is written as a TypeScript module (never JSON: a JSON
 *      loader can sink the eve build, apps/web/AGENTS.md) and reviewed
 *      as a git diff before it ships, the same human gate the snapshot
 *      pipeline itself uses.
 *
 * Each state is sampled SAMPLES times and the verified anchors are
 * unioned. Verification guarantees an anchor is never wrong, but it
 * cannot make one appear: comparing two independent runs on 2026-07-28
 * found identical results for 38 of 39 states and a California run that
 * returned only the opening date of its October 1 through 15 window,
 * dropping the closing date the other run found. Correctness was never
 * at risk, completeness was, so the fix is to sample and union rather
 * than to trust one pass. Every unioned anchor still clears the same
 * verification individually.
 *
 * Lives in apps/web because it calls the model through the AI SDK, and
 * `ai` is this workspace's dependency: Node resolves a package from the
 * importing file's own location, so a copy of this script under the
 * repo-root scripts/ directory cannot see it whatever the cwd.
 *
 * Re-run after a state-requirements refresh:  pnpm build:deadline-anchors
 * Verify an existing file without model calls:  pnpm check:deadline-anchors
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { generateObject } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../agent/model";
import {
  ANCHOR_KINDS,
  verifyDeadlineProposal,
  type DeadlineAnchorEntry,
  type DeadlineProposal,
} from "../lib/compliance/deadline-anchor-verify";

// Paths resolve from this file, not the caller's cwd: the script runs
// from apps/web (the workspace that carries the `ai` package) while its
// inputs and output live at the repo root.
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STATES_DIR = `${REPO_ROOT}data/state-requirements/states`;
const OUT = `${REPO_ROOT}apps/web/lib/compliance/deadline-anchors.generated.ts`;
const INDEX_PATH = `${REPO_ROOT}data/state-requirements/index.json`;

try {
  loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
} catch {
  // CI supplies the gateway credentials through the environment.
}

const proposalSchema = z.object({
  kind: z.enum(ANCHOR_KINDS).describe(
    "fixed: one calendar date every year. window: a date range every year. relative: counted from an event (within N days of starting). conditional: tied to an event with no countable number (before instruction begins). none: the text names no timing at all.",
  ),
  anchors: z
    .array(
      z.object({
        month: z.number().int().min(1).max(12).nullable().describe(
          "Calendar month 1-12, or null for a relative or conditional anchor that names no month.",
        ),
        day: z.number().int().min(1).max(31).nullable().describe(
          "Day of month, or null when the text names only a month or no date.",
        ),
        withinDays: z.number().int().min(1).max(365).nullable().describe(
          "For a relative anchor only: the number of days the text counts. Null otherwise.",
        ),
        label: z.string().min(3).max(80).describe(
          "How a parent should read this anchor, in plain words, sentence case. Examples: 'File by July 1', 'Within 14 days of starting mid-year', 'Before instruction begins'.",
        ),
        quote: z.string().min(3).describe(
          "The EXACT substring of the source deadline text this anchor comes from, copied character for character. Never paraphrase, never reformat, never fix punctuation.",
        ),
      }),
    )
    .max(4),
});

const SYSTEM = [
  "You turn one state's homeschool notification deadline text into typed calendar anchors for a compliance document a family prints.",
  "",
  "Rules, each one load-bearing:",
  "- Every anchor carries a `quote` that is an EXACT substring of the supplied text. Copy it character for character. A quote that does not appear verbatim causes the entire state to be dropped.",
  "- Never invent a date the text does not state. If the text says 'before instruction begins', that is conditional with no month and no day, not a guess at September.",
  "- A text with more than one timing branch gets more than one anchor. 'By July 1 annually, or within 14 days of commencing home instruction mid-year' is TWO anchors: a fixed July 1, and a relative 14 days.",
  "- kind describes the text as a whole; pick the kind of its primary (first) timing branch.",
  "- withinDays is filled ONLY for a relative anchor, and only with a number the text actually states.",
  "- Labels are plain sentence-case phrases a parent reads at a glance. No legal citations, no state name, no em dashes.",
  "- If the text names no timing at all, return kind 'none' and an empty anchors array.",
].join("\n");

interface StateInput {
  code: string;
  name: string;
  deadline: string;
}

function loadStates(): StateInput[] {
  const index = JSON.parse(
    readFileSync(INDEX_PATH, "utf8"),
  ) as { states: { state_code: string; state_name: string }[] };
  const out: StateInput[] = [];
  for (const entry of index.states) {
    const payload = JSON.parse(
      readFileSync(`${STATES_DIR}/${entry.state_code}.json`, "utf8"),
    ) as {
      pathways?: {
        is_default?: boolean;
        notification?: { deadline?: string | null };
      }[];
    };
    const pathways = payload.pathways ?? [];
    const dflt = pathways.find((p) => p.is_default) ?? pathways[0];
    const deadline = dflt?.notification?.deadline;
    if (typeof deadline === "string" && deadline.trim().length > 0) {
      out.push({
        code: entry.state_code,
        name: entry.state_name,
        deadline: deadline.trim(),
      });
    }
  }
  return out;
}

/** How many independent proposals to union per state (see the header). */
const SAMPLES = 2;

async function proposeFor(state: StateInput): Promise<DeadlineProposal | null> {
  try {
    const result = await generateObject({
      model: HOMA_MODEL,
      schema: proposalSchema,
      system: SYSTEM,
      prompt: `State: ${state.name}\nDeadline text: ${JSON.stringify(state.deadline)}`,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          disallowPromptTraining: true,
          tags: ["state_deadline_anchors"],
        },
      },
    });
    return result.object as DeadlineProposal;
  } catch (error) {
    console.error(
      `  ${state.code}: model call failed (${error instanceof Error ? error.message : "unknown"})`,
    );
    return null;
  }
}

function renderModule(entries: DeadlineAnchorEntry[]): string {
  const rows = entries
    .map((entry) => {
      const anchors = entry.anchors
        .map(
          (anchor) =>
            `      {\n` +
            `        month: ${anchor.month},\n` +
            `        day: ${anchor.day},\n` +
            `        withinDays: ${anchor.withinDays},\n` +
            `        label: ${JSON.stringify(anchor.label)},\n` +
            `        quote: ${JSON.stringify(anchor.quote)},\n` +
            `      },`,
        )
        .join("\n");
      return (
        `  ${entry.stateCode}: {\n` +
        `    stateCode: ${JSON.stringify(entry.stateCode)},\n` +
        `    kind: ${JSON.stringify(entry.kind)},\n` +
        `    source: ${JSON.stringify(entry.source)},\n` +
        `    anchors: [\n${anchors}\n    ],\n` +
        `  },`
      );
    })
    .join("\n");
  return `// GENERATED by scripts/build-deadline-anchors.mts. Do not edit by hand.
//
// Typed calendar anchors derived from each state's free-text notification
// deadline (gh#342). A model proposed each anchor and deterministic code
// verified it: every quote below appears verbatim in that state's own
// deadline string in data/state-requirements/, every calendar value is
// real, and any state whose proposal failed verification is simply absent
// here (its pack renders the verbatim string alone, as it always did).
//
// Re-run after a state-requirements refresh: pnpm build:deadline-anchors
// The verifier runs without model calls in CI: pnpm check:deadline-anchors

import type { DeadlineAnchorEntry } from "./deadline-anchor-verify";

export const DEADLINE_ANCHORS: Record<string, DeadlineAnchorEntry> = {
${rows}
};
`;
}

async function main(): Promise<void> {
  const states = loadStates();
  console.log(
    `Deriving deadline anchors for ${states.length} jurisdictions with deadline text.`,
  );
  const accepted: DeadlineAnchorEntry[] = [];
  const dropped: { code: string; reason: string }[] = [];

  for (const state of states) {
    const verdicts = [];
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const proposal = await proposeFor(state);
      if (!proposal) continue;
      const verdict = verifyDeadlineProposal(state.code, state.deadline, proposal);
      if (verdict.ok) verdicts.push(verdict.entry);
      else if (sample === SAMPLES - 1 && verdicts.length === 0) {
        dropped.push({ code: state.code, reason: verdict.reason });
        console.log(`  ${state.code}: dropped (${verdict.reason})`);
      }
    }
    if (verdicts.length === 0) {
      if (!dropped.some((d) => d.code === state.code)) {
        dropped.push({ code: state.code, reason: "no verified proposal" });
      }
      continue;
    }
    // Union the verified samples: each anchor already passed
    // verification on its own, so more of them is strictly more
    // complete. Identity is the calendar value, so two samples that
    // found the same date with different wording count once.
    const seen = new Set<string>();
    const merged = [];
    for (const entry of verdicts) {
      for (const anchor of entry.anchors) {
        const key = `${anchor.month}|${anchor.day}|${anchor.withinDays}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(anchor);
      }
    }
    const verdict = {
      ok: true as const,
      entry: { ...verdicts[0], anchors: merged.slice(0, 4) },
    };
    accepted.push(verdict.entry);
    console.log(
      `  ${state.code}: ${verdict.entry.kind}, ${verdict.entry.anchors.length} anchor(s): ${verdict.entry.anchors.map((a) => a.label).join(" | ")}`,
    );
  }

  accepted.sort((a, b) => a.stateCode.localeCompare(b.stateCode));
  writeFileSync(OUT, renderModule(accepted), "utf8");
  console.log(
    `\nWrote ${OUT}: ${accepted.length} verified, ${dropped.length} dropped.`,
  );
  if (dropped.length > 0) {
    console.log(
      `Dropped (these render the verbatim string alone, which is correct, not broken):`,
    );
    for (const drop of dropped) console.log(`  ${drop.code}: ${drop.reason}`);
  }
  console.log(
    `\nNext: review \`git diff apps/web/lib/compliance/deadline-anchors.generated.ts\` claim by claim against the source strings, then commit.`,
  );
}

await main();
