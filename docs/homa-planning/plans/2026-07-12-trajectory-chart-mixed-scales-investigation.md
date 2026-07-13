# Why Story's trajectory chart is all over the place: investigation + fix directions

Date: 2026-07-12 · Author: investigation session run from outside this repo (read-only
production queries + git archaeology). Nothing in this doc changed code or data. The
founder asked: is the jagged chart how we track the data, or the progress algorithm?

**Verdict: the child's data is fine and the live scores are correct. The jaggedness is
manufactured: the measuring stick changed three times between July 8 and 12 (answer
re-entry, scorer rules, recorded birthday), and the trajectory chart plots scores from
those different measurement regimes as one continuous line. Roughly 80% tracking
artifacts, 20% real signal. No scorer bug found.**

## The subject

- Child: Story, `children.id = def67e8f-13cb-4917-8be9-11fce3ef749f`,
  `family_id = c18d5def-0d55-4f93-a2e2-b4fe5a0a5ee0`.
- `birth_month = 2022-11-01` (so 44 months old on Jul 12), row `created_at
  2026-07-08 01:51:25 UTC`, `updated_at 2026-07-11 03:59:14 UTC` (note this timestamp,
  it matters below).
- 55 rows in `child_answers` / `child_progress_evidence` (the ledger mirrors the
  current answer state; every row "active", none superseded).
- Side finding: two OTHER `children` rows named Story exist (`a295359a…` and
  `b0db61e7…`, both `birth_month 2021-03-01`, different families, zero answers, zero
  reports). Probably test or duplicate accounts; worth a cleanup pass someday.

## The three scoring events on the chart

| Era | generated_at (UTC) | bank | scorer in prod |
|---|---|---|---|
| 1 | 2026-07-08 01:51:24 | 2026.07.2 | pre-window-credit, absolute +24 cap |
| 2 | 2026-07-09 01:24:39 | 2026.07.2 | same as era 1 |
| live | 2026-07-12 15:34:55 | 2026.07.5 | window credit + age-scaled cap |

Era 2 differs from era 1 in exactly one subject: music (+17 to +24) after the
8-question music deep-dive answered 2026-07-09 01:24 UTC. Every other subject is
byte-identical between the two eras, including statements.

The scorer change is commit `38da009` (2026-07-08 21:36 ET, which is 2026-07-09 01:36
UTC): it added `aheadCapForAge` (months-ahead capped at about a third of the child's
age) and window credit ("easily" earns the early edge of `typicalRangeMonths` where
documented). Era 2 was generated 12 minutes BEFORE that commit, so both archived eras
carry old-scorer numbers and the live report carries new-scorer numbers.

## Cause 1 · The scoring rules changed under the chart (the big pink music drop)

Music's confirmed frontier is "Keeps their own part going in a group song or a round"
(getting_there, anchor 96, credited 90). Raw delta at 44 months: +46.

- Old scorer: capped at the absolute `MONTHS_AHEAD_CAP = 24` → era 2 shows +24.
- New scorer: `aheadCapForAge(44) = min(24, round(44/3)) = 15` → live shows +15 with
  `beyondScale: true` (honest floor flag).

So music "fell" 9 months with zero change in the child's evidence. Same commit's
window credit also trimmed language (stranger-clear easily now credits 34, not 46).

## Cause 2 · The answer set was re-entered with different answers

`child_answers.answered_at` shows two distinct entry sessions:

- A human-paced run ending 2026-07-08 01:50 UTC (12 answers, 5 to 15s apart).
- A machine-speed block 2026-07-08 22:19:47 to 22:20:31 UTC: 33 answers, 0.3 to 0.6s
  apart. That cadence is a bulk write (a workspace claim mirror or checklist
  re-submit), not a parent reading questions.

The archived eras were scored from the FIRST answer set; the live report scores from
the SECOND (plus two later additions). The differences that moved the chart:

| Subject | era 2 → live | What changed in the answers |
|---|---|---|
| science | +9 → +2 | predicts: easily → getting_there (frontier 52 → 46) |
| social_studies | +11 → +2 | helpers: easily → not_yet (frontier falls to family-roles 46) |
| literacy | +11 → +15 (beyondScale) | retells-story: getting_there → easily (54 → 60, then capped) |
| executive_function | +1 → +10 | waits-turn upgraded; stop-go easily (54) added |
| gross_motor | 0 → +4 | pedals getting_there → easily; gallops easily added; one-foot-hop not_yet |
| math | +5 → +10 | counts-past-20: getting_there → easily (source=conversation, 2026-07-11 02:00 UTC) |
| (new) literacy n=4 | | print-meaning easily via check_in, 2026-07-12 15:34 UTC |

These are data-entry deltas (a re-run checklist answering more conservatively in
science/social studies and more confidently in literacy/EF/motor), not the child
regressing or leaping inside four days.

## Cause 3 · The recorded birthday moved one month (every line shifts)

Every single era-1/era-2 number reconciles EXACTLY to an age basis of **43 months**
(examples: math +5 = counts-past-20 getting_there credit 48 − 43; literacy +11 =
retells getting_there credit 54 − 43; executive_function +1 = waits-turn getting_there
credit 44 − 43; fine_motor +7 = beads 50 − 43; social_emotional +13 = false-belief
56 − 43; music era 2 raw 90 − 43 = 47 → old cap 24). Every live number reconciles
EXACTLY to **44 months**.

The child row's `updated_at` is 2026-07-11 03:59 UTC, right at the "full birthdays
product-wide" rollout (commit `711c694`, founder ruling "get the actual birthday").
So the stored birth month at scoring time was one month later than today's value
[INFERRED from 12 subjects reconciling to the month at both ages; the pre-correction
value itself is not stored anywhere, see "irrecoverable" below]. Effect: Story got one
month older on Jul 11, mechanically subtracting 1 from every subject's months-ahead.

## The chart then amplifies all of this (`apps/web/app/onboarding/r/[token]/report-trajectory.tsx`)

1. Synthetic origin: every subject starts at "at age" one week before the first
   check-in (`START_LEAD_MS`, founder ruling: week one reads as a burst of measured
   progress). With only 3 scoring events packed into Jul 8 to 12, the left side of the
   chart is guaranteed to explode upward. Design, not data.
2. `buildSeries` plots each era's archived `monthsAhead` as-is and connects them into
   one polyline. Points computed under different banks (2026.07.2 vs 2026.07.5),
   different scorer rules (cap + window credit), and different birth dates are drawn
   as if they were the child moving.
3. Growing subjects plot at a fixed −3 slot (self_care here), per the founder rule
   "downward on the line chart is ok". Fine and intentional, listed only for
   completeness.

## What was verified (and how to re-verify)

- The live report reproduces by hand for all 16 subjects from the current
  `child_answers` + `packages/core/src/map/scoring.ts` + bank content at 44 months,
  including both `beyondScale` floors (literacy 60 − 44 = 16 → 15; music 90 − 44 =
  46 → 15). The scorer is doing exactly what it is specced to do.
- Read-only reproduction against prod (transaction pooler, creds per
  `apps/web/lib/map/db.ts`):

```sql
select generated_at, bank_version, scores, history
from public.child_reports
where child_id = 'def67e8f-13cb-4917-8be9-11fce3ef749f';

select question_id, answer, source, answered_at
from public.child_answers
where child_id = 'def67e8f-13cb-4917-8be9-11fce3ef749f'
order by answered_at;
```

Caution note for future archaeology: the archived history entries have a `subjects`
key with `subjectId` fields even though the era-1/era-2 scorer emitted `domains` with
`domainId`, so the archive shape was migrated at some point after the skill graph
landed. Their NUMBERS still reconcile to the old scorer + age 43, so the migration
renamed keys without rescoring. Also, several era statements (for example math's
strongest item) can name items whose current answer arrived later; the archive is
trustworthy on numbers, looser on provenance.

## What is irrecoverable

The pre-claim answer history from the lead-magnet flow (what the parent answered on
the FIRST run, before the Jul 8 22:19 bulk block) lived in the `lead_*` tables, which
have since been dropped. The earliest eras can therefore never be rebuilt from raw
answers; only their stored score JSON survives. The append-only
`child_progress_evidence` ledger fixes this going forward but its backfill captured
only the current answer state (all rows active, none superseded).

## Recommended fixes, cheapest first

1. **Stamp the full measurement basis on every snapshot.** `ScoreSnapshot` (in
   `apps/web/lib/map/store.ts`) already stores `bank_version`; add the scorer rules
   version and the birth date + age-months used at scoring time. Cheap, additive,
   makes every future era auditable.
2. **Mark scale-change boundaries on the trajectory chart.** When adjacent eras carry
   different bank/scorer/birthdate stamps, draw the boundary (a subtle vertical marker
   or a segment style change) instead of pretending the line is one measurement. Honest
   and no rescoring needed.
3. **Re-normalize at render (the real fix).** When drawing the trajectory, rescore
   each era's raw answer set under the CURRENT bank + scorer + birthdate, so the line
   shows only child movement. Requires per-era answer sets: the evidence ledger
   supports this from Jul 8 2026 onward (use `observed_at <= era.generated_at` over
   superseded-aware evidence); eras older than the ledger keep stored numbers and get
   the boundary marker from fix 2.
4. Optional data hygiene: dedupe the two empty Story children rows; and consider
   preserving `superseded` rows when bulk mirrors rewrite answers, so re-entry deltas
   (cause 2) stay visible in the ledger instead of overwriting silently.

Fixes 1 + 2 are a small PR; fix 3 is the durable one and BUILD.md's ChildProgress
guards (`pnpm check:child-progress`, `check:map`) cover the surfaces it touches.
