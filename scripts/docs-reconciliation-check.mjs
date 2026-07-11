import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
  win32,
} from "node:path";

const MANIFEST_PATH =
  "docs/homa-planning/reconciliation/documentation-manifest.tsv";
const CLAIM_LEDGER_PATH =
  "docs/homa-planning/reconciliation/claim-ledger.tsv";

const PROHIBITED_PREFIXES = [
  "homa-macmini/",
  "homa-research/",
  "homa-template/",
];

const REPOSITORY_PATHSPECS = [
  ".",
  ...PROHIBITED_PREFIXES.flatMap((prefix) => {
    const root = prefix.slice(0, -1);
    return [`:(exclude)${root}`, `:(exclude)${root}/**`];
  }),
];

const INTENTIONAL_DOCUMENTATION_FILES = new Map([
  [
    ".github/workflows/ci.yml",
    {
      format: "yaml-workflow",
      area: "governance",
      authorityClass: "governance",
      topic: "continuous-integration-contract",
      claimScope:
        "Human-authored CI trigger, command, runtime, secret-name, and incident-rationale claims; executable workflow behavior is also repository evidence.",
    },
  ],
  [
    "apps/mobile/.env.example",
    {
      format: "env-example",
      area: "mobile",
      authorityClass: "live-guidance",
      topic: "mobile-environment-reference",
      claimScope:
        "Human-authored environment variable names, exposure boundaries, defaults, commands, route references, and configuration guidance.",
    },
  ],
  [
    "apps/web/.env.example",
    {
      format: "env-example",
      area: "web",
      authorityClass: "live-guidance",
      topic: "web-environment-reference",
      claimScope:
        "Human-authored environment variable names, exposure boundaries, defaults, enablement gates, commands, route references, and configuration guidance.",
    },
  ],
  [
    "scripts/telnyx-provision.mts",
    {
      format: "typescript",
      area: "operations",
      authorityClass: "runbook",
      topic: "telnyx-provisioning-runbook",
      claimScope:
        "Human-authored provisioning order, command, environment, cost, idempotency, status, and exit-code contract; executable behavior is also repository evidence.",
    },
  ],
]);

const MARKETING_META_MANIFESTS = new Set([
  "marketing/content/drafts/2026-07-05-how-to-track-homeschool-hours/meta.yml",
  "marketing/content/drafts/2026-07-05-ugc-homa-intro/meta.yml",
  "marketing/evals/fixtures/failing-bundle/meta.yml",
  "marketing/evals/fixtures/passing-bundle/meta.yml",
]);

const MARBLE_LEGAL_FILES = new Set([
  "docs/homa-benchmarks/marble/LICENSE",
  "docs/homa-benchmarks/marble/LICENSE-CONTENT",
]);

const HOMA_AUTHORED_MARBLE_DOCUMENTATION = new Set([
  "docs/homa-benchmarks/marble/README-HOMA.md",
]);

const GENERATED_DESIGN_ARTIFACTS = new Set([
  "docs/homa-design/_adherence.oxlintrc.json",
  "docs/homa-design/_ds_bundle.js",
  "docs/homa-design/_ds_manifest.json",
]);

const GENERATED_DOCUMENTATION = new Set([
  "marketing/evals/scorecards/2026-07-05-how-to-track-homeschool-hours.md",
  "marketing/evals/scorecards/2026-07-05-ugc-homa-intro.md",
]);

const MIXED_HISTORICAL_DOCUMENTATION = new Set([
  "docs/homa-planning/materials/calibration/2026-07-10/report.md",
]);

const GENERATED_ARTIFACTS = new Set([
  ...GENERATED_DESIGN_ARTIFACTS,
  ...GENERATED_DOCUMENTATION,
]);

const ALIASES = new Map([
  [
    "CLAUDE.md",
    {
      form: "symlink",
      target: "AGENTS.md",
      topic: "repository-agent-governance",
    },
  ],
  [
    "apps/mobile/CLAUDE.md",
    {
      form: "symlink",
      target: "AGENTS.md",
      topic: "mobile-agent-governance",
    },
  ],
  [
    "apps/web/CLAUDE.md",
    {
      form: "literal-wrapper",
      target: "AGENTS.md",
      literal: "@AGENTS.md\n",
      topic: "web-agent-governance",
    },
  ],
]);

const REQUIRED_SPECIAL_PATHS = new Set([
  ...MARKETING_META_MANIFESTS,
  ...MARBLE_LEGAL_FILES,
  ...GENERATED_ARTIFACTS,
  ...MIXED_HISTORICAL_DOCUMENTATION,
  ...HOMA_AUTHORED_MARBLE_DOCUMENTATION,
  ...INTENTIONAL_DOCUMENTATION_FILES.keys(),
  ...ALIASES.keys(),
]);

const MANIFEST_COLUMNS = [
  "path",
  "starting_state",
  "format",
  "area",
  "authority_class",
  "lifecycle",
  "canonical_topic",
  "claim_scope",
  "evidence",
  "disposition",
  "notes",
];

const ENUMS = {
  starting_state: new Set([
    "tracked",
    "pre-existing-untracked",
    "audit-created",
  ]),
  format: new Set([
    "markdown",
    "mdx",
    "text",
    "html",
    "cff",
    "yaml-manifest",
    "license",
    "tsv",
    "generated-json",
    "generated-javascript",
    "yaml-workflow",
    "env-example",
    "typescript",
  ]),
  area: new Set([
    "governance",
    "agents",
    "web",
    "mobile",
    "data",
    "design",
    "benchmarks",
    "audit",
    "planning",
    "documentation",
    "ideation",
    "marketing",
    "packages",
    "database",
    "operations",
  ]),
  authority_class: new Set([
    "alias",
    "generated",
    "vendored",
    "audit-control",
    "governance",
    "product-contract",
    "founder-ruling-record",
    "historical-record",
    "plan",
    "runbook",
    "specialist-instruction",
    "design-source",
    "benchmark-source",
    "public-summary",
    "marketing-working",
    "data-documentation",
    "package-documentation",
    "legal-provenance",
    "live-guidance",
    "planning-source",
  ]),
  lifecycle: new Set([
    "in-progress",
    "audit-active",
    "current",
    "upcoming",
    "historical",
    "archived",
    "removed",
    "generated",
    "vendored",
    "alias",
  ]),
  disposition: new Set([
    "unresolved",
    "audit-active",
    "retain-current",
    "retain-upcoming",
    "historical-annotated",
    "consolidated-canonical",
    "relocated",
    "archived",
    "deleted",
    "generated-excluded",
    "vendored-frozen",
    "alias",
  ]),
};

const OPEN_LIFECYCLES = new Set(["in-progress", "audit-active"]);
const OPEN_DISPOSITIONS = new Set(["unresolved", "audit-active"]);
const MANIFEST_ONLY_TERMINAL_STATES = new Map([
  ["deleted", new Set(["removed"])],
  ["relocated", new Set(["removed"])],
  ["archived", new Set(["archived"])],
]);
const OPEN_CLAIM_STATUSES = new Set([
  "in-progress",
  "open",
  "pending",
  "unresolved",
]);

function runGit(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function parseNullSeparated(value) {
  return value.split("\0").filter(Boolean);
}

function isProhibitedPath(path) {
  return PROHIBITED_PREFIXES.some((prefix) => {
    const root = prefix.slice(0, -1);
    return path === root || path.startsWith(prefix);
  });
}

function assertSafeCandidate(path) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.includes("\0") ||
    path.includes("\r") ||
    path.includes("\n")
  ) {
    throw new Error(`Rejected unsafe documentation candidate: ${path}`);
  }

  const portablePath = path.replaceAll("\\", "/");
  const normalizedPath = posix.normalize(portablePath);
  const segments = portablePath.split("/");
  const isNoncanonical =
    portablePath !== path ||
    normalizedPath !== path ||
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    );

  if (
    isAbsolute(path) ||
    win32.isAbsolute(path) ||
    isNoncanonical ||
    isProhibitedPath(normalizedPath)
  ) {
    throw new Error(`Rejected unsafe documentation candidate: ${path}`);
  }
}

function toRepositoryPath(path) {
  return path.split(sep).join("/");
}

function isOutsideRepository(path) {
  return path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
}

function resolveSafeExistingPath(repoRoot, repositoryPath, purpose) {
  const isRepositoryRoot = repositoryPath === ".";
  if (!isRepositoryRoot) assertSafeCandidate(repositoryPath);
  const absolutePath = isRepositoryRoot
    ? resolve(repoRoot)
    : resolve(repoRoot, repositoryPath);
  const resolvedRoot = realpathSync(repoRoot);
  const resolvedPath = realpathSync(absolutePath);
  const relativePath = relative(resolvedRoot, resolvedPath);

  if (isOutsideRepository(relativePath)) {
    throw new Error(`${purpose} resolves outside the repository: ${repositoryPath}`);
  }

  const resolvedRepositoryPath = toRepositoryPath(relativePath);
  if (resolvedRepositoryPath && isProhibitedPath(resolvedRepositoryPath)) {
    throw new Error(
      `${purpose} resolves into a prohibited repository root: ${repositoryPath}`,
    );
  }

  return { absolutePath, resolvedPath, resolvedRepositoryPath };
}

function auditControlFile(repoRoot, repositoryPath, errors) {
  assertSafeCandidate(repositoryPath);
  const absolutePath = resolve(repoRoot, repositoryPath);
  let stat;

  try {
    stat = lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    errors.push(`Cannot inspect audit control ${repositoryPath}: ${error.message}`);
    return undefined;
  }

  if (!stat.isFile()) {
    errors.push(`${repositoryPath} must be a regular audit-control file`);
    return undefined;
  }

  try {
    resolveSafeExistingPath(repoRoot, repositoryPath, "Audit control");
  } catch (error) {
    errors.push(error.message);
    return undefined;
  }

  return absolutePath;
}

function repositoryTargetForAlias(aliasPath, target) {
  if (isAbsolute(target)) {
    throw new Error(`${aliasPath} has an absolute alias target: ${target}`);
  }

  const targetPath = toRepositoryPath(join(dirname(aliasPath), target));
  assertSafeCandidate(targetPath);
  return targetPath;
}

function isVendoredMarbleDocumentation(path) {
  return (
    path.startsWith("docs/homa-benchmarks/marble/") &&
    !HOMA_AUTHORED_MARBLE_DOCUMENTATION.has(path)
  );
}

function verifyProhibitedGuard() {
  for (const prefix of PROHIBITED_PREFIXES) {
    if (!isProhibitedPath(`${prefix}guard-probe.md`)) {
      throw new Error(`Prohibited-prefix guard is inactive for ${prefix}`);
    }
  }

  if (isProhibitedPath("docs/homa-template-notes.md")) {
    throw new Error("Prohibited-prefix guard rejected a safe near-match");
  }

  const safeProbes = [
    ".github/workflows/ci.yml",
    "AGENTS.md",
    "apps/web/.env.example",
    "docs/homa-template-notes.md",
  ];
  for (const probe of safeProbes) {
    assertSafeCandidate(probe);
  }

  const unsafeProbes = [
    "homa-template/example.md",
    "./homa-template/example.md",
    "homa-template//example.md",
    "homa-template\\example.md",
    "homa-template/./example.md",
    "docs/../homa-template/example.md",
    "./docs/example.md",
    "docs//example.md",
    "docs\\example.md",
    "docs/./example.md",
    "docs/../docs/example.md",
    "docs/",
    "/docs/example.md",
    "C:/docs/example.md",
    "../docs/example.md",
  ];
  for (const probe of unsafeProbes) {
    let rejected = false;
    try {
      assertSafeCandidate(probe);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`Unsafe-path guard accepted noncanonical probe: ${probe}`);
    }
  }
}

function isDocumentationCandidate(path) {
  const lowerPath = path.toLowerCase();
  const hasDocumentationExtension = [
    ".md",
    ".mdx",
    ".txt",
    ".html",
    ".cff",
  ].some((extension) => lowerPath.endsWith(extension));

  return (
    hasDocumentationExtension ||
    INTENTIONAL_DOCUMENTATION_FILES.has(path) ||
    MARKETING_META_MANIFESTS.has(path) ||
    MARBLE_LEGAL_FILES.has(path) ||
    (path.startsWith("docs/homa-planning/reconciliation/") &&
      lowerPath.endsWith(".tsv")) ||
    GENERATED_DESIGN_ARTIFACTS.has(path)
  );
}

function isAuditCreated(path) {
  return (
    path ===
      "docs/homa-planning/plans/2026-07-11-documentation-reconciliation.md" ||
    path.startsWith("docs/homa-planning/reconciliation/")
  );
}

function collectCandidates(repoRoot, { includeManifestForBootstrap = false } = {}) {
  const tracked = parseNullSeparated(
    runGit(repoRoot, [
      "ls-files",
      "--cached",
      "-z",
      "--",
      ...REPOSITORY_PATHSPECS,
    ]),
  );
  const untracked = parseNullSeparated(
    runGit(repoRoot, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...REPOSITORY_PATHSPECS,
    ]),
  );

  const candidates = new Map();

  for (const path of tracked) {
    assertSafeCandidate(path);
    if (isDocumentationCandidate(path)) {
      candidates.set(path, "tracked");
    }
  }

  for (const path of untracked) {
    assertSafeCandidate(path);
    if (isDocumentationCandidate(path) && !candidates.has(path)) {
      candidates.set(
        path,
        isAuditCreated(path) ? "audit-created" : "pre-existing-untracked",
      );
    }
  }

  if (includeManifestForBootstrap && !candidates.has(MANIFEST_PATH)) {
    candidates.set(MANIFEST_PATH, "audit-created");
  }

  return candidates;
}

function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function formatForPath(path) {
  const intentionalDocumentation = INTENTIONAL_DOCUMENTATION_FILES.get(path);
  if (intentionalDocumentation) return intentionalDocumentation.format;
  if (MARKETING_META_MANIFESTS.has(path)) return "yaml-manifest";
  if (MARBLE_LEGAL_FILES.has(path)) return "license";
  if (path.endsWith(".tsv")) return "tsv";
  if (path.endsWith(".json")) return "generated-json";
  if (path.endsWith(".js")) return "generated-javascript";
  if (path.toLowerCase().endsWith(".mdx")) return "mdx";
  if (path.toLowerCase().endsWith(".md")) return "markdown";
  if (path.toLowerCase().endsWith(".txt")) return "text";
  if (path.toLowerCase().endsWith(".html")) return "html";
  if (path.toLowerCase().endsWith(".cff")) return "cff";
  throw new Error(`No manifest format is defined for ${path}`);
}

function areaForPath(path) {
  const intentionalDocumentation = INTENTIONAL_DOCUMENTATION_FILES.get(path);
  if (intentionalDocumentation) return intentionalDocumentation.area;
  if (!path.includes("/")) return "governance";
  if (path.startsWith(".agents/")) return "agents";
  if (path.startsWith(".github/")) return "governance";
  if (path.startsWith("apps/web/")) return "web";
  if (path.startsWith("apps/mobile/")) return "mobile";
  if (path.startsWith("data/")) return "data";
  if (path.startsWith("docs/homa-design/")) return "design";
  if (path.startsWith("docs/homa-benchmarks/")) return "benchmarks";
  if (path.startsWith("docs/homa-planning/reconciliation/")) return "audit";
  if (path.startsWith("docs/homa-planning/")) return "planning";
  if (path.startsWith("docs/")) return "documentation";
  if (path.startsWith("ideation/")) return "ideation";
  if (path.startsWith("marketing/")) return "marketing";
  if (path.startsWith("packages/")) return "packages";
  if (path.startsWith("scripts/")) return "operations";
  if (path.startsWith("supabase/")) return "database";
  throw new Error(`No manifest area is defined for ${path}`);
}

function authorityForPath(path) {
  if (ALIASES.has(path)) return "alias";
  const intentionalDocumentation = INTENTIONAL_DOCUMENTATION_FILES.get(path);
  if (intentionalDocumentation) {
    return intentionalDocumentation.authorityClass;
  }
  if (MIXED_HISTORICAL_DOCUMENTATION.has(path)) {
    return "historical-record";
  }
  if (GENERATED_ARTIFACTS.has(path)) return "generated";
  if (isVendoredMarbleDocumentation(path)) return "vendored";
  if (path.startsWith("docs/homa-planning/reconciliation/")) {
    return "audit-control";
  }
  if (path === "docs/homa-planning/13-mr-prd.md") {
    return "product-contract";
  }
  if (path === "docs/homa-planning/journeys/10-reconciliation.md") {
    return "founder-ruling-record";
  }
  if (path === "docs/homa-planning/build-log.md") {
    return "historical-record";
  }
  if (path.includes("/runbooks/")) return "runbook";
  if (path.includes("/plans/")) return "plan";
  if (
    path === "AGENTS.md" ||
    path.endsWith("/AGENTS.md") ||
    path === "BUILD.md"
  ) {
    return "governance";
  }
  if (path.startsWith(".agents/skills/")) return "specialist-instruction";
  if (path.startsWith("docs/homa-design/")) return "design-source";
  if (path.startsWith("docs/homa-benchmarks/")) return "benchmark-source";
  if (path.startsWith("apps/web/public/") && path.endsWith(".txt")) {
    return "public-summary";
  }
  if (path.startsWith("marketing/")) return "marketing-working";
  if (path.startsWith("data/")) return "data-documentation";
  if (path.startsWith("packages/")) return "package-documentation";
  if (path.endsWith(".cff") || MARBLE_LEGAL_FILES.has(path)) {
    return "legal-provenance";
  }
  if (
    path === "README.md" ||
    path.endsWith("/README.md") ||
    path === "DESIGN.md" ||
    path === "HUMAN-TODO.md"
  ) {
    return "live-guidance";
  }
  if (
    path.startsWith("docs/homa-planning/") ||
    path.startsWith("ideation/")
  ) {
    return "planning-source";
  }
  return "live-guidance";
}

function slugForPath(path) {
  return path
    .replace(/(?:\.mdx?|\.txt|\.html|\.cff|\.tsv|\.ya?ml|\.json|\.js)$/i, "")
    .replace(/(^|\/)README$/i, "$1overview")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function topicForPath(path, area) {
  const knownTopics = new Map([
    ["AGENTS.md", "repository-agent-governance"],
    ["BUILD.md", "engineering-entry-point"],
    ["DESIGN.md", "design-tooling-contract"],
    ["HUMAN-TODO.md", "human-operations"],
    ["README.md", "repository-overview"],
    ["apps/mobile/AGENTS.md", "mobile-agent-governance"],
    ["apps/web/AGENTS.md", "web-agent-governance"],
    ["docs/homa-planning/13-mr-prd.md", "product-contract"],
    ["docs/homa-planning/build-log.md", "decision-history"],
    [
      "docs/homa-planning/journeys/10-reconciliation.md",
      "founder-rulings",
    ],
  ]);

  if (ALIASES.has(path)) return ALIASES.get(path).topic;
  const intentionalDocumentation = INTENTIONAL_DOCUMENTATION_FILES.get(path);
  if (intentionalDocumentation) return intentionalDocumentation.topic;
  if (path.startsWith("docs/homa-planning/reconciliation/")) {
    return "documentation-reconciliation";
  }
  return knownTopics.get(path) ?? `${area}-${slugForPath(path)}`;
}

function initialRow(path, startingState) {
  const area = areaForPath(path);
  const format = formatForPath(path);
  const authorityClass = authorityForPath(path);
  const canonicalTopic = topicForPath(path, area);

  if (ALIASES.has(path)) {
    const alias = ALIASES.get(path);
    const targetPath = repositoryTargetForAlias(path, alias.target);
    const evidence =
      alias.form === "symlink"
        ? `Git symlink target recorded as ${alias.target}.`
        : `Literal @${alias.target} wrapper recorded for ${targetPath}.`;
    return {
      path,
      starting_state: startingState,
      format,
      area,
      authority_class: "alias",
      lifecycle: "alias",
      canonical_topic: canonicalTopic,
      claim_scope: `No independent claim scope; aliases ${alias.target}.`,
      evidence,
      disposition: "alias",
      notes: "Validate the canonical instruction file instead of duplicating claims.",
    };
  }

  const intentionalDocumentation = INTENTIONAL_DOCUMENTATION_FILES.get(path);
  if (intentionalDocumentation) {
    return {
      path,
      starting_state: startingState,
      format,
      area,
      authority_class: authorityClass,
      lifecycle: "in-progress",
      canonical_topic: canonicalTopic,
      claim_scope: intentionalDocumentation.claimScope,
      evidence: `Pending ${area} domain reconciliation against authoritative decisions, repository evidence, and production evidence where applicable.`,
      disposition: "unresolved",
      notes:
        "Intentional documentation-bearing executable or configuration reference; ordinary executable comments remain evidence-only.",
    };
  }

  if (MIXED_HISTORICAL_DOCUMENTATION.has(path)) {
    return {
      path,
      starting_state: startingState,
      format,
      area,
      authority_class: "historical-record",
      lifecycle: "historical",
      canonical_topic: canonicalTopic,
      claim_scope:
        "Human-authored Findings and guidance are in claim scope; generated run metadata, result table, output links, and Blob URL list remain evidence-only pending a file split.",
      evidence:
        "Mixed historical artifact whose human Findings have not yet been reconciled independently from generated calibration output.",
      disposition: "unresolved",
      notes:
        "Conservatively retain as historical and unresolved; later split human guidance from reproducible generated output.",
    };
  }

  if (HOMA_AUTHORED_MARBLE_DOCUMENTATION.has(path)) {
    return {
      path,
      starting_state: startingState,
      format,
      area,
      authority_class: "benchmark-source",
      lifecycle: "in-progress",
      canonical_topic: canonicalTopic,
      claim_scope:
        "All Homa-authored provenance, version, taxonomy-count, command, integration, lineage, licensing-posture, and founder-ruling claims in this usage note.",
      evidence:
        "Pending benchmark reconciliation against the vendored corpus, taxonomy implementation, guard output, and recorded founder rulings.",
      disposition: "unresolved",
      notes:
        "Homa-authored usage guidance remains in claim scope; only upstream Marble documentation and licenses are frozen vendored content.",
    };
  }

  if (GENERATED_ARTIFACTS.has(path)) {
    const evidence = GENERATED_DESIGN_ARTIFACTS.has(path)
      ? "Known generated design artifact; hand edits are prohibited."
      : path.includes("/materials/calibration/")
        ? "Known output of the materials calibration reporting command."
        : "Known generated marketing scorecard output.";
    return {
      path,
      starting_state: startingState,
      format,
      area,
      authority_class: "generated",
      lifecycle: "generated",
      canonical_topic: canonicalTopic,
      claim_scope:
        "Generated output has no independent human-authored claim scope; verify its generator and inputs.",
      evidence,
      disposition: "generated-excluded",
      notes: "Recorded for exhaustive coverage and excluded from direct editing.",
    };
  }

  if (isVendoredMarbleDocumentation(path)) {
    return {
      path,
      starting_state: startingState,
      format,
      area,
      authority_class: "vendored",
      lifecycle: "vendored",
      canonical_topic: canonicalTopic,
      claim_scope:
        "Vendored Marble documentation and provenance; no Homa-authored claim reconciliation.",
      evidence: "Third-party Marble corpus recorded as frozen vendored content.",
      disposition: "vendored-frozen",
      notes: "Preserve upstream content and licenses without Homa-specific rewrites.",
    };
  }

  if (path.startsWith("docs/homa-planning/reconciliation/")) {
    return {
      path,
      starting_state: startingState,
      format,
      area,
      authority_class: "audit-control",
      lifecycle: "audit-active",
      canonical_topic: canonicalTopic,
      claim_scope:
        "Active audit method, evidence, or control artifact for documentation reconciliation.",
      evidence: "Audit-created control file governed by the active reconciliation plan.",
      disposition: "audit-active",
      notes: "Retain while the audit is active and validate through check:docs.",
    };
  }

  return {
    path,
    starting_state: startingState,
    format,
    area,
    authority_class: authorityClass,
    lifecycle: "in-progress",
    canonical_topic: canonicalTopic,
    claim_scope:
      "All material human-authored product, status, command, link, policy, and implementation claims in this file.",
    evidence: `Pending ${area} domain reconciliation against authoritative decisions, repository evidence, and production evidence where applicable.`,
    disposition: "unresolved",
    notes: "Initial Task 1 inventory row; claim-level evidence and final disposition remain open.",
  };
}

function serializeField(value) {
  if (value.includes("\t") || value.includes("\n") || value.includes("\r")) {
    throw new Error(`TSV field contains a tab or newline: ${value}`);
  }
  return value;
}

function bootstrapManifest(repoRoot) {
  resolveSafeExistingPath(
    repoRoot,
    dirname(MANIFEST_PATH),
    "Audit-control directory",
  );
  const absoluteManifestPath = resolve(repoRoot, MANIFEST_PATH);
  if (existsSync(absoluteManifestPath)) {
    throw new Error(
      `${MANIFEST_PATH} already exists; bootstrap mode never overwrites audit work`,
    );
  }

  const candidates = collectCandidates(repoRoot, {
    includeManifestForBootstrap: true,
  });
  const paths = [...candidates.keys()].sort(comparePaths);
  const lines = [MANIFEST_COLUMNS.join("\t")];

  for (const path of paths) {
    const row = initialRow(path, candidates.get(path));
    lines.push(
      MANIFEST_COLUMNS.map((column) => serializeField(row[column])).join("\t"),
    );
  }

  writeFileSync(absoluteManifestPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Bootstrapped ${MANIFEST_PATH} with ${paths.length} rows.`);
}

function parseManifest(repoRoot, errors) {
  const errorCountBeforeInspection = errors.length;
  const absolutePath = auditControlFile(repoRoot, MANIFEST_PATH, errors);
  if (!absolutePath) {
    if (errors.length === errorCountBeforeInspection) {
      errors.push(`Missing manifest: ${MANIFEST_PATH}`);
    }
    return { rows: [], duplicateCount: 0 };
  }

  const raw = readFileSync(absolutePath, "utf8");
  if (raw.includes("\r")) {
    errors.push("Manifest must use LF line endings and contain no carriage returns");
  }

  const lines = raw.endsWith("\n")
    ? raw.slice(0, -1).split("\n")
    : raw.split("\n");
  const header = lines.shift()?.split("\t") ?? [];
  if (
    header.length !== MANIFEST_COLUMNS.length ||
    header.some((column, index) => column !== MANIFEST_COLUMNS[index])
  ) {
    errors.push(
      `Manifest header must be exactly: ${MANIFEST_COLUMNS.join("\\t")}`,
    );
  }

  const rows = [];
  const paths = new Set();
  let duplicateCount = 0;

  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 2;
    if (line.length === 0) {
      errors.push(`Manifest line ${lineNumber} is blank`);
      return;
    }

    const values = line.split("\t");
    if (values.length !== MANIFEST_COLUMNS.length) {
      errors.push(
        `Manifest line ${lineNumber} has ${values.length} fields; expected ${MANIFEST_COLUMNS.length}`,
      );
      return;
    }

    const row = Object.fromEntries(
      MANIFEST_COLUMNS.map((column, index) => [column, values[index]]),
    );

    for (const column of MANIFEST_COLUMNS) {
      if (row[column].trim().length === 0) {
        errors.push(`Manifest line ${lineNumber} has an empty ${column} field`);
      } else if (row[column] !== row[column].trim()) {
        errors.push(
          `Manifest line ${lineNumber} has surrounding whitespace in ${column}`,
        );
      }
    }

    try {
      assertSafeCandidate(row.path);
    } catch (error) {
      errors.push(error.message);
    }

    for (const [column, allowedValues] of Object.entries(ENUMS)) {
      if (!allowedValues.has(row[column])) {
        errors.push(
          `Manifest line ${lineNumber} has invalid ${column}: ${row[column]}`,
        );
      }
    }

    if (paths.has(row.path)) {
      duplicateCount += 1;
      errors.push(`Manifest contains duplicate path: ${row.path}`);
    }
    paths.add(row.path);
    rows.push(row);
  });

  for (let index = 1; index < rows.length; index += 1) {
    if (comparePaths(rows[index - 1].path, rows[index].path) >= 0) {
      errors.push(
        `Manifest paths are not in stable ascending order at ${rows[index].path}`,
      );
      break;
    }
  }

  return { rows, duplicateCount };
}

function hasTerminalManifestEvidence(row) {
  const evidence = row.evidence.trim();
  return (
    evidence.length >= 24 &&
    !evidence.toLowerCase().startsWith("pending ") &&
    !evidence.toLowerCase().includes("remain open")
  );
}

function validateCoverage(candidates, rows, errors) {
  const candidatePaths = new Set(candidates.keys());
  const manifestPaths = new Set(rows.map((row) => row.path));
  const preservedTerminalPaths = new Set();
  let preservedTerminalRows = 0;

  for (const path of [...candidatePaths].sort(comparePaths)) {
    if (!manifestPaths.has(path)) {
      errors.push(`Manifest is missing candidate: ${path}`);
    }
  }

  const byPath = new Map(rows.map((row) => [row.path, row]));
  for (const path of [...manifestPaths].sort(comparePaths)) {
    if (!candidatePaths.has(path)) {
      const row = byPath.get(path);
      const allowedLifecycles = MANIFEST_ONLY_TERMINAL_STATES.get(
        row.disposition,
      );
      let pathIsSafe = true;
      try {
        assertSafeCandidate(path);
      } catch {
        pathIsSafe = false;
      }

      if (!pathIsSafe) {
        continue;
      } else if (!isDocumentationCandidate(path)) {
        errors.push(
          `Manifest contains an arbitrary non-candidate path outside documentation scope: ${path}`,
        );
      } else if (!allowedLifecycles?.has(row.lifecycle)) {
        errors.push(
          `Manifest-only path ${path} must use deleted/removed, relocated/removed, or archived/archived terminal state`,
        );
      } else if (!hasTerminalManifestEvidence(row)) {
        errors.push(
          `Manifest-only terminal path ${path} must record substantive disposition evidence`,
        );
      } else {
        preservedTerminalRows += 1;
        preservedTerminalPaths.add(path);
      }
    }
  }

  for (const path of REQUIRED_SPECIAL_PATHS) {
    if (!candidatePaths.has(path) && !preservedTerminalPaths.has(path)) {
      errors.push(`Required special documentation candidate is absent: ${path}`);
    }
  }

  return { preservedTerminalRows, preservedTerminalPaths };
}

function validateAlias(repoRoot, path, alias, errors) {
  let parentPath;
  let targetPath;
  let expectedTarget;

  try {
    parentPath = dirname(path);
    resolveSafeExistingPath(repoRoot, parentPath, "Alias parent");
    targetPath = repositoryTargetForAlias(path, alias.target);
    expectedTarget = resolveSafeExistingPath(
      repoRoot,
      targetPath,
      "Alias canonical target",
    );
  } catch (error) {
    errors.push(error.message);
    return;
  }

  const absolutePath = resolve(repoRoot, path);
  let stat;
  try {
    stat = lstatSync(absolutePath);
  } catch (error) {
    errors.push(
      error?.code === "ENOENT"
        ? `${path} alias is missing`
        : `Cannot inspect alias ${path}: ${error.message}`,
    );
    return;
  }

  if (alias.form === "symlink") {
    if (!stat.isSymbolicLink()) {
      errors.push(`${path} must remain a symbolic link`);
      return;
    }

    let actualTarget;
    try {
      actualTarget = readlinkSync(absolutePath);
    } catch (error) {
      errors.push(`Cannot read alias target for ${path}: ${error.message}`);
      return;
    }

    if (actualTarget !== alias.target) {
      errors.push(`${path} points to ${actualTarget}; expected ${alias.target}`);
      return;
    }

    try {
      const actualTargetPath = repositoryTargetForAlias(path, actualTarget);
      const resolvedAlias = resolveSafeExistingPath(repoRoot, path, "Alias");
      if (
        actualTargetPath !== targetPath ||
        resolvedAlias.resolvedPath !== expectedTarget.resolvedPath
      ) {
        errors.push(`${path} does not resolve to canonical target ${targetPath}`);
      }
    } catch (error) {
      errors.push(error.message);
    }
    return;
  }

  if (alias.form === "literal-wrapper") {
    if (!stat.isFile() || stat.isSymbolicLink()) {
      errors.push(`${path} must remain a regular literal-wrapper file`);
      return;
    }

    try {
      resolveSafeExistingPath(repoRoot, path, "Literal alias");
      const contents = readFileSync(absolutePath, "utf8");
      if (contents !== alias.literal) {
        errors.push(
          `${path} must contain only the literal wrapper ${JSON.stringify(alias.literal)}`,
        );
      }
    } catch (error) {
      errors.push(error.message);
    }
    return;
  }

  errors.push(`${path} has unsupported alias form: ${alias.form}`);
}

function validateSpecialRows(repoRoot, rows, preservedTerminalPaths, errors) {
  const byPath = new Map(rows.map((row) => [row.path, row]));

  for (const [path, alias] of ALIASES) {
    if (preservedTerminalPaths.has(path)) continue;
    const row = byPath.get(path);
    if (!row) continue;
    if (
      row.authority_class !== "alias" ||
      row.lifecycle !== "alias" ||
      row.disposition !== "alias"
    ) {
      errors.push(`${path} must be recorded as an alias row`);
    }

    validateAlias(repoRoot, path, alias, errors);
  }

  for (const path of GENERATED_ARTIFACTS) {
    if (preservedTerminalPaths.has(path)) continue;
    const row = byPath.get(path);
    if (!row) continue;
    if (
      row.authority_class !== "generated" ||
      row.lifecycle !== "generated" ||
      row.disposition !== "generated-excluded"
    ) {
      errors.push(`${path} must be recorded as generated-excluded`);
    }
  }

  for (const path of MIXED_HISTORICAL_DOCUMENTATION) {
    if (preservedTerminalPaths.has(path)) continue;
    const row = byPath.get(path);
    if (!row) continue;
    if (
      row.authority_class !== "historical-record" ||
      row.lifecycle !== "historical" ||
      row.disposition !== "unresolved"
    ) {
      errors.push(`${path} must remain mixed historical and unresolved`);
    }
  }

  for (const path of HOMA_AUTHORED_MARBLE_DOCUMENTATION) {
    if (preservedTerminalPaths.has(path)) continue;
    const row = byPath.get(path);
    if (!row) continue;
    if (
      row.authority_class !== "benchmark-source" ||
      row.lifecycle !== "in-progress" ||
      row.disposition !== "unresolved"
    ) {
      errors.push(`${path} must remain Homa-authored and in claim scope`);
    }
  }

  for (const [path, classification] of INTENTIONAL_DOCUMENTATION_FILES) {
    if (preservedTerminalPaths.has(path)) continue;
    const row = byPath.get(path);
    if (!row) continue;
    if (
      row.format !== classification.format ||
      row.area !== classification.area ||
      row.authority_class !== classification.authorityClass
    ) {
      errors.push(
        `${path} must retain its intentional documentation format, area, and authority classification`,
      );
    }
  }

  for (const row of rows) {
    if (preservedTerminalPaths.has(row.path)) continue;
    if (
      isVendoredMarbleDocumentation(row.path) &&
      (row.authority_class !== "vendored" ||
        row.lifecycle !== "vendored" ||
        row.disposition !== "vendored-frozen")
    ) {
      errors.push(`${row.path} must be recorded as vendored-frozen`);
    }

    if (
      row.lifecycle === "in-progress" &&
      row.disposition !== "unresolved"
    ) {
      errors.push(
        `${row.path} has in-progress lifecycle but is not unresolved`,
      );
    }

    if (
      row.lifecycle === "audit-active" &&
      row.disposition !== "audit-active"
    ) {
      errors.push(
        `${row.path} has audit-active lifecycle but is not audit-active`,
      );
    }
  }
}

function inspectClaimLedger(repoRoot, errors) {
  const absolutePath = auditControlFile(repoRoot, CLAIM_LEDGER_PATH, errors);
  if (!absolutePath) {
    return { state: "absent", rowCount: 0, openCount: 0 };
  }

  const raw = readFileSync(absolutePath, "utf8");
  if (raw.includes("\r")) {
    errors.push("Claim ledger must use LF line endings");
  }
  const lines = raw.endsWith("\n")
    ? raw.slice(0, -1).split("\n")
    : raw.split("\n");
  const header = lines.shift()?.split("\t") ?? [];
  const headerSet = new Set(header);
  if (header.length === 0 || header.some((column) => column.trim().length === 0)) {
    errors.push("Claim ledger header contains an empty column");
  }
  if (headerSet.size !== header.length) {
    errors.push("Claim ledger header contains duplicate columns");
  }

  const statusIndex = header.findIndex((column) =>
    ["status", "resolution_status", "disposition"].includes(column),
  );
  if (statusIndex === -1) {
    errors.push(
      "Claim ledger must include status, resolution_status, or disposition",
    );
  }

  const idIndex = header.indexOf("claim_id");
  const ids = new Set();
  let rowCount = 0;
  let openCount = 0;

  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 2;
    if (line.length === 0) {
      errors.push(`Claim ledger line ${lineNumber} is blank`);
      return;
    }
    const values = line.split("\t");
    if (values.length !== header.length) {
      errors.push(
        `Claim ledger line ${lineNumber} has ${values.length} fields; expected ${header.length}`,
      );
      return;
    }
    rowCount += 1;
    if (statusIndex !== -1) {
      const status = values[statusIndex].trim().toLowerCase();
      if (status.length === 0) {
        errors.push(`Claim ledger line ${lineNumber} has an empty status`);
      } else if (OPEN_CLAIM_STATUSES.has(status)) {
        openCount += 1;
      }
    }
    if (idIndex !== -1) {
      const claimId = values[idIndex].trim();
      if (claimId.length === 0) {
        errors.push(`Claim ledger line ${lineNumber} has an empty claim_id`);
      } else if (ids.has(claimId)) {
        errors.push(`Claim ledger contains duplicate claim_id: ${claimId}`);
      }
      ids.add(claimId);
    }
  });

  return { state: "present", rowCount, openCount };
}

function countStartingStates(rows) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.starting_state, (counts.get(row.starting_state) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => comparePaths(left, right))
    .map(([state, count]) => `${state}=${count}`)
    .join(", ");
}

function check(repoRoot, { allowOpen }) {
  verifyProhibitedGuard();
  const structuralErrors = [];
  const candidates = collectCandidates(repoRoot);
  const { rows, duplicateCount } = parseManifest(repoRoot, structuralErrors);
  const coverageErrorCountBeforeValidation = structuralErrors.length;
  const { preservedTerminalRows, preservedTerminalPaths } = validateCoverage(
    candidates,
    rows,
    structuralErrors,
  );
  const coverageIsValid =
    structuralErrors.length === coverageErrorCountBeforeValidation;
  validateSpecialRows(
    repoRoot,
    rows,
    preservedTerminalPaths,
    structuralErrors,
  );
  const claimLedger = inspectClaimLedger(repoRoot, structuralErrors);
  const openManifestRows = rows.filter(
    (row) =>
      OPEN_LIFECYCLES.has(row.lifecycle) ||
      OPEN_DISPOSITIONS.has(row.disposition),
  );

  const openErrors = [];
  if (openManifestRows.length > 0) {
    openErrors.push(
      `${openManifestRows.length} manifest rows remain audit-active, in-progress, or unresolved`,
    );
  }
  if (claimLedger.state === "absent") {
    openErrors.push(`Claim ledger is absent: ${CLAIM_LEDGER_PATH}`);
  } else if (claimLedger.rowCount === 0) {
    openErrors.push("Claim ledger contains no claim rows");
  } else if (claimLedger.openCount > 0) {
    openErrors.push(`${claimLedger.openCount} claim ledger rows remain open`);
  }

  console.log("Documentation reconciliation check");
  console.log(`Candidate files: ${candidates.size}`);
  console.log(`Manifest rows: ${rows.length}`);
  console.log(
    `Starting states: ${rows.length === 0 ? "unavailable" : countStartingStates(rows)}`,
  );
  console.log(`Duplicate paths: ${duplicateCount}`);
  console.log(
    `Schema and enums: ${structuralErrors.length === 0 ? "valid" : "invalid"}`,
  );
  console.log(
    `Coverage: ${coverageIsValid ? "exact" : "invalid"}`,
  );
  console.log(`Preserved terminal manifest rows: ${preservedTerminalRows}`);
  console.log(
    `Prohibited-prefix guard: active for ${PROHIBITED_PREFIXES.length} prefixes`,
  );
  console.log(`Open manifest rows: ${openManifestRows.length}`);
  console.log(
    claimLedger.state === "absent"
      ? "Claim ledger: absent (open audit item)"
      : `Claim ledger: ${claimLedger.rowCount} rows, ${claimLedger.openCount} open`,
  );

  if (structuralErrors.length > 0) {
    console.error("\nStructural errors:");
    for (const error of structuralErrors) console.error(`- ${error}`);
  }

  if (openErrors.length > 0) {
    const label = allowOpen ? "Allowed open audit items" : "Open audit errors";
    console.error(`\n${label}:`);
    for (const error of openErrors) console.error(`- ${error}`);
  }

  if (structuralErrors.length > 0 || (!allowOpen && openErrors.length > 0)) {
    process.exitCode = 1;
    console.error("\nResult: FAIL");
    return;
  }

  console.log(
    allowOpen && openErrors.length > 0
      ? "\nResult: PASS with open audit items"
      : "\nResult: PASS",
  );
}

function main() {
  const args = new Set(process.argv.slice(2).filter((arg) => arg !== "--"));
  const allowedArgs = new Set(["--allow-open", "--bootstrap-manifest"]);
  const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }
  if (args.has("--allow-open") && args.has("--bootstrap-manifest")) {
    throw new Error("Use --allow-open and --bootstrap-manifest separately");
  }

  const repoRoot = runGit(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  verifyProhibitedGuard();

  if (args.has("--bootstrap-manifest")) {
    bootstrapManifest(repoRoot);
    return;
  }

  check(repoRoot, { allowOpen: args.has("--allow-open") });
}

try {
  main();
} catch (error) {
  console.error(`Documentation reconciliation check failed: ${error.message}`);
  process.exitCode = 1;
}
