export interface HistoricalBrandQuarantineRecord {
  path: string;
  reason: string;
  ownerIssue: "gh#729";
}

/**
 * Frozen, non-runtime artifacts that preserve decision provenance but must
 * never act as current Homa design guidance. This is deliberately an exact
 * registry. A directory or suffix matcher would let an active authority hide
 * old identity under a broad "historical" label.
 */
export const historicalBrandQuarantineRecords = [
  {
    path: "docs/handoffs/native-voice-capability-parity-merge-readiness.html",
    reason: "Frozen native voice merge-readiness handoff retained as implementation provenance.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/homa-planning/03-backlog.md",
    reason: "Historical backlog registry retained for ticket provenance under the repository tracker ruling.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/homa-planning/lead-magnet/flow.html",
    reason: "Frozen lead-magnet prototype retained as historical product evidence.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/homa-planning/lead-magnet/index.html",
    reason: "Frozen lead-magnet prototype retained as historical product evidence.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/homa-planning/lead-magnet/journey.html",
    reason: "Frozen lead-magnet prototype retained as historical product evidence.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/homa-planning/lead-magnet/report-mock.html",
    reason: "Frozen lead-magnet prototype retained as historical product evidence.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/homa-planning/lead-magnet/states.html",
    reason: "Frozen lead-magnet prototype retained as historical product evidence.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/homa-planning/plans/2026-08-02-homa-brand-system-approval.html",
    reason: "Founder-approved pre-implementation snapshot retained as the decision record for Quiet authority.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/ideation/2026-07-07-report-100x-value-ideation.html",
    reason: "Frozen ideation artifact retained as product-history provenance.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/superpowers/plans/2026-07-12-socials-starter-pack.md",
    reason: "Superseded planning artifact retained as implementation provenance.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/superpowers/plans/2026-07-15-conversation-reliability-foundation-and-honest-thread.md",
    reason: "Superseded planning artifact retained as implementation provenance.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/superpowers/plans/2026-07-15-dynamic-webchat-prompt-suggestions.md",
    reason: "Superseded planning artifact retained as implementation provenance.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/superpowers/specs/2026-07-12-socials-starter-pack-design.md",
    reason: "Superseded design specification retained as implementation provenance.",
    ownerIssue: "gh#729",
  },
  {
    path: "docs/superpowers/specs/2026-07-15-category-leader-landing-design.md",
    reason: "Superseded design specification retained as implementation provenance.",
    ownerIssue: "gh#729",
  },
] as const satisfies readonly HistoricalBrandQuarantineRecord[];

export const historicalBrandQuarantinePaths = new Set<string>(
  historicalBrandQuarantineRecords.map((record) => record.path),
);

export const historicalQuarantineDocumentationManifestPath =
  "docs/homa-planning/reconciliation/documentation-manifest.tsv";

const NON_AUTHORING_INDEX_PREFIXES = [
  "docs/homa-design/evidence/",
] as const;

const NON_AUTHORING_INDEX_PATHS = new Set([
  "docs/homa-design/_ds_manifest.json",
  "docs/homa-planning/reconciliation/audit-control-baseline.tsv",
  "docs/homa-planning/reconciliation/claim-ledger.tsv",
]);

/**
 * Active authoring discovery is semantic rather than a hand-selected list.
 * Any new README, skill, catalog, index, manifest, or registry enters the
 * quarantine guard automatically on its first tracked commit.
 */
export function isActiveAuthoringIndexOrRegistryPath(path: string): boolean {
  if (historicalBrandQuarantinePaths.has(path)) return false;
  if (NON_AUTHORING_INDEX_PATHS.has(path)) return false;
  if (NON_AUTHORING_INDEX_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  const basename = path.split("/").at(-1) ?? "";
  if (/^(?:AGENTS|CLAUDE|README|SKILL)\.md$/iu.test(basename)) return true;
  if (/^(?:BUILD|DESIGN)\.md$/u.test(path)) return true;
  return /(?:index|manifest|registry|catalog)\.(?:md|mdx|txt|tsv|json|ya?ml|[cm]?[jt]sx?)$/iu.test(basename);
}

export function collectHistoricalQuarantineIndexViolations(
  sources: ReadonlyMap<string, string>,
  quarantinePaths: ReadonlySet<string> = historicalBrandQuarantinePaths,
): string[] {
  const violations: string[] = [];
  const manifest = sources.get(historicalQuarantineDocumentationManifestPath);
  if (manifest === undefined) {
    violations.push(`Missing active documentation registry: ${historicalQuarantineDocumentationManifestPath}`);
  } else {
    const lines = manifest.split(/\r?\n/u).filter(Boolean);
    const headers = lines[0]?.split("\t") ?? [];
    const column = (name: string) => headers.indexOf(name);
    for (const required of ["path", "authority_class", "lifecycle", "disposition", "evidence", "notes"]) {
      if (column(required) === -1) violations.push(`Documentation registry is missing column: ${required}`);
    }
    if (violations.length === 0) {
      const rows = lines.slice(1).map((line) => line.split("\t"));
      for (const quarantinePath of quarantinePaths) {
        const matches = rows.filter((row) => row[column("path")] === quarantinePath);
        if (matches.length !== 1) {
          violations.push(`${historicalQuarantineDocumentationManifestPath} must contain one exact historical row for ${quarantinePath}`);
          continue;
        }
        const row = matches[0]!;
        const historical = row[column("authority_class")] === "historical-record"
          && row[column("lifecycle")] === "historical"
          && ["unresolved", "historical-annotated"].includes(row[column("disposition")] ?? "")
          && row[column("evidence")]?.includes("gh#729")
          && row[column("notes")]?.includes("not live guidance");
        if (!historical) {
          violations.push(`${historicalQuarantineDocumentationManifestPath} exposes ${quarantinePath} as active guidance`);
        }
      }
    }
  }

  for (const [sourcePath, source] of sources) {
    if (sourcePath === historicalQuarantineDocumentationManifestPath) continue;
    if (!isActiveAuthoringIndexOrRegistryPath(sourcePath)) continue;
    for (const quarantinePath of quarantinePaths) {
      if (source.includes(quarantinePath)) {
        violations.push(`Active authoring index references historical quarantine: ${sourcePath} -> ${quarantinePath}`);
      }
    }
  }
  return violations.sort();
}
