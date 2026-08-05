import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  GAUNTLET_LONG_COPY,
  GAUNTLET_FOCUSABLE_SELECTOR,
  GAUNTLET_FIXTURE_PRIMITIVE_STATES,
  GAUNTLET_IGNORED_FOCUS_TAGS,
  GAUNTLET_PERFORMANCE_BUDGET,
  GAUNTLET_READ_ONLY_METHODS,
  GAUNTLET_REAL_PRIMITIVE_CONSUMERS,
  GAUNTLET_REFLOW_VIEWPORTS,
  GAUNTLET_ROUTE_MANIFEST_PATHS,
  GAUNTLET_ROUTES,
  GAUNTLET_VIEWPORTS,
  GAUNTLET_WEB_PRIMITIVES,
  collectStaticGauntletReport,
  installReadOnlyGauntletNetworkGuard,
  shouldBlockGauntletRequest,
} from "./interface-gauntlet.mts";

test("interface gauntlet declares representative route and viewport coverage", () => {
  assert.deepEqual(GAUNTLET_VIEWPORTS.map(({ width }) => width), [320, 390, 1440]);
  assert.deepEqual(GAUNTLET_REFLOW_VIEWPORTS.map(({ zoom }) => zoom), [2, 4]);
  assert.deepEqual(GAUNTLET_ROUTES.map(({ path }) => path), ["/", "/signin", "/onboarding", "/design/quiet-authority"]);
  for (const route of GAUNTLET_ROUTES) assert.ok(route.requiredMarkers.length > 0, `${route.path} needs a rendered marker contract`);
  assert.deepEqual(GAUNTLET_ROUTE_MANIFEST_PATHS, [
    ["/", "apps/web/app/page.tsx"],
    ["/signin", "apps/web/app/signin/page.tsx"],
    ["/onboarding", "apps/web/app/onboarding/page.tsx"],
    ["/design/quiet-authority", "apps/web/app/design/quiet-authority/page.tsx"],
  ]);
});

test("rendered gauntlet keeps explicit stress budgets and localization input", () => {
  assert.equal(GAUNTLET_PERFORMANCE_BUDGET.domContentLoadedMs, 4_000);
  assert.equal(GAUNTLET_PERFORMANCE_BUDGET.transferBytes, 5_000_000);
  assert.match(GAUNTLET_LONG_COPY, /Alexandria/u);
  assert.ok(GAUNTLET_LONG_COPY.length > 40);
});

test("rendered gauntlet permits reads and rejects every mutation method", () => {
  assert.deepEqual(GAUNTLET_READ_ONLY_METHODS, ["GET", "HEAD", "OPTIONS"]);
  for (const method of GAUNTLET_READ_ONLY_METHODS) assert.equal(shouldBlockGauntletRequest(method), false);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "CONNECT", "TRACE"]) {
    assert.equal(shouldBlockGauntletRequest(method), true, `${method} must be blocked`);
  }
});

test("rendered gauntlet aborts mutations without recording query strings", async () => {
  let handler: ((route: any) => Promise<void>) | undefined;
  const context = {
    route: async (pattern: string, next: (route: any) => Promise<void>) => {
      assert.equal(pattern, "**/*");
      handler = next;
    },
  };
  const blockedMutations: Array<{ method: string; origin: string; path: string }> = [];
  await installReadOnlyGauntletNetworkGuard(context, blockedMutations);
  assert.ok(handler);

  let aborted = false;
  let continued = false;
  await handler({
    request: () => ({ method: () => "POST", url: () => "https://example.test/api/map/start?secret=hidden" }),
    abort: async (reason: string) => {
      assert.equal(reason, "blockedbyclient");
      aborted = true;
    },
    continue: async () => {
      continued = true;
    },
  });

  assert.equal(aborted, true);
  assert.equal(continued, false);
  assert.deepEqual(blockedMutations, [{ method: "POST", origin: "https://example.test", path: "/api/map/start" }]);
});

test("rendered gauntlet lets read requests continue", async () => {
  let handler: ((route: any) => Promise<void>) | undefined;
  const context = { route: async (_pattern: string, next: (route: any) => Promise<void>) => { handler = next; } };
  const blockedMutations: Array<{ method: string; origin: string; path: string }> = [];
  await installReadOnlyGauntletNetworkGuard(context, blockedMutations);
  assert.ok(handler);

  let continued = false;
  await handler({
    request: () => ({ method: () => "GET", url: () => "https://example.test/" }),
    abort: async () => assert.fail("GET must not be aborted"),
    continue: async () => {
      continued = true;
    },
  });

  assert.equal(continued, true);
  assert.deepEqual(blockedMutations, []);
});

test("focus traversal excludes only Next.js development chrome", () => {
  assert.match(GAUNTLET_FOCUSABLE_SELECTOR, /:not\(nextjs-portal\)/u);
  assert.match(GAUNTLET_FOCUSABLE_SELECTOR, /:not\(next-route-announcer\)/u);
  assert.match(GAUNTLET_FOCUSABLE_SELECTOR, /a\[href\]/u);
  assert.match(GAUNTLET_FOCUSABLE_SELECTOR, /button/u);
  assert.match(GAUNTLET_FOCUSABLE_SELECTOR, /input/u);
  assert.deepEqual(GAUNTLET_IGNORED_FOCUS_TAGS, ["nextjs-portal", "next-route-announcer"]);
});

test("static interface contract is healthy even before rendered evidence is supplied", () => {
  const report = collectStaticGauntletReport();
  assert.equal(report.harnessVersion, "interface-gauntlet-v2");
  assert.equal(report.contract, "quiet-authority-v1");
  assert.match(report.manifestFingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(report.status, "pass", report.issues.map((issue) => `${issue.check}: ${issue.detail}`).join("\n"));
});

test("web primitive coverage cannot shrink below the contract inventory", () => {
  assert.deepEqual(
    GAUNTLET_WEB_PRIMITIVES.map(([id]) => id),
    [
      "web-quiet-action",
      "web-quiet-choice",
      "web-quiet-feedback",
      "web-quiet-field",
      "web-quiet-frame",
      "web-quiet-identity",
      "web-quiet-media",
      "web-quiet-nav",
      "web-quiet-footer",
      "web-quiet-status",
      "web-quiet-thread",
      "web-semantic-icon",
    ],
  );
  assert.ok(GAUNTLET_REAL_PRIMITIVE_CONSUMERS.length >= 2);
  assert.ok(GAUNTLET_REAL_PRIMITIVE_CONSUMERS.some(([source]) => source.includes("marketing/")));
  assert.ok(GAUNTLET_REAL_PRIMITIVE_CONSUMERS.some(([source]) => source.includes("dashboard/")));
  assert.deepEqual(GAUNTLET_FIXTURE_PRIMITIVE_STATES.map(([id]) => id), GAUNTLET_WEB_PRIMITIVES.map(([id]) => id));
  for (const [, states] of GAUNTLET_FIXTURE_PRIMITIVE_STATES) assert.ok(states.length >= 2);
});

test("shared Quiet navigation can shrink and wrap long localized labels", () => {
  const css = readFileSync("apps/web/components/design/quiet-primitives.css", "utf8");
  assert.match(css, /\.quiet-nav__row\s*\{[^}]*min-width:\s*0;/su);
  assert.match(css, /\.quiet-nav__links\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;/su);
  assert.match(css, /\.quiet-nav__link,\s*\.quiet-nav__signin\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/su);
});
