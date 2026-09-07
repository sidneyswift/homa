import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { readCanonicalChildMap } from "../map/canonical-explore";
import { renderChildProgressAgentContext } from "./agent-context";
import { buildProgressNextMoveSnapshot } from "./next-move-snapshot";
import * as nextMove from "./next-move";
import { crowdedNextMoveLedger, cuttingCandidate, CUT_CURVES, CUT_LINE, MUSIC_ITEM, NEXT_MOVE_CHILD,
  NEXT_MOVE_FAMILY, NEXT_MOVE_NOW, NEXT_MOVE_OTHER_CHILD, nextMoveEvidence, nextMoveLedger, nextMoveState,
  nextMoveChatScenario } from "../../evals/progress-next-move/chat-fixture";

function executeActualTool(ledger: ReturnType<typeof nextMoveLedger>) {
  const source = readFileSync(new URL("../../agent/tools/verify_progress_next_move.ts", import.meta.url), "utf8");
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let reads = 0;
  const required = createRequire(import.meta.url);
  const toolModule = { exports: {} as { default: { execute(input: unknown, ctx: unknown): Promise<Record<string, unknown>> } } };
  class FixedDate extends Date { constructor() { super(NEXT_MOVE_NOW); } }
  runInNewContext(script, { exports: toolModule.exports, module: toolModule, Date: FixedDate, require: (name: string) => {
    if (name === "../../lib/agent-tool-deadline") return { defineBoundedTool: (value: unknown) => value, TOOL_DEADLINE: { fetch: 100 } };
    if (name === "../../lib/agent-db") return { resolveAgentAccess: async (attributes: { familyId: string }) => ({ familyId: attributes.familyId }), MissingFamilyContextError: class extends Error {} };
    if (name === "../../lib/child-progress/next-move") return nextMove;
    if (name === "../../lib/child-progress/next-move-snapshot") return { loadProgressNextMoveSnapshot: async (input: { familyId: string; childId: string }) => {
      reads += 1;
      assert.equal(input.familyId, NEXT_MOVE_FAMILY);
      if (input.childId !== NEXT_MOVE_CHILD) return null;
      return buildProgressNextMoveSnapshot({ familyId: input.familyId, ledger, now: NEXT_MOVE_NOW });
    } };
    if (name === "zod") return required(name);
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { run: (candidate: unknown) => toolModule.exports.default.execute(candidate, { session: { auth: { current: { attributes: { familyId: NEXT_MOVE_FAMILY } } } } }), reads: () => reads };
}

describe("Scoped canonical chat next move", () => {
  for (const itemId of [CUT_CURVES, MUSIC_ITEM]) it(`reads and verifies ${itemId} outside the summary and producer budget`, async () => {
    const ledger = crowdedNextMoveLedger(), state = nextMoveState(ledger);
    const before = JSON.stringify(ledger, (_, v) => typeof v === "bigint" ? v.toString() : v);
    const summary = renderChildProgressAgentContext({ views: [state.view], checkIns: [] });
    const context = JSON.parse(summary.slice(summary.indexOf("{\""))) as { liveProgress: { subjects: unknown[] }[] };
    assert.doesNotMatch(JSON.stringify(context.liveProgress[0]?.subjects ?? []), new RegExp(itemId.replaceAll(".", "\\."), "u"));
    const scoped = await readCanonicalChildMap({ familyId: NEXT_MOVE_FAMILY, childId: NEXT_MOVE_CHILD,
      query: { query: "subject_map", subjectId: itemId === MUSIC_ITEM ? "music" : "fine_motor" } }, {
      getView: async (familyId, childId) => { assert.equal(familyId, NEXT_MOVE_FAMILY); assert.equal(childId, NEXT_MOVE_CHILD); return state.view; },
    });
    assert.ok("savedAnswers" in scoped && scoped.savedAnswers);
    assert.ok(scoped.savedAnswers.answers.some(row => row.itemId === itemId && row.derivation === "direct"));
    const candidate = cuttingCandidate(itemId);
    assert.equal(nextMove.verifyProgressNextMoveCandidate({ ...state, candidate }).accepted, false);
    const tool = executeActualTool(ledger), result = await tool.run(candidate);
    assert.equal(result.verified, true);
    assert.equal(tool.reads(), 1);
    assert.equal(JSON.stringify(ledger, (_, v) => typeof v === "bigint" ? v.toString() : v), before);
  });

  it("keeps an actual omitted non-easy answer distinct from a complete all-easy inventory", async () => {
    const { ledger } = nextMoveChatScenario("incomplete_easy"), state = nextMoveState(ledger);
    const read = await readCanonicalChildMap({ familyId: NEXT_MOVE_FAMILY, childId: NEXT_MOVE_CHILD,
      query: { query: "subject_map", subjectId: "math" } }, { getView: async () => state.view });
    assert.ok("savedAnswers" in read && read.savedAnswers);
    assert.equal(read.savedAnswers.total, 25);
    assert.equal(read.savedAnswers.answers.length, 24);
    assert.equal(read.savedAnswers.omitted, 1);
    assert.ok(read.savedAnswers.answers.every(answer => answer.answer === "easily"));
    assert.equal(nextMove.buildProgressNextMoveModelContext(state).allowedTargets.length, 1);
  });

  it("re-reads a correction and rejects the old target while accepting its actual current replacement", async () => {
    const { ledger } = nextMoveChatScenario("corrected_cutting");
    const tool = executeActualTool(ledger);
    assert.equal((await tool.run(cuttingCandidate(CUT_LINE))).verified, false);
    const result = await tool.run(cuttingCandidate());
    assert.equal(result.verified, true);
    const move = result.nextMove as { sourceRevision: string; evidence: { derivation: string; observedAt: string }[] };
    assert.equal(move.sourceRevision, "8");
    assert.equal(move.evidence[0]?.derivation, "inferred");
    assert.equal(move.evidence[0]?.observedAt, "2026-09-04T16:00:00.000Z");
  });

  for (const name of ["stale_cutting", "unknown_cutting", "all_easy", "conflict"] as const) it(`refuses ${name} through the actual chat tool`, async () => {
    const { ledger } = nextMoveChatScenario(name);
    const tool = executeActualTool(ledger);
    const result = await tool.run(cuttingCandidate(name.includes("cutting") ? CUT_LINE : CUT_CURVES));
    assert.equal(result.verified, false);
    assert.equal(tool.reads(), 1);
  });

  it("retains foreign child, forged ID, uncited target and cross-subject rejection", async () => {
    const tool = executeActualTool(crowdedNextMoveLedger());
    for (const candidate of [
      { ...cuttingCandidate(), childId: NEXT_MOVE_OTHER_CHILD },
      { ...cuttingCandidate(), targetItemId: "fake.target" },
      { ...cuttingCandidate(), evidenceItemIds: [MUSIC_ITEM] },
      { ...cuttingCandidate(), evidenceItemIds: [CUT_CURVES, MUSIC_ITEM] },
    ]) assert.equal((await tool.run(candidate)).verified, false);
  });

  it("rejects stale or unknown targets beside other fresh known evidence", () => {
    for (const override of [{ observedAt: "2026-07-07T16:00:00.000Z" }, { derivation: "unknown" as const }]) {
      const ledger = nextMoveLedger([nextMoveEvidence(MUSIC_ITEM), nextMoveEvidence(CUT_CURVES, override)]);
      assert.equal(nextMove.verifyProgressNextMoveChatCandidate({ ...nextMoveState(ledger), candidate: cuttingCandidate() }).accepted, false);
    }
  });
});
