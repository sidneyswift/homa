# Handoff: Homa chat-first onboarding, wave 1 and the age-template planner

> **Status: NOT FINISHED, see Handoff Status below**
> As of: 2026-07-30. Handed off from: Claude Code on Anthropic API (Sonnet 5). Reason: session wrap-up requested by the user (running low on usage credits) after the core arc's PR was merged.

## 1. Goal / Spec

*(Stable. Do not rewrite on later handoffs of this same task: carry it forward verbatim unless the goal itself genuinely changed.)*

### Objective

Make Homa's chat-first onboarding sitting, the first roughly fifteen minutes after a parent signs up and pays, hit every pass condition in `docs/homa-planning/plans/2026-07-29-onboarding-wow-evals.md`: no beat scores -1, no two consecutive 0 beats, no stretch over 90 seconds without her acting, no wait over 8 seconds with nothing on screen to look at or do, she receives something she can keep before the paywall, she sees at least one capability she was never told about, and the last beat names something specific.

The fixed ICP used throughout, so every walk is comparable: **Rachel**, 34, first-year homeschooler, two kids (7 and 4), has just paid, is quietly afraid she's doing this wrong, has about twelve minutes tonight.

Method, established and repeated across this whole arc: walk the actual chat-first flow yourself in a browser as Rachel, at her pace, never asking the founder to test it. Score every beat in the moment, in a table, before reading ahead. Record every wait with an actual clock in the page, never an impression. Fix what's broken, then re-walk to verify the fix rather than assuming it worked. Nine numbered walks (001 through 009) were run across this arc; all of them, with their measured numbers, are logged in that eval doc's own §9 walk log, which is itself a point-in-time record, separate from and complementary to this handoff.

### Definition of done

For the arc as a whole (not for this specific handoff):

- gh#466 (P0, production) is resolved.
- gh#315 is resolved, giving onboarding a real behavioral eval.
- gh#404 has real production latency numbers and a decision on whether anything needs to get cheaper.
- gh#440's five bank statements are reworded.
- A founder decision is made and acted on for wave B/C (a generated lesson shown during the checklist).

### Constraints / non-negotiables

- **No em dash, ever, anywhere**: code, comments, docs, commit messages. This is a hard, zero-tolerance rule in this codebase (see `AGENTS.md`).
- **Every hard rule added to `apps/web/agent/skills/onboarding/SKILL.md` must cite the walk or founder ruling that produced it.** This is an established, deliberate convention in that specific file: it is what makes a rule stick against a model that will otherwise drift back to a plausible-sounding default.
- **Editing `SKILL.md` requires two follow-up commands**, or the deployed bundle silently ships stale: `corepack pnpm build:onboarding-skill` (regenerates the inlined mirror the production bundle actually reads; the raw markdown file is not what ships) and `corepack pnpm check:agent-budget` (the always-on context byte-budget guard). As of this handoff the onboarding skill body sits at 31,323 of a 32,000-byte ceiling (raised this arc from 28,000, with the reason documented next to the constant in `scripts/agent-context-budget-check.mts`, after a real compression pass first cut about 2,970 bytes of genuine duplication). If this guard fails again, read that comment and look for split-worthy sections before raising the ceiling further.
- **Tenant isolation is non-negotiable**: `familyId` never comes from client or model input; every tool re-scopes it from the authenticated session. Run `pnpm check:isolation` before any schema or query change.
- **Models judge, code verifies** (`docs/homa-planning/models-judge-code-verifies.md`): never use hand-written pattern matching to decide what a sentence means. A model proposes structured output; deterministic code validates it. This is the specific, binding reason gh#440's five bank statements are being left for a human to reword rather than for smarter regex, and the reason gh#315/gh#415/gh#416 need a real eval harness rather than a third blind prose edit.
- **`eve build` invalidates a running dev server's snapshot on the same worktree.** It rewrites `.eve/`, so a live `pnpm dev` returns `[UNLOADABLE_DEPENDENCY]` on every turn afterward, which looks exactly like an unrelated, transient Supabase pooler timeout. Restart the dev server after any `eve build`.
- **`VERCEL_OIDC_TOKEN` expires roughly every 12 hours.** `corepack pnpm dev:token` refreshes it in one line. An expired token makes every model turn fail at the gateway in a way that looks like a code bug rather than a stale credential.
- **This repo has extremely high concurrent-agent commit velocity.** A branch can go from current to 30-plus commits behind `main` within an hour. Before opening or merging any PR, check `git rev-list --left-right --count origin/main...HEAD` after a fresh fetch, and check `gh pr view <n> --json mergeable,mergeStateStatus`. If `mergeable` comes back `CONFLICTING`, GitHub will not even trigger CI (`pull_request`-event workflows do not run when a merge ref can't be computed), which looks like "CI is broken" but is actually "merge `main` in again."

## 2. Handoff Status

*(Point-in-time snapshot. Rewrite fresh at every handoff: this is the part that goes stale.)*

### Done: in scope, complete

All ten items below merged to `main` in one PR: [#469](https://github.com/sidneyswift/homa/pull/469), squash-merged at commit `74512b04` (2026-07-30). Verified directly: `git log --oneline -1 74512b04` on `main` shows this exact commit; `gh pr view 469` confirms `state: MERGED`.

1. **Wave 1 routing fixes.** Child interests now shown in the checklist header. The planner is introduced at beat 9 ("one more thing"). Beats 8 and 9 swapped, so the rehearsal (a beat she actively participates in) follows the reveal instead of a beat she only watches.
2. **Beat 4 fix.** Homa used to ask "any other kids?" again even after the app-drawn card flow had already asked and she had clicked "that's everyone." Fixed and re-walked.
3. **A new cited law in the skill file: "examples are shapes, not scripts."** Added after three separate walks each caught a literal example sentence, copied verbatim out of the skill file, landing in a real reply where it was wrong for the specific parent it was said to.
4. **The age-template planner.** Three new pure functions in `packages/core/src/map/plans.ts`: `typicalAnswersForAge` (derives what a child of a given age would most likely answer, from the bank's own `typicalMonths` field on each item), `buildAgeTemplatePlan` (feeds that derived set into the existing plan builder), and `blendTypicalWithAnswers` (lets each real answer she gives override one typical one, so every subject stays covered the whole time rather than the plan lurching between "typical" and "hers"). Net effect: the planner shows a real, plausible four-week plan from a name and a birthday alone, before she has answered a single checklist question. No model call anywhere in this path; fully deterministic. Tested: 100% match to the real answered plan for a child who is typical for their age, checked across ten different ages; a separate test explicitly asserts the plan is *allowed* to diverge for a child well ahead of their age, so a future change cannot silently "fix" that divergence away.
5. **Fixed a walk-caught bug inside the above.** `blendTypicalWithAnswers` exists specifically because the naive version, show the template until she answers then swap to the pure answered-plan, made the displayed month visibly *shrink* the instant she answered her first checklist question. That reads as her making things worse by participating. Property-tested across three ages and five different answer-counts to guard against a regression.
6. **Fixed the plan-activity-text grammar generator.** 10 of 224 source bank statements were producing ungrammatical rendered text ("Ten minutes a day of adding and subtracts small numbers," "openning twist lids"). Fixed the verb-conjugation logic for coordinated verbs ("adds and subtracts") and for consonant-doubling ("opens" is not a doubling verb). 9 new tests in `packages/core/src/map/plan-grammar.test.ts`.
7. **Built `growingEdges`.** `apps/web/lib/onboarding/checklist-state.ts` and `apps/web/agent/tools/score_child_report.ts` now return, as structured tool output, exactly which checklist answer she gave as "not yet." This lets the reveal beat reliably name her actual, specific worry instead of depending on the model correctly remembering one answer among several from earlier in the same turn. Across walks, this had previously been landing correctly only about half the time; verified 2 for 2 correct after the fix.
8. **Closed [gh#426](https://github.com/sidneyswift/homa/issues/426).** The planner used to render completely empty until a scored report existed. It now shows the age-template plan immediately, honestly labeled as a template rather than as hers until she answers.
9. **Fixed two CI-blocking issues found only after opening the PR**, neither related to product behavior: (a) the onboarding skill's preloaded body had grown past its byte-budget guard from items 2, 3, 7, and 8 above; fixed via a real compression pass (cut roughly 2,970 bytes of genuine duplication between beats) plus a documented, justified ceiling raise from 28,000 to 32,000 bytes. (b) A merge-order artifact where two independently-developed branches had both touched the chat composer's `className`, producing JSX that was logically correct but broke a source-text drift guard checking for one specific literal substring; fixed behavior-neutrally by reordering which part of the template literal was unconditional.
10. **Discovered and recovered from this branch going stale against `main` twice during the session** (this repo's commit velocity, see Constraints above), requiring two separate merge-and-reconcile passes. Conflicts were in `package.json`'s `check:*` script lists (resolved by keeping both sides' entries) and the append-only `docs/homa-planning/build-log.md` (resolved by splicing the new entry in by date rather than picking one side). One of those merges revealed `main` already contained an unrelated, already-merged PR (#371) that had already fixed a dynamic-tool bug that was about to be independently re-investigated for gh#416, saving that redundant work.

None of the above ten items need further engineering. They are live on `main` as of the merge.

### Done: but out of scope

*(Included here in the spirit of an honest accounting, since this was asked for explicitly mid-arc. Nothing below needs reverting; it's process observations for whoever runs a similarly long arc next.)*

- **The byte-budget diagnosis ran longer than it should have.** Roughly ten separate edit-rebuild-recheck cycles were spent shrinking the skill file's prose before switching to the sanctioned "raise the ceiling with a documented reason" path (an explicitly valid option the guard itself offers). Two or three cycles, then switching to that path, would have been the more efficient order.
- **Nine full browser walks is thorough but was not cheap in turns.** Several of the later walks re-verified small, low-risk copy changes with a full live walk each, where a narrower, more targeted check might have sufficed.
- **Deep git and CI log archaeology** (comparing exact file byte-sizes across branches, reading raw GitHub Actions logs, comparing failure sets across independent `main` runs to prove the `evals` check's flakiness) was more forensic than a bare "continue" instruction strictly required, though in every case it did pay off with a concrete, correct finding rather than a guess.

### Remaining: required, in scope

- **[gh#466](https://github.com/sidneyswift/homa/issues/466) (P0, production, the most important item here, do not attempt a quick fix).** A chat turn that finishes generating in roughly 2 to 3 seconds server-side can still leave the client counting up toward its roughly 240-second client-side recovery deadline, and when that recovery finally gives up, the persisted transcript loses both her message and Homa's reply entirely, not merely an on-screen rendering glitch (confirmed via a server refetch showing the exchange genuinely absent). Full repro steps, a network trace, and exact timestamps are in the issue body. The session recovery and cursor machinery lives in `apps/web/app/app/chat-client.tsx` and eve's own `session-utils.js`; it was already the subject of one prior incident (#170) and one non-trivial fix (#227), and #227's own fix is confirmed still working correctly for the adjacent case it was built for. This needs dedicated investigation into the stream and SSE delivery path itself, not a same-session patch.
- **[gh#315](https://github.com/sidneyswift/homa/issues/315).** Onboarding mode is unreachable from the eval harness, so no automated eval can catch an onboarding regression. This is the actual prerequisite for durably fixing [gh#415](https://github.com/sidneyswift/homa/issues/415) (Homa calling forbidden tools at kickoff) and [gh#416](https://github.com/sidneyswift/homa/issues/416) (`start_first_making` never firing despite a textbook trigger): walk 009 in the eval doc confirmed both are still reproducing after a real, targeted prose fix in the skill file, and the tool-presence half of gh#416 is separately confirmed resolved (the tool exists and is correctly wired on `step.started` fleet-wide, verified via `pnpm check:dynamic-tool-events` reporting "6 dynamic tool(s) of 66 scanned resolve on step.started"). The remaining gap is pure model compliance. Per this repo's own binding models-judge-code-verifies rule, a third blind prose edit is very unlikely to be the fix; what's missing is the ability to write a behavioral eval that actually exercises onboarding mode, so a fix can be measured rather than guessed at. Start here before touching gh#415 or gh#416 again.
- **[gh#404](https://github.com/sidneyswift/homa/issues/404).** Needs real production latency numbers pulled from Vercel runtime logs. Local walk numbers exist in the eval doc but are explicitly flagged there as not representative of production: sandbox-only, a tiny sample, and in at least one case contaminated by a concurrent skill edit happening during the very walk that measured it.

### Remaining: nice to have, not required

- **[gh#440](https://github.com/sidneyswift/homa/issues/440).** 5 of the 224 bank statements have a grammatical shape ("X and Y," where Y is ambiguously a verb or a noun, for example "uses loops and events") that item 6's grammar fix correctly declined to guess at with more pattern-matching code, per the same models-judge-code-verifies principle. This needs a human to reword the five specific source statements named in the issue, not more code.
- **Wave B / C: a generated lesson per subject, shown while she answers the checklist.** Costed in `docs/homa-planning/plans/2026-07-29-onboarding-week-fills.md` §8 at roughly $0.95 per family for one lesson, up to $2.75 per family for one lesson per subject (five total). Both figures are affordable against this project's own trial customer-acquisition-cost ruling, so cost is not the blocker. The actual blocker: the materials-studio generator takes a median of 6.3 minutes (observed as long as 26.6), and she is only occupied by the checklist for about 5 minutes, so "a lesson visibly appears while she is still answering" does not fit today's generator. Three options are written up in that doc's §8 (defer the lesson to her next visit; swap in a faster, lighter generator; build just one lesson instead of five). This needs an explicit founder decision on which approach, not more engineering from an agent.

### In production now (live)

- All ten "Done" items above, live on `main` as of the [#469](https://github.com/sidneyswift/homa/pull/469) merge (2026-07-30, commit `74512b04`). This is a web-only change; this repo's Vercel project auto-deploys on merge to `main`, so it went live for real families immediately. There is no separate mobile build or App Store release cadence to wait on for this arc, unlike some other arcs in this repo.

### Merged: not yet deployed/live

- None for this arc. This repo auto-deploys web on merge to `main`, so for onboarding work specifically, "merged" and "live" are the same event.

### Still in the works (unmerged / in progress / local only)

- Nothing code-wise is unmerged for this arc as of this handoff. All four "Remaining" issues (gh#466, gh#315, gh#404, gh#440) and the wave B/C decision are filed with full supporting evidence in their issue bodies, but none has a branch or PR started yet.

### Known gotchas / landmines

- **The eval doc's own walk log is itself a point-in-time record with numbered walks 001 through 009** (`docs/homa-planning/plans/2026-07-29-onboarding-wow-evals.md` §9). Read walk 009 first, not from the top: it is the most recent, and it supersedes earlier walks' conclusions about tool presence for gh#416.
- **Do not re-attempt gh#416 by editing the skill's prose a third time** without first reading walk 009's specific finding. Tool presence is confirmed fine; another wording pass in `SKILL.md` is very unlikely to be the fix on its own.
- **The `evals` CI check on this repo fails on a churning set of unrelated evals on nearly every run, including on `main` itself**, not only on feature PRs. Verified directly during this arc: two different completed `main`-branch Evals runs the same day failed two different evals apiece. Do not block a merge decision on this check alone without first checking whether the specific failing eval(s) also fail on a fresh, unrelated `main` run.
- **This handoff document itself is written under the same no-em-dash rule as the codebase.** If revising it, reach for a comma, period, or colon instead of an em dash for a parenthetical aside.

## 3. Pointers

- Repo: `sidneyswift/homa`
- Worktree this arc was built in: `/Users/sidneyswift/Documents/Projects/Sidney/onboarding-wave1` (branch `claude/onboarding-wave1`, now fully merged; safe to leave or clean up)
- Merged PR: [#469](https://github.com/sidneyswift/homa/pull/469), squash-merged to `main` at `74512b04` (2026-07-30)
- Relevant issues: [#466](https://github.com/sidneyswift/homa/issues/466) (P0, production, open), [#315](https://github.com/sidneyswift/homa/issues/315) (open), [#404](https://github.com/sidneyswift/homa/issues/404) (open), [#440](https://github.com/sidneyswift/homa/issues/440) (open), [#415](https://github.com/sidneyswift/homa/issues/415) (open, blocked on #315), [#416](https://github.com/sidneyswift/homa/issues/416) (open, blocked on #315), [#426](https://github.com/sidneyswift/homa/issues/426) (closed, this arc)
- Key docs: `docs/homa-planning/plans/2026-07-29-onboarding-wow-evals.md` (the eval bar, the ICP, the scoring scale, and the full nine-walk log), `docs/homa-planning/plans/2026-07-29-onboarding-week-fills.md` (the age-template planner design and the wave B/C cost analysis), `docs/homa-planning/models-judge-code-verifies.md` (the binding rule behind why gh#315/gh#415/gh#416/gh#440 are being left for a human or a real eval harness rather than more code)
- Key files touched this arc: `packages/core/src/map/plans.ts` (`typicalAnswersForAge`, `buildAgeTemplatePlan`, `blendTypicalWithAnswers`, the plan-grammar fixes), `packages/core/src/map/plan-grammar.test.ts` and `packages/core/src/map/age-template.test.ts` (new test files), `apps/web/lib/onboarding/checklist-state.ts` and `apps/web/agent/tools/score_child_report.ts` (`growingEdges`), `apps/web/agent/skills/onboarding/SKILL.md` and its generated mirror `apps/web/lib/onboarding/onboarding-skill-body.generated.ts`, `scripts/agent-context-budget-check.mts` (the budget ceiling), `apps/web/app/app/chat-client.tsx` (the composer `className` merge-artifact fix), `apps/web/app/onboarding/checklist-step.tsx`, `apps/web/lib/plan-week.ts`, `apps/web/lib/app-data.ts`, `apps/web/app/app/planner/*.tsx`
