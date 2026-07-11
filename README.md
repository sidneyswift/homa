# Homa

An AI homeschool assistant that keeps a family's context, helps create learning materials, records school hours, and supports a parent through web, mobile, text, email, and voice surfaces that are present in the repository. Production availability for each channel is verified separately.

> You've got this. HOMA's got the rest.

## For engineering agents

**Read [AGENTS.md](AGENTS.md) first**. It covers commands, code style, security boundaries, and deployment discipline. Continue with [BUILD.md](BUILD.md) for authority, evidence, repository boundaries, and the non-negotiable laws. The product contract is [docs/homa-planning/13-mr-prd.md](docs/homa-planning/13-mr-prd.md), interpreted through the founder decision registry in [docs/homa-planning/journeys/10-reconciliation.md](docs/homa-planning/journeys/10-reconciliation.md).

## Repo map

| Path | What |
|---|---|
| `AGENTS.md` | What agents read first: commands, style, boundaries (symlinked as `CLAUDE.md`) |
| `BUILD.md` | Stable engineering contract and evidence rules, read next |
| `DESIGN.md` | Spec-compliant design-token summary for design tooling (source: `docs/homa-design/`) |
| `apps/web/` | The one deployable: Next.js app with the eve agent mounted inside (`withEve`) |
| `apps/web/lib/sms-progress.ts` | Shared, deduped progress-text submission for slow SMS turns and material fallbacks |
| `apps/web/lib/conversation-continuity/` | Canonical cross-channel conversation module: episodes, actor/recipient causality, per-adult deliveries, open replies, transport bindings, context hydration |
| `apps/web/lib/tasks/research-brief-format.ts` | Pure contract for the four-block morning research brief; its colocated test protects labels, sentence limits, CTA shape, and delivery-safe content |
| `scripts/research-brief-format-eval.mts` | Paid live-model check that runs the real research-brief producer skill through the same deterministic contract |
| `apps/mobile/` | Expo (React Native) companion app: pure client on the same Supabase + eve backend |
| `packages/core/` | The domain system (profiles, benchmarks, questionnaire, generators) |
| `packages/design/` | Placeholder for the upcoming shared design package, ticket M1-17; runtime copies still live in web and mobile |
| `packages/taxonomy/` | Subject, domain, topic skill graph and its validation tooling |
| `supabase/` | Local database migrations; local presence does not prove remote application |
| `data/` | Reviewed snapshots of external reference data (`state-requirements/`: HomeschoolLeap API pulls that seed the `state_requirements` table; runbook: `docs/homa-planning/runbooks/state-requirements-refresh.md`) |
| `marketing/` | Demand-gen engine state: signal reservoir, staged/published bundles, personas, voice, routines (spec: `docs/homa-planning/14-marketing-demand-engine.md`) |
| `docs/homa-planning/` | Product contract, founder registry, ticket backlog, dated plans, runbooks, and preserved history |
| `docs/homa-design/` | Brand + UI source of truth ("Warm and playful"): tokens, UI kits, voice rules |
| `docs/homa-benchmarks/` | Internal national-benchmark corpus (ages 2 to 16, all subjects): sourced anchor base for the map bank and progress reports |
| `docs/notes/` | Running implementation notes that record discoveries and plan deviations |
| `docs/superpowers/` | Approved feature designs and executable implementation plans |
| `docs/homa-planning/reconciliation/` | Exhaustive documentation manifest, claim ledger, and time-bounded evidence |
| `HUMAN-TODO.md` | Current founder-only external actions, with external state rechecked before action |

Never read from or write to the restricted local trees named in `AGENTS.md`. They are outside repository work even when present locally.

## Toolchain

The repository uses pnpm 10 workspaces and Turborepo. `apps/web` is the single Vercel deployable and uses Supabase Postgres. Run `pnpm install`, then `pnpm dev` for workspace development or `pnpm --filter web dev` for the web app. The Expo app has separate simulator commands in [apps/mobile/README.md](apps/mobile/README.md).
