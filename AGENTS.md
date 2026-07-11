# AGENTS.md

## Project overview

Homa is a multi-tenant AI homeschool assistant (Next.js + the eve agent framework, one Vercel deployment, Supabase Postgres, Stripe). pnpm workspaces + Turborepo monorepo. Planning is complete, this is execution: the current milestone is Deliverable 0, a conference landing page + waitlist, live by July 13, 2026.

**Read next, in order:** [`BUILD.md`](BUILD.md) (the engineering entry point: reading order, build phases, non-negotiable laws) → [`docs/homa-planning/13-mr-prd.md`](docs/homa-planning/13-mr-prd.md) (the product contract). For the repo's file-by-file layout, see [`README.md`](README.md)'s Repo map.

## Commands

- Install: `pnpm install`
- Dev (all packages): `pnpm dev`, or one package: `pnpm --filter web dev`
- Mobile app (not part of `pnpm dev` on purpose; it needs a simulator): `pnpm --filter mobile ios` (or `android`, `start`); setup in `apps/mobile/README.md`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Guards (no unit-test suite yet, these are the tests): `pnpm check:isolation` (tenant isolation, run before any schema/query change), `pnpm check:map` (bank content + scorer), `pnpm check:events` (MJ-08 registry parity), `pnpm check:skills-targeting`, `pnpm check:taxonomy` (skill graph integrity: mapping completeness, id law, DAG)
- Before ANY eve version bump, no exceptions: `node scripts/eve-upgrade-check.mjs` (procedure: `docs/homa-planning/runbooks/eve-version-bump.md`)
- CI (`.github/workflows/ci.yml`) runs typecheck + lint + build + eve build + all five guards on every push/PR, keep it green.

## Deploys & migrations

- Prod schema and prod code ship together. Never apply a breaking migration (a rename, a drop, a tightened constraint) ahead of the deploy that reads it: push the code, watch the Vercel deploy go READY, then apply the migration, or use expand-contract (add the new shape, dual-read, drop the old later). Additive-only migrations may lead. Cause: the 2026-07-10 /app outage (build-log entry) was the previous deploy reading a renamed column.
- A green `pnpm build` is not a green deploy. Vercel also runs `eve build`, which compiles agent tool modules outside Next's bundler, so imports Next tolerates (`next/server`, JSON loaders) can still sink the deploy. CI runs it now; before pushing changes under `apps/web/agent/`, run `pnpm --filter web exec eve build` locally.
- After any push that touches schema or the deploy pipeline, stay until the Vercel deployment is READY and probe the live site before calling it done.

## Code style & voice

- No em dash, ever, anywhere (code comments, UI copy, docs, commit messages). Use a comma, period, colon, or mid-dot instead.
- "Homa" in prose (title case); "HOMA" only in UI-surface wordmark treatments.
- Sentence case, reassure-before-inform, offers never commands, no red/"behind" framing, never compare siblings.
- Clarity and low cognitive load beat personality (founder ruling 2026-07-08). One idea per sentence, plain names for things, no metaphor stacks, no meta-commentary. Fewer words is NOT the goal: cutting words that carry meaning makes copy harder, not easier. The full rulebook is `.agents/skills/homa-copy-writer/SKILL.md`; gate important copy with `homa-copy-reviewer` then `homa-copy-editor`.
- Imports stay at the top of the file, no inline imports.

## Design system

UI and copy work should use Homa's existing design system, never invent new colors, type, or components. Source of truth: `docs/homa-design/` (start at its `SKILL.md`, then `readme.md`). A spec-compliant token summary for design tooling lives at [`DESIGN.md`](DESIGN.md). `apps/web` currently hand-copies tokens/fonts/the `Logo` component into `globals.css`, `layout.tsx`, and `components/brand/Logo.tsx`, and `apps/mobile` does the same in `src/theme/tokens.ts` and `src/components/brand/logo.tsx` (temporary until `packages/design` lands, ticket M1-17): if `docs/homa-design/` tokens change, update those files and `DESIGN.md`'s front matter too, so nothing drifts.

## Security & boundaries

- Never read from or write to `homa-macmini/`, `homa-research/`, `homa-template/`: untracked, contain live secrets and family data, or are read-only reference. Product code ports FROM `homa-template/` deliberately, never edits it in place.
- Never commit `.env`, `.env.*`, `*.local`, `**/*.key`, `**/*.crt` (see `.gitignore`).
- Never hand-edit generated files: `docs/homa-design/_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`.
- Tenant isolation is load-bearing and non-negotiable: `familyId` comes from auth context only, every tool re-scopes every model-supplied ID, RLS via non-service role + `SET LOCAL`, isolation tests stay green in CI always. Full law list: `BUILD.md` § Non-negotiable laws.

## When unsure

Prefer the PRD over journey docs, journey docs over judgment, founder decisions (`docs/homa-planning/journeys/10-reconciliation.md` §5) over everything. If still unresolved, stop and ask rather than inventing policy, then log it in `docs/homa-planning/build-log.md` so the decision stays auditable.
