import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  classifyChangedPath,
  classifyIosDelivery,
  gitIsAncestor,
  normalizeIosBuild,
} from "./classify-ios-delivery.mjs";

const SOURCE = "b".repeat(40);
const ANCESTOR = "a".repeat(40);
const FINGERPRINT = "b".repeat(40);

function build(overrides = {}) {
  return {
    id: "build-current",
    platform: "IOS",
    status: "FINISHED",
    distribution: "STORE",
    buildProfile: "production",
    channel: "production",
    fingerprint: { hash: FINGERPRINT },
    gitCommitHash: ANCESTOR,
    createdAt: "2026-08-04T10:00:00.000Z",
    appVersion: "1.0.0",
    appBuildVersion: "9",
    ...overrides,
  };
}

function classify(builds, isAncestor = () => true) {
  return classifyIosDelivery({
    sourceSha: SOURCE,
    currentFingerprint: FINGERPRINT,
    builds,
    changedPaths: ["packages/design/generated/native.json", "apps/mobile/src/app/_layout.tsx"],
    isAncestor,
  });
}

test("a finished production store build with matching fingerprint and ancestry is OTA-safe", () => {
  const result = classify([build()]);
  assert.equal(result.compatibilityClass, "ota-safe");
  assert.equal(result.requiredRail, "eas-update");
  assert.equal(result.matchingBuild?.id, "build-current");
  assert.deepEqual(result.changeCategories, ["design-token-or-native-projection", "javascript-or-typescript"]);
});

test("an older eligible matching build is accepted when a newer candidate is ineligible", () => {
  const older = build({ id: "build-older", createdAt: "2026-08-01T10:00:00.000Z" });
  const newer = build({ id: "build-newer", gitCommitHash: "c".repeat(40), createdAt: "2026-08-03T10:00:00.000Z" });
  const result = classify([newer, older], (commit) => commit === ANCESTOR);
  assert.equal(result.compatibilityClass, "ota-safe");
  assert.equal(result.requiredRail, "eas-update");
  assert.equal(result.matchingBuild?.id, "build-older");
});

test("a matching nonancestor build is rejected", () => {
  const result = classify([build()], () => false);
  assert.equal(result.compatibilityClass, "store-binary-required");
  assert.equal(result.requiredRail, "store-binary-required");
  assert.deepEqual(result.evaluatedBuilds[0].rejectionReasons, ["commit-not-main-ancestor"]);
});

for (const [field, value, reason] of [
  ["platform", "ANDROID", "not-ios"],
  ["status", "ERRORED", "not-finished"],
  ["distribution", "INTERNAL", "not-store-distributed"],
  ["buildProfile", "preview", "not-production-profile"],
  ["channel", "preview", "not-production-channel"],
] ) {
  test(`wrong ${field} requires a binary`, () => {
    const result = classify([build({ [field]: value })]);
    assert.equal(result.compatibilityClass, "store-binary-required");
    assert.equal(result.requiredRail, "store-binary-required");
    assert.ok(result.evaluatedBuilds[0].rejectionReasons.includes(reason));
  });
}

test("a fingerprint mismatch requires a binary", () => {
  const result = classify([build({ fingerprint: { hash: "c".repeat(40) } })]);
  assert.equal(result.compatibilityClass, "fingerprint-changing");
  assert.equal(result.requiredRail, "store-binary-required");
  assert.ok(result.evaluatedBuilds[0].rejectionReasons.includes("fingerprint-mismatch"));
});

test("no production store build is classified as store-binary-required", () => {
  const result = classify([]);
  assert.equal(result.compatibilityClass, "store-binary-required");
  assert.equal(result.requiredRail, "store-binary-required");
  assert.equal(result.matchingBuild, null);
});

test("malformed EAS data fails closed as an execution error", () => {
  assert.throws(() => classify([{}]), /missing required release provenance/u);
  assert.throws(() => classifyIosDelivery({
    sourceSha: SOURCE,
    currentFingerprint: FINGERPRINT,
    builds: { not: "an array" },
    isAncestor: () => true,
  }), /must be an array/u);
});

test("build normalization accepts the two fingerprint response shapes", () => {
  assert.equal(normalizeIosBuild(build()).fingerprint, FINGERPRINT);
  const withFlatFingerprint = build({ fingerprint: undefined, fingerprintHash: FINGERPRINT });
  assert.equal(normalizeIosBuild(withFlatFingerprint).fingerprint, FINGERPRINT);
});

test("malformed fingerprints fail before release classification", () => {
  assert.throws(
    () => classifyIosDelivery({
      sourceSha: SOURCE,
      currentFingerprint: "not-an-expo-fingerprint",
      builds: [],
      changedPaths: [],
      isAncestor: () => true,
    }),
    /full lowercase Expo fingerprint/u,
  );
  assert.throws(
    () => normalizeIosBuild(build({ fingerprint: { hash: "not-an-expo-fingerprint" } })),
    /missing required release provenance/u,
  );
});

test("gitIsAncestor degrades an unresolvable commit to false instead of throwing (issue #988)", () => {
  // A well-formed but nonexistent object: the exact failure mode a
  // squash-merged-away production build commit produces. This must
  // resolve to false (excluded from OTA eligibility), never throw and
  // crash the whole classification run.
  const orphaned = "9".repeat(40);
  const here = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(gitIsAncestor(orphaned, here), false);
});

test("gitIsAncestor still finds a real, reachable ancestor", () => {
  const root = execFileSync("git", ["rev-list", "--max-parents=0", "HEAD"], { encoding: "utf8" })
    .trim()
    .split("\n")[0];
  const here = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(gitIsAncestor(root, here), true);
});

test("changed-path categories explain the input without overriding fingerprint authority", () => {
  assert.equal(classifyChangedPath("apps/mobile/package.json"), "dependency");
  assert.equal(classifyChangedPath("apps/mobile/app.json"), "native-code-or-config");
  assert.equal(classifyChangedPath("apps/mobile/assets/splash.png"), "splash-or-asset-catalog");
  assert.equal(classifyChangedPath("apps/mobile/assets/brand/homa-lockup.png"), "icon-or-image");
  assert.equal(classifyChangedPath("apps/mobile/src/theme/fonts.ts"), "font");
  assert.equal(classifyChangedPath("apps/mobile/src/app/_layout.tsx"), "javascript-or-typescript");
});
