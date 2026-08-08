import assert from "node:assert/strict";
import test from "node:test";

import { createAccountDeletionAuthUserCleaner } from "./account-deletion-auth-users";

test("hard-deletes only exact identities that still exist", async () => {
  const deleted: string[] = [];
  const cleaner = createAccountDeletionAuthUserCleaner({
    listExistingUserIds: async () => ["user-a", "user-c"],
    deleteUser: async (userId) => {
      deleted.push(userId);
    },
  });

  assert.equal(await cleaner(["user-a", "user-b", "user-a", "user-c"]), 2);
  assert.deepEqual(deleted, ["user-a", "user-c"]);
});

test("retries are no-ops after every identity is already gone", async () => {
  let deletes = 0;
  const cleaner = createAccountDeletionAuthUserCleaner({
    listExistingUserIds: async () => [],
    deleteUser: async () => {
      deletes += 1;
    },
  });

  assert.equal(await cleaner(["already-gone"]), 0);
  assert.equal(deletes, 0);
});

test("fails closed if the database returns an identity outside the job", async () => {
  const cleaner = createAccountDeletionAuthUserCleaner({
    listExistingUserIds: async () => ["another-family-user"],
    deleteUser: async () => {},
  });

  await assert.rejects(cleaner(["target-user"]), /unexpected identity/u);
});
