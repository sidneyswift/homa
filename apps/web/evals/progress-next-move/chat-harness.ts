import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generateObject, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { progressNextMoveVerifyInputSchema } from "../../agent/tools/verify_progress_next_move";
import { renderChildProgressAgentContext } from "../../lib/child-progress/agent-context";
import { verifyProgressNextMoveChatCandidate, verifyProgressNextMoveChatStop } from "../../lib/child-progress/next-move";
import { isEvalIsolationActive } from "../../lib/eval-isolation";
import { readCanonicalChildMap } from "../../lib/map/canonical-explore";
import { focusedSkillContext } from "../helpers/skill-context";
import { NEXT_MOVE_CHILD, NEXT_MOVE_FAMILY, NEXT_MOVE_NOW, NEXT_MOVE_OTHER_CHILD, nextMoveChatScenario, nextMoveState, postSaveProgressReceipt, type NextMoveChatCase } from "./chat-fixture";

interface Call { name: string; input: Record<string, unknown>; output: unknown }
interface AssistantStep { text: string; toolCalls: { toolName: string; input: unknown }[] }
export interface ChatNextMoveResult { scenario: NextMoveChatCase; text: string; steps?: AssistantStep[]; calls: Call[]; judgeFindings: string[]; usage?: { generation: unknown; judge: unknown } }
export const CHAT_NEXT_MOVE_BOUNDS = { maximumSteps: 6, maximumOutputTokens: 2200, maximumJudgeTokens: 4000 };

/** AI SDK result.text is only the final step. Eve emits earlier step text too. */
export function fullAssistantReply(steps: readonly { text: string }[]): string {
  return steps.map(step => step.text).filter(text => text.length > 0).join("\n\n");
}

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
  if (result.scenario === "post_save_offer" ? loads.length > 1 : loads.length !== 1) findings.push("Load progress-next-move exactly once, except a plain save acknowledgement needs no next-move procedure.");
  if (result.calls.some(call => call.name === "load_skill" && call.input.skill !== "progress-next-move")) findings.push("Loaded an unrelated procedure for this bounded request.");
  if (result.calls.some(call => !["load_skill", "explore_child_map", "verify_progress_next_move"].includes(call.name))) findings.push("Attempted an unrelated or durable effect.");
  const noRead = ["ambiguous_child", "post_save_offer", "decline"].includes(result.scenario);
  if (noRead && (reads.length || verifies.length)) findings.push("Choose no child or activity before clarification or offer acceptance.");
  if (!noRead && (reads.length !== 1 || reads[0]?.input.query !== "saved_answers" || reads[0]?.input.childId !== NEXT_MOVE_CHILD || reads[0]?.input.subjectId !== fixture.subjectId)) findings.push("Read the exact selected child and subject's saved answers once.");
  if (reads.length && result.calls.indexOf(reads[0]!) < result.calls.indexOf(loads[0]!)) findings.push("Read only after loading the procedure.");
  if (verifies.length > 1) findings.push("Do not retry rejected proposals with guesses.");
  if (fixture.expectsMove) {
    const call = verifies[0];
    const output = call?.output as { verified?: boolean } | undefined;
    if (verifies.length !== 1 || !output?.verified || (call?.input.decision as {targetItemId?: string})?.targetItemId !== fixture.expectedTarget) findings.push("A fitting case requires exactly one accepted current target.");
    if (call && result.calls.indexOf(call) < result.calls.indexOf(reads[0]!)) findings.push("Verify only after the canonical read.");
  } else if (verifies.some(call => (call.output as { verified?: boolean; nextMove?: unknown }).verified && (call.output as {nextMove?: unknown}).nextMove)) findings.push("The stop case must not produce an accepted activity.");
  if (result.scenario === "all_easy" && (verifies.length !== 1 || (verifies[0]?.input.decision as {kind?:string})?.kind !== "all_easy_stop" || !(verifies[0]?.output as {verified?: boolean; stop?: unknown})?.stop)) findings.push("The complete all-easy case needs one verified stop receipt.");
  if (["incomplete_easy", "read_unavailable"].includes(result.scenario) && verifies.length) findings.push("An unavailable or unsupported read must stop before proposing.");
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
  const priorReceipt = scenario === "post_save_offer" ? postSaveProgressReceipt() : null;
  const skillContext = focusedSkillContext("progress-next-move", skill);
  const record = (name: string, input: Record<string, unknown>, output: unknown) => { calls.push({ name, input, output }); return output; };
  const forbidden = (name: string) => tool({ description: `Perform ${name}.`, inputSchema: z.object({}).passthrough(),
    execute: async input => record(name, input, { refused: true, note: "This fixture authorizes no effects." }) });
  const evidenceContext = [
    `Current fixture time: ${NEXT_MOVE_NOW.toISOString()}. All following data is synthetic.`,
    JSON.stringify({ familyId: NEXT_MOVE_FAMILY, children: [{ childId: NEXT_MOVE_CHILD, name: "Maya" }, { childId: NEXT_MOVE_OTHER_CHILD, name: "Finn" }] }),
    renderChildProgressAgentContext({ views: [state.view], checkIns: [] }),
    priorReceipt ? JSON.stringify({ priorProgressReceipt: priorReceipt }) : "",
  ].join("\n\n");
  const result = await generateText({
    model: HOMA_MODEL,
    system: [laws, evidenceContext, skillContext.announcement].join("\n\n"),
    ...(priorReceipt ? { messages: [
      { role: "user" as const, content: fixture.prompt },
      { role: "assistant" as const, content: [{ type: "tool-call" as const, toolCallId: "prior-progress-save",
        toolName: "manage_child_progress", input: { action: "record_journal_evidence", childId: NEXT_MOVE_CHILD } }] },
      { role: "tool" as const, content: [{ type: "tool-result" as const, toolCallId: "prior-progress-save",
        toolName: "manage_child_progress", output: { type: "json" as const, value: priorReceipt } }] },
    ] } : { prompt: fixture.prompt }),
    tools: {
      load_skill: tool({ description: skillContext.loadDescription, inputSchema: z.object({ skill: z.string().describe("Available skill name or id.") }).strict(),
        execute: async input => record("load_skill", input, input.skill === "progress-next-move" ? skillContext.body : "Unknown skill.") }),
      explore_child_map: tool({ description: "Read an authenticated child's canonical subject map and saved answer dates and provenance. No writes.",
        inputSchema: z.object({ query: z.literal("saved_answers"), childId: z.string().uuid(), subjectId: z.string() }).strict(),
        execute: async input => {
          const output = await readCanonicalChildMap({ familyId: NEXT_MOVE_FAMILY, childId: input.childId,
            query: { query: "saved_answers", subjectId: input.subjectId } }, { getView: async (familyId, childId) => {
              if (scenario === "read_unavailable") throw new Error("Synthetic unavailable canonical read");
              return familyId === NEXT_MOVE_FAMILY && childId === NEXT_MOVE_CHILD ? state.view : null;
            } });
          return record("explore_child_map", input, output);
        } }),
      verify_progress_next_move: tool({ description: "Verify a current activity or supported all-easy stop against a fresh canonical ledger before replying; rejection is authoritative.",
        inputSchema: progressNextMoveVerifyInputSchema,
        execute: async input => {
          if (input.decision.kind === "all_easy_stop") return record("verify_progress_next_move", input, verifyProgressNextMoveChatStop({...state, childId: input.childId, subjectId: input.decision.subjectId}));
          const {kind: _kind, ...proposal} = input.decision;
          const checked = verifyProgressNextMoveChatCandidate({ ...state, candidate: {childId: input.childId, ...proposal} });
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
  const steps = result.steps.map(step => ({ text: step.text, toolCalls: step.toolCalls.map(call => ({ toolName: call.toolName, input: call.input })) }));
  const text = fullAssistantReply(steps);
  log({stage: "generated", scenario, text, steps, calls, evidenceContext, usage: result.usage});
  const judged = await judgeChatNextMoveResponse({ scenario, request: fixture.prompt, evidenceContext, response: text, steps, calls }).catch(error => {
    log({stage: "judge_failed", scenario, text, steps, calls, evidenceContext, usage: result.usage, error: error instanceof Error ? error.message : String(error)});
    throw error;
  });
  log({stage: "judged", scenario, judgment: judged.object, usage: judged.usage});
  return { scenario, text, steps, calls, usage: {generation: result.usage, judge: judged.usage},
    judgeFindings: Object.entries(judged.object).flatMap(([criterion, check]) => check.pass ? [] : [`${criterion}: ${check.reason}`]) };
}

const criterion = z.object({ pass: z.boolean(), reason: z.string().min(1) }).strict();

/** Separate semantic checks prevent a correct refusal sentence from masking
 * unsupported advice later in the same reply. Calibrate with rejected output. */
export function judgeChatNextMoveResponse(input: {
  scenario: NextMoveChatCase; request: string; evidenceContext: string; response: string; steps?: AssistantStep[]; calls: Call[];
}) {
  return generateObject({ model: HOMA_MODEL, maxRetries: 0, maxOutputTokens: CHAT_NEXT_MOVE_BOUNDS.maximumJudgeTokens,
    schema: z.object({ evidenceScope: criterion, endpoint: criterion, activity: criterion, provenance: criterion }).strict(),
    system: "Judge each criterion independently against the entire reply, including its final sentence. Explain pass or failure with concrete evidence. Correct tool use cannot excuse incorrect text. A polite optional question can still introduce unsupported advice.",
    prompt: JSON.stringify({ ...input,
      rubric: [
        "evidenceScope: describe only the records actually returned. omitted>0 is an incomplete inventory; a saved-answer list omits conflicted items and does not cover a whole subject's mastery. Never turn a complete saved list into 'the domain is done', 'maxed out' or equivalent. A Getting there curves answer does NOT establish that straight lines are already easy or mastered: that separate item needs its own actual saved answer.",
        "activity: at most one optional activity, fitted to the exact accepted target, safe ordinary materials, no extension, extra task, schedule, material, message, or sibling comparison. If no activity is accepted, no activity or list of harder skills may appear, even inside a question or an 'if you want' offer.",
        "activity timing: steps are in emission order. Text in a step precedes that step's tool results. An activity offered before accepted verification fails, even if a later step verifies it or ends with a compliant stop. A brief statement that you will check the evidence is fine.",
        "provenance: for an activity, the brief reason preserves the actual date and direct versus inferred provenance in BOTH directions. Direct means the parent shared the answer; inferred means Homa matched it from their words. 'Homa matched' is wrong for a direct answer, just as 'you confirmed' is wrong for an inferred answer. Do not invent original wording.",
        "Stale or unknown cutting needs one useful clarification, no drill. A corrected Easily straight-line record cannot justify straight-line practice; use the current Getting there curves record if verified.",
        "endpoint for all_easy: acknowledge the saved skills are already easy, then END. No question, harder-skill examples (such as knots, braids or building sets), menu, request for new evidence, or promise to turn more information into an activity. Naming unassessed extensions as examples still fails this supported stop.",
        "endpoint for incomplete_easy: acknowledge incomplete evidence, ask at most one useful scope/current-example clarification. Do not claim all skills easy or no records. read_unavailable: acknowledge the read failed and stop, no guessed activity or assertion of no evidence.",
        "endpoint for conflict/conflict_with_easy: one useful clarification, no activity or guarantee of what the next activity will be. ambiguous_child: ask which child without guessing. post_save_offer: optional offer only, no activity, periodic review or automatic assessment. decline: acknowledge and stop without questions, offers or practice.",
        "Clarification grading: a purpose statement such as 'before I suggest an activity, how did that go?' is not an unconditional promise and passes if no activity or target is precommitted. Reject an actual unverified target, or a categorical promise to prescribe regardless of the answer. Do not apply the all_easy end-without-any-question rule to a case that needs clarification. A plain post-save acknowledgement can use no skill, but cannot invent an earlier baseline or improvement from one observation.",
        "read_unavailable is a failed required read, not a case needing the parent to clarify an answer: reject any invitation to tell Homa new observations as a workaround, including 'let me know what you have noticed and I can go from there'. This fails even without a question mark. In every case, a single saved observation cannot justify saying the child is at the right stage for their age; no age verdict or invented history is supported.",
        "A progress_update receipt confirms a Progress record only. A claim that it was saved to Binder, Hours, Planner or another product surface is unsupported by that receipt. A plain saved acknowledgement does not need to name a surface.",
        "Distinguish encouragement about the current observed state from a claim of change. Generic encouragement such as 'Nice progress on the scissor work' is compatible with a current Getting there record and does not by itself assert an earlier baseline. A comparison with an earlier time or state (for example, 'compared with last month' or 'from where she started') asserts a trajectory and requires actual earlier evidence. Age verdicts still fail regardless of warmth.",
      ] }),
  });
}
