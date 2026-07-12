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
| `apps/web/agent/tools/manage_child_progress.ts` | The one Eve tool for trusted ChildProgress evidence, check-ins, pause/resume, handoff, undo, and conflict resolution |
| `apps/web/lib/child-progress/` | ChildProgress deep module: exact feature-flag gates, legacy writer adapters, atomic corrections, loop-free route policy, strict tool and workflow contracts, family-local live summaries, trusted prompt markers, durable evidence provenance, compatibility writes, and selection |
| `scripts/reconcile-child-progress.mts`, `reconcile-child-progress-lib.ts`, and `reconcile-child-progress.test.ts` | Explicit final reconciliation command, transaction seam, and lock/dry-run tests for the ChildProgress rollout |
| `scripts/child-progress-postgres-test.mts` | Secret-free disposable PostgreSQL E2E for ChildProgress migration, isolation boundaries, workflows, compatibility, reconciliation, and cleanup |
| `apps/web/app/app/progress/` and `apps/web/app/app/[childId]/progress/` | Feature-flagged signed-in live Progress routes that resolve the focused child and read the current ChildProgress projection |
| `apps/web/components/progress/` | Live Progress hierarchy, unavailable and empty states, conflict sources, and child-focused Ask HOMA navigation |
| `apps/web/app/app/progress-message-parts.ts` and `progress-*-card.tsx` | Fail-closed web-chat parsing and accessible update, question, conflict, and workflow cards for strict `manage_child_progress` results |
| `apps/web/lib/child-progress/tool-result-contract.ts` | Shared client-safe `zod/mini` contract for bounded progress tool results, strict timestamps, and conflict evidence sources |
| `apps/web/app/app/progress-interaction-policy.ts`, `progress-action-lifecycle.ts`, and `chat-send-policy.ts` | Latest-part action identity, accepted-send consumption, queue cancellation release, and draft-preserving card sends |
| `apps/web/lib/sms-progress.ts` | Shared, deduped progress-text submission for slow SMS turns and material fallbacks |
| `apps/web/lib/conversation-continuity/` | Canonical cross-channel conversation module: episodes, bounded inbound provenance, actor/recipient causality, per-adult deliveries, open replies, transport bindings, context hydration |
| `apps/web/app/admin/` and `apps/web/lib/admin/` | Founder console (MJ-14): env-allowlisted /admin surface (overview, families, pulse, funnels) plus its gate, derived stages, sequential single-connection reads, digest, and cron heartbeat |
| `apps/web/app/api/email/webhook/` and `apps/web/app/api/billing/webhook/` | Resend and Stripe webhook mirrors feeding the `email_sends` ledger, `conversation_deliveries` escalation, and the families subscription columns; both dark until their signing secrets are set |
| `scripts/admin-console-smoke.mts` | Counts-only live smoke over every founder-console data module (`pnpm admin:smoke`) |
| `apps/web/lib/tasks/research-brief-format.ts` | Pure contract for the four-block morning research brief; its colocated test protects labels, sentence limits, CTA shape, and delivery-safe content |
| `scripts/research-brief-format-eval.mts` | Paid live-model check that runs the real research-brief producer skill through the same deterministic contract |
| `apps/mobile/` | Expo (React Native) companion app: pure client on the same Supabase + eve backend |
| `packages/core/` | The domain system (profiles, benchmarks, questionnaire, generators) |
| `packages/core/src/events.ts` and `events.test.ts` | Typed event registry and exact schema tests, including the nine PII-free ChildProgress events |
| `packages/design/` | Placeholder for the upcoming shared design package, ticket M1-17; runtime copies still live in web and mobile |
| `packages/taxonomy/` | Subject, domain, topic skill graph, validation tooling, and the generated narrow progress-metadata export |
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

## ChildProgress verification and rollout

Run `pnpm check:child-progress` for core, lib, walk, and reconciliation tests,
`pnpm check:progress-ui` for TSX routes and cards, and
`pnpm child-progress:e2e` from the repository root. The E2E harness uses a
temporary local PostgreSQL cluster and does not use a remote project.

Repository presence is not deployment. Keep `HOMA_LIVE_PROGRESS_ENABLED`
false while deploying code, wait for READY, and verify legacy paths. Apply the
additive migration, run the documented dry-run and real reconciliation, then
enable the flag and verify authenticated Progress, token reports, corrections,
and linked SMS. Rollback turns the flag off first and preserves the ledger.
