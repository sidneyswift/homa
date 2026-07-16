import assert from "node:assert/strict";
import { test } from "node:test";

import { accountStatusCopy } from "./account-status-copy";

test("open is signup not finished, even if profile_completed_at were set", () => {
  const copy = accountStatusCopy({
    status: "open",
    profileCompletedAt: "2026-07-16T00:00:00Z",
  });
  assert.equal(copy.label, "Signup not finished");
});

test("claimed without setup is signed up", () => {
  const copy = accountStatusCopy({ status: "claimed", profileCompletedAt: null });
  assert.equal(copy.label, "Signed up");
});

test("claimed with setup is setup done", () => {
  const copy = accountStatusCopy({
    status: "claimed",
    profileCompletedAt: "2026-07-16T00:00:00Z",
  });
  assert.equal(copy.label, "Setup done");
});

test("legacy complete follows the same setup rule", () => {
  assert.equal(
    accountStatusCopy({ status: "complete", profileCompletedAt: null }).label,
    "Signed up",
  );
  assert.equal(
    accountStatusCopy({
      status: "complete",
      profileCompletedAt: "2026-07-16T00:00:00Z",
    }).label,
    "Setup done",
  );
});

test("deleted is deleted", () => {
  assert.equal(
    accountStatusCopy({ status: "deleted", profileCompletedAt: null }).label,
    "Deleted",
  );
});

test("null status treats as open", () => {
  assert.equal(
    accountStatusCopy({ status: null, profileCompletedAt: null }).label,
    "Signup not finished",
  );
});
