# Documentation reconciliation implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Reconcile every tracked, human-authored documentation file and every material claim with current repository behavior, production evidence, authoritative product decisions, or an explicit upcoming ticket.

**Architecture:** A machine-checkable manifest proves file coverage. A claim ledger proves semantic coverage. Domain passes update live documentation, mark dated records as historical snapshots, and consolidate duplicate guidance around a canonical-topic index. A repository check enforces coverage, zero unresolved rows, valid internal links, allowed historical exceptions, and retired-term rules.

**Tech stack:** Markdown and TSV audit artifacts, Node.js validation scripts, Git history, pnpm/Turborepo checks, Vercel CLI deployment evidence, Supabase migration evidence, and direct HTTP probes.

---

## Governing rules

1. Founder rulings control product policy. The PRD controls product scope below those rulings. Journey specs control detail below the PRD. Code, tests, configuration, migrations, and direct probes establish what the current repository and production actually do.
2. Historical records remain historical. Preserve their original decisions and point-in-time observations, while adding status metadata or an archive context that prevents readers from treating them as current implementation guidance.
3. No product behavior changes are allowed merely to make documentation true.
4. Never access `homa-macmini/`, `homa-research/`, or `homa-template/`. Never inspect or expose secret values. Never hand-edit generated design artifacts.
5. A file is not complete until the manifest records its scope, authority class, evidence, canonical topic, final disposition, and claim-ledger coverage.
6. A claim is not resolved until it is evidenced as current, scoped as historical, assigned to a named upcoming ticket, or removed.

## Audit artifacts

- `docs/homa-planning/reconciliation/README.md`: canonical method, scope, authority, status vocabulary, and topic map.
- `docs/homa-planning/reconciliation/documentation-manifest.tsv`: one row per in-scope or explicitly excluded documentation artifact.
- `docs/homa-planning/reconciliation/claim-ledger.tsv`: one row per material claim or tightly coupled claim group.
- `docs/homa-planning/reconciliation/implementation-notes.md`: timestamped plan confirmations, discoveries, deviations, and human decisions.
- `docs/homa-planning/reconciliation/evidence/`: sanitized command outputs and production observations with no secret values.
- `scripts/docs-reconciliation-check.mjs`: deterministic coverage, ledger, link, and retired-guidance checks.

## Task 1: Freeze the candidate universe

**Files:**

- Create: `scripts/docs-reconciliation-check.mjs`
- Create: `docs/homa-planning/reconciliation/documentation-manifest.tsv`
- Modify: `docs/homa-planning/reconciliation/README.md`
- Modify: `package.json`

**Steps:**

1. Derive candidates only from Git's tracked and untracked indexes under explicit safe pathspecs, never from unrestricted filesystem traversal. Record each file's starting Git state.
2. Include every Markdown or MDX file, instruction file, README, runbook, plan, intentional public text summary, documentation HTML specimen, and tracked legal or provenance document.
3. Record generated and vendored artifacts explicitly with `generated-excluded` or `vendored-frozen` dispositions.
4. Record symlink aliases separately and point them to the canonical instruction file.
5. Add `pnpm check:docs` and first make it fail on missing manifest rows.
6. Populate every candidate row, then rerun until coverage is exact and duplicate paths are rejected.

## Task 2: Establish authority and evidence baselines

**Files:**

- Create: `docs/homa-planning/reconciliation/claim-ledger.tsv`
- Create: `docs/homa-planning/reconciliation/evidence/repository-baseline.md`
- Create: `docs/homa-planning/reconciliation/evidence/production-baseline.md`
- Modify: `docs/homa-planning/reconciliation/implementation-notes.md`

**Steps:**

1. Record the working-tree baseline without modifying, staging, stashing, or committing pre-existing user changes.
2. Record the authoritative precedence and every founder ruling that supersedes the PRD or older plans.
3. Record the current HEAD, local implementation state, latest READY production deployment, production aliases, safe live HTTP probes, and remote migration history where access permits.
4. Separate `repository`, `production`, `policy`, `historical`, and `upcoming` evidence types.
5. Add the first high-risk ledger entries: signup, SMS, multi-parent, subject taxonomy, paywall placement, pricing and plan name, mobile parity, design package status, migrations, and CI coverage.

## Task 3: Reconcile live operational documentation

**Files:**

- Modify as required: root and app `AGENTS.md`, `BUILD.md`, `README.md`, `DESIGN.md`, `HUMAN-TODO.md`, app and package READMEs, runbooks, agent instructions, active skills, CI comments, and public `llms` summaries.

**Steps:**

1. Verify every command against `package.json`, workspace packages, and command help.
2. Verify every architecture and security law against current code, migrations, and guards.
3. Verify every shipped-production claim with deployment, HTTP, or database evidence.
4. Replace duplicate operational guidance with links to one canonical home.
5. Assign unimplemented behavior to an existing named ticket, create a documentation-only follow-up ticket when authority already exists, or remove the claim.
6. Run `pnpm check:docs` after each coherent domain batch.

## Task 4: Reconcile product and planning documentation

**Files:**

- Modify or annotate as required: `docs/homa-planning/*.md`, journeys, plans, lead and report plans, runbooks, and the append-only build log header.

**Steps:**

1. Treat the PRD as a live contract and update only where a later founder ruling is explicit.
2. Treat the build log as an append-only historical record. Add context at the file level, never rewrite event outcomes.
3. Give every dated plan one explicit status: proposed, active, implemented, partially implemented, superseded, or historical evidence.
4. List remaining work by canonical ticket ID. Do not use prose such as "later" without a ticket.
5. Preserve decision history while preventing historical snapshots from acting as current instructions.

## Task 5: Reconcile specialist corpora

**Files:**

- Modify or annotate as required: `docs/homa-design/`, `docs/homa-benchmarks/`, `marketing/`, `.agents/skills/`, data documentation, and vendored Marble documentation.

**Steps:**

1. Verify Homa design tokens and copied app tokens without editing generated design files.
2. Verify benchmark versions, source dates, taxonomy counts, and refresh commands against code and guards.
3. Mark marketing drafts, fixtures, raw research, signals, and scorecards by lifecycle so drafts cannot read as published current claims.
4. Verify active skill commands, paths, models, providers, and output contracts. Mark third-party or vendored material explicitly.
5. Keep license, citation, and provenance files intact unless a broken Homa-specific pointer needs correction.

## Task 6: Consolidate and validate

**Files:**

- Modify: `docs/homa-planning/reconciliation/README.md`
- Modify: `scripts/docs-reconciliation-check.mjs`
- Modify, relocate, archive, or delete duplicate documentation as ledger evidence requires.

**Steps:**

1. Publish one canonical home per topic and replace competing live guidance with links.
2. Validate all repository-relative Markdown and MDX links, including case and anchor targets where deterministic.
3. Search for retired names, routes, prices, dates, statuses, commands, and duplicated laws.
4. Enforce zero unresolved ledger rows and a final disposition for every manifest row.
5. Review the diff for accidental edits to historical evidence, generated files, or pre-existing user work.

## Task 7: Final verification

**Commands:**

1. `pnpm check:docs`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm --filter web exec eve build`
6. `pnpm check:isolation`
7. `pnpm check:map`
8. `pnpm check:events`
9. `pnpm check:skills-targeting`
10. `pnpm check:taxonomy`

**Evidence steps:**

1. Re-run safe production deployment inspection and live probes for every claim labeled `production`.
2. Re-run remote migration comparison for every schema-state claim.
3. Confirm the manifest has no missing or duplicate candidates and every row has a final disposition.
4. Confirm the ledger has zero `unresolved` or `in-progress` rows.
5. Record exact command timestamps, exit codes, counts, deployment ID, and probe results without recording secret values.

## Stop conditions

Stop and request the smallest necessary decision or access change when:

- two authoritative founder decisions conflict without a later ruling;
- a production claim cannot be verified through available deployment, HTTP, or database evidence;
- a documentation artifact's ownership or generated status cannot be established safely;
- resolving the documentation would require changing product behavior or exposing a secret.
