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
  correctness depends on model judgment. `pnpm check:skills-targeting`
  still runs in CI as a regression guard on the retired
  targeting/merge logic through the dormant window; it is not a live
  product check.

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
- Required guards, named here because they run BEFORE a change (CI is too late for them): `pnpm check:isolation` (tenant isolation, run before any schema/query change), `pnpm check:map` (bank content + scorer), `pnpm check:events` (MJ-08 registry parity), `pnpm check:fleet-skills` (fleet-skill package hygiene, reference integrity, and slash-menu parity), `pnpm check:skills-targeting`, and `pnpm check:taxonomy` (skill graph integrity: mapping completeness, ID law, DAG). For the full check roster, enumerate `.github/workflows/ci.yml` rather than any hand-copied list
- Temporary through the fleet-skills dormant window only (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md Phase C, opens 2026-07-15, earliest close 2026-07-22): `pnpm check:fleet-skills-dormant` proves the retired dynamic-skill files stay deleted and nothing outside an explicit allowlist queries `family_skills`/`skill_bank`. Retire this check together with `check:skills-targeting` once Phase C closes and a founder reviews the evidence; do not treat either as a permanent fixture of "how skills work here."
- Local eval runs (`eve eval` in apps/web) are isolated by default:
  evals.config.ts strips durable-write credentials from the eval process
  (apps/web/lib/eval-isolation.ts), so passing evals no longer write
  telemetry rows or Blob PDFs into production. Prefer `pnpm eval:sandbox
  [eve-eval-args]`: it boots a disposable local Postgres with every
  migration applied plus a throwaway artifact store, so DB and
  blob-backed tools succeed for real instead of failing closed.
  `HOMA_EVAL_ALLOW_PROD_WRITES=1` is the explicit, loudly logged opt-out.
  Guard: `pnpm check:eval-isolation`.
- Documentation reconciliation: `pnpm check:docs -- --allow-open` during the audit and `pnpm check:docs` for the zero-open completion gate
- Conversation continuity tests: `pnpm check:continuity` when changing the continuity module or a channel adapter
- Before ANY eve version bump, no exceptions: `node scripts/eve-upgrade-check.mjs` (procedure: `docs/homa-planning/runbooks/eve-version-bump.md`)
- CI (`.github/workflows/ci.yml`) is configured for pushes to `main` and pull requests targeting `main`. It runs typecheck, lint, the required guards above (including the temporary dormant-window guard while Phase C is open), the Next build, and the eve build. It also runs ChildProgress, Progress UI, and the disposable ChildProgress PostgreSQL E2E. Confirm the actual workflow result before describing CI as green.

## Deploys & migrations

- Prod schema and prod code ship together. Never apply a breaking migration (a rename, a drop, a tightened constraint) ahead of the deploy that reads it: push the code, watch the Vercel deploy go READY, then apply the migration, or use expand-contract (add the new shape, dual-read, drop the old later). Additive-only migrations may lead. Cause: the 2026-07-10 /app outage (build-log entry) was the previous deploy reading a renamed column.
- A green `pnpm build` is not a green deploy: Vercel also runs `eve build` outside Next's bundler. The local pre-push checks for `apps/web/agent/` changes live in `apps/web/AGENTS.md`.
- After any push that touches schema or the deploy pipeline, stay until the Vercel deployment is READY and probe the live site before calling it done.
- ChildProgress rollout order and rollback are in `BUILD.md` § ChildProgress rollout order; follow it exactly, flag-first both directions.

## Production bugs

- Fixed, not stored (founder ruling 2026-07-14, `prod-bugs-fixed-not-stored`): a bug that is confirmed or strongly suspected live in production, whether found by a user report, a probe, logs, a simulation, or a field study, gets fixed, deployed, and verified live in the same session that finds it. Writing it into a study, plan, backlog, or ticket records a shipped fix; it is never a substitute for one.
- If the fix truly cannot ship now (missing access, correct behavior needs a founder ruling, change too large to be safe), drop other work and put the failure in front of the founder in your reply, plainly labeled as a live production failure with the user-facing symptom. A "recommendation" or "suggested fix" row is not an escalation.
- Findings documents carry status on every production bug: FIXED plus the commit hash, or an explicit escalation timestamp. Cause: BUG-P1-1 (2026-07-13) sat fully diagnosed in a field study as recommendation R1 for hours while every new family's report page and emailed link hung in production; the shipped fix was two ::uuid casts (7bf394c) that took minutes once treated as an outage instead of a finding.

## Code style & voice

- No em dash, ever, anywhere (code comments, UI copy, docs, commit messages). Use a comma, period, colon, or mid-dot instead.
- "Homa" in prose and conversation; "HOMA" in the wordmark and on UI surfaces, per global founder ruling D8.
- Sentence case, reassure-before-inform, offers never commands, no red/"behind" framing, never compare siblings.
- Clarity and low cognitive load beat personality (founder ruling 2026-07-08). One idea per sentence, plain names for things, no metaphor stacks, no meta-commentary. Fewer words is NOT the goal: cutting words that carry meaning makes copy harder, not easier. The full rulebook is `.agents/skills/homa-copy-writer/SKILL.md`; gate important copy with `homa-copy-reviewer` then `homa-copy-editor`.
- Imports stay at the top of the file, no inline imports.

## Design system

UI and copy work should use Homa's existing design system, never invent new colors, type, or components. Source of truth: `docs/homa-design/` (start at its `SKILL.md`, then `readme.md`). A spec-compliant token summary for design tooling lives at [`DESIGN.md`](DESIGN.md). Web currently hand-copies tokens, fonts, and the `Logo` component into `globals.css`, `layout.tsx`, and `apps/web/components/brand/Logo.tsx`. Mobile does the same in `apps/mobile/src/theme/tokens.ts` and `apps/mobile/src/components/brand/logo.tsx`. These copies remain temporary until `packages/design` lands under ticket M1-17. If `docs/homa-design/` tokens change, update those files and `DESIGN.md`'s front matter too, so nothing drifts.

## Security & boundaries

- Never read from or write to `homa-macmini/`, `homa-research/`, `homa-template/`: untracked, contain live secrets and family data, or are read-only reference. Product code ports FROM `homa-template/` deliberately, never edits it in place.
- Never commit secret-bearing environment files, `*.local`, `**/*.key`, or `**/*.crt`. The two tracked `.env.example` templates are documentation and contain names and safe placeholders only.
- Never hand-edit generated files: `docs/homa-design/_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`.
- Tenant isolation is load-bearing and non-negotiable: `familyId` never comes from model or client choice, every tool re-scopes every model-supplied ID, browser sessions use the caller's JWT with RLS, and server-originated channels use authenticated family mappings plus family-pinned libraries. Ticket M1-02 owns the remaining non-service-role plus transaction-local `SET LOCAL` hardening. Run the isolation guard before schema or query changes. Full law list: `BUILD.md` § Non-negotiable laws.

## How we think: reflective inquiry

When a product problem is ambiguous (a metric moved without explanation, a
feature is requested, research sounds positive, a launch surprised us), do
not treat the first plausible story as the conclusion. Read
`.agents/skills/reflective-inquiry/SKILL.md` and run its inquiry loop
before committing to a diagnosis, roadmap bet, or fix.

## When unsure

Explicit founder rulings take precedence over the PRD, the PRD takes precedence over journey documents, and journey documents take precedence over judgment. The canonical founder-ruling index is `docs/homa-planning/journeys/10-reconciliation.md` §5, including its later-ruling register. Code, tests, configuration, migrations, and direct production evidence establish observed behavior but do not silently change policy. If authoritative sources still conflict, stop and ask rather than inventing policy, then append the decision to `docs/homa-planning/build-log.md` and update the founder-ruling index.
