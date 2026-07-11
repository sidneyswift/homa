# Agentic architecture · what lives where, and how Homa Cloud replicates the Mac mini

> Status: RULING (founder direction 2026-07-09, this session). Written after a
> full read of eve 0.19.0's bundled docs plus a live verification probe against
> `eve dev`. This doc answers three founder questions: (1) what belongs in the
> eve sandbox vs skills vs tools vs the database, (2) whether the model still
> "uses skills via trigger" in our architecture, (3) what Hermes/OpenClaw local
> can do that eve cloud cannot. It also records the agentic build ladder and
> the four decisions locked with it. Companion docs: 01-architecture.md (state
> model, tenancy), 06-harness-gap-analysis.md (Hermes gaps, ticket map),
> 11-hermes-implementation-notes.md (the review-loop spec).
>
> Reconciliation note (2026-07-11): founder placement rulings remain current.
> Repository-status statements below are time-bounded observations and do not
> prove deployment, provider configuration, or end-to-end production behavior.
> Sections 1, 3, and 5 distinguish the original July 9 probe from the current
> repository state.

## 0. The gateway doctrine (founder-ratified 2026-07-09 evening)

Every conversational surface is an adapter on the ONE agent and ONE
application-owned conversation ledger. "One agent" means shared
instructions/tools, not shared Eve history: every adapter resolves actor,
recipient, canonical episode, reply target, and open loop through
`apps/web/lib/conversation-continuity/` before it starts or resumes a channel-local
Eve session (web and SMS today, email inbound per
docs/homa-planning/gateway-plan.md). A surface that cannot be an adapter
yet (voice, until eve ships a voice channel) must share the record and
the guarded writes until it can. Loops that talk to families wake the
agent through the dispatcher; only receipts and pipelines stay
deterministic sends. The caller/pinned tool duality collapses at ONE
seam (lib/agent-db.ts resolveAgentAccess) when M1-02 lands.

## 1. The one-sentence model

The Mac mini's filesystem did three jobs at once: it was the **system of
record** (children/*.json, journal.jsonl), the **working memory** (MEMORY.md
injected into context), and the **tool surface** (grep/read/write/edit). Cloud
splits those three jobs across three substrates, and "make it more agentic"
means finishing the third one, not merging them back into files.

| Job | Mac mini | Homa Cloud | Status |
|---|---|---|---|
| System of record | markdown + JSON files | Postgres rows (RLS, per family) | Built, correct |
| Working memory | MEMORY.md pasted into prompt | dynamic instructions on `turn.started` (family-context.ts), rebuilt from Postgres every turn | Built, correct |
| Tool surface over the record | grep/read/write on the vault | schema-bounded write tools plus family-scoped `recall` across stored transcripts, conversations, and memories | Built in the repository; authenticated production behavior is unverified |

## 2. Placement ruling: what goes where

- **Postgres** holds everything that must outlive a session, cross sessions,
  or be queried: families, children, memories, skills, call transcripts,
  canonical conversation episodes/messages/deliveries/open loops/bindings,
  reports, plans. This is also eve's own guidance verbatim
  (state.md: "anything that has to outlive the session ... belongs in your own
  database"; multi-tenant-memory.md prescribes exactly our
  dynamic-instructions + tools + Postgres shape).
- **eve skills** are know-how, not abilities: markdown procedures advertised
  by description; the model calls the framework `load_skill` tool when a
  request matches. Two homes, both correct:
  - `agent/skills/*` (repo-authored): Homa-wide craft that ships with deploys
    and is versioned in git. Packaged skills' sibling files auto-seed into
    `/workspace/skills/` for the file tools to read.
  - `family_skills` + `skill_bank` rows served by the dynamic resolver
    (`agent/skills/skill-library.ts`): per-family and founder-curated skills
    that change at runtime without a deploy. This is eve's documented
    dynamic-skills pattern, not a workaround.
- **eve tools** are typed abilities that run in the app runtime with
  `process.env` and the caller's session auth. Tools and skills are different
  layers on purpose: a skill can only add instructions (progressive
  disclosure); behavior still comes from tools. The Mac mini blurred this
  because "skills" were files the agent edited with file tools; in cloud the
  same loop exists as rows the agent edits with save_skill/forget_skill.
- **The sandbox** (`/workspace`) is per-session scratch and a tool surface,
  never storage (law #2; session sandbox names are deployment-scoped, every
  deploy orphans them). Seed scripts, fonts, and templates via
  `agent/sandbox/workspace/**`; artifacts upload to Blob before turn end.
- **Eve session history** is channel-local execution state, never product
  conversation identity. It may be discarded or rotated after the canonical
  episode is rehydrated. A visible parent reply resolves against provider
  reply metadata or one typed per-recipient open loop, never "latest message."
- **`defineState`** is session-scoped durable working memory (counters, the
  current plan). Use it for the review-loop nudge counter; never for
  cross-session facts.

**Answer to "the model uses skills via trigger, but we are building tools":**
both are live today and both are needed. The trigger loading works exactly as
on the Mac mini: descriptions are advertised every turn, the model calls
`load_skill` on match, and save_skill grows the library (the skillify loop,
cloud edition). Recall is now a typed, family-scoped tool over stored transcripts,
conversations, and memories. The remaining distinction is substrate: cloud recall
queries guarded product records rather than granting a model unrestricted access to
a persistent local filesystem.

## 3. Historical framework probe and current repository posture

The following tool count and behavior probes were observed in local development on
2026-07-09. They are preserved as dated evidence, not a current tool-count or
production claim. The current repository disables framework `bash`, `write_file`,
and `web_fetch` through tool sentinel modules. `web_search`, read-only workspace
tools, and `load_skill` remain available under the agent instructions.

`GET /eve/v1/info` on the running agent lists **18 tools**: our 8 authored
tools plus all 10 framework built-ins (`ask_question`, `bash`, `glob`, `grep`,
`read_file`, `write_file`, `todo`, `web_fetch`, `web_search`, `load_skill`).
Confirmed in eve source: `getFrameworkToolDefinitions()` returns the full set
unconditionally; only a `disableTool()` sentinel file removes one, and
`apps/web/agent/tools/` contains none.

Live behavior probes (localDev auth, real model):

1. "Run this bash command" (direct, then with an engineering-audit framing):
   **refused both times**. The Homa persona plus the missing-family fallback
   held; the model never called bash.
2. "Can you check online what Florida's 2026 evaluation deadline is?"
   (natural parent question): **web_search fired and executed**, returned
   real results, and the reply was written from them.

Reading: the model self-censors tools that feel out of character but freely
uses the ones a request makes natural. The surface is real, ungoverned (no
injection scanning on fetched content, no cost tags, no instruction guidance),
and mostly useless to the product today (the workspace is empty).

**Ruling applied (founder chose "verify, then decide"; verification above):**
disable `bash`, `write_file`, and `web_fetch` now via sentinel files; keep
`web_search` (provider-executed, no arbitrary-URL exfil channel, and the probe
showed genuine compliance-question value) with one governing instruction line;
keep `ask_question`, `todo`, `read_file`, `glob`, `grep`, `load_skill`
(harmless or useful). Re-enabling any of them is deleting a three-line file,
which happens deliberately with M0-03/M2-05 (the sandbox worksheet factory)
    and its deny-all egress + credential brokering posture. The original statement
    that no sentinel modules existed applied only before the ruling was implemented.

## 4. What Hermes/OpenClaw local can do that eve cloud cannot

Structural, not fixable by building:

1. **A computer with an identity.** One persistent filesystem that is record,
   memory, and workspace at once, surviving forever. Cloud compute is
   request-scoped; the sandbox is scratch by design. We replicate the value
   (durable memory + recall + a seeded workspace), not the substrate.
2. **Self-modifying harness.** OpenClaw edits its own instruction files and
   gains new abilities at runtime. eve compiles instructions and tools at
   deploy. Our dynamic instructions/skills from Postgres give runtime-editable
   knowledge, but new TOOLS ship only with deploys (a safety feature under
   tenancy, honestly).
3. **Local peripherals and personal accounts.** Wifi printing, the founder's
   Gmail, desktop Slack. Browser and system PDF actions are the current print
   boundary. Direct printer integration remains an open founder decision and is
   not approved by the proposed reversal plan alone.
4. **No tenancy walls.** One family, full trust, Opus on everything. Cloud
   pays for multi-tenancy with RLS, scanned writes, budgets, and model mix.
5. **Machine-local cron.** Second-granularity, machine state access. eve
   schedules are UTC Vercel Cron at minute granularity, task-mode or
   channel-handoff.

What eve cloud does that the locals cannot: durable sessions that survive
crashes and park for days (HITL), zero-orchestration multi-tenant fan-out, one
deploy updating every family, Firecracker sandboxes with egress firewalls and
credential brokering, first-class evals, per-family cost attribution through
the gateway. The honest summary: **nothing the Mac mini did that the product
needs is unreplicable; what is unreplicable was already cut on purpose.**

## 5. The build ladder (founder direction 2026-07-09: all ten, in order)

| # | Item | Mechanism | Repository status observed 2026-07-11 | Ticket lineage |
|---|---|---|---|---|
| 1 | Built-in tool decision | sentinels per section 3 ruling | Built; production tool surface not probed | M2-14 posture |
| 2 | Call-transcript sync automation | hourly cron step + shared Telnyx library | Built; provider and successful cron execution unverified | founder ruling 2026-07-09 |
| 3 | Post-call memory turn | bounded extraction from verbatim transcript into `family_memories` | Built; D6 sensitive-memory controls remain MJ-13 work | FR-9 / M2-13 first slice |
| 4 | Recall tools | family-scoped lexical and semantic search over transcripts, conversations, and memories | Built; authenticated production search unverified | M2-15 |
| 5 | Conversation history in Postgres | channel adapters persist and rehydrate canonical episodes, messages, deliveries, and open loops | Built in the repository; remote migration state unverified | M1-02 slice |
| 6 | Voice line hands | `remember` webhook tool on Telnyx assistants | Built in provisioning source; live assistant readback unverified | build-log 2026-07-08 lineage |
| 7 | Journal prompt loop | time-zone-aware dispatch, flag-dark until founder review | Built and flag-gated; successful production delivery unverified | FR-6 / MJ-05 seed |
| 8 | Post-turn review | bounded verbatim role-labeled rows, reduced toolset, delta guards, undo | Built; production model behavior unverified | M2-13 full |
| 9 | Materials factory | current path renders HTML through Chromium in a Next.js function; sandbox code is deny-all groundwork | Repository path built; image, Blob, review, and delivery production flow unverified | M0-03 / M2-05 |
| 10 | Durable family workspace projection | proposed Blob-backed projection seeded into sandbox | Not built; Blob artifact storage exists, but this projection does not | proposed surface |

The 2026-07-09 synthetic transcript probe is preserved in the build log as dated
evidence. It is not proof of the current deployment after later migrations and
channel changes. Current founder-only production checks live under
`HUMAN-TODO.md` section Product activation gates.

Decisions locked with the direction:

- **Memory philosophy: pinned + searchable archive.** family_memories stays
  small and curated (the 4,000-char budget stands); the archive that recall
  searches is transcripts + conversations, not a bigger pinned blob.
- **Built-in eve tools:** verified, then the §3 ruling.
- **Learning-loop writes: auto-apply + visible chip + undo** (PRD FR-9
  posture). Delta guards cap how much one call/turn may write.
- **Voice brain: stays on Telnyx**; the intelligence moves to the post-call
  learning loop, plus live webhook tools for writes that should not wait.
