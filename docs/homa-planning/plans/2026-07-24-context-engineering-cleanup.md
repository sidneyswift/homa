# Context-engineering cleanup (2026-07-24)

Source: Anthropic's context-engineering guidance for Claude 5 models
(the `claude doctor` era rules). Its six shifts: rules give way to
judgment, worked examples give way to interface design, upfront prose
gives way to progressive disclosure, repetition gives way to one home
per rule, CLAUDE.md-as-memory gives way to auto-memory, and simple specs
give way to rich references. Homa runs on `claude-sonnet-5`
(`apps/web/agent/model.ts`), a Claude 5 family model, so the guidance
applies to the production agent as well as the coding layer.

One correction before applying it here: **this repo's hard rules are
scar tissue with provenance** (founder rulings, incident citations, PR
numbers). The guidance's "delete rules, trust judgment" targets style
rules and defensive boilerplate, never laws like tenancy or tool
honesty. The move is almost never "delete the rule"; it is "keep the
rule in one canonical place, move the war story behind a pointer, and
delete the other copies."

The durable output of this work is `AGENTS.md` § Context-file authoring
rules. This document records the audit evidence and the remaining
phases.

## Audit summary (four parallel reads, 2026-07-24)

### Layer 1: eve always-on context (heaviest finding)

Every turn carries roughly 11k to 14k fixed tokens;
`apps/web/agent/instructions.md` is about 7k of it, and over half of
that has a correct home elsewhere:

- A 25-row "when to reach for each tool" table (instructions.md:157)
  paraphrases the tool descriptions. `send_heads_up` guidance appears in
  four places, the journal same-turn rule in three, memory rules in
  three, tool honesty in three.
- The check-in state machine (:213-264) and the materials workflow
  (:385-431) are capability procedure carried always-on; the materials
  section duplicates the materials-studio skill it tells Homa to load.
- The lexical "behind" ban (report-writer.md:34) bans "behind the
  house", and instructions.md:99 itself violates it, proving prose bans
  do not bind. The growth-framing law stays; the word enumeration goes.
- The voice block is hand-mirrored across instructions.md,
  report-writer.md, and curriculum-writer.md with "change one, change
  all three" comments.
- Must keep verbatim, once each: tenancy block, injection defense, tool
  honesty, pronoun law, no-diagnoses, fail-closed SMS consent, the
  anti-hallucination progress line.

### Layer 2: tool descriptions

About a quarter of the 56 tools carry essay descriptions, clustered on
the flat-schema tools whose bare enum discriminants forced prose
glosses. Positive exemplars worth copying: `get_children` (prevents
redundant calls by stating what is already in context, not by
prohibition), `remember`/`find_materials`/`recall` (per-param
describes), `open_planner` ("Read-only; make changes with edit_plan"),
`generate_image` ("prompt craft lives in the materials-studio skill,
not here").

### Layer 3: fleet skills

All six descriptions are real routing instructions; four carry negative
scope. materials-studio already models progressive disclosure
(references/ tree, intent-to-file tables, golden anchors as
spec-as-artifact). onboarding (413 lines) is the monolith: boundary
sections belong in references/, and "speak to her, not third person"
appears four times. The format-library and golden-anchor tables are a
hand-maintained index of references/recipes/. The math "binding laws"
mix trust-bearing rules (answer keys) with pedagogical opinion (bubble
grids).

### Layer 4: coding-agent skills and AGENTS.md

The healthiest layer: disciplined "Use when... NOT for..." descriptions,
hard rules with incident citations, zero broken paths. Findings were
mechanical: a retired 680-line skill still in tree, a 156-line
transcribed JSON example, the copy-gate dispatch protocol pasted four
times (with drift: the marketing pair lacked the inline-delivery
instruction), a stale "33 recipe files" count (actual: 50), and a root
AGENTS.md carrying web-only gotchas and a 100-line essay into every
session while the nested AGENTS.md tree sat nearly empty.

## Shipped in this change

- `AGENTS.md`: added § Context-file authoring rules; compressed the
  models-judge essay to its law plus corollaries with the full ruling
  moved verbatim to `docs/homa-planning/models-judge-code-verifies.md`;
  ChildProgress rollout paragraph replaced with a pointer to BUILD.md's
  canonical copy; web-only eve-build gotchas moved to
  `apps/web/AGENTS.md`.
- Deleted `.agents/skills/emil-design-eng/` (retired, superseded;
  manifest row terminal via CLM-0226).
- `.agents/copy-gate-protocol.md` now owns the shared gate mechanics;
  the four gate skills point to it and keep only their specifics. The
  marketing pair gains the inline-delivery instruction it was missing.
- curriculum-ingestion: embedded cur-JSON example replaced with a field
  outline plus a pointer to the real `.cosmo/curriculums/cur-*.json`
  files; taxonomy sequence collapsed to a pointer at reference-ingestion
  step 8 (canonical). Stale recipe counts dropped in both ingestion
  skills.
- Tool interface work (additive): per-action and per-field describes on
  `manage_child_progress` and `explore_child_map`'s published flat
  schemas, with their prose descriptions trimmed to the load-bearing
  trust rules; `start_first_making.kind` is now the canonical
  `MATERIAL_KINDS` enum; `ask_for_details`' description no longer
  re-teaches its own enum; `edit_plan` and `create_printable` point to
  the skills that own their workflows instead of teaching them.
- `check:fleet-skills` gained reference integrity: concrete
  `/workspace/skills/` mentions must resolve, references/ files must be
  mentioned by the body (no orphans), and recipe-file table cells must
  name shipped recipes. All three verified to fire on seeded failures.
  (`read_file` and the `/workspace/skills` mount are confirmed real eve
  framework built-ins: `eve/dist/src/runtime/framework-tools/read-file`
  and `runtime/skills/sandbox-access`.)

## Remaining phases (each needs its own gate)

Phase A, instructions.md compression: SHIPPED 2026-07-24 (same branch,
four commits, one per section so each can be reverted alone). 29.8KB to
21.7KB always-on, roughly 2k tokens per turn. Gated live against
eval:journaling-trigger (8/9 capture + 8/8 restraint at baseline; the
first router-table draft regressed the family-wide fan-out case to a
consistent fail and was fixed before commit, which is the eval gate
doing its job), eval:progress-check-in (3 PASS), and the eve eval suite
(failure-set parity with pristine main measured the same hour).

Scope was deliberately narrower than first planned. NOT touched, with
reasons: the Voice (binding) block and everything above "What you know
each turn" (the telnyx-provision split point and the hand-mirrored
voice contract with report-writer.md and curriculum-writer.md, whose
REPORT_PROMPT_VERSION gate requires fixture regeneration and a founder
read-aloud); report-writer.md and curriculum-writer.md themselves,
including their lexical "behind" enumerations; the Memory section
(standing-feedback is eval-gated and the rest is non-duplicated); the
two tool-honesty laws (distinct laws, not duplicates). The shared voice
module extraction and lexical-ban softening move to a later phase that
schedules the founder read-aloud.

Observed while gating, not caused by this work: the materials-studio
positive-routing evals (counting-routing, letter-sounds-routing) fail
6/6 on PRISTINE main as of the evening of 2026-07-24 (a worksheet
request answers in prose without load_skill), after passing at least
once earlier the same day. Suspected model or eval-host drift. Needs
its own investigation against production behavior; it is not
addressed by this plan.

Phase B, judgment-only NEVER relaxation on the card tools
(`ask_user_questions`, `ask_for_photo`): same eval gate as Phase A;
these trust model judgment more rather than removing duplication.

Phase C, onboarding skill split: sitting-one arc stays in the body;
first-making, rehearsal, interrupting, coming-back, and may-not-promise
sections move to references/ loaded by beat. materials-studio's
format-library and golden-anchor tables move to a references/ index.
Soften the pedagogy-opinion math rules; keep the answer-key law firm.
The new reference-integrity guard must stay green through the split.

Phase D, unguarded anchor writes: the SKILL.md golden-anchor table row
and the recipe file's anchorIds paragraph still have no automated
check (noted in reference-ingestion 6e); extend the fleet-skills guard
when the table shape settles.

## Verification for this change

`pnpm check:fleet-skills` green including the new checks (negative-test
fixtures confirmed all three fire), `pnpm check:docs -- --allow-open`
error set identical to the pre-change baseline plus the intended
terminal-state row, typecheck, lint, `VERCEL=1 eve build`, and
`check:child-progress` for the tool-contract change.

## Re-landed onto main (2026-07-25)

The original branch fell 37 commits behind main before review, so this
plan's six commits were re-landed via cherry-pick -x onto a fresh
branch. Record of the interactions:

- The only conflict was the router-table deletion (instructions.md):
  main's a4d3b03f had reworded two table rows (the planner row narrowed
  to scheduling moments; the materials row gained lesson plans) as a
  same-day production fix for lesson-plan requests popping the planner
  canvas. Resolution took this branch's compressed prose, and the
  planner half of a4d3b03f was ported FIRST into the two homes that
  survive the table: planner/SKILL.md's description and open_planner's
  description, both now saying scheduling an existing lesson,
  curriculum, or unit study is planner work while authoring one is
  materials work. The materials half already lived in
  materials-studio's description on main.
- The port shipped behind new routing gates authored before any router
  change: evals/materials-studio/lesson-plan-routing (improvement
  tracker; 0/3 loadedSkill on pristine main while
  notCalledTool(open_planner) held 3/3) and three evals/planner/
  fixtures (adjacent-negative, curriculum-scheduling, week-view; all
  3/3 at baseline and 3/3 after the narrowing).
- The routing-drift observation above is now diagnosed: the 07-24 6/6
  failures were family-less eval sessions, fixed on main by PR #144's
  Walker family fixture (HOMA_EVAL_FAMILY_FIXTURE) plus PR #146's eval
  isolation. counting-routing and letter-sounds-routing pass under the
  fixture; letter-sounds occasionally parks on a clarifying question,
  which re-runs distinguish from real regressions.

Phase D is amended by the same session: the golden-anchor table was
deleted rather than guarded (generate_image's anchorIds describe is the
canonical menu, rendered from the registry at module load), with
check:fleet-skills extended to resolve anchor ids mentioned in skill
markdown against the registry. The format-library table stays in the
SKILL.md body on purpose: it is the always-consulted routing index over
references/recipes/, and moving it behind read_file would add a sandbox
round trip for zero context savings.

## Verification for the 2026-07-25 re-land session

Deterministic, all green on the final tree: typecheck, lint,
check:fleet-skills (6 packages, including the new anchor-id check),
check:child-progress (434), check:onboarding (78), check:continuity
(185), check:journaling-trigger fixtures (18), check:agent-budget,
check:instructions-split, check:agent-context (42),
check:tool-deadlines (55 bounded), check:eval-isolation (17),
check:skills-targeting, check:fleet-skills-dormant, VERCEL=1 eve build,
VERCEL=1 check:eve-stream-duration, and check:docs --allow-open with an
error set identical to the same-day pristine-main baseline plus the
intended deltas (one fewer open manifest row for emil-design-eng, a
claim-ledger newline fix, and the standard two-error registration noise
for each of the three new doc files).

Behavioral, measured against same-day pristine-main baselines:
progress-check-in 3/3 baseline to 9/9 across three runs after;
journaling-trigger capture 7/9, 7/9, 8/9 baseline to 8/9 x3 after
(fan-out-collective, which failed 2/3 on main, passes 3/3 after; the
compressed prose names the family-wide fan-out explicitly), restraint
8/8 on every run of every channel; new channel variants SMS 8-9/10 and
email 8/10 at parity with their own pre-deletion baselines; planner
routing gates 3/3 everywhere on both trees; full eve suite failure set
equal to the union of the two pre-existing question-parking flakes
(pass on re-run), the two inherent workflow-harness flakes (their
harness never includes instructions.md), and the two deliberate red
trackers (lesson-plan-routing, anchor-usage).

Tried, measured, and reverted: a strengthened always-on hours line
(evening-recap-with-hours fixture moved only to 1/4). The follow-up is
deterministic instead: a reminder in the journal tool's own result.
