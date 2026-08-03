import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseSimulatorDevice,
  collectStaticGauntletReport,
  createInstalledEvidence,
  installedEvidenceStatus,
  parseSimctlDevices,
} from "./native-interface-gauntlet.mts";
import {
  nativeGauntletProfiles,
  nativeGauntletSettings,
  nativeGauntletStateScenarios,
} from "../apps/mobile/src/lib/accessibility/gauntlet-contract";

test("native interface gauntlet static contract is healthy", () => {
  const report = collectStaticGauntletReport();
  assert.equal(report.harnessVersion, "native-interface-gauntlet-v1");
  assert.match(report.sourceFingerprint, /^[0-9a-f]{64}$/u);
  assert.match(report.nativeContractFingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(report.androidDisposition, "intentionally-unreleased");
  assert.equal(report.status, "pass", report.checks.map((item) => `${item.id}: ${item.detail}`).join("\n"));
});

test("native matrix names all required profiles, settings, and state scenarios once", () => {
  const profileIds = nativeGauntletProfiles.map((profile) => profile.id);
  const settingIds = nativeGauntletSettings.map((setting) => setting.id);
  const scenarioIds = nativeGauntletStateScenarios.map((scenario) => scenario.id);
  assert.equal(new Set(profileIds).size, profileIds.length);
  assert.equal(new Set(settingIds).size, settingIds.length);
  assert.equal(new Set(scenarioIds).size, scenarioIds.length);
  assert.ok(nativeGauntletProfiles.some((profile) => profile.support === "required" && profile.kind === "iphone"));
  assert.ok(nativeGauntletProfiles.some((profile) => profile.support === "ruled-out" && profile.kind === "ipad"));
  assert.ok(nativeGauntletProfiles.some((profile) => profile.support === "compile-only" && profile.kind === "android"));
  assert.ok(nativeGauntletSettings.every((setting) => setting.required && setting.truthBoundary.length > 0));
  assert.ok(nativeGauntletStateScenarios.every((scenario) => scenario.requiredMarkers.length > 0));
});

test("simctl parser selects a booted supported iPhone and never a ruled-out profile", () => {
  const devices = parseSimctlDevices({
    devices: {
      "com.apple.CoreSimulator.SimRuntime.iOS-18-6": [
        {
          udid: "old",
          name: "iPhone 16e",
          state: "Booted",
          deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-16e",
        },
        {
          udid: "tablet",
          name: "iPad Pro 11-inch (M4)",
          state: "Shutdown",
          deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro-11-inch-M4",
        },
      ],
      "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
        {
          udid: "current",
          name: "iPhone 17 Pro",
          state: "Shutdown",
          deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro",
        },
      ],
    },
  });
  assert.equal(devices.length, 3);
  const oldest = nativeGauntletProfiles.find((profile) => profile.id === "iphone-oldest-supported");
  const current = nativeGauntletProfiles.find((profile) => profile.id === "iphone-current");
  const ruled = nativeGauntletProfiles.find((profile) => profile.id === "ipad-portrait-ruled");
  assert.ok(oldest && current && ruled);
  assert.equal(chooseSimulatorDevice(devices, oldest)?.udid, "old");
  assert.equal(chooseSimulatorDevice(devices, current)?.udid, "current");
  assert.equal(chooseSimulatorDevice(devices, ruled), null);
});

test("installed evidence status distinguishes complete, partial, and blocked runs", () => {
  const complete = {
    installed: "pass",
    launched: "pass",
    dynamicType: "pass",
    increaseContrast: "pass",
    screenshot: "pass",
    deepLink: "pass",
  } as const;
  assert.equal(installedEvidenceStatus(complete), "pass");
  assert.equal(installedEvidenceStatus({ ...complete, screenshot: "fail" }), "partial");
  assert.equal(installedEvidenceStatus({ ...complete, voiceOver: "blocked" }), "partial");
  assert.equal(installedEvidenceStatus({ installed: "pass", launched: "fail" }), "blocked");
  const evidence = createInstalledEvidence({
    sourceCommit: "abc123",
    sourceFingerprint: "source",
    nativeContractFingerprint: "contract",
    profileId: "iphone-oldest-supported",
    device: {
      udid: "old",
      name: "iPhone 16e",
      state: "Booted",
      runtime: "iOS 18.6",
      deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-16e",
    },
    bundleId: "com.thankshoma.homa",
    bundlePath: "/tmp/Homa.app",
    checks: complete,
    settings: { contentSize: "accessibility-extra-extra-extra-large" },
    screenshotPath: "/tmp/evidence.png",
    deepLink: "homa://signin",
  });
  assert.equal(evidence.status, "pass");
  assert.equal(evidence.harnessVersion, "native-interface-gauntlet-v1");
});
