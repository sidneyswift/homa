# AGENTS.md

## Project overview

Homa is a multi-tenant AI homeschool assistant built as a pnpm and Turborepo monorepo. The web product and eve agent share one Next.js deployment, durable state lives in Supabase Postgres, and billing uses Stripe. The July 13, 2026 conference remains the fixed launch deadline. Do not infer production state from repository presence alone; use the reconciliation production evidence and a fresh deployment probe.

**Read next, in order:** [`BUILD.md`](BUILD.md) (the engineering entry point: reading order, build phases, non-negotiable laws) → [`docs/homa-planning/13-mr-prd.md`](docs/homa-planning/13-mr-prd.md) (the product contract). For the repo's file-by-file layout, see [`README.md`](README.md)'s Repo map.

## Commands

- Install: `pnpm install`
- Dev (all packages): `pnpm dev`, or one package: `pnpm --filter web dev`
- Mobile app (not part of `pnpm dev` on purpose; it needs a simulator): `pnpm --filter mobile ios` (or `android`, `start`); setup in `apps/mobile/README.md`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- ChildProgress guards: `pnpm check:child-progress` for core events, default
  module tests, walk events, and reconciliation; `pnpm check:progress-ui` for
  focused route and card tests; and `pnpm child-progress:e2e` for the
  disposable local PostgreSQL harness. The E2E command creates and removes its
  own cluster and needs no remote credentials.
- Required guards: `pnpm check:isolation` (tenant isolation, run before any schema/query change), `pnpm check:map` (bank content + scorer), `pnpm check:events` (MJ-08 registry parity), `pnpm check:skills-targeting`, and `pnpm check:taxonomy` (skill graph integrity: mapping completeness, ID law, DAG)
- Documentation reconciliation: `pnpm check:docs -- --allow-open` during the audit and `pnpm check:docs` for the zero-open completion gate
- Conversation continuity tests: `pnpm check:continuity` when changing the continuity module or a channel adapter
- Before ANY eve version bump, no exceptions: `node scripts/eve-upgrade-check.mjs` (procedure: `docs/homa-planning/runbooks/eve-version-bump.md`)
- CI (`.github/workflows/ci.yml`) is configured for pushes to `main` and pull requests targeting `main`. It runs typecheck, lint, the five required guards, the Next build, and the eve build. It also runs ChildProgress, Progress UI, and the disposable ChildProgress PostgreSQL E2E. Confirm the actual workflow result before describing CI as green.

## Deploys & migrations

- Prod schema and prod code ship together. Never apply a breaking migration (a rename, a drop, a tightened constraint) ahead of the deploy that reads it: push the code, watch the Vercel deploy go READY, then apply the migration, or use expand-contract (add the new shape, dual-read, drop the old later). Additive-only migrations may lead. Cause: the 2026-07-10 /app outage (build-log entry) was the previous deploy reading a renamed column.
- A green `pnpm build` is not a green deploy. Vercel also runs `eve build`, which compiles agent tool modules outside Next's bundler, so imports Next tolerates (`next/server`, JSON loaders) can still sink the deploy. CI runs it now; before pushing changes under `apps/web/agent/`, run `pnpm --filter web exec eve build` locally.
- After any push that touches schema or the deploy pipeline, stay until the Vercel deployment is READY and probe the live site before calling it done.
- ChildProgress rollout starts with `HOMA_LIVE_PROGRESS_ENABLED` false. Deploy
  code and verify READY plus legacy paths first. Then apply the additive
  migration, run `pnpm progress:reconcile -- --dry-run` and the real
  reconciliation with an explicit database URL, enable the flag, and probe
  authenticated Progress, token reports, corrections, and linked SMS.
  Rollback turns the flag off first and leaves the additive ledger intact.

## Code style & voice

- No em dash, ever, anywhere (code comments, UI copy, docs, commit messages). Use a comma, period, colon, or mid-dot instead.
- "Homa" in prose and conversation; "HOMA" in the wordmark and on UI surfaces, per global founder ruling D8.
- Sentence case, reassure-before-inform, offers never commands, no red/"behind" framing, never compare siblings.
- Clarity and low cognitive load beat personality (founder ruling 2026-07-08). One idea per sentence, plain names for things, no metaphor stacks, no meta-commentary. Fewer words is NOT the goal: cutting words that carry meaning makes copy harder, not easier. The full rulebook is `.agents/skills/homa-copy-writer/SKILL.md`; gate important copy with `homa-copy-reviewer` then `homa-copy-editor`.
- Imports stay at the top of the file, no inline imports.

## Design system

UI and copy work should use Homa's existing design system, never invent new colors, type, or components. Source of truth: `docs/homa-design/` (start at its `SKILL.md`, then `readme.md`). A spec-compliant token summary for design tooling lives at [`DESIGN.md`](DESIGN.md). Web currently hand-copies tokens, fonts, and the `Logo` component into `globals.css`, `layout.tsx`, and `components/brand/Logo.tsx`. Mobile does the same in `src/theme/tokens.ts` and `src/components/brand/logo.tsx`. These copies remain temporary until `packages/design` lands under ticket M1-17. If `docs/homa-design/` tokens change, update those files and `DESIGN.md`'s front matter too, so nothing drifts.

## Security & boundaries

- Never read from or write to `homa-macmini/`, `homa-research/`, `homa-template/`: untracked, contain live secrets and family data, or are read-only reference. Product code ports FROM `homa-template/` deliberately, never edits it in place.
- Never commit secret-bearing environment files, `*.local`, `**/*.key`, or `**/*.crt`. The two tracked `.env.example` templates are documentation and contain names and safe placeholders only.
- Never hand-edit generated files: `docs/homa-design/_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`.
- Tenant isolation is load-bearing and non-negotiable: `familyId` never comes from model or client choice, every tool re-scopes every model-supplied ID, browser sessions use the caller's JWT with RLS, and server-originated channels use authenticated family mappings plus family-pinned libraries. Ticket M1-02 owns the remaining non-service-role plus transaction-local `SET LOCAL` hardening. Run the isolation guard before schema or query changes. Full law list: `BUILD.md` § Non-negotiable laws.

## When unsure

Explicit founder rulings take precedence over the PRD, the PRD takes precedence over journey documents, and journey documents take precedence over judgment. The canonical founder-ruling index is `docs/homa-planning/journeys/10-reconciliation.md` §5, including its later-ruling register. Code, tests, configuration, migrations, and direct production evidence establish observed behavior but do not silently change policy. If authoritative sources still conflict, stop and ask rather than inventing policy, then append the decision to `docs/homa-planning/build-log.md` and update the founder-ruling index.
