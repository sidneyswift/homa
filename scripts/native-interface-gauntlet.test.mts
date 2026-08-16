import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  chooseSimulatorDevice,
  checkAndroidCiCommands,
  checkScenarioBindings,
  checkSettingsMatrix,
  collectStaticGauntletReport,
  createInstalledEvidence,
  installedEvidenceStatus,
  parseSimctlDevices,
  staticContractStatusForChecks,
} from "./native-interface-gauntlet.mts";
import {
  nativeGauntletProfiles,
  nativeGauntletSettings,
  nativeGauntletStateScenarios,
  nativeGauntletSurfaceFileGroups,
  nativeInstalledAssertionIds,
  nativeInstalledManualCheckIds,
  nativeInstalledRequiredCheckIds,
  nativeIosSupportPolicy,
  nativePhysicalOnlySettingIds,
  type NativeInstalledEvidenceAssertionId,
  type NativeInstalledEvidenceCheckId,
} from "../apps/mobile/src/lib/accessibility/gauntlet-contract";
import type { GauntletCheckStatus } from "./native-interface-gauntlet.mts";

const gauntletSource = readFileSync(new URL("./native-interface-gauntlet.mts", import.meta.url), "utf8");

function completeSimulatorChecks(): Record<NativeInstalledEvidenceCheckId, GauntletCheckStatus> {
  return {
    installedCommand: "pass",
    launchedCommand: "pass",
    dynamicTypeSettingCommand: "pass",
    increaseContrastSettingCommand: "pass",
    screenshotCaptureCommand: "pass",
    deepLinkOpenCommand: "pass",
    dynamicTypeRenderObserved: "blocked",
    increaseContrastRenderObserved: "blocked",
    screenshotRenderObserved: "blocked",
    deepLinkDestinationObserved: "blocked",
    safeAreaObserved: "blocked",
    voiceOverObserved: "blocked",
    reduceMotionObserved: "blocked",
    reduceTransparencyObserved: "blocked",
    keyboardObserved: "blocked",
    offlineRecoveryObserved: "blocked",
    interruptionObserved: "blocked",
    backgroundForegroundObserved: "blocked",
    permissionsObserved: "blocked",
  };
}

function emptyAssertions(): Record<NativeInstalledEvidenceAssertionId, string | null> {
  return {
    dynamicTypeRender: null,
    increaseContrastRender: null,
    screenshotRender: null,
    deepLinkDestination: null,
  };
}

function androidWorkflow(options: {
  capacityAfterJs?: boolean;
  capacityCommands?: string[];
  capacityStepExtra?: string;
  jobIf?: string;
  jsStepExtra?: string;
  jsCommand?: string;
  nativeStepExtra?: string;
  nativeCommands?: string[];
  nativeFirst?: boolean;
  jobExtra?: string;
  jobId?: string;
} = {}): string {
  const jsCommand = options.jsCommand
    ?? "pnpm --filter mobile exec expo export --platform android --output-dir ${{ runner.temp }}/homa-android-compile";
  const nativeCommands = options.nativeCommands ?? [
    "pnpm --filter mobile exec expo prebuild --platform android --no-install --clean",
    "bash apps/mobile/android/gradlew --project-dir apps/mobile/android :app:assembleDebug --no-daemon",
  ];
  const capacityCommands = options.capacityCommands ?? [
    "sudo rm -rf /opt/hostedtoolcache/CodeQL",
    "sudo rm -rf /usr/share/dotnet",
    "sudo rm -rf /opt/ghc",
    "sudo rm -rf /usr/local/share/boost",
    "sudo rm -rf /usr/share/swift",
    "sudo rm -rf /usr/local/lib/android/sdk/system-images",
    "sudo rm -rf /usr/local/lib/android/sdk/emulator",
    "sudo apt-get clean",
    "df -h /",
  ];
  const capacityStep = [
    "      - name: Reclaim runner disk for Android compilation",
    ...(options.capacityStepExtra ? [`        ${options.capacityStepExtra}`] : []),
    "        run: |",
    ...capacityCommands.map((command) => `          ${command}`),
  ];
  const jsStep = [
    "      - name: Android JavaScript bundle export",
    ...(options.jsStepExtra ? [`        ${options.jsStepExtra}`] : []),
    `        run: ${jsCommand}`,
  ];
  const nativeStep = [
    "      - name: Android native compile-only assembly",
    ...(options.nativeStepExtra ? [`        ${options.nativeStepExtra}`] : []),
    "        run: |",
    ...nativeCommands.map((command) => `          ${command}`),
  ];
  const proofSteps = options.nativeFirst
    ? [...capacityStep, ...nativeStep, ...jsStep]
    : options.capacityAfterJs
      ? [...jsStep, ...capacityStep, ...nativeStep]
      : [...capacityStep, ...jsStep, ...nativeStep];
  return [
    "name: CI",
    "jobs:",
    `  ${options.jobId ?? "mobile-checks"}:`,
    "    needs: classify-changes",
    `    if: ${options.jobIf ?? "needs.classify-changes.outputs.scope == 'mobile-only'"}`,
    "    runs-on: ubuntu-24.04",
    ...(options.jobExtra ? [`    ${options.jobExtra}`] : []),
    "    steps:",
    "      - uses: actions/checkout@v4",
    ...proofSteps,
    "  build:",
    "    runs-on: ubuntu-24.04",
    "    steps:",
    "      - run: pnpm build",
  ].join("\n");
}

test("native interface gauntlet static contract is healthy", () => {
  const report = collectStaticGauntletReport();
  assert.equal(report.harnessVersion, "native-interface-gauntlet-v3");
  assert.equal(report.scope, "repository-static-contract");
  assert.match(report.sourceFingerprint, /^[0-9a-f]{64}$/u);
  assert.match(report.nativeContractFingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(report.androidDisposition, "intentionally-unreleased");
  assert.equal(report.staticContractStatus, "valid", report.checks.map((item) => `${item.id}: ${item.detail}`).join("\n"));
  assert.equal(report.installedAcceptanceStatus, "not-evaluated");
  assert.equal(report.physicalDeviceAcceptanceStatus, "not-evaluated");
  assert.equal("status" in report, false, "a static report must not expose an ambiguous pass status");
  assert.equal(report.checks.find((item) => item.id === "android-js-bundle-export-guard")?.status, "pass");
  assert.equal(report.checks.find((item) => item.id === "android-native-gradle-compile-guard")?.status, "pass");
  assert.equal(report.checks.find((item) => item.id === "android-runner-capacity-guard")?.status, "pass");
  assert.equal(report.checks.find((item) => item.id === "android-distribution-guard")?.status, "pass");
});

test("static strict status never masquerades as installed or physical acceptance", () => {
  assert.equal(
    staticContractStatusForChecks([{ id: "repository-contract", status: "pass", detail: "valid" }]),
    "valid",
  );
  assert.equal(
    staticContractStatusForChecks([{ id: "repository-contract", status: "blocked", detail: "open" }]),
    "invalid",
  );
  assert.notEqual(
    staticContractStatusForChecks([{ id: "repository-contract", status: "pass", detail: "valid" }]),
    "pass",
  );
});

test("installed evidence applies accessibility settings before cold launch and capture", () => {
  const installOffset = gauntletSource.indexOf('xcrun("simctl", "install", device.udid, appPath)');
  const terminateOffset = gauntletSource.indexOf('xcrun("simctl", "terminate", device.udid, bundleId)');
  const contentSizeOffset = gauntletSource.indexOf('xcrun("simctl", "ui", device.udid, "content_size"');
  const launchOffset = gauntletSource.indexOf('xcrun("simctl", "launch", device.udid, bundleId)');
  const captureOffset = gauntletSource.indexOf('xcrun("simctl", "io", device.udid, "screenshot"');
  assert.ok(installOffset >= 0);
  assert.ok(terminateOffset > installOffset);
  assert.ok(contentSizeOffset > terminateOffset);
  assert.ok(launchOffset > contentSizeOffset);
  assert.ok(captureOffset > launchOffset);
  assert.match(gauntletSource.slice(launchOffset, captureOffset), /execFileSync\("sleep", \["30"\]\)/u);
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
  assert.deepEqual(nativeIosSupportPolicy.minimumOperatingSystem, {
    major: 16,
    minor: 4,
    label: "iOS 16.4",
  });
  assert.equal(nativeIosSupportPolicy.hardware.floor, "iPhone 8 class");
  const floor = nativeGauntletProfiles.find((profile) => profile.id === "iphone-ios-16-4-floor");
  assert.ok(floor);
  assert.deepEqual(floor.runtimeConstraint, { kind: "exact", major: 16, minor: 4 });
  assert.deepEqual(floor.simulatorNames, ["iPhone 8", "iPhone 8 Plus", "iPhone X"]);
  assert.deepEqual(
    nativePhysicalOnlySettingIds,
    ["voiceover", "offline", "interruption", "background-foreground", "permissions"],
  );
});

test("simctl parser selects a booted supported iPhone and never a ruled-out profile", () => {
  const devices = parseSimctlDevices({
    devices: {
      "com.apple.CoreSimulator.SimRuntime.iOS-16-4": [
        {
          udid: "old",
          name: "iPhone 8",
          state: "Booted",
          deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-8",
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
  const oldest = nativeGauntletProfiles.find((profile) => profile.id === "iphone-ios-16-4-floor");
  const current = nativeGauntletProfiles.find((profile) => profile.id === "iphone-current");
  const ruled = nativeGauntletProfiles.find((profile) => profile.id === "ipad-portrait-ruled");
  assert.ok(oldest && current && ruled);
  assert.equal(chooseSimulatorDevice(devices, oldest)?.udid, "old");
  assert.equal(chooseSimulatorDevice(devices, current)?.udid, "current");
  assert.equal(chooseSimulatorDevice(devices, ruled), null);
});

test("the exact floor profile rejects iOS 16.0 and accepts only iOS 16.4", () => {
  const floor = nativeGauntletProfiles.find((profile) => profile.id === "iphone-ios-16-4-floor");
  assert.ok(floor);
  const devices = parseSimctlDevices({
    devices: {
      "com.apple.CoreSimulator.SimRuntime.iOS-16-0": [{
        udid: "too-old",
        name: "iPhone 8",
        state: "Booted",
        deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-8",
      }],
      "com.apple.CoreSimulator.SimRuntime.iOS-16-4": [{
        udid: "floor",
        name: "iPhone 8",
        state: "Shutdown",
        deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-8",
      }],
    },
  });
  assert.equal(chooseSimulatorDevice(devices, floor)?.udid, "floor");
  assert.equal(
    chooseSimulatorDevice(devices.filter((device) => device.udid === "too-old"), floor),
    null,
  );
});

test("scenario markers outside their exact surface files cannot satisfy the binding", () => {
  const scenario = nativeGauntletStateScenarios.find((item) => item.id === "voiceover-priority-order");
  assert.ok(scenario);
  const snapshot: Record<string, string> = Object.fromEntries(
    scenario.surfaces.flatMap((surface) =>
      nativeGauntletSurfaceFileGroups[surface].map((file) => [file, ""]),
    ),
  );
  snapshot["apps/mobile/src/lib/accessibility.ts"] = scenario.requiredMarkers.join("\n");
  const [result] = checkScenarioBindings(snapshot, [scenario]);
  assert.equal(result?.status, "fail");
  assert.match(result?.detail ?? "", /missing scoped markers/u);
});

test("physical-only settings cannot be downgraded to simulator proof", () => {
  const downgraded = nativeGauntletSettings.map((setting) =>
    setting.id === "voiceover"
      ? { ...setting, proof: "simulator-manual" as const }
      : setting,
  );
  assert.equal(checkSettingsMatrix(downgraded).status, "fail");
  assert.match(checkSettingsMatrix(downgraded).detail, /downgraded proof type/u);
});

test("Android native Gradle compilation and JavaScript export are exact blocking CI gates", () => {
  const complete = checkAndroidCiCommands(androidWorkflow());
  assert.ok(complete.every((item) => item.status === "pass"));
  assert.ok(checkAndroidCiCommands(androidWorkflow({
    jsCommand: "pnpm --filter mobile exec expo export --platform android --output-dir /tmp/android || true",
  })).some((item) => item.id === "android-js-bundle-export-guard" && item.status === "fail"));
  assert.ok(checkAndroidCiCommands(androidWorkflow({
    nativeCommands: [
      "pnpm --filter mobile exec expo prebuild --platform android --no-install --clean",
      "bash apps/mobile/android/gradlew --project-dir apps/mobile/android :app:assembleDebug --no-daemon || true",
    ],
  })).some((item) => item.id === "android-native-gradle-compile-guard" && item.status === "fail"));
});

test("Android runner capacity is exact, blocking, and ordered before proof", () => {
  const status = (workflow: string) => checkAndroidCiCommands(workflow)
    .find((item) => item.id === "android-runner-capacity-guard")?.status;
  assert.equal(status(androidWorkflow()), "pass");
  assert.equal(status(androidWorkflow({ capacityCommands: [] })), "fail");
  assert.equal(status(androidWorkflow({ capacityAfterJs: true })), "fail");
  assert.equal(status(androidWorkflow({ capacityStepExtra: "continue-on-error: true" })), "fail");
  assert.equal(status(androidWorkflow({
    capacityCommands: [
      "sudo rm -rf /opt/hostedtoolcache",
      "sudo apt-get clean",
      "df -h /",
    ],
  })), "fail");
});

test("Android CI proof cannot move outside mobile-checks or become skippable", () => {
  assert.ok(checkAndroidCiCommands(androidWorkflow({ jobId: "build" })).every((item) => item.status === "fail"));
  assert.ok(checkAndroidCiCommands(androidWorkflow({ jobIf: "false" })).every((item) => item.status === "fail"));
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ jsStepExtra: "if: false" }))[0]?.status,
    "fail",
  );
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ nativeStepExtra: "continue-on-error: true" }))[1]?.status,
    "fail",
  );
  assert.ok(checkAndroidCiCommands(androidWorkflow({ jobExtra: "continue-on-error: true" })).every((item) => item.status === "fail"));
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ nativeStepExtra: "continue-on-error: ${{ matrix.allow_failure }}" }))[1]?.status,
    "fail",
  );
  assert.ok(checkAndroidCiCommands(androidWorkflow({
    jobExtra: "continue-on-error: ${{ inputs.allow_failure }}",
  })).every((item) => item.status === "fail"));
  assert.ok(checkAndroidCiCommands(androidWorkflow({
    jobExtra: "continue-on-error: false",
    jsStepExtra: "continue-on-error: false",
    nativeStepExtra: "continue-on-error: false",
  })).every((item) => item.status === "pass"));
});

test("Android proof steps reject custom shells and native-before-export ordering", () => {
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ jsStepExtra: "shell: true {0}" }))[0]?.status,
    "fail",
  );
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ nativeStepExtra: "shell: true {0}" }))[1]?.status,
    "fail",
  );
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ jsStepExtra: "\"shell\": true {0}" }))[0]?.status,
    "fail",
  );
  assert.ok(checkAndroidCiCommands(androidWorkflow({ nativeFirst: true })).every((item) => item.status === "fail"));
});

test("Android proof steps reject inherited workflow and job shells", () => {
  const workflowShell = androidWorkflow().replace(
    "jobs:",
    [
      "defaults:",
      "  run:",
      "    shell: true {0}",
      "jobs:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(workflowShell).every((item) => item.status === "fail"));

  const jobShell = androidWorkflow().replace(
    "    steps:",
    [
      "    defaults:",
      "      run:",
      "        shell: true {0}",
      "    steps:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(jobShell).every((item) => item.status === "fail"));

  const trailingWorkflowShell = `${androidWorkflow()}\n${[
    "defaults:",
    "  run:",
    "    shell: true {0}",
  ].join("\n")}`;
  assert.ok(checkAndroidCiCommands(trailingWorkflowShell).every((item) => item.status === "fail"));

  const trailingJobShell = androidWorkflow().replace(
    "  build:",
    [
      "    defaults:",
      "      run:",
      "        shell: true {0}",
      "  build:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(trailingJobShell).every((item) => item.status === "fail"));
});

test("Android proof steps reject defaults indirection and duplicate defaults", () => {
  const aliasedDefaults = androidWorkflow().replace(
    "name: CI\njobs:",
    [
      "name: CI",
      "shared-defaults: &shared_defaults",
      "  run:",
      "    shell: true {0}",
      "defaults: *shared_defaults",
      "jobs:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(aliasedDefaults).every((item) => item.status === "fail"));

  const duplicateDefaults = androidWorkflow().replace(
    "jobs:",
    [
      "defaults:",
      "  run:",
      "    working-directory: apps/mobile",
      "defaults:",
      "  run:",
      "    working-directory: .",
      "jobs:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(duplicateDefaults).every((item) => item.status === "fail"));

  const workflowWorkingDirectory = androidWorkflow().replace(
    "jobs:",
    [
      "defaults:",
      "  run:",
      "    working-directory: apps/mobile",
      "jobs:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(workflowWorkingDirectory).every((item) => item.status === "fail"));
});

test("Android native proof requires prebuild then Gradle in one exact named step", () => {
  const reversed = checkAndroidCiCommands(androidWorkflow({
    nativeCommands: [
      "bash apps/mobile/android/gradlew --project-dir apps/mobile/android :app:assembleDebug --no-daemon",
      "pnpm --filter mobile exec expo prebuild --platform android --no-install --clean",
    ],
  }));
  assert.equal(reversed[1]?.status, "fail");

  const folded = androidWorkflow().replace(
    "      - name: Android native compile-only assembly\n        run: |",
    "      - name: Android native compile-only assembly\n        run: >",
  );
  assert.equal(checkAndroidCiCommands(folded)[1]?.status, "fail");

  const splitAcrossJobs = [
    androidWorkflow({ nativeCommands: [] }),
    "  android-shadow:",
    "    runs-on: ubuntu-24.04",
    "    steps:",
    "      - name: Android native compile-only assembly",
    "        run: |",
    "          pnpm --filter mobile exec expo prebuild --platform android --no-install --clean",
    "          bash apps/mobile/android/gradlew --project-dir apps/mobile/android :app:assembleDebug --no-daemon",
  ].join("\n");
  assert.equal(checkAndroidCiCommands(splitAcrossJobs)[1]?.status, "fail");
});

test("Android mobile job controls cannot become non-blocking after steps", () => {
  const trailingContinueOnError = androidWorkflow().replace(
    "  build:",
    "    continue-on-error: ${{ inputs.allow_failure }}\n  build:",
  );
  assert.ok(checkAndroidCiCommands(trailingContinueOnError).every((item) => item.status === "fail"));
});

test("Android proof rejects duplicate steps and duplicate run keys", () => {
  const duplicateSteps = androidWorkflow().replace(
    "  build:",
    [
      "    steps:",
      "      - run: echo duplicate sequence",
      "  build:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(duplicateSteps).every((item) => item.status === "fail"));

  const duplicateRunBefore = androidWorkflow({ nativeStepExtra: "run: echo bypass" });
  assert.equal(checkAndroidCiCommands(duplicateRunBefore)[1]?.status, "fail");

  const duplicateRunAfter = androidWorkflow().replace(
    "  build:",
    "        run: echo bypass\n  build:",
  );
  assert.equal(checkAndroidCiCommands(duplicateRunAfter)[1]?.status, "fail");

  const quotedDuplicateJob = [
    androidWorkflow(),
    "  'mobile-checks':",
    "    needs: classify-changes",
    "    runs-on: ubuntu-24.04",
    "    steps:",
    "      - run: echo duplicate job",
  ].join("\n");
  assert.ok(checkAndroidCiCommands(quotedDuplicateJob).every((item) => item.status === "fail"));
});

test("Android proof rejects executable environment overrides", () => {
  const workflowEnv = androidWorkflow().replace(
    "jobs:",
    "env: { BASH_ENV: /tmp/hijack }\njobs:",
  );
  assert.ok(checkAndroidCiCommands(workflowEnv).every((item) => item.status === "fail"));
  assert.ok(checkAndroidCiCommands(androidWorkflow({
    jobExtra: "env: { BASH_ENV: /tmp/hijack }",
  })).every((item) => item.status === "fail"));
  assert.ok(checkAndroidCiCommands(androidWorkflow({
    jobExtra: "container: attacker/image",
  })).every((item) => item.status === "fail"));
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ jsStepExtra: "env: { BASH_ENV: /tmp/hijack }" }))[0]?.status,
    "fail",
  );
  assert.equal(
    checkAndroidCiCommands(androidWorkflow({ nativeStepExtra: "working-directory: apps/mobile" }))[1]?.status,
    "fail",
  );

  const jobDefaults = androidWorkflow().replace(
    "    steps:",
    [
      "    defaults:",
      "      run:",
      "        working-directory: apps/mobile",
      "    steps:",
    ].join("\n"),
  );
  assert.ok(checkAndroidCiCommands(jobDefaults).every((item) => item.status === "fail"));
});

test("Android proof rejects escaped double-quoted protected keys", () => {
  const escapedShell = androidWorkflow({ jsStepExtra: "\"\\u0073hell\": true {0}" });
  assert.ok(checkAndroidCiCommands(escapedShell).every((item) => item.status === "fail"));

  const escapedEnv = androidWorkflow().replace(
    "jobs:",
    "\"\\u0065nv\": { BASH_ENV: /tmp/hijack }\njobs:",
  );
  assert.ok(checkAndroidCiCommands(escapedEnv).every((item) => item.status === "fail"));

  const escapedDuplicateRun = androidWorkflow({ nativeStepExtra: "\"\\u0072un\": echo bypass" });
  assert.ok(checkAndroidCiCommands(escapedDuplicateRun).every((item) => item.status === "fail"));

  const escapedDuplicateSteps = androidWorkflow().replace(
    "  build:",
    "    \"\\u0073teps\":\n      - run: echo duplicate sequence\n  build:",
  );
  assert.ok(checkAndroidCiCommands(escapedDuplicateSteps).every((item) => item.status === "fail"));

  const escapedContainer = androidWorkflow({ jobExtra: "\"\\u0063ontainer\": attacker/image" });
  assert.ok(checkAndroidCiCommands(escapedContainer).every((item) => item.status === "fail"));

  const escapedDuplicateJob = [
    androidWorkflow(),
    "  \"\\u006dobile-checks\":",
    "    needs: classify-changes",
    "    runs-on: ubuntu-24.04",
    "    steps:",
    "      - run: echo duplicate job",
  ].join("\n");
  assert.ok(checkAndroidCiCommands(escapedDuplicateJob).every((item) => item.status === "fail"));
});

test("installed evidence is closed-world and blocks every omitted required field", () => {
  const checks = completeSimulatorChecks();
  const assertions = emptyAssertions();
  assert.equal(installedEvidenceStatus(checks, assertions), "partial");

  for (const id of nativeInstalledRequiredCheckIds) {
    const incomplete: Record<string, GauntletCheckStatus> = { ...checks };
    delete incomplete[id];
    assert.equal(installedEvidenceStatus(incomplete, assertions), "blocked", `missing check ${id}`);
  }
  for (const id of nativeInstalledAssertionIds) {
    const incomplete: Record<string, string | null> = { ...assertions };
    delete incomplete[id];
    assert.equal(installedEvidenceStatus(checks, incomplete), "blocked", `missing assertion ${id}`);
  }
  assert.equal(
    installedEvidenceStatus({ ...checks, legacyScreenshot: "pass" }, assertions),
    "blocked",
    "unknown legacy keys cannot widen the contract",
  );
  assert.equal(
    installedEvidenceStatus(checks, { ...assertions, legacyDestination: "signin" }),
    "blocked",
    "unknown assertion keys cannot widen the contract",
  );
});

test("command success cannot impersonate observed render or destination success", () => {
  const checks = completeSimulatorChecks();
  const assertions = emptyAssertions();
  assert.equal(installedEvidenceStatus(checks, assertions), "partial");

  const claimedObserved = {
    ...checks,
    dynamicTypeRenderObserved: "pass",
    increaseContrastRenderObserved: "pass",
    screenshotRenderObserved: "pass",
    deepLinkDestinationObserved: "pass",
  } as const;
  assert.equal(
    installedEvidenceStatus(claimedObserved, assertions),
    "blocked",
    "observed passes require explicit assertions",
  );
  const observedAssertions = {
    dynamicTypeRender: "All labels reflowed at AX5 without clipping or hidden actions.",
    increaseContrastRender: "Selection, status, and action boundaries remained visible.",
    screenshotRender: "The capture showed Homa's signed-out product surface, not a splash or system sheet.",
    deepLinkDestination: "The homa://signin handoff visibly reached Homa's sign-in screen.",
  } as const;
  assert.equal(
    installedEvidenceStatus(claimedObserved, observedAssertions),
    "partial",
    "manual and physical checks keep simulator evidence partial",
  );

  for (const id of nativeInstalledManualCheckIds) {
    assert.equal(
      installedEvidenceStatus({ ...checks, [id]: "pass" }, assertions),
      "blocked",
      `${id} cannot be certified by the simulator evidence type`,
    );
  }
});

test("installed evidence status blocks failed install or launch commands", () => {
  const checks = completeSimulatorChecks();
  const assertions = emptyAssertions();
  assert.equal(installedEvidenceStatus({ ...checks, installedCommand: "fail" }, assertions), "blocked");
  assert.equal(installedEvidenceStatus({ ...checks, launchedCommand: "fail" }, assertions), "blocked");
});

test("installed evidence records command proof while preserving every observation boundary", () => {
  const checks = completeSimulatorChecks();
  const assertions = emptyAssertions();
  const evidence = createInstalledEvidence({
    sourceCommit: "abc123",
    sourceFingerprint: "source",
    nativeContractFingerprint: "contract",
    profileId: "iphone-ios-16-4-floor",
    device: {
      udid: "old",
      name: "iPhone 8",
      state: "Booted",
      runtime: "iOS 16.4",
      deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-8",
    },
    bundleId: "com.thankshoma.homa",
    bundlePath: "/tmp/Homa.app",
    checks,
    assertions,
    settings: { contentSize: "accessibility-extra-extra-extra-large" },
    screenshotPath: "/tmp/evidence.png",
    deepLink: "homa://signin",
  });
  assert.equal(evidence.status, "partial");
  assert.equal(evidence.harnessVersion, "native-interface-gauntlet-v3");
  assert.equal(evidence.evidenceType, "simulator-automation");
  assert.deepEqual(evidence.assertions, assertions);
});
