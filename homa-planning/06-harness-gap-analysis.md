# Harness Gap Analysis: what Hermes ships that we must build on eve

> Researched 2026-07-02 from `homa-research/homa-sources/hermes-agent` (v0.17.0 docs).
> Question answered: "what does Hermes do out of the box that we will need eve to do?"
> Hermes is the most batteries-included personal agent of our three sources, so it's the
> best checklist for eve's gaps. Each gap maps to a backlog ticket.

## Gaps → our build list on eve

| # | Hermes capability (out of box) | eve status | Our build | Ticket |
|---|---|---|---|---|
| 1 | **Curated memory**: bounded MEMORY.md/USER.md (2,200/1,375 chars), `memory` tool (add/replace/remove, substring match), fail-loud-when-full → agent consolidates, duplicate rejection, **injection/exfiltration scan before prompt injection**, staged write-approval (`/memory pending`), background review notifications | No memory subsystem; multi-tenant memory doc is a DIY recipe (dynamic instructions + 3 tools + your store) | Memory tools + per-turn dynamic-instruction loading (already planned) **now spec'd to Hermes's design**: hard char budget per store, consolidate-on-full, dedupe, and security scanning of all user-derived content entering prompts | M2-02 (spec updated), M2-14 (scanning) |
| 2 | **Session search**: FTS5 over ALL past conversations in SQLite; ~20ms, zero LLM cost; agent can scroll into old sessions | Nothing. Workflow history = 7-day retention, unsearchable | `recall_conversations` tool over our Supabase message log using **Postgres FTS (+pgvector for semantic)** — the DB we already require makes this nearly free | M2-15 (new) |
| 3 | **Background self-improvement review**: after each turn, a cheaper aux model reviews the conversation and captures memories/skill patches (3–5× cheaper; consent-gated) | Hooks exist (`turn.completed`) but no built-in review | Post-turn extraction job (cheap model) that updates profile/what-works/memory — the cloud replacement for the Mac Mini's ambient-learning Slack sweep. THE "gets smarter" mechanism | M2-13 (new, promoted from implicit) |
| 4 | **Conversational cron**: `cronjob` tool — users create/pause/edit/trigger schedules in plain language; skill attachment; delivery targets; **model snapshot + fail-closed on default change**; **cron sessions cannot create cron jobs** (runaway prevention) | Static file schedules; dynamic-scheduling doc is a DIY recipe (we planned the dispatcher for OUR loops only) | Expose schedule CRUD tools to the model so moms can create reminders by asking; adopt both Hermes safety rules verbatim | M3-08 (new) |
| 5 | **Voice/vision/TTS/image-gen plugins** | None bundled (vision free via model file parts) | Whisper transcription + fal.ai wiring (already planned); TTS = post-launch idea only | M0-04, M2-05 (existing) |
| 6 | **Email as inbound channel** (reply to the agent by replying to email) | No email channel | v1 stays "email deep-links into web chat." Upgrade path documented: Resend inbound webhook → custom `defineChannel` | noted in J2; icebox |
| 7 | **Prompt-injection scanning of context files** (override attempts, hidden HTML, invisible Unicode, credential exfil patterns) | Frontmatter treated as data; no content scanning | Scan user-derived content (journal entries, voice transcripts, memory writes) before it reaches prompts | M2-14 (new) |

## Where eve already matches or beats Hermes (no build)

| Capability | Verdict |
|---|---|
| Durable execution | eve wins — Workflow-backed checkpointing, park/resume across days, crash replay |
| HITL approvals | eve wins — per-tool policies, input-dependent gates, `ask_question`, durable parks |
| Sandboxing | eve wins — Firecracker microVMs, egress firewall, credential brokering vs Hermes's local terminal backends |
| Model routing/fallback | AI Gateway (zero markup, fallbacks, per-family cost attribution) |
| Evals | eve first-class (`eve eval`, judges, CI); Hermes has no equivalent |
| Operator observability | Vercel Agent Runs/Workflow dashboards vs self-hosted Hermes dashboard |
| Multi-tenancy | eve has documented patterns; Hermes profiles = per-machine isolation only |

## Hermes features Homa does not need (deliberately skipped)

Persistent goals / Ralph loop (judge-driven auto-continuation — coding-agent shaped),
session checkpoints/rollback, kanban + worker lanes, computer-use/browser automation,
LSP/code tools, 30-platform messaging matrix, mixture-of-agents, pets/skins, Spotify.
Revisit only if a real user journey demands one.

## Design details adopted from Hermes (recorded as spec, not tickets)

1. **Bounded memory with agent-side consolidation** — a fixed char budget per store keeps
   per-turn token cost constant; when full, the tool errors and the agent merges/prunes
   in the same turn. (Also aligns with the compaction research: small pinned memory +
   searchable archive beats one big blob.)
2. **Frozen-snapshot memory injection** — Hermes injects memory once per session to
   preserve prompt cache. We load via dynamic instructions per TURN (constraint pinning
   matters more than cache for us), but keep the payload small and stable-ordered for
   cache friendliness.
3. **Fail-closed automation** — scheduled jobs pin their model; if global config changes,
   the job skips and alerts rather than silently spending. Adopt for all Homa loops.
4. **No recursive scheduling** — schedule-spawned sessions never get schedule-CRUD tools
   (enforce via eve dynamic capabilities keyed on the schedule principal).
5. **Consent-aware learning** — memory/skill writes from the background review can be
   staged for approval. For Homa: profile updates from ambient capture are auto-applied
   but always surfaced in the UI ("Logged — moved counting up"), with one-tap undo; a
   full write-approval mode is a settings toggle, not a rebuild.
