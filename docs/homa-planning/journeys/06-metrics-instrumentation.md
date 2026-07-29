# Metrics & Instrumentation: North Star, metric tree, event schema, founder dashboard

> Historical instrumentation proposal, last updated 2026-07-02. The typed
> event-registry law and MJ-14 founder-dashboard target survive. The proposed
> event names, counts, SQL, tables, columns, metrics, and implementation labels
> do not describe the current repository. `packages/core/src/events.ts` is the
> current typed registry, and migrations own the actual database schema.

> Workstream 6 of the journey library (00-pm-kickoff.md). Status: PLANNING.
> Methods applied: success-metric, tracking-schema, measure-what-matters, impact-model
> (pm-os). Last updated 2026-07-02.
>
> Design constraints this doc obeys everywhere:
> - **Solo founder, no analyst.** Every metric is a SQL query over our Supabase tables
>   (`families`, `users`, `children`, `events`, `journal`, `artifacts`, `credit_ledger`,
>   `cron_runs`) or an AI Gateway report call. If a metric needs a human to compute it,
>   it doesn't exist.
> - **Retention is the existential risk** (04 §R6, council V2): the framework is built
>   to answer "is weekly value felt?" before anything else.
> - **The efficacy loop is the selling point** (00 §value stack): instrumentation must
>   prove "Homa's materials moved the numbers," not just "Homa was used."
> - **Anti-guilt is law** (kickoff §quality bar): no metric may create pressure to
>   guilt-spam a quiet mom. The guardrails section enforces this structurally.
> - **Children's data**: analytics events NEVER carry child free-text, names, DOBs,
>   or absolute developmental scores. Policy in §4.1.

---

## 1. North Star metric

### Candidates

**NS-1, Weekly Learning Families (WLF):** % of expected-active families (subscribed,
not paused) with ≥1 *completed learning moment* this week. A learning moment is
evidence homeschooling happened *with Homa in the loop*, any of:
`material.feedback_given`, `observation.logged`, `journal.reply_received`,
`hours.logged`, `activity.completed`. Generation alone does NOT count; download alone
does NOT count.

**NS-2, Weekly efficacy-loop completions:** count of closed loops per week: a
targeted material/activity was done AND the linked subdomain metric moved AND the
before/after was shown to the mom (`efficacy.attribution_created` →
`efficacy.before_after_shown`).

**NS-3, Materials used per active family per week:** mean count of materials with
a use signal (feedback or linked observation) per active family.

### Evaluation

| Criterion | NS-1 WLF | NS-2 Efficacy completions | NS-3 Materials used/family |
|---|---|---|---|
| Value-aligned (efficacy loop = selling point) | Indirect, measures the *inputs* to the loop | **Direct**, literally the selling point | Partial, materials are one leg of the loop |
| Leading indicator of retention | **Strong**, a family with zero learning moments for 2 weeks is the churn-risk definition | Lags, scoring runs weekly, attribution needs weeks of data to exist at all | Medium |
| Gameable? | Hard, denominator is families, capped at 1/family/week; junk generation doesn't move it because generation doesn't count | **Yes**, loosen attribution criteria and the number inflates; during concierge [M-R] Sidney literally hand-writes attributions | Yes, push notifications begging for 👍 inflates it; also unbounded per family (power users mask churners) |
| Seasonally robust (summers!) | **Yes**, % of *expected-active* families; paused summer families leave the denominator, the rate stays meaningful | Weak, absolute count craters in July regardless of product health | Weak, absolute ratio still distorted by seasonal light use |
| Computable solo, week one | Yes, pure SQL over `events` | Not until M3-11 ships (or manually flagged during concierge) | Yes |
| Statistically usable at n=20 | Yes, 14/20 vs 11/20 is legible | No, single digits, pure noise | Marginal |

### Decision: **NS-1, Weekly Learning Families (WLF)** is the North Star.

Reasoning: at 20 families the North Star's job is to answer R6 ("is weekly value
felt?") with a number a solo founder can read in one glance and act on the same day
(the miss list IS the call list). WLF is denominated in families, the unit we bill,
retain, and lose, capped per family so power users can't mask churn, robust to
summer because the denominator is *expected-active*, and hard to game because it only
counts evidence of real homeschool work, not generation volume.

**NS-2 is not rejected, it's promoted to the companion depth metric** directly under
the North Star in the tree (§2, Habit layer). It's the renewal argument and the
word-of-mouth artifact, but it's a *quality* metric that needs M3-11 (or honest
concierge flagging) before it's trustworthy, and it's too slow and too small to steer
weekly decisions in the M-R phase. When GA volume arrives, revisit whether WLF ×
efficacy-rate should merge into a single "families with a proven win this month."

**Explicitly rejected vanity candidates:**
- **Signups / waitlist size**, measures marketing, not value; ignores retention.
- **Worksheets generated (cumulative or weekly)**, the canonical junk-generation
  trap; generation is a cost event, use is the value event.
- **Chat turns / messages sent**, an AI product can be chatty and useless;
  also inflated by confusion (more turns can mean *worse* UX).
- **MRR as North Star**, lagging output of the tree, not a behavior anyone can act
  on Tuesday morning. It's on the dashboard (§5), not at the top of the tree.
- **DAU / daily streaks**, wrong cadence for a weekly-rhythm product, and streak
  mechanics are guilt mechanics (violates brand law).

**North Star SQL semantics** (the reference implementation; all §2 metrics follow
this style):

```sql
-- WLF for a given ISO week (Mon–Sun, family-local weeks materialized nightly)
with expected_active as (
  select id from families
  where status = 'subscribed'
    and (paused_until is null or paused_until < :week_start)
    and is_design_partner = false          -- Alessa excluded from cohort metrics
),
engaged as (
  select distinct family_id from events
  where name in ('material.feedback_given','observation.logged',
                 'journal.reply_received','hours.logged','activity.completed')
    and occurred_at >= :week_start and occurred_at < :week_end
)
select count(e.family_id)::float / nullif(count(a.id),0) as wlf
from expected_active a left join engaged e on e.family_id = a.id;
```

Targets: **[M-R] ≥ 70%** of the 20-family cohort (concierge-assisted, invited friends,
if we can't hit 70% with hand-holding, GA is off). **[GA] ≥ 55%** sustained across
the first 8 weeks post-switch.

---

## 2. Metric tree

```
                     WLF, Weekly Learning Families (North Star)
                                      │
   ┌──────────────┬──────────────────┼──────────────────┬──────────────┐
Acquisition    Activation          Habit           Monetization     Referral
```

Every input metric below: definition (SQL-computable semantics), target
[M-R] vs [GA], and its counter-metric/guardrail. Conventions: "week" = Mon–Sun;
"signup" = `account.signup_completed`; denominators exclude `is_design_partner`.

### 2.1 Acquisition

| Metric | Definition (SQL semantics) | [M-R] target | [GA] target | Counter-metric / guardrail |
|---|---|---|---|---|
| Invite redemption rate [M-R] | `account.invite_code_entered{accepted:true}` ÷ codes issued (codes table) | ≥ 60% | n/a | Redemptions ↑ while onboarding completion ↓ = wrong invitees |
| Landing → signup conversion [GA] | signups ÷ landing sessions (Vercel Analytics pageviews; the only metric allowed to live outside `events`) | n/a | ≥ 3% | Conversion ↑ while D7 activation ↓ = overpromising copy |
| Signup → onboarding entry | `onboarding.started` within 1h of signup ÷ signups | ≥ 95% | ≥ 90% | - |
| Source mix | count by `props.source` on `account.signup_completed` (conference / referral / organic / waitlist) | ≥ 50% referral+conference | referral ≥ 30% | Any single source > 80% = channel fragility flag |

**Layer guardrail:** signup volume ↑ while activation rate (§2.2) ↓ ⇒ junk traffic;
stop spending on the channel, don't celebrate the volume.

### 2.2 Activation (J1: the make-or-break journey)

| Metric | Definition | [M-R] | [GA] | Counter-metric / guardrail |
|---|---|---|---|---|
| Wow delivery rate | families with `onboarding.wow_delivered` ÷ `onboarding.started` | ≥ 90% | ≥ 85% | `onboarding.wow_failed` rate > 5% pages Sidney (§5 alerts) |
| Time-to-wow | median minutes, `account.signup_completed` → `onboarding.wow_delivered` | ≤ 15 min | ≤ 10 min (council: 3-min wow flow) | Speed ↑ while wow 👎 (`material.feedback_given{rating:down, trigger:onboarding_wow}`) ↑ = fast junk |
| Wow generation latency | p90 of `props.latency_ms` on `onboarding.wow_delivered` | ≤ 2 min (J1 requirement) | ≤ 90 s | - |
| Drip questionnaire completion | families answering ≥ 60% of `onboarding.drip_question_answered{status:answered}` ÷ drip-scheduled, by day 10 | ≥ 70% | ≥ 50% | Answered ↑ while `status:skipped` streaks ≥ 3 also ↑ = fatigue; drip pauses itself (M2-03) |
| **D7 Activated** (definition §6) | wow delivered + ≥2 learning moments on ≥2 distinct days within 7 days of signup | ≥ 80% (16/20) | ≥ 60% | Activation ↑ while W4 retention flat = definition too loose; revisit |
| Out-of-range honesty | `onboarding.child_out_of_range_shown` → family still completes onboarding | ≥ 60% of affected (P2 Rachel case) | ≥ 50% | Affected families' D30 ≪ cohort = we're seating people the product can't serve |

### 2.3 Habit (J2/J5: where R6 lives; the North Star's home layer)

| Metric | Definition | [M-R] | [GA] | Counter-metric / guardrail |
|---|---|---|---|---|
| **WLF (North Star)** | §1 | ≥ 70% | ≥ 55% | Whole guardrail set below |
| Learning moments / engaged family / wk | learning-moment events ÷ engaged families (depth behind the breadth) | ≥ 4 | ≥ 3 | Rising only because one persona (P5 Jess voice-heavy) dominates = segment it, don't average it |
| **Efficacy-loop completions / wk** (NS-2, companion) | `efficacy.attribution_created` count; [M-R] rows carry `props.concierge:true` (Sidney hand-written) and are reported separately | ≥ 5/wk fleet-wide, hand-made | ≥ 0.5 per active family / month, automated (M3-11) | Attributions ↑ while `efficacy.before_after_viewed` ↓ = we're claiming wins nobody looks at; correlation-overclaim risk → presentation law audit |
| Material use rate | materials with feedback or linked observation within 7 days ÷ `material.generated` | ≥ 50% | ≥ 40% | **Junk-generation guardrail: `material.generated` ↑ while 👍 rate ↓** ⇒ the agent is generating to look busy; freeze suggestion prompts, audit `what_works` |
| 👍 rate | `material.feedback_given{rating:up}` ÷ all feedback | ≥ 70% | ≥ 70% | 👍 ↑ while feedback *volume* ↓ = only fans still voting; watch response rate too |
| Journal reply rate | `journal.reply_received` ÷ prompts sent (from `cron_runs` outbox) per week | ≥ 50% | ≥ 35% | Reply ↑ while replies routed `routed_to:none` ↑ = prompts eliciting noise |
| Voice adoption | % of engaged families using voice ≥ 1×/wk (`voice.note_transcribed`) | ≥ 40% | ≥ 40% | `voice.transcription_failed` + `voice.fallback_used` rate > 10% = moat failure (M1-05) |
| Weekly note open → act | `weekly_note.clicked` (or derived *acted*: `material.requested{trigger:weekly_note}` ≤ 72h) ÷ `weekly_note.sent` | ≥ 60% clicked | ≥ 40% | Anti-guilt set below, the note must never become nag-mail |
| Quiet families (churn-risk list) | expected-active families with 0 learning moments in 14 days | ≤ 3 of 20 | ≤ 20% | This is a *call list* [M-R], an ops metric, not a nudge trigger |

**Anti-guilt guardrail (brand law, mechanized):**
- Re-engagement sends (`lifecycle.reengagement_sent`) capped at 1 per family per
  14 days, **zero** while `families.paused_until` is set (summer mode §6.3).
- **Ratio law: re-engagement response rate (`lifecycle.reengagement_responded` ÷ sent)
  must stay ≥ 20%, and `lifecycle.email_unsubscribed` must stay < 1%/mo of senders.**
  Either threshold breached ⇒ re-engagement copy/policy is guilt-flavored, sends stop
  fleet-wide (feature flag) until rewritten. The unsubscribe rate is reviewed weekly on
  the founder dashboard, not buried.
- No streaks, no "you haven't…", no red states anywhere (M1-17 design law), enforced
  in copy review, measured by the ratio above.

### 2.4 Monetization (J6 + 08-billing)

| Metric | Definition | [M-R] | [GA] | Counter-metric / guardrail |
|---|---|---|---|---|
| Paying families / MRR | count of `billing.payment_link_completed` [M-R] / active Stripe subs [GA]; MRR from Stripe | 20 fams / $580 | growth vs plan | - |
| Trial → paid conversion [GA] | subs started ÷ trials started, 21-day window | n/a (invites pay directly) | ≥ 40% | Conversion ↑ while month-2 renewal ↓ = pressure tactics, not value |
| Month-over-month renewal | families billed in month N+1 ÷ billed in month N (excl. paused) | ≥ 90% (18/20) | ≥ 85% | - |
| Top-up attach rate [GA, post-M1-12] | families with ≥1 `billing.topup_completed` / paying families / mo | measured only | 15–30% healthy band | **Trust-erosion guardrail: auto top-up revenue ↑ while support tickets or `billing.refund_issued`/`billing.dispute_opened` ↑** ⇒ the exact failure the council predicted (V1); kill switch territory |
| Auto top-up opt-in rate | `billing.auto_topup_consent_changed{enabled:true}` ÷ families shown the consent screen | measured | ≥ 25% | Opt-in ↑ while refund-window taps ↑ = consent screen unclear (ROSCA exposure) |
| Grace-buffer exposure | Σ negative balances (`credit_ledger`) + count aging > 7 days | ~$0 | < $2/family avg, none aging > 14d | Aging negatives = silent involuntary churn forming |
| Payment failure recovery | recovered ÷ `billing.payment_failed` within grace period | n/a | ≥ 70% | - |
| **LTV sanity (impact model)** | LTV = ARPU ÷ monthly churn. At $29 and 5% churn: **$580**; at 3%: **$967**. Every point of churn ≈ $130 LTV. | - | - | This is why the Habit layer outranks Monetization: churn is the only lever that ~doubles LTV without touching price |

### 2.5 Referral (word-of-mouth is the acquisition strategy: P3 Danielle upside)

| Metric | Definition | [M-R] | [GA] | Counter-metric / guardrail |
|---|---|---|---|---|
| Referral share of signups | `account.signup_completed{source:referral}` ÷ signups | anecdotal | ≥ 30% | - |
| Invites sent / family / mo | `referral.invite_sent` ÷ paying families | measured | ≥ 0.3 | Invites ↑ while invitee D7 activation ↓ = incentive-driven spam; never pay for referrals in this community |
| Artifact shares | `referral.artifact_share_created` + `referral.shared_artifact_viewed` (the worksheet/before-after as word-of-mouth artifact) | measured | growing | Shared links must be child-PII-scrubbed by construction (no name on shared render), a privacy audit item, not a metric |
| Invite → signup conversion | `referral.invite_accepted` ÷ sent, 30-day window | measured | ≥ 25% | - |

---

## 3. Cost & margin metrics (the margin law, §08, mechanized)

Source of truth: **AI Gateway Custom Reporting**, every model call is stamped
`ai-reporting-user: <familyId>` and `ai-reporting-tags: <action_class>` (05 §AI
Gateway); queried nightly via `getSpendReport()`. Non-LLM COGS (fal.ai images,
sandbox compute) are snapshotted as `props.cogs_estimate_cents` on
`material.generated` at generation time (the generator knows what it called).

**Action classes** (= the `ai-reporting-tags` vocabulary, = `action_costs` rows):
`chat`, `onboarding_wow`, `worksheet`, `coloring_page`, `picture_book`,
`weekly_plan`, `weekly_scoring`, `benchmark_research` (global, not per-family),
`transcription`, `learning_review`, `state_report`.

| Metric | Definition | Threshold / alert |
|---|---|---|
| $/family/mo (P50, P90) | Gateway spend by `user` + fal/sandbox snapshots, calendar month | **Law: P50 < $10, and < 20% of plan price.** P90 > $20 = investigate the family (bug or abuse, not billing) |
| $/action class /mo | Gateway spend by `tag` ÷ action count from events | Any class drifting > 20% from its `action_costs` COGS estimate ⇒ reprice (registry rule 3) |
| Realized margin per action [GA, needs M1-12 ledger] | `(credits_burned × $0.01 − COGS_actual) ÷ (credits_burned × $0.01)` per class, joining `credit_ledger` burns to Gateway/fal actuals, this is the M1-13 admin margin view | **< 50% for 7 consecutive days on any class ⇒ reprice or re-tier the model.** Target ≥ 70% (multiplier 3.3) |
| Plan-included loop cost | `weekly_scoring` + `weekly_plan` + amortized `benchmark_research` $/family/mo (costed, never charged) | > $4/family/mo eats the fixed-COGS budget (08 plan table), batch harder or cheapen the first-pass model |
| Global research job cost | `benchmark_research` tag, nightly | > $5/night = the "global, once" invariant broke (per-family research leaked back in) |
| Gateway budget caps (backstop) | per-key USD cap + eve per-session token limits | Cap hit = something is broken, not busy, page (§5) |
| Fleet daily spend | total Gateway $/day | > 3× trailing 7-day median ⇒ page (§5 alert #5) |

[M-R] simplification: no ledger exists yet (Payment Link cohort). The margin story is
one number: **fleet Gateway spend ÷ 20 families vs $29**, checked weekly on the
dashboard, with the per-class breakdown available in the Gateway UI on demand.

---

## 4. Event tracking schema (the core artifact)

### 4.1 Envelope, conventions, and the PII law

One append-only `events` table (spec addendum to **M1-02**):

```sql
create table events (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid references families(id),   -- null ⇒ fleet-scoped system event
  user_id        uuid,                            -- null for job/webhook events
  child_id       uuid,                            -- opaque; only when child-scoped
  name           text not null,                   -- registry-enforced domain.action
  props          jsonb not null default '{}',     -- typed per registry; NO free text
  source         text not null,                   -- 'web'|'agent'|'job'|'stripe'|'email'
  session_id     text,                            -- eve session correlation (never the continuation token, S6)
  occurred_at    timestamptz not null default now(),
  schema_version int not null default 1
);
-- indexes: (family_id, occurred_at desc), (name, occurred_at desc)
-- RLS: family-scoped read; fleet events (family_id null) admin-only
-- app roles: INSERT only, no update/delete (append-only, like credit_ledger)
```

Emission goes through one typed helper, `emitEvent(name, props)` (NEW-TICKET M1-18,
§7), whose registry is generated from this document. CI fails on an unknown event
name, an undeclared property, or a `string` property that isn't an enum, the same
"no unpriced actions" trick as M1-13, applied to analytics.

**PII law (children's data, non-negotiable, applies to every property below):**

1. **No free text, ever.** Nothing a mom or child typed/said enters `events`, no
   chat text, journal text, transcripts, questionnaire answers. Counts, durations,
   and enums only.
2. **Children are opaque.** `child_id` UUID only; never name; never DOB, age travels
   as `age_band_months` (6-month bucket floor, e.g. `54` = 4½–5 yrs).
3. **Developmental data stays in product tables.** Events may carry `domain_code` /
   `subdomain_code` (taxonomy labels) and bucketed *direction* of change
   (`up|down|flat`), never absolute scores or positions, those live in `profiles` /
   `profile_revisions` under RLS.
4. **Errors are codes.** `error_class` is an enum; raw error messages can echo user
   content and never enter events.
5. **Assume future export.** The table is RLS'd, but the policy is written so the
   day we pipe events into a third-party tool, nothing needs redaction.

Column key for the tables below, **Props**: `name:type` (all optional props marked
`?`). **PII**: ✅ = clean under the law above (only exceptions are called out).
**Source**: web (homa-web client/server), agent (eve tool/hook), job (scheduled
job/dispatcher), stripe (webhook handler), email (Resend webhook). **Feeds**: the
§1–3/§5–6 metrics consuming it.

### 4.2 Account & signup funnel (5)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 1 | `account.signup_started` | signup form/OAuth begins | `method:enum(email,google,apple)` | ✅ | web | acquisition funnel |
| 2 | `account.signup_completed` | account created | `method:enum`, `source:enum(conference,referral,organic,waitlist)`, `invite_code_used:bool` | ✅ | web | signups, source mix, cohort anchor |
| 3 | `account.invite_code_entered` | code submitted [M-R] | `accepted:bool`, `reject_reason?:enum(invalid,expired,exhausted)` | ✅ | web | invite redemption |
| 4 | `account.secondary_user_added` | Marcus/Grandma Sue joins (S1/S2) | `relationship:enum(partner,grandparent,other)` | ✅ | web | multi-user adoption |
| 5 | `account.login_failed` | auth failure streak ≥ 3 | `method:enum`, `streak:int` | ✅ | web | support-load early warning |

### 4.3 Onboarding (J1 + council inversion) (9)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 6 | `onboarding.started` | first onboarding screen | - | ✅ | web | funnel entry |
| 7 | `onboarding.family_intake_completed` | form intake done (M2-03i) | `state:enum(US states)`, `num_children:int`, `philosophy?:enum` | ✅ | web | funnel, compliance seeding |
| 8 | `onboarding.child_added` | child row created | `age_band_months:int`, `in_supported_range:bool` | ✅ | web | age-range ICP data (council call #3) |
| 9 | `onboarding.child_out_of_range_shown` | honest out-of-range message (P2's 10-yo) | `age_band_months:int` | ✅ | web | out-of-range honesty metric |
| 10 | `onboarding.wow_delivered` | first personalized artifact rendered in chat (M2-03ii) | `artifact_id:uuid`, `artifact_type:enum`, `latency_ms:int`, `minutes_since_signup:int` | ✅ | agent | **time-to-wow, wow rate, D7 activation** |
| 11 | `onboarding.wow_failed` | wow generation errored | `stage:enum(llm,image,sandbox,pdf)`, `error_class:enum` | ✅ | agent | wow failure alert (§5) |
| 12 | `onboarding.completed` | intake + wow done, rhythm explained | `children_count:int`, `total_minutes:int` | ✅ | web | activation funnel |
| 13 | `onboarding.drip_question_answered` | week-one drip response (M2-03iii) | `child_id`, `day_number:int`, `status:enum(answered,skipped,unknown)`, `domain_code:enum` | ✅ | agent | drip completion, fatigue guardrail |
| 14 | `onboarding.questionnaire_child_completed` | a child's questionnaire crosses 100% | `child_id`, `days_to_complete:int` | ✅ | job | profile completeness |

(Abandonment is **derived**, `onboarding.started` with no `onboarding.completed`
in 72h, last event = the drop step, not a separate event.)

### 4.4 Chat & voice (5)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 15 | `chat.turn_completed` | agent turn ends (ok or error) | `status:enum(ok,error)`, `error_class?:enum`, `modality:enum(text,voice)`, `latency_ms:int`, `model_tier:enum(fast,mid,premium)`, `tool_calls:int` | ✅ no message content | agent | engagement, latency health, cost joins |
| 16 | `voice.note_recorded` | recording captured client-side | `duration_sec:int`, `browser:enum` | ✅ audio stays in Blob | web | voice adoption |
| 17 | `voice.note_transcribed` | Whisper returns | `duration_sec:int`, `latency_ms:int` | ✅ transcript NOT included | agent | voice adoption, transcription cost |
| 18 | `voice.transcription_failed` | Whisper/upload error | `error_class:enum`, `browser:enum` | ✅ | agent | **moat-failure alert** (M1-05) |
| 19 | `voice.fallback_used` | mom drops to text/file after voice failure | `fallback:enum(text,file_upload)` | ✅ | web | voice reliability guardrail |

### 4.5 Materials lifecycle (J3: request → generate → deliver → print → feedback) (7)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 20 | `material.requested` | generation intent confirmed | `child_id`, `material_type:enum(handwriting,flash_cards,coloring,decodable_reader,sentence_pyramid,picture_book,weekly_plan,word_of_week)`, `trigger:enum(chat,onboarding_wow,weekly_note,weekly_plan,suggestion)` | ✅ topic/theme NOT logged (free text) | agent | request volume, weekly-note "acted" |
| 21 | `material.generated` | artifact saved to Blob + `artifacts` row | `artifact_id`, `child_id`, `material_type:enum`, `latency_ms:int`, `credits_charged:int`, `cogs_estimate_cents:int`, `trigger:enum` | ✅ | agent | generation volume, margin view (§3) |
| 22 | `material.generation_failed` | any stage errors | `stage:enum(llm,image,sandbox,pdf,blob)`, `error_class:enum`, `material_type:enum` | ✅ | agent | **§5 alert #3** |
| 23 | `material.downloaded` | PDF download/open tapped | `artifact_id`, `material_type:enum` | ✅ | web | use-intent funnel |
| 24 | `material.print_intent` | print button / `beforeprint` fired | `artifact_id` | ✅ | web | print funnel (proxy, ❓Q4) |
| 25 | `material.feedback_given` | 👍/👎 tapped (M2-05, wired day one) | `artifact_id`, `child_id`, `rating:enum(up,down)`, `trigger:enum` | ✅ | web | **North Star, 👍 rate, junk-generation guardrail, `what_works`** |
| 26 | `material.regenerated` | re-run on same request | `artifact_id`, `reason:enum(quality,wrong_level,style,error)` | ✅ | agent | quality counter-metric |

### 4.6 Activities & suggestions (J2 morning loop, M2-09, M3-12 discovery) (2)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 27 | `activity.suggested` | agent proposes activity/outing | `child_id?`, `kind:enum(library_activity,measurement,local_outing)`, `surface:enum(chat,weekly_note,weekly_plan)` | ✅ | agent | suggestion volume |
| 28 | `activity.completed` | mom confirms it happened ("we did it") | `child_id?`, `kind:enum`, `suggested:bool` | ✅ | agent | **North Star (learning moment), efficacy inputs, hours** |

### 4.7 Journal, observations & profile (J2: the "gets smarter" loop) (8)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 29 | `journal.prompt_sent` | evening prompt dispatched (M2-07, outbox row) | `channel:enum(email,push)` | ✅ | job | reply-rate denominator |
| 30 | `journal.prompt_opened` | email open / push tap deep-link | `channel:enum` | ✅ | email/web | funnel (opens unreliable, ❓Q1) |
| 31 | `journal.reply_received` | reply lands in chat | `modality:enum(text,voice)`, `routed_to:enum[](journal,hours,profile,memory,none)` | ✅ reply text stays in `journal` table | agent | **North Star, journal reply rate** |
| 32 | `journal.prompt_skipped` | skip-if-unanswered rule fires | `consecutive_skips:int` | ✅ | job | prompt-fatigue guardrail (M3-07) |
| 33 | `observation.logged` | observation extracted from voice/chat/journal | `child_id`, `origin:enum(voice,chat,journal)`, `domain_code:enum`, `subdomain_code:enum` | ✅ observation text stays in product tables | agent | **North Star**, profile freshness |
| 34 | `profile.updated` | learning review applies a change (M2-13) | `child_id`, `subdomain_code:enum`, `direction:enum(up,down,flat)`, `confidence_direction:enum` | ✅ no absolute scores (PII law #3) | agent | visible-compounding metric, efficacy inputs |
| 35 | `profile.revision_staged` | delta/rate guard holds a big change (council #5) | `child_id`, `subdomains_affected:int` | ✅ | agent | safety telemetry |
| 36 | `profile.revision_reverted` | mom/undo or admin revert | `child_id`, `revision_scope:enum(single,job_range)` | ✅ | web/agent | trust + M2-13 quality |

### 4.8 Benchmarks, questionnaire & scoring (J5) (4)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 37 | `questionnaire.question_answered` | any questionnaire answer outside drip (resume flow) | `child_id`, `domain_code:enum`, `status:enum(answered,unknown)` | ✅ answer content stays in profile | agent | profile completeness |
| 38 | `benchmarks.standards_viewed` | mom opens the standards/position view | `child_id`, `domain_code?:enum` | ✅ | web | "am I doing enough" engagement (the validation moment) |
| 39 | `scoring.run_completed` | Saturday scoring finishes for a family (M3-01) | `children_scored:int`, `subdomains_up:int`, `subdomains_down:int`, `stale_flagged:int`, `concierge:bool` | ✅ counts only | job | scoring health, weekly-note inputs |
| 40 | `scoring.run_failed` | scoring job errors | `error_class:enum`, `retry_count:int` | ✅ | job | **§5 alert #4** (2× fail = J7 trigger) |

### 4.9 Efficacy loop (M3-11: the selling point) (5)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 41 | `efficacy.attribution_created` | materials/activities linked to subdomain movement | `child_id`, `subdomain_code:enum`, `direction:enum(up)`, `linked_artifacts:int`, `concierge:bool` [M-R: Sidney hand-tags] | ✅ bucketed direction only | job/agent | **NS-2 companion metric** |
| 42 | `efficacy.before_after_shown` | before/after rendered into a surface | `child_id`, `surface:enum(weekly_note,dashboard)` | ✅ | job | efficacy delivery |
| 43 | `efficacy.before_after_viewed` | mom opens/expands the before/after | `child_id`, `surface:enum` | ✅ | web | claim-nobody-reads guardrail (§2.3) |
| 44 | `intervention.proposed` [GA] | intervention offered (M3-03) | `child_id`, `subdomain_code:enum` | ✅ | agent | intervention funnel |
| 45 | `intervention.accepted` [GA] | mom accepts | `child_id` | ✅ | web/agent | intervention funnel |

### 4.10 Hours & compliance (J4: the conference-mom ask) (5)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 46 | `hours.logged` | hours captured from any ambient source | `child_id`, `minutes:int`, `subject?:enum`, `origin:enum(journal,chat,voice,activity)` | ✅ | agent | **North Star**, hours-vs-target |
| 47 | `compliance.ruleset_viewed` | Binder state pack card rendered with a verified state row | `state:enum`, `has_verified_date:bool` | ✅ | web | trust signal (P4 Monica checks the statute) |
| 48 | `compliance.report_requested` | "Get your {State} pack" pressed (the 2026-07-28 state pack; the old `period` enum belonged to the retired evidence-report concept) | `state:enum` | ✅ | web | compliance demand (per-state template prioritization, M5-03) |
| 49 | `compliance.report_generated` | state pack PDF rendered, uploaded, finalized | `state:enum`, `latency_ms:int`, `page_count:int` | ✅ | web | compliance delivery, trial-value metric (D17) |
| 50 | `compliance.report_downloaded` | state pack PDF opened by the parent | `state:enum` | ✅ | web | completion of the J4 job |

### 4.11 Weekly note (J5: the retention artifact) (4)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 51 | `weekly_note.drafted` | note assembled | `concierge_reviewed:bool` [M-R: always true, the fail-closed human review], `has_before_after:bool`, `nudge_count:int` | ✅ `nudge_count` must be ≤ 1 (presentation law), >1 is a bug | job | note pipeline health |
| 52 | `weekly_note.sent` | note dispatched (outbox-deduped, M3-10) | `channel:enum(email,push)` | ✅ | job | open/act denominators |
| 53 | `weekly_note.opened` | email open pixel / push tap | `channel:enum` | ✅ | email | open rate (unreliable, ❓Q1) |
| 54 | `weekly_note.clicked` | any link in note clicked | `target:enum(dashboard,material,activity,before_after)` | ✅ | email/web | **open→act metric** |

(*Acted* is **derived**: `material.requested{trigger:weekly_note}` or
`activity.completed{suggested:true}` within 72h of `weekly_note.sent`.)

### 4.12 Billing & credits (08 design; most are [GA]/post-M1-12) (12)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 55 | `billing.payment_link_completed` [M-R] | cohort-one Payment Link checkout | `plan:enum(basic)` | ✅ no card data ever | stripe | paying families, MRR |
| 56 | `billing.trial_started` [GA] | trial begins (promo credits, no card) | `promo_credits:int` | ✅ | web | trial funnel |
| 57 | `billing.subscription_started` [GA] | Stripe sub active | `plan:enum(basic,plus)`, `from_trial:bool` | ✅ | stripe | conversion, MRR |
| 58 | `billing.credits_granted` [GA] | ledger grant row | `grant_type:enum(included,pack,promo,clawback_reversal)`, `credits:int` | ✅ | job/stripe | credit economy |
| 59 | `billing.balance_threshold_crossed` [GA] | balance crosses low / zero / negative | `threshold:enum(low,zero,negative)` | ✅ | agent | grace-buffer exposure (§2.4) |
| 60 | `billing.topup_prompt_shown` [GA] | post-action one-tap prompt (council V1) | `context:enum(post_action,settings)` | ✅ | web | top-up funnel |
| 61 | `billing.topup_completed` [GA] | pack purchased (manual or auto) | `mode:enum(manual,auto)`, `pack:enum(500,2000)`, `credits:int` | ✅ | stripe | attach rate, **trust-erosion guardrail** |
| 62 | `billing.auto_topup_consent_changed` [GA] | opt-in/out on the un-bundled consent screen | `enabled:bool`, `monthly_cap_cents?:int` | ✅ | web | opt-in rate, ROSCA audit trail |
| 63 | `billing.payment_failed` | charge fails (recovery derived from next success) | `attempt:int`, `context:enum(subscription,topup)` | ✅ | stripe | involuntary-churn funnel |
| 64 | `billing.refund_issued` | refund (incl. one-tap auto-top-up refund window) | `context:enum(topup_window,support,dispute)`, `amount_cents:int` | ✅ | stripe | trust-erosion guardrail |
| 65 | `billing.dispute_opened` | chargeback | `amount_cents:int` | ✅ | stripe | **§5 alert #2**, existential for a solo Stripe account |
| 66 | `billing.kill_switch_toggled` | global billing kill switch flips | `enabled:bool` | ✅ | web(admin) | audit trail |

### 4.13 Lifecycle: pause / cancel / win-back / anti-guilt (11)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 67 | `lifecycle.paused` | pause/summer mode set | `reason:enum(summer,holiday,family,financial,other)`, `resume_date_set:bool` | ✅ | web | **seasonality denominator (§6.3)** |
| 68 | `lifecycle.resumed` | family returns from pause | `paused_days:int` | ✅ | web/job | resurrection rate |
| 69 | `lifecycle.cancel_started` | cancel flow entered | `reason?:enum(price,not_using,missing_feature,age_range,other)` | ✅ enum only, no text | web | cancel-save funnel |
| 70 | `lifecycle.canceled` | cancellation confirmed | `reason?:enum`, `offered_export:bool`, `tenure_days:int` | ✅ | stripe/web | churn, R6 |
| 71 | `lifecycle.export_requested` | export bundle requested (J6/M4-05) | `context:enum(cancel,settings,deletion)` | ✅ | web | trust/exit quality |
| 72 | `lifecycle.export_downloaded` | bundle downloaded | `context:enum` | ✅ | web | export completion |
| 73 | `lifecycle.deletion_requested` | self-serve deletion | - | ✅ | web | compliance clock (M4-05 propagation) |
| 74 | `lifecycle.deletion_completed` | propagation done (Blob, backups, subprocessors) | `days_to_complete:int` | ✅ | job | compliance SLA |
| 75 | `lifecycle.reengagement_sent` | quiet-family nudge (M3-07; capped, never during pause) | `quiet_days:int`, `send_number:int` | ✅ | job | **anti-guilt ratio law (§2.3)** |
| 76 | `lifecycle.reengagement_responded` | any learning moment ≤ 7d after nudge | `days_after:int` | ✅ | job (derived, materialized for the ratio) | anti-guilt ratio law |
| 77 | `lifecycle.email_unsubscribed` | unsubscribe from any category | `category:enum(journal_prompt,weekly_note,reengagement,product)` | ✅ | email | **anti-guilt ratio law** |

(Win-back: `lifecycle.winback_sent` / conversion is **post-GA**; until then win-back
is Sidney sending a personal email, derived from re-subscription after `canceled`.)

### 4.14 Referral & sharing (4)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 78 | `referral.invite_sent` | in-product invite/share-Homa action | `channel:enum(link,email)` | ✅ | web | invites/family |
| 79 | `referral.invite_accepted` | invitee signs up via link | `days_since_sent:int` | ✅ | web | invite conversion |
| 80 | `referral.artifact_share_created` | share link minted on a worksheet/before-after | `artifact_id`, `artifact_type:enum` | ✅ shared render is name-scrubbed by construction | web | word-of-mouth artifact |
| 81 | `referral.shared_artifact_viewed` | external (unauthenticated) view | `artifact_type:enum` | ✅ no viewer identity | web | share reach |

### 4.15 System health (J7: what a solo founder needs) (8)

| # | Event | Trigger | Props | PII | Source | Feeds |
|---|---|---|---|---|---|---|
| 82 | `system.session_rotated` | rotation state machine completes (M1-15) | `turns:int`, `workflow_events:int`, `summary_written:bool` | ✅ fleet + family scoped | job | rotation health |
| 83 | `system.session_rotation_failed` | rotation errors / rotated while parked (must never happen) | `error_class:enum`, `was_parked:bool` | ✅ | job | **council #3 invariant check** |
| 84 | `system.job_failed` | any scheduled job errors (beyond scoring's own event) | `job_type:enum(journal_prompt,weekly_note,decay,research,doctor,grant,margin_review)`, `error_class:enum`, `retry_count:int` | ✅ | job | job success rate (§5 tile 12) |
| 85 | `system.dispatcher_gap_detected` | heartbeat gap > 5 min (M3-10) | `gap_minutes:int` | ✅ fleet | job | **§5 alert #4** |
| 86 | `system.doctor_finding_created` | fleet doctor writes an `ops_findings` row (M4-01) | `finding_type:enum`, `severity:enum(low,med,high)` | ✅ | job | ops queue; high ⇒ fail-closed loop pause (M1-16) |
| 87 | `system.cost_anomaly_detected` | nightly cost check trips a §3 threshold | `scope:enum(family,action_class,fleet)`, `threshold:enum` | ✅ | job | **§5 alert #5** |
| 88 | `system.safe_mode_toggled` | global safe mode flips (M1-16) | `enabled:bool`, `trigger:enum(manual,fail_closed)` | ✅ fleet | web(admin)/job | audit trail |
| 89 | `system.rls_denial_detected` | RLS policy denial / cross-tenant probe signature (S2/S3) | `surface:enum(tool,api,search)` | ✅ | agent/web | **§5 alert #1, security** |

**Total: 89 events** (60–90 target met). Everything else in the product is either
derivable from these plus product tables (abandonment, "acted," recovery,
resurrection) or belongs in Sentry/Agent Runs traces, not product analytics.

---

## 5. The founder dashboard (Monday morning, one page)

Twelve numbers, each a SQL view over `events` + one Gateway API call, rendered on one
admin page (NEW-TICKET M1-19; at M-R even a Supabase saved-query notebook qualifies).
Order = read order.

| # | Tile | Source | Healthy [M-R] |
|---|---|---|---|
| 1 | **WLF %** (North Star) + 8-week sparkline | §1 SQL | ≥ 70% |
| 2 | **Quiet families** (0 learning moments, 14d, not paused), as a *named list*, it's the Monday call list | §2.3 | ≤ 3 |
| 3 | Learning moments per engaged family (depth) | events | ≥ 4 |
| 4 | Efficacy before/afters delivered ÷ viewed this week | §4.9 | delivered ≥ 5, viewed ≥ 60% |
| 5 | New: signups → wow → D7-activated (n/n/n, latest week) | §2.2 | wow ≥ 90% |
| 6 | Cohort W4 retention (latest eligible cohort), **the GA gate number** | §6 | 10/10 strangers |
| 7 | 👍 rate + material use rate (7d), junk-generation check | §2.3 | ≥ 70% / ≥ 50% |
| 8 | Journal reply rate (7d) | §2.3 | ≥ 50% |
| 9 | Weekly note sent → clicked (+ unsubscribe count, anti-guilt check) | §4.11/4.13 | ≥ 60% / 0 |
| 10 | Paying families + MRR + (new, churned, paused) this week | Stripe + events | 20 / $580 /, |
| 11 | $/family/mo (P50) + % of plan price | Gateway `getSpendReport` | < $10 / < 20% |
| 12 | System: job success rate + generation failure rate (7d) | §4.15 | ≥ 98% / < 5% |

**The 5 alerts worth waking Sidney** (M4-03 acceptance criteria; everything else
waits for Monday):

1. **Security:** any `system.rls_denial_detected`, cross-tenant anything on
   children's data is a drop-everything event.
2. **Billing trust:** `billing.dispute_opened`, or off-session charge volume
   exceeding the monthly cap logic, chargeback-program risk is existential for the
   solo Stripe account (council V1); the kill switch exists for this.
3. **The wow is broken:** `onboarding.wow_failed` ≥ 2 in 1h, or
   `material.generation_failed` > 25% over 60 min, J1 is the make-or-break journey
   and a new family may be standing in her kitchen right now.
4. **The weekend loop is dead:** `system.dispatcher_gap_detected`, or Saturday
   scoring window closes with `scoring.run_completed` missing for > 20% of families,
   no scoring ⇒ no weekly note ⇒ the retention artifact silently skips a week.
5. **Cost runaway:** `system.cost_anomaly_detected` at family > $5/day or fleet
   > 3× trailing 7-day median, a bug, a runaway loop, or abuse; Gateway budget caps
   are the backstop but the alert should beat the cap.

Alert delivery: email + web push at minimum; ❓Q8 asks whether a personal-number SMS
is warranted for #1/#2.

---

## 6. Activation & retention definitions (weekly-rhythm product, not DAU)

### 6.1 Atomic definitions

- **Learning moment**, any of: `material.feedback_given`, `observation.logged`,
  `journal.reply_received`, `hours.logged`, `activity.completed`. (The North Star's
  atom; chosen because each one is evidence homeschooling happened with Homa in the
  loop, not that Homa was merely opened or generated something.)
- **Active week (family)**, ≥ 1 learning moment between Monday 00:00 and Sunday
  23:59 *in the family's timezone* (timezone on `families`; weeks materialized
  nightly into a `family_weeks` rollup view so every retention query is a join, not
  a window-function adventure).
- **Expected-active (denominator)**, `status = 'subscribed'` AND not paused
  (`paused_until` null or past) AND `is_design_partner = false` (Alessa is the
  dogfood bar, not a data point).

### 6.2 Activation & retention (homeschool cadence: windows, not days)

| Definition | Rule | Rationale |
|---|---|---|
| **Activated (D7)** | `onboarding.wow_delivered` ≤ 24h of signup AND ≥ 2 learning moments on ≥ 2 distinct days within days 0–7 | Wow alone is a demo; two moments on two days is the earliest honest signal she *worked* with Homa (J1→J2 handoff) |
| **D30 retained** | ≥ 1 active week in weeks 4–5 (days 22–35) | A two-week window tolerates co-op weeks, sick weeks, travel, a strict day-30 check would misclassify normal homeschool rhythm as churn |
| **W8 retained** | ≥ 1 active week in weeks 8–9 | Same window logic; W8 ≈ the second billing decision |
| **Habit formed** | ≥ 3 active weeks of the first 4 | The leading indicator that predicts renewal; the drip questionnaire (M2-03iii) is designed to manufacture exactly this |
| **Churn-risk (quiet)** | 0 learning moments in 14 days, not paused | Feeds the Monday call list and (capped, §2.3) re-engagement, never guilt copy |
| **Resurrection** | paused family with a learning moment ≤ 2 weeks after `lifecycle.resumed` | The summer-return metric (§6.3) |

Cohort rules: cohort = ISO week of `account.signup_completed`. M-R families carry
`concierge = true` permanently, their retention is reported but **never blended**
with GA cohorts (Sidney-assisted numbers would flatter the product). The GA switch
condition ("10 stranger families survive onboarding + week 4 unassisted," council V2)
is literally: 10 families with `concierge = false`, `source ≠ referral-from-Sidney`,
D7-activated AND W4-retained with zero support-initiated sessions.

### 6.3 Seasonality (summers are not churn)

1. **Pause is a product state, not an inference.** `lifecycle.paused{reason:summer}`
   sets `paused_until`; paused families leave every denominator and receive zero
   re-engagement (anti-guilt law). Requires the pause state + a proactive "summer
   mode" offer in May, NEW-TICKET M2-16 (❓Q7 scopes it).
2. **Report rates, not counts, June 15 – Aug 15.** WLF's expected-active denominator
   makes the North Star meaningful through summer; absolute tiles (#3, #4) get a
   "summer term" annotation on the dashboard rather than a target.
3. **The summer metric is resurrection**: % of paused families resuming by Sep 15,
   target ≥ 80%. A family that pauses in June and returns in September is a
   *retained* family; a cancel in June is churn. The pause flow exists to make that
   distinction real (and to keep the subscription relationship alive, pause ≠
   refund).
4. **Known-break annotations**: a small static `calendar_annotations` list (major
   holidays, big state convention weeks) rendered on dashboard sparklines so a dip
   reads as "Thanksgiving," not "product decay." Year-over-year comparisons start in
   year 2; until then annotations are the honesty mechanism.
5. Cohorts that *start* in summer (June–Aug signups) are flagged and judged against
   summer-cohort peers only.

---

## 7. Ticket mapping

| Ticket | What this doc adds to it |
|---|---|
| **M1-02** (tenant data layer) | §4.1 is the spec for the `events` table: DDL, append-only law, RLS (family read / fleet admin-only), indexes, `schema_version`. The `family_weeks` rollup view (§6.1) and `families.paused_until` + `is_design_partner` + `concierge` columns ride along. |
| **M1-13** (`action_costs` + margin view) | §3 defines the margin view's exact contract: inputs = Gateway `getSpendReport` (by `user`, `tag`), `material.generated.cogs_estimate_cents`, `credit_ledger` burns, `action_costs`; outputs = realized margin per action class; alert thresholds (< 50% for 7 days ⇒ reprice; > 20% COGS drift ⇒ registry rule 3). |
| **M4-01** (fleet doctor) | Consumes §4.15 events; the quiet-family definition (§6.2) and per-family health signals (profile staleness via `observation.logged` recency, job failures) are doctor findings; severity=high wires to fail-closed loop pause (M1-16). |
| **M4-03** (observability wiring) | The 5 wake-up alerts (§5) are its acceptance criteria, each one names its triggering event and threshold. Sentry stays for stack traces; product-truth alerts fire off `events`. |
| **M1-08** (Resend) | Must include the webhook bridge: opens/clicks/unsubscribes → `journal.prompt_opened`, `weekly_note.opened/clicked`, `lifecycle.email_unsubscribed`. Flagged as acceptance criteria, not a new ticket. |
| M2-03 / M2-05 / M2-07 / M3-01 / M3-02 / M3-11 / M1-12 / M1-15 / M3-10 | Each ships its §4 events in the same PR as the feature ("no feature merges without its events", same governance style as the no-unpriced-actions CI law). |

**NEW-TICKET flags:**

- **NEW M1-18 (M): typed event emission + registry CI.** `emitEvent()` helper,
  `event_registry.ts` generated from §4, CI fails on unknown name / undeclared prop /
  non-enum string prop (the PII law, mechanized). Without this, the schema decays in
  a month.
- **NEW M1-19 (S): founder dashboard v0.** The 12 §5 tiles as SQL views + one admin
  page; at M-R a Supabase saved-query notebook is acceptable, the views are the
  deliverable.
- **NEW M2-16 (S): pause / summer mode.** `paused_until` + reason on `families`,
  self-serve pause UI, proactive May offer, re-engagement suppression while paused.
  Required by §6.3 and the anti-guilt law; also a retention feature in its own right.
- **NEW M3-14 (M): referral instrumentation.** Share links on artifacts
  (name-scrubbed renders), invite flow, `source` attribution on signup, §4.14 has
  no home ticket today and referral is the GA acquisition strategy.

---

## ❓ Open questions for Sidney

1. **Email opens are unreliable** (Apple Mail privacy proxy inflates them). Accept
   clicks (`weekly_note.clicked`) as the primary note-engagement metric and treat
   opens as directional only?
2. **Concierge efficacy attributions**: during M-R, Sidney hand-writes before/afters
   (`concierge:true`). Report them as the efficacy metric with the flag visible, or
   hold the metric until M3-11 automates it? (Recommendation: report flagged,
   they're real value delivered, just not scalable.)
3. **Council open call #2** (visible credits vs flat fair-use plans) changes which
   §4.12 prompts ship (`topup_prompt_shown` vs a fair-use warning event). Schema
   covers both; which one is v1?
4. `material.print_intent` is a proxy (print dialog ≠ paper out). Is print-intent
   good enough for the J3 "printed" funnel, or do we ask "did you print it?" in the
   feedback tap?
5. **Third-party analytics** (PostHog etc.) are deliberately out of v1 (solo-founder
   rule: one events table, SQL, done). Agree the revisit trigger is ~200 families or
   the first real funnel A/B, whichever comes first?
6. **`age_band_months` in events** (6-month buckets, no DOB): confirm this passes
   the privacy bar for the M4-04 lawyer pass, or drop age from events entirely and
   join to `children` at query time (slightly slower, zero age data in events).
7. **Summer mode scope** (NEW M2-16): metric-only (pause state + suppression) or
   full product feature (May campaign, "summer light" weekly note)? The metric needs
   only the former; retention probably wants the latter.
8. **Wake-up alert delivery**: email/push won't wake anyone at 3am. Personal-number
   SMS (Twilio, no 10DLC needed for self-notification) for alerts #1 and #2 only?
