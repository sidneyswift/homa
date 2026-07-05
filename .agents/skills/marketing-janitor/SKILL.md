---
name: marketing-janitor
description: Reservoir hygiene for marketing/signals/ plus scorecard trend reporting. Archives old used signals, flags stale and duplicate ones for founder review (never auto-deletes), and summarizes scorer pass rates over time. Use monthly or when the reservoir feels cluttered. NOT for touching content/drafts/ or content/published/ (bundles are the distributor's and founder's domain) and NOT for generating new signals (marketing-idea-generator).
---

# Marketing janitor

Keeps the reservoir honest so the orchestrator's "pick the strongest unused
signal" step stays cheap and true. Boring on purpose.

## Procedure

1. Read `marketing/AGENTS.md` if not already in context.
2. Walk every file in `marketing/signals/`:
   - `status: used` and older than 60 days (by `id` date): set
     `status: archived`. Archived signals stay in place as history; nothing
     is moved or deleted.
   - `status: new` and older than 90 days: leave the status alone, flag it in
     the report as stale (it either becomes `evergreen`, gets used, or the
     founder kills it).
   - `evergreen`: never expires, skip.
3. **Duplicates.** Compare hooks across all non-archived signals (normalized,
   case-insensitive, near-match counts). List suspected duplicate pairs in
   the report for the founder to resolve. Never auto-delete or merge; a
   wrongly merged signal loses a real source.
4. **Broken grounding.** Any signal whose `source.ref` no longer resolves gets
   flagged loudly (this should never happen; if it does, something moved a
   raw file).
5. **Scorecard trends.** Read `marketing/evals/scorecards/*.json`: pass rate
   over time, which check fails most, any repeat offender phrases (candidates
   for permanent banlist lines in `marketing/voice/house-style.md`).
6. Write the report to `marketing/reports/<yyyy-mm-dd>-janitor.md` and commit:
   `Marketing: janitor report <yyyy-mm-dd>`.

## Laws (marketing/AGENTS.md, restated)

Never touch `content/drafts/` or `content/published/`. Never delete signals
(archive and flag only). Never publish anything. No family data.
