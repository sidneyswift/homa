import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const DESIGN_CSS_PATH = resolve(ROOT, "apps/web/components/design/quiet-primitives.css");

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

export const GAUNTLET_LONG_COPY =
  "Alexandria-Wilhelmina van der Meer and the curious learning community";

export const GAUNTLET_ROUTES = [
  { path: "/", requiredMarkers: ["quiet-landing", "quiet-nav", "quiet-footer"] },
  { path: "/signin", requiredMarkers: ["quiet-auth-shell", "quiet-frame"] },
  { path: "/onboarding", requiredMarkers: ["quiet-nav", "quiet-footer", "quiet-action"] },
  { path: "/design/quiet-authority", requiredMarkers: ["quiet-fixture", "quiet-frame", "quiet-action", "quiet-status"] },
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
  screenshotPath: string;
  issues: GauntletIssue[];
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

function loadManifest(): BrandSurfaceManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as BrandSurfaceManifest;
}

function hasTrackedSurface(manifest: BrandSurfaceManifest, path: string): boolean {
  return manifest.surfaces.some((surface) => surface.paths.includes(path));
}

function routeIssues(manifest: BrandSurfaceManifest): GauntletIssue[] {
  const issues: GauntletIssue[] = [];
  for (const route of GAUNTLET_ROUTES) {
    if (!manifest.surfaces.some((surface) => surface.type === "route" && surface.paths.some((path) => path.includes(route.path === "/" ? "app/page" : route.path.slice(1))))) {
      issues.push({ check: "manifest-route-coverage", detail: `${route.path} is not represented by a route surface row` });
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
  if (manifest.schemaVersion !== 1) issues.push({ check: "manifest-schema", detail: `unsupported schema ${manifest.schemaVersion}` });
  if (manifest.designEra !== "quiet-authority-v1") issues.push({ check: "design-era", detail: `manifest is ${manifest.designEra}` });
  if (!existsSync(DESIGN_CSS_PATH)) issues.push({ check: "primitive-css", detail: "quiet-primitives.css is missing" });
  else {
    const css = readFileSync(DESIGN_CSS_PATH, "utf8");
    if (!css.includes("prefers-reduced-motion")) issues.push({ check: "reduced-motion", detail: "web primitives have no Reduced Motion endpoint" });
    if (!css.includes("forced-colors: active")) issues.push({ check: "forced-colors", detail: "web primitives have no Forced Colors endpoint" });
    if (!css.includes(":focus-visible")) issues.push({ check: "focus-visible", detail: "web primitives have no visible keyboard focus endpoint" });
    if (!css.includes("--homa-")) issues.push({ check: "semantic-tokens", detail: "web primitives do not reference generated Homa tokens" });
  }
  for (const requiredPath of [
    "apps/web/components/design/QuietFrame.tsx",
    "apps/web/components/design/QuietAction.tsx",
    "apps/web/components/design/QuietStatus.tsx",
    "apps/web/components/design/QuietNav.tsx",
    "apps/web/components/design/QuietFooter.tsx",
  ]) {
    if (!hasTrackedSurface(manifest, requiredPath)) issues.push({ check: "primitive-manifest", detail: `${requiredPath} is not classified in the manifest` });
  }
  issues.push(...routeIssues(manifest), ...criticalSurfaceIssues(manifest));
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
        const page = await context.newPage();
        const issues: GauntletIssue[] = [];
        const response = await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
        const html = await page.content();
        const markers = markerList(html);
        const missingMarkers = route.requiredMarkers.filter((marker) => !markers.includes(marker));
        if (response === null || response.status() >= 400) issues.push({ check: "http-status", detail: `${route.path} returned ${response?.status() ?? "no response"}` });
        for (const marker of missingMarkers) issues.push({ check: "route-marker", detail: `${route.path} is missing ${marker}` });
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

        const reflow = await collectReflowEvidence(browser, baseUrl, route.path, issues);
        const longCopy = await collectLongCopyEvidence(page, issues, route.path);
        const recovery = await collectRecoveryEvidence(context, page, issues, route.path);
        const screenshotPath = resolve(outputDir, `${route.path === "/" ? "home" : route.path.slice(1).replaceAll("/", "-")}-${viewport.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await context.close();
        results.push({ path: route.path, viewport: viewport.name, status: response?.status() ?? null, markers, reducedMotion, forcedColors, focus, axe, reflow, longCopy, recovery, performance: performanceEvidence, screenshotPath, issues });
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
  const focusableCount = await page.locator("a[href],button,input,select,textarea,[tabindex]:not([tabindex=\"-1\"])").count();
  const visited = new Set<string>();
  let visibleFocusCount = 0;
  let escapedCount = 0;
  for (let index = 0; index < Math.min(focusableCount, 80); index += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate((tabIndex: number) => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return { key: "none", visible: false, escaped: true };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible = element.matches(":focus-visible") || style.outlineStyle !== "none" || style.outlineWidth !== "0px" || style.boxShadow !== "none";
      return { key: `${element.tagName.toLowerCase()}:${element.id || element.getAttribute("name") || element.textContent?.trim().slice(0, 30) || tabIndex}`, visible, escaped: element !== document.body && (rect.width === 0 || rect.height === 0) };
    }, index);
    visited.add(state.key);
    if (state.visible) visibleFocusCount += 1;
    if (state.escaped) escapedCount += 1;
  }
  if (focusableCount > 0 && visibleFocusCount === 0) issues.push({ check: "keyboard-focus-visible", detail: `${path} has ${focusableCount} focusable control(s) but no visible focus treatment` });
  if (escapedCount > 0) issues.push({ check: "keyboard-focus-escape", detail: `${path} sent focus to an invisible control ${escapedCount} time(s)` });
  return { focusableCount, visitedCount: visited.size, visibleFocusCount, escapedCount };
}

async function collectReflowEvidence(browser: any, baseUrl: string, path: string, issues: GauntletIssue[]): Promise<ReflowEvidence[]> {
  const evidence: ReflowEvidence[] = [];
  for (const viewport of GAUNTLET_REFLOW_VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
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
  const offlineSignal = await page.evaluate(() => !navigator.onLine);
  const offlineRequestFailed = await page.evaluate(async () => {
    try {
      await fetch(`${location.origin}/__gauntlet_offline_probe__`, { cache: "no-store" });
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
