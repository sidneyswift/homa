import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { isNativeApproval, nativeAuthorizationObservation, parseNativePendingInput, validateNativeInputResponses } from "./conversation-native-input";

const question = { requestId: "question-1", prompt: "Which format?", allowFreeform: true, display: "select",
  action: { kind: "tool-call", callId: "call-1", toolName: "ask_question", input: { prompt: "Which format?" } },
  options: [{ id: "worksheet", label: "A worksheet" }, { id: "game", label: "A game" }] };
const approval = { requestId: "approval-2", prompt: "Send this?", allowFreeform: true, display: "confirmation",
  action: { kind: "tool-call", callId: "call-2", toolName: "send_email", input: { body: "Exact approved body" } },
  options: [{ id: "approve", label: "Approve" }, { id: "deny", label: "Deny" }] };
const event = { type: "input.requested", data: { turnId: "turn_3", sequence: 3, stepIndex: 2, requests: [question, approval] } };
const batch = () => parseNativePendingInput(event, "server-batch", "session-1", 19)!;
const responses = () => [{ requestId: "question-1", optionId: "worksheet" }, { requestId: "approval-2", optionId: "deny" }];

test("capture retains exact runtime origin and privately clones action input", () => {
  const stored = batch();
  assert.equal(stored.sourceIndex, 19);
  assert.deepEqual(stored.requests[1].action.input, { body: "Exact approved body" });
  stored.requests[1].action.input.body = "changed";
  assert.equal(approval.action.input.body, "Exact approved body");
  assert.equal(parseNativePendingInput({ type: "message.completed" }, "id", "session", 0), null);
  for (const changes of [{ sequence: -1 }, { turnId: "" }, { requests: [] }, { requests: [question, question] },
    { requests: [{ ...question, options: [{ id: "x", label: "x" }, { id: "x", label: "y" }] }] },
    { requests: [{ ...question, unexpected: true }] }]) {
    assert.throws(() => parseNativePendingInput({ ...event, data: { ...event.data, ...changes } }, "id", "session", 0));
  }
});

test("full exact batch accepts stored IDs, reorders deterministically, preserves exact freeform", () => {
  assert.deepEqual(validateNativeInputResponses(batch(), { batchId: "server-batch", responses: responses().reverse() }), responses());
  const freeform = [{ requestId: "question-1", text: "  Something else\nplease  " }, responses()[1]];
  assert.deepEqual(validateNativeInputResponses(batch(), { batchId: "server-batch", responses: freeform }), freeform);
});

test("rejects stale, partial, duplicate, foreign and label-inferred responses before native send", () => {
  for (const body of [
    { batchId: "old-batch", responses: responses() }, { batchId: "server-batch", responses: responses().slice(0, 1) },
    { batchId: "server-batch", responses: [responses()[0], responses()[0]] },
    { batchId: "server-batch", responses: [{ requestId: "foreign", optionId: "worksheet" }, responses()[1]] },
    { batchId: "server-batch", responses: [{ requestId: "question-1", optionId: "A worksheet" }, responses()[1]] },
    { batchId: "server-batch", responses: responses(), continuationToken: "browser-controlled" },
  ]) assert.throws(() => validateNativeInputResponses(batch(), body));
});

test("native text-only questions accept freeform when optional flag is absent", () => {
  const stored = batch();
  stored.requests = [{ ...stored.requests[0], display: "text", options: undefined, allowFreeform: undefined }];
  assert.deepEqual(validateNativeInputResponses(stored, { batchId: stored.id,
    responses: [{ requestId: "question-1", text: "My own answer" }] }), [{ requestId: "question-1", text: "My own answer" }]);
});

test("approval never accepts freeform, combined answers, unknown choices or forged action", () => {
  assert.equal(isNativeApproval(batch().requests[1]), true);
  for (const value of [{ requestId: "approval-2", text: "approve" },
    { requestId: "approval-2", optionId: "yes" }, { requestId: "approval-2", optionId: "approve", text: "change recipient" },
    { requestId: "approval-2", optionId: "approve", action: { input: {} } }, { requestId: "approval-2" }]) {
    assert.throws(() => validateNativeInputResponses(batch(), { batchId: "server-batch", responses: [responses()[0], value] }));
  }
  const noFreeform = batch(); noFreeform.requests[0].allowFreeform = false;
  assert.throws(() => validateNativeInputResponses(noFreeform, { batchId: "server-batch", responses: [{ requestId: "question-1", text: "other" }, responses()[1]] }));
});

test("OAuth authorized event is a matched callback receipt, never verified connection success", () => {
  const expected = { name: "google", turnId: "turn_3", sequence: 3, stepIndex: 2 };
  const authEvent = { type: "authorization.completed", data: { ...expected, outcome: "authorized" } };
  assert.equal(nativeAuthorizationObservation(authEvent, expected), "callback_received");
  for (const change of [{ name: "other" }, { turnId: "turn_4" }, { sequence: 4 }, { stepIndex: 3 }]) {
    assert.equal(nativeAuthorizationObservation({ ...authEvent, data: { ...authEvent.data, ...change } }, expected), null);
  }
  assert.equal(nativeAuthorizationObservation({ ...authEvent, data: { ...expected, outcome: "failed" } }, expected), "failed");
});

// Installed-runtime compatibility evidence. If Eve changes these semantics,
// revisiting this boundary is intentional, not a reason to loosen validation.
const eveRoot = new URL("../node_modules/eve/", import.meta.url);
test("installed Eve silently consumes a partial question batch and ignores unmatched IDs", async () => {
  const runtime = await import(new URL("dist/src/harness/input-requests.js", eveRoot).href);
  const other = { ...question, requestId: "question-2", action: { ...question.action, callId: "call-2" } };
  const session = runtime.setPendingInputBatch({ session: { history: [] }, requests: [question, other], responseMessages: [],
    event: { turnId: "turn_3", sequence: 3, stepIndex: 2 } });
  const partial = runtime.resolvePendingInput({ session, stepInput: { inputResponses: [{ requestId: "question-1", optionId: "worksheet" }] } });
  assert.equal(partial.outcome, "resolved");
  assert.equal(partial.messages[0].content[1].output.value.status, "ignored");
  const stale = runtime.resolvePendingInput({ session, stepInput: { inputResponses: [{ requestId: "old-question", optionId: "worksheet" }] } });
  assert.equal(stale.outcome, "resolved");
  assert.ok(stale.messages[0].content.every((part: { output: { value: { status: string } } }) => part.output.value.status === "ignored"));
  const ordinary = runtime.resolvePendingInput({ session, stepInput: { message: "Something unrelated" } });
  assert.equal(ordinary.outcome, "resolved");
});

test("installed Eve response-only continuation starts a turn without message.received; denial belongs to origin", async () => {
  const runtime = await import(new URL("dist/src/harness/input-requests.js", eveRoot).href);
  const emission = await import(new URL("dist/src/harness/emission.js", eveRoot).href);
  const observed: { type: string }[] = [];
  await emission.emitTurnPreamble(async (value: { type: string }) => { observed.push(value); }, { inputResponses: responses() },
    { sessionStarted: true, sequence: 4, stepIndex: 0, turnId: "" });
  assert.deepEqual(observed.map(value => value.type), ["turn.started"]);
  const session = runtime.setPendingInputBatch({ session: { history: [] }, requests: [approval], responseMessages: [],
    event: { turnId: "turn_3", sequence: 3, stepIndex: 2 } });
  const denial = runtime.resolvePendingInput({ session, stepInput: { inputResponses: [responses()[1]] } });
  assert.deepEqual(denial.rejectedActions.event, { turnId: "turn_3", sequence: 3, stepIndex: 2 });
  assert.equal(denial.rejectedActions.results[0].callId, "call-2");
});

test("installed OAuth callback reports authorized before entering provider runtime execution", async () => {
  const source = await readFile(new URL("dist/src/execution/workflow-steps.js", eveRoot), "utf8");
  const receipt = source.indexOf('createAuthorizationCompletedEvent({authorization:');
  const runtime = source.indexOf('createExecutionNodeStep({', receipt);
  assert.ok(receipt > 0 && runtime > receipt);
  assert.match(source.slice(receipt, runtime), /outcome:`authorized`/);
});


test("proxied child native input cannot become an answerable root batch",()=>{
  assert.equal(parseNativePendingInput({type:'input.requested',data:{nativeInputSource:'proxy',turnId:'child_turn_9',sequence:9,stepIndex:0,requests:[]}},
    'server-batch','runtime',1),null);
});
