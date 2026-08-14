import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { AccountDeletionResult } from "./account-deletion";
import { createAccountDeletionPost } from "./account-deletion-route";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function deletionRequest(options: { bearer?: boolean } = {}): Request {
  return new Request("https://thankshoma.com/api/account-deletion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.bearer ? { authorization: "Bearer mobile-token" } : {}),
    },
    body: JSON.stringify({ confirmation: "Delete Rivera family" }),
  });
}

function dependencies(
  result: AccountDeletionResult,
  calls: { clears: number; deletionInput?: unknown },
) {
  return {
    resolveActor: async () => ({
      family: { id: FAMILY_ID },
      memberUserId: USER_ID,
    }),
    requestDeletion: async (input: unknown) => {
      calls.deletionInput = input;
      return result;
    },
    clearBrowserSession: async () => {
      calls.clears += 1;
    },
  };
}

for (const state of ["complete", "in_progress"] as const) {
  test(`clears the browser session after an accepted ${state} deletion`, async () => {
    const calls: { clears: number; deletionInput?: unknown } = { clears: 0 };
    const result: AccountDeletionResult = {
      state,
      message: "Deletion accepted.",
      accessClosed: true,
      deletionReceipt: "33333333-3333-4333-8333-333333333333",
    };
    const post = createAccountDeletionPost(dependencies(result, calls));

    const response = await post(deletionRequest());

    assert.equal(response.status, 200);
    assert.equal(
      ((await response.json()) as { deletionReceipt?: string }).deletionReceipt,
      "33333333-3333-4333-8333-333333333333",
    );
    assert.equal(calls.clears, 1);
    assert.deepEqual(calls.deletionInput, {
      familyId: FAMILY_ID,
      userId: USER_ID,
      confirmation: "Delete Rivera family",
    });
  });
}

test("keeps the browser session while billing preparation is still retrying", async () => {
  const calls = { clears: 0 };
  const result: AccountDeletionResult = {
    state: "in_progress",
    message: "Homa is confirming billing.",
    accessClosed: false,
    deletionReceipt: "33333333-3333-4333-8333-333333333333",
  };
  const post = createAccountDeletionPost(dependencies(result, calls));

  const response = await post(deletionRequest());

  assert.equal(response.status, 200);
  assert.equal(calls.clears, 0);
});

for (const state of ["blocked", "rejected"] as const) {
  test(`keeps the browser session after a ${state} deletion`, async () => {
    const calls = { clears: 0 };
    const result: AccountDeletionResult = {
      state,
      message: "Deletion was not accepted.",
      accessClosed: false,
    };
    const post = createAccountDeletionPost(dependencies(result, calls));

    const response = await post(deletionRequest());

    assert.equal(response.status, state === "rejected" ? 400 : 200);
    assert.equal(calls.clears, 0);
  });
}

test("does not clear browser cookies for a bearer-authenticated mobile deletion", async () => {
  const calls = { clears: 0 };
  const result: AccountDeletionResult = {
    state: "complete",
    message: "Deletion accepted.",
    accessClosed: true,
  };
  const post = createAccountDeletionPost(dependencies(result, calls));

  const response = await post(deletionRequest({ bearer: true }));

  assert.equal(response.status, 200);
  assert.equal(calls.clears, 0);
});

test("does not clear or delete without an authenticated family actor", async () => {
  let deletionCalls = 0;
  let clears = 0;
  const post = createAccountDeletionPost({
    resolveActor: async () => null,
    requestDeletion: async () => {
      deletionCalls += 1;
      return { state: "complete", message: "Deletion accepted.", accessClosed: true };
    },
    clearBrowserSession: async () => {
      clears += 1;
    },
  });

  const response = await post(deletionRequest());

  assert.equal(response.status, 401);
  assert.equal(deletionCalls, 0);
  assert.equal(clears, 0);
});

test("the production browser-session dependency performs a local Supabase sign-out", async () => {
  const source = await readFile(
    new URL("../app/api/account-deletion/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /createSupabaseServerClient\(\)/u);
  assert.match(source, /auth\.signOut\(\{ scope: "local" \}\)/u);
});

test("mobile deletion signs out only the current device session", async () => {
  const source = await readFile(
    new URL("../../mobile/src/app/settings/delete-account.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /auth\.signOut\(\{ scope: "local" \}\)/u);
  assert.doesNotMatch(source, /auth\.signOut\(\)/u);
});
