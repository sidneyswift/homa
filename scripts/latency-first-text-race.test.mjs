import assert from "node:assert/strict";
import { test } from "node:test";

import { raceFirstText } from "./latency-first-text-race.mjs";

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test("connection and reasoning do not win; one text stream survives and the loser is cancelled", async () => {
  const loserReady = deferred();
  let cancelled = false;
  const result = await raceFirstText({ copies: 2, open: async function* ({ index, signal }) {
    if (index === 0) {
      yield { type: "start" };
      yield { type: "reasoning-delta", text: "hidden" };
      yield { type: "text-delta", text: "" };
      loserReady.resolve();
      await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
      cancelled = signal.aborted;
      yield { type: "text-delta", text: "late losing answer" };
    } else {
      await loserReady.promise;
      yield { type: "text-delta", text: "Useful " };
      yield { type: "text-delta", text: "answer." };
    }
  } });
  assert.equal(result.winner, 1);
  assert.equal(result.text, "Useful answer.");
  assert.equal(result.status, "completed");
  assert.equal(result.attempts[0].status, "cancelled");
  assert.equal(cancelled, true);
});

test("one failing copy does not cancel a good copy; both failures are retained", async () => {
  const good = await raceFirstText({ copies: 2, open: async function* ({ index }) {
    if (index === 0) throw new Error("private provider payload");
    yield { type: "text-delta", text: "Answer" };
  } });
  assert.equal(good.text, "Answer");
  assert.equal(good.attempts[0].status, "error");
  assert.doesNotMatch(JSON.stringify(good), /private provider payload/);
  const bad = await raceFirstText({ copies: 2, open: async function* () { throw new Error("failure"); } });
  assert.equal(bad.status, "no_answer");
  assert.equal(bad.attempts.filter(row => row.status === "error").length, 2);
});

test("a winner failing after first text stays partial and is never silently replaced", async () => {
  const result = await raceFirstText({ copies: 1, open: async function* () {
    yield { type: "text-delta", text: "Partial" };
    throw new Error("stream failed");
  } });
  assert.equal(result.status, "partial_answer");
  assert.equal(result.text, "Partial");
});

test("an already cancelled request starts no provider work", async () => {
  const signal = AbortSignal.abort();
  let calls = 0;
  const result = await raceFirstText({ copies: 2, signal, open: async function* () { calls++; } });
  assert.equal(calls, 0);
  assert.equal(result.status, "no_answer");
});
