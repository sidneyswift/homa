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
- `claim-ledger.tsv`: material claims, evidence, conflicts, and resolutions.
- `implementation-notes.md`: discoveries and deviations while the audit runs.
- `evidence/`: sanitized repository and production observations.

## Candidate scope

The checker enumerates Git's complete cached index plus untracked, non-ignored files from the repository root. Explicit Git pathspec exclusions prevent enumeration under `homa-macmini/`, `homa-research/`, and `homa-template/`, and the checker independently rejects prohibited candidate and manifest paths. This repository-wide enumeration prevents a new top-level documentation location from being silently omitted.

Candidate status follows a primary-purpose boundary. Markdown, MDX, intentional text and HTML summaries, CFF, the four marketing metadata manifests, Marble license files, audit TSV files, and named generated design artifacts are in scope. Four documentation-bearing executable or configuration references are also explicit candidates: `.github/workflows/ci.yml`, `apps/web/.env.example`, `apps/mobile/.env.example`, and `scripts/telnyx-provision.mts`. Ordinary code comments, migrations, generic configuration, `.gitignore`, and `.vercelignore` remain evidence for other claims, not independent documentation candidates.

Generated documentation and design outputs remain visible as `generated-excluded`. The materials calibration report is a mixed historical artifact: its generated sections are evidence-only, but its human Findings remain unresolved claim scope until they are split. Upstream Marble documents and licenses remain `vendored-frozen`; Homa's `README-HOMA.md` is Homa-authored and remains in claim scope. Root and mobile `CLAUDE.md` symlinks and the web app's literal `@AGENTS.md` wrapper remain aliases with no independent claim scope. Alias and audit-control validation rejects any resolution outside the repository or into a prohibited root.

Every current candidate requires a manifest row. A row for a source path removed later may remain as frozen audit history only with a matching `deleted` and `removed`, `relocated` and `removed`, or `archived` and `archived` terminal state plus substantive disposition evidence. Other non-candidate rows fail coverage. Every other human-authored file starts `in-progress` and `unresolved` until its domain pass records evidence and a final disposition.

## Checks

- `pnpm check:docs -- --allow-open` validates exact candidate coverage, schema, required fields, enums, aliases, generated and vendored classifications, duplicates, stable ordering, and prohibited prefixes while the audit is active.
- `pnpm check:docs` applies the same structural checks and also requires zero `audit-active`, `in-progress`, or `unresolved` manifest rows and zero open claim-ledger rows.

The manifest is created in Task 1. The claim ledger remains an explicit open audit item until Task 2 creates and populates it. Until both exist, every row is resolved, and the final checks pass, this directory describes work in progress.
