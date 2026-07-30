# Handoff: Homa state requirements and filing service

You are picking up the **state requirements documents** arc in the Homa
repo. Read `AGENTS.md` and `BUILD.md` first; they override anything here.

## What this arc is

A family in a state that regulates homeschooling has two needs. Homa now
serves both, and they are deliberately separate products:

| | What it is | Where |
|---|---|---|
| **The pack** | EXPLAINS what your state asks for. Per-family PDF from the reviewed `state_requirements` snapshot. | `POST /api/compliance/pack`, `lib/compliance/pack.ts` |
| **The filing** | The document you ACTUALLY SEND. | `POST /api/compliance/filing`, `lib/compliance/filing-letter.ts` |

Both surface on `/app/binder` as separate cards.

Spec: `docs/homa-planning/plans/2026-07-28-state-pack.md` (council, D1-D20)
and `docs/homa-planning/plans/2026-07-29-filing-service.md` (founder
rulings 1-6).

## Shipped and verified live in production

All merged to `main` and deployed. Every one was verified by generating a
real document in prod against a `+homatest` sandbox family and reading the
PDF, not just by green tests.

- **The pack** (#316) with per-pathway truth (#363), real key dates from
  59 verified anchors across 39 states (#342), and source honesty.
- **Deadline engine** (#419) and **school-year start** (#418).
- **Filing research** (#420): all 40 filing states read on their own
  sites, then every "letter" verdict challenged by a second agent told to
  refute it. **That challenge flipped 7 of 13.** Seven letter states
  survive: CO FL HI ME OH VA WV. Six stay deliberately absent (KY MA MT
  NY RI UT) because sources did not settle it; absence is the safe answer.
- **The filing document** (#421): ready-to-sign letter in those seven,
  filled copy-from worksheet everywhere else, "nothing to file" in NH.
- **The Binder button** and the **deadline reminder** (#422, dark).
- **NH repeal** (#436): NH repealed its whole framework 2026-07-10, four
  months after our snapshot. Fixed via a general override layer.
- **The details drip** (#424, dark) plus a new `filing_parent_name`
  column and settings field.

## What is DARK right now, and why

`HOMA_FILING_REMINDERS_ENABLED` gates BOTH the deadline reminder (#422)
and the details drip (#424). Shared on purpose: counsel reviews the
wording as one thing, and turning on the urgent message while leaving the
calm one dark is the wrong half.

**It stays dark until #423 (counsel review) is answered.** Founder ruling
6, 2026-07-29: "build it all now, but the automatic emails stay switched
off until a lawyer reviews the letter wording." The actual wording and
four specific questions are already posted on #423. Do not flip this flag
yourself.

`HOMA_STRANDED_FOLLOWUP_ENABLED` gates the stranded-chain follow-up
(#197). Also dark, also not yours to flip.

Both sweeps RUN while dark and report eligible counts in `cron_runs`, so
the founder can see what would go out. Confirmed working: the 07:00 UTC
tick on 2026-07-30 reported `stranded: {eligible: 13, sent: 0,
sendingEnabled: false}`.

## Next work, in priority order

1. **#425 (P2) chat version of the details drip.** Collect the same
   details conversationally instead of via a settings form. The pure
   `missingFilingDetails()` in `lib/compliance/filing-details.ts` already
   tells you exactly what to ask for; this is the agent-side surface.
2. **#323 (P2)** regeneration hint when snapshot data is newer than the
   family's pack.
3. **#325 (P2)** optional record templates for no-requirement states.
4. **#326 (P2)** more entry points (report surface, chat awareness).
5. **Founder-gated, do not build:** #423, #318, #319 (ratify judgment
   calls), #317, #320, #321.

## Laws specific to this arc, learned the hard way

- **Read the ACT, not the code.** On 2026-07-29 the New Hampshire General
  Court's own codified RSA 193-A page still showed sections the
  legislature had repealed. Reading the code would have confirmed the bug
  rather than the fix. Find the bill or amendment text.
- **Snapshots lag legislatures.** `lib/compliance/requirement-overrides.ts`
  is the seam, applied inside `getStateRequirementsDetail` so the pack,
  filing, Binder cards and compliance answers all get corrected in ONE
  place. An override may only REMOVE a duty, never add one; needs an
  official source, a human read date, an effective date and a verbatim
  quote; goes stale at 180 days; failing back to the snapshot is safe
  because the snapshot overstates duties.
- **Never hand-edit `data/state-requirements/`.** It is seeded by a
  reviewed pipeline. Corrections go in the override layer.
- **A non-empty string is not evidence a field is present.** A family with
  a state and no city printed a bare "OH" as their address line, and
  because that string was truthy the missing city and zip were never
  named as a gap. Check presence on the SOURCE field, not a derived one.
- **Ask only for what a state actually asks for.** No letter state
  requires grade; Arkansas and New Mexico do, and both are form states.
  A Grade column on every document invented a blank nothing wanted.
- **Ask only for what a parent can actually fix.** The drip's list is
  deliberately narrower than the document's blanks. Colorado's planned
  hours, Virginia's curriculum list and statutory qualification have no
  home in settings, so they are never nudged for: a nudge for something
  unfixable never completes, which is nagging forever.
- **Render it and LOOK at it.** Four defects in the filing letter passed
  every unit test and were obvious in the JPEG: a salutation made of
  research prose ending ".:", New Hampshire signing a letter addressed to
  "Nothing is filed with any state agency", required fields recited
  instead of answered, and assurances reading as fragments.

## How to verify your work

```bash
pnpm check:state-pack          # 272 tests, all 51 snapshots
pnpm tsx scripts/state-pack-render-smoke.mts all    # real Chromium, 51 packs
pnpm tsx scripts/filing-render-smoke.mts all        # 102 filings, must be 1 page each
```

Then verify in PRODUCTION, which is the standard on this arc. Pattern:
pick a sandbox family (`coalesce(sandbox,false)=true`), mint a
`link_tokens` row with `kind='homa_map_resume'` whose `token_hash` is the
plain sha256 of your token, send it as the `homa_map_resume` cookie,
`POST` the route, fetch the PDF (it 302s to Blob, so use `curl -L`),
convert with `pdftoppm` and READ it. **Then delete the token and restore
anything you changed.** Supabase MCP is authorized on `homa-prod`
(`kzplntcdtsvdowntvlza`).

## Repo traps that cost real time this session

- **`pnpm check:em-dash` scans git-TRACKED files only.** Run it AFTER
  `git add`, or new files are silently unscanned.
- **`package.json` conflicts on every merge** in the `check:*` test
  lists. Union by key, then diff against `origin/main` to prove nothing
  was dropped. Verify with a script, not by eye.
- **A PR with merge conflicts does not run CI at all.** GitHub cannot
  build the merge commit, so `build-and-check` never appears and the PR
  looks stuck rather than blocked. If checks are missing, check
  `mergeable` first.
- **Branches are squash-merged**, so a branch cut from another feature
  branch conflicts with main afterward. Always cut from fresh
  `origin/main`.
- **Merging a migration does NOT apply it.** Apply additive columns to
  prod BEFORE merging code that selects them. `filing_parent_name` was
  applied via MCP `apply_migration` first, deliberately.
- **The shell's cwd drifts.** Use absolute paths or `cd` to the repo root
  in every command; `apps/web/package.json` has six scripts and the root
  has a hundred, and confusing them produces nonsense diffs.
- **Evals are red on `main`** with a different failing set every run
  (a known `lesson-plan-routing` tracker plus flakes). Re-run the specific
  eval locally before blaming your PR.
- `check:docs` fails on main too; it is the zero-open completion gate.

## Prod reality, 2026-07-30

- **ZERO families on Plus or Elite.** Founder ruling 4 gates the whole
  filing service to those tiers, so it currently ships to an audience of
  nobody. This is expected, not a bug.
- 90 real families: 42 have a full name, 40 a full address, **0 have a
  school-year start**, 2 are in the grade states (AR, NM).
- That is the real ceiling on "we already filled it all out", and why
  #424 exists.
