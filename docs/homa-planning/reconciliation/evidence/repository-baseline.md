# Repository baseline

Observed at: `2026-07-11T10:04:58-04:00`

This is a sanitized audit snapshot. It records repository facts needed by the documentation reconciliation. It contains no environment values, credentials, database connection material, private phone number, or Supabase project reference.

## Revision boundary

- Audit-start base: `6116cb4770258b6de122c7b6b2dde5f76aa0c5ce`.
- Current branch: `codex/documentation-reconciliation-2026-07-11`.
- Current branch HEAD at this observation: `a9f6e8b7dac8c29fb50ea9ea69114b037a7468ed`.
- The branch advanced after the audit began. The working tree also contains pre-existing and concurrent unstaged changes. The reconciliation preserves them and does not treat the production deployment as evidence for the later branch HEAD.

Sanitized commands:

```sh
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=no
```

## Toolchain observation

- Node.js: `24.18.0`.
- pnpm: `10.12.1`.
- Vercel CLI installed locally: `54.18.7`. Session guidance identifies `55.0.0` as current. Upgrade recommendation: `pnpm add -g vercel@latest`.
- Supabase CLI installed locally: `2.22.6`. The CLI advertised `2.109.1` as current.

No global tools were upgraded during the audit.

Sanitized commands:

```sh
node --version
pnpm --version
vercel --version
supabase --version
```

## Root commands and CI

`package.json` currently defines `build`, `lint`, `typecheck`, `check:docs`, and the five repository guards: `check:isolation`, `check:map`, `check:events`, `check:skills-targeting`, and `check:taxonomy`.

`.github/workflows/ci.yml` currently runs install, typecheck, lint, map, events, skills-targeting, taxonomy, build, the separate eve build, and isolation on pushes and pull requests to `main`. This is the executable CI contract. Shorter command lists in package READMEs are incomplete if they claim to enumerate everything CI runs.

## Documentation-adjacent operational checks

Observed on 2026-07-11 during the runbook audit:

- `pnpm check:sources` exited 0 with 25 sources and 224 items. The output contained 22 `OK` results, 3 `BLOCK` results that still require manual browser review, and 14 warnings. Exit 0 did not prove that every source resolved.
- `pnpm check:map` exited 0 for the current map, plan, fixture, version-lock, and narrative checks.
- `package.json` maps the state commands to `scripts/state-requirements-pull.mts` and `scripts/state-requirements-seed.mts`. The hosted seed path requires `pnpm seed:state-requirements -- --confirm-prod` through `scripts/prod-write-guard.mts`.
- `scripts/eve-upgrade-check.mjs` exists and statically contains the same-session park and resume checks. It was not run because it mutates dependency state, requires model and package-network access, and does not solve patch review, parked-production-session inventory, or authenticated production smoke verification.
- `scripts/map-norms-report.mts` was inspected but not run. It uses private aggregate database access, approximate calendar-month age math, and exact low-cell counts. The runbook suspends anchor changes from that report.
- The state pull, state seed, norms report, Eve upgrade check, and isolation guard were not executed in this pass because they mutate files, dependencies, external tables, Auth fixtures, or private data. Their existence and static control flow are repository evidence only.

## Benchmark and taxonomy snapshot

Observed on 2026-07-11 after the benchmark documentation pass:

- `pnpm check:map` exited 0. It reported 16 subjects, 224 cited items, and all map checks passed against `MAP_BANK_VERSION` `2026.07.5` in `packages/core/src/map/bank.ts`.
- `pnpm check:taxonomy` exited 0. The upstream validator reported 1,590 topics, 3,221 valid dependency edges, matching checksums, and no cycles. The Homa guard reported 102 domains, 183 clusters, 224 assigned bank items, complete source-to-Homa mapping, frozen ids, valid lineage, and all checks passed.
- `packages/taxonomy/data/manifest.json` is the count and checksum source for the vendored upstream snapshot. `packages/taxonomy/src/domains.ts` combines the Marble-derived domain registry with Homa-authored domains. The upstream 54 topic-bearing domains and Homa's assembled 102 domains describe different layers.

## Marketing operations snapshot

Observed on 2026-07-11 without recording account identifiers, tokens, or balances:

- `postiz auth:status` exited 0 and reported that Postiz is not authenticated. Social publication and analytics remain blocked on the founder action in `HUMAN-TODO.md`.
- `higgsfield account status` exited 0 and confirmed authenticated account access with a positive balance. No generation job was run, so this does not verify any model, duration, quality, or delivery claim.
- `cursor-agent` was absent from `PATH`; the bundled `codex` executable was present. No Homa marketing launchd job appeared in the current `launchctl list` output. The scheduled runner is not installed and its documented Cursor command is not executable in this environment.
- The documented failing scorer fixture exited 1 with seven expected findings: one grounding, four voice, and two completeness findings. The passing fixture exited 0. This verifies the fixture contract only; it does not make the scorer a legal, numeric, product-truth, consent, or production gate.

## Environment-template boundary

Tracked `.env.example` templates exist for both web and mobile, but the current ignore precedence is inconsistent. The root `.gitignore` first re-allows `.env.example`, then a later `.env*` rule matches the mobile template again. `apps/web/.gitignore` explicitly re-allows the web template. A tracked file can remain tracked while matching an ignore rule, so tracked status is not evidence that both templates are effectively allowlisted.

`git check-ignore -v --no-index` reports the later root rule for `apps/mobile/.env.example` and the nested exception for `apps/web/.env.example`. The blanket instruction that no `.env.*` file may be committed also conflicts with the repository's intentional tracked templates.

Evidence paths: `.gitignore`, `apps/web/.gitignore`, `apps/web/.env.example`, and `apps/mobile/.env.example`.

## Mobile implementation observations

- `apps/mobile/src/app/_layout.tsx` calls `installStreamingFetch()` at module initialization.
- `apps/mobile/src/lib/streaming-fetch.ts` assigns `expo/fetch` to `globalThis.fetch` and installs a `DOMException` shim when needed.
- `apps/mobile/src/features/chat/material-card.tsx` renders the generated artifact preview and opens its PDF URL through the system viewer. The code does not implement an in-app native print button. Documentation should distinguish PDF handoff from the older statement that worksheet printing exists only on web.

## Package and migration observations

- `apps/web` exists and is the active Next.js application, so root guidance that says to wait until it is scaffolded is stale.
- `packages/core/src/` contains more than the event registry, waitlist schema, and state list described by its README.
- The web and mobile applications still carry local design tokens and brand components. `packages/design` has not replaced those copies, consistent with ticket M1-17 guidance.
- `supabase/migrations/20260708021500_drop_lead_world.sql` drops the retired `lead_*` tables, while older documentation still describes them as current.
- `docs/homa-planning/build-log.md` already exists, so instructions to create it are stale.

## Sensitive-content observation

`HUMAN-TODO.md` contains a literal private phone number in operational prose. The value is intentionally omitted here. This observation supports removing or replacing that literal with a non-sensitive descriptor during the later human-operations documentation pass.

## Limitations

- This snapshot does not prove production behavior.
- It does not inspect ignored environment files or print secret values.
- It does not read any prohibited reference tree.
- It does not verify external-service account state.
- It records code presence, not successful execution, for mobile printing, cron jobs, billing, or external integrations.
