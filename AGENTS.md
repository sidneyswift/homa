# AGENTS.md

## Project overview

Homa is a multi-tenant AI homeschool assistant built as a pnpm and Turborepo monorepo. The web product and eve agent share one Next.js deployment, durable state lives in Supabase Postgres, and billing uses Stripe. The July 13, 2026 conference remains the fixed launch deadline. Do not infer production state from repository presence alone; use the reconciliation production evidence and a fresh deployment probe.

**Read next, in order:** [`BUILD.md`](BUILD.md) (the engineering entry point: reading order, build phases, non-negotiable laws) → [`docs/homa-planning/13-mr-prd.md`](docs/homa-planning/13-mr-prd.md) (the product contract). For the repo's file-by-file layout, see [`README.md`](README.md)'s Repo map.

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
the whole fleet, optionally targeted to relevant families. `family_skills`
are family-owned product data created at runtime when one parent teaches Homa
a family-specific procedure through `save_skill`. They are not a place for a
coding agent to implement a product feature. Agents may improve the
`family_skills` infrastructure, but they must not seed, copy, or use
family-scoped rows as the delivery mechanism for fleet behavior.

Read `docs/homa-planning/15-agentic-architecture.md` §2 for the binding
placement ruling. `docs/homa-planning/plans/2026-07-13-agent-frontier-review.md`
records the research comparison behind this rule.

### Choose the right layer

| Put it in | Use it for | Homa examples |
|---|---|---|
| **Fleet Eve skill** | The hard part is judgment or a reusable procedure: how to reason, choose an approach, sequence existing tools, judge quality, handle variants, or know when to stop. A better model should improve the result without changing code. | `materials-studio` decides difficulty, chooses image/HTML/hybrid, calls the material tools, reviews, revises, and finalizes. `research-brief` selects one family-relevant angle and sequences research, recall, and progress tools. |
| **Eve tool / deterministic code** | The result or effect must be exact, typed, authenticated, tenant-scoped, idempotent, rate-limited, auditable, or impossible to hallucinate. The model needs an ability it does not currently have. | `manage_child_progress`, `create_printable`, `remember`, `send_followup_email`, database queries, scoring, date math, Blob writes, provider calls. |
| **Skill + tool** | The capability needs both judgment and a missing exact effect. The skill owns the complete workflow; the tool is the smallest reusable deterministic leaf. | A curriculum-fit skill may use existing recall/web tools plus one narrow catalog lookup tool. Do not turn the whole curriculum-fit workflow into one god tool. |
| **Always-on or dynamic instructions** | The rule must apply before any skill can load, or the data must be fresh every turn. Keep capability-specific procedures out. | Homa's identity, voice, tenancy and tool-honesty laws stay in `agent/instructions.md`; SMS-only behavior stays in `agent/instructions/sms-mode.ts`; family/progress context is rebuilt on `turn.started`. |
| **Postgres / Blob / `defineState`** | Durable product truth / durable artifacts / session-only working state. | Family facts and skills in Postgres, PDFs in Blob, a session counter in `defineState`. Never use a skill body, conversation history, or sandbox file as load-bearing state. |
| **Channel / schedule / UI / subagent** | Transport authentication and delivery / clock-driven activation / parent-visible interaction / genuinely isolated context or privileges. | A new messaging surface is a channel, not a tool. A weekday wake-up is a schedule. Use a subagent only when it needs a different prompt, model, context window, or restricted tool surface; use a skill when optional procedure is enough. |

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

- Fleet skills have two deliberate implementation forms. Choose between them
  based on distribution and release needs:
  - **Repo-authored fleet skill:** Homa-wide craft that ships with code,
    lives at `apps/web/agent/skills/<name>/SKILL.md`, is versioned in git,
    and loads at runtime through eve. Use this for stable product craft,
    especially when the skill has supporting references, assets, or scripts.
  - **Fleet skill-bank skill:** founder-curated shared craft in `skill_bank`
    that loads at runtime through `agent/skills/skill-library.ts`, can target
    families by age/capability tags, and can be unpublished fleet-wide
    without a deploy. Use this when targeted runtime distribution is the
    product requirement. Publishing requires founder review, provenance,
    targeting, and a fleet-wide rollback path.
- `family_skills` is not a third implementation choice for builders. It
  contains parent-taught, family-specific procedures written by Homa through
  `save_skill`. A repeated family pattern may become a candidate fleet skill
  only after it is generalized, stripped of family details, reviewed by the
  founder, and placed in one of the two fleet forms above.
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
  library. Update `pnpm check:skills-targeting` for targeting and merge
  behavior, add positive and adversarial-negative routing fixtures, and add
  an eve behavioral eval when correctness depends on model judgment.

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
- Exact work stays exact even when a skill asks for it: scoring, arithmetic,
  scheduling, consent classification, policy enforcement, database lookup,
  and security boundaries never move into prose.

Before finalizing an agent capability, ask: **Could existing tools perform the
effect if Homa knew the right procedure?** If yes, build the fleet skill.
**Would a plausible model answer be dangerous because there is one correct
result or one authorized side effect?** If yes, build or reuse deterministic
code. Most substantial capabilities should be a fat fleet skill orchestrating
a small set of narrow tools, not a growing pile of workflow-shaped tools.

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
- Required guards: `pnpm check:isolation` (tenant isolation, run before any schema/query change), `pnpm check:map` (bank content + scorer), `pnpm check:events` (MJ-08 registry parity), `pnpm check:skills-targeting`, and `pnpm check:taxonomy` (skill graph integrity: mapping completeness, ID law, DAG)
- Documentation reconciliation: `pnpm check:docs -- --allow-open` during the audit and `pnpm check:docs` for the zero-open completion gate
- Conversation continuity tests: `pnpm check:continuity` when changing the continuity module or a channel adapter
- Before ANY eve version bump, no exceptions: `node scripts/eve-upgrade-check.mjs` (procedure: `docs/homa-planning/runbooks/eve-version-bump.md`)
- CI (`.github/workflows/ci.yml`) is configured for pushes to `main` and pull requests targeting `main`. It runs typecheck, lint, the five required guards, the Next build, and the eve build. It also runs ChildProgress, Progress UI, and the disposable ChildProgress PostgreSQL E2E. Confirm the actual workflow result before describing CI as green.

## Deploys & migrations

- Prod schema and prod code ship together. Never apply a breaking migration (a rename, a drop, a tightened constraint) ahead of the deploy that reads it: push the code, watch the Vercel deploy go READY, then apply the migration, or use expand-contract (add the new shape, dual-read, drop the old later). Additive-only migrations may lead. Cause: the 2026-07-10 /app outage (build-log entry) was the previous deploy reading a renamed column.
- A green `pnpm build` is not a green deploy. Vercel also runs `eve build`, which compiles agent tool modules outside Next's bundler, so imports Next tolerates (`next/server`, JSON loaders) can still sink the deploy. CI runs it now; before pushing changes under `apps/web/agent/`, run `pnpm --filter web exec eve build` locally.
- After any push that touches schema or the deploy pipeline, stay until the Vercel deployment is READY and probe the live site before calling it done.
- ChildProgress rollout starts with `HOMA_LIVE_PROGRESS_ENABLED` false. Deploy
  code and verify READY plus legacy paths first. Then apply the additive
  migration, run `pnpm progress:reconcile -- --dry-run` and the real
  reconciliation with an explicit database URL, enable the flag, and probe
  authenticated Progress, token reports, corrections, and linked SMS.
  Rollback turns the flag off first and leaves the additive ledger intact.

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

UI and copy work should use Homa's existing design system, never invent new colors, type, or components. Source of truth: `docs/homa-design/` (start at its `SKILL.md`, then `readme.md`). A spec-compliant token summary for design tooling lives at [`DESIGN.md`](DESIGN.md). Web currently hand-copies tokens, fonts, and the `Logo` component into `globals.css`, `layout.tsx`, and `components/brand/Logo.tsx`. Mobile does the same in `src/theme/tokens.ts` and `src/components/brand/logo.tsx`. These copies remain temporary until `packages/design` lands under ticket M1-17. If `docs/homa-design/` tokens change, update those files and `DESIGN.md`'s front matter too, so nothing drifts.

## Security & boundaries

- Never read from or write to `homa-macmini/`, `homa-research/`, `homa-template/`: untracked, contain live secrets and family data, or are read-only reference. Product code ports FROM `homa-template/` deliberately, never edits it in place.
- Never commit secret-bearing environment files, `*.local`, `**/*.key`, or `**/*.crt`. The two tracked `.env.example` templates are documentation and contain names and safe placeholders only.
- Never hand-edit generated files: `docs/homa-design/_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`.
- Tenant isolation is load-bearing and non-negotiable: `familyId` never comes from model or client choice, every tool re-scopes every model-supplied ID, browser sessions use the caller's JWT with RLS, and server-originated channels use authenticated family mappings plus family-pinned libraries. Ticket M1-02 owns the remaining non-service-role plus transaction-local `SET LOCAL` hardening. Run the isolation guard before schema or query changes. Full law list: `BUILD.md` § Non-negotiable laws.

## When unsure

Explicit founder rulings take precedence over the PRD, the PRD takes precedence over journey documents, and journey documents take precedence over judgment. The canonical founder-ruling index is `docs/homa-planning/journeys/10-reconciliation.md` §5, including its later-ruling register. Code, tests, configuration, migrations, and direct production evidence establish observed behavior but do not silently change policy. If authoritative sources still conflict, stop and ask rather than inventing policy, then append the decision to `docs/homa-planning/build-log.md` and update the founder-ruling index.
