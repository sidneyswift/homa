import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildMobileDeliveryReceipt,
  normalizeEasUpdate,
  validateMobileDeliveryReceipt,
} from "./mobile-delivery-receipt.mjs";

const SOURCE = "a".repeat(40);
const RUNTIME = "b".repeat(40);
const BUNDLE = "c".repeat(64);

function fixture(overrides = {}) {
  return {
    classification: {
      compatibilityClass: "ota-safe",
      requiredRail: "eas-update",
      sourceSha: SOURCE,
      fingerprint: RUNTIME,
      changeCategories: ["javascript-or-typescript"],
      matchingBuild: {
        id: "build-1",
        platform: "ios",
        status: "finished",
        distribution: "store",
        buildProfile: "production",
        channel: "production",
        gitCommitHash: "d".repeat(40),
        fingerprint: RUNTIME,
        appVersion: "1.0.0",
        appBuildVersion: "9",
        createdAt: "2026-08-04T10:00:00.000Z",
      },
    },
    gates: {
      status: "pass",
      sourceSha: SOURCE,
      buildAndCheck: {
        id: 10,
        status: "completed",
        conclusion: "success",
        detailsUrl: "https://github.test/check/10",
        completedAt: "2026-08-04T12:00:00.000Z",
      },
      vercel: {
        id: 20,
        state: "success",
        targetUrl: "https://vercel.test/deployment",
        updatedAt: "2026-08-04T12:01:00.000Z",
      },
    },
    bundleReport: {
      status: "pass",
      sourceSha: SOURCE,
      platform: "ios",
      bundleFingerprint: BUNDLE,
      fileCount: 57,
      bundleCount: 1,
      sourceMapCount: 1,
      sourceFileCount: 4300,
      totalBytes: 30_000_000,
    },
    easUpdate: [{
      id: "update-1",
      group: "group-1",
      runtimeVersion: RUNTIME,
      platform: "ios",
      gitCommitHash: SOURCE,
      createdAt: "2026-08-04T12:02:00.000Z",
      branch: { name: "production" },
      message: "Ship Homa",
      manifestPermalink: "https://expo.test/manifest",
    }],
    workflow: {
      repository: "sidneyswift/homa",
      runId: "12345",
      runUrl: "https://github.test/sidneyswift/homa/actions/runs/12345",
    },
    ...overrides,
  };
}

test("matching classification, gates, bundle, and update produce a deterministic receipt", () => {
  const first = buildMobileDeliveryReceipt(fixture());
  const second = buildMobileDeliveryReceipt(fixture());
  assert.equal(first.status, "published");
  assert.equal(first.update.groupId, "group-1");
  assert.equal(first.update.runtimeVersion, RUNTIME);
  assert.equal(first.matchingBuild.id, "build-1");
  assert.equal(first.matchingBuild.platform, "ios");
  assert.equal(first.matchingBuild.status, "finished");
  assert.equal(first.matchingBuild.distribution, "store");
  assert.equal(first.matchingBuild.buildProfile, "production");
  assert.equal(first.matchingBuild.channel, "production");
  assert.equal(first.productionGates.buildAndCheck.id, "10");
  assert.equal(first.productionGates.vercel.id, "20");
  assert.equal(first.receiptFingerprint, second.receiptFingerprint);
  assert.match(first.receiptFingerprint, /^[0-9a-f]{64}$/u);
});

test("the finished receipt validates against Draft 2020-12 and its body fingerprint", () => {
  const receipt = buildMobileDeliveryReceipt(fixture());
  assert.equal(validateMobileDeliveryReceipt(receipt), receipt);

  const missingEligibility = structuredClone(receipt);
  delete missingEligibility.matchingBuild.platform;
  assert.throws(() => validateMobileDeliveryReceipt(missingEligibility), /Draft 2020-12 schema/u);

  const changedAfterSigning = structuredClone(receipt);
  changedAfterSigning.workflow.runId = "999";
  assert.throws(() => validateMobileDeliveryReceipt(changedAfterSigning), /fingerprint does not match/u);
});

test("EAS response normalization accepts array and envelope shapes", () => {
  const update = fixture().easUpdate[0];
  assert.equal(normalizeEasUpdate([update]).id, "update-1");
  assert.equal(normalizeEasUpdate({ updates: [update] }).groupId, "group-1");
  assert.equal(normalizeEasUpdate({ updateGroups: [[update]] }).runtimeVersion, RUNTIME);
});

test("source and runtime mismatches fail closed", () => {
  const wrongSource = fixture();
  wrongSource.easUpdate[0].gitCommitHash = "e".repeat(40);
  assert.throws(() => buildMobileDeliveryReceipt(wrongSource), /Git commit differs/u);

  const wrongRuntime = fixture();
  wrongRuntime.easUpdate[0].runtimeVersion = "e".repeat(40);
  assert.throws(() => buildMobileDeliveryReceipt(wrongRuntime), /runtime version differs/u);
});

test("failed gates, unverified bundles, and store-required classifications cannot publish receipts", () => {
  const failedGate = fixture();
  failedGate.gates.status = "failure";
  assert.throws(() => buildMobileDeliveryReceipt(failedGate), /gates did not pass/u);

  const wrongBundle = fixture();
  wrongBundle.bundleReport.sourceSha = "f".repeat(40);
  assert.throws(() => buildMobileDeliveryReceipt(wrongBundle), /bundle does not belong/u);

  const storeRequired = fixture();
  storeRequired.classification.compatibilityClass = "store-binary-required";
  storeRequired.classification.requiredRail = "store-binary-required";
  assert.throws(() => buildMobileDeliveryReceipt(storeRequired), /OTA-safe/u);
});

test("only one iOS update is accepted", () => {
  const update = fixture().easUpdate[0];
  assert.throws(() => normalizeEasUpdate([]), /exactly one iOS/u);
  assert.throws(() => normalizeEasUpdate([{ ...update, platform: "android" }]), /exactly one iOS/u);
  assert.throws(() => normalizeEasUpdate([update, { ...update, id: "update-2" }]), /exactly one iOS/u);
});

test("malformed provenance and audit fields fail closed", () => {
  const badRuntime = fixture();
  badRuntime.classification.fingerprint = "not-a-fingerprint";
  assert.throws(() => buildMobileDeliveryReceipt(badRuntime), /classification fingerprint/u);

  const badBuildCommit = fixture();
  badBuildCommit.classification.matchingBuild.gitCommitHash = "short";
  assert.throws(() => buildMobileDeliveryReceipt(badBuildCommit), /build Git commit/u);

  const badBuildTime = fixture();
  badBuildTime.classification.matchingBuild.createdAt = "eventually";
  assert.throws(() => buildMobileDeliveryReceipt(badBuildTime), /valid timestamp/u);

  for (const [field, value] of [
    ["platform", "android"],
    ["status", "errored"],
    ["distribution", "internal"],
    ["buildProfile", "preview"],
    ["channel", "preview"],
  ]) {
    const ineligibleBuild = fixture();
    ineligibleBuild.classification.matchingBuild[field] = value;
    assert.throws(() => buildMobileDeliveryReceipt(ineligibleBuild), /matching production build/u);
  }

  const badGateUrl = fixture();
  badGateUrl.gates.vercel.targetUrl = "javascript:alert(1)";
  assert.throws(() => buildMobileDeliveryReceipt(badGateUrl), /valid HTTP URL/u);

  const badBundleCount = fixture();
  badBundleCount.bundleReport.sourceMapCount = 0;
  assert.throws(() => buildMobileDeliveryReceipt(badBundleCount), /positive integer/u);

  const missingUpdateTime = fixture();
  missingUpdateTime.easUpdate[0].createdAt = null;
  assert.throws(() => buildMobileDeliveryReceipt(missingUpdateTime), /creation time/u);
});

test("the committed receipt schema pins the evidence sections", () => {
  const schema = JSON.parse(readFileSync(new URL("../release/delivery-receipt.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(schema.required, [
    "schemaVersion",
    "receiptVersion",
    "status",
    "source",
    "classification",
    "matchingBuild",
    "productionGates",
    "bundle",
    "update",
    "workflow",
    "receiptFingerprint",
  ]);
  for (const section of ["classification", "matchingBuild", "productionGates", "bundle", "update", "workflow"]) {
    assert.equal(schema.properties[section].additionalProperties, false, `${section} must reject unknown fields`);
  }
  assert.deepEqual(schema.properties.update.required, [
    "id",
    "groupId",
    "runtimeVersion",
    "platform",
    "channel",
    "gitCommitHash",
    "createdAt",
    "branch",
    "message",
    "manifestPermalink",
  ]);
  assert.deepEqual(schema.properties.matchingBuild.required, [
    "id",
    "platform",
    "status",
    "distribution",
    "buildProfile",
    "channel",
    "gitCommitHash",
    "fingerprint",
    "appVersion",
    "appBuildVersion",
    "createdAt",
  ]);
});
