import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultMessageReducer, type EveMessage, type EveMessagePart } from "eve/client";

import { durableWorkspaceActivity, workspaceActivity } from "./workspace-activity";

const user: EveMessage = { id: "u", role: "user", parts: [{ type: "text", text: "Find a nature activity" }] };
function activity(parts: EveMessagePart[], waitingForReply = true) {
  return workspaceActivity({ busy: true, preparing: false, waitingForReply,
    messages: [user, { id: "a", role: "assistant", parts }] });
}
function tool(id: string, name: string, state: "input-available" | "output-available" = "input-available", output: unknown = {}): EveMessagePart {
  return state === "output-available"
    ? { type: "dynamic-tool", toolCallId: id, toolName: name, state, input: {}, output }
    : { type: "dynamic-tool", toolCallId: id, toolName: name, state, input: {} };
}

test("Thinking advances with actual search, read, and response events", () => {
  assert.equal(activity([])?.label, "Thinking");
  assert.equal(activity([tool("s", "web_search")])?.label, "Searching the web");
  assert.equal(activity([tool("s", "web_search", "output-available")])?.label, "Considering the results");
  assert.equal(activity([tool("s", "web_search", "output-available"), tool("r", "web_fetch")])?.label, "Reading a source");
  assert.equal(activity([tool("r", "web_fetch", "output-available"), { type: "text", text: "Try this", state: "streaming" }], false), null);
});

test("the installed Eve event projection updates a tool in place through failure", () => {
  const reducer = defaultMessageReducer();
  let data = reducer.reduce(reducer.initial(), { type: "message.received", data: { turnId: "turn", message: "Read a page", sequence: 1 } });
  data = reducer.reduce(data, { type: "actions.requested", data: { turnId: "turn", sequence: 2, stepIndex: 0,
    actions: [{ kind: "tool-call", callId: "fetch", toolName: "web_fetch", input: { url: "https://example.com" } }] } });
  const read = () => workspaceActivity({ messages: data.messages, busy: true, waitingForReply: true, preparing: false });
  assert.equal(read()?.label, "Reading a source");
  data = reducer.reduce(data, { type: "action.result", data: { turnId: "turn", sequence: 3, stepIndex: 0, status: "failed",
    result: { kind: "tool-result", callId: "fetch", toolName: "web_fetch", isError: true, output: { error: "Unavailable" } } } });
  assert.equal(read()?.steps.length, 1);
  assert.equal(read()?.steps[0].id, "fetch");
  assert.equal(read()?.steps[0].state, "failed");
});

test("a finished parallel tool does not hide another tool still working", () => {
  const result = activity([tool("a", "web_fetch"), tool("b", "recall", "output-available")]);
  assert.equal(result?.label, "Reading a source");
  assert.deepEqual(result?.steps.map(step => step.state), ["active", "finished"]);
});

test("intermediate spoken text does not suppress subsequent tool work", () => {
  assert.equal(activity([{ type: "text", text: "Let me check.", state: "done" }, tool("a", "recall")], false)?.label, "Looking through my notes");
});

test("previous turn progress cannot leak into a new send", () => {
  const messages: EveMessage[] = [{ id: "old", role: "assistant", parts: [tool("old-tool", "generate_image")] }, user];
  assert.deepEqual(workspaceActivity({ messages, busy: true, waitingForReply: true, preparing: false }), { label: "Thinking", steps: [] });
  assert.deepEqual(workspaceActivity({ messages: messages.slice(0, 1), busy: true, waitingForReply: true, preparing: true }), { label: "Thinking", steps: [] });
  assert.equal(workspaceActivity({ messages, busy: false, waitingForReply: true, preparing: false }), null);
});

test("failures and denied calls cannot turn into completed checkmarks", () => {
  for (const part of [
    { type: "dynamic-tool", toolCallId: "x", toolName: "create_printable", state: "output-error", input: {}, errorText: "private error" },
    { type: "dynamic-tool", toolCallId: "x", toolName: "create_printable", state: "output-denied", input: {}, approval: { id: "approval", approved: false } },
    tool("x", "create_printable", "output-available", { created: false }),
    tool("x", "create_printable", "output-available", { error: "private error" }),
    tool("x", "bash", "output-available", { exitCode: 1 }),
    tool("x", "manage_child_progress", "output-available", { kind: "refused" }),
  ] as EveMessagePart[]) {
    assert.equal(activity([part])?.steps[0].state, "failed");
    assert.doesNotMatch(JSON.stringify(activity([part])), /private error/);
  }
});

test("unknown tools and raw reasoning never leak internal names or contents", () => {
  const result = activity([{ type: "reasoning", text: "private thought", state: "streaming" }, tool("x", "private_internal_name")]);
  assert.equal(result?.label, "Working on your request");
  assert.doesNotMatch(JSON.stringify(result), /private/);
});

test("skill and specialist calls use friendly status copy", () => {
  for (const [kind, label] of [["load-skill", "Getting set up"], ["subagent-call", "Working on the details"]] as const) {
    const part = { ...tool("x", "internal_name"), toolMetadata: { eve: { kind, name: "internal_name" } } } as EveMessagePart;
    assert.equal(activity([part])?.label, label);
  }
});

test("approval waits leave the actionable question in charge", () => {
  const part: EveMessagePart = { type: "dynamic-tool", toolCallId: "x", toolName: "remember", input: {}, state: "approval-requested", approval: { id: "approval" } };
  assert.equal(activity([part], false), null);
});

test("durable requests show truthful request progress and stop on replies or terminal states", () => {
  const request = { requestId: "r", intentId: "i", state: "executing" as const };
  const input = { messages: [], requests: [request], pending: [], unavailable: false };
  assert.equal(durableWorkspaceActivity(input)?.label, "Working on your request");
  assert.equal(durableWorkspaceActivity({ ...input, requests: [{ ...request, state: "queued" }] })?.label, "Thinking");
  assert.equal(durableWorkspaceActivity({ ...input, messages: [{ role: "assistant", content: "Here you go.", request, question: null }] }), null);
  for (const state of ["failed", "completed", "awaiting_parent", "recovery_required", "revoked"] as const) {
    assert.equal(durableWorkspaceActivity({ ...input, requests: [{ ...request, state }], pending: [{ intentId: "i" }] }), null);
  }
  assert.equal(durableWorkspaceActivity({ ...input, unavailable: true }), null);
  assert.equal(durableWorkspaceActivity({ ...input, requests: [], pending: [{ intentId: "i" }] })?.label, "Thinking");
});
