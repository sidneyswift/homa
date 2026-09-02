---
name: homa-screen-gauntlet
description: >-
  Use when one specific Homa screen (mobile or web) reads as unpolished,
  amateur, or generically "AI-built" and needs to be pushed toward a named
  real competitor's equivalent screen. Runs a blind, independent-critic
  gauntlet loop: capture both screens as real pixels, dispatch fresh
  generic expert critics with zero Homa context, compile every suggestion
  ranked by impact, implement directly against Homa's real constraints,
  verify live, and loop again with fresh critics until the bar is met. Not
  for open-ended information-architecture exploration with no single
  screen or reference in mind (exploring-ui-directions owns that); not a
  replacement for the single mom-persona reaction check in
  homa-uxui-reviewer, which deliberately carries Homa context this skill's
  critics must NOT have.
---

# Homa Screen Gauntlet

## Overview

This is Homa's screen-specific instantiation of the generic
[Gauntlet Loop](../gauntlet-loop/SKILL.md) pattern (vendored in full at
`.agents/skills/gauntlet-loop/SKILL.md`, sourced from
[sidneyswift/skills](https://github.com/sidneyswift/skills/tree/main/gauntlet-loop)).
**Read that file first.** It explains why a real reference plus a blind,
separate critic plus looping past round one beats a single reviewer or a
single pass — the "why." This file is the "how" for one Homa screen: where
the bar comes from, who the critics are, what "implement" means in this
codebase, and the laws implementation must respect.

This procedure was proven on `apps/mobile/src/app/(onboarding)/hello.tsx`
(2026-09-01): five blind critics compared it against Headspace's welcome
screen, every suggestion was compiled and ranked, and the screen was
rewritten in place against that list. Read that commit's diff for a worked
example if one is still easy to find in git history.

## When to use

- "This screen feels amateur" / "make this screen actually professional"
- "Compare our [screen] to [competitor]'s [screen] and fix ours"
- A screen is about to be seen by real users (an ads launch, a demo, a
  store listing screenshot) and needs to clear a real quality bar, fast
- **Not** for exploring structure, navigation, or information architecture
  with nothing concrete to compare against yet — use `exploring-ui-directions`
  first, then run this once one screen's shape is settled.
- **Not** a substitute for `homa-uxui-reviewer`'s single homeschool-mom
  reaction check. That skill deliberately reasons with full Homa context
  (voice, existing patterns, the parent's real situation). This skill's
  critics must know none of that — see Step 3.

## Process

### 1. Fix the goal and find the bar

Name the exact screen (file path and route) and the exact reference: a
real competitor app and its equivalent screen in the same journey
position (welcome-to-welcome, paywall-to-paywall, not welcome-to-paywall).
If the user names the competitor, use it. If not, ask, or propose the
strongest real comparable for this category and say why — never invent a
vague bar like "make it look professional" (gauntlet-loop's #1
anti-pattern).

Source the reference as real pixels, not a memory of what the app
"probably" looks like:
- Prefer the `appllama-usage` skill (already vendored in this repo,
  `.agents/skills/appllama-usage/`) — `search_apps` to find the named app,
  `list_app_screens` filtered to its onboarding/paywall flow to get the
  exact equivalent screen in journey order, and download the real image.
  Pair it with `appllama-app-design-skill` for build-side guidance.
- If Appllama doesn't have it, use a real screenshot the user supplies, or
  one you capture yourself from a source you're actually allowed to view.
  Never substitute a description.

Capture Homa's own current screen the same way: use the `mobile-simulator`
skill (or the web dev server for a web screen) to render the real, live
screen and screenshot it. Never review from source code alone — measure
the rendered pixels, the way the hello.tsx round measured actual sky
lightness span and hero-zone height proportion rather than eyeballing.

### 2. Decompose the screen

Default split for one screen (adjust per gauntlet-loop's "let the agent
split the work" — this is a starting point, not a fixed list):

- Visual design & layout (composition, whitespace, hierarchy)
- Color & contrast (measure — WCAG ratios, HSV saturation, don't eyeball)
- Typography (scale steps, weight, line-height)
- Copy (words, tone, what's said vs. left unsaid)
- First-impression UX (what a new user actually does/feels in 3 seconds)

### 3. Dispatch blind, independent critics

Spawn one `Agent` per dimension, in parallel, each a genuinely generic
expert persona (a visual designer, a color/contrast specialist, a
typographer, a copywriter, a UX researcher — or whatever the decomposition
above calls for). This step has hard rules, each learned from a real
founder correction on the hello.tsx round:

- **Never dispatch `homa-uxui-reviewer` or any Homa-branded persona for
  this.** ("no dont use homa-uxui-reviewer. that will make us use old
  homa ui/ux. i need you to spin up net new independent reviewers.")
  These critics see two screenshots and nothing else about Homa.
- **Never mention Homa's design tokens, the Quiet contract, or brand
  guidelines in a critic's prompt.** They judge the rendered pixels the
  way a stranger encountering the app cold would.
- Give each critic only: the two screenshot file paths (to `Read`
  directly, not a description of their contents), the one dimension it
  owns, and an instruction to list **every** concrete, specific change it
  would make and why — not a top-N shortlist. Capping at "top 5" on the
  first run silently dropped real suggestions; ask for the full list.
- Ask each critic to render a verdict first, blind-A/B style per
  gauntlet-loop principle #5 (which screen wins on its dimension, and
  why) before it lists changes — the verdict is what tells you, over
  successive rounds, whether the loop has actually closed the gap.

### 4. Compile everything, rank it, do not curate into options

Read every critic's report in full. Build one list combining every
suggestion from every report — not just the ones that converged across
critics, not just the ones you find most interesting. Rank the full list
most-to-least impactful. Then implement the ranked list directly into the
real screen. Do **not** produce a small set of alternative variations for
the user to pick from unless they explicitly ask for options; a prior
round of this exact process did that and the user rejected it outright:
"i feel like your 3 options are meh. just make the changes that the
reviewers suggested... dont just focus on the 5 you wrote... document all
the suggestions... do all of them."

### 5. Implement against Homa's real constraints

Work down the ranked list. Before changing code for a suggestion, check
it against real project law: the Quiet design-system contract
(`packages/design/src/contract/`, see root `AGENTS.md` § Design system),
the copy-voice rules in `.agents/skills/homa-copy-writer/SKILL.md` for any
copy change, and tenancy/security boundaries if the screen touches either.
Every suggestion resolves to exactly one of three outcomes, never a
fourth:

- **Implement it.** The common case.
- **Flag it in a code comment; do not silently skip or silently violate.**
  When a suggestion would require bypassing a real hard law (for example:
  several hello.tsx critics wanted a saturated CTA color, but `Button`'s
  primary variant is deliberately the contract's one system-wide
  midnight-ink action color, not a per-screen choice), write the
  constraint and the tradeoff into the code at the point of the change and
  leave the suggestion undone. Never guess past a real law.
- **Skip and disclose when implementing would mean inventing unspecified
  product behavior** (reusing a character state built for a different
  context, guessing at a flow with no spec). Say so plainly rather than
  shipping a guess.

Default to the higher-effort, higher-fidelity version of a change, not
the cheapest thing that technically addresses the note: a real generated
illustration over an icon placeholder, an actual tap-to-advance
interaction over a passive auto-timer, a real multi-stop gradient over a
flat color band. This project's founder has corrected the cheaper default
more than once for exactly this kind of work — when in doubt, build the
version you'd be proud to ship an ad against, not the version that merely
closes the ticket.

### 6. Verify live, every round

After implementing a round: reload the real app, re-screenshot, and check
concretely, not just "it looks right":

- The change rendered as intended.
- Nothing leaked into sibling screens. Homa's mobile onboarding shares
  persistent context across screens (for example `WalkCharacterProvider`
  in `apps/mobile/src/features/onboarding/walk-character.tsx`) — a
  screen-scoped tweak must use the `useWalkX(value)` pattern (set on
  mount, revert to the default on unmount) so it cannot bleed into the
  next screen. Confirm by navigating away and checking the next screen is
  unaffected.
- No new console or dev-server error was introduced.

If you find a real, live-blocking bug along the way that isn't what you
went looking for, fix and verify it in this same session and track it —
do not just note it for later (root `AGENTS.md` § Production bugs,
"prod-bugs-fixed-not-stored"). The `apps/mobile/lib/supabase.ts` cold-start
crash found and fixed during the hello.tsx round (gh#1054) is the worked
example: found while verifying an unrelated screen change, root-caused,
fixed, and filed in the same pass rather than deferred.

### 7. Loop — this is the step a single review round skips

Re-run Step 3 with **fresh** critics: new agent calls with zero memory of
round 1's reports or your implementation reasoning, looking at the
newly-implemented screen against the same reference. Keep going —
implement, verify, fresh blind critics again — until one of:

- A round's critics call the screen a win, or a real tie, against the
  reference on every dimension, with no new high-impact gap, or
- New findings have become too small to matter, or
- You've spent the compute the user asked for.

Do not stop after exactly one round by default. One pass is a review, not
a gauntlet — the whole reason to borrow this pattern instead of a plain
"get some feedback and act on it" pass is the loop. When a remaining item
is a flagged law conflict rather than an unaddressed suggestion (Step 5's
second outcome), say so plainly in the wrap-up so a real, permanent
constraint is never confused with a gap the loop simply hasn't closed yet.

### 8. Close it out

- Leave a short doc comment on the screen (or the nearest sensible spot)
  recording what changed and why, the way `hello.tsx`'s header comment
  does, so a future reader doesn't need this session's chat history to
  understand a non-obvious choice.
- Run the affected guard(s) from `apps/mobile/CLAUDE.md`'s routing table
  (typically `pnpm check:mobile-*` for the touched feature area), plus
  `pnpm --filter mobile typecheck` and `pnpm --filter mobile lint`.
- Commit, push a branch, and open a PR. Describe the reference app and
  screen used, how many rounds ran, and list anything flagged-but-not-
  implemented so a reviewer sees it as a decision, not an oversight.

## Laws

1. Critics are blind, always. No Homa product, brand, or design-token
   context in a critic's prompt, ever.
2. Compile every suggestion, rank it, implement it directly. Curated
   alternative options are not the deliverable unless explicitly asked
   for.
3. Never silently skip or silently violate a real project law — flag it
   in code, at the point of the change.
4. Loop past round one, with genuinely fresh critics each time.
5. Read `.agents/skills/gauntlet-loop/SKILL.md` in full before the first
   run in a session — its anti-patterns section catches mistakes this
   file can't re-derive every time.
