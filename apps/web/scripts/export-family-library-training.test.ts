import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseFamilyAssetTrainingCliOptions,
  publishStagedDatasetDirectory,
  stageDatasetDirectory,
} from "./export-family-library-training.mts";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

test("training export CLI requires explicit included and excluded assets", () => {
  const parsed = parseFamilyAssetTrainingCliOptions([
    "--dataset-version",
    "family-library-v1",
    "--output",
    "/tmp/family-library-v1",
    "--asset-id",
    second,
    "--asset-id",
    first,
    "--exclude-asset-id",
    "33333333-3333-4333-8333-333333333333",
  ]);
  assert.deepEqual(parsed, {
    mode: "export",
    datasetVersion: "family-library-v1",
    outputDirectory: "/tmp/family-library-v1",
    assetIds: [first, second],
    excludedAssetIds: ["33333333-3333-4333-8333-333333333333"],
  });
});

test("training export CLI refuses broad, duplicate, or ambiguous scope", () => {
  assert.throws(
    () =>
      parseFamilyAssetTrainingCliOptions([
        "--dataset-version",
        "family-library-v1",
        "--output",
        "/tmp/out",
      ]),
    /at least one exact asset id/u,
  );
  assert.throws(
    () =>
      parseFamilyAssetTrainingCliOptions([
        "--dataset-version",
        "family-library-v1",
        "--output",
        "/tmp/out",
        "--asset-id",
        first,
        "--exclude-asset-id",
        first,
      ]),
    /both included and operator-excluded/u,
  );
  assert.throws(
    () =>
      parseFamilyAssetTrainingCliOptions([
        "--dataset-version",
        "family-library-v1",
        "--output",
        "/tmp/out",
        "--asset-id",
        "all",
      ]),
    /must be UUIDs/u,
  );
});

test("training removal acknowledgment requires exact evidence", () => {
  const parsed = parseFamilyAssetTrainingCliOptions([
    "--ack-removal",
    "--dataset-version",
    "family-library-v1",
    "--asset-id",
    first,
    "--evidence",
    "Rebuilt as family-library-v2 without the tombstoned record.",
  ]);
  assert.deepEqual(parsed, {
    mode: "acknowledge-removal",
    datasetVersion: "family-library-v1",
    sourceAssetId: first,
    evidence: "Rebuilt as family-library-v2 without the tombstoned record.",
  });
});

test("training output stays hidden until its staged directory is published", async () => {
  const testDirectory = await mkdtemp(
    path.join(tmpdir(), "homa-training-output-test-"),
  );
  try {
    const outputDirectory = path.join(testDirectory, "family-library-v1");
    const staged = await stageDatasetDirectory({
      outputDirectory,
      jsonl: '{"recordId":"safe"}\n',
      manifestJson: '{"datasetVersion":"family-library-v1"}\n',
    });

    await assert.rejects(access(outputDirectory));
    assert.equal(
      await readFile(path.join(staged.temporaryDirectory, "records.jsonl"), "utf8"),
      '{"recordId":"safe"}\n',
    );

    await publishStagedDatasetDirectory(staged);
    assert.equal(
      await readFile(path.join(outputDirectory, "manifest.json"), "utf8"),
      '{"datasetVersion":"family-library-v1"}\n',
    );
  } finally {
    await rm(testDirectory, { recursive: true, force: true });
  }
});
