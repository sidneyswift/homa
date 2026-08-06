import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import {
  DOC_REFERENCE_FILES,
  validateDocReferences,
} from "./docs-reference-check.mjs";
import {
  lstatSync,
  readdirSync,
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
  resolve,
  sep,
  win32,
} from "node:path";

const MANIFEST_PATH =
  "docs/homa-planning/reconciliation/documentation-manifest.tsv";
const CLAIM_LEDGER_PATH =
  "docs/homa-planning/reconciliation/claim-ledger.tsv";
const AUDIT_CONTROL_BASELINE_PATH =
  "docs/homa-planning/reconciliation/audit-control-baseline.tsv";
const AUDIT_CONTROL_BASELINE_SHA256 =
  "de81aeef5c4612473463086991970c15dcf319a5ea07f865cb570c74deec0c47";

const PROHIBITED_PREFIXES = [
  "homa-macmini/",
  "homa-research/",
  "homa-template/",
];

const REPOSITORY_PATHSPECS = [
  ".",
  ...PROHIBITED_PREFIXES.flatMap((prefix) => {
    const root = prefix.slice(0, -1);
    return [
      `:(icase,exclude)${root}`,
      `:(icase,exclude)${root}/**`,
    ];
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

const UPSTREAM_MARBLE_DOCUMENTATION = new Set([
  "docs/homa-benchmarks/marble/CHANGELOG.md",
  "docs/homa-benchmarks/marble/CITATION.cff",
  "docs/homa-benchmarks/marble/LICENSE",
  "docs/homa-benchmarks/marble/LICENSE-CONTENT",
  "docs/homa-benchmarks/marble/PROVENANCE.md",
  "docs/homa-benchmarks/marble/README.md",
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
  AUDIT_CONTROL_BASELINE_PATH,
  ...MARKETING_META_MANIFESTS,
  ...MARBLE_LEGAL_FILES,
  ...GENERATED_ARTIFACTS,
  ...MIXED_HISTORICAL_DOCUMENTATION,
  ...HOMA_AUTHORED_MARBLE_DOCUMENTATION,
  ...UPSTREAM_MARBLE_DOCUMENTATION,
  ...INTENTIONAL_DOCUMENTATION_FILES.keys(),
  ...ALIASES.keys(),
]);

const AUDIT_CONTROL_BASELINE_COLUMNS = [
  "path",
  "starting_state",
  "first_seen_presence",
  "content_sha256",
  "git_blob_oid",
  "first_seen_evidence",
];

const FIRST_SEEN_PRESENCE = new Set(["present", "removed-before-baseline"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const GIT_OID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

const REGISTERED_RULINGS = new Map([
  [
    "ruling:global-D8-casing",
    {
      locator:
        "docs/homa-planning/journeys/10-reconciliation.md#original-consolidated-decision-queue",
      marker: "| D8 |",
    },
  ],
  [
    "ruling:global-D6-sensitive-memory",
    {
      locator:
        "docs/homa-planning/journeys/10-reconciliation.md#original-consolidated-decision-queue",
      marker: "| D6 |",
    },
  ],
  [
    "ruling:D10",
    {
      locator: "docs/homa-planning/13-mr-prd.md#8-open-items",
      marker: "D10:",
    },
  ],
  [
    "ruling:DM7",
    {
      locator:
        "docs/homa-planning/build-log.md#2026-07-05--marketing-demand-engine-spec-14-marketing-demand-enginemd",
      marker: "DM7",
    },
  ],
  [
    "ruling:2026-07-07-invite-only-retired",
    {
      locator:
        "docs/homa-planning/build-log.md#2026-07-07-night--family-workspace-phase-a-report-data-moves-to-product-tables-founder-rulings-this-session",
      marker: "No more invite-only.",
    },
  ],
]);

const REGISTERED_TICKETS = new Map([
  [
    "ticket:M0-07",
    {
      locator:
        "docs/homa-planning/03-backlog.md#m0--prototype-phase-test-the-risky-assumptions-before-committing",
      marker: "| M0-07",
    },
  ],
  [
    "ticket:M2-10",
    {
      locator:
        "docs/homa-planning/03-backlog.md#m2--the-agent-port-the-domain-system",
      marker: "| M2-10",
    },
  ],
  [
    "ticket:M1-17",
    {
      locator:
        "docs/homa-planning/03-backlog.md#m1--platform-skeleton-auth--billing--chat",
      marker: "| M1-17",
    },
  ],
  [
    "ticket:M1-15",
    {
      locator:
        "docs/homa-planning/03-backlog.md#m1--platform-skeleton-auth--billing--chat",
      marker: "| M1-15",
    },
  ],
  [
    "ticket:MJ-13",
    {
      locator:
        "docs/homa-planning/journeys/10-reconciliation.md#2-journey-derived-tickets-global-renumbering-mj-series",
      marker: "| MJ-13",
    },
  ],
  [
    "ticket:MJ-21",
    {
      locator:
        "docs/homa-planning/journeys/10-reconciliation.md#2-journey-derived-tickets-global-renumbering-mj-series",
      marker: "| MJ-21",
    },
  ],
]);

const REPOSITORY_BASELINE_PATH =
  "docs/homa-planning/reconciliation/evidence/repository-baseline.md";
const PRODUCTION_BASELINE_PATH =
  "docs/homa-planning/reconciliation/evidence/production-baseline.md";

const TERMINAL_EVIDENCE_REQUIREMENTS = new Map([
  [
    "command",
    new Map([
      [
        "command:package-json-and-CI",
        new Set([`${REPOSITORY_BASELINE_PATH}#root-commands-and-ci`]),
      ],
      [
        "command:CI-workflow",
        new Set([`${REPOSITORY_BASELINE_PATH}#root-commands-and-ci`]),
      ],
      [
        "command:version-output",
        new Set([`${REPOSITORY_BASELINE_PATH}#toolchain-observation`]),
      ],
      [
        "command:benchmark-freshness-run",
        new Set([
          `${REPOSITORY_BASELINE_PATH}#documentation-adjacent-operational-checks`,
        ]),
      ],
      [
        "command:state-requirements-procedure",
        new Set([
          `${REPOSITORY_BASELINE_PATH}#documentation-adjacent-operational-checks`,
        ]),
      ],
    ]),
  ],
  [
    "production",
    new Map([
      [
        "vercel:deployment-inspection",
        new Set([`${PRODUCTION_BASELINE_PATH}#deployment`]),
      ],
      [
        "vercel:public-content-comparison",
        new Set([`${PRODUCTION_BASELINE_PATH}#public-content-comparison`]),
      ],
      [
        "vercel:public-route-probes",
        new Set([`${PRODUCTION_BASELINE_PATH}#public-http-probes`]),
      ],
      [
        "vercel:ai-txt-sha256-match",
        new Set([`${PRODUCTION_BASELINE_PATH}#public-content-comparison`]),
      ],
      [
        "vercel:llms-txt-hash-difference",
        new Set([`${PRODUCTION_BASELINE_PATH}#public-content-comparison`]),
      ],
      [
        "vercel:llms-full-txt-hash-difference",
        new Set([`${PRODUCTION_BASELINE_PATH}#public-content-comparison`]),
      ],
    ]),
  ],
]);

const CLAIM_KIND_TRUTH_BASIS = new Map([
  ["policy", new Set(["policy", "working-tree", "history"])],
  ["repository", new Set(["working-tree", "commit", "history", "command"])],
  ["production", new Set(["vercel", "supabase"])],
  ["historical", new Set(["history"])],
  ["upcoming", new Set(["ticket"])],
  ["external", new Set(["external"])],
  ["command", new Set(["command"])],
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

const CLAIM_LEDGER_COLUMNS = [
  "claim_id",
  "group_id",
  "source_paths",
  "claim_kind",
  "canonical_topic",
  "claim_before",
  "resolved_claim",
  "authority_refs",
  "evidence_refs",
  "truth_basis",
  "observed_at",
  "ticket_refs",
  "canonical_ref",
  "resolution_status",
  "notes",
];

const CLAIM_KINDS = new Set([
  "policy",
  "repository",
  "production",
  "historical",
  "upcoming",
  "external",
  "command",
]);

const OPEN_CLAIM_STATUSES = new Set([
  "in-progress",
  "unknown",
  "conflict",
  "evidence-missing",
  "ticket-missing",
]);

const TERMINAL_CLAIM_STATUSES = new Set([
  "verified-current",
  "corrected-current",
  "historical-annotated",
  "upcoming-ticketed",
  "removed",
  "consolidated",
]);

const CLAIM_STATUSES = new Set([
  ...OPEN_CLAIM_STATUSES,
  ...TERMINAL_CLAIM_STATUSES,
]);

const CURRENT_CLAIM_KINDS = new Set([
  "policy",
  "repository",
  "production",
  "external",
  "command",
]);

const TERMINAL_STATUS_RULES = new Map([
  [
    "verified-current",
    { claimKinds: CURRENT_CLAIM_KINDS, resolvedClaimMode: "same" },
  ],
  [
    "corrected-current",
    { claimKinds: CURRENT_CLAIM_KINDS, resolvedClaimMode: "written" },
  ],
  [
    "historical-annotated",
    {
      claimKinds: new Set(["historical"]),
      resolvedClaimMode: "retained",
    },
  ],
  [
    "upcoming-ticketed",
    { claimKinds: new Set(["upcoming"]), resolvedClaimMode: "retained" },
  ],
  [
    "removed",
    { claimKinds: new Set(CLAIM_KINDS), resolvedClaimMode: "removed" },
  ],
  [
    "consolidated",
    {
      claimKinds: CURRENT_CLAIM_KINDS,
      resolvedClaimMode: "retained",
      requiresCanonicalRef: true,
    },
  ],
]);

const TRUTH_BASIS_PREFIXES = new Set([
  "policy",
  "working-tree",
  "commit",
  "vercel",
  "supabase",
  "history",
  "ticket",
  "external",
  "command",
]);

const CLAIM_PLACEHOLDER_PATTERN =
  /\ball material claims?\b|\ball material human-authored\b|\bTBD\b|pending evidence|unknown ticket/i;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

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
const LIFECYCLE_DISPOSITION_COMPATIBILITY = new Map([
  ["in-progress", new Set(["unresolved"])],
  ["audit-active", new Set(["audit-active"])],
  ["current", new Set(["retain-current", "consolidated-canonical"])],
  ["upcoming", new Set(["retain-upcoming"])],
  ["historical", new Set(["unresolved", "historical-annotated"])],
  ["archived", new Set(["archived"])],
  ["removed", new Set(["deleted", "relocated"])],
  ["generated", new Set(["generated-excluded"])],
  ["vendored", new Set(["vendored-frozen"])],
  ["alias", new Set(["alias"])],
]);
const TERMINAL_CLAIM_MANIFEST_DISPOSITIONS = new Map([
  [
    "verified-current",
    new Set(["unresolved", "audit-active", "retain-current", "consolidated-canonical"]),
  ],
  [
    "corrected-current",
    new Set(["unresolved", "audit-active", "retain-current", "consolidated-canonical"]),
  ],
  [
    "historical-annotated",
    new Set(["unresolved", "audit-active", "historical-annotated", "archived"]),
  ],
  [
    "upcoming-ticketed",
    new Set(["unresolved", "audit-active", "retain-upcoming"]),
  ],
  ["removed", new Set(["unresolved", "audit-active", "deleted", "relocated"])],
  [
    "consolidated",
    new Set(["unresolved", "audit-active", "relocated", "consolidated-canonical"]),
  ],
]);
const HOMA_AUTHORED_LIFECYCLES = new Set([
  "in-progress",
  "current",
  "historical",
  "archived",
]);
const MIXED_HISTORICAL_DISPOSITIONS = new Set([
  "unresolved",
  "historical-annotated",
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
  const foldedPath = path.toLowerCase();
  return PROHIBITED_PREFIXES.some((prefix) => {
    const foldedPrefix = prefix.toLowerCase();
    const root = foldedPrefix.slice(0, -1);
    return foldedPath === root || foldedPath.startsWith(foldedPrefix);
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

function resolveSafeExistingPath(repoRoot, repositoryPath, purpose) {
  const isRepositoryRoot = repositoryPath === ".";
  if (!isRepositoryRoot) assertSafeCandidate(repositoryPath);
  const resolvedRoot = realpathSync(repoRoot);
  if (isRepositoryRoot) {
    return {
      absolutePath: resolvedRoot,
      resolvedPath: resolvedRoot,
      resolvedRepositoryPath: "",
      stat: lstatSync(resolvedRoot),
    };
  }

  const segments = repositoryPath.split("/");
  let absolutePath = resolvedRoot;
  let stat;
  for (const [index, segment] of segments.entries()) {
    absolutePath = join(absolutePath, segment);
    stat = lstatSync(absolutePath);
    const component = segments.slice(0, index + 1).join("/");
    if (stat.isSymbolicLink()) {
      throw new Error(`${purpose} crosses symbolic link: ${component}`);
    }
    if (index < segments.length - 1 && !stat.isDirectory()) {
      throw new Error(`${purpose} crosses non-directory component: ${component}`);
    }
  }

  return {
    absolutePath,
    resolvedPath: absolutePath,
    resolvedRepositoryPath: repositoryPath,
    stat,
  };
}

function auditControlFile(repoRoot, repositoryPath, errors) {
  assertSafeCandidate(repositoryPath);
  let inspection;

  try {
    inspection = resolveSafeExistingPath(repoRoot, repositoryPath, "Audit control");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    errors.push(`Cannot inspect audit control ${repositoryPath}: ${error.message}`);
    return undefined;
  }

  if (!inspection.stat.isFile()) {
    errors.push(`${repositoryPath} must be a regular audit-control file`);
    return undefined;
  }

  return inspection.absolutePath;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseAuditControlBaseline(repoRoot, errors) {
  const errorCountBeforeInspection = errors.length;
  const absolutePath = auditControlFile(
    repoRoot,
    AUDIT_CONTROL_BASELINE_PATH,
    errors,
  );
  if (!absolutePath) {
    if (errors.length === errorCountBeforeInspection) {
      errors.push(`Missing audit-control baseline: ${AUDIT_CONTROL_BASELINE_PATH}`);
    }
    return { rows: [], byPath: new Map() };
  }

  const raw = readFileSync(absolutePath);
  const actualHash = sha256(raw);
  if (actualHash !== AUDIT_CONTROL_BASELINE_SHA256) {
    errors.push(
      `${AUDIT_CONTROL_BASELINE_PATH} is immutable: expected SHA-256 ${AUDIT_CONTROL_BASELINE_SHA256}, observed ${actualHash}`,
    );
  }
  const text = raw.toString("utf8");
  if (text.includes("\r")) {
    errors.push("Audit-control baseline must use LF line endings");
  }
  if (!text.endsWith("\n")) {
    errors.push("Audit-control baseline must end with a single LF newline");
  }

  const lines = text.endsWith("\n")
    ? text.slice(0, -1).split("\n")
    : text.split("\n");
  const header = lines.shift()?.split("\t") ?? [];
  if (
    header.length !== AUDIT_CONTROL_BASELINE_COLUMNS.length ||
    header.some(
      (column, index) => column !== AUDIT_CONTROL_BASELINE_COLUMNS[index],
    )
  ) {
    errors.push(
      `Audit-control baseline header must be exactly: ${AUDIT_CONTROL_BASELINE_COLUMNS.join("\\t")}`,
    );
  }

  const rows = [];
  const byPath = new Map();
  lines.forEach((line, index) => {
    const lineNumber = index + 2;
    const values = line.split("\t");
    if (values.length !== AUDIT_CONTROL_BASELINE_COLUMNS.length) {
      errors.push(
        `Audit-control baseline line ${lineNumber} has ${values.length} fields; expected ${AUDIT_CONTROL_BASELINE_COLUMNS.length}`,
      );
      return;
    }
    const row = Object.fromEntries(
      AUDIT_CONTROL_BASELINE_COLUMNS.map((column, columnIndex) => [
        column,
        values[columnIndex],
      ]),
    );
    for (const column of AUDIT_CONTROL_BASELINE_COLUMNS) {
      if (!row[column] || row[column] !== row[column].trim()) {
        errors.push(
          `Audit-control baseline line ${lineNumber} has an empty or padded ${column}`,
        );
      }
    }
    try {
      assertSafeCandidate(row.path);
    } catch (error) {
      errors.push(error.message);
    }
    if (row.path === AUDIT_CONTROL_BASELINE_PATH) {
      errors.push(
        `${AUDIT_CONTROL_BASELINE_PATH} must not contain a circular self-snapshot row`,
      );
    }
    if (!ENUMS.starting_state.has(row.starting_state)) {
      errors.push(
        `Audit-control baseline line ${lineNumber} has invalid starting_state: ${row.starting_state}`,
      );
    }
    if (!FIRST_SEEN_PRESENCE.has(row.first_seen_presence)) {
      errors.push(
        `Audit-control baseline line ${lineNumber} has invalid first_seen_presence: ${row.first_seen_presence}`,
      );
    }
    if (
      row.first_seen_presence === "present" ||
      (row.first_seen_presence === "removed-before-baseline" &&
        row.starting_state === "tracked")
    ) {
      if (!SHA256_PATTERN.test(row.content_sha256)) {
        errors.push(
          `Audit-control baseline line ${lineNumber} requires a SHA-256 content hash`,
        );
      }
    } else if (row.content_sha256 !== "-") {
      errors.push(
        `Audit-control baseline line ${lineNumber} removed untracked entry must use - for content_sha256`,
      );
    }
    if (row.starting_state === "tracked") {
      if (!GIT_OID_PATTERN.test(row.git_blob_oid)) {
        errors.push(
          `Audit-control baseline line ${lineNumber} tracked entry requires a Git blob OID`,
        );
      }
    } else if (row.git_blob_oid !== "-") {
      errors.push(
        `Audit-control baseline line ${lineNumber} untracked entry must use - for git_blob_oid`,
      );
    }
    if (row.first_seen_presence === "removed-before-baseline") {
      const eventPath = repositoryPathFromReference(
        row.first_seen_evidence,
        "first_seen_evidence",
        lineNumber,
        errors,
      );
      if (eventPath) {
        try {
          inspectRepositoryReferencePath(repoRoot, eventPath);
        } catch (error) {
          errors.push(
            `Audit-control baseline line ${lineNumber} has invalid first-seen event: ${error.message}`,
          );
        }
      }
    } else if (!/^audit-snapshot:\d{4}-\d{2}-\d{2}T/.test(row.first_seen_evidence)) {
      errors.push(
        `Audit-control baseline line ${lineNumber} present entry requires dated audit-snapshot evidence`,
      );
    }
    if (byPath.has(row.path)) {
      errors.push(`Audit-control baseline contains duplicate path: ${row.path}`);
    }
    byPath.set(row.path, row);
    rows.push(row);
  });

  for (let index = 1; index < rows.length; index += 1) {
    if (comparePaths(rows[index - 1].path, rows[index].path) >= 0) {
      errors.push(
        `Audit-control baseline paths are not in stable ascending order at ${rows[index].path}`,
      );
      break;
    }
  }

  return { rows, byPath };
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
  return UPSTREAM_MARBLE_DOCUMENTATION.has(path);
}

function isNamedFilesystemAlias(path) {
  return ALIASES.get(path)?.form === "symlink";
}

function inspectDocumentationCandidatePath(repoRoot, path) {
  assertSafeCandidate(path);
  const segments = path.split("/");
  let absolutePath = realpathSync(repoRoot);

  for (const [index, segment] of segments.entries()) {
    absolutePath = join(absolutePath, segment);
    const isFinalSegment = index === segments.length - 1;
    let stat;

    try {
      stat = lstatSync(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") return { present: false };
      throw new Error(`Cannot inspect documentation candidate ${path}: ${error.message}`);
    }

    if (stat.isSymbolicLink()) {
      if (isFinalSegment && isNamedFilesystemAlias(path)) {
        return { present: true, nodeType: "named-alias" };
      }
      const component = segments.slice(0, index + 1).join("/");
      throw new Error(
        `Rejected unrecognized documentation symlink at ${component} for candidate ${path}`,
      );
    }

    if (!isFinalSegment && !stat.isDirectory()) {
      throw new Error(
        `Documentation candidate ${path} crosses non-directory component ${segments
          .slice(0, index + 1)
          .join("/")}`,
      );
    }

    if (isFinalSegment && !stat.isFile()) {
      throw new Error(`Documentation candidate ${path} must be a regular file`);
    }
  }

  return { present: true, nodeType: "regular" };
}

function inspectRepositoryReferencePath(repoRoot, path) {
  assertSafeCandidate(path);
  const segments = path.split("/");
  let absolutePath = realpathSync(repoRoot);

  for (const [index, segment] of segments.entries()) {
    absolutePath = join(absolutePath, segment);
    const isFinalSegment = index === segments.length - 1;
    let stat;

    try {
      stat = lstatSync(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(`Repository reference does not exist: ${path}`);
      }
      throw new Error(`Cannot inspect repository reference ${path}: ${error.message}`);
    }

    if (stat.isSymbolicLink()) {
      if (isFinalSegment && isNamedFilesystemAlias(path)) {
        return { nodeType: "named-alias" };
      }
      const component = segments.slice(0, index + 1).join("/");
      throw new Error(
        `Repository reference ${path} crosses unrecognized symlink ${component}`,
      );
    }

    if (!isFinalSegment && !stat.isDirectory()) {
      throw new Error(
        `Repository reference ${path} crosses non-directory component ${segments
          .slice(0, index + 1)
          .join("/")}`,
      );
    }

    if (
      isFinalSegment &&
      !stat.isFile() &&
      !stat.isDirectory()
    ) {
      throw new Error(
        `Repository reference ${path} must be a regular file, directory, or named alias`,
      );
    }
  }

  return { nodeType: "regular" };
}

function readSafeRepositoryFile(repoRoot, repositoryPath, purpose) {
  assertSafeCandidate(repositoryPath);
  const inspection = inspectRepositoryReferencePath(repoRoot, repositoryPath);
  if (inspection.nodeType !== "regular") {
    throw new Error(`${purpose} must be a regular repository file: ${repositoryPath}`);
  }
  const { absolutePath } = resolveSafeExistingPath(
    repoRoot,
    repositoryPath,
    purpose,
  );
  return readFileSync(absolutePath, "utf8");
}

function validateMigrationEvidenceDrift(repoRoot, errors) {
  const evidencePath =
    "docs/homa-planning/reconciliation/evidence/production-baseline.md";
  let contents;
  try {
    contents = readSafeRepositoryFile(
      repoRoot,
      evidencePath,
      "Production migration evidence",
    );
  } catch (error) {
    errors.push(error.message);
    return;
  }

  const recountMatches = [
    ...contents.matchAll(
      /local migration directory was(?: last)? re-counted[\s\S]{0,160}?contained (\d+) files/gi,
    ),
  ];
  const comparisonMatches = [
    ...contents.matchAll(/- (\d+) local migration filenames\./g),
  ];
  const latestMatch = recountMatches.at(-1) ?? comparisonMatches.at(-1);
  if (!latestMatch) {
    errors.push(
      `${evidencePath} must record a local migration filename count for drift detection`,
    );
    return;
  }
  const recordedCount = Number.parseInt(latestMatch[1], 10);

  const migrationDirectory = "supabase/migrations";
  let actualCount;
  try {
    const { absolutePath } = resolveSafeExistingPath(
      repoRoot,
      migrationDirectory,
      "Migration directory",
    );
    actualCount = readdirSync(absolutePath, { withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith(".sql"),
    ).length;
  } catch (error) {
    errors.push(error.message);
    return;
  }

  if (recordedCount !== actualCount) {
    errors.push(
      `Local migration evidence drifted: ${evidencePath} records ${recordedCount} files, current supabase/migrations has ${actualCount}`,
    );
  }
}

function validateRegisteredReference(repoRoot, token, registration, type) {
  const parseErrors = [];
  const repositoryPath = repositoryPathFromReference(
    registration.locator,
    `registered ${type} locator`,
    0,
    parseErrors,
  );
  if (
    parseErrors.length > 0 ||
    !repositoryPath ||
    !registration.locator.includes("#")
  ) {
    throw new Error(
      `Registered ${type} ${token} must use a valid scoped repository locator`,
    );
  }
  const reference = {
    kind: "repository",
    reference: registration.locator,
    repositoryPath,
  };
  const scope = repositoryReferenceLocatorScope(
    repoRoot,
    reference,
    `Registered ${type} ${token}`,
  );
  if (scope === undefined) {
    throw new Error(`Registered ${type} ${token} has an unresolved locator`);
  }
  if (!scope.includes(registration.marker)) {
    throw new Error(
      `Registered ${type} ${token} marker is absent from its locator scope`,
    );
  }
}

function registeredReferenceHasValidScopedMarker(
  repoRoot,
  token,
  registration,
  type,
) {
  try {
    validateRegisteredReference(repoRoot, token, registration, type);
    return true;
  } catch {
    return false;
  }
}

function verifyReferenceRegistries(repoRoot) {
  for (const [token, registration] of REGISTERED_RULINGS) {
    validateRegisteredReference(repoRoot, token, registration, "ruling");
  }
  for (const [token, registration] of REGISTERED_TICKETS) {
    validateRegisteredReference(repoRoot, token, registration, "ticket");
  }
}

function verifyReferenceTypeRules(repoRoot) {
  const validCases = [
    ["ruling:global-D8-casing", "authority", "ruling"],
    ["AGENTS.md#commands", "evidence", "repository"],
    ["AGENTS.md#L1-L2", "evidence", "repository"],
    [
      "docs/homa-planning/reconciliation/implementation-notes.md#discovery-1",
      "evidence",
      "repository",
    ],
    [
      "docs/homa-planning/lead-magnet/index.html#assembler",
      "evidence",
      "repository",
    ],
    ["ticket:M1-17", "ticket", "ticket"],
  ];
  for (const [reference, referenceType, expectedKind] of validCases) {
    const errors = [];
    const result = validateLedgerReference(
      repoRoot,
      reference,
      `${referenceType}_probe`,
      0,
      errors,
      referenceType,
    );
    if (errors.length > 0 || result.kind !== expectedKind) {
      throw new Error(
        `Reference-type guard rejected valid ${referenceType} probe: ${reference}`,
      );
    }
  }

  const invalidCases = [
    ["ticket:M1-17", "authority"],
    ["ruling:global-D8-casing", "evidence"],
    ["AGENTS.md#commands", "ticket"],
    ["ruling:invented-token", "authority"],
    ["ticket:INVENTED-999", "ticket"],
    ["AGENTS.md#Commands", "evidence"],
    ["AGENTS.md#code-style-and-voice", "evidence"],
    ["AGENTS.md#invented-anchor", "evidence"],
    ["AGENTS.md#invented-anchor", "authority"],
    ["AGENTS.md#L0", "evidence"],
    ["AGENTS.md#L1-2", "evidence"],
    ["AGENTS.md#L999999", "evidence"],
    ["docs/homa-planning/lead-magnet/index.html#Assembler", "evidence"],
  ];
  for (const [reference, referenceType] of invalidCases) {
    const errors = [];
    const result = validateLedgerReference(
      repoRoot,
      reference,
      `${referenceType}_probe`,
      0,
      errors,
      referenceType,
    );
    if (errors.length === 0 || result.kind !== "invalid") {
      throw new Error(
        `Reference-type guard accepted invalid ${referenceType} probe: ${reference}`,
      );
    }
  }

  const validLocator = {
    reference: "AGENTS.md#commands",
    ...validateLedgerReference(
      repoRoot,
      "AGENTS.md#commands",
      "locator_probe",
      0,
      [],
      "evidence",
    ),
  };
  const invalidLocator = {
    reference: "AGENTS.md#invented-anchor",
    ...validateLedgerReference(
      repoRoot,
      "AGENTS.md#invented-anchor",
      "locator_probe",
      0,
      [],
      "evidence",
    ),
  };
  if (
    !repositoryReferenceHasValidLocator(repoRoot, validLocator) ||
    repositoryReferenceHasValidLocator(repoRoot, invalidLocator)
  ) {
    throw new Error("Repository locator resolution probes are inconsistent");
  }

  const misplacedRuling = {
    locator:
      "docs/homa-planning/journeys/10-reconciliation.md#2-journey-derived-tickets-global-renumbering-mj-series",
    marker: "| D8 |",
  };
  const invalidTicketFragment = {
    locator: "docs/homa-planning/03-backlog.md#invented-ticket-section",
    marker: "| M1-17",
  };
  if (
    registeredReferenceHasValidScopedMarker(
      repoRoot,
      "ruling:scope-probe",
      misplacedRuling,
      "ruling",
    ) ||
    registeredReferenceHasValidScopedMarker(
      repoRoot,
      "ticket:fragment-probe",
      invalidTicketFragment,
      "ticket",
    )
  ) {
    throw new Error("Registered reference scope probes are inconsistent");
  }

  for (const reference of [
    "AGENTS.md#Commands",
    "https://example.com/canonical",
  ]) {
    const errors = [];
    const result = validateCanonicalReference(
      repoRoot,
      reference,
      0,
      errors,
      new Set(["AGENTS.md"]),
    );
    if (errors.length === 0 || result.kind === "repository") {
      throw new Error(
        `Terminal canonical reference probe accepted invalid locator: ${reference}`,
      );
    }
  }

  const terminalEvidenceCases = [
    {
      evidence: `${PRODUCTION_BASELINE_PATH}#deployment`,
      expected: true,
      row: {
        claim_kind: "production",
        truth_basis: "vercel:deployment-inspection",
      },
    },
    {
      evidence: `${REPOSITORY_BASELINE_PATH}#revision-boundary`,
      expected: false,
      row: {
        claim_kind: "production",
        truth_basis: "vercel:deployment-inspection",
      },
    },
    {
      evidence: `${REPOSITORY_BASELINE_PATH}#toolchain-observation`,
      expected: true,
      row: {
        claim_kind: "command",
        truth_basis: "command:version-output",
      },
    },
    {
      evidence: `${PRODUCTION_BASELINE_PATH}#deployment`,
      expected: false,
      row: {
        claim_kind: "command",
        truth_basis: "command:version-output",
      },
    },
    {
      evidence: `${PRODUCTION_BASELINE_PATH}#deployment`,
      expected: false,
      row: {
        claim_kind: "production",
        truth_basis: "vercel:invented-nonempty-detail",
      },
    },
  ];
  for (const probe of terminalEvidenceCases) {
    const errors = [];
    const validated = validateLedgerReference(
      repoRoot,
      probe.evidence,
      "terminal_evidence_probe",
      0,
      errors,
      "evidence",
    );
    if (errors.length > 0 || validated.kind !== "repository") {
      throw new Error(
        `Terminal evidence probe uses an invalid control locator: ${probe.evidence}`,
      );
    }
    const accepted = hasRequiredTerminalEvidence(probe.row, [
      { reference: probe.evidence, ...validated },
    ]);
    const classErrors = [];
    validateTerminalEvidenceClass(
      probe.row,
      [{ reference: probe.evidence, ...validated }],
      0,
      classErrors,
    );
    if (
      accepted !== probe.expected ||
      (probe.expected && classErrors.length > 0) ||
      (!probe.expected && classErrors.length === 0)
    ) {
      throw new Error(
        `Terminal evidence class probe produced the wrong result: ${probe.row.truth_basis} with ${probe.evidence}`,
      );
    }
  }
}

function verifyFilesystemResolutionRules(repoRoot) {
  resolveSafeExistingPath(repoRoot, "AGENTS.md", "Filesystem safety probe");
  const rejectedProbes = ["CLAUDE.md", "HOMA-TEMPLATE/example.md"];
  for (const probe of rejectedProbes) {
    let rejected = false;
    try {
      resolveSafeExistingPath(repoRoot, probe, "Filesystem safety probe");
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`Filesystem safety probe accepted unsafe path: ${probe}`);
    }
  }
}

function isLifecycleDispositionCompatible(lifecycle, disposition) {
  return LIFECYCLE_DISPOSITION_COMPATIBILITY.get(lifecycle)?.has(disposition) ?? false;
}

function verifyLifecycleCompatibility() {
  const coveredDispositions = new Set();

  for (const lifecycle of ENUMS.lifecycle) {
    const dispositions = LIFECYCLE_DISPOSITION_COMPATIBILITY.get(lifecycle);
    if (!dispositions || dispositions.size === 0) {
      throw new Error(`Lifecycle compatibility is missing: ${lifecycle}`);
    }
    for (const disposition of dispositions) {
      if (!ENUMS.disposition.has(disposition)) {
        throw new Error(
          `Lifecycle ${lifecycle} references unknown disposition: ${disposition}`,
        );
      }
      coveredDispositions.add(disposition);
    }
  }

  for (const lifecycle of LIFECYCLE_DISPOSITION_COMPATIBILITY.keys()) {
    if (!ENUMS.lifecycle.has(lifecycle)) {
      throw new Error(`Compatibility matrix has unknown lifecycle: ${lifecycle}`);
    }
  }
  for (const disposition of ENUMS.disposition) {
    if (!coveredDispositions.has(disposition)) {
      throw new Error(`Disposition compatibility is missing: ${disposition}`);
    }
  }

  const rejectedPairs = [
    ["current", "deleted"],
    ["removed", "retain-current"],
    ["upcoming", "retain-current"],
    ["historical", "retain-current"],
    ["alias", "vendored-frozen"],
  ];
  for (const [lifecycle, disposition] of rejectedPairs) {
    if (isLifecycleDispositionCompatible(lifecycle, disposition)) {
      throw new Error(
        `Lifecycle guard accepted contradictory pair: ${lifecycle}/${disposition}`,
      );
    }
  }

  if (
    !isLifecycleDispositionCompatible("historical", "unresolved") ||
    !isLifecycleDispositionCompatible("historical", "historical-annotated") ||
    !isLifecycleDispositionCompatible("current", "retain-current") ||
    !isLifecycleDispositionCompatible("removed", "relocated")
  ) {
    throw new Error("Lifecycle guard rejected a required valid transition");
  }
}

function verifyCandidateFileSafetyRules() {
  if (
    !isNamedFilesystemAlias("CLAUDE.md") ||
    !isNamedFilesystemAlias("apps/mobile/CLAUDE.md") ||
    isNamedFilesystemAlias("apps/web/CLAUDE.md") ||
    isNamedFilesystemAlias("docs/unknown.md")
  ) {
    throw new Error("Named documentation alias safety rules are inconsistent");
  }
  if (
    isVendoredMarbleDocumentation(
      "docs/homa-benchmarks/marble/README-HOMA.md",
    ) ||
    !isVendoredMarbleDocumentation("docs/homa-benchmarks/marble/README.md") ||
    isVendoredMarbleDocumentation(
      "docs/homa-benchmarks/marble/UNREGISTERED.md",
    )
  ) {
    throw new Error("Explicit upstream Marble inventory is inconsistent");
  }
}

function verifyClaimStatusRules() {
  for (const status of TERMINAL_CLAIM_STATUSES) {
    const rule = TERMINAL_STATUS_RULES.get(status);
    if (!rule) {
      throw new Error(`Terminal claim status is missing a transition rule: ${status}`);
    }
    if (rule.claimKinds.size === 0) {
      throw new Error(`Terminal claim status has no allowed claim kinds: ${status}`);
    }
    for (const claimKind of rule.claimKinds) {
      if (!CLAIM_KINDS.has(claimKind)) {
        throw new Error(
          `Terminal claim status ${status} references unknown claim kind: ${claimKind}`,
        );
      }
    }
  }

  for (const status of TERMINAL_STATUS_RULES.keys()) {
    if (!TERMINAL_CLAIM_STATUSES.has(status)) {
      throw new Error(`Transition matrix has unknown terminal claim status: ${status}`);
    }
  }

  for (const status of TERMINAL_CLAIM_STATUSES) {
    const dispositions = TERMINAL_CLAIM_MANIFEST_DISPOSITIONS.get(status);
    if (!dispositions || dispositions.size === 0) {
      throw new Error(
        `Terminal claim status is missing a manifest transition: ${status}`,
      );
    }
    for (const disposition of dispositions) {
      if (!ENUMS.disposition.has(disposition)) {
        throw new Error(
          `Terminal claim status ${status} references unknown manifest disposition: ${disposition}`,
        );
      }
    }
  }
}

function verifyProhibitedGuard() {
  for (const prefix of PROHIBITED_PREFIXES) {
    if (!isProhibitedPath(`${prefix}guard-probe.md`)) {
      throw new Error(`Prohibited-prefix guard is inactive for ${prefix}`);
    }
    if (!isProhibitedPath(`${prefix.toUpperCase()}guard-probe.md`)) {
      throw new Error(`Case-folded prohibited-prefix guard is inactive for ${prefix}`);
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
    "docs/HOMA-TEMPLATE-notes.md",
  ];
  for (const probe of safeProbes) {
    assertSafeCandidate(probe);
  }

  const unsafeProbes = [
    "homa-template/example.md",
    "HOMA-TEMPLATE/example.md",
    "Homa-MacMini/example.md",
    "HOMA-RESEARCH/example.md",
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

  verifyLifecycleCompatibility();
  verifyCandidateFileSafetyRules();
  verifyClaimStatusRules();
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
    path ===
      "docs/homa-planning/history/2026-07-11-human-todo-archive.md" ||
    path.startsWith("docs/homa-planning/reconciliation/")
  );
}

function collectCandidates(
  repoRoot,
  { includeManifestForBootstrap = false, errors, baselineByPath } = {},
) {
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

  function recordCandidate(path, startingState) {
    try {
      assertSafeCandidate(path);
    } catch (error) {
      if (!errors) throw error;
      errors.push(error.message);
      return;
    }

    if (!isDocumentationCandidate(path)) return;

    let inspection;
    try {
      inspection = inspectDocumentationCandidatePath(repoRoot, path);
    } catch (error) {
      if (!errors) throw error;
      errors.push(error.message);
      return;
    }

    const frozenStartingState = baselineByPath?.get(path)?.starting_state;
    candidates.set(path, {
      startingState: frozenStartingState ?? startingState,
      present: inspection.present,
    });
  }

  for (const path of tracked) {
    recordCandidate(path, "tracked");
  }

  for (const path of untracked) {
    if (candidates.has(path)) continue;
    recordCandidate(
      path,
      isAuditCreated(path) ? "audit-created" : "pre-existing-untracked",
    );
  }

  for (const [path, baselineRow] of baselineByPath ?? []) {
    if (baselineRow.starting_state !== "tracked" || candidates.has(path)) {
      continue;
    }
    recordCandidate(path, "tracked");
  }

  if (includeManifestForBootstrap && !candidates.has(MANIFEST_PATH)) {
    candidates.set(MANIFEST_PATH, {
      startingState: "audit-created",
      present: false,
    });
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
      claim_scope: `none:Alias delegates every instruction to ${targetPath}.`,
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
        "none:Generated output is verified through its generator and inputs.",
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
        "none:Frozen upstream Marble content has no Homa-authored statements.",
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
  const auditControlDirectory = resolveSafeExistingPath(
    repoRoot,
    dirname(MANIFEST_PATH),
    "Audit-control directory",
  );
  const absoluteManifestPath = join(
    auditControlDirectory.absolutePath,
    MANIFEST_PATH.split("/").at(-1),
  );
  let existingManifest;
  try {
    existingManifest = lstatSync(absoluteManifestPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (existingManifest) {
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
    const row = initialRow(path, candidates.get(path).startingState);
    lines.push(
      MANIFEST_COLUMNS.map((column) => serializeField(row[column])).join("\t"),
    );
  }

  writeFileSync(absoluteManifestPath, `${lines.join("\n")}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
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

function validateAuditControlBaseline(
  candidates,
  manifestRows,
  baselineRows,
  baselineByPath,
  errors,
) {
  const manifestByPath = new Map(manifestRows.map((row) => [row.path, row]));

  for (const row of manifestRows) {
    if (row.path === AUDIT_CONTROL_BASELINE_PATH) {
      if (row.starting_state !== "audit-created") {
        errors.push(
          `${AUDIT_CONTROL_BASELINE_PATH} must use audit-created starting_state`,
        );
      }
      continue;
    }
    const baselineRow = baselineByPath.get(row.path);
    if (!baselineRow) {
      errors.push(`Manifest path is absent from immutable first-seen baseline: ${row.path}`);
    } else if (row.starting_state !== baselineRow.starting_state) {
      errors.push(
        `${row.path} starting_state drifted from ${baselineRow.starting_state} to ${row.starting_state}`,
      );
    }
  }

  for (const baselineRow of baselineRows) {
    if (!manifestByPath.has(baselineRow.path)) {
      errors.push(
        `Immutable first-seen baseline path is absent from manifest: ${baselineRow.path}`,
      );
    }
  }

  for (const path of candidates.keys()) {
    if (path === AUDIT_CONTROL_BASELINE_PATH) continue;
    if (!baselineByPath.has(path)) {
      errors.push(`Current candidate is absent from immutable first-seen baseline: ${path}`);
    }
  }
}

function validateCoverage(repoRoot, candidates, rows, errors) {
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
  for (const [path, candidate] of candidates) {
    if (candidate.present) continue;
    const row = byPath.get(path);
    if (!row) continue;
    const allowedLifecycles = MANIFEST_ONLY_TERMINAL_STATES.get(row.disposition);
    if (!allowedLifecycles?.has(row.lifecycle)) {
      errors.push(
        `Absent tracked documentation ${path} must use deleted/removed, relocated/removed, or archived/archived terminal state`,
      );
    } else if (!hasTerminalManifestEvidence(row)) {
      errors.push(
        `Absent tracked documentation ${path} must record substantive disposition evidence`,
      );
    }
  }

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
        continue;
      }

      let inspection;
      try {
        inspection = inspectDocumentationCandidatePath(repoRoot, path);
      } catch (error) {
        errors.push(error.message);
        continue;
      }
      if (inspection.present) {
        errors.push(
          `Manifest-only path ${path} still exists in the working tree and cannot use terminal-history validation`,
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

  try {
    parentPath = dirname(path);
    resolveSafeExistingPath(repoRoot, parentPath, "Alias parent");
    targetPath = repositoryTargetForAlias(path, alias.target);
    resolveSafeExistingPath(
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
      if (actualTargetPath !== targetPath) {
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

function validateLifecycleDisposition(candidates, rows, errors) {
  for (const row of rows) {
    if (!isLifecycleDispositionCompatible(row.lifecycle, row.disposition)) {
      errors.push(
        `${row.path} has incompatible lifecycle/disposition: ${row.lifecycle}/${row.disposition}`,
      );
    }

    if (candidates.get(row.path)?.present && row.lifecycle === "removed") {
      errors.push(
        `${row.path} is present in the working tree and cannot use removed/${row.disposition}`,
      );
    }
  }
}

function validateSpecialRows(repoRoot, rows, preservedTerminalPaths, errors) {
  const byPath = new Map(rows.map((row) => [row.path, row]));

  for (const row of rows) {
    let expectedFormat;
    let expectedArea;
    try {
      expectedFormat = formatForPath(row.path);
      expectedArea = areaForPath(row.path);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (row.format !== expectedFormat) {
      errors.push(
        `${row.path} format must be derived as ${expectedFormat}, not ${row.format}`,
      );
    }
    if (row.area !== expectedArea) {
      errors.push(
        `${row.path} area must be derived as ${expectedArea}, not ${row.area}`,
      );
    }

    const claimsAlias =
      row.authority_class === "alias" ||
      row.lifecycle === "alias" ||
      row.disposition === "alias";
    const claimsGenerated =
      row.authority_class === "generated" ||
      row.lifecycle === "generated" ||
      row.disposition === "generated-excluded";
    const claimsVendored =
      row.authority_class === "vendored" ||
      row.lifecycle === "vendored" ||
      row.disposition === "vendored-frozen";
    if (claimsAlias && !ALIASES.has(row.path)) {
      errors.push(`${row.path} cannot self-declare alias classification`);
    }
    if (claimsGenerated && !GENERATED_ARTIFACTS.has(row.path)) {
      errors.push(`${row.path} cannot self-declare generated classification`);
    }
    if (claimsVendored && !UPSTREAM_MARBLE_DOCUMENTATION.has(row.path)) {
      errors.push(`${row.path} cannot self-declare vendored classification`);
    }
  }

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
      row.format !== "markdown" ||
      row.area !== "planning" ||
      row.authority_class !== "historical-record" ||
      row.lifecycle !== "historical" ||
      !MIXED_HISTORICAL_DISPOSITIONS.has(row.disposition)
    ) {
      errors.push(
        `${path} must remain a mixed historical record, unresolved during audit or historical-annotated when resolved`,
      );
    }
  }

  for (const path of HOMA_AUTHORED_MARBLE_DOCUMENTATION) {
    if (preservedTerminalPaths.has(path)) continue;
    const row = byPath.get(path);
    if (!row) continue;
    if (
      row.format !== "markdown" ||
      row.area !== "benchmarks" ||
      row.authority_class !== "benchmark-source" ||
      !HOMA_AUTHORED_LIFECYCLES.has(row.lifecycle)
    ) {
      errors.push(
        `${path} must retain its Homa-authored benchmark classification and claim scope`,
      );
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

  for (const path of UPSTREAM_MARBLE_DOCUMENTATION) {
    if (preservedTerminalPaths.has(path)) continue;
    const row = byPath.get(path);
    if (!row) continue;
    if (
      row.authority_class !== "vendored" ||
      row.lifecycle !== "vendored" ||
      row.disposition !== "vendored-frozen"
    ) {
      errors.push(`${path} must be recorded as vendored-frozen`);
    }
  }
}

function parseDelimitedLedgerField(
  value,
  delimiter,
  label,
  lineNumber,
  errors,
  { allowDash = true } = {},
) {
  if (value === "-") {
    if (!allowDash) {
      errors.push(`Claim ledger line ${lineNumber} cannot use - for ${label}`);
    }
    return [];
  }

  const items = value.split(delimiter);
  const seen = new Set();
  for (const item of items) {
    if (item.length === 0 || item !== item.trim()) {
      errors.push(
        `Claim ledger line ${lineNumber} has an empty or padded ${label} item`,
      );
      continue;
    }
    if (seen.has(item)) {
      errors.push(
        `Claim ledger line ${lineNumber} repeats ${label} item: ${item}`,
      );
    }
    seen.add(item);
  }
  return items;
}

function repositoryPathFromReference(reference, label, lineNumber, errors) {
  const hashIndex = reference.indexOf("#");
  const repositoryPath =
    hashIndex === -1 ? reference : reference.slice(0, hashIndex);
  const locator = hashIndex === -1 ? undefined : reference.slice(hashIndex + 1);

  if (locator !== undefined && (locator.length === 0 || locator.includes("#"))) {
    errors.push(
      `Claim ledger line ${lineNumber} has an invalid ${label} locator: ${reference}`,
    );
  }

  try {
    assertSafeCandidate(repositoryPath);
  } catch (error) {
    errors.push(
      `Claim ledger line ${lineNumber} has an unsafe ${label}: ${error.message}`,
    );
    return undefined;
  }
  return repositoryPath;
}

function validateLedgerReference(
  repoRoot,
  reference,
  label,
  lineNumber,
  errors,
  referenceType,
) {
  const errorCountAtStart = errors.length;
  const isNamedToken = /^(?:ruling|ticket|decision):/.test(reference);
  if (referenceType === "ticket") {
    // GitHub Issues became the live tracker on 2026-07-25 (founder
    // directive; AGENTS.md section "Tickets and issue tracking"). gh#N
    // tokens point at issues in sidneyswift/homa; issue existence is not
    // verifiable offline, so the token format is the contract here.
    if (/^gh#[1-9][0-9]*$/.test(reference)) {
      return { kind: "ticket", repositoryPath: undefined };
    }
    if (!/^ticket:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(reference)) {
      errors.push(
        `Claim ledger line ${lineNumber} ${label} accepts registered ticket tokens only: ${reference}`,
      );
      return { kind: "invalid", repositoryPath: undefined };
    }
    if (!REGISTERED_TICKETS.has(reference)) {
      errors.push(
        `Claim ledger line ${lineNumber} references unregistered ticket token: ${reference}`,
      );
      return { kind: "invalid", repositoryPath: undefined };
    }
    return { kind: "ticket", repositoryPath: undefined };
  }

  if (isNamedToken) {
    if (referenceType === "evidence") {
      errors.push(
        `Claim ledger line ${lineNumber} ${label} cannot use named ticket, ruling, or decision tokens: ${reference}`,
      );
      return { kind: "invalid", repositoryPath: undefined };
    }
    if (!/^(?:ruling|decision):[A-Za-z0-9][A-Za-z0-9._-]*$/.test(reference)) {
      errors.push(
        `Claim ledger line ${lineNumber} ${label} accepts registered ruling or decision tokens only: ${reference}`,
      );
      return { kind: "invalid", repositoryPath: undefined };
    }
    if (!REGISTERED_RULINGS.has(reference)) {
      errors.push(
        `Claim ledger line ${lineNumber} references unregistered ruling or decision token: ${reference}`,
      );
      return { kind: "invalid", repositoryPath: undefined };
    }
    return { kind: "ruling", repositoryPath: undefined };
  }

  if (reference.startsWith("https://")) {
    try {
      const url = new URL(reference);
      if (
        url.protocol !== "https:" ||
        url.hostname.length === 0 ||
        url.username.length > 0 ||
        url.password.length > 0
      ) {
        throw new Error("URL must be an unauthenticated https URL");
      }
      return { kind: "url", repositoryPath: undefined };
    } catch (error) {
      errors.push(
        `Claim ledger line ${lineNumber} has an invalid ${label} URL: ${error.message}`,
      );
      return { kind: "invalid", repositoryPath: undefined };
    }
  }

  const repositoryPath = repositoryPathFromReference(
    reference,
    label,
    lineNumber,
    errors,
  );
  if (repositoryPath) {
    try {
      inspectRepositoryReferencePath(repoRoot, repositoryPath);
    } catch (error) {
      errors.push(
        `Claim ledger line ${lineNumber} has invalid ${label}: ${error.message}`,
      );
      return { kind: "invalid", repositoryPath };
    }
    if (reference.includes("#")) {
      const candidate = {
        kind: "repository",
        reference,
        repositoryPath,
      };
      try {
        if (repositoryReferenceHasValidLocator(repoRoot, candidate)) {
          return { kind: "repository", repositoryPath };
        }
        errors.push(
          `Claim ledger line ${lineNumber} has an unresolved ${label} locator: ${reference}`,
        );
      } catch (error) {
        errors.push(
          `Claim ledger line ${lineNumber} has invalid ${label} locator: ${error.message}`,
        );
      }
    }
  }
  return {
    kind:
      repositoryPath && errors.length === errorCountAtStart
        ? "repository"
        : "invalid",
    repositoryPath,
  };
}

function validateLedgerReferenceList(
  repoRoot,
  value,
  label,
  lineNumber,
  errors,
  referenceType,
) {
  const references = parseDelimitedLedgerField(
    value,
    ";",
    label,
    lineNumber,
    errors,
  );
  return references.map((reference) => ({
    reference,
    ...validateLedgerReference(
      repoRoot,
      reference,
      label,
      lineNumber,
      errors,
      referenceType,
    ),
  }));
}

function validateCanonicalReference(
  repoRoot,
  reference,
  lineNumber,
  errors,
  manifestPaths,
) {
  const validated = validateLedgerReference(
    repoRoot,
    reference,
    "canonical_ref",
    lineNumber,
    errors,
    "evidence",
  );
  if (validated.kind !== "repository") {
    errors.push(
      `Claim ledger line ${lineNumber} canonical_ref must resolve to a repository locator`,
    );
    return validated;
  }
  if (!manifestPaths.has(validated.repositoryPath)) {
    errors.push(
      `Claim ledger line ${lineNumber} canonical_ref is absent from the manifest: ${validated.repositoryPath}`,
    );
  }
  return validated;
}

function truthBasisPrefix(value, lineNumber, errors) {
  const separatorIndex = value.indexOf(":");
  const prefix = separatorIndex === -1 ? value : value.slice(0, separatorIndex);
  const detail = separatorIndex === -1 ? "" : value.slice(separatorIndex + 1);
  if (!TRUTH_BASIS_PREFIXES.has(prefix) || detail.trim().length === 0) {
    errors.push(
      `Claim ledger line ${lineNumber} has invalid truth_basis: ${value}`,
    );
  }
  return prefix;
}

function validateClaimText(value, field, lineNumber, errors) {
  if (value.includes("\u2014")) {
    errors.push(
      `Claim ledger line ${lineNumber} ${field} contains a prohibited em dash`,
    );
  }
  if (CLAIM_PLACEHOLDER_PATTERN.test(value)) {
    errors.push(
      `Claim ledger line ${lineNumber} ${field} is a generic placeholder: ${value}`,
    );
  }
  if (value.length > 800) {
    errors.push(
      `Claim ledger line ${lineNumber} ${field} exceeds 800 characters`,
    );
  }
  if (
    field === "claim_before" &&
    value !== "-" &&
    value.length < 12
  ) {
    errors.push(
      `Claim ledger line ${lineNumber} claim_before is not a concise falsifiable statement`,
    );
  }
  if (
    field === "resolved_claim" &&
    !["SAME", "REMOVED", "-"].includes(value) &&
    value.length < 12
  ) {
    errors.push(
      `Claim ledger line ${lineNumber} resolved_claim is not a concise falsifiable statement`,
    );
  }
}

function terminalEvidenceRequirement(row) {
  return TERMINAL_EVIDENCE_REQUIREMENTS.get(row.claim_kind)?.get(
    row.truth_basis,
  );
}

function hasRequiredTerminalEvidence(row, evidenceReferences) {
  const requiredLocators = terminalEvidenceRequirement(row);
  return (
    requiredLocators !== undefined &&
    evidenceReferences.some(
      (reference) =>
        reference.kind === "repository" &&
        requiredLocators.has(reference.reference),
    )
  );
}

function validateTerminalEvidenceClass(
  row,
  evidenceReferences,
  lineNumber,
  errors,
) {
  const classRequirements = TERMINAL_EVIDENCE_REQUIREMENTS.get(row.claim_kind);
  if (!classRequirements) return;
  const requiredLocators = classRequirements.get(row.truth_basis);
  if (!requiredLocators) {
    errors.push(
      `Claim ledger line ${lineNumber} terminal ${row.claim_kind} claim uses an unregistered evidence truth_basis: ${row.truth_basis}`,
    );
    return;
  }
  if (!hasRequiredTerminalEvidence(row, evidenceReferences)) {
    errors.push(
      `Claim ledger line ${lineNumber} terminal ${row.claim_kind} claim requires registered evidence locator: ${[...requiredLocators].join(" or ")}`,
    );
  }
}

function validateTerminalClaim(row, context, errors) {
  const {
    lineNumber,
    authorityReferences,
    evidenceReferences,
    ticketReferences,
    truthPrefix,
  } = context;
  const status = row.resolution_status;
  const hasAuthority = authorityReferences.length > 0;
  const hasEvidence = evidenceReferences.length > 0;
  const hasTicket = ticketReferences.length > 0;
  const statusRule = TERMINAL_STATUS_RULES.get(status);

  if (!statusRule) {
    errors.push(
      `Claim ledger line ${lineNumber} has no terminal status transition rule: ${status}`,
    );
  } else {
    if (!statusRule.claimKinds.has(row.claim_kind)) {
      errors.push(
        `Claim ledger line ${lineNumber} ${status} does not allow claim_kind ${row.claim_kind}`,
      );
    }

    if (
      statusRule.resolvedClaimMode === "same" &&
      row.resolved_claim !== "SAME"
    ) {
      errors.push(
        `Claim ledger line ${lineNumber} ${status} requires resolved_claim SAME`,
      );
    }
    if (
      statusRule.resolvedClaimMode === "written" &&
      new Set(["SAME", "REMOVED", "-"]).has(row.resolved_claim)
    ) {
      errors.push(
        `Claim ledger line ${lineNumber} ${status} requires a written corrected claim`,
      );
    }
    if (
      statusRule.resolvedClaimMode === "removed" &&
      row.resolved_claim !== "REMOVED"
    ) {
      errors.push(
        `Claim ledger line ${lineNumber} ${status} requires resolved_claim REMOVED`,
      );
    }
    if (
      statusRule.resolvedClaimMode === "retained" &&
      new Set(["REMOVED", "-"]).has(row.resolved_claim)
    ) {
      errors.push(
        `Claim ledger line ${lineNumber} ${status} requires a retained claim`,
      );
    }
    if (statusRule.requiresCanonicalRef && row.canonical_ref === "-") {
      errors.push(
        `Claim ledger line ${lineNumber} ${status} requires canonical_ref`,
      );
    }
  }

  if (!hasAuthority && !hasEvidence && !hasTicket) {
    errors.push(
      `Claim ledger line ${lineNumber} terminal claim lacks substantive authority or evidence`,
    );
  }

  if (row.claim_kind === "policy" && !hasAuthority) {
    errors.push(
      `Claim ledger line ${lineNumber} terminal policy claim requires authority_refs`,
    );
  }
  if (row.claim_kind === "repository" && !hasEvidence) {
    errors.push(
      `Claim ledger line ${lineNumber} terminal repository claim requires evidence_refs`,
    );
  }
  // A claim resolved as "removed" under a policy basis was withdrawn
  // together with its source document (first case: HUMAN-TODO.md deleted
  // 2026-07-25 when the founder queue moved to GitHub Issues). It asserts
  // nothing about production or external state, so the per-kind
  // verification evidence classes below do not apply. The removal-specific
  // rules (remediation evidence, per-present-source locators, Git history)
  // still run in the manifest and ledger passes.
  if (status === "removed" && truthPrefix === "policy") {
    return;
  }
  if (row.claim_kind === "production") {
    validateTerminalEvidenceClass(
      row,
      evidenceReferences,
      lineNumber,
      errors,
    );
    if (!new Set(["vercel", "supabase"]).has(truthPrefix)) {
      errors.push(
        `Claim ledger line ${lineNumber} terminal production claim requires vercel: or supabase: truth_basis`,
      );
    }
  }
  if (row.claim_kind === "command") {
    validateTerminalEvidenceClass(
      row,
      evidenceReferences,
      lineNumber,
      errors,
    );
    if (truthPrefix !== "command") {
      errors.push(
        `Claim ledger line ${lineNumber} terminal command claim requires command: truth_basis`,
      );
    }
  }
  if (row.claim_kind === "external") {
    const hasOfficialUrl = [...authorityReferences, ...evidenceReferences].some(
      (reference) => reference.kind === "url",
    );
    if (!hasOfficialUrl || truthPrefix !== "external") {
      errors.push(
        `Claim ledger line ${lineNumber} terminal external claim requires an https reference and external: truth_basis`,
      );
    }
  }
  if (status === "upcoming-ticketed") {
    if (!hasTicket || truthPrefix !== "ticket") {
      errors.push(
        `Claim ledger line ${lineNumber} upcoming-ticketed requires ticket_refs and ticket: truth_basis`,
      );
    }
  }
  if (status === "historical-annotated" && truthPrefix !== "history") {
    errors.push(
      `Claim ledger line ${lineNumber} historical-annotated requires history: truth_basis`,
    );
  }
}

function normalizeLocatableText(value) {
  return value
    .replace(/[`*_>#|\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function repositoryPathHasGitHistory(repoRoot, repositoryPath) {
  assertSafeCandidate(repositoryPath);
  return (
    runGit(repoRoot, ["log", "--all", "--format=%H", "--", repositoryPath]).trim()
      .length > 0
  );
}

function decodeMarkdownEntities(value) {
  const named = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["gt", ">"],
    ["lt", "<"],
    ["quot", '"'],
  ]);
  return value
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, number) => {
      try {
        const radix = number[0].toLowerCase() === "x" ? 16 : 10;
        const digits = radix === 16 ? number.slice(1) : number;
        return String.fromCodePoint(Number.parseInt(digits, radix));
      } catch {
        return entity;
      }
    })
    .replace(/&(amp|apos|gt|lt|quot);/gi, (entity, name) => {
      return named.get(name.toLowerCase()) ?? entity;
    });
}

function markdownHeadingSlug(headingText) {
  return decodeMarkdownEntities(
    headingText
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/\\([\\`*_[\]{}()#+.!<>-])/g, "$1")
      .replace(/[`*_~]/g, ""),
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Connector_Punctuation}\u200C\u200D -]/gu,
      "",
    )
    .replace(/ /g, "-");
}

function documentLines(contents) {
  const lines = contents.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function markdownHeadingLocations(lines) {
  const candidates = [];
  let fence;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.character &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim().length === 0
      ) {
        fence = undefined;
      }
      continue;
    }
    if (fenceMatch) {
      fence = {
        character: fenceMatch[1][0],
        length: fenceMatch[1].length,
      };
      continue;
    }

    const atxMatch = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/);
    if (atxMatch) {
      const text = atxMatch[2]
        .replace(/[ \t]+#+[ \t]*$/, "")
        .trim();
      candidates.push({
        level: atxMatch[1].length,
        startLine: index + 1,
        text,
      });
      continue;
    }

    const setextMatch = line.match(/^ {0,3}(=+|-+)[ \t]*$/);
    if (setextMatch && index > 0) {
      const text = lines[index - 1].trim();
      if (
        text.length > 0 &&
        !/^ {0,3}(?:>|#{1,6}(?:[ \t]+|$)|[-+*][ \t]+|\d+[.)][ \t]+)/.test(
          lines[index - 1],
        )
      ) {
        candidates.push({
          level: setextMatch[1][0] === "=" ? 1 : 2,
          startLine: index,
          text,
        });
      }
    }
  }

  const usedSlugs = new Set();
  for (const candidate of candidates) {
    const baseSlug = markdownHeadingSlug(candidate.text);
    let slug = baseSlug;
    let duplicate = 0;
    while (usedSlugs.has(slug)) {
      duplicate += 1;
      slug = `${baseSlug}-${duplicate}`;
    }
    usedSlugs.add(slug);
    candidate.slug = slug;
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const nextPeer = candidates
      .slice(index + 1)
      .find((later) => later.level <= candidate.level);
    candidate.endLine = nextPeer ? nextPeer.startLine - 1 : lines.length;
  }
  return candidates;
}

function maskNonNewlineCharacters(value) {
  return value.replace(/[^\n]/g, " ");
}

function maskMarkdownFences(contents) {
  const lines = contents.split("\n");
  let fence;
  return lines
    .map((line) => {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (
          fenceMatch &&
          fenceMatch[1][0] === fence.character &&
          fenceMatch[1].length >= fence.length &&
          fenceMatch[2].trim().length === 0
        ) {
          fence = undefined;
        }
        return maskNonNewlineCharacters(line);
      }
      if (fenceMatch) {
        fence = {
          character: fenceMatch[1][0],
          length: fenceMatch[1].length,
        };
        return maskNonNewlineCharacters(line);
      }
      return line;
    })
    .join("\n");
}

function htmlLocatorSource(contents, repositoryPath) {
  let source = /\.(?:md|mdx)$/i.test(repositoryPath)
    ? maskMarkdownFences(contents)
    : contents;
  source = source.replace(/<!--[\s\S]*?-->/g, maskNonNewlineCharacters);
  return source.replace(
    /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
    (_match, opening, _tagName, body, closing) =>
      `${opening}${maskNonNewlineCharacters(body)}${closing}`,
  );
}

function htmlIdLocation(contents, repositoryPath, fragment, lines) {
  const locatorSource = htmlLocatorSource(contents, repositoryPath);
  const tagPattern = /<([A-Za-z][A-Za-z0-9:-]*)\b([^<>]*?)>/gs;
  for (const match of locatorSource.matchAll(tagPattern)) {
    const tagName = match[1].toLowerCase();
    const attributePattern =
      /\b(id|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
    for (const attribute of match[2].matchAll(attributePattern)) {
      const attributeName = attribute[1].toLowerCase();
      const value = decodeMarkdownEntities(
        attribute[2] ?? attribute[3] ?? attribute[4],
      );
      if (
        value !== fragment ||
        (attributeName === "name" && tagName !== "a")
      ) {
        continue;
      }
      const before = locatorSource.slice(0, match.index);
      const startLine = (before.match(/\n/g) ?? []).length + 1;
      const closingPattern = new RegExp(`</${tagName}\\s*>`, "gi");
      closingPattern.lastIndex = match.index + match[0].length;
      const closingMatch = closingPattern.exec(locatorSource);
      const endOffset = closingMatch
        ? closingMatch.index + closingMatch[0].length
        : match.index + match[0].length;
      const endLine =
        (locatorSource.slice(0, endOffset).match(/\n/g) ?? []).length + 1;
      return {
        endLine: Math.min(endLine, lines.length),
        kind: "html-id",
        startLine,
      };
    }
  }
  return undefined;
}

function resolveRepositoryReferenceLocator(repoRoot, reference, purpose) {
  if (
    reference.kind !== "repository" ||
    !reference.repositoryPath ||
    !reference.reference.includes("#")
  ) {
    return undefined;
  }
  const rawFragment = reference.reference.slice(
    reference.reference.indexOf("#") + 1,
  );
  if (!rawFragment || rawFragment.includes("#")) return undefined;
  let fragment;
  try {
    fragment = decodeURIComponent(rawFragment);
  } catch {
    return undefined;
  }

  const contents = readSafeRepositoryFile(
    repoRoot,
    reference.repositoryPath,
    purpose,
  );
  const lines = documentLines(contents);
  const lineMatch = fragment.match(/^L([1-9]\d*)(?:-L([1-9]\d*))?$/);
  if (lineMatch) {
    const startLine = Number.parseInt(lineMatch[1], 10);
    const endLine = Number.parseInt(lineMatch[2] ?? lineMatch[1], 10);
    if (endLine < startLine || endLine > lines.length) return undefined;
    return { endLine, kind: "line", lines, startLine };
  }
  if (/^L\d/.test(fragment)) return undefined;

  const heading = markdownHeadingLocations(lines).find(
    (candidate) => candidate.slug === fragment,
  );
  if (heading) {
    return {
      endLine: heading.endLine,
      kind: "markdown-heading",
      lines,
      startLine: heading.startLine,
    };
  }

  const htmlLocation = htmlIdLocation(
    contents,
    reference.repositoryPath,
    fragment,
    lines,
  );
  if (!htmlLocation) return undefined;
  return { ...htmlLocation, lines };
}

function repositoryReferenceHasValidLocator(repoRoot, reference) {
  return Boolean(
    resolveRepositoryReferenceLocator(repoRoot, reference, "Repository locator"),
  );
}

function repositoryReferenceLocatorScope(repoRoot, reference, purpose) {
  const location = resolveRepositoryReferenceLocator(
    repoRoot,
    reference,
    purpose,
  );
  if (!location) return undefined;
  return location.lines
    .slice(location.startLine - 1, location.endLine)
    .join("\n");
}

function hasExactRemediationReference(repoRoot, ledgerRow, allowedPaths) {
  return ledgerRow.evidenceReferences.some((reference) => {
    if (
      reference.kind !== "repository" ||
      !allowedPaths.has(reference.repositoryPath)
    ) {
      return false;
    }
    try {
      return repositoryReferenceHasValidLocator(repoRoot, reference);
    } catch {
      return false;
    }
  });
}

function hasReferencedFirstSeenEvent(repoRoot, ledgerRow, sourcePath) {
  for (const reference of ledgerRow.evidenceReferences) {
    if (
      reference.kind !== "repository" ||
      reference.repositoryPath !==
        "docs/homa-planning/reconciliation/implementation-notes.md" ||
      !reference.reference.includes("#")
    ) {
      continue;
    }
    const contents = readSafeRepositoryFile(
      repoRoot,
      reference.repositoryPath,
      "First-seen audit event",
    );
    if (
      repositoryReferenceHasValidLocator(repoRoot, reference) &&
      contents.includes(sourcePath)
    ) {
      return true;
    }
  }
  return false;
}

function validateManifestClaimCoverage(repoRoot, manifestRows, ledgerRows, errors) {
  const ledgerById = new Map(ledgerRows.map((row) => [row.claim_id, row]));
  const manifestByPath = new Map(manifestRows.map((row) => [row.path, row]));
  const backReferencesByPath = new Map();

  for (const manifestRow of manifestRows) {
    const scope = manifestRow.claim_scope;
    const noIndependentClaim = scope.startsWith("none:");
    const ledgerScope = scope.startsWith("ledger:");
    const isExcludedClass = new Set(["alias", "generated", "vendored"]).has(
      manifestRow.authority_class,
    );

    if (isExcludedClass && !noIndependentClaim) {
      errors.push(
        `${manifestRow.path} must use none:<specific reason> claim_scope`,
      );
    }

    if (noIndependentClaim) {
      const reason = scope.slice("none:".length).trim();
      if (!isExcludedClass) {
        errors.push(
          `${manifestRow.path} may use none: only for alias, generated, or vendored content`,
        );
      }
      if (
        reason.length < 12 ||
        CLAIM_PLACEHOLDER_PATTERN.test(reason) ||
        /no independent claim scope/i.test(reason)
      ) {
        errors.push(`${manifestRow.path} has a nonspecific none: reason`);
      }
      continue;
    }

    if (ledgerScope) {
      const value = scope.slice("ledger:".length);
      const claimIds = value.split(",");
      if (
        value.length === 0 ||
        claimIds.some((claimId) => !/^CLM-\d{4,}$/.test(claimId))
      ) {
        errors.push(`${manifestRow.path} has invalid ledger: claim IDs`);
        continue;
      }
      const sortedClaimIds = [...new Set(claimIds)].sort(comparePaths);
      if (
        sortedClaimIds.length !== claimIds.length ||
        sortedClaimIds.some((claimId, index) => claimId !== claimIds[index])
      ) {
        errors.push(
          `${manifestRow.path} ledger: claim IDs must be unique and stably sorted`,
        );
      }
      backReferencesByPath.set(manifestRow.path, new Set(claimIds));
      for (const claimId of claimIds) {
        const ledgerRow = ledgerById.get(claimId);
        if (!ledgerRow) {
          errors.push(`${manifestRow.path} references missing claim ${claimId}`);
        } else if (!ledgerRow.sourcePathSet.has(manifestRow.path)) {
          errors.push(
            `${manifestRow.path} references ${claimId}, but that claim does not source the manifest path`,
          );
        }
      }
      continue;
    }

    const isActive =
      OPEN_LIFECYCLES.has(manifestRow.lifecycle) ||
      OPEN_DISPOSITIONS.has(manifestRow.disposition);
    if (!isActive) {
      errors.push(
        `${manifestRow.path} is terminal human-authored documentation and must use ledger: claim_scope`,
      );
    }
  }

  for (const ledgerRow of ledgerRows) {
    for (const sourcePath of ledgerRow.sourcePaths) {
      const manifestRow = manifestByPath.get(sourcePath);
      if (!manifestRow) continue;
      if (!backReferencesByPath.get(sourcePath)?.has(ledgerRow.claim_id)) {
        errors.push(
          `${sourcePath} must back-reference ${ledgerRow.claim_id} in claim_scope`,
        );
      }
    }

    if (!TERMINAL_CLAIM_STATUSES.has(ledgerRow.resolution_status)) continue;
    const allowedDispositions = TERMINAL_CLAIM_MANIFEST_DISPOSITIONS.get(
      ledgerRow.resolution_status,
    );
    for (const sourcePath of ledgerRow.sourcePaths) {
      const manifestRow = manifestByPath.get(sourcePath);
      if (
        manifestRow &&
        !allowedDispositions?.has(manifestRow.disposition)
      ) {
        errors.push(
          `${ledgerRow.claim_id} ${ledgerRow.resolution_status} is incompatible with ${sourcePath} disposition ${manifestRow.disposition}`,
        );
      }
    }

    if (ledgerRow.resolution_status === "corrected-current") {
      if (
        normalizeLocatableText(ledgerRow.claim_before) ===
        normalizeLocatableText(ledgerRow.resolved_claim)
      ) {
        errors.push(
          `${ledgerRow.claim_id} corrected-current must differ from claim_before`,
        );
      }
      const remediationPaths = new Set(ledgerRow.sourcePaths);
      if (ledgerRow.canonicalRepositoryPath) {
        remediationPaths.add(ledgerRow.canonicalRepositoryPath);
      }
      if (
        !hasExactRemediationReference(repoRoot, ledgerRow, remediationPaths)
      ) {
        errors.push(
          `${ledgerRow.claim_id} corrected-current requires a valid source or canonical remediation locator`,
        );
      }
      if (ledgerRow.canonicalRepositoryPath) {
        try {
          const contents = readSafeRepositoryFile(
            repoRoot,
            ledgerRow.canonicalRepositoryPath,
            `${ledgerRow.claim_id} corrected canonical source`,
          );
          if (
            !normalizeLocatableText(contents).includes(
              normalizeLocatableText(ledgerRow.resolved_claim),
            )
          ) {
            errors.push(
              `${ledgerRow.claim_id} corrected claim is not locatable in ${ledgerRow.canonicalRepositoryPath}`,
            );
          }
        } catch (error) {
          errors.push(error.message);
        }
      }
    }

    if (ledgerRow.resolution_status === "consolidated") {
      const remediationPaths = new Set(ledgerRow.sourcePaths);
      if (ledgerRow.canonicalRepositoryPath) {
        remediationPaths.add(ledgerRow.canonicalRepositoryPath);
      }
      if (
        !ledgerRow.canonicalRepositoryPath ||
        !hasExactRemediationReference(repoRoot, ledgerRow, remediationPaths)
      ) {
        errors.push(
          `${ledgerRow.claim_id} consolidated requires a valid source or canonical remediation locator and a repository canonical_ref`,
        );
      }
      if (ledgerRow.canonicalRepositoryPath) {
        try {
          const contents = readSafeRepositoryFile(
            repoRoot,
            ledgerRow.canonicalRepositoryPath,
            `${ledgerRow.claim_id} consolidated canonical source`,
          );
          if (
            !normalizeLocatableText(contents).includes(
              normalizeLocatableText(ledgerRow.resolved_claim),
            )
          ) {
            errors.push(
              `${ledgerRow.claim_id} consolidated claim is not locatable in ${ledgerRow.canonicalRepositoryPath}`,
            );
          }
        } catch (error) {
          errors.push(error.message);
        }
      }
    }

    if (ledgerRow.resolution_status === "removed") {
      if (ledgerRow.evidenceReferences.length === 0) {
        errors.push(`${ledgerRow.claim_id} removed requires remediation evidence`);
      }
      for (const sourcePath of ledgerRow.sourcePaths) {
        let inspection;
        try {
          inspection = inspectDocumentationCandidatePath(repoRoot, sourcePath);
        } catch (error) {
          errors.push(error.message);
          continue;
        }
        if (inspection.present) {
          const hasSourceEvidence = hasExactRemediationReference(
            repoRoot,
            ledgerRow,
            new Set([sourcePath]),
          );
          if (!hasSourceEvidence) {
            errors.push(
              `${ledgerRow.claim_id} removed claim in present source ${sourcePath} requires a source remediation locator`,
            );
          }
          try {
            const contents = readSafeRepositoryFile(
              repoRoot,
              sourcePath,
              `${ledgerRow.claim_id} removed source`,
            );
            const priorClaim = normalizeLocatableText(ledgerRow.claim_before);
            if (
              priorClaim.length > 0 &&
              normalizeLocatableText(contents).includes(priorClaim)
            ) {
              errors.push(
                `${ledgerRow.claim_id} removed claim text still survives in ${sourcePath}`,
              );
            }
          } catch (error) {
            errors.push(error.message);
          }
        } else {
          let hasHistory = false;
          try {
            hasHistory = repositoryPathHasGitHistory(repoRoot, sourcePath);
          } catch (error) {
            errors.push(error.message);
          }
          if (
            !hasHistory &&
            !hasReferencedFirstSeenEvent(repoRoot, ledgerRow, sourcePath)
          ) {
            errors.push(
              `${ledgerRow.claim_id} removed source ${sourcePath} requires Git history or a referenced first-seen audit event`,
            );
          }
        }
      }
    }
  }

  for (const manifestRow of manifestRows) {
    const expectedClaimStatus = new Map([
      ["deleted", "removed"],
      ["relocated", "removed"],
      ["archived", "historical-annotated"],
    ]).get(manifestRow.disposition);
    if (!expectedClaimStatus) {
      continue;
    }
    const claimIds = backReferencesByPath.get(manifestRow.path) ?? new Set();
    if (claimIds.size === 0) {
      errors.push(
        `${manifestRow.path} ${manifestRow.disposition} requires ${expectedClaimStatus} ledger claims`,
      );
      continue;
    }
    for (const claimId of claimIds) {
      if (
        ledgerById.get(claimId)?.resolution_status !== expectedClaimStatus
      ) {
        errors.push(
          `${manifestRow.path} ${manifestRow.disposition} maps to incompatible claim ${claimId}`,
        );
      }
    }

    let inspection;
    try {
      inspection = inspectDocumentationCandidatePath(repoRoot, manifestRow.path);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (inspection.present) continue;
    let hasHistory = false;
    try {
      hasHistory = repositoryPathHasGitHistory(repoRoot, manifestRow.path);
    } catch (error) {
      errors.push(error.message);
    }
    const hasFirstSeenEvent = [...claimIds].some((claimId) => {
      const ledgerRow = ledgerById.get(claimId);
      return (
        ledgerRow &&
        hasReferencedFirstSeenEvent(repoRoot, ledgerRow, manifestRow.path)
      );
    });
    if (!hasHistory && !hasFirstSeenEvent) {
      errors.push(
        `${manifestRow.path} absent ${manifestRow.disposition} history requires Git history or a referenced first-seen audit event`,
      );
    }
  }
}

function inspectClaimLedger(repoRoot, manifestRows, errors) {
  const absolutePath = auditControlFile(repoRoot, CLAIM_LEDGER_PATH, errors);
  if (!absolutePath) {
    return { state: "absent", rowCount: 0, openCount: 0, groupCount: 0 };
  }

  const raw = readFileSync(absolutePath, "utf8");
  if (raw.includes("\r")) {
    errors.push("Claim ledger must use LF line endings");
  }
  if (!raw.endsWith("\n")) {
    errors.push("Claim ledger must end with a single LF newline");
  }
  const lines = raw.endsWith("\n")
    ? raw.slice(0, -1).split("\n")
    : raw.split("\n");
  const header = lines.shift()?.split("\t") ?? [];
  if (
    header.length !== CLAIM_LEDGER_COLUMNS.length ||
    header.some((column, index) => column !== CLAIM_LEDGER_COLUMNS[index])
  ) {
    errors.push(
      `Claim ledger header must be exactly: ${CLAIM_LEDGER_COLUMNS.join("\\t")}`,
    );
  }

  const manifestPaths = new Set(manifestRows.map((row) => row.path));
  const ids = new Set();
  const ledgerRows = [];
  const groups = new Map();
  const terminalCanonicalRefs = new Map();
  let openCount = 0;

  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 2;
    if (line.length === 0) {
      errors.push(`Claim ledger line ${lineNumber} is blank`);
      return;
    }
    const values = line.split("\t");
    if (values.length !== CLAIM_LEDGER_COLUMNS.length) {
      errors.push(
        `Claim ledger line ${lineNumber} has ${values.length} fields; expected ${CLAIM_LEDGER_COLUMNS.length}`,
      );
      return;
    }
    const row = Object.fromEntries(
      CLAIM_LEDGER_COLUMNS.map((column, index) => [column, values[index]]),
    );

    for (const column of CLAIM_LEDGER_COLUMNS) {
      if (row[column].length === 0) {
        errors.push(
          `Claim ledger line ${lineNumber} has an empty ${column}; use - when inapplicable`,
        );
      } else if (row[column] !== row[column].trim()) {
        errors.push(
          `Claim ledger line ${lineNumber} has surrounding whitespace in ${column}`,
        );
      }
      if (row[column].includes("\u2014")) {
        errors.push(
          `Claim ledger line ${lineNumber} ${column} contains a prohibited em dash`,
        );
      }
    }

    if (!/^CLM-\d{4,}$/.test(row.claim_id)) {
      errors.push(
        `Claim ledger line ${lineNumber} has invalid claim_id: ${row.claim_id}`,
      );
    } else if (ids.has(row.claim_id)) {
      errors.push(`Claim ledger contains duplicate claim_id: ${row.claim_id}`);
    }
    ids.add(row.claim_id);

    if (row.group_id !== "-" && !/^GRP-\d{3,}$/.test(row.group_id)) {
      errors.push(
        `Claim ledger line ${lineNumber} has invalid group_id: ${row.group_id}`,
      );
    }
    if (!CLAIM_KINDS.has(row.claim_kind)) {
      errors.push(
        `Claim ledger line ${lineNumber} has invalid claim_kind: ${row.claim_kind}`,
      );
    }
    if (!CLAIM_STATUSES.has(row.resolution_status)) {
      errors.push(
        `Claim ledger line ${lineNumber} has invalid resolution_status: ${row.resolution_status}`,
      );
    } else if (OPEN_CLAIM_STATUSES.has(row.resolution_status)) {
      openCount += 1;
    }

    validateClaimText(row.claim_before, "claim_before", lineNumber, errors);
    validateClaimText(row.resolved_claim, "resolved_claim", lineNumber, errors);

    const sourcePaths = parseDelimitedLedgerField(
      row.source_paths,
      ";",
      "source_paths",
      lineNumber,
      errors,
      { allowDash: false },
    );
    const sourcePathSet = new Set(sourcePaths);
    for (const sourcePath of sourcePaths) {
      try {
        assertSafeCandidate(sourcePath);
      } catch (error) {
        errors.push(
          `Claim ledger line ${lineNumber} has unsafe source path: ${error.message}`,
        );
        continue;
      }
      if (!manifestPaths.has(sourcePath)) {
        errors.push(
          `Claim ledger line ${lineNumber} source path is absent from the manifest: ${sourcePath}`,
        );
      }
    }

    const authorityReferences = validateLedgerReferenceList(
      repoRoot,
      row.authority_refs,
      "authority_refs",
      lineNumber,
      errors,
      "authority",
    );
    const evidenceReferences = validateLedgerReferenceList(
      repoRoot,
      row.evidence_refs,
      "evidence_refs",
      lineNumber,
      errors,
      "evidence",
    );
    const ticketReferences = validateLedgerReferenceList(
      repoRoot,
      row.ticket_refs,
      "ticket_refs",
      lineNumber,
      errors,
      "ticket",
    );
    const truthPrefix = truthBasisPrefix(row.truth_basis, lineNumber, errors);
    const allowedTruthPrefixes = CLAIM_KIND_TRUTH_BASIS.get(row.claim_kind);
    // Exception mirroring validateTerminalClaim: a claim resolved as
    // "removed" on a policy basis was withdrawn with its source document
    // (HUMAN-TODO.md deletion, 2026-07-25 tracker migration to GitHub
    // Issues); the kind's verification prefixes do not apply to it.
    const isPolicyRemoval =
      row.resolution_status === "removed" && truthPrefix === "policy";
    if (
      allowedTruthPrefixes &&
      !allowedTruthPrefixes.has(truthPrefix) &&
      !isPolicyRemoval
    ) {
      errors.push(
        `Claim ledger line ${lineNumber} claim_kind ${row.claim_kind} is incompatible with ${truthPrefix}: truth_basis`,
      );
    }

    if (
      !RFC3339_PATTERN.test(row.observed_at) ||
      Number.isNaN(Date.parse(row.observed_at))
    ) {
      errors.push(
        `Claim ledger line ${lineNumber} observed_at must be RFC3339: ${row.observed_at}`,
      );
    }

    const isOpen = OPEN_CLAIM_STATUSES.has(row.resolution_status);
    const isRemoved = row.resolution_status === "removed";
    let canonicalRepositoryPath;
    if (isOpen || isRemoved) {
      if (row.canonical_ref !== "-") {
        errors.push(
          `Claim ledger line ${lineNumber} open or removed claim must use canonical_ref -`,
        );
      }
    } else if (TERMINAL_CLAIM_STATUSES.has(row.resolution_status)) {
      if (row.canonical_ref === "-") {
        errors.push(
          `Claim ledger line ${lineNumber} terminal surviving claim requires canonical_ref`,
        );
      } else {
        const canonicalReference = validateCanonicalReference(
          repoRoot,
          row.canonical_ref,
          lineNumber,
          errors,
          manifestPaths,
        );
        const canonicalPath = canonicalReference.repositoryPath;
        canonicalRepositoryPath = canonicalPath;
        const existingCanonicalRef = terminalCanonicalRefs.get(
          row.canonical_topic,
        );
        if (
          existingCanonicalRef &&
          existingCanonicalRef !== row.canonical_ref
        ) {
          errors.push(
            `Terminal claims for ${row.canonical_topic} disagree on canonical_ref: ${existingCanonicalRef} vs ${row.canonical_ref}`,
          );
        } else {
          terminalCanonicalRefs.set(row.canonical_topic, row.canonical_ref);
        }
      }
    }

    if (TERMINAL_CLAIM_STATUSES.has(row.resolution_status)) {
      validateTerminalClaim(
        row,
        {
          lineNumber,
          authorityReferences,
          evidenceReferences,
          ticketReferences,
          truthPrefix,
        },
        errors,
      );
    }

    const enrichedRow = {
      ...row,
      lineNumber,
      sourcePaths,
      sourcePathSet,
      authorityReferences,
      evidenceReferences,
      ticketReferences,
      truthPrefix,
      canonicalRepositoryPath,
    };
    ledgerRows.push(enrichedRow);
    if (row.group_id !== "-") {
      const group = groups.get(row.group_id) ?? {
        rows: [],
        canonicalTopics: new Set(),
      };
      group.rows.push(enrichedRow);
      group.canonicalTopics.add(row.canonical_topic);
      groups.set(row.group_id, group);
    }
  });

  for (let index = 1; index < ledgerRows.length; index += 1) {
    if (
      comparePaths(
        ledgerRows[index - 1].claim_id,
        ledgerRows[index].claim_id,
      ) >= 0
    ) {
      errors.push(
        `Claim ledger IDs are not in stable ascending order at ${ledgerRows[index].claim_id}`,
      );
      break;
    }
  }

  for (const [groupId, group] of groups) {
    if (group.rows.length < 2) {
      errors.push(`${groupId} must contain at least two claim rows`);
    }
    if (group.canonicalTopics.size !== 1) {
      errors.push(`${groupId} must contain exactly one canonical_topic`);
    }
  }

  validateManifestClaimCoverage(repoRoot, manifestRows, ledgerRows, errors);

  return {
    state: "present",
    rowCount: ledgerRows.length,
    openCount,
    groupCount: groups.size,
  };
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
  verifyReferenceRegistries(repoRoot);
  verifyReferenceTypeRules(repoRoot);
  verifyFilesystemResolutionRules(repoRoot);
  const baselineErrors = [];
  const inventoryErrors = [];
  const manifestErrors = [];
  const coverageErrors = [];
  const lifecycleErrors = [];
  const specialRowErrors = [];
  const migrationDriftErrors = [];
  const claimLedgerErrors = [];
  const { rows: baselineRows, byPath: baselineByPath } =
    parseAuditControlBaseline(repoRoot, baselineErrors);
  const candidates = collectCandidates(repoRoot, {
    errors: inventoryErrors,
    baselineByPath,
  });
  const { rows, duplicateCount } = parseManifest(repoRoot, manifestErrors);
  validateAuditControlBaseline(
    candidates,
    rows,
    baselineRows,
    baselineByPath,
    baselineErrors,
  );
  const { preservedTerminalRows, preservedTerminalPaths } = validateCoverage(
    repoRoot,
    candidates,
    rows,
    coverageErrors,
  );
  validateLifecycleDisposition(candidates, rows, lifecycleErrors);
  validateSpecialRows(
    repoRoot,
    rows,
    preservedTerminalPaths,
    specialRowErrors,
  );
  validateMigrationEvidenceDrift(repoRoot, migrationDriftErrors);
  const docReferenceErrors = [];
  validateDocReferences(
    {
      docs: DOC_REFERENCE_FILES.map((docPath) => ({
        path: docPath,
        text: readFileSync(join(repoRoot, docPath), "utf8"),
      })),
      rootScripts: new Set(
        Object.keys(
          JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"))
            .scripts ?? {},
        ),
      ),
      webScripts: new Set(
        Object.keys(
          JSON.parse(
            readFileSync(join(repoRoot, "apps/web/package.json"), "utf8"),
          ).scripts ?? {},
        ),
      ),
      pathExists: (relative) => existsSync(join(repoRoot, relative)),
    },
    docReferenceErrors,
  );
  const claimLedger = inspectClaimLedger(repoRoot, rows, claimLedgerErrors);
  const structuralErrorGroups = [
    ["Immutable first-seen baseline", baselineErrors],
    ["Candidate file safety", inventoryErrors],
    ["Manifest structure and safety", manifestErrors],
    ["Coverage", coverageErrors],
    ["Lifecycle and disposition", lifecycleErrors],
    ["Special rows and aliases", specialRowErrors],
    ["Migration evidence drift", migrationDriftErrors],
    ["Doc command and path references", docReferenceErrors],
    ["Claim ledger structure and safety", claimLedgerErrors],
  ];
  const structuralErrors = structuralErrorGroups.flatMap(([, errors]) => errors);
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
    `Immutable first-seen baseline: ${baselineErrors.length === 0 ? "valid" : "invalid"}`,
  );
  console.log(
    `Candidate file safety: ${inventoryErrors.length === 0 ? "valid" : "invalid"}`,
  );
  console.log(
    `Manifest structure and enums: ${manifestErrors.length === 0 ? "valid" : "invalid"}`,
  );
  console.log(
    `Coverage: ${coverageErrors.length === 0 ? "exact" : "invalid"}`,
  );
  console.log(
    `Lifecycle and disposition: ${lifecycleErrors.length === 0 ? "valid" : "invalid"}`,
  );
  console.log(
    `Special rows and aliases: ${specialRowErrors.length === 0 ? "valid" : "invalid"}`,
  );
  console.log(
    `Migration evidence drift: ${migrationDriftErrors.length === 0 ? "valid" : "invalid"}`,
  );
  console.log(`Preserved terminal manifest rows: ${preservedTerminalRows}`);
  console.log(
    `Internal guard probes: passed for canonical paths, ${PROHIBITED_PREFIXES.length} case-folded prohibited roots, typed references, exact Markdown, HTML, and line locators, scoped registries, terminal evidence classes, lifecycle pairs, claim-status transitions, and named symlinks`,
  );
  console.log(`Open manifest rows: ${openManifestRows.length}`);
  console.log(
    claimLedgerErrors.length > 0
      ? "Claim ledger structure and safety: invalid"
      : claimLedger.state === "absent"
        ? "Claim ledger: absent (open audit item)"
      : `Claim ledger: ${claimLedger.rowCount} rows in ${claimLedger.groupCount} groups, ${claimLedger.openCount} open`,
  );

  if (structuralErrors.length > 0) {
    for (const [label, errors] of structuralErrorGroups) {
      if (errors.length === 0) continue;
      console.error(`\n${label} errors:`);
      for (const error of errors) console.error(`- ${error}`);
    }
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
