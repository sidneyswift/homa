import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { allocateMinutes, buildActivityDocument, initialInteraction, interactionSchema, planSchema, requestSchema, savedSchema } from "./contract.ts";

const plan = planSchema.parse({ title: "Count together", introduction: "An example plan", activities: [1, 2, 3].map((n) => ({ id: `step-${n}`, title: `Activity ${n}`, minutes: n * 3, instructions: "Count objects", materials: [], alternative: { title: "Move", instructions: "Count steps" } })) });
test("time allocation stays positive and sums exactly to the selected total", () => {
  for (let total = 10; total <= 60; total++) {
    const values = allocateMinutes(plan, total);
    assert.equal(values.reduce((a, b) => a + b), total);
    assert.ok(values.every(v => Number.isInteger(v) && v >= 1));
  }
});
test("rejects duplicate activity identities and malformed saved interactions", () => {
  assert.equal(planSchema.safeParse({ ...plan, activities: [plan.activities[0], plan.activities[0]] }).success, false);
  assert.equal(interactionSchema.safeParse({ ...initialInteraction(), minutes: 999 }).success, false);
  assert.equal(requestSchema.safeParse({ mode: "execute", prompt: "Run something" }).success, false);
});
test("local draft roundtrip preserves selected time, swaps and generated activity state", () => {
  const saved = { version: 1, id: "draft", mode: "plan", result: plan, prompt: "Count together", interaction: { minutes: 25, swapped: ["step-2"], done: ["step-1"], activity: { pieces: "3", checked: true } } };
  assert.deepEqual(savedSchema.parse(JSON.parse(JSON.stringify(saved))), saved);
});
test("host policy and state bridge are placed before generated code", () => {
  const doc = buildActivityDocument('<script>window.lab.setState({pieces:"3"})</script>', "test-channel");
  assert.ok(doc.indexOf('Content-Security-Policy') < doc.indexOf('window.lab.setState'));
  assert.match(doc, /connect-src 'none'/);
  assert.match(doc, /form-action 'none'/);
  assert.match(doc, /e.source!==parent/);
  assert.match(doc, /labrestore/);
});

test("activity initialization cannot overwrite restored selections", () => {
  const messages: unknown[] = [];
  const listeners: Record<string, (event: unknown) => void> = {};
  const parent = { postMessage: (value: unknown) => messages.push(value) };
  const window = {} as { lab: { getState(): unknown; setState(value: unknown): void } };
  const doc = buildActivityDocument("<p>Activity</p>", "channel", { pieces: "3" });
  const script = doc.match(/<script>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, { window, parent, addEventListener: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback; }, dispatchEvent: () => {}, Event });
  window.lab.setState({ pieces: "2" });
  assert.equal(messages.length, 0);
  assert.equal(JSON.stringify(window.lab.getState()), '{"pieces":"3"}');
  listeners.message({ source: {}, data: { channel: "channel", type: "restore", state: { pieces: "8" } } });
  assert.equal(JSON.stringify(window.lab.getState()), '{"pieces":"3"}');
  listeners.message({ source: parent, data: { channel: "channel", type: "restore", state: { pieces: "3" } } });
  window.lab.setState({ pieces: "4" });
  assert.equal(messages.length, 1);
  assert.equal(JSON.stringify(window.lab.getState()), '{"pieces":"4"}');
});
test("saved state cannot close the host bridge script", () => {
  const doc = buildActivityDocument("<p>Activity</p>", "channel", { text: "</script><script>bad()</script>" });
  assert.equal((doc.match(/<script>/g) ?? []).length, 1);
  assert.ok(doc.includes("\\u003c/script>"));
});
