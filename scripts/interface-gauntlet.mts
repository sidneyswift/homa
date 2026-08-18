import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_MANIFEST_SCHEMA_VERSION, type BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const FIXTURE_GALLERY_PATH = resolve(ROOT, "docs/homa-design/evidence/fixture-gallery.json");
const DESIGN_CSS_PATH = resolve(ROOT, "apps/web/components/design/quiet-primitives.css");
const GENERATED_WEB_CSS_PATH = resolve(ROOT, "packages/design/generated/web.css");

export const GAUNTLET_VIEWPORTS = [
  { name: "phone-small", width: 320, height: 800 },
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

export const GAUNTLET_REFLOW_VIEWPORTS = [
  { name: "reflow-200", width: 640, height: 900, zoom: 2 },
  { name: "reflow-400", width: 320, height: 900, zoom: 4 },
] as const;

export const GAUNTLET_PERFORMANCE_BUDGET = {
  domContentLoadedMs: 4_000,
  transferBytes: 5_000_000,
} as const;

export const GAUNTLET_READ_ONLY_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export const GAUNTLET_LONG_COPY =
  "Alexandria-Wilhelmina van der Meer and the curious learning community";

/** Next.js development chrome is not a product control and must not enter the focus walk. */
export const GAUNTLET_FOCUSABLE_SELECTOR =
  'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]):not(nextjs-portal):not(next-route-announcer)';
export const GAUNTLET_IGNORED_FOCUS_TAGS = ["nextjs-portal", "next-route-announcer"] as const;

export const GAUNTLET_ROUTES = [
  { path: "/", requiredMarkers: ["quiet-landing", "quiet-nav", "quiet-footer"] },
  { path: "/signin", requiredMarkers: ["quiet-auth-shell", "quiet-frame"] },
  { path: "/onboarding", requiredMarkers: ["quiet-nav", "quiet-footer", "quiet-action"] },
  { path: "/design/quiet-authority", requiredMarkers: ["quiet-fixture", "quiet-frame", "quiet-action", "quiet-status", "quiet-authenticated-context-v1"] },
] as const;

export const GAUNTLET_ROUTE_MANIFEST_PATHS = [
  ["/", "apps/web/app/page.tsx"],
  ["/signin", "apps/web/app/signin/page.tsx"],
  ["/onboarding", "apps/web/app/onboarding/page.tsx"],
  ["/design/quiet-authority", "apps/web/app/design/quiet-authority/page.tsx"],
] as const;

/**
 * The web adapter is larger than the five shell primitives used by the first
 * gauntlet pass. Keep this list aligned with the design contract's fixture
 * gallery so a new primitive cannot ship without a deterministic specimen
 * and a surface-manifest row.
 */
export const GAUNTLET_WEB_PRIMITIVES = [
  ["web-quiet-action", "apps/web/components/design/QuietAction.tsx"],
  ["web-quiet-choice", "apps/web/components/design/QuietChoice.tsx"],
  ["web-quiet-feedback", "apps/web/components/design/QuietFeedback.tsx"],
  ["web-quiet-field", "apps/web/components/design/QuietField.tsx"],
  ["web-quiet-frame", "apps/web/components/design/QuietFrame.tsx"],
  ["web-quiet-identity", "apps/web/components/design/QuietIdentity.tsx"],
  ["web-quiet-media", "apps/web/components/design/QuietMedia.tsx"],
  ["web-quiet-nav", "apps/web/components/design/QuietNav.tsx"],
  ["web-quiet-footer", "apps/web/components/design/QuietFooter.tsx"],
  ["web-quiet-status", "apps/web/components/design/QuietStatus.tsx"],
  ["web-quiet-thread", "apps/web/components/design/QuietThread.tsx"],
  ["web-semantic-icon", "apps/web/components/design/Icon.tsx"],
] as const;

export const GAUNTLET_FIXTURE_PRIMITIVE_STATES = [
  ["web-quiet-action", ["default", "primary", "secondary", "disabled", "focus", "pressed", "retry"]],
  ["web-quiet-choice", ["selected", "success", "disabled", "focus"]],
  ["web-quiet-feedback", ["error", "loading", "alert", "retry"]],
  ["web-quiet-field", ["error", "disabled", "readonly", "focus"]],
  ["web-quiet-frame", ["paper", "contained"]],
  ["web-quiet-identity", ["full", "mark"]],
  ["web-quiet-media", ["loading", "empty", "artifact"]],
  ["web-quiet-nav", ["rest", "focus", "menu"]],
  ["web-quiet-footer", ["rest", "focus", "links"]],
  ["web-quiet-status", ["constructive", "error", "rest"]],
  ["web-quiet-thread", ["draw", "land", "still", "reduced-motion"]],
  ["web-semantic-icon", ["decorative", "labeled"]],
] as const;

/**
 * Two real consumers are the minimum extraction proof: public acquisition
 * and signed-in family work. These are production components, not the
 * approval fixture or unit tests, so route-local clones cannot satisfy the
 * requirement by existing only in the gallery.
 */
export const GAUNTLET_REAL_PRIMITIVE_CONSUMERS = [
  [
    "apps/web/components/marketing/QuietLanding.tsx",
    ["QuietAction", "QuietFrame", "QuietFooter"],
  ],
  ["apps/web/components/dashboard/sidebar.tsx", ["QuietFrame"]],
  ["apps/web/components/dashboard/account-menu.tsx", ["QuietAction"]],
  ["apps/web/components/dashboard/context-switcher.tsx", ["QuietStatus"]],
] as const;

type GauntletIssue = {
  check: string;
  detail: string;
};

export type StaticGauntletReport = {
  harnessVersion: "interface-gauntlet-v2";
  contract: "quiet-authority-v1";
  manifestFingerprint: string;
  routeCount: number;
  issues: GauntletIssue[];
  status: "pass" | "fail";
};

export type RenderedRouteResult = {
  path: string;
  viewport: string;
  status: number | null;
  markers: string[];
  reducedMotion: boolean;
  forcedColors: boolean;
  focus: FocusEvidence;
  axe: AxeEvidence;
  reflow: ReflowEvidence[];
  longCopy: LayoutEvidence;
  recovery: RecoveryEvidence;
  performance: PerformanceEvidence;
  networkGuard: NetworkGuardEvidence;
  screenshotPath: string;
  issues: GauntletIssue[];
};

export type BlockedMutationEvidence = {
  method: string;
  origin: string;
  path: string;
};

export type NetworkGuardEvidence = {
  mode: "read-only";
  blockedMutationCount: number;
  blockedMutations: BlockedMutationEvidence[];
};

export type FocusEvidence = {
  focusableCount: number;
  visitedCount: number;
  visibleFocusCount: number;
  escapedCount: number;
};

export type AxeEvidence = {
  available: boolean;
  violations: Array<{ id: string; impact: string | null; nodes: number }>;
};

export type LayoutEvidence = {
  horizontalOverflow: number;
  outOfBoundsCount: number;
};

export type ReflowEvidence = LayoutEvidence & {
  viewport: string;
  zoom: number;
};

export type RecoveryEvidence = {
  offlineSignal: boolean;
  offlineRequestFailed: boolean;
  restoredOnline: boolean;
  onlineRequestSucceeded: boolean;
  errorStateCount: number;
  retryControlCount: number;
};

export type PerformanceEvidence = {
  domContentLoadedMs: number | null;
  transferBytes: number;
};

export function shouldBlockGauntletRequest(method: string): boolean {
  const normalizedMethod = method.trim().toUpperCase();
  return !(GAUNTLET_READ_ONLY_METHODS as readonly string[]).includes(normalizedMethod);
}

function blockedMutationEvidence(method: string, requestUrl: string): BlockedMutationEvidence {
  try {
    const url = new URL(requestUrl);
    return { method: method.toUpperCase(), origin: url.origin, path: url.pathname };
  } catch {
    return { method: method.toUpperCase(), origin: "invalid-url", path: requestUrl.slice(0, 200) };
  }
}

export async function installReadOnlyGauntletNetworkGuard(
  context: any,
  blockedMutations: BlockedMutationEvidence[],
): Promise<void> {
  await context.route("**/*", async (route: any) => {
    const request = route.request();
    const method = request.method();
    if (shouldBlockGauntletRequest(method)) {
      blockedMutations.push(blockedMutationEvidence(method, request.url()));
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

function loadManifest(): BrandSurfaceManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as BrandSurfaceManifest;
}

function hasTrackedSurface(manifest: BrandSurfaceManifest, path: string): boolean {
  return manifest.surfaces.some((surface) => surface.paths.includes(path));
}

type FixtureGallery = {
  categories?: {
    primitives?: Array<{
      id?: string;
      source?: string;
      evidenceStatus?: string;
      checksum?: string;
    }>;
  };
};

function primitiveContractIssues(manifest: BrandSurfaceManifest): GauntletIssue[] {
  const issues: GauntletIssue[] = [];
  let gallery: FixtureGallery;
  try {
    gallery = JSON.parse(readFileSync(FIXTURE_GALLERY_PATH, "utf8")) as FixtureGallery;
  } catch {
    return [{ check: "primitive-fixture-gallery", detail: "fixture-gallery.json is missing or invalid" }];
  }

  const fixtures = new Map((gallery.categories?.primitives ?? []).map((fixture) => [fixture.id, fixture]));
  for (const [id, source] of GAUNTLET_WEB_PRIMITIVES) {
    if (!existsSync(resolve(ROOT, source))) {
      issues.push({ check: "primitive-source", detail: `${source} is missing` });
    }
    if (!hasTrackedSurface(manifest, source)) {
      issues.push({ check: "primitive-manifest", detail: `${source} is not classified in the manifest` });
    }
    const fixture = fixtures.get(id);
    if (!fixture || fixture.source !== source) {
      issues.push({ check: "primitive-fixture", detail: `${id} does not point at ${source}` });
    } else {
      if (fixture.evidenceStatus !== "contract-only") {
        issues.push({ check: "primitive-fixture-state", detail: `${id} must remain contract-only until rendered or device evidence is accepted` });
      }
      if (!/^[0-9a-f]{64}$/u.test(fixture.checksum ?? "")) {
        issues.push({ check: "primitive-fixture-checksum", detail: `${id} has no valid checksum` });
      }
    }
  }
  return issues;
}

function fixtureRouteContractIssues(): GauntletIssue[] {
  const source = readFileSync(resolve(ROOT, "apps/web/app/design/quiet-authority/page.tsx"), "utf8");
  const markers = [...source.matchAll(/data-gauntlet-primitive="([^"]+)"/gu)].flatMap((match) => match[1]!.split(/\s+/u));
  const states = [...source.matchAll(/data-gauntlet-states="([^"]+)"/gu)].flatMap((match) => match[1]!.split(","));
  const issues: GauntletIssue[] = [];
  for (const [id, requiredStates] of GAUNTLET_FIXTURE_PRIMITIVE_STATES) {
    if (!markers.includes(id)) issues.push({ check: "fixture-primitive-marker", detail: `${id} has no explicit data-gauntlet-primitive marker` });
    for (const state of requiredStates) {
      if (!states.includes(state)) issues.push({ check: "fixture-primitive-state", detail: `${id} has no ${state} state marker` });
    }
  }
  return issues;
}

function realPrimitiveConsumerIssues(): GauntletIssue[] {
  const issues: GauntletIssue[] = [];
  for (const [source, primitiveNames] of GAUNTLET_REAL_PRIMITIVE_CONSUMERS) {
    const absolutePath = resolve(ROOT, source);
    if (!existsSync(absolutePath)) {
      issues.push({ check: "primitive-consumer", detail: `${source} is missing` });
      continue;
    }
    const contents = readFileSync(absolutePath, "utf8");
    for (const primitiveName of primitiveNames) {
      if (!new RegExp(`\\b${primitiveName}\\b`, "u").test(contents)) {
        issues.push({ check: "primitive-consumer", detail: `${source} no longer consumes ${primitiveName}` });
      }
    }
  }
  return issues;
}

function webTokenProjectionIssues(): GauntletIssue[] {
  const issues: GauntletIssue[] = [];
  let generatedCss: string;
  try {
    generatedCss = readFileSync(GENERATED_WEB_CSS_PATH, "utf8");
  } catch {
    return [{ check: "web-token-projection", detail: "generated web.css is missing or unreadable" }];
  }
  const definitions = new Set([...generatedCss.matchAll(/--(homa-[a-z0-9-]+)\s*:/gu)].map((match) => match[1]));
  for (const alias of ["homa-muted-ink", "homa-soft-boundary"]) {
    if (!definitions.has(alias)) issues.push({ check: "web-token-projection", detail: `generated web.css does not define --${alias}` });
  }
  const landingSource = readFileSync(resolve(ROOT, "apps/web/components/marketing/QuietLanding.tsx"), "utf8");
  if (/\.quiet-landing\s*\{[^}]*--homa-(?:muted-ink|soft-boundary)\s*:/su.test(landingSource)) {
    issues.push({ check: "web-token-scope", detail: "derived Quiet tokens must not be scoped only to QuietLanding" });
  }
  let trackedPaths: string[] = [];
  try {
    trackedPaths = execFileSync("git", ["ls-files", "apps/web"], { cwd: ROOT }).toString("utf8").split("\n").filter(Boolean);
  } catch {
    issues.push({ check: "web-token-scan", detail: "could not enumerate tracked web source files" });
    return issues;
  }
  for (const path of trackedPaths.filter((candidate) => /\.(?:css|ts|tsx)$/u.test(candidate))) {
    const source = readFileSync(resolve(ROOT, path), "utf8");
    for (const match of source.matchAll(/var\(\s*--(homa-[a-z0-9-]+)/gu)) {
      const token = match[1];
      if (!definitions.has(token)) issues.push({ check: "web-token-undefined", detail: `${path} references undefined --${token}` });
    }
  }
  return issues;
}

function routeIssues(manifest: BrandSurfaceManifest): GauntletIssue[] {
  const issues: GauntletIssue[] = [];
  for (const [route, source] of GAUNTLET_ROUTE_MANIFEST_PATHS) {
    if (!manifest.surfaces.some((surface) => surface.type === "route" && surface.paths.includes(source))) {
      issues.push({ check: "manifest-route-coverage", detail: `${route} is not represented by the exact route source ${source}` });
    }
  }
  return issues;
}

function criticalSurfaceIssues(manifest: BrandSurfaceManifest): GauntletIssue[] {
  const issues: GauntletIssue[] = [];
  for (const surface of manifest.surfaces.filter((candidate) => candidate.criticality === "journey-critical")) {
    if (surface.approvedTarget !== "quiet-authority-v1") {
      issues.push({ check: "approved-target", detail: `${surface.id} is not bound to quiet-authority-v1` });
    }
    if (!surface.requiredStates.includes("default")) {
      issues.push({ check: "default-state", detail: `${surface.id} has no default state` });
    }
    if (surface.legacySignatures.length > 0 && surface.rolloutState === "production-accepted") {
      issues.push({ check: "accepted-legacy", detail: `${surface.id} is production-accepted while still carrying legacy signatures` });
    }
  }
  return issues;
}

export function collectStaticGauntletReport(): StaticGauntletReport {
  const manifest = loadManifest();
  const issues: GauntletIssue[] = [];
  if (manifest.schemaVersion !== BRAND_MANIFEST_SCHEMA_VERSION) issues.push({ check: "manifest-schema", detail: `unsupported schema ${manifest.schemaVersion}` });
  if (manifest.designEra !== "quiet-authority-v1") issues.push({ check: "design-era", detail: `manifest is ${manifest.designEra}` });
  if (!existsSync(DESIGN_CSS_PATH)) issues.push({ check: "primitive-css", detail: "quiet-primitives.css is missing" });
  else {
    const css = readFileSync(DESIGN_CSS_PATH, "utf8");
    if (!css.includes("prefers-reduced-motion")) issues.push({ check: "reduced-motion", detail: "web primitives have no Reduced Motion endpoint" });
    if (!css.includes("forced-colors: active")) issues.push({ check: "forced-colors", detail: "web primitives have no Forced Colors endpoint" });
    if (!css.includes(":focus-visible")) issues.push({ check: "focus-visible", detail: "web primitives have no visible keyboard focus endpoint" });
    if (!css.includes("--homa-")) issues.push({ check: "semantic-tokens", detail: "web primitives do not reference generated Homa tokens" });
    for (const selector of [
      ".quiet-action",
      ".quiet-field",
      ".quiet-choice",
      ".quiet-feedback",
      ".quiet-frame",
      ".quiet-identity",
      ".quiet-media",
      ".quiet-nav",
      ".quiet-footer",
      ".quiet-status",
      ".quiet-thread",
    ]) {
      if (!css.includes(selector)) issues.push({ check: "primitive-css-selector", detail: `${selector} has no CSS adapter` });
    }
    for (const stateHook of [":hover", ":active", ":focus-visible", ":disabled", "data-selected", "data-state=\"error\""]) {
      if (!css.includes(stateHook)) issues.push({ check: "primitive-css-state", detail: `${stateHook} has no CSS endpoint` });
    }
  }
  issues.push(...primitiveContractIssues(manifest), ...fixtureRouteContractIssues(), ...realPrimitiveConsumerIssues(), ...webTokenProjectionIssues(), ...routeIssues(manifest), ...criticalSurfaceIssues(manifest));
  return {
    harnessVersion: "interface-gauntlet-v2",
    contract: "quiet-authority-v1",
    manifestFingerprint: manifest.ownedInputFingerprint,
    routeCount: GAUNTLET_ROUTES.length,
    issues,
    status: issues.length === 0 ? "pass" : "fail",
  };
}

function markerList(html: string): string[] {
  return [...html.matchAll(/(?:data-brand-fixture|class)=["']([^"']+)["']/g)]
    .flatMap((match) => match[1]!.split(/\s+/))
    .filter((value) => value.startsWith("quiet-"))
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
}

export async function runRenderedGauntlet(baseUrl: string, outputDir: string): Promise<RenderedRouteResult[]> {
  const requireFromWeb = createRequire(resolve(ROOT, "apps/web/package.json"));
  const { chromium } = requireFromWeb("@playwright/test") as { chromium: { launch: (options: { headless: boolean }) => Promise<any> } };
  const requireFromRoot = createRequire(resolve(ROOT, "package.json"));
  const axePath = (() => {
    try {
      return requireFromRoot.resolve("axe-core/axe.min.js");
    } catch {
      return null;
    }
  })();
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results: RenderedRouteResult[] = [];
  try {
    for (const route of GAUNTLET_ROUTES) {
      for (const viewport of GAUNTLET_VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        const blockedMutations: BlockedMutationEvidence[] = [];
        await installReadOnlyGauntletNetworkGuard(context, blockedMutations);
        const page = await context.newPage();
        const issues: GauntletIssue[] = [];
        const response = await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
        const html = await page.content();
        const markers = markerList(html);
        const missingMarkers = route.requiredMarkers.filter((marker) => !markers.includes(marker));
        if (response === null || response.status() >= 400) issues.push({ check: "http-status", detail: `${route.path} returned ${response?.status() ?? "no response"}` });
        for (const marker of missingMarkers) issues.push({ check: "route-marker", detail: `${route.path} is missing ${marker}` });
        if (route.path === "/design/quiet-authority") {
          const fixtureEvidence = await page.locator("[data-gauntlet-primitive]").evaluateAll((elements) => {
            const stateMap = new Map<string, Set<string>>();
            for (const element of elements) {
              const ids = (element.getAttribute("data-gauntlet-primitive") ?? "").split(/\s+/u).filter(Boolean);
              const states = (element.getAttribute("data-gauntlet-states") ?? "").split(",").map((state) => state.trim()).filter(Boolean);
              for (const id of ids) {
                const existing = stateMap.get(id) ?? new Set<string>();
                for (const state of states) existing.add(state);
                stateMap.set(id, existing);
              }
            }
            return [...stateMap.entries()].map(([id, states]) => [id, [...states]] as const);
          });
          const observed = new Map(fixtureEvidence.map(([id, states]) => [id, new Set(states)]));
          for (const [id, requiredStates] of GAUNTLET_FIXTURE_PRIMITIVE_STATES) {
            const actualStates = observed.get(id);
            if (!actualStates) {
              issues.push({ check: "fixture-primitive-rendered", detail: `${route.path} did not render ${id}` });
              continue;
            }
            for (const state of requiredStates) {
              if (!actualStates.has(state)) issues.push({ check: "fixture-state-rendered", detail: `${route.path} did not render ${id}:${state}` });
            }
          }
        }
        const timing = await page.evaluate(() => {
          const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
          const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
          return {
            domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
            transferBytes: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), navigation?.transferSize || 0),
          };
        });
        const performanceEvidence: PerformanceEvidence = {
          domContentLoadedMs: timing.domContentLoadedMs,
          transferBytes: timing.transferBytes,
        };
        if (performanceEvidence.domContentLoadedMs !== null && performanceEvidence.domContentLoadedMs > GAUNTLET_PERFORMANCE_BUDGET.domContentLoadedMs) {
          issues.push({ check: "performance-dom-content-loaded", detail: `${route.path} took ${Math.round(performanceEvidence.domContentLoadedMs)}ms (budget ${GAUNTLET_PERFORMANCE_BUDGET.domContentLoadedMs}ms)` });
        }
        if (performanceEvidence.transferBytes > GAUNTLET_PERFORMANCE_BUDGET.transferBytes) {
          issues.push({ check: "performance-transfer", detail: `${route.path} transferred ${performanceEvidence.transferBytes} bytes (budget ${GAUNTLET_PERFORMANCE_BUDGET.transferBytes})` });
        }

        const focus = await collectFocusEvidence(page, issues, route.path);

        const axe = await collectAxeEvidence(page, axePath, issues, route.path);

        await page.emulateMedia({ reducedMotion: "reduce" });
        const reducedMotion = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        if (!reducedMotion) issues.push({ check: "reduced-motion-context", detail: `${route.path} did not expose the reduced-motion media query` });

        await page.emulateMedia({ forcedColors: "active" });
        const forcedColors = await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches);
        if (!forcedColors) issues.push({ check: "forced-colors-context", detail: `${route.path} did not expose the forced-colors media query` });
        await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });

        const reflow = await collectReflowEvidence(browser, baseUrl, route.path, issues, blockedMutations);
        const longCopy = await collectLongCopyEvidence(page, issues, route.path);
        const recovery = await collectRecoveryEvidence(context, page, issues, route.path);
        const screenshotPath = resolve(outputDir, `${route.path === "/" ? "home" : route.path.slice(1).replaceAll("/", "-")}-${viewport.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await context.close();
        const networkGuard: NetworkGuardEvidence = {
          mode: "read-only",
          blockedMutationCount: blockedMutations.length,
          blockedMutations,
        };
        results.push({ path: route.path, viewport: viewport.name, status: response?.status() ?? null, markers, reducedMotion, forcedColors, focus, axe, reflow, longCopy, recovery, performance: performanceEvidence, networkGuard, screenshotPath, issues });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function collectAxeEvidence(page: any, axePath: string | null, issues: GauntletIssue[], path: string): Promise<AxeEvidence> {
  if (!axePath) {
    issues.push({ check: "axe-availability", detail: "axe-core is not installed; install the root dev dependency before rendered audits" });
    return { available: false, violations: [] };
  }
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    const axeApi = (globalThis as typeof globalThis & { axe?: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: unknown[] }> }> } }).axe;
    if (!axeApi) return null;
    return axeApi.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
  });
  if (!result) {
    issues.push({ check: "axe-availability", detail: `${path} could not initialize axe-core` });
    return { available: false, violations: [] };
  }
  const violations = result.violations.map((violation: { id: string; impact: string | null; nodes: unknown[] }) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
  for (const violation of violations) issues.push({ check: `axe-${violation.id}`, detail: `${path} has ${violation.nodes} ${violation.impact ?? "unscoped"} violation node(s)` });
  return { available: true, violations };
}

async function collectFocusEvidence(page: any, issues: GauntletIssue[], path: string): Promise<FocusEvidence> {
  const focusableCount = await page.locator(GAUNTLET_FOCUSABLE_SELECTOR).count();
  const visited = new Set<string>();
  let visibleFocusCount = 0;
  let escapedCount = 0;
  let visitedControls = 0;
  let attempts = 0;
  while (visitedControls < Math.min(focusableCount, 80) && attempts < 100) {
    await page.keyboard.press("Tab");
    attempts += 1;
    const state = await page.evaluate(({ tabIndex, ignoredTags }: { tabIndex: number; ignoredTags: readonly string[] }) => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return { key: "none", visible: false, escaped: true, ignored: false };
      if (ignoredTags.includes(element.tagName.toLowerCase())) return { key: "ignored", visible: false, escaped: false, ignored: true };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible = element.matches(":focus-visible") || style.outlineStyle !== "none" || style.outlineWidth !== "0px" || style.boxShadow !== "none";
      return { key: `${element.tagName.toLowerCase()}:${element.id || element.getAttribute("name") || element.textContent?.trim().slice(0, 30) || tabIndex}`, visible, escaped: element !== document.body && (rect.width === 0 || rect.height === 0), ignored: false };
    }, { tabIndex: attempts, ignoredTags: GAUNTLET_IGNORED_FOCUS_TAGS });
    if (state.ignored) continue;
    visitedControls += 1;
    visited.add(state.key);
    if (state.visible) visibleFocusCount += 1;
    if (state.escaped) escapedCount += 1;
  }
  if (focusableCount > 0 && visibleFocusCount === 0) issues.push({ check: "keyboard-focus-visible", detail: `${path} has ${focusableCount} focusable control(s) but no visible focus treatment` });
  if (escapedCount > 0) issues.push({ check: "keyboard-focus-escape", detail: `${path} sent focus to an invisible control ${escapedCount} time(s)` });
  return { focusableCount, visitedCount: visited.size, visibleFocusCount, escapedCount };
}

async function collectReflowEvidence(
  browser: any,
  baseUrl: string,
  path: string,
  issues: GauntletIssue[],
  blockedMutations: BlockedMutationEvidence[],
): Promise<ReflowEvidence[]> {
  const evidence: ReflowEvidence[] = [];
  for (const viewport of GAUNTLET_REFLOW_VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await installReadOnlyGauntletNetworkGuard(context, blockedMutations);
    const page = await context.newPage();
    try {
      await page.goto(new URL(path, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
      // WCAG 1.4.10 treats 400% zoom on a 1280 CSS-pixel desktop as a
      // 320-pixel layout viewport. Measuring those effective widths avoids
      // the false positives produced by applying non-standard CSS `zoom`.
      await page.evaluate((zoom: number) => {
        document.documentElement.dataset.gauntletZoom = `${zoom * 100}%`;
      }, viewport.zoom);
      const layout = await page.evaluate(collectLayoutEvidenceInPage);
      const result = { viewport: viewport.name, zoom: viewport.zoom, ...layout };
      evidence.push(result);
      if (layout.horizontalOverflow > 1) issues.push({ check: "reflow-horizontal-overflow", detail: `${path} overflows by ${Math.round(layout.horizontalOverflow)}px at ${viewport.zoom * 100}% zoom` });
    } finally {
      await context.close();
    }
  }
  return evidence;
}

async function collectLongCopyEvidence(page: any, issues: GauntletIssue[], path: string): Promise<LayoutEvidence> {
  const evidence = await page.evaluate((copy: string) => {
    const candidates = document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,a,button,label,[aria-label]");
    candidates.forEach((element) => {
      if (element.offsetParent !== null && element.childElementCount === 0) element.textContent = copy;
    });
    const root = document.documentElement;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    let outOfBoundsCount = 0;
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      if (element.offsetParent === null) continue;
      const rect = element.getBoundingClientRect();
      if (rect.right > viewportWidth + 1 || rect.left < -1) outOfBoundsCount += 1;
    }
    return { horizontalOverflow: Math.max(0, root.scrollWidth - viewportWidth), outOfBoundsCount };
  }, GAUNTLET_LONG_COPY);
  if (evidence.horizontalOverflow > 1) issues.push({ check: "long-copy-overflow", detail: `${path} overflows by ${Math.round(evidence.horizontalOverflow)}px with a long localized name` });
  return evidence;
}

async function collectRecoveryEvidence(context: any, page: any, issues: GauntletIssue[], path: string): Promise<RecoveryEvidence> {
  await context.setOffline(true);
  await page.waitForFunction(() => !navigator.onLine, undefined, { timeout: 2_000 }).catch(() => undefined);
  const offlineSignal = await page.evaluate(() => !navigator.onLine);
  const offlineRequestFailed = await page.evaluate(async () => {
    try {
      await fetch(`${location.origin}/__gauntlet_offline_probe__?nonce=${Date.now()}`, { cache: "no-store" });
      return false;
    } catch {
      return true;
    }
  });
  await context.setOffline(false);
  const restoredOnline = await page.evaluate(() => navigator.onLine);
  const onlineRequestSucceeded = await page.evaluate(async () => {
    try {
      const response = await fetch(location.href, { cache: "no-store" });
      return response.ok;
    } catch {
      return false;
    }
  });
  const errorStateCount = await page.locator('[data-state="error"], [role="alert"]').count();
  const retryControlCount = await page.getByRole("button", { name: /retry|try again|reload/i }).count();
  if (!offlineSignal || !offlineRequestFailed || !restoredOnline || !onlineRequestSucceeded) issues.push({ check: "recovery-offline-signal", detail: `${path} did not expose a deterministic offline failure and online recovery transition` });
  if (path === "/design/quiet-authority" && (errorStateCount < 1 || retryControlCount < 1)) {
    issues.push({ check: "recovery-visible-control", detail: `${path} must expose a visible error state and a retry control in its recovery specimen` });
  }
  return { offlineSignal, offlineRequestFailed, restoredOnline, onlineRequestSucceeded, errorStateCount, retryControlCount };
}

function collectLayoutEvidenceInPage(): LayoutEvidence {
  const root = document.documentElement;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  let outOfBoundsCount = 0;
  for (const element of document.querySelectorAll<HTMLElement>("body *")) {
    if (element.offsetParent === null) continue;
    const rect = element.getBoundingClientRect();
    if (rect.right > viewportWidth + 1 || rect.left < -1) outOfBoundsCount += 1;
  }
  return { horizontalOverflow: Math.max(0, root.scrollWidth - viewportWidth), outOfBoundsCount };
}

function printIssues(issues: GauntletIssue[]): void {
  for (const issue of issues) console.error(`- ${issue.check}: ${issue.detail}`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const staticReport = collectStaticGauntletReport();
  const baseUrl = argv.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length);
  const outputDir = argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length) ?? resolve(ROOT, "artifacts/interface-gauntlet");
  const strict = argv.includes("--strict");
  console.log(JSON.stringify(staticReport, null, 2));
  if (staticReport.issues.length > 0) printIssues(staticReport.issues);
  let evidence: { static: StaticGauntletReport; baseUrl?: string; rendered?: RenderedRouteResult[] } = { static: staticReport };
  if (baseUrl) {
    const rendered = await runRenderedGauntlet(baseUrl, outputDir);
    const renderedIssues = rendered.flatMap((result) => result.issues);
    console.log(JSON.stringify({ baseUrl, rendered }, null, 2));
    if (renderedIssues.length > 0) printIssues(renderedIssues);
    if (renderedIssues.length > 0) process.exitCode = 1;
    evidence = { static: staticReport, baseUrl, rendered };
  }
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "gauntlet-report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  if (strict && staticReport.issues.length > 0) process.exitCode = 1;
  if (!baseUrl && !strict) console.log("Static contract recorded. Pass --base-url=https://thankshoma.com for rendered route evidence.");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
