import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateProductionGates,
  waitForProductionGates,
} from "./wait-for-production-gates.mjs";

const SOURCE = "a".repeat(40);

function check(overrides = {}) {
  return {
    id: 10,
    name: "build-and-check",
    head_sha: SOURCE,
    status: "completed",
    conclusion: "success",
    started_at: "2026-08-04T12:00:00.000Z",
    completed_at: "2026-08-04T12:05:00.000Z",
    details_url: "https://github.test/check/10",
    ...overrides,
  };
}

function status(overrides = {}) {
  return {
    id: 20,
    context: "Vercel",
    state: "success",
    created_at: "2026-08-04T12:06:00.000Z",
    updated_at: "2026-08-04T12:06:00.000Z",
    target_url: "https://vercel.test/deployment",
    ...overrides,
  };
}

function snapshot({ checks = [check()], statuses = [status()], sha = SOURCE } = {}) {
  return {
    checkRunsResponse: { check_runs: checks },
    combinedStatusResponse: { sha, statuses },
  };
}

test("exact-source CI and Vercel success produce an auditable pass", () => {
  const report = evaluateProductionGates({ sourceSha: SOURCE, ...snapshot() });
  assert.equal(report.status, "pass");
  assert.equal(report.buildAndCheck?.id, 10);
  assert.equal(report.vercel?.targetUrl, "https://vercel.test/deployment");
});

test("a successful check for a different source cannot satisfy the gate", () => {
  const report = evaluateProductionGates({
    sourceSha: SOURCE,
    ...snapshot({ checks: [check({ head_sha: "b".repeat(40) })] }),
  });
  assert.equal(report.status, "pending");
  assert.equal(report.buildAndCheck, null);
});

test("the latest exact-source terminal check failure wins over older success", () => {
  const report = evaluateProductionGates({
    sourceSha: SOURCE,
    ...snapshot({
      checks: [
        check(),
        check({
          id: 11,
          conclusion: "failure",
          started_at: "2026-08-04T12:10:00.000Z",
          completed_at: "2026-08-04T12:11:00.000Z",
        }),
      ],
    }),
  });
  assert.equal(report.status, "failure");
  assert.equal(report.buildAndCheck?.id, 11);
});

test("the latest Vercel failure fails immediately", () => {
  const report = evaluateProductionGates({
    sourceSha: SOURCE,
    ...snapshot({
      statuses: [
        status(),
        status({ id: 21, state: "error", updated_at: "2026-08-04T12:08:00.000Z" }),
      ],
    }),
  });
  assert.equal(report.status, "failure");
  assert.equal(report.vercel?.id, 21);
});

test("polling waits through pending state and returns the first complete pass", async () => {
  const snapshots = [
    snapshot({ checks: [check({ status: "in_progress", conclusion: null, completed_at: null })] }),
    snapshot(),
  ];
  let sleeps = 0;
  const report = await waitForProductionGates({
    sourceSha: SOURCE,
    fetchSnapshot: async () => snapshots.shift(),
    sleep: async () => { sleeps += 1; },
    maxAttempts: 2,
  });
  assert.equal(report.status, "pass");
  assert.equal(sleeps, 1);
});

test("terminal failure aborts without sleeping", async () => {
  let sleeps = 0;
  await assert.rejects(
    waitForProductionGates({
      sourceSha: SOURCE,
      fetchSnapshot: async () => snapshot({ statuses: [status({ state: "failure" })] }),
      sleep: async () => { sleeps += 1; },
      maxAttempts: 3,
    }),
    /terminal failure/u,
  );
  assert.equal(sleeps, 0);
});

test("a combined status envelope for another SHA is rejected", () => {
  assert.throws(
    () => evaluateProductionGates({ sourceSha: SOURCE, ...snapshot({ sha: "b".repeat(40) }) }),
    /does not belong/u,
  );
});

test("terminal success with incomplete receipt evidence fails before publication", () => {
  for (const overrides of [
    { id: null },
    { completed_at: null },
    { completed_at: "eventually" },
    { details_url: null },
    { details_url: "javascript:alert(1)" },
  ]) {
    const report = evaluateProductionGates({
      sourceSha: SOURCE,
      ...snapshot({ checks: [check(overrides)] }),
    });
    assert.equal(report.status, "failure", JSON.stringify(overrides));
  }
  for (const overrides of [
    { id: null },
    { updated_at: null },
    { updated_at: "eventually" },
    { target_url: null },
    { target_url: "ftp://vercel.test/deployment" },
  ]) {
    const report = evaluateProductionGates({
      sourceSha: SOURCE,
      ...snapshot({ statuses: [status(overrides)] }),
    });
    assert.equal(report.status, "failure", JSON.stringify(overrides));
  }
});
