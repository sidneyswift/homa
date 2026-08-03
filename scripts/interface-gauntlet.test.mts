import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  GAUNTLET_LONG_COPY,
  GAUNTLET_PERFORMANCE_BUDGET,
  GAUNTLET_REFLOW_VIEWPORTS,
  GAUNTLET_ROUTES,
  GAUNTLET_VIEWPORTS,
  collectStaticGauntletReport,
} from "./interface-gauntlet.mts";

test("interface gauntlet declares representative route and viewport coverage", () => {
  assert.deepEqual(GAUNTLET_VIEWPORTS.map(({ width }) => width), [320, 390, 1440]);
  assert.deepEqual(GAUNTLET_REFLOW_VIEWPORTS.map(({ zoom }) => zoom), [2, 4]);
  assert.deepEqual(GAUNTLET_ROUTES.map(({ path }) => path), ["/", "/signin", "/onboarding", "/design/quiet-authority"]);
  for (const route of GAUNTLET_ROUTES) assert.ok(route.requiredMarkers.length > 0, `${route.path} needs a rendered marker contract`);
});

test("rendered gauntlet keeps explicit stress budgets and localization input", () => {
  assert.equal(GAUNTLET_PERFORMANCE_BUDGET.domContentLoadedMs, 4_000);
  assert.equal(GAUNTLET_PERFORMANCE_BUDGET.transferBytes, 5_000_000);
  assert.match(GAUNTLET_LONG_COPY, /Alexandria/u);
  assert.ok(GAUNTLET_LONG_COPY.length > 40);
});

test("static interface contract is healthy even before rendered evidence is supplied", () => {
  const report = collectStaticGauntletReport();
  assert.equal(report.harnessVersion, "interface-gauntlet-v2");
  assert.equal(report.contract, "quiet-authority-v1");
  assert.match(report.manifestFingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(report.status, "pass", report.issues.map((issue) => `${issue.check}: ${issue.detail}`).join("\n"));
});

test("shared Quiet navigation can shrink and wrap long localized labels", () => {
  const css = readFileSync("apps/web/components/design/quiet-primitives.css", "utf8");
  assert.match(css, /\.quiet-nav__row\s*\{[^}]*min-width:\s*0;/su);
  assert.match(css, /\.quiet-nav__links\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;/su);
  assert.match(css, /\.quiet-nav__link,\s*\.quiet-nav__signin\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/su);
});
