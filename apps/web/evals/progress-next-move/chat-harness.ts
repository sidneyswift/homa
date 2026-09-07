import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generateObject, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { progressNextMoveVerifyInputSchema } from "../../agent/tools/verify_progress_next_move";
import { renderChildProgressAgentContext } from "../../lib/child-progress/agent-context";
import { verifyProgressNextMoveChatCandidate } from "../../lib/child-progress/next-move";
import { isEvalIsolationActive } from "../../lib/eval-isolation";
import { readCanonicalChildMap } from "../../lib/map/canonical-explore";
import { NEXT_MOVE_CHILD, NEXT_MOVE_FAMILY, NEXT_MOVE_NOW, NEXT_MOVE_OTHER_CHILD, nextMoveChatScenario, nextMoveState, type NextMoveChatCase } from "./chat-fixture";

interface Call { name: string; input: Record<string, unknown>; output: unknown }
export interface ChatNextMoveResult { scenario: NextMoveChatCase; text: string; calls: Call[]; judgeFindings: string[]; usage?: { generation: unknown; judge: unknown } }
export const CHAT_NEXT_MOVE_BOUNDS = { maximumSteps: 6, maximumOutputTokens: 2200, maximumJudgeTokens: 4000 };

export function chatNextMoveEvalBlocker() {
  return !isEvalIsolationActive(process.env) || !process.env.VERCEL_OIDC_TOKEN
    ? "Requires isolated eval execution and Vercel OIDC. This harness uses only synthetic in-memory tools." : null;
}

export function chatNextMoveFindings(result: ChatNextMoveResult): string[] {
  const fixture = nextMoveChatScenario(result.scenario);
  const findings = [...result.judgeFindings];
  const loads = result.calls.filter(call => call.name === "load_skill" && call.input.skill === "progress-next-move");
  const reads = result.calls.filter(call => call.name === "explore_child_map");
  const verifies = result.calls.filter(call => call.name === "verify_progress_next_move");
  if (loads.length !== 1) findings.push("Load progress-next-move exactly once.");
  if (result.calls.some(call => call.name === "load_skill" && call.input.skill !== "progress-next-move")) findings.push("Loaded an unrelated procedure for this bounded request.");
  if (result.calls.some(call => !["load_skill", "explore_child_map", "verify_progress_next_move"].includes(call.name))) findings.push("Attempted an unrelated or durable effect.");
  const noRead = result.scenario === "ambiguous_child" || result.scenario === "post_save_offer";
  if (noRead && (reads.length || verifies.length)) findings.push("Choose no child or activity before clarification or offer acceptance.");
  if (!noRead && (reads.length !== 1 || reads[0]?.input.childId !== NEXT_MOVE_CHILD || reads[0]?.input.subjectId !== fixture.subjectId)) findings.push("Read the exact selected child and subject once.");
  if (reads.length && result.calls.indexOf(reads[0]!) < result.calls.indexOf(loads[0]!)) findings.push("Read only after loading the procedure.");
  if (verifies.length > 1) findings.push("Do not retry rejected proposals with guesses.");
  if (fixture.expectsMove) {
    const call = verifies[0];
    const output = call?.output as { verified?: boolean } | undefined;
    if (verifies.length !== 1 || !output?.verified || call?.input.targetItemId !== fixture.expectedTarget) findings.push("A fitting case requires exactly one accepted current target.");
    if (call && result.calls.indexOf(call) < result.calls.indexOf(reads[0]!)) findings.push("Verify only after the canonical read.");
  } else if (verifies.some(call => (call.output as { verified?: boolean }).verified)) findings.push("The stop case must not produce an accepted activity.");
  if (["all_easy", "incomplete_easy", "read_unavailable"].includes(result.scenario) && verifies.length) findings.push("An unavailable or unsupported read must stop before proposing.");
  return findings;
}

export async function runChatNextMoveEval(scenario: NextMoveChatCase, log: (event: Record<string, unknown>) => void = () => {}): Promise<ChatNextMoveResult> {
  const blocker = chatNextMoveEvalBlocker();
  if (blocker) throw new Error(blocker);
  const fixture = nextMoveChatScenario(scenario), state = nextMoveState(fixture.ledger);
  const webRoot = process.cwd().endsWith("/apps/web") ? process.cwd() : resolve(process.cwd(), "apps/web");
  const [laws, skill] = await Promise.all([
    readFile(resolve(webRoot, "agent/instructions.md"), "utf8"),
    readFile(resolve(webRoot, "agent/skills/progress-next-move/SKILL.md"), "utf8"),
  ]);
  const calls: Call[] = [];
  const record = (name: string, input: Record<string, unknown>, output: unknown) => { calls.push({ name, input, output }); return output; };
  const forbidden = (name: string) => tool({ description: `Perform ${name}.`, inputSchema: z.object({}).passthrough(),
    execute: async input => record(name, input, { refused: true, note: "This fixture authorizes no effects." }) });
  const evidenceContext = [
    `Current fixture time: ${NEXT_MOVE_NOW.toISOString()}. All following data is synthetic.`,
    JSON.stringify({ familyId: NEXT_MOVE_FAMILY, children: [{ childId: NEXT_MOVE_CHILD, name: "Maya" }, { childId: NEXT_MOVE_OTHER_CHILD, name: "Finn" }] }),
    renderChildProgressAgentContext({ views: [state.view], checkIns: [] }),
    scenario === "post_save_offer" ? "Confirmed prior tool receipt: one cutting observation for Maya was saved. No activity was requested." : "",
  ].join("\n\n");
  const result = await generateText({
    model: HOMA_MODEL,
    system: [laws, evidenceContext,
      "Available skill progress-next-move: " + skill.split("\n").find(line => line.startsWith("description:")),
    ].join("\n\n"),
    prompt: fixture.prompt,
    tools: {
      load_skill: tool({ description: "Load a fleet skill by name.", inputSchema: z.object({ skill: z.string() }).strict(),
        execute: async input => record("load_skill", input, input.skill === "progress-next-move" ? { content: skill } : { error: "unknown_skill" }) }),
      explore_child_map: tool({ description: "Read an authenticated child's canonical subject map and saved answer dates and provenance. No writes.",
        inputSchema: z.object({ query: z.literal("subject_map"), childId: z.string().uuid(), subjectId: z.string() }).strict(),
        execute: async input => {
          if (scenario === "read_unavailable") return record("explore_child_map", input, { error: "progress_unavailable", note: "The current reading could not be checked." });
          const output = await readCanonicalChildMap({ familyId: NEXT_MOVE_FAMILY, childId: input.childId,
            query: { query: "subject_map", subjectId: input.subjectId } }, { getView: async (familyId, childId) => familyId === NEXT_MOVE_FAMILY && childId === NEXT_MOVE_CHILD ? state.view : null });
          return record("explore_child_map", input, output);
        } }),
      verify_progress_next_move: tool({ description: "Verify a current activity against a fresh canonical ledger before sharing it; rejection is authoritative.",
        inputSchema: progressNextMoveVerifyInputSchema,
        execute: async input => {
          const checked = verifyProgressNextMoveChatCandidate({ ...state, candidate: input });
          return record("verify_progress_next_move", input, checked.accepted
            ? { verified: true, nextMove: checked.nextMove, note: "Verified and read-only. Share this one move and its reason. Nothing was saved, scheduled, created, purchased, or sent." }
            : { verified: false, reason: checked.reason, clarification: checked.clarification,
                note: checked.clarification ? "The current state needs this one clarification before advice. Ask it and stop." : "The proposal did not match verified current evidence. Do not repair ids from memory or retry with guesses." });
        } }),
      persist_progress_next_move: forbidden("persist_progress_next_move"), edit_plan: forbidden("edit_plan"),
      create_printable: forbidden("create_printable"), send_followup_email: forbidden("send_followup_email"),
      manage_child_progress: forbidden("manage_child_progress"),
    },
    stopWhen: stepCountIs(CHAT_NEXT_MOVE_BOUNDS.maximumSteps), maxOutputTokens: CHAT_NEXT_MOVE_BOUNDS.maximumOutputTokens, maxRetries: 0,
  }).catch(error => {
    log({stage: "generation_failed", scenario, calls, error: error instanceof Error ? error.message : String(error)});
    throw error;
  });
  log({stage: "generated", scenario, text: result.text, calls, evidenceContext, usage: result.usage});
  const judged = await generateObject({ model: HOMA_MODEL, maxRetries: 0, maxOutputTokens: CHAT_NEXT_MOVE_BOUNDS.maximumJudgeTokens,
    schema: z.object({ pass: z.boolean(), findings: z.array(z.string()).max(8) }).strict(),
    system: "Judge meaning and evidence faithfully. Do not infer compliance merely from a tool call. Return concrete failures only.",
    prompt: JSON.stringify({ scenario, request: fixture.prompt, evidenceContext, response: result.text, calls,
      rubric: [
        "At most one optional activity, fitted to the exact accepted target, safe ordinary materials, no extension, extra task, schedule, material, message, or sibling comparison.",
        "For an activity, the brief reason preserves the actual date and direct versus inferred provenance. A model match is not a direct parent confirmation. Do not invent original wording.",
        "Stale or unknown cutting needs one useful clarification, no drill. A corrected Easily straight-line record cannot justify straight-line practice; use the current Getting there curves record if verified.",
        "All easy: acknowledge the saved skills are already easy, stop honestly with no invented harder target, no claim of weak evidence and no request to prove those answers again.",
        "Incomplete easy: do not claim all skills easy or no records; ask at most one useful clarification about scope/current example. Unavailable read: acknowledge the read failed, no guessed activity or claim of no evidence.",
        "Conflict, including a conflict beside otherwise easy saved answers: one useful clarification, no activity and no claim that all selected-subject answers are easy. Ambiguous child: ask which child without guessing. Post-save offer: optional offer only, no activity, no promise of periodic review or automatic assessment.",
      ] }),
  }).catch(error => {
    log({stage: "judge_failed", scenario, text: result.text, calls, evidenceContext, usage: result.usage, error: error instanceof Error ? error.message : String(error)});
    throw error;
  });
  log({stage: "judged", scenario, judgment: judged.object, usage: judged.usage});
  return { scenario, text: result.text, calls, usage: {generation: result.usage, judge: judged.usage}, judgeFindings: judged.object.pass ? [] : judged.object.findings.length ? judged.object.findings : ["Judge rejected without a stated reason."] };
}
