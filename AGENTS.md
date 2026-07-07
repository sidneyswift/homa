# AGENTS.md

## Project overview

Homa is a multi-tenant AI homeschool assistant (Next.js + the eve agent framework, one Vercel deployment, Supabase Postgres, Stripe). pnpm workspaces + Turborepo monorepo. Planning is complete, this is execution: the current milestone is Deliverable 0, a conference landing page + waitlist, live by July 13, 2026.

**Read next, in order:** [`BUILD.md`](BUILD.md) (the engineering entry point: reading order, build phases, non-negotiable laws) → [`docs/homa-planning/13-mr-prd.md`](docs/homa-planning/13-mr-prd.md) (the product contract). For the repo's file-by-file layout, see [`README.md`](README.md)'s Repo map.

## Commands

- Install: `pnpm install`
- Dev (all packages): `pnpm dev`, or one package: `pnpm --filter web dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Guards (no unit-test suite yet, these are the tests): `pnpm check:isolation` (tenant isolation, run before any schema/query change), `pnpm check:map` (bank content + scorer), `pnpm check:events` (MJ-08 registry parity), `pnpm check:skills-targeting`
- Before ANY eve version bump, no exceptions: `node scripts/eve-upgrade-check.mjs` (procedure: `docs/homa-planning/runbooks/eve-version-bump.md`)
- CI (`.github/workflows/ci.yml`) runs typecheck + lint + build + all four guards on every push/PR, keep it green.

## Code style & voice

- No em dash, ever, anywhere (code comments, UI copy, docs, commit messages). Use a comma, period, colon, or mid-dot instead.
- "Homa" in prose (title case); "HOMA" only in UI-surface wordmark treatments.
- Sentence case, reassure-before-inform, offers never commands, no red/"behind" framing, never compare siblings.
- Imports stay at the top of the file, no inline imports.

## Design system

UI and copy work should use Homa's existing design system, never invent new colors, type, or components. Source of truth: `docs/homa-design/` (start at its `SKILL.md`, then `readme.md`). A spec-compliant token summary for design tooling lives at [`DESIGN.md`](DESIGN.md). `apps/web` currently hand-copies tokens/fonts/the `Logo` component into `globals.css`, `layout.tsx`, and `components/brand/Logo.tsx` (temporary until `packages/design` lands, ticket M1-17): if `docs/homa-design/` tokens change, update those files and `DESIGN.md`'s front matter too, so nothing drifts.

## Security & boundaries

- Never read from or write to `homa-macmini/`, `homa-research/`, `homa-template/`: untracked, contain live secrets and family data, or are read-only reference. Product code ports FROM `homa-template/` deliberately, never edits it in place.
- Never commit `.env`, `.env.*`, `*.local`, `**/*.key`, `**/*.crt` (see `.gitignore`).
- Never hand-edit generated files: `docs/homa-design/_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`.
- Tenant isolation is load-bearing and non-negotiable: `familyId` comes from auth context only, every tool re-scopes every model-supplied ID, RLS via non-service role + `SET LOCAL`, isolation tests stay green in CI always. Full law list: `BUILD.md` § Non-negotiable laws.

## When unsure

Prefer the PRD over journey docs, journey docs over judgment, founder decisions (`docs/homa-planning/journeys/10-reconciliation.md` §5) over everything. If still unresolved, stop and ask rather than inventing policy, then log it in `docs/homa-planning/build-log.md` so the decision stays auditable.
