# Homa

An always-on AI homeschool assistant. She knows each child, makes materials aimed at
exactly what's growing, proves the work moved the numbers, and does the paperwork.

> You've got this. HOMA's got the rest.

## For engineering agents

**Start at [BUILD.md](BUILD.md).** It is the entry point: the one real deadline,
Deliverable 0, reading order, build phases, and the non-negotiable laws.
The product contract is [docs/homa-planning/13-mr-prd.md](docs/homa-planning/13-mr-prd.md).

## Repo map

| Path | What |
|---|---|
| `BUILD.md` | Engineering entry point — read first |
| `apps/web/` | The one deployable: Next.js app with the eve agent mounted inside (`withEve`) |
| `packages/core/` | The domain system (profiles, benchmarks, questionnaire, generators) |
| `packages/design/` | Design tokens/components as a workspace package (source: `docs/homa-design/`) |
| `supabase/` | Database migrations (Supabase GitHub integration watches this) |
| `docs/homa-planning/` | The planning corpus: PRD, architecture, backlog, PM library, decisions |
| `docs/homa-design/` | Brand + UI source of truth ("Quiet warmth"): tokens, UI kits, voice rules |
| `HUMAN-TODO.md` | Founder's one-time setup checklist (temporary) |

Local-only (untracked, never pushed): `homa-macmini/` (the original single-family
production system — contains secrets and family data), `homa-research/` (vendored
agent-framework sources), `homa-template/` (the archived open-source template; its
canonical copy is the `template-archive` branch + tag).

## Toolchain

pnpm workspaces + Turborepo, deployed to Vercel (single project). Postgres on
Supabase (`homa-prod`, East US). Run `pnpm install` then `pnpm dev` once `apps/web`
exists (Phase A scaffolds it).
