# Documentation reconciliation

This directory is the canonical audit record for whether Homa's tracked documentation matches the current repository, authoritative product decisions, and verified production behavior.

Status: active audit. No completion claim is valid until the manifest is exhaustive, the claim ledger has zero unresolved rows, every required check passes, and every production-dependent claim has fresh evidence.

## Authority

Use two axes of truth:

1. Product policy: later founder rulings, then the PRD, then journey specifications, then agent judgment.
2. Observed behavior: current code, tests, configuration, and migrations establish repository behavior. Direct deployment, HTTP, and database evidence establish production behavior.

A policy decision does not prove that code shipped. Current code does not silently overturn product policy.

## Artifacts

- `documentation-manifest.tsv`: exhaustive file scope and final disposition.
- `audit-control-baseline.tsv`: immutable first-seen state, content hash, and Git blob identity for every file observed before the baseline was locked.
- `claim-ledger.tsv`: typed material claims, evidence, conflicts, and resolutions.
- `implementation-notes.md`: discoveries and deviations while the audit runs.
- `evidence/repository-baseline.md`: sanitized working-tree, command, and toolchain observations.
- `evidence/production-baseline.md`: sanitized deployment, HTTP, public-hash, and migration-name observations.

The ledger uses this exact 15-column TSV schema:

```text
claim_id, group_id, source_paths, claim_kind, canonical_topic, claim_before, resolved_claim, authority_refs, evidence_refs, truth_basis, observed_at, ticket_refs, canonical_ref, resolution_status, notes
```

The file itself uses tabs, not commas. Open statuses are `in-progress`, `unknown`, `conflict`, `evidence-missing`, and `ticket-missing`. Terminal statuses are `verified-current`, `corrected-current`, `historical-annotated`, `upcoming-ticketed`, `removed`, and `consolidated`.

Terminal statuses have strict transition rules. `verified-current` keeps the exact claim with `SAME`. `corrected-current` records the corrected current statement. `historical-annotated` is reserved for historical claims, and `upcoming-ticketed` is reserved for upcoming claims with a named ticket. `removed` uses `REMOVED`. `consolidated` names the surviving canonical reference.

Reference columns are typed. `authority_refs` accepts repository locators, HTTPS URLs, and registered ruling or decision tokens. `evidence_refs` accepts repository locators and HTTPS URLs only. `ticket_refs` accepts registered ticket tokens only. The checker resolves each token to a scoped authoritative section and requires its marker inside that section, so an identical marker elsewhere in the file cannot validate the token. Claim kinds also constrain the allowed `truth_basis` family.

Every repository fragment is resolved, not merely parsed. Markdown headings use exact GitHub-style, case-sensitive slugs with duplicate suffixes. HTML `id` values and legacy anchor `name` values are exact and case-sensitive. Source-line locators use `#L<start>` or `#L<start>-L<end>`, with positive in-range line numbers. These rules apply to fragment-bearing authority, evidence, canonical, ruling-registry, and ticket-registry locators. HTTPS targets are syntax-checked locally, but their remote fragments require external verification.

Terminal production and command evidence is classed by the complete `truth_basis`, not only its prefix. Each registered production detail maps to one exact locator in `evidence/production-baseline.md`, and each registered command detail maps to one exact command-observation locator in `evidence/repository-baseline.md`. A generic audit path, a swapped baseline, or an invented nonempty detail fails. A new terminal production or command evidence class requires an explicit checker registry entry.

## Candidate scope

The checker enumerates Git's complete cached index plus untracked, non-ignored files from the repository root. Explicit Git pathspec exclusions prevent enumeration under `homa-macmini/`, `homa-research/`, and `homa-template/`, and the checker independently rejects prohibited candidate and manifest paths. This repository-wide enumeration prevents a new top-level documentation location from being silently omitted.

Candidate status follows a primary-purpose boundary. Markdown, MDX, intentional text and HTML summaries, CFF, the four marketing metadata manifests, Marble license files, audit TSV files, and named generated design artifacts are in scope. Four documentation-bearing executable or configuration references are also explicit candidates: `.github/workflows/ci.yml`, `apps/web/.env.example`, `apps/mobile/.env.example`, and `scripts/telnyx-provision.mts`. Ordinary code comments, migrations, generic configuration, `.gitignore`, and `.vercelignore` remain evidence for other claims, not independent documentation candidates.

Generated documentation and design outputs remain visible as `generated-excluded`. The materials calibration report is a mixed historical artifact: its generated sections are evidence-only, but its human Findings remain unresolved claim scope until they are split. Upstream Marble documents and licenses remain `vendored-frozen`; Homa's `README-HOMA.md` is Homa-authored and remains in claim scope. Root and mobile `CLAUDE.md` symlinks and the web app's literal `@AGENTS.md` wrapper remain aliases with no independent claim scope. Alias and audit-control validation rejects any resolution outside the repository or into a prohibited root.

Every current candidate requires a manifest row. Cached tracked paths remain candidates even when their working-tree files are absent. The immutable first-seen baseline prevents a later Git state from changing a path from tracked to untracked, or the reverse. A row for a source path removed later may remain as frozen audit history only with a matching `deleted` and `removed`, `relocated` and `removed`, or `archived` and `archived` terminal state plus Git history or a referenced first-seen audit event. Other non-candidate rows fail coverage. Every other human-authored file starts `in-progress` and `unresolved` until its domain pass records evidence and a final disposition.

Claim coverage is bidirectional. A ledger row lists exact manifest source paths. Each sourced manifest row lists the same IDs as a sorted `ledger:` claim scope. Alias, generated, and vendored rows use `none:` with a specific exclusion reason. Descriptive claim scopes may remain only on active audit rows that have not yet been seeded; terminal human-authored rows must use `ledger:`.

Special classifications are registry-derived, not self-declared. Only named alias paths may use alias status. Only explicit generated artifacts may use generated status. The vendored Marble inventory is an exact upstream file list, while `README-HOMA.md` remains Homa-authored claim scope. Format and repository area are derived from each path. Terminal claim states are checked against manifest dispositions. Corrected, consolidated, and removed claims require remediation evidence, and removed claims cannot pass while matching stale text remains in a present source.

The current seed records 147 claims in 65 high-risk groups. It is a starting control set, not an exhaustive claim inventory. Open rows deliberately remain until their domain passes update the source documentation or obtain the missing decision or production evidence.

## Checks

- `pnpm check:docs -- --allow-open` validates exact candidate coverage, schema, required fields, enums, aliases, generated and vendored classifications, duplicates, stable ordering, and prohibited prefixes while the audit is active.
- `pnpm check:docs` applies the same structural checks and also requires zero `audit-active`, `in-progress`, or `unresolved` manifest rows and zero open claim-ledger rows.

The checker validates reference syntax, exact fragments, and safe repository existence component by component, without following unknown symlinks. It also enforces the exact baseline locator registered for each terminal production and command evidence class. The recorded latest local migration count is compared with the current migration directory on every run, so a time-bounded production snapshot cannot silently survive local migration drift. Broader production-evidence freshness windows remain Task 6 hardening.

Until every manifest row and ledger entry is resolved and the strict check passes, this directory describes work in progress.
