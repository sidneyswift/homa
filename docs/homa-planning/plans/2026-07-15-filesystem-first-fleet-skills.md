# Filesystem-first fleet skills · technical decision and implementation plan

> **Status:** TECHNICAL PLAN, NOT YET AUTHORIZED FOR CUTOVER. The founder
> supplied the decision in the 2026-07-15 session: choose YAGNI, use one
> filesystem home for fleet skills, stop the unfinished database skill
> system, and revisit dynamic distribution only after real scale or routing
> evidence demands it. The canonical founder-ruling register still describes
> two fleet-skill forms. Step 0 is to register this superseding decision before
> implementation begins.
>
> **Goal:** Make `apps/web/agent/skills/<name>/` the only active source of
> fleet expertise, preserve family-specific personalization in memories and
> child profiles, and remove database-authored skills from Homa's runtime
> without losing existing data.
>
> **Why now:** Homa has two repo fleet skills, two published `skill_bank`
> procedures, and one observed `family_skills` row. Homa has conversational
> save/update/delete tools and slash-menu discovery, but no dedicated skill
> management screen and no measured repeated usage that validates the family
> skill product. There is also no evidence that four skill descriptions create
> meaningful context cost or routing confusion. A dynamic package registry
> would add a package-management and security system before the product has
> the usage needed to design it correctly.
>
> **Authorized scope after registration:** Phases A through C only: preserve
> data, package fleet procedures, stop new family-skill writes, cut runtime
> reads to filesystem packages, and observe the dormant database. Phase D,
> deleting either table, is a separate future project requiring a new founder
> ruling.
>
> **Authority:** `BUILD.md` and the founder-ruling register remain higher
> authority. This plan does not claim implementation or deployment.

## 1. Decision

After the superseding ruling is registered, Homa will use one active
fleet-skill form:

```text
apps/web/agent/skills/<skill-name>/
├── SKILL.md
├── references/        optional
├── assets/            optional
├── scripts/           optional
└── evals/             optional source fixtures; Eve eval files remain top-level
```

Eve discovers these packages at build time, advertises their descriptions,
and exposes its built-in `load_skill` tool. The model loads the full
`SKILL.md` only when a request matches. Sibling files remain outside the
prompt until the model or an authored tool reads them.

The database is not an active fleet-skill authoring or delivery system:

- `skill_bank` becomes dormant after its two procedures are moved into Git.
- `family_skills` remains preserved as historical product data and accepts no
  new writes. Stopping the existing row from affecting Homa is a user-visible
  behavior change. Phase B is blocked until the founder explicitly accepts
  that loss or the originating family reviews a safe distillation into
  memories/profile data.
- `save_skill` and `forget_skill` are disabled.
- `agent/skills/skill-library.ts` is removed after the database readers are
  no longer needed.
- Existing family preferences continue through `family_memories`,
  `children.profile`, and the per-turn family context block.

This is a deliberate simplification, not a claim that dynamic Eve skills are
invalid. Eve supports full runtime-created packages. Homa does not need the
publishing, versioning, targeting, and rollback system required to operate
them safely yet.

## 2. Product and engineering laws

1. **Fleet means shared.** Coding agents build capabilities that can help the
   whole fleet. They do not implement product features as `family_skills`
   rows.
2. **Judgment lives in skills.** Decision trees, examples, quality criteria,
   tool sequencing, and stop conditions belong in `SKILL.md`.
3. **Exact effects stay in tools.** Authentication, tenant scoping, database
   reads and writes, rendering, delivery, rate limits, and deterministic
   calculations remain narrow tools or ordinary code.
4. **Personalization is data, not a forked fleet procedure.** The same fleet
   skill reads family context and chooses the correct age, child, curriculum,
   interest, and homeschool-style branch.
5. **No family data enters fleet packages.** Examples use synthetic names and
   generic situations.
6. **A skill package is tested.** Prose alone is not a production capability.
7. **Loading does not grant authority.** Sibling scripts remain inert because
   Homa disables framework `bash` and `write_file`. A trusted authored tool is
   required for any exact execution.

## 3. Current state

### 3.1 Repo-authored fleet skills

```text
apps/web/agent/skills/materials-studio/SKILL.md
apps/web/agent/skills/research-brief/SKILL.md
```

`skill-library.ts` is not a skill body. It is a dynamic resolver that reads
database rows and turns them into Eve skills on `turn.started`.

### 3.2 Database fleet skills

`public.skill_bank` contains:

- `name`
- `description`
- `markdown`
- age bounds
- substring targeting tags
- `published`
- `provenance`
- timestamps

Two published rows were observed on 2026-07-14:

- `letter-sounds-worksheets`
- `counting-worksheets`

The bodies must be exported and reviewed before runtime reads are removed.
Repository migrations do not prove the current production body text.

### 3.3 Family skills

`public.family_skills` contains parent/family-scoped markdown procedures.
`save_skill` and `forget_skill` write this table. The dynamic resolver merges
family and bank rows by name, with the family row winning.

This surface currently has three problems:

1. Authenticated members can write the table directly through RLS and bypass
   the app's injection scan and 20-row cap.
2. A family row can shadow a fleet or authored skill name.
3. Updates overwrite the previous body with no version history.

The one observed family row must be preserved before writes and runtime
loading are disabled. This plan does not delete or silently convert it.

## 4. Target package standard

### 4.1 Required `SKILL.md`

Every packaged fleet skill includes:

```yaml
---
description: Use when the parent asks for ...
---
```

The body must contain:

1. Trigger and scope.
2. Inputs and evidence hierarchy.
3. Decision rules.
4. Ordered tool use.
5. Quality criteria.
6. Examples and counterexamples.
7. Stop conditions and honest failure behavior.
8. Safety and privacy constraints.
9. What the skill does not do.

Descriptions are routing instructions, not labels. Each starts with
`Use when...` and names one clear intent branch.

### 4.2 Sibling files

- `references/`: detailed rubrics, source summaries, examples, and lookup
  tables that are useful after activation but too large for `SKILL.md`.
- `assets/`: small reviewed images, templates, fonts, or binary fixtures.
- `scripts/`: deterministic helpers. Packaging does not authorize execution.
- `evals/`: source fixtures co-located for maintainers. Eve's executable
  `*.eval.ts` files remain under the app's top-level `evals/` directory.

`SKILL.md` should remain under the Agent Skills recommendation of 500 lines
and 5,000 tokens where practical. Large details move one level down into
references; references do not create nested reference chains.

### 4.3 Package identity

The directory name is the stable skill identity. There is no duplicate
`name` field.

A package version is the Git commit plus a deterministic digest of all
package-relative paths and bytes. The package doctor computes SHA-256 from the
sorted sequence of `relative-path NUL byte-length NUL content-bytes`. The Git
commit provides history; the digest proves the package that tests and probes
used.

## 5. Migrating the two bank procedures

### 5.0 Authority and inventory gate

Before reading or changing production skill data:

1. Register the superseding filesystem-only fleet-skill ruling in
   `docs/homa-planning/journeys/10-reconciliation.md` with this dated session
   as its source.
2. Record in `docs/homa-planning/build-log.md` that family-skill creation is
   paused and that disabling the existing row's runtime effect requires a
   second explicit disposition.
3. Verify the live row counts and columns. The 2026-07-14 observation was two
   published bank rows and one family row; that is evidence, not a permanent
   assumption.
4. Assign one disposition to every bank row: new package, absorbed into an
   existing package, retained temporarily, or rejected. Record owner,
   rationale, routing lane, behavior retained, and founder approval.
5. Stop and obtain the family-row disposition: preserve dormant behavior as
   historical data, or distill it with the originating family's review. No
   automatic conversion is allowed.

### 5.1 Lossless export and sanitized review copy

Create two different artifacts:

1. **Raw rollback archive:** every column and row from `skill_bank` and
   `family_skills`, including IDs, family IDs, publication state, provenance,
   source, and timestamps. Serialize canonical JSONL ordered by primary key.
   Write it to a private Vercel Blob path:
   `internal/skill-archives/<UTC timestamp>/`. Store one SHA-256 per file plus
   a manifest containing schema column lists, row counts, database project
   reference, exporter Git commit, and export timestamp. The Blob remains
   private, accessible only through the server Blob credential, and is kept
   through the dormant window plus 90 days. Before cutover, restore both files
   into a disposable Postgres cluster and prove row counts and hashes match.
2. **Sanitized review copy:** name, description, markdown, targeting,
   provenance, and updated timestamp with family identifiers removed. Keep it
   in an ignored local review directory. This copy may inform package
   authoring but can never serve as rollback evidence.

Use a founder-authorized, read-only production query to export:

- name
- description
- markdown
- targeting metadata
- provenance
- updated timestamp

Do not commit a database body before checking it for family details, hidden
Unicode, instruction injection, unsafe tool claims, and overlap with existing
skills.

### 5.2 Generalize into packages

Create:

```text
apps/web/agent/skills/letter-sounds-worksheets/SKILL.md
apps/web/agent/skills/counting-worksheets/SKILL.md
```

Each package must:

- treat age as one input, never the difficulty source by itself;
- use the child's map snapshot and parent evidence first;
- defer material production craft to `materials-studio` rather than duplicate
  its image/HTML/review procedure;
- name the existing tools it sequences;
- include age/style/curriculum variations as decision rules inside the skill;
- avoid any founding-family detail;
- include positive and adversarial-negative routing fixtures.

If either row is only a thin subset of `materials-studio`, deepen
`materials-studio` instead of creating a duplicate skill. The export step may
therefore result in zero, one, or two new packages. That is an acceptable and
preferred YAGNI outcome.

### 5.3 Targeting during the simplified phase

All fleet descriptions are advertised to every family. The model already
receives fresh family/child context each turn. The loaded skill makes the
age, child, style, curriculum, and capability decision after activation.

At four or fewer skills, this is cheaper and more reliable than maintaining a
second targeting system. Routing tests prove that obviously irrelevant
requests do not load the skill.

## 6. Retiring runtime database skills

Use expand-contract. Do not drop tables or columns in the first deployment.

### Phase A: package and offline shadow

1. Export and review the two bank rows.
2. Add or deepen repo packages.
3. Add routing and behavioral evals.
4. Compare the static package catalog with the current dynamic advertised
   catalog in an offline operator script that loads both sources without
   registering both in Eve.
5. Produce a collision-free cutover manifest. Dynamic skills override authored
   skills with the same name in Eve 0.19, so the live runtime must never run
   both sources for a migrated name.
6. Stop for founder approval of the bank-row dispositions, family-row
   disposition, static catalog, and rollback archive before Phase B.

### Phase B: stop runtime reads and writes

Use one atomic code cutover for the catalog:

1. Convert `save_skill.ts` and `forget_skill.ts` to explicit `disableTool()`
   sentinels. Keep the sentinel files through Phase C so no built-in or stale
   install can silently reclaim those names.
2. Remove save/forget routing instructions from `agent/instructions.md`.
3. Remove family-skill navigation/copy from product surfaces. Verified current
   call sites include `apps/web/lib/slash-skills.ts`; search for every import
   of `loadSkillLibrary*`, `resolveAdvertisedSkillRows`, `mergeSkillRows`,
   `save_skill`, and `forget_skill` before editing.
4. Remove `skill-library.ts` from Eve discovery in the same commit that makes
   the migrated filesystem packages visible. This prevents dynamic rows from
   shadowing the new authored packages.
5. Update the model-advertised catalog and parent slash menu separately:
   - all repo packages may be model-advertised;
   - only parent-invocable skills appear in the slash menu;
   - `research-brief` remains dispatch-only and is not offered to parents.
6. Remove `loadSkillLibraryCaller`, `loadSkillLibraryPinned`, merge/target
   code, and their callers after the import graph is empty.
7. Deploy the code cutover first. Verify that `save_skill` and `forget_skill`
   are unavailable, no runtime code reads either table, and filesystem skills
   load on web and a pinned channel.
8. In a later additive-data but behavior-restricting migration, remove these
   named policies from `family_skills`:
   - `members add skills`
   - `members update their skills`
   - `members delete their skills`
   Keep `members read their skills` during Phase C. Run authenticated denial
   tests plus founder/server read tests before and after deployment.
9. Leave both tables, publication flags, and rows unchanged but dormant.

### Phase C: verify the dormant window

Phase C lasts at least seven calendar days after the policy migration and
requires all of the following evidence:

- a source/build guard proves no product runtime module imports either skill
  store or queries either table;
- production query logs or a temporary server-side read counter show zero
  product reads after the cutover baseline;
- verify no new `family_skills` rows appear;
- run at least ten authenticated synthetic routing probes across web and one
  pinned channel, covering every active package plus adjacent negatives;
- verify memories and child profiles still provide personalization;
- verify the preserved family row remains intact;
- verify web, SMS, email, dispatch, and mobile use the same fleet skill set
  where applicable;
- assign an owner and attach the evidence to the build log before declaring
  Phase C complete.

### Phase D: remove obsolete storage

Phase D is not authorized by this plan. It requires a separate founder ruling,
plan, and migration after the dormant-window evidence is reviewed.

The future plan must at minimum:

1. refresh the raw private archives with row counts and hashes;
2. Apply a separate breaking migration that drops obsolete policies/tables.
3. Remove rollback-only code and documentation.
4. Record the completed migration in the build log and reconciliation ledger.

Rollback before Phase D:

- restore `skill-library.ts`;
- revert/remove the authored packages that collide with dynamic names;
- restore the prior tool implementations;
- restore the three write policies through a compensating migration;
- deploy the prior code and verify the dynamic catalog on web and a pinned
  channel. The bank rows remain published throughout Phases A-C, so there is
  nothing to republish.

After Phase D, rollback means reverting Git and restoring the archived rows
through a new migration. This higher cost is why Phase D is deliberately
separate.

## 7. Family personalization after family skills

Use the surfaces already injected every turn:

- `family_memories.kind = 'what_works'` for durable teaching preferences;
- `family_memories.kind = 'fact'` for stable family facts;
- `children.profile.interests` for interests;
- `children.profile.focus` for current focus;
- ChildProgress/map evidence for actual skill level;
- canonical conversation recall for details not worth pinning.

Do not automatically copy the preserved family skill into memory. A skill may
contain long instructions, outdated assumptions, or content the parent did
not intend as a permanent pinned fact. Review and distill it with the family
before any conversion.

The fleet skill reads these structured inputs and adapts its procedure. This
keeps shared expertise in one package while preserving family-specific
judgment without generating per-family code.

## 8. Test and quality contract

### 8.1 Deterministic checks

Add a `check:fleet-skills` command that verifies:

- every package has valid frontmatter;
- directory and description are non-empty and unique;
- references stay inside the package;
- no absolute paths, backslashes, empty/dot/dot-dot segments, symlinks,
  hardlinks, secret-bearing filenames, Unicode control/format characters, or
  em dashes;
- at most 50 sibling files, at most 512 KiB per file, and at most 2 MiB total
  per package;
- frontmatter `metadata.homa-tools` and `metadata.homa-related-skills`, when
  present, are comma-separated identifiers that resolve to authored tools and
  package names;
- frontmatter `metadata.homa-parent-invocable` is exactly `"true"` or
  `"false"` and is required for every package;
- the slash menu exactly matches the discovered packages marked
  `homa-parent-invocable: "true"`; internal/dispatch packages such as
  `research-brief` remain model-discoverable but are verified absent from the
  parent menu.

Semantic overlap between routing lanes is not a deterministic checker claim.
It belongs in positive/negative routing evals and founder review.

### 8.2 Routing evals

Every skill ships:

- positive prompts that must call `load_skill`;
- paraphrased positives, not copied description strings;
- adjacent negative prompts that must not load it;
- multi-skill prompts that load the smallest sufficient set.

Installed Eve 0.19 already exposes `t.loadedSkill()`. Use it for positive
cases and an explicit `notCalledTool("load_skill")` or equivalent count
assertion for negatives.

### 8.3 Behavioral evals

Behavioral cases test:

- evidence hierarchy;
- age/style/curriculum branching;
- correct tool order;
- refusal to invent a save or delivery;
- quality checks and revision behavior;
- relevant safety/copy laws.

Deterministic checks block each change. Live-model routing and behavioral evals
run on relevant diffs and periodically, following the gate/periodic split in
the frontier review.

### 8.4 Required verification

```bash
pnpm check:fleet-skills
pnpm check:skills-targeting   # retained until database targeting code is removed
pnpm check:isolation
pnpm check:continuity
pnpm typecheck
pnpm lint
pnpm --filter web exec eve build
```

Run authenticated synthetic turns through web and at least one pinned channel.
Confirm `load_skill`, tool calls, and final output from the event stream.

## 9. Exact implementation surfaces

### Create

- `apps/web/agent/skills/letter-sounds-worksheets/SKILL.md` if the export
  proves it is distinct.
- `apps/web/agent/skills/counting-worksheets/SKILL.md` if distinct.
- Package references/assets/scripts as the reviewed bodies require.
- `scripts/fleet-skills-check.mts`.
- Top-level Eve eval files and routing fixture data.
- A migration created with
  `supabase migration new pause_family_skill_writes` that revokes the three
  named policies only after the code-first sentinel deployment.
- Export/rollback runbook for preserved skill rows.

### Modify

- `apps/web/agent/instructions.md`
- `apps/web/lib/slash-skills.ts`
- `package.json`
- `.github/workflows/ci.yml`
- `AGENTS.md`
- `docs/homa-planning/15-agentic-architecture.md`
- `docs/homa-planning/build-log.md`
- reconciliation claims affected by the old two-home statement

### Retire after verification

- `apps/web/agent/skills/skill-library.ts`
- `apps/web/agent/tools/save_skill.ts`
- `apps/web/agent/tools/forget_skill.ts`
- `apps/web/lib/agent-skills.ts`
- `apps/web/lib/agent-skills-store.ts`
- `scripts/skills-targeting-check.mjs`
- `skill_bank` and `family_skills` tables in the later contract migration

## 10. Work order

0. **Authority gate:** register the superseding ruling and family-row
   disposition. Stop until both are recorded.
1. **Inventory and export:** capture complete raw rows plus sanitized review
   copies; restore raw archives into disposable Postgres; stop until counts and
   hashes match.
2. **First tracer package:** migrate one distinct bank procedure; write a
   failing routing case; add the package; make the case pass.
3. **Second package or dedup:** migrate the other row only if it owns a
   distinct lane; otherwise deepen the existing skill and record why.
4. **Package doctor:** build `check:fleet-skills` from the packages now in the
   repo; wire CI.
5. **Catalog gate:** produce bank-row dispositions, routing fixtures, parent
   slash visibility, and a collision-free cutover manifest. Stop for founder
   approval.
6. **Static-only runtime:** in one code deploy, convert save/forget files to
   sentinels, remove their instructions, expose the filesystem packages,
   remove the dynamic resolver, and switch model/slash catalog projections.
7. **Cross-channel probe:** verify web and pinned-channel turns load the same
   intended packages and continuity remains intact.
8. **Policy migration:** after code verification, revoke the three family
   write policies; run isolation denials and server-read tests.
9. **Dormant-window audit:** run the defined seven-day observation and attach
   all evidence. Stop. Phase D is outside this plan.

Commit each tracer slice separately. Never combine the data-preservation step
with the runtime cutover or the table drop.

## 11. Acceptance criteria

### Phase A complete

- Superseding rulings are registered.
- Raw exports contain every column/row, private Blob manifest, counts, and
  SHA-256 hashes.
- A disposable Postgres restore reproduces counts and hashes.
- Every bank row and the family row has an approved disposition.
- Every proposed package has positive/negative routing cases and no unresolved
  collision.

### Phase B complete

- All active fleet procedures are discoverable under
  `apps/web/agent/skills/`.
- No runtime code reads `skill_bank` or `family_skills`.
- `save_skill` and `forget_skill` are unavailable to the model.
- Family-specific context comes from memories, profiles, progress, and recall.
- Every fleet package passes deterministic checks, routing cases, and behavior
  cases.
- All families receive the same fleet catalog.
- Parent slash menus omit dispatch-only/internal skills.
- Skills make child/style/curriculum decisions from trusted context.
- Eve build, typecheck, lint, isolation, continuity, and skill checks pass.
- Production probes show successful `load_skill` use on web and one pinned
  channel.

### Phase C complete

- The three family write policies are absent and authenticated writes are
  denied.
- Existing database rows remain byte-for-byte unchanged.
- Seven days pass with zero product reads/writes to the dormant tables.
- At least ten authenticated routing probes pass across every active package,
  adjacent negatives, web, and one pinned channel.
- The owner attaches query, routing, cross-channel, row-count, and rollback
  evidence to the build log.
- The compensating policy/code rollback is tested before closing Phase C.

Phase D has no acceptance criteria here because it is not authorized.

### 2026-08-27 addendum: CI guard retirement, not full Phase C closure

AGENTS.md called `check:fleet-skills-dormant` and `check:skills-targeting`
temporary, due for retirement "once Phase C closes and a founder reviews
the evidence." The window opened 2026-07-15 and nobody had assigned an
owner or closed it 43 days later; the guards were still running on every
full-scope PR testing an invariant nothing was actively threatening.

This addendum retires the two CI guards and the code that existed only to
be exercised by them (`apps/web/lib/agent-skills.ts`,
`apps/web/scripts/fleet-skills-dormant-snapshot.mts`), based on a narrow
check, not the full ceremony above: `public.family_skills` is at 0 rows
and `public.skill_bank` is at 2 rows (both dormant, per direct query), and
no product runtime module imports either skill store. It does **not**
satisfy the ten-synthetic-probe, cross-channel-parity, or
personalization-still-works bullets in "Phase C complete" above, and it
does not authorize Phase D (dropping `family_skills`/`skill_bank`), which
still needs its own plan and migration. Treat Phase C as informally wound
down for the purpose of "stop running temporary CI checks forever," not
as the formally evidenced closure this plan originally specified.

## 12. Triggers for reconsidering dynamic distribution

Reopen the Blob/registry architecture only when evidence shows at least one:

1. Approximately 25 to 40 active fleet skills create context or routing
   pressure.
2. Routing evals show repeated false loads or missed loads that static
   descriptions cannot resolve.
3. Real families repeatedly create durable procedures worth promoting.
4. Fleet-skill content genuinely needs canary/A-B releases without deploying
   product code.
5. Deployment cadence becomes the measured bottleneck to correcting skill
   behavior.

When a trigger fires, use
`docs/homa-planning/plans/2026-07-13-agent-frontier-review.md` and this
document's archived reader-review transcript as inputs. Do not revive mutable
markdown rows. The next architecture is immutable packages plus runtime
release controls.

## 13. Non-goals

- No full dynamic Blob package registry now.
- No family-to-fleet automatic promotion.
- No per-family fleet package versions.
- No model-authored fleet publishing.
- No scripts gaining execution authority.
- No table deletion in the initial cutover.
- No new targeting language before routing evidence exists.

