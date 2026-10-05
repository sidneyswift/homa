import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import type { LegacyRemovalLedger } from "../packages/design/src/legacy-removal.ts";
import { brandCriticalities, brandDeliveryStates, brandDispositions, brandManifestTypes, type BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";
import { LEGACY_FONT_PATH_SIGNATURE } from "../packages/design/src/legacy-signatures.ts";
import {
  collectHistoricalQuarantineIndexViolations,
  historicalBrandQuarantineRecords,
  historicalQuarantineDocumentationManifestPath,
  isActiveAuthoringIndexOrRegistryPath,
} from "../packages/design/src/historical-quarantine.ts";
import {
  assertNoUnresolvedInterceptingRoutes,
  assertNoUnresolvedRouteHandlers,
  classifyGeneratedWebRouteBoundary,
  classifyGeneratedWebRouteHandlerBoundary,
  generatedWebRouteHandlerRuntimePolicy,
  reviewedWebRouteHandlerBoundaries,
} from "./brand-route-boundary.mts";
import {
  classifyValidatedWebRouteBoundary,
  classifyValidatedWebRouteHandlerBoundary,
  validatedWebRouteHandlerBoundaries,
  validatedWebRouteHandlerRuntimePolicy,
} from "./brand-inventory-completeness-check.mts";
import { collectBrandResidueFindings, collectLegacyFontPathResidue } from "./brand-residue-check.mts";
import { collectLatestCommittedSources, type GitTextCommand } from "./brand-source-provenance.mts";
import { isGitHubPullRequestMergeCheckout, sameContentWithOnlySourceProvenanceDrift } from "./brand-surfaces.mts";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/surfaces.json"), "utf8")) as BrandSurfaceManifest;
const removalLedger = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/legacy-removal.json"), "utf8")) as LegacyRemovalLedger;
const legacyBaseline = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/legacy-baseline.json"), "utf8")) as { designEra: string; sourceCommit: string; records: Array<{ path: string; sourceHash: string | null; legacySignatures: string[] }> };
const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const git = (...args: string[]) => execFileSync("git", args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
}).trim();
const workingTreePaths = new Set([
  ...git("diff", "--name-only", "HEAD").split("\n").filter(Boolean),
  ...git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean),
]);
const latestCommittedSource = collectLatestCommittedSources(git);

interface ProvenanceFixture {
  repoGit: GitTextCommand;
  repo: string;
  base: string;
  feature: string;
  featureTree: string;
}

function withProvenanceRepo(run: (fixture: ProvenanceFixture) => void): void {
  const repo = mkdtempSync(join(tmpdir(), "homa-brand-provenance-"));
  const repoGit: GitTextCommand = (...args) => execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).trim();

  try {
    repoGit("init", "--quiet");
    repoGit("config", "user.name", "Homa provenance test");
    repoGit("config", "user.email", "provenance-test@localhost");
    repoGit("config", "commit.gpgsign", "false");
    writeFileSync(join(repo, "surface.txt"), "base\n");
    repoGit("add", "surface.txt");
    repoGit("commit", "--quiet", "-m", "base");
    const base = repoGit("rev-parse", "HEAD");

    writeFileSync(join(repo, "surface.txt"), "feature\n");
    repoGit("add", "surface.txt");
    repoGit("commit", "--quiet", "-m", "feature");
    const feature = repoGit("rev-parse", "HEAD");
    const featureTree = repoGit("rev-parse", `${feature}^{tree}`);
    run({ repoGit, repo, base, feature, featureTree });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test("source provenance unwraps a byte-identical two-parent checkout", () => {
  withProvenanceRepo(({ repoGit, base, feature, featureTree }) => {
    const merge = repoGit("commit-tree", featureTree, "-p", base, "-p", feature, "-m", "exact merge");
    assert.equal(collectLatestCommittedSources(repoGit, merge).get("surface.txt")?.sha, feature);
  });
});

test("source provenance follows an exact content merge through a later child", () => {
  withProvenanceRepo(({ repoGit, base, feature, featureTree }) => {
    const merge = repoGit("commit-tree", featureTree, "-p", base, "-p", feature, "-m", "exact merge");
    const child = repoGit("commit-tree", featureTree, "-p", merge, "-m", "later child");
    assert.equal(collectLatestCommittedSources(repoGit, child).get("surface.txt")?.sha, feature);
  });
});

test("source provenance keeps an altered two-parent merge and its child on the merge", () => {
  withProvenanceRepo(({ repoGit, repo, base, feature }) => {
    writeFileSync(join(repo, "surface.txt"), "merge result\n");
    repoGit("add", "surface.txt");
    const mergedTree = repoGit("write-tree");
    const merge = repoGit("commit-tree", mergedTree, "-p", base, "-p", feature, "-m", "altered merge");
    const child = repoGit("commit-tree", mergedTree, "-p", merge, "-m", "later child");

    assert.equal(collectLatestCommittedSources(repoGit, merge).get("surface.txt")?.sha, merge);
    assert.equal(collectLatestCommittedSources(repoGit, child).get("surface.txt")?.sha, merge);
  });
});

test("source provenance keeps an ordinary one-parent squash on the squash", () => {
  withProvenanceRepo(({ repoGit, base, featureTree }) => {
    const squash = repoGit("commit-tree", featureTree, "-p", base, "-m", "squash");
    assert.equal(collectLatestCommittedSources(repoGit, squash).get("surface.txt")?.sha, squash);
  });
});

test("a squash release accepts only content-bound review provenance", () => {
  const committed = structuredClone(manifest);
  const expected = structuredClone(manifest);
  const surface = expected.surfaces.find((entry) => entry.evidenceMetadata.sourceCommitSha !== null);
  assert.ok(surface, "expected one committed surface provenance row");
  surface.evidenceMetadata.sourceCommitSha = "a".repeat(40);
  surface.evidenceMetadata.sourceCommitTimestamp = "2026-08-16T00:00:00Z";
  assert.equal(sameContentWithOnlySourceProvenanceDrift(committed, expected), true);

  surface.evidenceMetadata.environment = "working-tree-uncommitted";
  assert.equal(sameContentWithOnlySourceProvenanceDrift(committed, expected), true);

  surface.currentAssetHashes[0] = "b".repeat(64);
  assert.equal(sameContentWithOnlySourceProvenanceDrift(committed, expected), false);
});

test("only GitHub's two-parent pull request checkout may rewrite source provenance", () => {
  assert.equal(isGitHubPullRequestMergeCheckout("pull_request", "refs/pull/961/merge", "merge base head"), true);
  assert.equal(isGitHubPullRequestMergeCheckout("pull_request", "refs/pull/961/head", "head"), false);
  assert.equal(isGitHubPullRequestMergeCheckout("push", "refs/heads/main", "merge base head"), false);
  assert.equal(isGitHubPullRequestMergeCheckout("pull_request", "refs/pull/961/merge", "head base feature extra"), false);
});

test("source provenance keeps a three-parent checkout on the octopus merge", () => {
  withProvenanceRepo(({ repoGit, base, feature, featureTree }) => {
    const third = repoGit("commit-tree", featureTree, "-p", feature, "-m", "third parent");
    const octopus = repoGit(
      "commit-tree",
      featureTree,
      "-p",
      base,
      "-p",
      feature,
      "-p",
      third,
      "-m",
      "octopus merge",
    );

    assert.equal(repoGit("rev-parse", `${octopus}^{tree}`), repoGit("rev-parse", `${feature}^{tree}`));
    assert.equal(collectLatestCommittedSources(repoGit, octopus).get("surface.txt")?.sha, octopus);
  });
});

test("manifest IDs, paths, and ordering are unique and deterministic", () => {
  const paths = manifest.surfaces.map((surface) => surface.paths[0]!);
  const ids = manifest.surfaces.map((surface) => surface.id);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(paths, [...paths].sort(stableCompare));
});

test("manifest includes every required surface family", () => {
  const present = new Set(manifest.surfaces.map((surface) => surface.type));
  for (const type of brandManifestTypes) assert.ok(present.has(type), `missing surface type: ${type}`);
});

test("easy-to-miss raw HTML, metadata, and contact surfaces stay classified", () => {
  const paths = new Set(manifest.surfaces.flatMap((surface) => surface.paths));
  for (const path of [
    "apps/web/app/api/link-phone/route.ts",
    "apps/web/app/api/email/unsubscribe/route.ts",
    "apps/web/public/ai.txt",
    "apps/web/public/llms.txt",
    "apps/web/public/llms-full.txt",
    "apps/web/app/homa.vcf/route.ts",
    "supabase/templates/recovery.html",
  ]) assert.ok(paths.has(path), `unclassified hidden surface: ${path}`);
});

test("public metadata and authentication entry points require public rollback proof", () => {
  const byPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));
  for (const path of [
    "apps/web/app/manifest.ts",
    "apps/web/app/robots.ts",
    "apps/web/app/sitemap.ts",
    "apps/web/public/ai.txt",
    "apps/web/public/llms.txt",
    "apps/web/public/llms-full.txt",
    "apps/web/app/homa.vcf/route.ts",
    "apps/web/app/auth/callback/route.ts",
    "apps/web/app/auth/confirm/route.ts",
  ]) {
    const surface = byPath.get(path);
    assert.ok(surface, `public source missing from manifest: ${path}`);
    assert.equal(surface.reachability, "public", path);
    assert.equal(surface.deliveryState, "revocable-public", path);
    assert.ok(surface.audiences.includes("public"), path);
  }
});

test("every route handler has matching independent fail-closed boundary reviews", () => {
  const routeHandlers = git("ls-files", "--", "apps/web/app/**/route.ts").split("\n").filter(Boolean).sort(stableCompare);
  assert.equal(routeHandlers.length, 127);
  assert.deepEqual(Object.keys(reviewedWebRouteHandlerBoundaries).sort(stableCompare), routeHandlers);
  assert.deepEqual(Object.keys(validatedWebRouteHandlerBoundaries).sort(stableCompare), routeHandlers);

  const counts = new Map<string, number>();
  for (const path of routeHandlers) {
    const generated = classifyGeneratedWebRouteHandlerBoundary(path);
    const validated = classifyValidatedWebRouteHandlerBoundary(path);
    assert.notEqual(generated, "unresolved", path);
    assert.notEqual(validated, "unresolved", path);
    assert.equal(generated, validated, path);
    assert.deepEqual(generatedWebRouteHandlerRuntimePolicy(path), validatedWebRouteHandlerRuntimePolicy(path), path);
    counts.set(String(generated), (counts.get(String(generated)) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(counts), {
    operator: 2,
    family: 96,
    provider: 10,
    developer: 2,
    "developer-family": 1,
    public: 11,
    "mixed-family-provider": 1,
    "internal-service": 2,
    "family-device": 2,
  });

  const unknown = "apps/web/app/api/new-unreviewed/route.ts";
  assert.equal(classifyGeneratedWebRouteHandlerBoundary(unknown), "unresolved");
  assert.equal(classifyValidatedWebRouteHandlerBoundary(unknown), "unresolved");
  assert.throws(() => assertNoUnresolvedRouteHandlers([unknown]), /explicit reviewed runtime boundary/);
});

test("route handler fixtures retain public, family, operator, provider, developer, and mixed semantics", () => {
  const byPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));
  const fixtures = new Map([
    ["apps/web/app/api/waitlist/route.ts", "public"],
    ["apps/web/app/api/link-phone/route.ts", "public"],
    ["apps/web/app/api/email/unsubscribe/route.ts", "public"],
    ["apps/web/app/auth/callback/route.ts", "public"],
    ["apps/web/app/api/chat/history/route.ts", "family"],
    ["apps/web/app/api/map/plan/board/route.ts", "family"],
    ["apps/web/app/api/map/state/route.ts", "family"],
    ["apps/web/app/admin/studio/anchor/[id]/route.ts", "operator"],
    ["apps/web/app/api/billing/webhook/route.ts", "provider"],
    ["apps/web/app/api/billing/apple/webhook/route.ts", "provider"],
    ["apps/web/app/api/email/webhook/route.ts", "provider"],
    ["apps/web/app/api/dev/oidc-status/route.ts", "developer"],
    ["apps/web/app/api/dev/reset-onboarding/route.ts", "developer-family"],
    ["apps/web/app/api/map/cron/route.ts", "internal-service"],
    ["apps/web/app/api/sync/ingest/route.ts", "family-device"],
    ["apps/web/app/api/library/upload/route.ts", "mixed-family-provider"],
  ] as const);

  for (const [path, boundary] of fixtures) {
    const surface = byPath.get(path);
    assert.ok(surface, path);
    assert.equal(classifyGeneratedWebRouteHandlerBoundary(path), boundary, path);
    assert.equal(classifyValidatedWebRouteHandlerBoundary(path), boundary, path);
    assert.deepEqual(surface.runtimeBoundary, generatedWebRouteHandlerRuntimePolicy(path), path);
    assert.deepEqual(surface.runtimeBoundary, validatedWebRouteHandlerRuntimePolicy(path), path);
    assert.equal(surface.type, "renderer", path);
    if (boundary === "public") {
      assert.equal(surface.reachability, "public", path);
      assert.equal(surface.deliveryState, "revocable-public", path);
      assert.ok(surface.audiences.includes("public"), path);
    } else if (boundary === "developer") {
      assert.equal(surface.reachability, "internal", path);
      assert.deepEqual(surface.audiences, ["developer"], path);
    } else if (boundary === "developer-family") {
      assert.equal(surface.reachability, "internal", path);
      assert.deepEqual(surface.audiences, ["developer", "family"], path);
    } else if (boundary === "internal-service") {
      assert.equal(surface.reachability, "internal", path);
      assert.deepEqual(surface.audiences, ["developer", "operator"], path);
    } else if (boundary === "family-device") {
      assert.equal(surface.reachability, "authenticated", path);
      assert.deepEqual(surface.audiences, ["family", "developer"], path);
    } else if (boundary === "mixed-family-provider") {
      assert.equal(surface.reachability, "authenticated", path);
      assert.deepEqual(surface.audiences, ["family", "provider"], path);
    } else {
      assert.equal(surface.reachability, "authenticated", path);
      assert.deepEqual(surface.audiences, [boundary], path);
    }
  }
});

test("inventory discovery covers exact design sources that broad keyword selectors missed", () => {
  const paths = new Set(manifest.surfaces.flatMap((surface) => surface.paths));
  for (const path of [
    "scripts/brand-surfaces.mts",
    "scripts/brand-route-boundary.mts",
    "scripts/design-contract.mts",
    "scripts/brand-residue-check.mts",
    "apps/web/lib/materials/render-page.ts",
    "apps/web/lib/materials/print.ts",
    "apps/web/components/design/quiet-primitives.css",
    "apps/web/components/design/icon-registry.ts",
    "apps/web/components/marketing/ds/use-interaction-media.ts",
    "apps/web/components/marketing/faq-items.ts",
    "apps/web/components/marketing/landing-content.ts",
    "apps/web/components/marketing/use-signed-in.ts",
    "apps/web/assets/fonts/quiet-authority/dm-sans-700-latin.ttf",
    "apps/web/assets/fonts/quiet-authority/eb-garamond-600-latin.ttf",
    "apps/mobile/eas.json",
    ".github/workflows/android-native-compile.yml",
    ".github/workflows/ci.yml",
    "package.json",
    "scripts/channel-evidence-contract.mts",
    "scripts/evidence-receipt-loader.mts",
    "scripts/marketing-production-check.mts",
    "scripts/marketing-production-check.test.mts",
    "scripts/native-interface-gauntlet.mts",
    "scripts/provider-handoff-contract.mts",
    "scripts/seo-contract-check.mts",
  ]) assert.ok(paths.has(path), `unclassified exact design source: ${path}`);
});

test("user-visible copy, policy, and narrative modules stay in brand inventory", () => {
  const paths = new Set(manifest.surfaces.flatMap((surface) => surface.paths));
  for (const path of [
    "apps/web/app/app/assistant-text.ts",
    "apps/web/app/app/onboarding-chat.ts",
    "apps/web/app/app/outbound-child-framing-display.ts",
    "apps/web/app/app/progress-message-parts.ts",
    "apps/web/app/app/tasks/agent-job-view.ts",
    "apps/web/app/app/tasks/task-copy.ts",
    "apps/web/app/app/transcript-days.ts",
    "apps/web/app/onboarding/sample/narrative.fixture.ts",
    "apps/web/app/onboarding/sample/sample-answers.ts",
    "apps/web/app/privacy/subprocessors.ts",
    "apps/web/app/signin/auth-copy.ts",
    "apps/web/components/billing/wall-copy.ts",
    "apps/web/components/marketing/ds/use-interaction-media.ts",
    "apps/web/components/marketing/faq-items.ts",
    "apps/web/components/marketing/landing-content.ts",
    "apps/web/components/marketing/use-signed-in.ts",
  ]) assert.ok(paths.has(path), `unclassified user-visible source: ${path}`);
});

test("published blog sources are independently discovered and classified as public", () => {
  const byPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));
  const publishedSources = git(
    "ls-files",
    "--",
    "apps/web/app/blog",
    "apps/web/content/blog",
    "apps/web/lib/blog.ts",
    "apps/web/lib/blog-clusters.ts",
  ).split("\n").filter((path) => path && !path.endsWith("/.gitkeep"));
  assert.ok(publishedSources.length >= 8, "expected the public blog publishing system");

  for (const path of publishedSources) {
    const surface = byPath.get(path);
    assert.ok(surface, `public blog source missing from manifest: ${path}`);
    assert.equal(surface.reachability, "public", path);
    assert.ok(surface.audiences.includes("public"), path);
    assert.equal(surface.deliveryState, "revocable-public", path);
    assert.equal(surface.ownerIssue, "gh#683", path);
  }

  const expectedTypes = new Map<string, BrandSurfaceManifest["surfaces"][number]["type"]>([
    ["apps/web/app/blog/page.tsx", "route"],
    ["apps/web/app/blog/page/[page]/page.tsx", "route"],
    ["apps/web/app/blog/[slug]/page.tsx", "route"],
    ["apps/web/app/blog/topics/[cluster]/page.tsx", "route"],
    ["apps/web/app/blog/rss.xml/route.ts", "renderer"],
    ["apps/web/content/blog/how-to-track-homeschool-hours-without-losing-the-week.mdx", "template"],
    ["apps/web/lib/blog.ts", "generator"],
    ["apps/web/lib/blog-clusters.ts", "generator"],
  ]);
  for (const [path, type] of expectedTypes) assert.equal(byPath.get(path)?.type, type, path);
  assert.deepEqual(byPath.get("apps/web/app/blog/rss.xml/route.ts")?.audiences, ["public", "provider"]);
});

test("web route reachability follows the structural proxy boundary", () => {
  const proxySource = readFileSync(resolve(root, "apps/web/proxy.ts"), "utf8");
  const sessionProxySource = readFileSync(
    resolve(root, "apps/web/lib/supabase/session-proxy.ts"),
    "utf8",
  );
  const proxyDefinitions = [
    ...proxySource.matchAll(
      /^export async function proxy\(request: NextRequest\) \{\n([\s\S]*?)^\}/gmu,
    ),
  ];
  assert.equal(proxyDefinitions.length, 1, "expected one exported proxy function");
  assert.equal(
    proxyDefinitions[0]?.[1]?.trim(),
    "return handleSessionProxy(request);",
    "the exported proxy must delegate without a bypass",
  );
  assert.match(
    sessionProxySource,
    /path === "\/app" \|\| path\.startsWith\("\/app\/"\)/,
  );

  const matcherLiteral = proxySource.match(
    /matcher:\s*\[\s*("(?:\\.|[^"\\])*")\s*,?\s*\]/u,
  )?.[1];
  assert.ok(matcherLiteral, "expected one static proxy matcher");
  const matcher = JSON.parse(matcherLiteral) as string;
  Object.assign(globalThis, { AsyncLocalStorage });
  const webRequire = createRequire(resolve(root, "apps/web/package.json"));
  const { unstable_doesMiddlewareMatch: unstableDoesProxyMatch } = webRequire(
    "next/experimental/testing/server",
  ) as {
    unstable_doesMiddlewareMatch(input: {
      config: { matcher: string[] };
      url: string;
    }): boolean;
  };
  const matcherConfig = { matcher: [matcher] };
  assert.equal(unstableDoesProxyMatch({ config: matcherConfig, url: "/app" }), true);
  assert.equal(
    unstableDoesProxyMatch({ config: matcherConfig, url: "/app/report" }),
    true,
  );
  assert.equal(
    unstableDoesProxyMatch({ config: matcherConfig, url: "/signin" }),
    true,
  );
  assert.equal(
    unstableDoesProxyMatch({ config: matcherConfig, url: "/api/map" }),
    false,
  );
  assert.equal(
    unstableDoesProxyMatch({
      config: matcherConfig,
      url: "/_next/static/chunks/app.js",
    }),
    false,
  );

  const routeFileNames = new Set([
    "apple-icon.tsx",
    "error.tsx",
    "global-error.tsx",
    "layout.tsx",
    "loading.tsx",
    "not-found.tsx",
    "opengraph-image.tsx",
    "page.tsx",
    "twitter-image.tsx",
  ]);
  const routeSources = git("ls-files", "--", "apps/web/app")
    .split("\n")
    .filter((path) => routeFileNames.has(path.split("/").at(-1) ?? ""));
  const byPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));

  for (const path of routeSources) {
    const parts = path.slice("apps/web/app/".length).split("/");
    parts.pop();
    const first = parts.filter((segment) =>
      !(segment.startsWith("(") && segment.endsWith(")"))
      && !segment.startsWith("@"))[0] ?? "";
    const surface = byPath.get(path);
    assert.ok(surface, `web route source missing from manifest: ${path}`);
    assert.equal(surface.type, "route", path);
    if (first === "app") {
      assert.equal(surface.reachability, "authenticated", path);
      assert.ok(surface.audiences.includes("family"), path);
      assert.equal(surface.deliveryState, "controlled-current", path);
    } else if (first === "admin") {
      assert.equal(surface.reachability, "authenticated", path);
      assert.deepEqual(surface.audiences, ["operator"], path);
      assert.equal(surface.deliveryState, "controlled-current", path);
    } else if (first === "dev" || first === "app2") {
      assert.equal(surface.reachability, "internal", path);
      assert.deepEqual(surface.audiences, ["developer"], path);
      assert.equal(surface.deliveryState, "controlled-current", path);
    } else {
      assert.equal(surface.reachability, "public", path);
      assert.ok(surface.audiences.includes("public"), path);
      assert.equal(surface.deliveryState, "revocable-public", path);
    }
  }

  for (const path of [
    "apps/web/app/page.tsx",
    "apps/web/app/layout.tsx",
    "apps/web/app/error.tsx",
    "apps/web/app/not-found.tsx",
    "apps/web/app/opengraph-image.tsx",
    "apps/web/app/apple-icon.tsx",
    "apps/web/app/features/[slug]/page.tsx",
    "apps/web/app/privacy/page.tsx",
    "apps/web/app/terms/page.tsx",
    "apps/web/app/signin/page.tsx",
    "apps/web/app/forgot-password/page.tsx",
    "apps/web/app/reset-password/page.tsx",
    "apps/web/app/reset-password/confirm/page.tsx",
    "apps/web/app/join/page.tsx",
  ]) assert.equal(byPath.get(path)?.reachability, "public", path);
  assert.equal(byPath.get("apps/web/app/app/page.tsx")?.reachability, "authenticated");
  assert.deepEqual(byPath.get("apps/web/app/admin/page.tsx")?.audiences, ["operator"]);
  assert.equal(byPath.get("apps/web/app/dev/reset/page.tsx")?.reachability, "internal");
});

test("route groups and slots stay neutral while interceptors fail closed", () => {
  const fixtures = new Map<string, ReturnType<typeof classifyGeneratedWebRouteBoundary>>([
    ["apps/web/app/(marketing)/page.tsx", "public"],
    ["apps/web/app/app2/page.tsx", "developer"],
    ["apps/web/app/app20/page.tsx", "public"],
    ["apps/web/app/(shell)/app/page.tsx", "family"],
    ["apps/web/app/@modal/app/page.tsx", "family"],
    ["apps/web/app/@modal/(.)app/page.tsx", "intercept-unresolved"],
    ["apps/web/app/foo/@modal/(..)app/page.tsx", "intercept-unresolved"],
    ["apps/web/app/foo/bar/@modal/(..)(..)app/page.tsx", "intercept-unresolved"],
    ["apps/web/app/@modal/(...)admin/page.tsx", "intercept-unresolved"],
    ["apps/web/app/@modal/(.)dev/page.tsx", "intercept-unresolved"],
  ]);

  for (const [path, expected] of fixtures) {
    assert.equal(classifyGeneratedWebRouteBoundary(path), expected, `generator: ${path}`);
    assert.equal(classifyValidatedWebRouteBoundary(path), expected, `validator: ${path}`);
  }
  assert.doesNotThrow(() => assertNoUnresolvedInterceptingRoutes([
    "apps/web/app/(marketing)/page.tsx",
    "apps/web/app/(shell)/app/page.tsx",
    "apps/web/app/@modal/app/page.tsx",
  ]));
  assert.throws(
    () => assertNoUnresolvedInterceptingRoutes([...fixtures.keys()]),
    /Intercepting web route source requires an explicit reviewed runtime boundary/,
  );
});

test("provider handoffs bind every governing source into the hashed inventory", () => {
  const byPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));
  for (const path of [
    "apps/web/lib/billing/portal.ts",
    "apps/web/lib/billing/wall.ts",
    "apps/web/lib/billing/apple-verify.ts",
    "apps/web/lib/supabase/server.ts",
    "apps/web/lib/supabase/client.ts",
    "apps/web/.env.example",
  ]) {
    const surface = byPath.get(path);
    assert.ok(surface, `missing provider governing source: ${path}`);
    assert.equal(surface.ownerIssue, "gh#732");
    assert.deepEqual(surface.targetProfiles, ["provider-constrained"]);
    assert.match(surface.currentAssetHashes[0] ?? "", /^[0-9a-f]{64}$/);
  }
});

test("inventory and residue discovery include untracked non-ignored authoring inputs", () => {
  const inventorySource = readFileSync(resolve(root, "scripts/brand-surfaces.mts"), "utf8");
  const residueSource = readFileSync(resolve(root, "scripts/brand-residue-check.mts"), "utf8");
  for (const source of [inventorySource, residueSource]) {
    assert.match(source, /ls-files[^\n]+--cached[^\n]+--others[^\n]+--exclude-standard/);
  }
});

test("semantic account and delivery catch-alls are split into exact rows", () => {
  const paths = new Set(manifest.surfaces.flatMap((surface) => surface.paths));
  for (const path of [
    "provider:social-accounts",
    "historical:delivered-email-sms-print-mail",
    "profile:required-third-party-marks",
  ]) assert.equal(paths.has(path), false, `semantic catch-all survived: ${path}`);
  for (const path of [
    "provider:social-instagram-thankshoma",
    "provider:social-tiktok-thankshoma",
    "provider:social-pinterest-thankshoma",
    "provider:social-facebook-thankshoma",
    "provider:social-youtube-thankshoma",
    "provider:social-x-thankshoma",
    "provider:google-identity",
    "provider:apple-identity",
    "provider:apple-subscription-management",
    "historical:resend-delivered-message-archive",
    "historical:telnyx-delivered-message-archive",
    "historical:family-generated-artifact-revisions",
    "historical:handwrytten-template-349914-mailed-copies",
    "profile:apple-sign-in-provider-mark",
    "profile:google-sign-in-provider-mark",
    "profile:apple-app-store-download-badge",
  ]) assert.ok(paths.has(path), `missing exact external row: ${path}`);
});

test("critical externally owned surfaces require a provider rollback rail", () => {
  const external = manifest.surfaces.filter((surface) => surface.reachability === "external");
  assert.ok(external.length > 0);
  for (const surface of external) {
    assert.ok(brandCriticalities.includes(surface.criticality));
    assert.ok(surface.rollbackBoundary.includes("provider") || surface.rollbackBoundary.includes("artifact"));
  }
});

test("manifest uses only the approved contract enums and records owned-input freshness", () => {
  assert.match(manifest.baselineSourceCommit, /^[0-9a-f]{40}$/);
  assert.match(manifest.ownedInputFingerprint, /^[0-9a-f]{64}$/);
  for (const surface of manifest.surfaces) {
    assert.ok(brandCriticalities.includes(surface.criticality));
    assert.ok(brandDispositions.includes(surface.disposition));
    assert.ok(brandDeliveryStates.includes(surface.deliveryState));
    assert.ok(surface.requiredStates.includes("default"));
    assert.equal(surface.ownerIssue.startsWith("gh#"), true);
    assert.ok(Array.isArray(surface.consumers));
    if (["authoring-rule", "agent-skill", "prompt", "evaluator", "golden-fixture"].includes(surface.type)) assert.ok(surface.consumers.length > 0, `missing consumers: ${surface.paths[0]}`);
  }
});

test("source provenance binds the exact path commit and never impersonates observation", () => {
  for (const surface of manifest.surfaces) {
    const { observedAt, sourceCommitSha, sourceCommitTimestamp, environment } = surface.evidenceMetadata;
    assert.equal(observedAt, null, surface.paths[0]);
    if (surface.currentAssetHashes.length === 0) {
      assert.equal(environment, "inventory-only-no-external-observation", surface.paths[0]);
      assert.equal(sourceCommitSha, null, surface.paths[0]);
      assert.equal(sourceCommitTimestamp, null, surface.paths[0]);
    } else if (workingTreePaths.has(surface.paths[0]!)) {
      assert.equal(environment, "working-tree-uncommitted", surface.paths[0]);
      assert.equal(sourceCommitSha, null, surface.paths[0]);
      assert.equal(sourceCommitTimestamp, null, surface.paths[0]);
    } else {
      const expected = latestCommittedSource.get(surface.paths[0]!);
      assert.ok(expected, `missing Git provenance for ${surface.paths[0]}`);
      assert.equal(environment, "git-source-commit", surface.paths[0]);
      assert.equal(sourceCommitSha, expected.sha, surface.paths[0]);
      assert.equal(sourceCommitTimestamp, expected.committedAt, surface.paths[0]);
      assert.equal(Number.isNaN(Date.parse(sourceCommitTimestamp ?? "")), false, surface.paths[0]);
    }
  }
});

test("legacy signals are named and never silently discarded", () => {
  const signaled = manifest.surfaces.filter((surface) => surface.legacySignatures.length > 0);
  assert.ok(signaled.length > 0, "expected the baseline to find legacy identity signals");
  for (const surface of signaled) {
    for (const signal of surface.legacySignatures) assert.match(signal, /^legacy-/);
  }
});

test("every full-audit residue path has one exact manifest row and one removal-ledger row", () => {
  const surfacesByPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));
  const ledgerBySurface = new Map(removalLedger.records.map((record) => [record.surfaceId, record]));
  const findings = collectBrandResidueFindings("full");
  const fontPaths = collectLegacyFontPathResidue("full");
  const residuePaths = new Set([...findings.map((finding) => finding.path), ...fontPaths]);
  assert.ok(residuePaths.size > 0, "expected the exhaustive audit to retain an honest removal queue");

  for (const path of residuePaths) {
    const surface = surfacesByPath.get(path);
    assert.ok(surface, `full-audit path missing exact manifest row: ${path}`);
    assert.equal(surface.paths.length, 1, `residue row must bind one exact path: ${path}`);
    const record = ledgerBySurface.get(surface.id);
    assert.ok(record, `full-audit path missing removal-ledger row: ${path}`);
    assert.equal(record.path, path);
  }
  for (const finding of findings) {
    assert.ok(surfacesByPath.get(finding.path)?.legacySignatures.includes(finding.signature),
      `manifest dropped ${finding.signature} from ${finding.path}`);
  }
  for (const path of fontPaths) {
    assert.ok(surfacesByPath.get(path)?.legacySignatures.includes(LEGACY_FONT_PATH_SIGNATURE),
      `manifest dropped ${LEGACY_FONT_PATH_SIGNATURE} from ${path}`);
  }
});

test("legacy-only historical documents are quarantined as private provenance", () => {
  const historical = manifest.surfaces.filter((surface) => surface.targetProfiles.includes("historical-private-provenance"));
  assert.deepEqual(
    historical.map((surface) => surface.paths[0]!).sort(stableCompare),
    historicalBrandQuarantineRecords.map((record) => record.path).sort(stableCompare),
  );
  for (const surface of historical) {
    assert.equal(surface.reachability, "internal");
    assert.equal(surface.deliveryState, "private-provenance");
    assert.equal(surface.disposition, "historical-git-only");
    assert.equal(surface.ownerIssue, "gh#729");
    assert.equal(surface.productionProbe, "static:production-bundle-index-and-active-discovery-excluded");
    assert.equal(surface.rollbackBoundary, "git-quarantine");
    for (const requirement of ["production-bundle-exclusion", "index-exclusion", "active-discovery-exclusion"]) {
      assert.ok(surface.requiredEvidence.includes(requirement), `${surface.paths[0]} missing ${requirement}`);
    }
  }
});

test("every quarantined path is historical in the active documentation registry", () => {
  const documentationManifest = readFileSync(
    resolve(root, historicalQuarantineDocumentationManifestPath),
    "utf8",
  );
  const violations = collectHistoricalQuarantineIndexViolations(new Map([
    [historicalQuarantineDocumentationManifestPath, documentationManifest],
  ]));
  assert.deepEqual(violations, []);
});

test("active authoring discovery catches new indexes without treating evidence as guidance", () => {
  assert.equal(isActiveAuthoringIndexOrRegistryPath("docs/new-area/README.md"), true);
  assert.equal(isActiveAuthoringIndexOrRegistryPath("data/new-domain/registry.json"), true);
  assert.equal(isActiveAuthoringIndexOrRegistryPath("apps/web/lib/new-domain/catalog.ts"), true);
  assert.equal(isActiveAuthoringIndexOrRegistryPath(".agents/skills/example/SKILL.md"), true);
  assert.equal(isActiveAuthoringIndexOrRegistryPath("docs/homa-design/evidence/surfaces.json"), false);
  assert.equal(isActiveAuthoringIndexOrRegistryPath(historicalBrandQuarantineRecords[0]!.path), false);
});

test("active authoring indexes cannot rediscover quarantined guidance", () => {
  const quarantinePath = historicalBrandQuarantineRecords[0]!.path;
  const documentationManifest = [
    "path\tauthority_class\tlifecycle\tdisposition\tevidence\tnotes",
    `${quarantinePath}\thistorical-record\thistorical\tunresolved\tExact historical quarantine registry gh#729.\tPrivate provenance only; not live guidance.`,
  ].join("\n");
  const violations = collectHistoricalQuarantineIndexViolations(
    new Map([
      [historicalQuarantineDocumentationManifestPath, documentationManifest],
      ["docs/new-area/README.md", `Use ${quarantinePath} as the current design source.`],
      ["docs/homa-design/evidence/surfaces.json", quarantinePath],
    ]),
    new Set([quarantinePath]),
  );
  assert.deepEqual(violations, [
    `Active authoring index references historical quarantine: docs/new-area/README.md -> ${quarantinePath}`,
  ]);
});

test("documentation registry labels cannot make quarantined bytes live guidance", () => {
  const quarantinePath = historicalBrandQuarantineRecords[0]!.path;
  const badManifest = [
    "path\tauthority_class\tlifecycle\tdisposition\tevidence\tnotes",
    `${quarantinePath}\tlive-guidance\tcurrent\tretain-current\tCurrent guide.\tUse this now.`,
  ].join("\n");
  const violations = collectHistoricalQuarantineIndexViolations(
    new Map([[historicalQuarantineDocumentationManifestPath, badManifest]]),
    new Set([quarantinePath]),
  );
  assert.ok(violations.some((violation) => violation.includes("exposes") && violation.includes(quarantinePath)));
});

test("canonical active authorities cannot enter historical quarantine", () => {
  const byPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));
  for (const path of [
    "docs/homa-curriculum-atlas/materials-patterns.md",
    "docs/homa-planning/build-log.md",
    "docs/homa-planning/journeys/04-feature-journeys.md",
    "docs/homa-planning/journeys/10-reconciliation.md",
    "docs/homa-planning/plans/2026-08-02-homa-interface-modernization.md",
  ]) {
    const surface = byPath.get(path);
    assert.ok(surface, `active authority missing from manifest: ${path}`);
    assert.equal(surface.disposition, "replace-active", path);
    assert.equal(surface.ownerIssue, "gh#729", path);
    assert.equal(surface.targetProfiles.includes("historical-private-provenance"), false, path);
  }
});

test("legacy baseline is hash-specific and quarantined by design era", () => {
  assert.equal(legacyBaseline.designEra, "warm-playful-baseline");
  assert.equal(legacyBaseline.sourceCommit, manifest.baselineSourceCommit);
  assert.ok(legacyBaseline.records.length > 0);
  for (const record of legacyBaseline.records) {
    assert.match(record.path, /\S/);
    assert.match(record.sourceHash ?? "", /^[0-9a-f]{64}$/);
    assert.ok(record.legacySignatures.length > 0);
  }
});

test("the active onboarding artwork recipe remains classified and its residue stays visible", () => {
  const surface = manifest.surfaces.find((candidate) =>
    candidate.paths.includes("work/onboardingandpaywall8-30/assets/making-feature-cards/MANIFEST.md"));
  assert.ok(surface);
  assert.equal(surface.type, "authoring-rule");
  assert.equal(surface.reachability, "internal");
  assert.equal(surface.disposition, "replace-active");
  assert.deepEqual(surface.targetProfiles, ["authoring"]);
  assert.ok(surface.legacySignatures.length > 0);
});
