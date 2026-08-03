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
  NATIVE_GAUNTLET_VERSION,
  type NativeGauntletProfile,
  type NativeGauntletSettingId,
} from "../apps/mobile/src/lib/accessibility/gauntlet-contract";
import {
  nativeAccessibilityJourneys,
  nativeAccessibilitySurfaces,
} from "../apps/mobile/src/lib/accessibility/acceptance-manifest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE_ROOT = resolve(ROOT, "apps/mobile");
const APP_CONFIG_PATH = resolve(MOBILE_ROOT, "app.json");
const EAS_CONFIG_PATH = resolve(MOBILE_ROOT, "eas.json");
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
  sourceCommit: string;
  sourceFingerprint: string;
  nativeContractFingerprint: string;
  androidDisposition: "intentionally-unreleased" | "supported" | "retired" | "unknown";
  checks: readonly GauntletCheck[];
  status: "pass" | "fail";
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
  sourceCommit: string;
  sourceFingerprint: string;
  nativeContractFingerprint: string;
  profileId: string;
  device: SimctlDevice;
  bundleId: string;
  bundlePath: string;
  checks: Readonly<Record<string, GauntletCheckStatus>>;
  settings: Readonly<Record<string, string>>;
  screenshotPath: string | null;
  deepLink: string;
  status: "pass" | "partial" | "blocked";
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
  submit?: { production?: { ios?: { ascAppId?: string } } };
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
  return profile.runtimeFamilies.some((runtime) => device.runtime.startsWith(runtime));
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

function allMobileText(): string {
  return sourceFiles().map((path) => readFileSync(path, "utf8")).join("\n");
}

function hasMarker(text: string, marker: string): boolean {
  return text.includes(marker);
}

function checkProfiles(): GauntletCheck {
  const ids = nativeGauntletProfiles.map((profile) => profile.id);
  const expected = [
    "iphone-oldest-supported",
    "iphone-current",
    "ipad-portrait-ruled",
    "ipad-landscape-ruled",
    "android-compile-guard",
  ];
  const complete = expected.every((id) => ids.includes(id))
    && new Set(ids).size === ids.length
    && nativeGauntletProfiles.some((profile) => profile.support === "required" && profile.kind === "iphone")
    && nativeGauntletProfiles.some((profile) => profile.support === "ruled-out" && profile.orientation === "landscape" && profile.kind === "ipad")
    && nativeGauntletProfiles.some((profile) => profile.support === "compile-only" && profile.kind === "android");
  return check(
    "profile-matrix",
    complete ? "pass" : "fail",
    complete
      ? "Oldest/current iPhone, ruled iPad orientations, and Android compile disposition are explicit."
      : "The native profile matrix is incomplete or duplicated.",
  );
}

function checkSettings(): GauntletCheck {
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
  const ids = nativeGauntletSettings.map((setting) => setting.id);
  const complete = expected.every((id) => ids.includes(id))
    && new Set(ids).size === ids.length
    && nativeGauntletSettings.every((setting) => setting.required && setting.truthBoundary.length > 0);
  return check(
    "settings-matrix",
    complete ? "pass" : "fail",
    complete
      ? "Dynamic Type, VoiceOver, motion, transparency, contrast, safe-area, keyboard, offline, interruption, lifecycle, deep-link, and permissions have named proof boundaries."
      : "The required native settings matrix is incomplete or duplicated.",
  );
}

function checkScenarios(text: string): GauntletCheck[] {
  return nativeGauntletStateScenarios.map((scenario) => {
    const missing = scenario.requiredMarkers.filter((marker) => !hasMarker(text, marker));
    return check(
      `scenario:${scenario.id}`,
      missing.length === 0 ? "pass" : "fail",
      missing.length === 0
        ? `${scenario.setting} has source markers for ${scenario.surfaces.join(", ")}.`
        : `${scenario.setting} is missing source markers: ${missing.join(", ")}.`,
    );
  });
}

function checkAppConfig(): GauntletCheck[] {
  const config = readJson<AppConfig>(APP_CONFIG_PATH).expo;
  const eas = readJson<EASConfig>(EAS_CONFIG_PATH);
  const checks: GauntletCheck[] = [];
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
  checks.push(
    check(
      "android-distribution-guard",
      !existsSync(resolve(ROOT, ".github/workflows/mobile-android-release.yml"))
        ? "pass"
        : "fail",
      "Android remains compile-only until the founder changes the Phase 0 disposition.",
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
    checkSettings(),
    ...checkScenarios(source),
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
    sourceCommit: git("rev-parse", "HEAD"),
    sourceFingerprint: sourceFingerprint(),
    nativeContractFingerprint: hash(nativeContract),
    androidDisposition,
    checks,
    status: checks.every((item) => item.status === "pass") ? "pass" : "fail",
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
): InstalledSimulatorEvidence["status"] {
  if (checks.installed !== "pass" || checks.launched !== "pass") return "blocked";
  const verified = ["installed", "launched", "dynamicType", "increaseContrast", "screenshot", "deepLink"]
    .every((key) => checks[key] === "pass");
  if (!verified) return "partial";
  const unresolved = [
    "safeArea",
    "voiceOver",
    "reduceMotion",
    "reduceTransparency",
    "transparency",
    "keyboard",
    "offline",
    "interruption",
    "backgroundForeground",
    "permissions",
  ].some((key) => checks[key] === "blocked");
  return unresolved ? "partial" : "pass";
}

export function createInstalledEvidence(args: {
  sourceCommit: string;
  sourceFingerprint: string;
  nativeContractFingerprint: string;
  profileId: string;
  device: SimctlDevice;
  bundleId: string;
  bundlePath: string;
  checks: Readonly<Record<string, GauntletCheckStatus>>;
  settings: Readonly<Record<string, string>>;
  screenshotPath: string | null;
  deepLink: string;
  limitation?: string | null;
}): InstalledSimulatorEvidence {
  return {
    harnessVersion: NATIVE_GAUNTLET_VERSION,
    sourceCommit: args.sourceCommit,
    sourceFingerprint: args.sourceFingerprint,
    nativeContractFingerprint: args.nativeContractFingerprint,
    profileId: args.profileId,
    device: args.device,
    bundleId: args.bundleId,
    bundlePath: args.bundlePath,
    checks: args.checks,
    settings: args.settings,
    screenshotPath: args.screenshotPath,
    deepLink: args.deepLink,
    status: installedEvidenceStatus(args.checks),
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
  const checks: Record<string, GauntletCheckStatus> = {
    installed: "fail",
    launched: "fail",
    dynamicType: "fail",
    increaseContrast: "fail",
    screenshot: "fail",
    deepLink: "fail",
    safeArea: "blocked",
    voiceOver: "blocked",
    reduceMotion: "blocked",
    reduceTransparency: "blocked",
    transparency: "blocked",
    keyboard: "blocked",
    offline: "blocked",
    interruption: "blocked",
    backgroundForeground: "blocked",
    permissions: "blocked",
  };
  const settings: Record<string, string> = {};
  const deepLink = `${appConfig?.scheme ?? "homa"}://signin`;
  let limitation = "VoiceOver, Reduce Motion, Reduce Transparency, safe-area, keyboard, offline, interruption, lifecycle, and permission-return checks require a real accessibility or interaction session; simctl does not expose those controls as deterministic CLI operations.";
  const previousContentSize = settingValue(device.udid, "content_size");
  const previousContrast = settingValue(device.udid, "increase_contrast");
  try {
    xcrun("simctl", "install", device.udid, appPath);
    checks.installed = "pass";
    try {
      xcrun("simctl", "launch", device.udid, bundleId);
      checks.launched = "pass";
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
      checks.dynamicType = settings.contentSize.includes("accessibility-extra-extra-extra-large") ? "pass" : "fail";
    } catch {
      settings.contentSize = "unavailable";
    }
    try {
      xcrun("simctl", "ui", device.udid, "increase_contrast", "enabled");
      settings.increaseContrast = settingValue(device.udid, "increase_contrast");
      checks.increaseContrast = settings.increaseContrast === "enabled" ? "pass" : "fail";
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
      checks.screenshot = existsSync(screenshotPath) ? "pass" : "fail";
    } catch {
      checks.screenshot = "fail";
    }
    try {
      xcrun("simctl", "openurl", device.udid, deepLink);
      checks.deepLink = "pass";
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
    sourceCommit: staticReport.sourceCommit,
    sourceFingerprint: staticReport.sourceFingerprint,
    nativeContractFingerprint: staticReport.nativeContractFingerprint,
    androidDisposition: staticReport.androidDisposition,
    status: staticReport.status,
  }, null, 2));
  if (staticReport.status === "fail") process.exitCode = 1;

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
  if (argv.includes("--strict") && staticReport.status !== "pass") process.exitCode = 1;
}

if (process.argv[1]?.endsWith("native-interface-gauntlet.mts")) await main();
