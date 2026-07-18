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
| `apps/web/lib/attachments/` | Chat attachment module: marker format (caption + blob URL riding `conversation_messages`, parsed back for rendering) and the channel-neutral normalizer reusing the SMS lanes |
| `apps/web/app/api/chat/upload/` and `apps/web/app/api/chat/attachments/` | Family-scoped Blob client-upload tokens for chat files, then the prepare step (normalize, caption, persist `chat_attachments`, return model parts and receipts) and the receipt's Undo |
| `apps/web/app/app/chat-attachments.tsx`, `attachment-message-parts.tsx`, `worked-for.tsx`, and `snap-card.tsx` | Composer attach flow (+ menu, camera, staged chips), polaroid photos and save receipts in the transcript, the worked-for reasoning chain, and the ask_for_photo camera card with its dim rule |
| `apps/web/lib/search/` and `apps/web/agent/tools/search_photos.ts`, `keep_photo.ts` | The studio's photo desk: SerpAPI Google Images with forced safe search, HMAC photo tokens (query-only model surface, never URLs), and rehosting into the family's blob space (`pnpm check:photo-search`; smoke: `apps/web/scripts/serpapi-smoke.mts`) |
| `apps/web/lib/search/firecrawl.ts` and `apps/web/agent/tools/web_fetch.ts` | Web page reading: Firecrawl scrape to size-capped markdown for curriculum pages, TPT listings, and parent-shared links, budgeted per family per day (founder ruling 2026-07-13, `web-fetch-firecrawl`; `pnpm check:web-fetch`; smoke: `apps/web/scripts/firecrawl-smoke.mts`) |
| `apps/web/lib/sms-progress.ts` | Shared, deduped progress-text submission for slow SMS turns and material fallbacks |
| `apps/web/lib/sms-segments.ts` | Carrier segment math (GSM-7 vs UCS-2, 10-segment cap) shared by the SMS transport preflight and long-copy producers like the morning brief |
| `apps/web/lib/conversation-continuity/` | Canonical cross-channel conversation module: episodes, bounded inbound provenance, actor/recipient causality, per-adult deliveries, open replies, versioned deterministic outcome classification, accepted-offer fulfillment attribution, transport bindings, and context hydration |
| `apps/web/app/app/settings/` and `apps/web/lib/family-profile.ts` | The family settings page (kids editable in place, per-member names/photos/emails, texting numbers, family details, memories) and its server-only families/family_members writes |
| `apps/web/app/admin/` and `apps/web/lib/admin/` | Founder console (MJ-14): env-allowlisted /admin surface (overview, families, pulse, funnels), a sent-delivery cohort funnel for morning offers, explicit signup/setup account-status copy, derived stages, sequential single-connection reads, digest, and cron heartbeat |
| `apps/web/lib/model-pricing.ts` and `model-pricing-live.ts` | The model price book joined to the `model_usage` ledger at read time: live Gateway catalog prices (15 minute cache) over a pinned fallback table; unknown models read as unpriced, never $0; freshness guard `pnpm check:model-pricing`, report `pnpm usage:report` |
| `apps/web/lib/knowledge/research-run.ts`, `research-dedup.ts`, and `apps/web/agent/channels/research.ts` | One fleet-research runner shared by nightly, manual, and lab triggers; durable per-topic locking across lens/stage; prior-source/claim dossiers; canonical-page and near-claim duplicate gates |
| `scripts/research-run.mts`, `research-lab.mts`, `research-operations.mts`, and `research-operations.test.mts` | Operator controls for one-off/backfill research and condensed sequential labs with typed timeout versus polling-failure receipts, source-overlap reports, optional run-id cleanup, and regression coverage (`pnpm research:run`, `pnpm research:lab`) |
| `apps/web/app/api/email/webhook/` and `apps/web/app/api/billing/webhook/` | Resend and Stripe webhook mirrors feeding the `email_sends` ledger, `conversation_deliveries` escalation, locked terminal-run delivery reconciliation after hard bounces, and the families subscription columns. The email webhook never terminalizes a running task and an unmatched receipt returns a retryable response instead of being lost; both routes stay dark until their signing secrets are set |
| `scripts/admin-console-smoke.mts` | Counts-only live smoke over every founder-console data module (`pnpm admin:smoke`) |
| `apps/web/lib/tasks/research-brief-format.ts` and `apps/web/agent/skills/research-brief/SKILL.md` | The binding four-block morning-brief contract and fleet procedure: one named-source, action-shaping finding for one child, plain headline, 900-character and carrier-safe delivery constraints, and one executable offer |
| `apps/web/lib/knowledge/citation-source.ts` and `select-brief.ts` | Named-citation resolver and deterministic v2 selector. They admit only fresh, cited, medium-or-high-confidence, stage-appropriate rows; rank family relevance, enforce the fourteen-day delivered-use cooldown, and break ties by fleet use then a stable family-local-date hash |
| `apps/web/lib/tasks/brief-context.ts`, `dispatch-input.ts`, and `apps/web/agent/tools/prepare_research_brief.ts` | Flag-gated, bounded dispatch context with up to three child-local candidates and seven delivered traces, serialized as one quoted JSON data object, then the dispatch-authenticated tool that validates and stages the exact draft before delivery |
| `apps/web/lib/tasks/research-brief-preparation.ts`, `research-brief-delivery.ts`, `research-brief-store.ts`, `research-brief-events.ts`, `dispatch-transport.ts`, `apps/web/agent/research-brief-dispatch.ts`, and `apps/web/agent/channels/dispatch.ts` | Prepared-draft service, one shared live transport adapter, and prepared-only delivery lane. Under one run lock and transaction, finalization re-reads all delivery attempts, derives terminal status, conditionally applies evidence effects, reveals the canonical message, and writes summary, channel, session, and finished time. Normal and recovery paths emit one durable task-completion event; confirmed SMS/email also emits one brief-sent event |
| `apps/web/lib/tasks/research-brief-feedback*.ts` and `apps/web/app/app/tasks/task-history.tsx` | Family-scoped, idempotent Helpful or Not for us feedback for a delivered morning brief, with the `research.brief_feedback` event. This is explicit parent feedback, separate from causal offer outcomes and four-hour possible-interest analytics |
| `apps/web/lib/admin/morning-brief-metrics.ts`, `apps/web/lib/conversation-continuity/reply-outcome.ts`, `reply-policy.ts`, `offer-fulfillment.ts`, `rfc-message-id.ts`, and `reactive-email-delivery.ts` | Cohort-based offer stages, versioned accepted/declined/answered classification, provider-backed email reply threading, deterministic material/task fulfillment proof, retryable post-acceptance reactive-email finalization, and read-only four-hour possible-interest reporting. Proximate activity never mutates a causal outcome |
| `supabase/migrations/20260718010000_morning_offer_funnel.sql` | Additive reply-classifier audit columns, legacy causal-outcome backfill, and the server-only accepted-offer fulfillment ledger |
| `apps/web/evals/research-brief/`, `apps/web/lib/tasks/research-brief-semantic-fixture.ts`, and `scripts/research-brief-format-eval.mts` | Eve dispatch and adjacent-negative routing definitions, deterministic source/child/novelty/CTA semantic fixtures, and an optional paid craft judge. The paid eval is credential-gated and is not a CI check |
| `supabase/migrations/20260716115722_morning_research_brief_v2.sql` | Additive migration for preparations, family knowledge use, explicit feedback, resolved outcomes, indexes, and RLS. Applied to production as migration version `20260717125607` |
| `scripts/morning-research-brief-v2-report.mts` and `morning-research-brief-v2-report-lib.ts` | Read-only, aggregate-only rollout comparison of the in-range `legacy` baseline and `research_brief_v2` treatment, including dispatch-channel tokens joined by run session, honest whole-run latency, and 800-second workflow-risk indicators |
| `apps/web/lib/tasks/research-brief-postgres-{schema,preparation,delivery,recovery,feedback,report}.test.ts` | Focused disposable PostgreSQL suites for v2 schema, reservation races, atomic finalization, stale recovery, feedback, and cohort reporting. The former monolithic suite is retired |
| `apps/web/lib/tasks/store.ts`, `delivery-version.ts`, `scheduled-dispatch.ts`, and `email-delivery-postgres.test.ts` | New morning runs pin their version from the exact global v2 flag or the exact sandbox-only flag plus server-loaded `families.sandbox`, never model or client input. Candidate preflight happens before a running row exists; empty candidate sets atomically record a final skip and advance the schedule. Generic run-locked finalization handles journal, custom, and pinned-legacy morning delivery, including save-only, status, channel, summary, session, finished time, and canonical visibility. Stale recovery reuses that finalizer. Focused PostgreSQL suites own skip replay, Resend reconciliation, retry identifiers, map-email receipts, and reactive-email retry |
| `pnpm check:research-brief`, `pnpm check:research`, `pnpm check:tasks-ui`, `pnpm check:agent-context`, `pnpm check:continuity`, and `pnpm check:admin` | Focused morning-brief guards for format, staging and delivery lifecycle, selector and named citations, Tasks UI, bounded context, causal delivery continuity, and outcome reporting. `pnpm eval:research-brief` is the separately authorized paid model check |
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
| `docs/homa-curriculum-atlas/` | Curriculum atlas: dated competitive/reference profiles of the homeschool curriculum market (87 profiles with parseable front matter, category comparisons, market overview, product implications) |
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
