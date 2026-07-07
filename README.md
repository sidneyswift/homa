# Homa

An always-on AI homeschool assistant. She knows each child, makes materials aimed at
exactly what's growing, proves the work moved the numbers, and does the paperwork.

> You've got this. HOMA's got the rest.

## For engineering agents

**Read [AGENTS.md](AGENTS.md) first** (symlinked as `CLAUDE.md` for tools that look
for that name). It covers commands, code style, security boundaries, and points you
to [BUILD.md](BUILD.md), the entry point for the one real deadline, Deliverable 0,
reading order, build phases, and the non-negotiable laws.
The product contract is [docs/homa-planning/13-mr-prd.md](docs/homa-planning/13-mr-prd.md).

## Repo map

| Path | What |
|---|---|
| `AGENTS.md` | What agents read first: commands, style, boundaries (symlinked as `CLAUDE.md`) |
| `BUILD.md` | Engineering entry point, read next |
| `DESIGN.md` | Spec-compliant design-token summary for design tooling (source: `docs/homa-design/`) |
| `apps/web/` | The one deployable: Next.js app with the eve agent mounted inside (`withEve`) |
| `packages/core/` | The domain system (profiles, benchmarks, questionnaire, generators) |
| `packages/design/` | Design tokens/components as a workspace package (source: `docs/homa-design/`) |
| `supabase/` | Database migrations (Supabase GitHub integration watches this) |
| `data/` | Reviewed snapshots of external reference data (`state-requirements/`: HomeschoolLeap API pulls that seed the `state_requirements` table; runbook: `docs/homa-planning/runbooks/state-requirements-refresh.md`) |
| `marketing/` | Demand-gen engine state: signal reservoir, staged/published bundles, personas, voice, routines (spec: `docs/homa-planning/14-marketing-demand-engine.md`) |
| `docs/homa-planning/` | The planning corpus: PRD, architecture, backlog, PM library, decisions |
| `docs/homa-design/` | Brand + UI source of truth ("Warm and playful"): tokens, UI kits, voice rules |
| `docs/homa-benchmarks/` | Internal national-benchmark corpus (ages 2 to 16, all subjects): sourced anchor base for the map bank and progress reports |
| `HUMAN-TODO.md` | Founder's one-time setup checklist (temporary) |

Local-only (untracked, never pushed): `homa-macmini/` (the original single-family
production system, contains secrets and family data), `homa-research/` (vendored
agent-framework sources), `homa-template/` (the archived open-source template; its
canonical copy is the `template-archive` branch + tag).

## Toolchain

pnpm workspaces + Turborepo, deployed to Vercel (single project). Postgres on
Supabase (`homa-prod`, East US). Run `pnpm install` then `pnpm dev` once `apps/web`
exists (Phase A scaffolds it).
