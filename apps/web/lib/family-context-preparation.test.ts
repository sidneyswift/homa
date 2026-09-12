import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";

import {
  resolveFamilyContextInstructionMarkdown,
  type FamilyContextInstructionDependencies,
} from "../agent/instructions/family-context";
import { measureChatPreparation } from "./observability/chat-preparation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const input = {
  attributes: { channel: "web", familyId: "family-test", supabaseAccessToken: "test-only", memberUserId: "adult-test", onboardingActive: "true" },
  sessionId: "session-test",
  turnId: "turn-test",
};
const rows = { family: null, children: [], memories: [], answers: [], members: [] };

function dependencies(overrides: Partial<FamilyContextInstructionDependencies> = {}): FamilyContextInstructionDependencies {
  return {
    loadCallerFamilyContext: async () => rows,
    loadPinnedFamilyContext: async () => { throw new Error("wrong tenant path"); },
    renderFamilyContext: () => "family",
    loadProgressContext: async () => "progress",
    loadOnboardingContext: async () => "onboarding",
    loadContinuityContext: async () => "continuity",
    loadRecentCallsContext: async () => "calls",
    recordContextSnapshot: async () => {},
    ...overrides,
  };
}

test("all independent context reads start before any finishes, after the caller lookup", async () => {
  const family = deferred<typeof rows>();
  const release = deferred<string>();
  const started: string[] = [];
  const load = (stage: string) => async () => {
    started.push(stage);
    await release.promise;
    return stage;
  };
  const result = resolveFamilyContextInstructionMarkdown(input, dependencies({
    loadCallerFamilyContext: async () => family.promise,
    loadProgressContext: load("progress"),
    loadOnboardingContext: load("onboarding"),
    loadContinuityContext: load("continuity"),
    loadRecentCallsContext: load("calls"),
  }));
  await setImmediate();
  assert.deepEqual(started, [], "dependent reads must not outrun tenant lookup");
  family.resolve(rows);
  await setImmediate();
  assert.deepEqual(started.sort(), ["calls", "continuity", "onboarding", "progress"]);
  release.resolve("");
  assert.equal(await result, "family\n\nprogress\n\nonboarding\n\ncalls\n\ncontinuity");
});

test("one failed context read preserves every successful block and the progress fallback", async () => {
  const result = await resolveFamilyContextInstructionMarkdown(input, dependencies({
    loadProgressContext: async () => { throw new Error("unavailable"); },
  }));
  assert.match(result!, /Canonical Progress could not be checked/);
  assert.ok(result!.endsWith("onboarding\n\ncalls\n\ncontinuity"));
});

test("onboarding guidance receives authenticated focus and falls back only in onboarding mode", async () => {
  const attributes = { ...input.attributes, viewChildId: "known-child" };
  const loaders = dependencies({
    loadOnboardingContext: async (familyId, receivedAttributes) => {
      assert.equal(familyId, input.attributes.familyId);
      assert.equal(receivedAttributes?.viewChildId, "known-child");
      throw new Error("state unavailable");
    },
  });
  const web = await resolveFamilyContextInstructionMarkdown({ ...input, attributes }, loaders);
  assert.match(web!, /Onboarding stage guidance \(already loaded\)/);
  assert.ok(web!.startsWith("family\n\nprogress\n\n"));
  assert.ok(web!.endsWith("calls\n\ncontinuity"));
  const sms = await resolveFamilyContextInstructionMarkdown({ ...input, attributes: { ...attributes, channel: "sms" } }, loaders);
  assert.doesNotMatch(sms!, /Onboarding stage guidance/);
});

test("admission-provided continuity avoids another read and normal turns skip onboarding", async () => {
  const result = await resolveFamilyContextInstructionMarkdown({
    ...input,
    attributes: { ...input.attributes, onboardingActive: "false", continuityContext: "already loaded" },
  }, dependencies({
    loadOnboardingContext: async () => { assert.fail("unexpected onboarding read"); },
    loadContinuityContext: async () => { assert.fail("duplicate continuity read"); },
  }));
  assert.equal(result, "family\n\nprogress\n\ncalls\n\nalready loaded");
});

test("failed caller lookup never starts family-pinned secondary reads", async () => {
  let reads = 0;
  const result = await resolveFamilyContextInstructionMarkdown(input, dependencies({
    loadCallerFamilyContext: async () => { throw new Error("auth read failed"); },
    loadProgressContext: async () => { reads++; return ""; },
    loadOnboardingContext: async () => { reads++; return ""; },
    loadContinuityContext: async () => { reads++; return ""; },
    loadRecentCallsContext: async () => { reads++; return ""; },
  }));
  assert.equal(reads, 0);
  assert.match(result!, /family context could not be loaded/);
});

test("timing logs exclude result and failure content and preserve operation behavior", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const secret = { token: "private-result" };
  assert.equal(await measureChatPreparation("family_rows", async () => secret, "session-test"), secret);
  const failure = new Error("private-error-content");
  await assert.rejects(measureChatPreparation("progress", async () => { throw failure; }), (error) => error === failure);
  assert.doesNotMatch(JSON.stringify(logs), /private-result|private-error-content|token/);
  assert.equal(JSON.parse(logs[0][1] as string).outcome, "ok");
  assert.equal(JSON.parse(logs[1][1] as string).outcome, "error");
  t.mock.method(console, "info", () => { throw new Error("logging unavailable"); });
  assert.equal(await measureChatPreparation("continuity", async () => "still succeeds"), "still succeeds");
});
