# Handoff: Carolyng field-study arc (materials trust first, then a thin family library)

> **Status: NOT FINISHED. See Handoff Status below.**
> As of: 2026-07-30, 18:00 UTC. Handed off from: Claude Code (Opus 5) on macOS.
> Reason: long session wrapping up with arc work unfinished.

## 1. Goal / Spec

*(Stable. Do not rewrite on later handoffs of this same task.)*

### Objective

The founder's original request, verbatim:

> "Review this transcript with Carolyng. Then review all her conversations
> with homa from the last two weeks. Then assume the role of a senior 10x
> PM. Create a plan folder based on your findings that also includes user
> journeys and stories and features and bugs etc. Then run everything by a
> council of expert sub agents to review your findings and let them also
> review the codebase to give you ideas, suggestions, implementations,
> questions, challenges, and feedback. then take all the signal and turn it
> into gh issues and arc that other agents can execute on."

Plainly: Carolyng is a non-technical co-founder who uses Homa as a real
homeschooling parent. A 2026-07-28 meeting transcript plus her two weeks
of production conversations were the raw signal. Turn that into a written
plan, pressure-test it, file it as GitHub issues, and then **execute the
arc**. The last part is not implied: the founder moved straight from
planning into "ok start implementing" and kept saying "continue".

The arc's own framing (issue #359): **earn trust in materials first, then
build a thin family library on top of it.** A parent who cannot trust that
a worksheet is correct will not upload her curriculum.

### Definition of done

- The plan folder exists and is merged:
  `docs/homa-planning/plans/2026-07-28-carolyng-field-study/` (README,
  findings, journeys, stories, features, bugs, council, issues).
- Every finding is a GitHub issue, correctly labeled, under arc #359.
- Each issue in the arc is either shipped to production and closed with
  evidence, or explicitly still open with its remaining work stated.
- Anything found live in production is fixed and deployed in the same
  session it was found, per the standing founder ruling.

### Constraints / non-negotiables

These are repo law, not preference. Full list in `CLAUDE.md` and `BUILD.md`.

- **No em dash, ever, anywhere.** Code, copy, docs, commit messages.
  `pnpm check:em-dash` enforces it but only scans git-**tracked** files,
  so `git add` before running it.
- **"Homa", never "HOMA".** Where the brand appears as a mark, render the
  real `Logo` component.
- **Fat skills, narrow tools.** Judgment and procedure go in fleet skills
  under `apps/web/agent/skills/`; exact effects go in bounded tools. Read
  the placement table in `CLAUDE.md` before adding either.
- **Models judge, code verifies.** Never write regex, keyword lists, or
  token-overlap scoring to decide what a sentence *means*. A model
  proposes into a schema; deterministic code validates against real
  catalogs and re-checks verbatim quotes.
- **Tenancy is load-bearing.** `familyId` never comes from the model or
  the client. Every model-supplied id is re-scoped inside the
  authenticated family.
- **Production bugs are fixed, not filed.** A bug confirmed or strongly
  suspected live gets fixed, deployed, and verified in the same session.
  Writing it into a doc is not a fix; if it genuinely cannot ship, put it
  in front of the founder labeled as a live failure.
- **Every tool ships bounded** via `defineBoundedTool` with a deadline
  tier, never bare `defineTool`.
- **Prod schema and prod code ship together.** Never apply a breaking
  migration ahead of the deploy that reads it. Additive-only may lead.
- **Issues are the tracker.** Docs are spec and evidence; status,
  priority and ownership live on the issue. Close only with evidence.

## 2. Handoff Status

*(Point-in-time snapshot. Rewrite fresh at every handoff.)*

### Done: in scope, complete

All merged to `main` and live. Verified 2026-07-30 by checking PR state
and grepping `origin/main` for the shipped symbols, not from memory.

| PR | What it did |
|---|---|
| [#360](https://github.com/sidneyswift/homa/pull/360) | The plan folder itself: findings, journeys, stories, features, bugs, council review, issue manifest. Arc filed as #345-#359. |
| [#371](https://github.com/sidneyswift/homa/pull/371) | **Live outage fix (#345).** Six dynamic tools, including `create_printable`, vanished mid-conversation on cold isolates because they resolved on `turn.started`. eve replays turn-scoped dynamic tools through a `globalThis` step registry that repo tools never populate. Fixed to `step.started`, with a new CI guard `check:dynamic-tool-events`. |
| [#373](https://github.com/sidneyswift/homa/pull/373) | Materials quick-fix bundle (#346): honest QC coverage reporting, changed-page-first review selection, `mark_material_final` made `repeatable`, chain-scoped finalize lock, preview retention. |
| [#381](https://github.com/sidneyswift/homa/pull/381) | `find_hours` (#354): Homa can read back the hours she writes. |
| [#414](https://github.com/sidneyswift/homa/pull/414) | Settings can sell Homa Plus, so the denial line stops lying. Added `tierForStripeProductRecognized` (strict, returns null for unmapped products) because the lenient variant would silently downgrade a Plus family through a `coalesce`. |
| [#431](https://github.com/sidneyswift/homa/pull/431) | **Live P1.** An accepted offer poisoned every later material: a reservation that had already inserted a material id was reused, producing a duplicate primary key on every subsequent creation. |
| [#432](https://github.com/sidneyswift/homa/pull/432) | The founder console notices a family stuck on a failing tool (3+ failures of the same tool in an hour). |
| [#459](https://github.com/sidneyswift/homa/pull/459) | **#368, every page reviewed.** See below. |

**#368 in detail**, because it carries a founder ruling a successor must
not undo. Production measurement: **358 of 864 pages, 41.4% of every page
Homa has ever shipped, went out with nothing having looked at them.** Two
caps stacked: the reviewer saw 4 pages and only 6 were ever rasterized, so
pages 7+ had no image in existence.

- Rendering now rasterizes every page (`RASTER_PAGE_CAP`, ceiling 16);
  stored previews stay capped at `PREVIEW_PAGE_CAP` = 6, so
  `create_printable` slices before upload.
- The reviewer runs in concurrent chunks over all pages. Concurrency is
  required, not preferred: one review call has taken 15.6s against its own
  45s ceiling, so three sequential chunks could outlast it.
- **Founder ruling 2026-07-30:** a problem found by the *new* coverage
  names the page and offers a fix; it never withholds the document. 38.3%
  of materials were already withheld by a failing check, and making later
  pages blocking would have pushed that toward half.
- That ruling is implemented as a construction, not a convention: the
  blocking chunk is *defined* as `selectPagesForReview(pages)`, the literal
  call the old single-call reviewer made. Anything it does not pick is
  advisory. This matters on a revision, where the old selection was
  changed-pages-first, not "pages 1 to 4".
- Cost measured before enabling, against the ~3x the ticket feared:
  **1.45x** reviewer calls, **1.71x** page images, **+98ms** raster on a
  real 12-page packet against a 210,000ms budget.
- Off switch: `HOMA_MATERIALS_REVIEW_FULL=off` restores the old single
  call exactly, asserted by a test.

### Done: but out of scope

- **`HOMA_OFFER_RECOVERY_ENABLED` flipped on in production** (issue #198).
  Not part of the field study; the founder asked for it directly mid-session.
  **Keep it**, but see the landmine below: the `+homatest` sandbox
  verification the issue itself asks for was skipped at the founder's
  explicit direction, so the first real recovery is the first live
  exercise of that path.
- **Evidence added to #248** (eval determinism). Not arc work, but the
  arc produced the measurements, and a successor will hit the same trap.

### Remaining: required, in scope

**First, four issues whose code shipped but which were never closed.**
This was a process miss in this session: the repo rule is that a session
which advances tracked work updates the issue in the same session. Do not
assume these are untouched, and do not assume they are done. Each is
genuinely partial:

- **#351** (input/output robustness), `describe_attachment` and the
  dictation auto-stop notice both shipped and are on `main`. The issue has
  a third part, cutoff recovery. Verify what remains, then close or
  re-scope.
- **#175 / CG-04** (binder in-progress area), half one shipped: drafts
  are visible in the binder via the in-progress shelf
  (`apps/web/app/app/binder/in-progress-shelf.tsx`). Half two, persisting
  a resumable chat-born working plan as a durable object, did **not** ship.
  Chat working state rotates daily by design, so a co-drafted plan still
  has nowhere to live.
- **#298** (text, email, phone sold at $49 with nothing gating them):
  the gate is built *and wired*: `apps/web/lib/billing/channel-access.ts`
  exports `channelAccessDecision` and `familyHasChannel`, and
  `familyHasChannel` is imported by `agent/channels/email.ts`,
  `agent/channels/telnyx.ts` (SMS and voice), and three voice routes.
  `HOMA_CHANNEL_GATE_ENABLED` and `HOMA_CHANNEL_GATE_SINCE` both **exist
  in the production environment** (set 2026-07-28). Their values are
  Sensitive and cannot be read back, so **whether the gate is actually
  enforcing is unverified.** Settle it with a behavioral probe or by
  asking the founder, not by reading env output.
- **#297** (two paid tiers sold before they are built), a deliberate
  sell-then-build founder call, not an oversight. Note that filing service
  work has since shipped from other sessions (#437, #447, #463, #468), so
  re-read this issue against current `main` before assuming nothing exists.

**Then the rest of the arc**, highest value first:

| Issue | Labels | Note |
|---|---|---|
| #369 | `chore P1 production` | Family-uploaded curriculum pages and in-home photos sit on public-by-URL Blob storage, readable by anyone with the link, no login. Founder ruled 2026-07-28 this ships interim and is tracked rather than smoothed. Coordinate with #328, which is moving the corpus plane private. Verified 2026-07-30: no product, paywall, or marketing copy currently claims uploads are private, so that acceptance criterion holds today. The backlog has to move too, not just new uploads. |
| #347 | `chore P1 production` | Repeated "where is it?" from parents has no telemetry home. |
| #355 | `feature P1 production` | In-call promise verifier v0 plus STT name-collision instruction fixes. |
| #352 | `feature P1` | Family library thin slice. Waiting on #369's storage decision. |
| #349 | `feature P1` | Materials layout program. Its deterministic geometry slice already shipped from another session (#451, #453, #454); the complaint ledger and assertion replay remain. |

### Remaining: nice to have, not required

- **#356** `P2`, material ladder remainder: packet page roles, answer
  keys default-on, laminate cards.
- **#357** `P2`, theming dial: `themeLevel` enum, age defaults, no-theme
  validator, one offer per batch.
- **#390** `P2`, put an earlier version back (append-only restore, the
  second half of the version rail).

### In production now (live)

Everything in the "Done" table above. `main` HEAD at handoff time was
`c2a21fb1`; the newest production deployment was created 09:23 UTC, later
than every commit on `main`, and `thankshoma.com` probes HTTP 200.

Also live and worth knowing: `HOMA_OFFER_RECOVERY_ENABLED=true`, flipped
2026-07-30. It auto-remakes an accepted morning-brief offer whose
fulfillment turn dropped. Bounds: 15-minute stale threshold, 24-hour
window, max 2 attempts, sandbox families excluded, idempotent through the
fulfillment ledger, runs on the hourly dispatch schedule (`0 * * * *`).

### Merged: not yet deployed/live

None. Nothing from this session is waiting on a deploy.

### Still in the works (unmerged / in progress / local only)

Nothing from this session. All eight PRs are merged.

Open PRs on the repo (#464, #467, #469, #471) belong to **other agent
sessions**, not this arc. #467 (iOS Binder with an in-progress shelf)
overlaps conceptually with #175 above; check it before rebuilding
anything there.

### Known gotchas / landmines

- **A red Evals run tells you nothing on its own.** `main` itself fails
  4 to 5 of 33 evals on every run and the failing set churns with no code
  change (`fill-convergence-cutout-packet` failed twice then passed;
  `lesson-plan-routing` scored 2/3 then 1/3 on the same branch). This
  session lost real time to it: two evals failed twice on a branch and
  passed on three others, a plausible mechanism was found, a revert was
  shipped for it, and both failed again identically. Run locally on that
  same branch, `pnpm eval:sandbox materials-studio/franchise-character-fallback`
  passed **4/4**. Before blaming your change: pull the same eval's result
  from recent `main` runs, then re-run that one eval with
  `pnpm eval:sandbox <eval-id>` (run `pnpm dev:token` first; the OIDC
  token lives ~12h). Only a local failure on your branch is attribution.
  Evidence is on #248.
- **Setting a Vercel env var does nothing until you redeploy.** Vercel
  binds env vars at build time, so `vercel env add` succeeding and
  `vercel env ls` showing the name are both perfectly compatible with the
  feature staying dark. The CLI also defaults to the wrong team here;
  pass `--scope homa-1d878b0e`.
- **Flag comparisons are not uniform.** `HOMA_OFFER_RECOVERY_ENABLED`
  compares against the string `"true"`; `HOMA_CHANNEL_GATE_ENABLED`
  against `"1"`. Read the gate before setting the value.
- **Sensitive env values cannot be read back.** An empty pulled value is
  not evidence a flag is off. Check for the variable name, or probe
  behaviour.
- **The branch `claude/homa-ingestion-engine-plan-0fba71` is a trap.** It
  is the original session branch, now ~50 commits stale. Its content is
  already on `main` via #360's squash merge, so its 4 commits look
  unmerged but are not. Merging it into `main` would revert other
  people's shipped work, including two mobile files deliberately deleted
  in #434. Branch fresh off `main` instead.
- **Use `corepack pnpm install` in any fresh worktree.** Plain `pnpm` is
  Homebrew v9 here and silently drops the eve patch declared in
  `pnpm-workspace.yaml`.
- **A green `pnpm build` is not a green deploy.** Vercel also runs
  `eve build` outside Next's bundler. Before pushing anything under
  `apps/web/agent/`, run `VERCEL=1 pnpm --filter web exec eve build` then
  `VERCEL=1 pnpm check:eve-stream-duration`.
- **Never put a `.test.ts` file under `apps/web/agent/tools/`.** eve
  discovers every file in that directory as a tool and the build fails.
- **`eve build` deletes the `.eve` snapshot a running `pnpm dev` is
  pinned to**, so every model turn 500s until you restart the dev server.
  In the UI it looks identical to the transient Supabase pooler error.
- **Prove a guard by breaking the thing it guards.** A test that only
  passes proves nothing. This caught a real defect in #368: a plausible
  "pages 1 to 4 block" implementation passed every first-build case and
  failed only on revisions.
- **Verification debt, the biggest one.** Nothing shipped on 2026-07-29
  or 07-30 has been exercised through the live UI. All of it passes unit
  tests, guards, and in one case a real Chrome plus pdf.js E2E, and all of
  that was green; none of it has been clicked. The surfaces: binder
  in-progress shelf, version rail, settings plan section, recorder line,
  dictation cutoff notice, admin tool-failure alert row,
  `describe_attachment` path, and the new parent-facing sentence when a
  later page has a problem. That last one is the cheapest and highest
  value: create a 7-plus page material and read what Homa actually says.
  A session that does nothing but click through these as a `+homatest`
  family would probably retire more risk than the next feature.
- **Test signups must use the `+homatest` email alias**, which
  auto-sandboxes. Never `@example.com`; non-alias test families turn into
  founder-console alerts when their email fails.
- **Watch the first real offer recovery.** Zero offers were recoverable
  when the flag was flipped, so it has never run against a live offer. The
  failure to look for is a **duplicate delivery on the following hour**,
  which would mean the fulfillment ledger's idempotency did not hold. #198
  stays open with exactly that as its close condition.

## 3. Pointers

- **Repo:** `sidneyswift/homa` (local checkout
  `/Users/sidneyswift/Documents/Projects/Sidney/homa`)
- **Branches:** work from fresh branches off `main`. Avoid
  `claude/homa-ingestion-engine-plan-0fba71` (see landmines).
- **Plan folder:**
  `docs/homa-planning/plans/2026-07-28-carolyng-field-study/`, start at
  `README.md`, then `01-findings.md` and `06-council.md`.
- **Arc tracker:** [#359](https://github.com/sidneyswift/homa/issues/359)
- **Open arc issues:** #347, #349, #352, #355, #356, #357, #369, #390,
  plus the never-closed #175, #297, #298, #351
- **Related, not this arc:** #198 (offer recovery), #248 (eval
  determinism), #328 (corpus storage, coordinate with #369)
- **PRs from this session:** #360, #371, #373, #381, #414, #431, #432, #459
- **Key files touched:**
  - `apps/web/lib/materials/review-artifact.ts`, chunked review,
    `planReviewChunks`, `advisoryIssues`
  - `apps/web/lib/materials/render-page.ts`, `RASTER_PAGE_CAP` vs
    `PREVIEW_PAGE_CAP`
  - `apps/web/agent/tools/create_printable.ts`, preview slicing, the
    advisory note, geometry provenance
  - `apps/web/lib/materials/library.ts`, chain-scoped finalize lock,
    in-progress materials
  - `apps/web/lib/billing/wall.ts`, `channel-access.ts`, tier
    recognition and the channel gate
  - `apps/web/app/app/binder/`, in-progress shelf, version rail
  - `scripts/dynamic-tool-events-check.mts`, the guard from #345
- **Ask the founder** any question whose answer would change the work,
  one at a time, in plain language with no jargon. They answer quickly and
  decisively and would rather be asked than have you guess.
