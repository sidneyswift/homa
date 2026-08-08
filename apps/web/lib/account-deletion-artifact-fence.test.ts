import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  AccountDeletionArtifactFenceError,
  assertFamilyArtifactAccess,
  withFamilyArtifactWriteFence,
  type AccountDeletionArtifactFenceDependencies,
} from "./account-deletion-artifact-fence";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";

function dependencies(
  answers: readonly boolean[],
): AccountDeletionArtifactFenceDependencies {
  let index = 0;
  return {
    isFamilyArtifactAccessAllowed: async () => answers[index++] ?? false,
  };
}

describe("assertFamilyArtifactAccess", () => {
  it("allows access for an active family without a deletion tombstone", async () => {
    await assert.doesNotReject(
      assertFamilyArtifactAccess(FAMILY_ID, dependencies([true])),
    );
  });

  for (const state of ["missing", "deleted", "tombstoned"] as const) {
    it(`fails closed for a ${state} family before an artifact write`, async () => {
      let writes = 0;
      let cleanups = 0;

      await assert.rejects(
        withFamilyArtifactWriteFence(
          {
            familyId: FAMILY_ID,
            write: async () => {
              writes += 1;
              return { url: "https://artifact.example/should-not-exist" };
            },
            cleanup: async () => {
              cleanups += 1;
            },
          },
          dependencies([false]),
        ),
        AccountDeletionArtifactFenceError,
      );

      assert.equal(writes, 0);
      assert.equal(cleanups, 0);
    });
  }
});

describe("withFamilyArtifactWriteFence", () => {
  it("returns the artifact when both checks pass", async () => {
    const artifact = { url: "https://artifact.example/kept" };
    let cleanups = 0;

    const result = await withFamilyArtifactWriteFence(
      {
        familyId: FAMILY_ID,
        write: async () => artifact,
        cleanup: async () => {
          cleanups += 1;
        },
      },
      dependencies([true, true]),
    );

    assert.equal(result, artifact);
    assert.equal(cleanups, 0);
  });

  it("cleans up and fails when deletion begins during the write", async () => {
    const artifact = { url: "https://artifact.example/raced" };
    const cleaned: Array<typeof artifact> = [];

    await assert.rejects(
      withFamilyArtifactWriteFence(
        {
          familyId: FAMILY_ID,
          write: async () => artifact,
          cleanup: async (writtenArtifact) => {
            cleaned.push(writtenArtifact);
          },
        },
        dependencies([true, false]),
      ),
      AccountDeletionArtifactFenceError,
    );

    assert.deepEqual(cleaned, [artifact]);
  });
});

it("the production adapter checks family status and the durable tombstone without logging data", async () => {
  const source = await readFile(
    new URL("./account-deletion-artifact-fence.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ mapDb \} from "\.\/map\/db"/u);
  assert.match(source, /from public\.families/u);
  assert.match(source, /family\.status <> 'deleted'/u);
  assert.match(source, /not exists[\s\S]*public\.account_deletion_artifact_tombstones/u);
  assert.doesNotMatch(source, /console\.(?:debug|error|info|log|warn)/u);
});

it("fence failures do not expose family ids or artifact data", async () => {
  const privateFamilyId = "private-family-id";
  const privateArtifactData = "private-artifact-data";

  const failure = await withFamilyArtifactWriteFence(
    {
      familyId: privateFamilyId,
      write: async () => privateArtifactData,
      cleanup: async () => {},
    },
    dependencies([true, false]),
  ).catch((error: unknown) => error);

  assert.ok(failure instanceof AccountDeletionArtifactFenceError);
  assert.doesNotMatch(failure.message, /private-family-id|private-artifact-data/u);
});

it("dependency and cleanup errors fail closed without exposing their data", async () => {
  const dependencyFailure = await assertFamilyArtifactAccess(FAMILY_ID, {
    isFamilyArtifactAccessAllowed: async () => {
      throw new Error("database-secret");
    },
  }).catch((error: unknown) => error);

  assert.ok(dependencyFailure instanceof AccountDeletionArtifactFenceError);
  assert.doesNotMatch(dependencyFailure.message, /database-secret/u);

  const cleanupFailure = await withFamilyArtifactWriteFence(
    {
      familyId: FAMILY_ID,
      write: async () => "artifact-secret",
      cleanup: async () => {
        throw new Error("cleanup-secret");
      },
    },
    dependencies([true, false]),
  ).catch((error: unknown) => error);

  assert.ok(cleanupFailure instanceof AccountDeletionArtifactFenceError);
  assert.match(cleanupFailure.message, /cleanup could not be confirmed/u);
  assert.doesNotMatch(cleanupFailure.message, /artifact-secret|cleanup-secret/u);
});
