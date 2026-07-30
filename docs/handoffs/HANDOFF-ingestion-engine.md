# Handoff: Ingestion engine rebuild (training-corpus-grade capture and validation)

> **Status: NOT FINISHED, see Handoff Status below**
> As of: 2026-07-30. Handed off from: Claude Code (Anthropic API), branch `cosmo/ingest-2026-07-29-fast-forward`. Reason: session continuation / model switch.

## 1. Goal / Spec

*(Stable. Carry forward verbatim on future handoffs of this same task.)*

### Objective

Homa's ingestion engine (Alessa and Carolyng drop books, worksheets, and curriculums into Slack `#homa-inspo`, an agent analyses each drop and graduates lessons into the product) was analysing form but discarding the underlying data: the durable artifact per drop was often just one un-OCR'd PDF, or nothing at all. The founder's broader goal (`docs/homa-planning/plans/2026-07-28-training-corpus-ingestion.md`, tracked in gh#328) is that everything ingested must stay usable later for training a model, not just for making the live product smarter today.

This work rebuilt the ingestion pipeline to:
1. Capture every drop as durable, page-level data, not just an analysis of it.
2. Add a sixth analysis dimension ("aboutness": what a drop is actually about, span-verified against extracted text) so the corpus becomes searchable by content, not just by form.
3. Build a ledger that proves, deterministically, joined on Slack message ID and never on filename, that every drop in the channel has exactly one correct, verifiable record.
4. Wire that ledger into CI so this can never silently regress as volume scales into the hundreds of thousands of pages the founder is planning to capture.

Plain-language restatement: make it so nothing dropped in Slack can ever again be silently lost, mis-recorded, or duplicated, and make every future drop leave behind data a model could actually be trained on, not just a paragraph describing it.

### Definition of done

- Every drop in `#homa-inspo` maps to exactly one analysis record, joined by Slack message ID, never by filename or title.
- Every analysed drop has: (a) a durable copy of the original in Vercel Blob storage, (b) per-page master images plus an extracted text sidecar, (c) all five original analysis dimensions, (d) the new "aboutness" dimension (dimension F) with every claim backed by a verbatim, code-verified quote against the extracted text.
- `pnpm check:ingestion` passes in CI and fails loudly if a future drop goes un-recorded or duplicated.
- The book-capture pipeline (`book-intake.py`) and its gates (blur, duplicate, rotation, blank page, model-read failure) are proven against real captured books, not just synthetic fixtures. Every threshold in this codebase was wrong on first try when tested against a real book, and each fix became a permanent regression fixture.
- PR #389 merges cleanly into `main`.

### Constraints / non-negotiables

- Identity is the Slack message timestamp, never the filename or title. A prior hand-audit that joined on filename text caused three duplicate records and four taste signals credited to the wrong founder. This is the load-bearing lesson of the whole effort, see Gotchas.
- No em dash anywhere, in code, docs, commit messages, or this file. `pnpm check:em-dash` enforces it repo-wide on every git-tracked file; the sibling handoff doc in this directory (`docs/handoffs/HANDOFF-state-filing.md`) is tracked and complies, so treat any doc you write here the same way.
- Fresh branch, PR only, never push directly to `main`.
- Tenant-isolation rules (familyId scoping) do not apply to this work, it is founder-facing internal tooling, not family-facing product code. But `check:isolation` still applies to anything you touch under `apps/web/agent/` or Postgres.
- Changes under `apps/web/agent/` require `VERCEL=1 pnpm --filter web exec eve build` locally before pushing, because Vercel runs `eve build` outside Next's bundler and a green `pnpm build` alone is not sufficient. This was already done for `apps/web/agent/tools/create_printable.ts` and `apps/web/lib/materials/render-page.ts` earlier in this branch's history. Re-run it if you touch those files again.
- Model gateway auth is Vercel OIDC only, never a gateway API key (founder ruling 2026-07-27). `apps/web/scripts/page-read.mts`, the vision reader, depends on a fresh `VERCEL_OIDC_TOKEN`, refresh via `pnpm dev:token` (lasts about 12 hours).
- Do not post to Slack (thread replies, `:ship:` reactions) without the founder's explicit go-ahead. Both are public-facing actions taken on the founders' behalf.
- Founder decisions D4, D6 through D10 on gh#328 (training-corpus architecture) are not yours to make. Do not act on them; they are listed there for whoever picks up that separate thread.

## 2. Handoff Status

*(Point-in-time snapshot as of 2026-07-30. Verified against actual repo, CI, and issue state at write time, not from memory.)*

### Done, in scope, complete

- `book-intake.py` (`.cosmo/scripts/`): turns one captured book PDF into per-page master images plus an extracted-text sidecar (`.cosmo/text/<id>.txt`) plus a provenance manifest. Mixed OCR strategy: PDF text layer where present, else tesseract, plus a vision-model pass (`apps/web/scripts/page-read.mts`) on pages OCR cannot read honestly (covers, low-text-yield pages, garbled reads). Six deterministic gates: page count, blank page, blur (99.9th-percentile gradient magnitude versus the book's own median, not an absolute threshold), duplicate (requires both text similarity and image-hash similarity, with a "family" rule so three or more near-identical pages are treated as structure or boilerplate, not a duplicate pair), rotation (auto-detected and corrected for OCR without touching the master image), and model-read-failure tracking. `--revision` flag redoes only the vision pass without re-running OCR. `--self-test` runs 10 regression fixtures, all derived from real capture failures. Currently 10 of 10 passing.
- `verify-ingestion.py` (`.cosmo/scripts/`): the 12-step gate deciding whether a drop's record is complete and correct, including the new dimension F (aboutness) verification, every claimed subject, entity, or theme must carry a verbatim quote that is checked against the actual extracted text sidecar. `--self-test` runs 22 fixtures. Currently 22 of 22 passing.
- `ingestion-ledger.py` (`.cosmo/scripts/`): joins every Slack drop, by message timestamp, to its analysis record. `--refresh` re-pulls Slack history (needs `SLACK_BOT_TOKEN`); `--check` is the CI-safe mode, no network needed, validates against a committed snapshot. Wired as `pnpm check:ingestion` in `.github/workflows/ci.yml` line 281 and `package.json` line 25. Currently reports: 95 drops total, 13 complete, 39 legacy (predates the aboutness rules, no captured text), 37 partial, 6 excluded (the bot's own posted output, not real drops), 0 un-ingested, 0 duplicated.
- `ingestion-spreadsheet.py`: renders the ledger as an xlsx (Summary, Drops, Queue sheets) for the founder.
- `rescue-originals.py`: downloads a drop's original from Slack and uploads it to Vercel Blob when no durable copy is on record. Idempotent, safe to re-run. 87 of 89 analysed drops now have a durable Blob copy, up from a much lower baseline at session start. The two remaining are thread replies that `conversations.history` cannot reach (see Gotchas, not a lost file, a tooling limitation).
- 10 books fully captured and analysed this session, all passing all 12 verify-ingestion steps, including the highest-value find: two of Sid's earliest drops (a PEMDAS foldable and a five-paragraph essay outline) had each already shipped as a materials-studio recipe plus a golden anchor with zero analysis record behind them, the exact failure mode this whole rebuild exists to prevent.
- gh#443 (duplicate 100-Easy-Lessons records) resolved in commit `72b01d86`: `cur-2026-07-19-teach-child-read-100-lessons` merged into and deleted in favor of `cur-2026-07-19-100-easy-lessons` (the materially richer record: 27 of 27 topics mapped versus 5 partial). `check:ingestion` now reports zero duplicates.
- Six real bugs found and fixed, each via testing against actual captured books rather than reasoning from first principles (see Gotchas for detail, this pattern is the single most important lesson of this branch):
  1. Blur gate used an absolute threshold, causing false positives on sharp but dark or colorful pages. Now relative to the book's own median.
  2. Duplicate gate used text-only or image-only similarity, causing false positives on boilerplate or templated pages. Now requires both, with a rule that three or more similar pages means structure, not a duplicate.
  3. Vision model output budget was too small for dense pages such as photo-credits pages, so silent truncation read as a model failure.
  4. Vision reader hardcoded the media type to JPEG, which silently broke the entire born-digital-PDF ingestion lane (PNG-rendered pages sent with the wrong MIME type, so the model rejected every one, logged as an opaque failure).
  5. Page-extraction rule treated "exactly one embedded image" as "this is a scanned photo page," which wrongly extracted a tiny 53 by 53 point decorative glyph as if it were a whole page, discarding the real page content.
  6. Blob upload path was not percent-encoded, so every filename containing a space or bracket (common, for example "good and the beautiful .pdf") failed the upload silently.
- Percent-encoding fix plus a full re-run of rescue-originals: 23 previously-failed uploads (all due to bug 6 above) now succeed, zero failures.
- All commits pushed to `cosmo/ingest-2026-07-29-fast-forward`. Branch merged with the latest `origin/main` as of commit `c68f008f` (working tree clean).

### Done, but out of scope

None identified. All work this session was in direct service of the ingestion-engine rebuild objective.

### Remaining, required, in scope

- Confirm PR #389 merges. As of this handoff, CI is running on the latest push (merge commit `c68f008f`, triggered by syncing with `origin/main`). The last known fully-green run was on commit `72b01d86`. Run `gh pr checks 389 --repo sidneyswift/homa` to check current status, and `gh pr view 389 --repo sidneyswift/homa --json mergeable,mergeStateStatus` to check merge eligibility. If green and mergeable, merge it. Do not merge without confirming CI is green. `check:ingestion` in particular is a hard gate this branch itself introduced, so a red run here likely means real ingestion state regressed, not a flaky test.
- Close or comment on issues once the PR lands:
  - gh#442 ("5 drops with no record, all marked :ship:") is functionally resolved (a comment already explains the two false positives were bookkeeping, not real gaps, and the three real ones are done via gh#462), but the issue itself is still open. Close it once PR #389 merges.
  - gh#443 (duplicate 100-Easy-Lessons records) is resolved in commit `72b01d86`, but has zero comments and is still open. Post a closing comment referencing the commit, then close.
  - gh#462 is already closed, no action needed.
- gh#444 ("38 legacy records have no aboutness and no captured text") is genuinely not done. The ledger currently shows 39 legacy records, drift up by one from the 38 the issue title cites. Worth reconciling: either the issue count needs updating or a new legacy record appeared. Check the `python3 .cosmo/scripts/ingestion-ledger.py --check` output for the current list. These are analysed-but-thin records predating the aboutness rules. Backfilling means running `book-intake.py` plus writing dimension F for each. This is the single biggest remaining value-add and should be next after the PR merges. See also the note on gh#366 and gh#367 below, this may be the same tracked debt.
- gh#445 ("22 records name recipe gaps that open-gaps.json does not track") is not done. `.cosmo/open-gaps.json` currently tracks 77 gaps; cross-reference against records' `recipeMatch.gaps` fields to find the untracked ones.
- The two originals still not rescued (`ref-2026-07-18-azar-basic-english-grammar`, `ref-2026-07-18-reading-options-achievement`) are both Slack thread replies, which `conversations.history` does not return. Fixing `rescue-originals.py` (or `ingestion-ledger.py`'s Slack-pull logic) to also walk `conversations.replies` for threaded messages would close this permanently. Low volume, two files, but worth doing for completeness before this pipeline runs at scale.

### Remaining, nice to have, not required

- Automate periodic `ingestion-ledger.py --refresh` (for example a scheduled job) so the ledger snapshot does not silently drift stale between sessions. Right now it is refreshed manually.
- Extend `rescue-originals.py` to thread replies (see above) as a standing capability, not a one-off fix.

### In production now (live)

- Nothing from this branch has been deployed or merged to `main` yet. All work is in PR #389, unmerged as of this handoff.
- PR #329 ("Plans: training-corpus ingestion architecture") is already merged to `main` (commit `177dd3e8`), and it is not just a planning doc. It shipped the actual dimension F ("aboutness") and Layer 5 (curriculum decomposition) implementation: `.agents/skills/reference-ingestion/references/aboutness.md`, `.agents/skills/curriculum-ingestion/references/lesson-decomposition.md`, `.cosmo/scripts/verify-ingestion.py`, `.cosmo/scripts/corpus-search.py`, plus 18 or more self-test fixtures. That PR closed the feature-build work for gh#366 and gh#367 (both issues carry closing-style comments confirming this), but the issues themselves are still open, deliberately, per their own comments, because they explicitly track the backfill debt: 188 refs and 23 curriculums not yet re-processed under the new dimension F and Layer 5 rules, blocked at the time on getting original files off one laptop, gh#328 founder action. This branch's work is the continuation of that same backfill, and gh#444 ("38, or now 39, legacy records") is very likely the same debt gh#366 and gh#367 are tracking, just restated after this session made a dent in it (originals rescue, 10 books fully backfilled). Reconcile #366, #367, and #444 into one tracking issue rather than treating them as three separate items before doing more backfill work, check whether closing #444 into #366 plus #367, or the reverse, makes more sense once you have read all three.

### Merged, not yet deployed or live

Not applicable. This is a Vercel-deployed Next.js app; once PR #389 merges to `main`, Vercel auto-deploys. There is no separate merged-but-not-live gap for this repo's normal flow. Confirm the deploy goes green after merge (check the Vercel dashboard or `gh pr view` deployment status) since some past incidents in this repo were caused by schema or code deploy-order issues, though this branch has no migrations, so that specific risk does not apply here.

### Still in the works (unmerged, in progress, or local only)

- Everything above under Remaining lives only on branch `cosmo/ingest-2026-07-29-fast-forward`, PR #389, currently open with CI in progress on the latest commit as of this handoff.
- No uncommitted local changes. The working tree was confirmed clean at handoff time (a stray regenerated-timestamp diff in `.cosmo/ingestion-ledger.json` was discarded via `git checkout --` since it was pure noise from re-running verification).

### Known gotchas / landmines

- Identity must be the Slack message timestamp, never filename or title. This is the root cause of the biggest mistake in this branch's history: an earlier hand-audit joined records to Slack drops by filename or title text, which silently created three duplicate analysis records and credited four taste signals to the wrong founder (the two founders' names were not disambiguated correctly). `ingestion-ledger.py` exists specifically to make this impossible going forward. Never bypass it with a manual filename-based check.
- Re-extraction of already-verified content is not a safe no-op. When the rotation-detection gate was added and applied retroactively, it changed the OCR output for previously-analysed pages, which broke five previously-verified aboutness claims whose quotes no longer matched the re-extracted text. Four were re-anchored to the corrected text; one genuinely unsupportable claim was dropped rather than kept. Any time you re-run OCR or extraction on an already-analysed item, re-run `verify-ingestion.py` on it afterward. Do not assume old verified claims still hold.
- Every gate or threshold in `book-intake.py` was wrong on first implementation, caught only by testing against real books, not synthetic fixtures. See the six bugs listed above under Done. The pattern: write the gate, test it against a handful of real captured books immediately, expect it to be wrong, fix it, and turn the specific failure into a permanent fixture in `--self-test`. Do not trust a gate that has only been tested against synthetic or fixture data; this codebase has direct proof that approach misses real failure modes.
- `VERCEL_OIDC_TOKEN` expires in about 12 hours. If `page-read.mts` (vision reads) starts failing with auth errors, that is almost certainly the cause. Run `pnpm dev:token` to refresh; do not assume the vision pipeline itself broke.
- `SLACK_BOT_TOKEN` lives in the main worktree's `.cosmo/.env`, not this worktree's; worktrees do not share dotfiles. Needed for `ingestion-ledger.py --refresh` and `rescue-originals.py`.
- `BLOB_READ_WRITE_TOKEN`, pull via `vercel env pull` inside `apps/web`. Needed for `rescue-originals.py`.
- CI's `check:ingestion` step is a hard, correct gate. Do not weaken it if it fails. It failed once during this branch's life, correctly, on the gh#443 duplicate; the fix was to resolve the actual duplicate, not loosen the check. If it fails again, assume the ingestion state genuinely regressed and investigate the real cause before touching the check itself.
- The legacy record count may have drifted. gh#444's title says 38 legacy records; the ledger currently reports 39. Reconcile this (check whether a new legacy-shaped record appeared, or whether the original count was off) before treating either number as ground truth. Always re-run `pnpm check:ingestion` locally rather than trusting a cited number.
- `apps/web/scripts/page-read.mts` is new in this branch (222 lines), it is the vision-model reader, invoked by `book-intake.py`'s vision-pass step. If you need to debug why a page's OCR or vision extraction looks wrong, start here.
- `.cosmo/text/` and `.cosmo/masters/` are fully gitignored, confirmed zero files tracked in git. All extracted-text sidecars and per-page master images for every analysed drop, this session's 10 books included, exist only on this local machine or worktree, never in the git history. A fresh clone of this branch (or `main` after merge) will have all the analysis-record JSONs but none of the underlying page images or text sidecars. This is intentional (extracted text of a copyrighted book is itself the copyrighted work, the "inspo-originals-offrepo" ruling), but it means two things: first, do not assume `.cosmo/text/<id>.txt` exists just because a record references it, regenerate via `book-intake.py` if it is missing locally; second, the real durability backstop for this data is the Vercel Blob uploads done via `rescue-originals.py`, not git. If this machine's `.cosmo/text/` and `.cosmo/masters/` directories are ever lost, all 10 of this session's books, and everything before it, need to be re-run through `book-intake.py` from their Blob-hosted originals. The analysis JSONs alone are not enough to regenerate them from nothing.
- gh#366 and gh#367 (aboutness tagging, curriculum decomposition) are closely tied to this branch's scope, see the PR #329 note above. Do not treat them as unrelated background issues.

## 3. Pointers

- Repo: `/Users/sidneyswift/Documents/Projects/Sidney/homa` (this worktree: `/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/ingestion-engine-model-training-344eb4`)
- Branch: `cosmo/ingest-2026-07-29-fast-forward`
- Relevant PR: [#389](https://github.com/sidneyswift/homa/pull/389), "Ingest: Fast Forward Level E, and the gate fixes its first real book forced" (open, CI in progress at handoff time)
- Also relevant, already merged with real code, not just a plan doc: [#329](https://github.com/sidneyswift/homa/pull/329), training-corpus ingestion architecture, commit `177dd3e8`
- Relevant open issues:
  - [#442](https://github.com/sidneyswift/homa/issues/442), 5 drops with no record, functionally resolved, needs closing after merge
  - [#443](https://github.com/sidneyswift/homa/issues/443), duplicate 100-Easy-Lessons records, resolved in `72b01d86`, needs closing comment and close
  - [#444](https://github.com/sidneyswift/homa/issues/444), 38 (or now 39) legacy records need backfill, not done, next priority, likely overlaps #366/#367
  - [#445](https://github.com/sidneyswift/homa/issues/445), 22 untracked recipe gaps, not done
  - [#328](https://github.com/sidneyswift/homa/issues/328), parent training-corpus architecture issue, founder decisions D4, D6 through D10 open, not yours to resolve
  - [#366](https://github.com/sidneyswift/homa/issues/366), [#367](https://github.com/sidneyswift/homa/issues/367), feature-build shipped via PR #329, left open to track the same backfill debt as #444
  - [#462](https://github.com/sidneyswift/homa/issues/462), closed, no action needed
- Key files touched (91 files changed versus `main`, plus 15540 and minus 1202 lines):
  - `.cosmo/scripts/book-intake.py`, capture pipeline and gates
  - `.cosmo/scripts/verify-ingestion.py`, 12-step per-record validation gate
  - `.cosmo/scripts/ingestion-ledger.py`, Slack-to-record join and CI check
  - `.cosmo/scripts/ingestion-spreadsheet.py`, xlsx export
  - `.cosmo/scripts/rescue-originals.py`, Slack-to-Blob durability rescue
  - `apps/web/scripts/page-read.mts`, vision-model page reader, new
  - `.cosmo/references/*.json`, `.cosmo/curriculums/*.json`, individual drop analysis records
  - `.cosmo/open-gaps.json`, tracked recipe gaps, 77 entries
  - `.github/workflows/ci.yml` (line 281), `package.json` (line 25), `check:ingestion` CI wiring
  - `apps/web/agent/tools/create_printable.ts`, `apps/web/lib/materials/render-page.ts`, touched earlier in branch history, already `eve build` verified
