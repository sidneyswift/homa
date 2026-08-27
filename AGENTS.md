# AGENTS.md

## Project overview

Homa is a multi-tenant AI homeschool assistant built as a pnpm and Turborepo monorepo. The web product and eve agent share one Next.js deployment, durable state lives in Supabase Postgres, and billing uses Stripe. The July 13, 2026 conference remains the fixed launch deadline. Do not infer production state from repository presence alone; use the reconciliation production evidence and a fresh deployment probe.

**Read next, in order:** [`BUILD.md`](BUILD.md) (the engineering entry point: reading order, build phases, non-negotiable laws) → [`docs/homa-planning/13-mr-prd.md`](docs/homa-planning/13-mr-prd.md) (the product contract). For the repo's file-by-file layout, see [`README.md`](README.md)'s Repo map.

## Co-founder Slack: feedback and references

There is a Slack workspace where the non-technical, phone-based co-founders
build Homa with us. They drop feedback and reference material (reference
images, curriculums, example worksheets they like) into `#homa-inspo` and
`#homa-feedback`. A Slack agent named Cosmo sometimes ingests these
automatically, but it often misses them. When drops go uningested, pull them
in with the [`reference-ingestion`](.agents/skills/reference-ingestion/SKILL.md)
skill (single reference images, worksheets, examples) or the
[`curriculum-ingestion`](.agents/skills/curriculum-ingestion/SKILL.md) skill
(full curriculums), which feed material-studio and Homa's other capabilities.

## Agent capabilities: fat skills over narrow tools

When changing what Homa can do for families, **start at the skill layer, not
the tool layer**. Homa follows the thin-harness/fat-skills architecture and
the latent-vs-deterministic split:

- Push judgment, process, examples, decision trees, tool sequencing, and
  quality criteria **up into load-on-demand skills**.
- Push exact retrieval, computation, authentication, validation, durable
  writes, rendering, and delivery **down into narrow deterministic tools**.
- Keep the eve harness and always-on instructions generic. A tool is an
  ability; a skill teaches Homa how and when to combine abilities into a
  useful parent-facing capability.

**In this section, "build a skill" means design a fleet skill, not a family
skill.** Coding agents building Homa create shared capabilities that can help
the whole fleet, never a per-family product feature. `family_skills` is
dormant historical product data (2026-07-15, see Skill authoring rules
below); it is not a place a coding agent implements anything, live or
otherwise.

Read `docs/homa-planning/15-agentic-architecture.md` §2 for the binding
placement ruling. `docs/homa-planning/plans/2026-07-13-agent-frontier-review.md`
records the research comparison behind this rule.

### Choose the right layer

| Put it in | Use it for | Homa examples |
|---|---|---|
| **Fleet Eve skill** | The hard part is judgment or a reusable procedure: how to reason, choose an approach, sequence existing tools, judge quality, handle variants, or know when to stop. A better model should improve the result without changing code. | `materials-studio` decides difficulty, chooses image/HTML/hybrid, calls the material tools, reviews, revises, and finalizes. `research-brief` selects one family-relevant angle and sequences research, recall, and progress tools. |
| **Eve tool / deterministic code** | The result or effect must be exact, typed, authenticated, tenant-scoped, idempotent, rate-limited, auditable, or impossible to hallucinate. The model needs an ability it does not currently have. | `manage_child_progress`, `create_printable`, `remember`, `send_followup_email`, database queries, scoring, date math, Blob writes, provider calls. |
| **Skill + tool** | The capability needs both judgment and a missing exact effect. The skill owns the complete workflow; the tool is the smallest reusable deterministic leaf. | A curriculum-fit skill may use existing recall/web tools plus one narrow catalog lookup tool. Do not turn the whole curriculum-fit workflow into one god tool. |
| **Always-on or dynamic instructions** | The rule must apply before any skill can load, or the data must be fresh every turn. Keep capability-specific procedures out. | Homa's identity, voice, tenancy and tool-honesty laws stay in `apps/web/agent/instructions.md`; SMS-only behavior stays in `apps/web/agent/instructions/sms-mode.ts`; family/progress context is rebuilt on `turn.started`. |
| **Postgres / Blob / `defineState`** | Durable product truth / durable artifacts / session-only working state. | Family facts and skills in Postgres, PDFs in Blob, a session counter in `defineState`. Never use a skill body, conversation history, or sandbox file as load-bearing state. |
| **Channel / schedule / UI / subagent** | Transport authentication and delivery / clock-driven activation / parent-visible interaction / genuinely isolated context or privileges. | A new messaging surface is a channel, not a tool. A weekday wake-up is a schedule. Use a subagent only when it needs a different prompt, model, context window, or restricted tool surface; use a skill when optional procedure is enough. |

### Models judge, code verifies (binding, founder ruling 2026-07-21)

Whenever a capability has to turn human language into structured data,
**a model makes the judgment and deterministic code verifies the result.**
Never write pattern matching (regex, keyword lists, token-overlap scores,
alias tables) to decide what a sentence *means*. That is a judgment call,
and hand-written patterns are bad at it in a way that is invisible until
you measure.

The split, precisely:

| The model decides | Code decides |
|---|---|
| Which skill a sentence describes, which child it is about, how strong the claim is, whether a message reports anything at all | Whether that skill exists, whether the child is in this family, whether the quote really appears in the message, whether the claim is age-plausible, what number the answer produces, idempotency, tenancy, rate limits |

A model proposes; it never has authority. Its output is a **structured
object validated by a schema** whose fields are enums and ids drawn from
real catalogs, plus a verbatim quote the code re-checks against the
source text. If any check fails, the claim is dropped, never softened.
The scorer, the ledger, and every tenancy rule stay exactly as
deterministic as before.

Corollaries, each learned from a production failure:

- **Do not pre-filter the model's options with the pattern matcher you
  are replacing.** Pass the whole catalog; a lexical shortlist
  reintroduces the exact recall failure.
- **Verify provenance, not phrasing.** A verbatim-quote check is a real
  guarantee; a token-overlap score is a guess wearing a number.
- **Measure the judgment layer against real production language** and
  ratchet the number. Deterministic tests below the judgment prove
  nothing about whether signal ever arrives.
- **A deterministic component that reliably produces nothing is not the
  safe choice.** Silence is the failure mode least likely to page anyone.
- **A per-item rule belongs in the validator, not the transport schema.**
  Schemas parse permissively; validators reject one proposal and let the
  rest through.

Two narrow exceptions: exact string work that is verification rather than
interpretation stays deterministic and lexical, and a security floor is
not a capability (a deny-list like `scanMemoryContent` may stay
deterministic because it backstops a structural control, never stands in
for a capability, and a model judging attacker-controlled text would sit
inside the blast radius of the thing it judges).

The full ruling text, the journal-matcher and memory-guardrail failures
that made it law, and the eval evidence live in
`docs/homa-planning/models-judge-code-verifies.md`. Read it before
building or reviewing any language-to-structured-data capability.

### Required decision sequence

1. Write the fleet-wide parent-facing capability as a procedure first.
   Identify the
   choices Homa must make, the evidence she should use, the quality bar, the
   tools she needs, and the honest stop/failure conditions.
2. Inventory the existing tools. If they can already perform every required
   effect, implement or improve a **fleet skill only**. Do not add a tool
   merely to make a workflow feel more concrete.
3. If one exact effect is missing, add the **smallest general-purpose tool**
   that supplies it, then keep the workflow and judgment in the skill.
4. Place state separately: Postgres for durable facts and records, Blob for
   artifacts, dynamic instructions for fresh bounded context, `defineState`
   for session working memory, and the sandbox for scratch only.
5. Test each layer where it can fail: unit/integration tests for deterministic
   code, behavioral evals for skill output, positive and adversarial-negative
   routing cases for whether the skill loads, and an end-to-end journey when
   the capability crosses tools or channels.

### Skill authoring rules

- Filesystem-first (founder ruling `filesystem-first-fleet-skills`,
  2026-07-15): `apps/web/agent/skills/<name>/SKILL.md` is the only active
  fleet-skill home. It ships with code, is versioned in git, and loads at
  runtime through eve's built-in discovery. Use it for all fleet craft,
  including craft that would once have been a targeted skill-bank row: with
  a small roster of active skills (list `apps/web/agent/skills/` for the
  current count), advertising every description to every family and letting
  the loaded skill branch on the family's actual children is cheaper and
  more reliable than a second targeting system.
- `skill_bank` and `family_skills` are dormant historical data, not a build
  surface. There is no `save_skill`, no `forget_skill`, and no runtime
  resolver reading either table. Do not add code that reads or writes them;
  do not treat a row in either table as a live product behavior. Reopen
  dynamic distribution only when one of the plan's triggers fires (roughly
  25-40 active skills, measured routing failures a static description can't
  fix, real families repeatedly requesting the same durable procedure, a
  genuine need for canary/A-B skill releases, or deploy cadence becoming the
  bottleneck), and only via a new plan, not by resurrecting the old tools.
  See `docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md`.
- Start repo-authored skills with markdown. Use `defineSkill` only when typed
  or generated sibling files require it.
- A skill description is a routing instruction, not a label. Write
  `Use when...` and name the intent that should load it. Keep the body
  self-contained for future Homa with no memory of the originating session.
- Put the full procedure in the skill: inputs/evidence, decision rules,
  ordered tool calls, examples, quality checks, stop conditions, and what not
  to do. Skills may call existing tools; loading a skill never grants a new
  execution ability.
- Prefer improving an existing overlapping skill over creating a duplicate.
  Do not codify a one-off before the procedure has proved repeatable.
- Shared production skills are tested bundles, not prose dropped into the
  library. Run `pnpm check:fleet-skills` (package hygiene: frontmatter,
  size limits, path safety, slash-menu parity) and add positive and
  adversarial-negative routing fixtures plus an eve behavioral eval when
  correctness depends on model judgment.

### Tool authoring rules

- A tool owns the exact effect and nothing more: typed schema, authenticated
  context, tenant re-scoping, validation, idempotency, rate limits, provider
  calls, durable writes, and a truthful result. The skill owns the workflow.
- Design narrow reusable primitives, not a tool per prompt, screen, skill, or
  REST endpoint. Avoid god tools that hide a whole user journey inside code.
  One tool should be usable by more than one skill when the underlying effect
  is genuinely shared.
- `familyId` never comes from the model or client. Every model-supplied record
  ID is re-scoped inside the authenticated family. The tool result is the
  only truth about whether an action happened.
- Every tool ships bounded: `defineBoundedTool` with a deadline tier, never
  bare `defineTool`. eve (verified through the eve-upgrade-check procedure)
  gives tools no timeout or abort signal, so Homa bounds every tool herself.
  `scripts/tool-deadline-check.mts` and its `TOOL_DEADLINE` tiers are the
  source of truth; `pnpm check:tool-deadlines` is the guard.
- Exact work stays exact even when a skill asks for it: scoring, arithmetic,
  scheduling, consent classification, policy enforcement, database lookup,
  and security boundaries never move into prose.

Before finalizing an agent capability, ask: **Could existing tools perform the
effect if Homa knew the right procedure?** If yes, build the fleet skill.
**Would a plausible model answer be dangerous because there is one correct
result or one authorized side effect?** If yes, build or reuse deterministic
code. Most substantial capabilities should be a fat fleet skill orchestrating
a small set of narrow tools, not a growing pile of workflow-shaped tools.

## Context-file authoring rules

These govern every file that loads into an agent's context: `AGENTS.md`
files, fleet skills, `.agents/skills/`, tool descriptions, and
`apps/web/agent/instructions.md`. Rationale and the 2026-07-24 audit behind them:
`docs/homa-planning/plans/2026-07-24-context-engineering-cleanup.md`.

1. **One home per rule.** A law lives in exactly one canonical file; every
   other mention is a pointer. Tool how-to lives in the tool description,
   multi-tool workflow lives in the skill, identity and laws live in the
   always-on instructions.
2. **A description is a routing instruction.** `Use when <intents>. Not
   for <neighbor>; <sibling> owns that.` The negative scope prevents
   mis-routing.
3. **Schema before prose.** Closed sets are enums, never described
   strings. Every parameter gets `.describe()`. A tool description that
   glosses its own enum values one by one means the schema is
   under-designed.
4. **Constrain with intent plus scar, never lexicon.** A hard never/always
   cites its founder ruling or incident. Without a scar, state the intent
   and trust model judgment. A lexical ban is only legitimate when code
   enforces it (the em-dash runtime law).
5. **Bodies are routers.** A SKILL.md body past roughly 200 lines splits
   into a skill's `references/` subdirectory, loaded by intent. Directory-scoped gotchas go
   in that directory's `AGENTS.md`, not the root file.
6. **Rich references over transcription.** Point at the real artifact (a
   live JSON file, a golden anchor, a fixture, a component path) instead
   of embedding a copy that can drift.
7. **Retire loudly, then delete.** Mark a dead skill retired with a banner
   routing to its successors, then delete it; git is the archive.
8. **Never hand-maintain what a command can list.** Counts and file
   indexes in prose go stale silently; instruct listing them live.

## Commands

- Install: `pnpm install`
- Dev (all packages): `pnpm dev`, or one package: `pnpm --filter web dev`
- Mobile app (not part of `pnpm dev` on purpose; it needs a simulator): `pnpm --filter mobile ios` (or `android`, `start`); setup in `apps/mobile/README.md`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- ChildProgress guards: `pnpm check:child-progress` for core events, default
  module tests, walk events, and reconciliation; `pnpm check:progress-ui` for
  focused route and card tests; and `pnpm child-progress:e2e` for the
  disposable local PostgreSQL harness. The E2E command creates and removes its
  own cluster and needs no remote credentials.
- Required guards, named here because they run BEFORE a change (CI is too late for them): `pnpm check:isolation` (tenant isolation, run before any schema/query change), `pnpm check:migration-versions` (unique Supabase migration versions, run before any migration change), `pnpm check:map` (bank content + scorer), `pnpm check:events` (MJ-08 registry parity), `pnpm check:fleet-skills` (fleet-skill package hygiene, reference integrity, and slash-menu parity), and `pnpm check:taxonomy` (skill graph integrity: mapping completeness, ID law, DAG). For the full check roster, enumerate `.github/workflows/ci.yml` rather than any hand-copied list
- Local eval runs (`eve eval` in apps/web) are isolated by default:
  evals.config.ts strips durable-write credentials from the eval process
  (apps/web/lib/eval-isolation.ts), so passing evals no longer write
  telemetry rows or Blob PDFs into production. Prefer `pnpm eval:sandbox
  [eve-eval-args]`: it boots a disposable local Postgres with every
  migration applied plus a throwaway artifact store, seeds the Walker
  eval fixture family, and stamps eval sessions family-pinned on it
  (apps/web/lib/family-context-eval-fixture.ts), so DB and blob-backed
  family tools succeed for real instead of failing closed.
  `HOMA_EVAL_ALLOW_PROD_WRITES=1` is the explicit, loudly logged opt-out.
  Guard: `pnpm check:eval-isolation`.
- Documentation reconciliation: `pnpm check:docs -- --allow-open` during the audit and `pnpm check:docs` for the zero-open completion gate
- Conversation continuity tests: `pnpm check:continuity` when changing the continuity module or a channel adapter
- Before ANY eve version bump, no exceptions: `node scripts/eve-upgrade-check.mjs` (procedure: `docs/homa-planning/runbooks/eve-version-bump.md`)
- CI (`.github/workflows/ci.yml`) is configured for pushes to `main` and pull requests targeting `main`. It runs typecheck, lint, and the required guards above (including the temporary dormant-window guard while Phase C is open), plus ChildProgress, Progress UI, and the disposable ChildProgress PostgreSQL E2E. The Next and eve builds run in CI on main pushes only; on pull requests they are carried by Vercel's preview deployment, whose "Vercel" status check is REQUIRED on main alongside `build-and-check` (founder ruling 2026-07-31, `ci-pr-build-via-vercel`). Confirm the actual workflow result before describing CI as green.

## Deploys & migrations

- Prod schema and prod code ship together. Never apply a breaking migration (a rename, a drop, a tightened constraint) ahead of the deploy that reads it: push the code, watch the Vercel deploy go READY, then apply the migration, or use expand-contract (add the new shape, dual-read, drop the old later). Additive-only migrations may lead. Cause: the 2026-07-10 /app outage (build-log entry) was the previous deploy reading a renamed column.
- A green `pnpm build` is not a green deploy: Vercel also runs `eve build` outside Next's bundler. The local pre-push checks for `apps/web/agent/` changes live in `apps/web/AGENTS.md`.
- After any push that touches schema or the deploy pipeline, stay until the Vercel deployment is READY and probe the live site before calling it done.
- ChildProgress rollout order and rollback are in `BUILD.md` § ChildProgress rollout order; follow it exactly, flag-first both directions.

## Production bugs

- Fixed, not stored (founder ruling 2026-07-14, `prod-bugs-fixed-not-stored`): a bug that is confirmed or strongly suspected live in production, whether found by a user report, a probe, logs, a simulation, or a field study, gets fixed, deployed, and verified live in the same session that finds it. Writing it into a study, plan, backlog, or ticket records a shipped fix; it is never a substitute for one.
- If the fix truly cannot ship now (missing access, correct behavior needs a founder ruling, change too large to be safe), drop other work and put the failure in front of the founder in your reply, plainly labeled as a live production failure with the user-facing symptom. A "recommendation" or "suggested fix" row is not an escalation.
- Findings documents carry status on every production bug: FIXED plus the commit hash, or an explicit escalation timestamp. Cause: BUG-P1-1 (2026-07-13) sat fully diagnosed in a field study as recommendation R1 for hours while every new family's report page and emailed link hung in production; the shipped fix was two ::uuid casts (7bf394c) that took minutes once treated as an outage instead of a finding.

## Tickets and issue tracking (founder directive 2026-07-25)

GitHub Issues on `sidneyswift/homa` is the single live tracker for all open
work: features, bugs, chores, investigations, and anything waiting on the
founder. `HUMAN-TODO.md` no longer exists (its history is preserved in
`docs/homa-planning/history/2026-07-11-human-todo-archive.md`); no plan doc,
status header, or session memory is a substitute for an issue.

- **Docs are the spec and evidence layer; issues are the tracking layer.**
  An issue links to its plan or evidence doc for depth. Status, priority,
  and ownership live on the issue. Never fork a spec into an issue body,
  and never leave open work only in a doc.
- **Labels.** Exactly one type per issue: `bug`, `feature`, `chore`, or
  `investigation`. One priority: `P0` (drop everything: live failure or
  hard deadline), `P1` (next up), `P2` (later). Add `production` when the
  failure is confirmed or suspected live. Add `founder-decision` (needs a
  ruling) or `founder-action` (only the founder can do it: logins,
  payments, external accounts) when blocked on the founder.
- **Filing.** Use `gh issue create`. Keep an existing series ID in the
  title when one exists ("CG-05: ..."); new work needs no series ID, the
  issue number is the ID. A body carries the source or spec link, a 2 to 4
  sentence summary, and acceptance criteria. A grouped issue with a task
  list is fine for one doc's decision set or a small fix bundle.
- **Lifecycle.** PRs that resolve an issue say `Closes #N`. Close only
  with evidence: a merged PR, a probe result, or a recorded ruling; never
  on intention. A session that files, advances, or finishes tracked work
  updates the issue in that same session.
- **The production-bugs ruling is unchanged.** A live prod bug is fixed in
  the session that finds it or plainly escalated; an issue records the fix
  or the escalation and never substitutes for either.
- **Founder decisions.** When a `founder-decision` issue is ruled, record
  the ruling where rulings live (`journeys/10-reconciliation.md` §5 and
  the build-log), then close the issue pointing at the ruling. The issue
  tracks that a decision is pending; it is never the ruling's home.
- **Historical registries stay historical.** `03-backlog.md` (M/MJ IDs)
  and the dated ticket docs in `plans/` keep their IDs as provenance; do
  not bulk-import them. When an M/MJ item becomes active, file an issue
  referencing the ID. The reconciliation claim ledger accepts `gh#N`
  ticket tokens (`scripts/docs-reconciliation-check.mjs`).

## Code style & voice

Repository lane ownership, inventory, preservation, worktree removal, branch
cleanup, pull request decisions, and task closeout follow the canonical
[repository operating system](docs/homa-planning/runbooks/repository-operating-system.md).
Do not restate that lifecycle in another context file.

- No em dash, ever, anywhere (code comments, UI copy, docs, commit messages). Use a comma, period, colon, or mid-dot instead.
- The name is always written "Homa". Never type "HOMA". The logo is the logo: where the brand appears as a mark, render the real `Logo` component (`apps/web/components/brand/Logo.tsx`, which spells "Homa"), never a hand-typed imitation of it. Founder correction 2026-07-28, `brand-casing-homa`, which retires global D8's old "HOMA on UI surfaces" wording.
- Sentence case, no red/"behind" framing about a child, never compare siblings, never a verdict on a child. She decides and Homa suggests: recommend plainly, never issue an order, never hedge into mush.
- **Clear AND memorable; boring is a failure state** (founder ruling 2026-07-29, `copy-voice-memorable`, which overturns the 2026-07-08 `copy-clarity` law that ranked clarity above personality). Clarity is the floor, not the ceiling. Order when they conflict: true, then clear, then memorable, then short. Be funny when it is actually funny, never as a bolted-on bit. Say the real thing, then be kind about it: charm over cruelty, never sugarcoating over charm. Images and emoji are judged on whether they beat the plain sentence, not rationed by quota. Still banned: metaphor stacks, meta-commentary, and cutting words that carry meaning just to be shorter. The full rulebook is `.agents/skills/homa-copy-writer/SKILL.md`; gate important copy with `homa-copy-reviewer` then `homa-copy-editor`.
- Imports stay at the top of the file, no inline imports.

## Design system

UI and copy work uses the Quiet authority contract in `packages/design/src/contract/`. The normative human doctrine is `docs/homa-design/doctrine.md`, the longer guide is `docs/homa-design/readme.md`, the workflow is `docs/homa-design/SKILL.md`, and [`DESIGN.md`](DESIGN.md) is a generated summary whose checksum must stay in sync. Web and native currently project a frozen legacy layer from `globals.css`, `layout.tsx`, `apps/web/components/brand/Logo.tsx`, `apps/mobile/src/theme/tokens.ts`, and `apps/mobile/src/components/brand/logo.tsx`; those files are migration targets owned by #720 and #724, not authorities. Generate projections with `pnpm build:design-contract`, then run `pnpm check:design-contract` and `pnpm check:design-parity`. Do not add new colors, type, geometry, or motion outside the contract. Changes to `packages/design/src/contract/` require regenerated outputs, the brand-surface manifest, and the relevant surface evidence.

## Model gateway credentials

Homa authenticates every model call with **Vercel OIDC**, never an AI
Gateway API key (founder ruling 2026-07-27). There is no
`AI_GATEWAY_API_KEY` in this project's environments, so do not add one,
do not suggest creating one, and do not write a code path or workflow
that falls back to one. Application code tolerates either variable, and
that tolerance is not a reason to introduce the key.

- **Locally:** `VERCEL_OIDC_TOKEN` in `apps/web/.env.local`, refreshed by
  `pnpm dev:token` (`scripts/refresh-oidc-token.mjs`). It lives roughly
  twelve hours, so an expired token is the first thing to check when
  model calls start failing on a machine that worked yesterday. Never
  refresh it with a bare `vercel env pull`: that rewrites `.env.local`
  wholesale from the small development environment and takes the whole
  fifty-plus-variable local file with it. The script exists for that.
- **In CI:** one secret, a long-lived `VERCEL_TOKEN`, and the job mints a
  fresh OIDC token per run (`.github/workflows/evals.yml`). The org and
  project IDs are inlined in the workflow, not stored: they name a
  project and grant nothing, and `apps/web/.vercel` is gitignored so a
  checkout cannot read them. Never store `VERCEL_OIDC_TOKEN` itself as a
  CI secret: it works the day it is added and fails every morning after,
  looking like a code problem rather than an expired token.
- **On Vercel:** OIDC is ambient, nothing to configure.

Cause: re-litigated repeatedly, most recently 2026-07-27, when wiring
evals into CI produced a workflow demanding a gateway key this project
does not use plus a recommendation to go create one.

## Security & boundaries

- Never read from or write to `homa-macmini/`, `homa-research/`, `homa-template/`: untracked, contain live secrets and family data, or are read-only reference. Product code ports FROM `homa-template/` deliberately, never edits it in place.
- Never commit secret-bearing environment files, `*.local`, `**/*.key`, or `**/*.crt`. The two tracked `.env.example` templates are documentation and contain names and safe placeholders only.
- Never hand-edit `packages/design/generated/*` or the generated front matter in `DESIGN.md`. Change `packages/design/src/contract/`, run `pnpm build:design-contract`, then prove clean-directory parity with `pnpm check:design-parity`.
- Tenant isolation is load-bearing and non-negotiable: `familyId` never comes from model or client choice, every tool re-scopes every model-supplied ID, browser sessions use the caller's JWT with RLS, and server-originated channels use authenticated family mappings plus family-pinned libraries. Ticket M1-02 owns the remaining non-service-role plus transaction-local `SET LOCAL` hardening. Run the isolation guard before schema or query changes. Full law list: `BUILD.md` § Non-negotiable laws.

## How we think: reflective inquiry

When a product problem is ambiguous (a metric moved without explanation, a
feature is requested, research sounds positive, a launch surprised us), do
not treat the first plausible story as the conclusion. Read
`.agents/skills/reflective-inquiry/SKILL.md` and run its inquiry loop
before committing to a diagnosis, roadmap bet, or fix.

## When unsure

Explicit founder rulings take precedence over the PRD, the PRD takes precedence over journey documents, and journey documents take precedence over judgment. The canonical founder-ruling index is `docs/homa-planning/journeys/10-reconciliation.md` §5, including its later-ruling register. Code, tests, configuration, migrations, and direct production evidence establish observed behavior but do not silently change policy. If authoritative sources still conflict, stop and ask rather than inventing policy, then append the decision to `docs/homa-planning/build-log.md` and update the founder-ruling index.
