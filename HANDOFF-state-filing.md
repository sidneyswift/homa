# Handoff: Homa state requirements documents and filing service

> **Status: FINISHED: no required in-scope work remains**
> As of: 2026-07-30. Handed off from: Claude Code on Anthropic API. Reason: arc reached its founder-defined definition of done; everything left is either an optional P2 backlog item or blocked on a founder/counsel decision that a coding agent cannot make.

## 1. Goal / Spec

*(Stable. Do not rewrite on later handoffs of this same task, carry it forward verbatim unless the goal itself genuinely changed.)*

### Objective

Original ask: "we have a lot of data on each state's requirements, but nothing implemented that lets Homa create the required documents per family, per state. Build the feature so that, with one button, a family can download and print all of their state's requirements."

That grew, through founder review of the first version, into two distinct products that this repo calls "the pack" and "the filing":

- **The pack** explains what a family's state legally asks of a homeschooling parent (notification, assessment, record-keeping, subjects, compulsory-age rules), derived per family from a reviewed reference table.
- **The filing** is the document the family actually sends to satisfy that requirement: either a ready-to-sign letter (in the handful of states where a parent-composed letter is genuinely accepted) or a filled-in copy-from worksheet (everywhere else), plus a reminder email before it's due and a gentle drip that asks for missing details.

The founder's own words, which are the binding P0/P1 definition: "for every state that requires documentation, deliver the customer exactly what they need by the time they need it, with all information already filled out, meeting all requirements."

### Definition of done

- Every one of the 50 states + DC that state_requirements covers can produce a pack.
- Every filing-required state produces either a real signable letter (only where research + adversarial challenge confirmed a state genuinely accepts one) or a correct, complete worksheet, never a document that could get a family rejected by their state.
- A deadline reminder exists and a gentle "we still need X" drip exists, both gated to Plus/Elite (founder ruling 4) and both dark until legal sign-off (founder ruling 6).
- Nothing Homa generates may state a legal duty that does not actually exist (i.e., stale law must be correctable without waiting for the next data pull).

### Constraints / non-negotiables

- **Six founder rulings, 2026-07-29** (full text in `docs/homa-planning/plans/2026-07-29-filing-service.md`): (1) ask each family once when their school year starts; (2) research state-by-state before generating letters, real letters only where genuinely accepted; (3) missing info gets a drip *and* a deadline-triggered ask; (4) Plus and Elite only: regular families see it exists and are invited to upgrade; (5) at the deadline, send what exists with gaps clearly marked rather than miss the deadline; (6) build it all now, but automatic sending stays off until counsel reviews the wording.
- **Tenant isolation is non-negotiable** (`BUILD.md`): `familyId` only from session auth, never model/client input.
- **No em dash, ever, anywhere**: checked by `pnpm check:em-dash`, which only scans git-tracked files (stage before running or new files are invisible to it).
- **Models judge, code verifies** (`AGENTS.md` binding ruling): never hand-write regex/keyword matching to decide what a sentence *means*; a model proposes, deterministic code validates against a schema/catalog.
- `data/state-requirements/` is seeded only by a reviewed pipeline: never hand-edit it. Corrections to stale or wrong law go through the override layer (`lib/compliance/requirement-overrides.ts`), not the snapshot files.
- Never apply a breaking migration ahead of the code that depends on it (`BUILD.md` deploy law): additive migrations may lead; this repo's Postgres is on Supabase, project ref `kzplntcdtsvdowntvlza`.

## 2. Handoff Status

*(Point-in-time snapshot. Rewrite fresh at every handoff: this is the part that goes stale.)*

### Done: in scope, complete

- **The pack** (#316, merged), with per-pathway truth (#363), real key dates derived from 59 verified statutory anchors across 39 states (#342), and source-honesty separation of official vs. secondary citations.
- **Deadline engine** (#419) and **school-year-start capture** (#418), both merged and live.
- **Filing-method research** (#420): all 40 filing-required states read on their own official sites by one agent each, then every "a letter is acceptable" verdict independently challenged by a second agent whose only job was to refute it, and that challenge changed 7 of 13 candidate verdicts. Seven states now issue a real signable letter: CO, FL, HI, ME, OH, VA, WV. Six stay deliberately unresolved (KY, MA, MT, NY, RI, UT) rather than guessed.
- **The filing document** (PR #437, #421 closed): signable letter in the seven researched states, filled copy-from worksheet everywhere else, an honest "New Hampshire asks for nothing" page for NH.
- **The Binder UI card** for the filing, and the **deadline reminder** email/sweep (#422 closed): built, tested, wired into the hourly cron, **sending kept dark** behind `HOMA_FILING_REMINDERS_ENABLED`.
- **New Hampshire repeal fix** (PR #447, #436 closed): NH repealed its entire home-education notification law on 2026-07-10; the reviewed snapshot was stale (last verified 2026-03-14) and was still telling NH families they owed a filing. Fixed via a general-purpose stale-law override layer, not a one-off patch, so the next state that changes its law has a place to go.
- **Address-completeness fix** (PR #446): a family with a city but no state (or vice versa) was silently treated as "address known": fixed to require the full address before treating it as present.
- **Grade-field fix** (PR #463, #421 follow-up): a "Grade" field was appearing on every filing even though no state's actual notice requirement asks for a child's grade: removed except where a state's own form genuinely asks for it.
- **The gentle details drip** (PR #468, #424 closed): asks a family (Plus/Elite only) for exactly the details still missing from their filing, and only the details a parent can actually act on (not, e.g., "your state's requirement text," which isn't something a parent supplies). Added its own `filing_parent_name` column/settings field so the drip has somewhere real to write the answer. Sending dark behind the same flag as the deadline reminder: this was intentional, see Gotchas.
- **Stranded-materials follow-up** (PR #460, #197 closed) and the **draft-invisibility verification** (#241 closed, confirmed fixed by measurement rather than assumption): these are a materials-library feature, not filing, and got built mid-session as a scope detour; see "Done: but out of scope" below.
- **Issue #324** (superseded ask, "packet fills in state requirements automatically") closed as duplicate/subsumed by the filing document.

### Done: but out of scope

- **Stranded materials chain follow-up (#197) and its data-integrity verification (#241)** happened during this arc's session but are a materials-generation feature, unrelated to state filings. The user caught this mid-session ("i thought we were working on state requirement docs") and work returned to the filing arc immediately after. Both are shipped, tested, and merged; there's no reason to revert them, but a successor should **not** treat their existence as evidence more materials-library work is expected under this handoff: it isn't in scope here.

### Remaining: required, in scope

*(None. The founder's stated P0/P1, "deliver the customer exactly what they need, filled out, by the time they need it," is built, tested, and verified live for every state the reference data covers. What's left is either optional polish or blocked on someone other than a coding agent; see below.)*

### Remaining: nice to have, not required

- **#425**: collect the filing details conversationally instead of via a settings form. `lib/compliance/filing-details.ts`'s `missingFilingDetails()` already computes exactly what's missing per family; this issue is "build the chat-side UX around a function that already exists."
- **#323**: nudge a family to regenerate their pack when the underlying state data has been updated since their last pack.
- **#326**: surface pack/filing awareness from the progress-report surface and give chat context about it.
- **#325**: optional record-keeping templates for states with no filing requirement at all.

### In production now (live)

- The pack: generatable for every reviewed state via `/api/compliance/pack`.
- The filing document: generatable via `/api/compliance/filing`, entitlement-gated to Plus/Elite (currently **0 real families are on Plus or Elite**, see Gotchas).
- All three background sweeps run on the hourly `/api/map/cron` job and write their eligible/skipped counts into `public.cron_runs.counts` even while sending is dark: `stranded` (materials follow-up), `filingDetails` (the drip), `filings` (the deadline reminder). Verified live 2026-07-30 17:01 UTC: `filingDetails.skipped.not_entitled = 93` (i.e. every real family, correctly, since none are Plus/Elite yet), `stranded.eligible = 13`, `sendingEnabled: false` on all three.
- `filing_parent_name` settings field: live, editable, currently 0 of 93 real families have filled it in (brand new field).

### Merged: not yet deployed/live

*(None. This repo auto-deploys `main` to Vercel on every merge, and every PR referenced above was confirmed deployed and spot-checked against production before being called done.)*

### Still in the works (unmerged / in progress / local only)

*(None. Working tree is clean; no local or unmerged branch holds filing/pack-related work. `git status` is empty and local HEAD matches `origin/main`.)*

### Known gotchas / landmines

- **`HOMA_FILING_REMINDERS_ENABLED` gates BOTH the deadline reminder (#422) and the details drip (#424).** This is deliberate, not an oversight: the founder's ruling (6) is that all automatic sending stays off until counsel reviews the wording (#423), and both emails carry the same "this is a legal filing" wording, so they were put behind one flag rather than risk shipping one live while the other stays dark for the same unreviewed reason. `HOMA_STRANDED_FOLLOWUP_ENABLED` is a separate flag for the unrelated materials feature. **Do not flip either flag**: that's the founder's decision, gated on #423.
- **0 real families are on Plus or Elite.** The whole filing service is invisible to every current customer today because of the entitlement gate (founder ruling 4): this is working as designed, not a bug to fix.
- **Migrations must be applied to prod *before* merging code that selects the new column**, never the other way: this repo has a documented prior near-miss (#428) where the order was reversed. `filing_parent_name` (added this arc) was applied to Supabase first, then the code that reads it was merged, as a deliberate demonstration of getting the order right.
- **`pnpm check:em-dash` only scans git-tracked files**: run it after `git add`, not before, or new files pass invisibly.
- **This repo squash-merges every PR.** Always branch fresh off `origin/main`; a branch cut from another feature branch will conflict with `main` once that branch's PR is squash-merged, even though the content is identical.
- **CI on `main` shows red evals independent of any change here** (flaky suite, unrelated). Verify a specific failing eval locally before assuming a PR broke it.
- **Read the actual bill/act text for a law change, not the codified statute page.** New Hampshire's own government site's codified-statute page still displayed sections that had been repealed by an act passed weeks earlier. The bill/act text is the source of truth for anything recently changed; the "clean" codified page can lag.
- **A derived/joined value can be non-empty even when the underlying data is incomplete** (the address bug, PR #446): always check the source fields, not a string built from them, when deciding whether something counts as "known."
- **Only ask a parent for details they can actually supply**, and only ask a state for exactly what its own notice requirement names (the grade-field bug, PR #463): inventing a field nobody asked for, or asking a parent for something not in their control, both produce a wrong/annoying document rather than a helpful one.
- **Render every generated document and look at it, don't trust unit tests alone.** At least one letter-formatting defect (address fix, PR #446) was only caught by rendering an actual PDF and reading it, not by the test suite.

## 3. Pointers

- Repo: `sidneyswift/homa` (GitHub), working tree at this session's path
- Branch: `main` (local HEAD `c2a21fb1`, matches `origin/main`)
- Relevant PRs (all merged): #316, #363, #342, #418, #419, #420, #437 (#421), #422, #436 → #447, #446, #421-followup → #463, #424 → #468, #197 → #460, #470 (this doc's predecessor)
- Relevant issues:
  - Closed: #197, #241, #316, #324, #363, #342, #418, #419, #420, #421, #422, #424, #436
  - Open, P2 backlog (not required, pick up any time): #323, #325, #326, #425
  - Open, blocked on founder/counsel decision (do not build ahead of the ruling): #317, #318, #319, #320, #321, #423
- Key files:
  - `apps/web/lib/compliance/pack.ts`, `filing-letter.ts`, `filing-document.ts`, `filing-store.ts`, `filing-method.ts`, `filing-methods.data.ts`, `deadlines.ts`, `school-year.ts`, `filing-reminder.ts`, `filing-reminder-sweep.ts`, `filing-details.ts`, `filing-details-drip.ts`, `filing-details-sweep.ts`, `requirement-overrides.ts`
  - `apps/web/lib/materials/stranded-chains.ts`, `stranded-sweep.ts` (out-of-scope materials feature, see above)
  - `apps/web/app/api/compliance/pack/route.ts`, `apps/web/app/api/compliance/filing/route.ts`
  - `apps/web/app/app/binder/state-pack-card.tsx`, `state-filing-card.tsx`
  - `apps/web/app/api/map/cron/route.ts` (hourly sweep entry point)
  - `supabase/migrations/20260730120000_family_filing_parent_name.sql`
  - `docs/homa-planning/plans/2026-07-28-state-pack.md`, `2026-07-29-filing-service.md` (specs/rulings)
  - `data/state-requirements/` (reference data, read-only, seeded by a separate reviewed pipeline)
