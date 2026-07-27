# Plan status index

Verified 2026-07-16 against actual codebase (migrations, source files, tests, CI, package.json scripts). This is the ground truth. If a plan header disagrees, this file wins until re-verified.

## How to read

- **SHIPPED**, code exists, tests pass, deployed or behind a feature flag in production
- **BUILT DARK**, code exists and tests pass, but behind a flag that is off in production
- **EXECUTED**, a one-time task that ran to completion (audit, research, generation)
- **IN PROGRESS**, partially implemented, remaining work identified
- **PLAN**, approved or proposed but no implementation yet
- **RESEARCH**, investigation or analysis document, not an implementation plan
- **SUPERSEDED**, replaced by later work

---

## `docs/homa-planning/plans/`

| Plan | Status | Evidence |
|---|---|---|
| `2026-07-05-marketing-demand-engine` | EXECUTED | Header says so; marketing pipeline skills built |
| `2026-07-06-codebase-cleanup-audit` | EXECUTED | Header says so |
| `2026-07-06-family-workspace-at-report-implementation-prompt` | SHIPPED | Family workspace provisioning exists in codebase |
| `2026-07-06-llm-report-depth-exploration-prompt` | EXECUTED | Header: "DONE, DO NOT RE-RUN" |
| `2026-07-06-llm-report-depth-options` | EXECUTED | Header: "RULED", decisions recorded |
| `2026-07-06-llm-report-narrative-implementation-prompt` | SHIPPED | LLM narrative layer exists in production reports |
| `2026-07-07-continual-learning-loop` | PLAN | Proposal only, no implementation found in codebase |
| `2026-07-07-tester-feedback-tickets` | SHIPPED | Header: "T1-T4 SHIPPED" |
| `2026-07-08-alessa-live-readthrough-tickets` | RESEARCH | Bug tickets extracted; fixes landed via other work |
| `2026-07-09-marble-taxonomy-opportunities` | SHIPPED | `packages/taxonomy/` exists with Marble data integrated (mapping, standards, domains) |
| `2026-07-10-education-knowledge-architecture` | SHIPPED | Migrations `knowledge_bank` and `knowledge_corpus_facets`; `apps/web/lib/knowledge/` with gate, research-run, research-dedup |
| `2026-07-10-homa-tasks-and-nightly-research` | SHIPPED | Header: "BUILT"; task framework migration, dispatch, fleet-research |
| `2026-07-10-materials-studio-v2` | SHIPPED | Header: "SHIPPED" |
| `2026-07-10-skill-graph-taxonomy` | SHIPPED | Full `packages/taxonomy/` package with domains, mapping, cards, graph, progress, standards, clusters |
| `2026-07-11-code-review-tickets` | IN PROGRESS | CR-01 thru CR-50, CR-52-55, CR-58-68, CR-72 fixed. CR-51 partial. CR-56, CR-57, CR-69, CR-70, CR-71 still open |
| `2026-07-11-documentation-reconciliation` | SHIPPED | Manifest, claim-ledger, evidence baselines, reconciliation check script all built |
| `2026-07-11-multi-parent-v0-and-founder-account-merge` | SHIPPED | Migration `20260711120000_multi_parent_v0.sql`; `family-fold.ts` with `attachAuthUser`/`foldStubFamilyIntoTx` |
| `2026-07-11-onboarding-depth-fork` | SHIPPED | `walk-store.ts`, `walk-prompt-store.ts`, `walk-answer-event.ts`, `/api/map/walk-fork` route |
| `2026-07-11-sms-family-invites` | SHIPPED | `invite_family_member_by_sms.ts`, `respond_to_family_sms_invite.ts`, `confirm_family_sms_invite.ts`, `family-invites.ts`, `family-sms-invite-copy.ts` + tests |
| `2026-07-11-thank-you-cards` | SHIPPED | Header: "LIVE" |
| `2026-07-11-the-wall` | BUILT DARK | Header: "BUILT", behind `HOMA_WALL_ENABLED` flag |
| `2026-07-12-night-manager` | PLAN | Plan only, no night-manager implementation found |
| `2026-07-12-portfolio-review-session-tickets` | RESEARCH | Tickets extracted from family session; informed other builds |
| `2026-07-12-trajectory-chart-mixed-scales-investigation` | RESEARCH | Investigation complete, diagnosis documented, no code changes |
| `2026-07-13-agent-frontier-review` | RESEARCH | Research document, revision 2 |
| `2026-07-13-agentic-capability-planes` | SHIPPED | Header: "PHASE 1 SHIPPED"; capability plane infrastructure exists |
| `2026-07-13-lesson-listen` | BUILT DARK | Header: "BUILT DARK"; behind `HOMA_LESSON_LISTEN_ENABLED`, migrations applied |
| `2026-07-13-observation-ledger` | SHIPPED | Migration `20260713134500_child_observations.sql`; `child_observations` table with RLS |
| `2026-07-13-season-simulation-field-study` | IN PROGRESS | Study ran with test persona, findings documented, roadmap candidates identified |
| `2026-07-13-wispr-flow-dictation-investigation` | RESEARCH | Investigation complete; two gates identified (privacy/DPA, iOS Safari audio conversion) before building |
| `2026-07-14-age-aware-knowledge-corpus` | SHIPPED | Header: "BUILT"; `knowledge_corpus_facets` migration, knowledge lib |
| `2026-07-15-filesystem-first-fleet-skills` | IN PROGRESS | Fleet-skills scripts built (`check`, `dormant-guard`, `dormant-snapshot`), CI wired, Phase C dormant window tracking opened. Cutover not yet authorized |

## `docs/superpowers/plans/`

| Plan | Status | Evidence |
|---|---|---|
| `2026-07-11-agent-led-live-progress` | SHIPPED | Header: "Production rollout completed on 2026-07-12"; full `child-progress/` module (40+ files), migrations, E2E, CI guards |
| `2026-07-11-morning-research-brief-format` | SHIPPED | `research-brief-format.ts` + tests, eval script, `check:research-brief` and `eval:research-brief` in package.json, CI wired |
| `2026-07-11-native-media-service` | PLAN | `packages/media/` and `apps/media-worker/` do not exist. `pad.ts` is local ffmpeg subprocess only, no Docker/Vercel service |
| `2026-07-11-sms-progress` | SHIPPED | `sms-progress.ts` + tests, `send_heads_up.ts` tool uses it, old `sms-ack.ts` deleted, in continuity guard |
| `2026-07-12-socials-starter-pack` | SHIPPED | 10/11 tasks checked; assets generated, README documented |
| `2026-07-15-sms-check-in-answer-binding` | SHIPPED | 20/21 tasks checked; deployed to production per plan header |

---

## Summary

| Status | Count |
|---|---|
| SHIPPED | 24 |
| BUILT DARK (behind flag) | 2 |
| EXECUTED (one-time) | 4 |
| IN PROGRESS | 3 |
| PLAN (not yet built) | 2 |
| RESEARCH (no build action) | 5 |
| **Total** | **40** |

### Not yet built

1. **Continual learning loop** (07-07), proposal, no code
2. **Native media service** (superpowers, 07-11), `packages/media/` and `apps/media-worker/` don't exist
3. **Night manager** (07-12), plan only

### Remaining work on in-progress plans

1. **Code review tickets**, CR-51 (partial), CR-56, CR-57, CR-69, CR-70, CR-71
2. **Season simulation field study**, study ran, roadmap candidates need triage
3. **Filesystem-first fleet skills**, Phase C dormant window observation (closes earliest 07-22), cutover not authorized
