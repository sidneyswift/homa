import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  nativeGauntletProfiles,
  nativeGauntletSettings,
  nativeGauntletSourceRoots,
  nativeGauntletStateScenarios,
  nativeGauntletSurfaceFileGroups,
  nativeInstalledAssertionIds,
  nativeInstalledManualCheckIds,
  nativeInstalledRequiredCheckIds,
  nativeIosSupportPolicy,
  nativeRequiredProofBySetting,
  NATIVE_GAUNTLET_VERSION,
  type NativeInstalledEvidenceAssertionId,
  type NativeInstalledEvidenceCheckId,
  type NativeGauntletProfile,
  type NativeGauntletSetting,
  type NativeGauntletSettingId,
  type NativeGauntletStateScenario,
} from "../apps/mobile/src/lib/accessibility/gauntlet-contract";
import {
  nativeAccessibilityJourneys,
  nativeAccessibilitySurfaces,
} from "../apps/mobile/src/lib/accessibility/acceptance-manifest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE_ROOT = resolve(ROOT, "apps/mobile");
const APP_CONFIG_PATH = resolve(MOBILE_ROOT, "app.json");
const EAS_CONFIG_PATH = resolve(MOBILE_ROOT, "eas.json");
const MOBILE_PACKAGE_PATH = resolve(MOBILE_ROOT, "package.json");
const NATIVE_MODULE_PODSPEC_PATHS = [
  resolve(MOBILE_ROOT, "modules/homa-print/ios/HomaPrint.podspec"),
  resolve(MOBILE_ROOT, "modules/homa-voice-audio/ios/HomaVoiceAudio.podspec"),
] as const;
const GENERATED_NATIVE_PATH = resolve(ROOT, "packages/design/generated/native.json");
const DEFAULT_OUTPUT = resolve(ROOT, "artifacts/native-interface-gauntlet");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export type GauntletCheckStatus = "pass" | "fail" | "blocked";

export interface GauntletCheck {
  id: string;
  status: GauntletCheckStatus;
  detail: string;
}

export interface NativeGauntletStaticReport {
  harnessVersion: typeof NATIVE_GAUNTLET_VERSION;
  scope: "repository-static-contract";
  sourceCommit: string;
  sourceFingerprint: string;
  nativeContractFingerprint: string;
  androidDisposition: "intentionally-unreleased" | "supported" | "retired" | "unknown";
  checks: readonly GauntletCheck[];
  staticContractStatus: "valid" | "invalid";
  installedAcceptanceStatus: "not-evaluated";
  physicalDeviceAcceptanceStatus: "not-evaluated";
}

export interface SimctlDevice {
  udid: string;
  name: string;
  state: string;
  runtime: string;
  deviceTypeIdentifier: string;
}

export interface InstalledSimulatorEvidence {
  harnessVersion: typeof NATIVE_GAUNTLET_VERSION;
  evidenceType: "simulator-automation";
  sourceCommit: string;
  sourceFingerprint: string;
  nativeContractFingerprint: string;
  profileId: string;
  device: SimctlDevice;
  bundleId: string;
  bundlePath: string;
  checks: Readonly<Record<NativeInstalledEvidenceCheckId, GauntletCheckStatus>>;
  assertions: Readonly<Record<NativeInstalledEvidenceAssertionId, string | null>>;
  settings: Readonly<Record<string, string>>;
  screenshotPath: string | null;
  deepLink: string;
  status: "partial" | "blocked";
  limitation: string | null;
}

interface AppConfig {
  expo?: {
    scheme?: string;
    orientation?: string;
    ios?: { supportsTablet?: boolean; bundleIdentifier?: string };
    android?: { package?: string };
    runtimeVersion?: { policy?: string };
  };
}

interface EASConfig {
  build?: { production?: { channel?: string; ios?: { image?: string } } };
  submit?: {
    production?: {
      ios?: { ascAppId?: string };
      android?: unknown;
    };
  };
}

interface MobilePackageConfig {
  dependencies?: { expo?: string };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function walk(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    const path = resolve(root, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function sourceFiles(): string[] {
  return nativeGauntletSourceRoots
    .flatMap((root) => walk(resolve(ROOT, root)))
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .filter((path) => /\.(?:ts|tsx)$/u.test(path))
    .sort();
}

function sourceFingerprint(paths = sourceFiles()): string {
  return hash(
    paths
      .map((path) => `${relative(ROOT, path)}\n${hash(readFileSync(path))}`)
      .join("\n"),
  );
}

function runtimeLabel(runtimeIdentifier: string): string {
  const match = runtimeIdentifier.match(/iOS-(\d+)-(\d+)/u);
  return match ? `iOS ${match[1]}.${match[2]}` : runtimeIdentifier;
}

function iosRuntimeVersion(runtime: string): { major: number; minor: number } | null {
  const match = runtime.match(/(?:^|\.)iOS(?:-|\s)(\d+)[.-](\d+)$/u)
    ?? runtime.match(/^iOS\s(\d+)\.(\d+)$/u);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function compareVersions(
  left: { major: number; minor: number },
  right: { major: number; minor: number },
): number {
  return left.major === right.major ? left.minor - right.minor : left.major - right.major;
}

export function runtimeSatisfiesProfile(runtime: string, profile: NativeGauntletProfile): boolean {
  if (profile.runtimeConstraint.kind === "none") return true;
  const version = iosRuntimeVersion(runtime);
  if (!version) return false;
  const required = {
    major: profile.runtimeConstraint.major,
    minor: profile.runtimeConstraint.minor,
  };
  return profile.runtimeConstraint.kind === "exact"
    ? compareVersions(version, required) === 0
    : compareVersions(version, required) >= 0;
}

export function parseSimctlDevices(payload: unknown): SimctlDevice[] {
  if (!payload || typeof payload !== "object") return [];
  const devicesByRuntime = (payload as { devices?: Record<string, unknown> }).devices;
  if (!devicesByRuntime || typeof devicesByRuntime !== "object") return [];
  const devices: SimctlDevice[] = [];
  for (const [runtimeIdentifier, value] of Object.entries(devicesByRuntime)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const device = item as Record<string, unknown>;
      if (typeof device.udid !== "string" || typeof device.name !== "string") continue;
      devices.push({
        udid: device.udid,
        name: device.name,
        state: typeof device.state === "string" ? device.state : "unknown",
        runtime: runtimeLabel(runtimeIdentifier),
        deviceTypeIdentifier:
          typeof device.deviceTypeIdentifier === "string"
            ? device.deviceTypeIdentifier
            : "",
      });
    }
  }
  return devices.sort((left, right) => left.udid.localeCompare(right.udid));
}

function profileMatches(device: SimctlDevice, profile: NativeGauntletProfile): boolean {
  if (profile.kind === "iphone" && !/iPhone/u.test(device.deviceTypeIdentifier)) return false;
  if (profile.kind === "ipad" && !/iPad/u.test(device.deviceTypeIdentifier)) return false;
  if (!profile.simulatorNames.some((name) => device.name === name)) return false;
  return runtimeSatisfiesProfile(device.runtime, profile);
}

export function chooseSimulatorDevice(
  devices: readonly SimctlDevice[],
  profile: NativeGauntletProfile,
): SimctlDevice | null {
  if (profile.support !== "required") return null;
  return (
    devices.find((device) => device.state === "Booted" && profileMatches(device, profile))
    ?? devices.find((device) => profileMatches(device, profile))
    ?? null
  );
}

function check(id: string, status: GauntletCheckStatus, detail: string): GauntletCheck {
  return { id, status, detail };
}

export function staticContractStatusForChecks(
  checks: readonly GauntletCheck[],
): NativeGauntletStaticReport["staticContractStatus"] {
  return checks.every((item) => item.status === "pass") ? "valid" : "invalid";
}

function allMobileText(): string {
  return sourceFiles().map((path) => readFileSync(path, "utf8")).join("\n");
}

function checkProfiles(): GauntletCheck {
  const ids = nativeGauntletProfiles.map((profile) => profile.id);
  const expected = [
    "iphone-ios-16-4-floor",
    "iphone-current",
    "ipad-portrait-ruled",
    "ipad-landscape-ruled",
    "android-compile-guard",
  ];
  const floor = nativeGauntletProfiles.find((profile) => profile.id === "iphone-ios-16-4-floor");
  const complete = expected.every((id) => ids.includes(id))
    && new Set(ids).size === ids.length
    && nativeGauntletProfiles.some((profile) => profile.support === "required" && profile.kind === "iphone")
    && nativeGauntletProfiles.some((profile) => profile.support === "ruled-out" && profile.orientation === "landscape" && profile.kind === "ipad")
    && nativeGauntletProfiles.some((profile) => profile.support === "compile-only" && profile.kind === "android")
    && floor?.runtimeConstraint.kind === "exact"
    && floor.runtimeConstraint.major === nativeIosSupportPolicy.minimumOperatingSystem.major
    && floor.runtimeConstraint.minor === nativeIosSupportPolicy.minimumOperatingSystem.minor
    && nativeIosSupportPolicy.hardware.oldestValidationDevices.every((name) => floor.simulatorNames.includes(name));
  return check(
    "profile-matrix",
    complete ? "pass" : "fail",
    complete
      ? "Oldest/current iPhone, ruled iPad orientations, and Android compile disposition are explicit."
      : "The native profile matrix is incomplete or duplicated.",
  );
}

export function checkSettingsMatrix(
  settings: readonly NativeGauntletSetting[] = nativeGauntletSettings,
): GauntletCheck {
  const expected: NativeGauntletSettingId[] = [
    "dynamic-type",
    "voiceover",
    "reduce-motion",
    "reduce-transparency",
    "increase-contrast",
    "safe-area",
    "keyboard",
    "offline",
    "interruption",
    "background-foreground",
    "deep-link",
    "permissions",
  ];
  const ids = settings.map((setting) => setting.id);
  const complete = expected.every((id) => ids.includes(id))
    && new Set(ids).size === ids.length
    && settings.length === expected.length
    && settings.every(
      (setting) => setting.required
        && setting.truthBoundary.length > 0
        && setting.proof === nativeRequiredProofBySetting[setting.id],
    );
  return check(
    "settings-matrix",
    complete ? "pass" : "fail",
    complete
      ? "Every setting has its required simulator-manual or physical-device-manual proof boundary."
      : "The native settings matrix is incomplete, duplicated, or has a downgraded proof type.",
  );
}

type NativeScenarioSourceSnapshot = Readonly<Record<string, string | null | undefined>>;

export function checkScenarioBindings(
  snapshot: NativeScenarioSourceSnapshot,
  scenarios: readonly NativeGauntletStateScenario[] = nativeGauntletStateScenarios,
): GauntletCheck[] {
  return scenarios.map((scenario) => {
    const surfaceSources = scenario.surfaces.map((surface) => {
      const files = nativeGauntletSurfaceFileGroups[surface];
      return {
        surface,
        files,
        text: files.map((file) => snapshot[file] ?? "").join("\n"),
      };
    });
    const missingFiles = surfaceSources.flatMap(({ files }) =>
      files.filter((file) => typeof snapshot[file] !== "string"),
    );
    const scenarioText = surfaceSources.map(({ text }) => text).join("\n");
    const missingMarkers = scenario.requiredMarkers.filter((marker) => !scenarioText.includes(marker));
    const unboundSurfaces = surfaceSources
      .filter(({ text }) => !scenario.requiredMarkers.some((marker) => text.includes(marker)))
      .map(({ surface }) => surface);
    const valid = missingFiles.length === 0
      && missingMarkers.length === 0
      && unboundSurfaces.length === 0;
    return check(
      `scenario:${scenario.id}`,
      valid ? "pass" : "fail",
      valid
        ? `${scenario.setting} markers are bound to exact files for ${scenario.surfaces.join(", ")}.`
        : [
          missingFiles.length > 0 ? `missing files: ${missingFiles.join(", ")}` : null,
          missingMarkers.length > 0 ? `missing scoped markers: ${missingMarkers.join(", ")}` : null,
          unboundSurfaces.length > 0 ? `surface groups without a scenario marker: ${unboundSurfaces.join(", ")}` : null,
        ].filter(Boolean).join("; "),
    );
  });
}

function scenarioSourceSnapshot(): NativeScenarioSourceSnapshot {
  const files = new Set(
    nativeGauntletStateScenarios.flatMap((scenario) =>
      scenario.surfaces.flatMap((surface) => nativeGauntletSurfaceFileGroups[surface]),
    ),
  );
  return Object.fromEntries(
    [...files].map((file) => {
      const path = resolve(ROOT, file);
      return [file, existsSync(path) ? readFileSync(path, "utf8") : null];
    }),
  );
}

interface WorkflowStepSnapshot {
  name: string;
  block: string;
  runLines: string[];
  runForm: string | null;
  order: number;
}

const ANDROID_JS_STEP_NAME = "Android JavaScript bundle export";
const ANDROID_NATIVE_STEP_NAME = "Android native compile-only assembly";
const ANDROID_CAPACITY_STEP_NAME = "Reclaim runner disk for Android compilation";
const ANDROID_JS_COMMAND = "pnpm --filter mobile exec expo export --platform android --output-dir ${{ runner.temp }}/homa-android-compile";
const ANDROID_PREBUILD_COMMAND = "pnpm --filter mobile exec expo prebuild --platform android --no-install --clean";
const ANDROID_GRADLE_COMMAND = "bash apps/mobile/android/gradlew --project-dir apps/mobile/android :app:assembleDebug --no-daemon";
const ANDROID_CAPACITY_COMMANDS = [
  "sudo rm -rf /opt/hostedtoolcache/CodeQL",
  "sudo rm -rf /usr/share/dotnet",
  "sudo rm -rf /opt/ghc",
  "sudo rm -rf /usr/local/share/boost",
  "sudo rm -rf /usr/share/swift",
  "sudo rm -rf /usr/local/lib/android/sdk/system-images",
  "sudo rm -rf /usr/local/lib/android/sdk/emulator",
  "sudo apt-get clean",
  "df -h /",
] as const;

function workflowJobBlock(workflow: string, jobId: string): string | null {
  const lines = workflow.split(/\r?\n/u);
  const jobKey = `(?:${jobId}|["']${jobId}["'])`;
  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => new RegExp(`^  ${jobKey}\\s*:\\s*$`, "u").test(line));
  if (starts.length !== 1) return null;
  const start = starts[0]!.index;
  const endOffset = lines.slice(start + 1).findIndex(
    (line) => /^  (?:[A-Za-z0-9_-]+|["'][A-Za-z0-9_-]+["'])\s*:\s*$/u.test(line),
  );
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  return lines.slice(start, end).join("\n");
}

function workflowSteps(jobBlock: string): WorkflowStepSnapshot[] {
  const lines = jobBlock.split("\n");
  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^      - (?:name|uses):/u.test(line));
  return starts.flatMap(({ line, index }, startIndex) => {
    const end = starts[startIndex + 1]?.index ?? lines.length;
    const blockLines = lines.slice(index, end);
    const nameMatch = line.match(/^      - name:\s*(.+?)\s*$/u);
    if (!nameMatch) return [];
    const runIndex = blockLines.findIndex((blockLine) => /^        run:/u.test(blockLine));
    if (runIndex === -1) {
      return [{ name: nameMatch[1]!, block: blockLines.join("\n"), runLines: [], runForm: null, order: index }];
    }
    const runLine = blockLines[runIndex]!;
    const scalar = runLine.match(/^        run:\s+(.+?)\s*$/u);
    const runLines = scalar && !/^[|>]\s*$/u.test(scalar[1]!)
      ? [scalar[1]!]
      : blockLines.slice(runIndex + 1)
        .filter((blockLine) => /^          \S/u.test(blockLine))
        .map((blockLine) => blockLine.slice(10).trimEnd());
    return [{
      name: nameMatch[1]!,
      block: blockLines.join("\n"),
      runLines,
      runForm: scalar?.[1] ?? null,
      order: index,
    }];
  });
}

function workflowPropertyValues(block: string, key: string, indent: number): string[] {
  const prefix = " ".repeat(indent);
  const matches = block.matchAll(
    new RegExp(`^${prefix}(?:${key}|["']${key}["'])[ \\t]*:[ \\t]*(.*?)[ \\t]*$`, "gmu"),
  );
  return [...matches].map((match) => match[1] ?? "");
}

function propertyIsAbsentOrLiteralFalse(block: string, key: string, indent: number): boolean {
  const values = workflowPropertyValues(block, key, indent);
  return values.length === 0 || (values.length === 1 && values[0] === "false");
}

interface YamlPropertySnapshot {
  index: number;
  indent: number;
  value: string;
}

function yamlProperties(block: string, key: string): YamlPropertySnapshot[] {
  const matcher = new RegExp(`^( *)(?:${key}|["']${key}["'])\\s*:\\s*(.*?)\\s*$`, "u");
  return block.split("\n").flatMap((line, index) => {
    const match = line.match(matcher);
    if (!match) return [];
    return [{ index, indent: match[1]!.length, value: match[2] ?? "" }];
  });
}

function containsYamlAnchorOrAlias(block: string): boolean {
  const code = block
    .split("\n")
    .filter((line) => !/^\s*#/u.test(line))
    .join("\n");
  return /(?:^|[\s:[{,])(?:&|\*)[A-Za-z_][A-Za-z0-9_-]*/mu.test(code);
}

function containsEscapedDoubleQuotedMappingKey(workflow: string): boolean {
  return /"(?:[^"\\]|\\.)*\\.(?:[^"\\]|\\.)*"[ \t]*:/u.test(workflow);
}

function executionScopeHasNoDefaultsOrMerge(scopeBlock: string, propertyIndent: number): boolean {
  const lines = scopeBlock.split("\n");
  const prefix = " ".repeat(propertyIndent);
  if (lines.some((line) => new RegExp(`^${prefix}(?:<<|["']<<["'])\\s*:`, "u").test(line))) {
    return false;
  }
  return yamlProperties(scopeBlock, "defaults")
    .every((property) => property.indent !== propertyIndent);
}

function workflowHeader(workflow: string): string | null {
  const lines = workflow.split(/\r?\n/u);
  const jobIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^(?:jobs|["']jobs["'])\s*:\s*$/u.test(line));
  if (jobIndexes.length !== 1) return null;
  return lines.slice(0, jobIndexes[0]!.index).join("\n");
}

function workflowStepEnabledAndBlocking(step: WorkflowStepSnapshot): boolean {
  const conditions = workflowPropertyValues(step.block, "if", 8);
  const enabled = conditions.length === 0 || (conditions.length === 1 && conditions[0] === "true");
  const noCustomShell = workflowPropertyValues(step.block, "shell", 8).length === 0;
  const singleRun = workflowPropertyValues(step.block, "run", 8).length === 1;
  const noEnvironment = workflowPropertyValues(step.block, "env", 8).length === 0;
  const noWorkingDirectory = workflowPropertyValues(step.block, "working-directory", 8).length === 0;
  return enabled
    && noCustomShell
    && singleRun
    && noEnvironment
    && noWorkingDirectory
    && !containsYamlAnchorOrAlias(step.block)
    && propertyIsAbsentOrLiteralFalse(step.block, "continue-on-error", 8);
}

function mobileJobScopeIsEnabled(jobBlock: string): boolean {
  const conditions = workflowPropertyValues(jobBlock, "if", 4);
  const condition = conditions[0]
    ?.replace(/^\$\{\{\s*/u, "")
    .replace(/\s*\}\}$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  return conditions.length === 1
    && condition === "needs.classify-changes.outputs.scope == 'full' || needs.classify-changes.outputs.scope == 'mobile-only'"
    && workflowPropertyValues(jobBlock, "needs", 4).length === 1
    && workflowPropertyValues(jobBlock, "needs", 4)[0] === "classify-changes"
    && workflowPropertyValues(jobBlock, "runs-on", 4).length === 1
    && workflowPropertyValues(jobBlock, "runs-on", 4)[0] === "ubuntu-24.04"
    && workflowPropertyValues(jobBlock, "steps", 4).length === 1
    && workflowPropertyValues(jobBlock, "steps", 4)[0] === ""
    && workflowPropertyValues(jobBlock, "container", 4).length === 0
    && workflowPropertyValues(jobBlock, "env", 4).length === 0
    && propertyIsAbsentOrLiteralFalse(jobBlock, "continue-on-error", 4);
}

export function checkAndroidCiCommands(ciWorkflow: string): GauntletCheck[] {
  if (containsEscapedDoubleQuotedMappingKey(ciWorkflow)) {
    return [
      check(
        "android-js-bundle-export-guard",
        "fail",
        "Android CI proof cannot be parsed safely when a double-quoted mapping key contains an escape.",
      ),
      check(
        "android-native-gradle-compile-guard",
        "fail",
        "Android CI proof cannot be parsed safely when a double-quoted mapping key contains an escape.",
      ),
      check(
        "android-runner-capacity-guard",
        "fail",
        "Android CI proof cannot be parsed safely when a double-quoted mapping key contains an escape.",
      ),
    ];
  }
  const rootHeader = workflowHeader(ciWorkflow);
  const mobileJob = workflowJobBlock(ciWorkflow, "mobile-checks");
  const steps = mobileJob ? workflowSteps(mobileJob) : [];
  const jsSteps = steps.filter((step) => step.name === ANDROID_JS_STEP_NAME);
  const nativeSteps = steps.filter((step) => step.name === ANDROID_NATIVE_STEP_NAME);
  const capacitySteps = steps.filter((step) => step.name === ANDROID_CAPACITY_STEP_NAME);
  const executionOverridesAreAbsent = rootHeader !== null
    && mobileJob !== null
    && executionScopeHasNoDefaultsOrMerge(ciWorkflow, 0)
    && executionScopeHasNoDefaultsOrMerge(mobileJob, 4)
    && workflowPropertyValues(ciWorkflow, "env", 0).length === 0;
  const enabledJob = mobileJob !== null
    && mobileJobScopeIsEnabled(mobileJob)
    && executionOverridesAreAbsent;
  const ordered = jsSteps.length === 1
    && nativeSteps.length === 1
    && jsSteps[0]!.order < nativeSteps[0]!.order;
  const hasJsBundleExport = enabledJob
    && ordered
    && jsSteps.length === 1
    && jsSteps[0]!.runLines.length === 1
    && jsSteps[0]!.runLines[0] === ANDROID_JS_COMMAND
    && workflowStepEnabledAndBlocking(jsSteps[0]!);
  const hasNativeAssembly = enabledJob
    && ordered
    && nativeSteps.length === 1
    && nativeSteps[0]!.runLines.length === 2
    && nativeSteps[0]!.runForm === "|"
    && nativeSteps[0]!.runLines[0] === ANDROID_PREBUILD_COMMAND
    && nativeSteps[0]!.runLines[1] === ANDROID_GRADLE_COMMAND
    && workflowStepEnabledAndBlocking(nativeSteps[0]!);
  const hasRunnerCapacity = enabledJob
    && ordered
    && capacitySteps.length === 1
    && jsSteps.length === 1
    && capacitySteps[0]!.order < jsSteps[0]!.order
    && capacitySteps[0]!.runForm === "|"
    && capacitySteps[0]!.runLines.length === ANDROID_CAPACITY_COMMANDS.length
    && capacitySteps[0]!.runLines.every((line, index) => line === ANDROID_CAPACITY_COMMANDS[index])
    && workflowStepEnabledAndBlocking(capacitySteps[0]!);
  return [
    check(
      "android-js-bundle-export-guard",
      hasJsBundleExport ? "pass" : "fail",
      "Android JavaScript must be exported through Expo in CI.",
    ),
    check(
      "android-native-gradle-compile-guard",
      hasNativeAssembly ? "pass" : "fail",
      "Android native code must be prebuilt and assembled through :app:assembleDebug in CI.",
    ),
    check(
      "android-runner-capacity-guard",
      hasRunnerCapacity ? "pass" : "fail",
      "Android CI must reclaim only unused hosted toolchains and emulator assets before the blocking export and native compilation proofs.",
    ),
  ];
}

function checkAppConfig(): GauntletCheck[] {
  const config = readJson<AppConfig>(APP_CONFIG_PATH).expo;
  const eas = readJson<EASConfig>(EAS_CONFIG_PATH);
  const mobilePackage = readJson<MobilePackageConfig>(MOBILE_PACKAGE_PATH);
  const ciWorkflow = readFileSync(resolve(ROOT, ".github/workflows/ci.yml"), "utf8");
  const workflowText = git("ls-files", ".github/workflows")
    .split("\n")
    .filter(Boolean)
    .map((path) => readFileSync(resolve(ROOT, path), "utf8"))
    .join("\n");
  const checks: GauntletCheck[] = [];
  const podspecFloor = `'${nativeIosSupportPolicy.minimumOperatingSystem.major}.${nativeIosSupportPolicy.minimumOperatingSystem.minor}'`;
  const nativeModulesMatchFloor = NATIVE_MODULE_PODSPEC_PATHS.every(
    (path) => existsSync(path) && readFileSync(path, "utf8").includes(`:ios => ${podspecFloor}`),
  );
  checks.push(
    check(
      "ios-support-policy",
      new RegExp(`^[~^]?${nativeIosSupportPolicy.expoSdkMajor}\\.`).test(
        mobilePackage.dependencies?.expo ?? "",
        )
        && nativeIosSupportPolicy.minimumOperatingSystem.label === "iOS 16.4"
        && nativeModulesMatchFloor
        && config?.ios?.supportsTablet === nativeIosSupportPolicy.supportsTablet
        && config?.orientation === nativeIosSupportPolicy.orientation
        ? "pass"
        : "fail",
      "The native gauntlet floor must stay bound to Expo SDK 56, both iOS 16.4 native-module podspecs, iPhone hardware, portrait, and the ruled-out iPad posture.",
    ),
  );
  checks.push(
    check(
      "app-config",
      config?.scheme === "homa"
        && config.orientation === "portrait"
        && config.ios?.supportsTablet === false
        && config.runtimeVersion?.policy === "fingerprint"
        ? "pass"
        : "fail",
      "The app must declare homa://, portrait-first posture, ruled iPad support, and fingerprinted runtime compatibility.",
    ),
  );
  checks.push(
    check(
      "release-rails",
      eas.build?.production?.channel === "production"
        && eas.build.production.ios?.image === "latest"
        && typeof eas.submit?.production?.ios?.ascAppId === "string"
        ? "pass"
        : "fail",
      "Production iOS must have a named EAS channel, build image, and App Store submission target.",
    ),
  );
  checks.push(...checkAndroidCiCommands(ciWorkflow));
  const hasAndroidDistributionCommand = /\beas\s+(?:build|submit)\b[^\n]*--platform\s+(?:android|all)\b/u.test(workflowText);
  checks.push(
    check(
      "android-distribution-guard",
      !existsSync(resolve(ROOT, ".github/workflows/mobile-android-release.yml"))
        && !existsSync(resolve(ROOT, "apps/mobile/google-services.json"))
        && eas.submit?.production?.android === undefined
        && !hasAndroidDistributionCommand
        ? "pass"
        : "fail",
      "Android remains compile-only, with no EAS or Google Play production path, until the founder changes the Phase 0 disposition.",
    ),
  );
  return checks;
}

function checkRouteResidue(): GauntletCheck[] {
  const routeFiles = walk(resolve(MOBILE_ROOT, "src/app")).filter((path) => /\.(?:ts|tsx)$/u.test(path));
  const labs = routeFiles.filter((path) => /(?:lab|prototype|fixture)/iu.test(basename(path)));
  const staleManifest = nativeAccessibilitySurfaces.some(
    (surface) => surface.kind === "excluded" && !existsSync(resolve(ROOT, surface.file)),
  );
  return [
    check(
      "packaged-labs",
      labs.length === 0 ? "pass" : "fail",
      labs.length === 0
        ? "No lab, prototype, or fixture file remains under Expo Router's app tree."
        : `Packaged lab-like routes remain: ${labs.map((path) => relative(ROOT, path)).join(", ")}.`,
    ),
    check(
      "surface-registry",
      staleManifest ? "fail" : "pass",
      staleManifest ? "The native accessibility registry names a missing surface." : "Native surface registry paths resolve from a clean checkout.",
    ),
  ];
}

function checkJourneyManifest(): GauntletCheck {
  const requiredStates = ["loading", "streaming", "success", "error", "interruption", "empty", "recovery", "system-handoff"];
  const complete = nativeAccessibilityJourneys.length === 5
    && nativeAccessibilityJourneys.every((journey) =>
      journey.owners.length > 0
      && journey.surfaces.length > 0
      && requiredStates.every((state) => journey.states.includes(state as never))
      && Object.keys(journey.evidence).length === 5,
    );
  return check(
    "journey-manifest",
    complete ? "pass" : "fail",
    complete
      ? "Five priority journeys carry state and evidence dimensions without claiming physical-device proof."
      : "A priority journey is missing an owner, state, or evidence dimension.",
  );
}

export function collectStaticGauntletReport(): NativeGauntletStaticReport {
  const appConfig = readJson<AppConfig>(APP_CONFIG_PATH).expo;
  const source = allMobileText();
  const checks = [
    checkProfiles(),
    checkSettingsMatrix(),
    ...checkScenarioBindings(scenarioSourceSnapshot()),
    ...checkAppConfig(),
    ...checkRouteResidue(),
    checkJourneyManifest(),
    check(
      "design-native-projection",
      existsSync(GENERATED_NATIVE_PATH) ? "pass" : "fail",
      existsSync(GENERATED_NATIVE_PATH)
        ? "Generated React Native design projection is present."
        : "packages/design/generated/native.json is missing.",
    ),
    check(
      "native-accessibility-adapter",
      source.includes("useReducedMotion")
        && source.includes("useAccessibilityAnnouncement")
        && source.includes("SafeAreaView")
        ? "pass"
        : "fail",
      "Shared reduced-motion, announcement, and safe-area adapters must remain in the native source graph.",
    ),
  ];
  const nativeContract = existsSync(GENERATED_NATIVE_PATH)
    ? readFileSync(GENERATED_NATIVE_PATH)
    : "missing";
  const androidDisposition = appConfig?.android?.package && !existsSync(resolve(ROOT, ".github/workflows/mobile-android-release.yml"))
    ? "intentionally-unreleased"
    : "unknown";
  return {
    harnessVersion: NATIVE_GAUNTLET_VERSION,
    scope: "repository-static-contract",
    sourceCommit: git("rev-parse", "HEAD"),
    sourceFingerprint: sourceFingerprint(),
    nativeContractFingerprint: hash(nativeContract),
    androidDisposition,
    checks,
    staticContractStatus: staticContractStatusForChecks(checks),
    installedAcceptanceStatus: "not-evaluated",
    physicalDeviceAcceptanceStatus: "not-evaluated",
  };
}

function xcrun(...args: string[]): string {
  return execFileSync("xcrun", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function settingValue(device: string, setting: string): string {
  try {
    return xcrun("simctl", "ui", device, setting);
  } catch {
    return "unavailable";
  }
}

export function installedEvidenceStatus(
  checks: Readonly<Record<string, GauntletCheckStatus>>,
  assertions: Readonly<Record<string, string | null>>,
): InstalledSimulatorEvidence["status"] {
  const checkKeys = Object.keys(checks);
  const assertionKeys = Object.keys(assertions);
  const hasExactChecks = checkKeys.length === nativeInstalledRequiredCheckIds.length
    && nativeInstalledRequiredCheckIds.every(
      (id) => Object.hasOwn(checks, id)
        && (checks[id] === "pass" || checks[id] === "fail" || checks[id] === "blocked"),
    );
  const hasExactAssertions = assertionKeys.length === nativeInstalledAssertionIds.length
    && nativeInstalledAssertionIds.every(
      (id) => Object.hasOwn(assertions, id)
        && (assertions[id] === null || typeof assertions[id] === "string"),
    );
  if (!hasExactChecks || !hasExactAssertions) return "blocked";
  if (checks.installedCommand !== "pass" || checks.launchedCommand !== "pass") return "blocked";

  // This automatic runner has no authority to certify physical or manually
  // observed interactions. A future physical-device harness needs a distinct
  // evidence type rather than mutating simulator evidence into a green record.
  if (nativeInstalledManualCheckIds.some((id) => checks[id] !== "blocked")) return "blocked";

  const observedAssertions = [
    ["dynamicTypeRenderObserved", "dynamicTypeRender"],
    ["increaseContrastRenderObserved", "increaseContrastRender"],
    ["screenshotRenderObserved", "screenshotRender"],
    ["deepLinkDestinationObserved", "deepLinkDestination"],
  ] as const;
  for (const [checkId, assertionId] of observedAssertions) {
    const assertion = assertions[assertionId];
    if (checks[checkId] === "pass" && (!assertion || assertion.trim().length === 0)) {
      return "blocked";
    }
    if (checks[checkId] === "blocked" && assertion !== null) return "blocked";
  }

  // Simulator evidence remains partial by construction because the physical
  // and manual checks above are required and truthfully blocked here.
  return "partial";
}

export function createInstalledEvidence(args: {
  sourceCommit: string;
  sourceFingerprint: string;
  nativeContractFingerprint: string;
  profileId: string;
  device: SimctlDevice;
  bundleId: string;
  bundlePath: string;
  checks: Readonly<Record<NativeInstalledEvidenceCheckId, GauntletCheckStatus>>;
  assertions: Readonly<Record<NativeInstalledEvidenceAssertionId, string | null>>;
  settings: Readonly<Record<string, string>>;
  screenshotPath: string | null;
  deepLink: string;
  limitation?: string | null;
}): InstalledSimulatorEvidence {
  return {
    harnessVersion: NATIVE_GAUNTLET_VERSION,
    evidenceType: "simulator-automation",
    sourceCommit: args.sourceCommit,
    sourceFingerprint: args.sourceFingerprint,
    nativeContractFingerprint: args.nativeContractFingerprint,
    profileId: args.profileId,
    device: args.device,
    bundleId: args.bundleId,
    bundlePath: args.bundlePath,
    checks: args.checks,
    assertions: args.assertions,
    settings: args.settings,
    screenshotPath: args.screenshotPath,
    deepLink: args.deepLink,
    status: installedEvidenceStatus(args.checks, args.assertions),
    limitation: args.limitation ?? null,
  };
}

function findProfile(profileId: string): NativeGauntletProfile {
  const profile = nativeGauntletProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`Unknown native gauntlet profile: ${profileId}`);
  return profile;
}

function runInstalledEvidence(profileId: string, deviceId: string, appPath: string, outputDir: string): InstalledSimulatorEvidence {
  const profile = findProfile(profileId);
  const payload = JSON.parse(xcrun("simctl", "list", "devices", "available", "--json")) as unknown;
  const device = parseSimctlDevices(payload).find((candidate) => candidate.udid === deviceId);
  if (!device) throw new Error(`Simulator ${deviceId} is not available`);
  if (!profileMatches(device, profile)) {
    throw new Error(`Simulator ${device.name} does not match profile ${profile.id}`);
  }
  const appConfig = readJson<AppConfig>(APP_CONFIG_PATH).expo;
  const bundleId = appConfig?.ios?.bundleIdentifier ?? "com.thankshoma.homa";
  const outputPath = resolve(outputDir, profile.id);
  mkdirSync(outputPath, { recursive: true });
  const screenshotPath = resolve(outputPath, "large-text-increased-contrast.png");
  const evidencePath = resolve(outputPath, "evidence.json");
  const checks: Record<NativeInstalledEvidenceCheckId, GauntletCheckStatus> = {
    installedCommand: "fail",
    launchedCommand: "fail",
    dynamicTypeSettingCommand: "fail",
    increaseContrastSettingCommand: "fail",
    screenshotCaptureCommand: "fail",
    deepLinkOpenCommand: "fail",
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
  const assertions: Record<NativeInstalledEvidenceAssertionId, string | null> = {
    dynamicTypeRender: null,
    increaseContrastRender: null,
    screenshotRender: null,
    deepLinkDestination: null,
  };
  const settings: Record<string, string> = {};
  const deepLink = `${appConfig?.scheme ?? "homa"}://signin`;
  let limitation = "Simulator commands can install, launch, change Dynamic Type and contrast settings, capture pixels, and open a URL. They cannot assert Homa reflowed correctly, rendered the intended screen, reached the intended destination, or passed VoiceOver, Reduce Motion, Reduce Transparency, safe-area, keyboard, offline, interruption, lifecycle, and permission-return journeys.";
  const previousContentSize = settingValue(device.udid, "content_size");
  const previousContrast = settingValue(device.udid, "increase_contrast");
  try {
    xcrun("simctl", "install", device.udid, appPath);
    checks.installedCommand = "pass";
    try {
      xcrun("simctl", "launch", device.udid, bundleId);
      checks.launchedCommand = "pass";
      // Expo's release bundle still needs a short cold-start window before
      // the first product surface is rendered. Without this wait the capture
      // can prove only the launch splash, not the signed-out route.
      execFileSync("sleep", ["8"]);
    } catch {
      limitation = `${limitation} The installed app did not launch cleanly.`;
    }
    try {
      xcrun("simctl", "ui", device.udid, "content_size", "accessibility-extra-extra-extra-large");
      settings.contentSize = settingValue(device.udid, "content_size");
      checks.dynamicTypeSettingCommand = settings.contentSize.includes("accessibility-extra-extra-extra-large") ? "pass" : "fail";
    } catch {
      settings.contentSize = "unavailable";
    }
    try {
      xcrun("simctl", "ui", device.udid, "increase_contrast", "enabled");
      settings.increaseContrast = settingValue(device.udid, "increase_contrast");
      checks.increaseContrastSettingCommand = settings.increaseContrast === "enabled" ? "pass" : "fail";
    } catch {
      settings.increaseContrast = "unavailable";
    }
    // Capture the rendered app before opening the custom-scheme link. On a
    // clean simulator, iOS may show an "Open in Homa?" confirmation sheet
    // for the link, which would make the screenshot prove the system sheet
    // rather than the product surface. The deep-link operation is still
    // checked independently below.
    try {
      xcrun("simctl", "io", device.udid, "screenshot", screenshotPath);
      checks.screenshotCaptureCommand = existsSync(screenshotPath) ? "pass" : "fail";
    } catch {
      checks.screenshotCaptureCommand = "fail";
    }
    try {
      xcrun("simctl", "openurl", device.udid, deepLink);
      checks.deepLinkOpenCommand = "pass";
      settings.deepLink = deepLink;
    } catch {
      settings.deepLink = "unavailable";
    }
  } finally {
    try {
      if (previousContentSize !== "unavailable" && previousContentSize !== "unknown") {
        xcrun("simctl", "ui", device.udid, "content_size", previousContentSize);
      }
    } catch { /* best effort restore */ }
    try {
      if (previousContrast === "enabled" || previousContrast === "disabled") {
        xcrun("simctl", "ui", device.udid, "increase_contrast", previousContrast);
      }
    } catch { /* best effort restore */ }
  }
  const evidence = createInstalledEvidence({
    sourceCommit: git("rev-parse", "HEAD"),
    sourceFingerprint: sourceFingerprint(),
    nativeContractFingerprint: hash(readFileSync(GENERATED_NATIVE_PATH)),
    profileId: profile.id,
    device,
    bundleId,
    bundlePath: appPath,
    checks,
    assertions,
    settings,
    screenshotPath: existsSync(screenshotPath) ? screenshotPath : null,
    deepLink,
    limitation,
  });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

function printChecks(checks: readonly GauntletCheck[]): void {
  for (const item of checks) console.log(`${item.status.toUpperCase()} ${item.id}: ${item.detail}`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const staticReport = collectStaticGauntletReport();
  printChecks(staticReport.checks);
  console.log(JSON.stringify({
    harnessVersion: staticReport.harnessVersion,
    scope: staticReport.scope,
    sourceCommit: staticReport.sourceCommit,
    sourceFingerprint: staticReport.sourceFingerprint,
    nativeContractFingerprint: staticReport.nativeContractFingerprint,
    androidDisposition: staticReport.androidDisposition,
    staticContractStatus: staticReport.staticContractStatus,
    installedAcceptanceStatus: staticReport.installedAcceptanceStatus,
    physicalDeviceAcceptanceStatus: staticReport.physicalDeviceAcceptanceStatus,
  }, null, 2));
  if (staticReport.staticContractStatus === "invalid") process.exitCode = 1;

  const profileId = argv.find((arg) => arg.startsWith("--profile="))?.slice("--profile=".length);
  const deviceId = argv.find((arg) => arg.startsWith("--device="))?.slice("--device=".length);
  const appPath = argv.find((arg) => arg.startsWith("--app="))?.slice("--app=".length);
  if (profileId || deviceId || appPath) {
    if (!profileId || !deviceId || !appPath) throw new Error("Installed evidence requires --profile, --device, and --app");
    const outputDir = argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length) ?? DEFAULT_OUTPUT;
    const evidence = runInstalledEvidence(profileId, deviceId, appPath, outputDir);
    console.log(JSON.stringify(evidence, null, 2));
    if (evidence.status === "blocked") process.exitCode = 1;
  }
  if (argv.includes("--strict") && staticReport.staticContractStatus !== "valid") process.exitCode = 1;
}

if (process.argv[1]?.endsWith("native-interface-gauntlet.mts")) await main();
