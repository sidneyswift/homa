import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
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
  harnessVersion: "interface-gauntlet-v1";
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
  screenshotPath: string;
  issues: GauntletIssue[];
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
    harnessVersion: "interface-gauntlet-v1",
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
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results: RenderedRouteResult[] = [];
  try {
    for (const route of GAUNTLET_ROUTES) {
      for (const viewport of GAUNTLET_VIEWPORTS) {
        const context = await browser.newContext({ viewport, recordVideo: { dir: outputDir } });
        const page = await context.newPage();
        const issues: GauntletIssue[] = [];
        const response = await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
        const html = await page.content();
        const markers = markerList(html);
        const missingMarkers = route.requiredMarkers.filter((marker) => !markers.includes(marker));
        if (response === null || response.status() >= 400) issues.push({ check: "http-status", detail: `${route.path} returned ${response?.status() ?? "no response"}` });
        for (const marker of missingMarkers) issues.push({ check: "route-marker", detail: `${route.path} is missing ${marker}` });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const reducedMotion = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        if (!reducedMotion) issues.push({ check: "reduced-motion-context", detail: `${route.path} did not expose the reduced-motion media query` });
        const screenshotPath = resolve(outputDir, `${route.path === "/" ? "home" : route.path.slice(1).replaceAll("/", "-")}-${viewport.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await context.close();
        results.push({ path: route.path, viewport: viewport.name, status: response?.status() ?? null, markers, reducedMotion, screenshotPath, issues });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
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
  if (baseUrl) {
    const rendered = await runRenderedGauntlet(baseUrl, outputDir);
    const renderedIssues = rendered.flatMap((result) => result.issues);
    console.log(JSON.stringify({ baseUrl, rendered }, null, 2));
    if (renderedIssues.length > 0) printIssues(renderedIssues);
    if (renderedIssues.length > 0) process.exitCode = 1;
  }
  if (strict && staticReport.issues.length > 0) process.exitCode = 1;
  if (!baseUrl && !strict) console.log("Static contract recorded. Pass --base-url=https://thankshoma.com for rendered route evidence.");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
