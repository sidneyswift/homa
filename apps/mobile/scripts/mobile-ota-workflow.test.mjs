import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../../.github/workflows/mobile-ota-update.yml", import.meta.url),
  "utf8",
);
const ciWorkflow = readFileSync(
  new URL("../../../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const rollbackRunbook = readFileSync(
  new URL("../release/ROLLBACK.md", import.meta.url),
  "utf8",
);

function stepIndex(name) {
  const index = workflow.indexOf(`- name: ${name}`);
  assert.notEqual(index, -1, `missing workflow step: ${name}`);
  return index;
}

function ciStepIndex(name) {
  const index = ciWorkflow.indexOf(`- name: ${name}`);
  assert.notEqual(index, -1, `missing CI step: ${name}`);
  return index;
}

test("the OTA workflow classifies a full-history exact-main checkout", () => {
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /GITHUB_REF.*refs\/heads\/main/u);
  assert.match(workflow, /checks: read/u);
  assert.match(workflow, /statuses: read/u);
  assert.match(workflow, /pnpm-lock\.yaml/u);
  assert.match(workflow, /id: classify[\s\S]*node scripts\/classify-ios-delivery\.mjs/u);
  assert.match(workflow, /required_rail == 'store-binary-required'[\s\S]*no OTA was published/u);
  assert.match(ciWorkflow, /Mobile release-rail contracts[\s\S]*pnpm check:mobile-release-rails/u);
  assert.equal(
    existsSync(new URL("./check-ota-fingerprint.mjs", import.meta.url)),
    false,
    "the superseded one-build fingerprint rail must stay deleted",
  );
});

test("tests and exact production gates finish before export", () => {
  const contracts = stepIndex("Mobile release-rail contracts");
  const classify = stepIndex("Classify exact iOS delivery rail");
  const tests = stepIndex("Native interface gauntlet");
  const gates = stepIndex("Wait for exact production gates");
  const exportBundle = stepIndex("Export the production iOS bundle once");

  assert.ok(contracts < classify);
  assert.ok(classify < tests);
  assert.ok(tests < gates);
  assert.ok(gates < exportBundle);
  assert.match(workflow, /node apps\/mobile\/scripts\/wait-for-production-gates\.mjs/u);
  assert.doesNotMatch(workflow, /for attempt in \$\(seq|check-ota-fingerprint/u);
});

test("Android restores Gradle dependencies before the native proof", () => {
  const restoreCache = ciStepIndex("Restore Gradle dependency cache");
  const setupJava = ciWorkflow.indexOf("- uses: actions/setup-java@v5");
  const nativeCompile = ciStepIndex("Android native compile-only assembly");

  assert.notEqual(setupJava, -1, "CI must use the maintained Java setup action");
  assert.ok(restoreCache < setupJava);
  assert.ok(setupJava < nativeCompile);
  assert.match(ciWorkflow, /uses: actions\/cache@v4/u);
  assert.match(ciWorkflow, /~\/\.gradle\/caches/u);
  assert.match(ciWorkflow, /pnpm-lock\.yaml/u);
  assert.doesNotMatch(ciWorkflow, /cache: gradle/u);
  assert.match(ciWorkflow, /expo prebuild --platform android --no-install --clean/u);
});

test("the verified export is the only bundle EAS publishes", () => {
  const exportBundle = stepIndex("Export the production iOS bundle once");
  const verify = stepIndex("Verify the exact production bundle");
  const publish = stepIndex("Publish the verified bytes to the production channel");
  const receipt = stepIndex("Bind the production delivery receipt");

  assert.ok(exportBundle < verify);
  assert.ok(verify < publish);
  assert.ok(publish < receipt);
  assert.equal(workflow.match(/npx expo export/gu)?.length, 1);
  assert.equal(workflow.match(/eas-cli@21\.4\.0 update/gu)?.length, 1);
  assert.match(workflow, /expo export --platform ios[\s\S]*--source-maps/u);
  assert.match(workflow, /--input-dir "\$HOMA_MOBILE_EXPORT_DIR" --skip-bundler --json/u);
  assert.match(workflow, /eas-update\.raw\.json/u);
  assert.match(workflow, /mobile-production-bundle-check\.mjs/u);
  assert.match(workflow, /mobile-delivery-receipt\.mjs/u);
});

test("release evidence is isolated and retained even when delivery fails", () => {
  assert.match(workflow, /RUNNER_TEMP.*homa-mobile-delivery/u);
  assert.match(workflow, /RUNNER_TEMP.*homa-mobile-export/u);
  assert.match(workflow, /if: always\(\)[\s\S]*actions\/upload-artifact@v4/u);
  assert.match(workflow, /mobile-delivery-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}/u);
  assert.match(workflow, /retention-days: 90/u);
});

test("the binary runbook distinguishes provider and installed-device states", () => {
  for (const required of [
    "EAS build `finished`",
    "App Store Connect processed",
    "TestFlight available",
    "Installed-device certification",
    "EAS Update published",
    "clean TestFlight install",
    "Upgrade a second supported iPhone",
    "previous public binary",
    "App Store phased release",
    "Pause the App Store phased release",
    "Publish the matching OTA rail",
    "npx eas-cli@21.4.0 build",
    "npx eas-cli@21.4.0 submit",
  ]) {
    assert.match(rollbackRunbook, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), required);
  }
  assert.match(rollbackRunbook, /public Android builds[\s\S]*founder-approved pull request/u);
});
