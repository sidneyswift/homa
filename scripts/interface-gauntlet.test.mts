import assert from "node:assert/strict";
import test from "node:test";
import { GAUNTLET_ROUTES, GAUNTLET_VIEWPORTS, collectStaticGauntletReport } from "./interface-gauntlet.mts";

test("interface gauntlet declares representative route and viewport coverage", () => {
  assert.deepEqual(GAUNTLET_VIEWPORTS.map(({ width }) => width), [320, 390, 1440]);
  assert.deepEqual(GAUNTLET_ROUTES.map(({ path }) => path), ["/", "/signin", "/onboarding", "/design/quiet-authority"]);
  for (const route of GAUNTLET_ROUTES) assert.ok(route.requiredMarkers.length > 0, `${route.path} needs a rendered marker contract`);
});

test("static interface contract is healthy even before rendered evidence is supplied", () => {
  const report = collectStaticGauntletReport();
  assert.equal(report.contract, "quiet-authority-v1");
  assert.match(report.manifestFingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(report.status, "pass", report.issues.map((issue) => `${issue.check}: ${issue.detail}`).join("\n"));
});
