# Under the Hood: The Story-Coach Benchmarking & Scoring System

**Date:** 2026-07-25
**Subject:** How Homa tracks where Story actually is developmentally, researches what "ahead" looks like, scores him against it weekly, and turns that into a dashboard, a Slack digest, and next week's plan, all with only ~10 minutes of Alessa's input per week. Traced from `skills/homa-track-story-coach/SKILL.md`, `story-profile.json`, a real nightly research run (session `25993e84`, 2026-07-25 02:14am ET), and the dashboard-generation scripts.
**Purpose of this series:** Documenting Homa's mechanisms for porting the concepts into the Homa cloud app (different harness). Same structure as prior entries: **concept (portable)** / **OpenClaw implementation (replaceable)** / **porting notes & gaps**. Related: [2026-07-21, Spanish worksheet generation](2026-07-21-spanish-worksheet-generation.md), [2026-07-25, Nightly self-improvement loop](2026-07-25-nightly-self-improvement-loop.md) (a sibling autonomous night-cron system; this doc's loops are the *content* engine, that one is the *machinery* engine).

---

## The core idea

Sidney's stated vision for this system, verbatim from the skill file: *"Get industry standards, child standards, get story's baselines, and then score and improve, and let homa do the work at night."*

The shape that produces: **Alessa is the executor, Homa is the analyst.** The system runs even if Alessa inputs nothing for a week, research happens nightly, scoring happens weekly, gaps get tracked, a plan gets drafted. When she does report something, it flows into the same structured model and updates everything downstream automatically. The target isn't "keep up with age-appropriate", it's explicitly tiered: 24 months ahead cognitively, 12 months ahead motor, per Sidney's stated goals.

---

## Layer 1: One machine-readable source of truth, everything else is a *view*

**Concept:** The single most important architectural decision in this system is that there is exactly one place development state lives, and every human-facing surface (Obsidian pages, a Vercel dashboard, Slack digests) is a *generated, disposable rendering* of it, never edited directly.

**OpenClaw implementation:**
- `story-profile.json`, the single source of truth. Schema: DOB → computed age (5 fields, recalculated on every write) → 15 domains → subdomains → `{current, verified, confidence, story_position, target_band}`.
- **`story_position` vocabulary:** `below_age` (priority gap) / `at_age` / `12mo_ahead` (Sidney's stated target) / `24mo_ahead` (advanced) / `unknown` / `n/a` (e.g. Spanish age-bands don't exist against English-monolingual benchmarks).
- **`confidence` vocabulary, with automatic time-decay:** `high` (verified ≤14d, direct observation) → `medium` (14–30d, or indirect/parent report) → `stale` (30–60d) → `expired` (>60d, treated as `unknown`). The weekly scoring run is what actually applies the decay, confidence doesn't silently rot in real time, it's recomputed on a cadence.
- Every other artifact is downstream and regenerated, never hand-edited: the Obsidian vault pages (`Home.md`, `Story.md`, 15 `Subjects/{Domain}.md`, `index.md`), the Vercel dashboard, per-subdomain `activities/{domain}__{subdomain}.json` (×76, one per domain×subdomain pair, rendered as web pages).

**The non-negotiable rule (in caps in the skill file):** *any* write to `story-profile.json` must be immediately followed by `python3 scripts/regenerate_vault.py`, idempotent, sub-second, rebuilds every downstream view. The skill file states plainly why this exists: *"Without regeneration, the brain gets smarter but Less's view stays stale. This is how she lost trust in the system the first time. Don't let it happen again."*, i.e. this rule exists because it was violated once and cost trust. As a backstop, the weekly cron re-runs the regenerator unconditionally at the end, capping worst-case staleness at one week even if a manual step gets skipped.

**Porting notes / gaps:**
- This is the highest-leverage pattern in the whole doc series so far: **one normalized state store, N generated read-only views, one regeneration function called after every write, plus a scheduled backstop regeneration** in case a call site misses it. Directly portable to any harness/DB, swap the JSON file for a table, the vault-page templates for whatever rendering the cloud app uses.
- Gap: the cloud app needs its own "regenerate all views" function and the discipline (ideally enforced in code, not just instruction text) to call it after every state write, plus a scheduled fallback pass, since "the agent forgot to call it" is a certainty, not a risk.

---

## Layer 2: Four loops at four different cadences

**Concept:** Not everything needs the same rhythm. Separating "what runs whether or not the parent does anything" from "the minimum parent input required" keeps the system alive without becoming a burden.

```
NIGHTLY (autonomous)   : research: pick the most-stale domain, read 3–8 sources, update benchmarks
WEEKLY (autonomous)    : scoring: recompute age, decay confidence, score every subdomain, draft next week's plan
WEEKLY (Alessa, ~5min) : measurement protocol: 5–10 quick yes/no/count/photo observations, never essays
CONTINUOUS (Alessa)    : opportunistic capture: photos, voice notes, casual mentions
```

**OpenClaw implementation:** three crons,
- `Story Research Nightly` (`df382f37`, `14 2 * * *` ET, announces to `#homa-research`)
- `Story Weekly Scoring` (`eee18055`, Saturday `18 22 * * 6` ET)
- `Story Ambient Learning` (`e0f640d2`, every 30 min, `23,53 7-22 * * *` ET, a background safety net, not a fourth content loop; see Layer 5)

**Porting notes / gaps:**
- The cadence separation is pure policy, portable to any scheduler. The key insight to preserve: the *parent-facing* obligation is deliberately minimized (one ~5-minute weekly task) while the *system* absorbs the nightly/weekly grunt work. Don't let feature growth erode that asymmetry.

---

## Layer 3: A traced nightly research run: and a real self-heal

**Concept:** Research needs to be bounded (pick one thing, not everything) and prioritized by actual staleness, not by whim.

**OpenClaw implementation, the domain-picking rule:** walk **25 files** across two tiers, Tier A (15 domains scored against Story: math, literacy, phonics, spanish, science, social_studies, etc. → `benchmarks/{domain}.md`) and Tier B (10 domains of general homeschooling practice, NOT scored against Story: pedagogy, learning science, curriculum reviews, etc. → `practice/{domain}.md`). Compute staleness per file from its "Last researched" line, pick the single most-stale, tie-break toward Tier A files with the most `unknown` subdomains, final tie-break by rotation.

**Traced run**, session `25993e84`, 2026-07-25 02:14am ET, isolated cron turn:
1. Read the research journal + the fresh weekly scoring entry for context.
2. Computed `recent-research-studies` (Tier B) as most-stale at 26 days.
3. Ran 5 targeted web searches (dialogic reading meta-analysis, PA→EF meta-analysis, a movement/rhythm RCT, spatial reasoning + AR, home-numeracy), fetched full text on the strongest 2–3 hits (Frontiers journal articles, a PDF).
4. Updated `practice/recent-research-studies.md` with 8 new findings, preserving all prior entries (append, not replace).
5. Appended to `research-journal.md`, wrote an Obsidian-formatted summary to `vault/_System/Research/2026-07-25-recent-research-studies.md`.
6. Updated `profile.last_research_run`.
7. Posted a tight ~7-line recap to `#homa-research`, split explicitly into "What I learned" (the finding) vs. "Why it's interesting" (the application to Story/Alessa), the skill file calls out that conflating these two is a common failure mode to avoid.
8. Concluded correctly: *"No new interventions proposed, all findings reinforce existing ones."* Not every research night produces a new intervention, and the system doesn't manufacture one to look productive (the same restraint principle documented in the self-improvement-loop entry).

**The self-heal worth flagging:** the first Slack-send attempt in this run **errored** (`"Action send requires a target"`), a malformed tool call, and the agent immediately retried with a corrected call, which succeeded. The run's own final summary reports full success. But `openclaw cron list` still shows this run's aggregate status as **`error`**, because the harness's run-status tracking doesn't distinguish "failed, no retry" from "one tool call errored, self-corrected, and the run completed cleanly." This is a real, current gotcha, not a hypothetical.

**Porting notes / gaps:**
- The staleness-ranked, single-domain-per-night research design and the "what I learned vs. why it matters" split are directly portable prompt/policy patterns.
- Gap (genuine, found today, not from memory): **cron/job status tracking needs to distinguish "run failed" from "run had a transient tool error that self-corrected."** Otherwise the system's own health dashboard reports false negatives, which is exactly the kind of untrusted-gauge problem the self-improvement-loop doc's Layer 6 (`check_delivery_debt`) was built to prevent, worth checking whether that class of bug exists elsewhere in this system too.

---

## Layer 4: The weekly scoring run: measurement design, not just re-grading

**Concept:** Turning raw observations into "what should we do next week" requires more than updating numbers, it requires (a) decaying stale confidence honestly, (b) ranking gaps by leverage not alphabetically, and (c) asking the parent for the *minimum sufficient* new data, in a format a tired parent can actually complete.

**OpenClaw implementation**, from a traced completed run (`operations/story-weekly-scoring-latest.md`, week of 2026-07-24):
1. Recompute exact age (3y7m25d / 3.650 decimal years / 43 months / 1333 days, five derived fields from one DOB).
2. Decay confidence per the time rules above.
3. Score every subdomain with sufficient data against the freshly-updated benchmarks.
4. Identify **top 5 gaps** (below-age or only-at-age against a 12mo-ahead target, ordered by developmental leverage, earlier-developing skills first), **top 5 strengths** (12/24mo ahead, to extend), **top 5 unknowns** (needs measurement).
5. Draft next week's focus: 2–3 priority subdomains + a *measurable* goal each (e.g. "by Friday Story can rote-count to 20", not "work on counting").
6. Draft Alessa's measurement protocol: **5–10 tasks, ~10 minutes total, explicitly never essay questions**, yes/no, a count, or one photo. From the actual traced week: *"Ask Story to count as high as he can, note the number,"* *"Stand on one foot, how long (seconds)?"*, *"Show 4 emotion cards, how many can he name in Spanish?"*, *"Photo of his name written by him."*
7. Snapshot the profile (`scripts/snapshot_profile.py` → `profile-history/{date}.json`, idempotent, one file per distinct day, 8 snapshots exist since 2026-05-09) for the dashboard's trajectory line.
8. Regenerate the vault (again, the rule from Layer 1 applies here too, twice: once mid-run, once at the very end after `last_full_rescore` is finalized, so freshness banners are correct).
9. Post a ≤25-line summary to Sidney's DM (not Alessa) with the format shown in the traced example above.

**A real output**, top gap identified this week: *"spanish/comprehension, can't follow spoken Spanish commands; vocab strong but receptive gap is #1 target"*, paired with a proposed intervention (KA Kids Spanish "Read To Me" for the car) sourced directly from the research journal, not invented fresh.

**Porting notes / gaps:**
- The "measurement protocol, not a form" design constraint (≤10 min, closed-ended only, mostly yes/no/count/photo) is the piece most worth preserving verbatim, it's what keeps continuous input from becoming a chore the parent quietly stops doing.
- Gap: the cloud app needs its own leverage-ranking heuristic for "which gap to surface first" (here: earlier-developing skills first) rather than a flat list, and its own dated-snapshot mechanism to drive a trajectory view.

---

## Layer 5: The ambient learning loop: a safety net for missed signal

**Concept:** Named directly in the skill file as solving a specific, named trust failure: *"Real-time recognition is fragile. When Sidney or Less casually mentions something about Story in chat... Homa often misses it as a report, she's busy answering the actual question and the signal slips past. This is the #1 way Homa loses trust: she appears not to be learning from what we tell her."*

**OpenClaw implementation:** `Story Ambient Learning` cron, every 30 minutes during waking hours (`23,53 7-22 * * *` ET), silent (leaves no trace in chat). Re-reads recent chat history from three monitored surfaces, Alessa's primary channel, Alessa's DM, Sidney's DM, via `conversations.history` with a cursor stored in `learning-loop-state.json` (`last_processed_ts` per channel; cold-starts to a 24h lookback). Applies the *same* observation-extraction rules retroactively that would apply in real time, filtered to only the two `watch_users` (never re-processes Homa's own messages or third parties).

**Porting notes / gaps:**
- This is a general and valuable pattern beyond Homa's specific use: **a background sweep that re-applies your real-time extraction logic to a lookback window**, because real-time extraction inside a busy conversational turn will always have false negatives, and a silent async catch-up pass is cheap insurance.
- Gap: needs a per-surface cursor (`last_processed_ts`) + cold-start fallback window, and a hard allowlist of whose messages get processed (never the agent's own output, never unrelated parties) to avoid feedback loops or privacy overreach.

---

## Layer 6: From categorical score to a trajectory chart

**Concept:** `story_position` is categorical (`below_age`/`at_age`/`12mo_ahead`/`24mo_ahead`), which is right for a scoring rubric but useless for a line chart. The dashboard generator maps categories to a numeric axis so trends over time are visible at a glance.

**OpenClaw implementation** (`scripts/generate_dashboard.py`): a fixed lookup:
```
"24mo_ahead": 24, "12mo_ahead": 12, "at_age": 0 (implicit), "below_age": -12
```
converts each subdomain's position into "months ahead of/behind target" per snapshot date, averaged per domain, plotted as a trajectory line per domain plus a rollup pie of counts (🚀 24mo-ahead / ✨ 12mo-ahead / ✅ at-age / ❓ unknown). Colors are semantically fixed (emerald for 24mo-ahead, lime for 12mo-ahead, amber for below-age) so the dashboard reads the same way every time it's regenerated. Data comes straight from the `profile-history/` snapshots in Layer 4, the trajectory is a genuine time series, not a fabricated smoothing.

**Porting notes / gaps:**
- The categorical-to-numeric mapping for charting is a small but directly reusable trick, portable to any harness that needs to visualize a categorical progression over time.
- Gap: cloud app needs its own snapshot-then-chart pipeline; the mapping table itself is trivially copyable.

---

## Summary: the portable formula

```
one normalized state store (age, per-subdomain position + confidence w/ time-decay)
  → every human surface is a generated VIEW, regenerated after every write + on a scheduled backstop
    → four cadences: nightly autonomous research (staleness-ranked, one domain/night, restrained, no manufactured findings)
                      weekly autonomous scoring (decay → rank gaps by leverage → draft measurable goals)
                      weekly minimal human input (closed-ended only, ~10 min)
                      continuous ambient capture (silent lookback sweep, catches what real-time missed)
      → categorical scores collapse to a numeric axis for trajectory charting
```

## Known gaps to fill in the cloud architecture

1. A single normalized developmental-state store + a "regenerate all views" function called after every write, with a scheduled fallback pass as backstop (highest-leverage item to port first).
2. Cadence-separated autonomous loops (nightly research, weekly scoring) distinct from minimal, closed-ended weekly parent input.
3. A silent ambient/lookback sweep to catch signal real-time extraction misses, with per-surface cursors and a strict allowlist of whose messages get mined.
4. A leverage-ranking heuristic for surfacing gaps (not alphabetical/flat), and a dated-snapshot mechanism to drive trajectory visualization.
5. Cron/job status tracking that distinguishes "failed" from "errored-then-self-corrected", found as a live bug in this system today (Layer 3), worth auditing for on the cloud side too.
