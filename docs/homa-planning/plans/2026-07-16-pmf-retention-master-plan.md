# PMF and retention master plan

Date: 2026-07-16
Status: proposed, wave 1 ready to dispatch
Owner: founder (Sidney), executed by coding agents
Source of truth for the limiting factor: `.context/pmf-focus/limiting-factor-log.yaml` (lf-2026-07-16-core-loop-activation)
Evidence: fresh homa-prod SQL (2026-07-16, ~16:00 UTC), two codebase inventories, expert council, customer persona council. Production numbers below supersede any older snapshot in this repo.

## 1. Thesis

Homa's PMF bottleneck is not acquisition and not model quality. It is the gap between "saw the report" and "Homa is part of our school week." Two loops close that gap:

1. Session-one win: the parent leaves their first session holding one durable, child-specific teaching artifact (next lesson + worksheet, kept in Binder).
2. Daily loop: Homa proactively shows up (morning brief text, later the evening check-in and weekly note) with something specific enough to answer.

Everything in this plan either strengthens one of those loops, measures them honestly, or wins back people who leaked before the loops could start. Top-of-funnel work stays parked until keep and return move.

## 2. Who, what, where, when, why

### Personas (from journeys/01-personas-jtbd.md, synthetic composites)

| Persona | Reality | What wins them | What loses them |
|---|---|---|---|
| Alessa (P1, enthusiast) | 3 kids, conference signup, evangelizes to her co-op when something works | Materials made for her kids, visible proof, shareable wins | Silence after the report; nothing new to show |
| Rachel (P2, structured skeptic) | 2 kids, boxed curriculum, audits subscriptions | Saves her Sunday planning night, concrete evidence, low ceremony | Anything that adds work, vague AI promises, pushy texts |
| Danielle (P3, anxious new) | 1 kid pulled from school, reads at 10pm, money tight | Reassure before inform, one thing to do tomorrow, never graded | Feeling graded, "behind" framing, daily obligations she did not ask for |

Job to be done: "Help me run our homeschool with less chaos and more confidence, and show me it is working."

### Reality per funnel stage (current vs expected vs ideal)

Denominators (locked in pmf-focus reality-checks): signup-screen abandon = `status=open`; signed-up = `status=claimed`; setup done = claimed + `profile_completed_at`. Never call open rows signups.

| Stage | Current reality (prod, 2026-07-16) | Expected (what the product intends) | Ideal (11-star) |
|---|---|---|---|
| Discover → signup screen | 280 non-sandbox rows, 237 are anonymous abandons of the signup screen | Landing converts warm conference/social traffic | Report proof so strong the signup feels like claiming something already theirs |
| Signed up | 43-44 claimed | Every claimed parent finishes setup | Setup feels like telling a friend about your kids |
| Setup done | 34 (100% have a linked phone, phone is collected at setup) | Straight into the checklist and report | Same |
| Report | 29-30 of 34 have a child report; 23 families viewed; 200 total report views; 54 report emails delivered | Report is the aha and the springboard | Report ends with the next lesson already offered |
| Act (CTA → plan/chat/lesson) | 20 families tapped a report CTA; 12 built a 4-week plan; 16 ever chatted | One obvious act per subject | One tap, one minute, one artifact for MY kid |
| Keep | 9-10 families ever created a material; 3 ever kept one | Kept work lands in Binder | Every session ends with something kept and reusable |
| Daily loop | Brief reached 16 of 34 setup-done; 76 SMS sent, 18 replied (24%); journal loop dark (3 runs ever); weekly note unbuilt | Weekday brief + evening check-in + weekly note | Homa texts like a co-teacher who saw yesterday's work |
| Return | By parent-authored messages: 18/34 never messaged, 7 one day, 9 multi-day, 5 on 3+ days | Multi-day use within week one | Homa is opened like a group chat with your co-teacher |
| Pay / advocate | 0 trials, 0 paid (wall off), 4 co-parent invites ever | Trial after value moment | "I sent it to my whole co-op" |

### The three load-bearing facts

1. The Jul 7-13 setup-done cohort (n=5, pre-surge, high-touch era) went 5/5 multi-day, 5/5 created a material, 2/5 kept. The Jul 14-16 cohort (n=29, censored) is where the collapse shows. Small n, but the product CAN retain when the loop completes.
2. Brief reach correlates hard with return: 9 of 16 brief-reached families are multi-day messagers, 0 of 18 non-reached returned multi-day. This is confounded (brief requires a report; reply days count toward the metric; recent cohort censored), so we treat it as a hypothesis and test it with the enrollment backfill below, not as proven cause.
3. The brief enrollment gap is mostly shipped code, not parent behavior: `seedKind` in `apps/web/lib/tasks/store.ts` requires the family row to be 20+ hours old AND a scored report, then delivery waits for the next weekday 9am-noon window. A family that signs up and scores on day one waits 1-3 days for its first proactive touch, which is exactly when 76% go quiet.

## 3. Leverage inventory (what already exists)

Wired and live: report-ready email, one-shot 24h onboarding reminder, 28-day retest email, band-ready email, resume-link email, morning brief (SMS-first, email fallback, needs report + 20h), custom scheduled tasks, SMS invite + contact card, agent follow-up email tool (5/day cap), open-loop reply routing, materials via `create_printable`, finalize via `mark_material_final`, Binder (final only), Resend webhook route (delivery/bounce/complaint handled; opens/clicks received but ignored).

Dark or unbuilt: evening journal loop (flag + seeded paused), thank-you cards (flags), weekly note (specified, no sender), wall (off), win-back for quiet families (admin call list only, "a call, not a nudge" rule), materials follow-up, waitlist drip.

In flight by other agents: subject-lessons (report subject CTA → one next lesson + auto worksheet + Keep → Binder; APIs/migration/skill built, UI being restored in `.worktrees/subject-lessons`), morning-research-brief v2 (citation quality).

Falsified assumption from earlier this session: "add a phone-link CTA" is unnecessary, 100% of setup-done families already have a linked phone. Enrollment, not linkage, is the brief gap.

## 4. Council verdicts (what changed the plan)

Expert council (growth PM, staff engineer, homeschool operator, skeptical data scientist):
- Fix brief enrollment first; the backfill of the 18 un-briefed families doubles as the natural experiment on whether the brief causes return.
- Ship a measurement truth pack the same day: return = parent-authored message days, split brief-reply days from organic days, key the funnel on `map.account_created` not `map.started`.
- Land the lesson bridge behind a founder quality gate (N=5 generated lessons reviewed before flag-on); a mediocre auto-lesson burns trust with exactly the skeptics.
- Killed: asking for the evening check-in during session one (too early, too pushy).
- Added: co-parent share loop, concierge willingness-to-pay probe, first-session time-to-value stopwatch.

Customer council (Alessa, Rachel, Danielle):
- Ranking by "most likely to bring me back this week": 1) next lesson button, 2) weekly note, 3) morning text, 4) unopened-report follow-up, 5) evening check-in, 6) Binder (liked, but pulls nobody back by itself).
- Ship blockers: the evening check-in phrase "your reply becomes part of his record" (unanimous flinch; replace with "I'll remember this so tomorrow fits. You can see and change anything I keep"). Morning texts must not be daily-by-default; the first text asks cadence, and Homa never references ignored texts.
- Keep/Binder is hygiene, not a hook: the artifact arriving is the hook.

## 5. Scoring model

Priority = Impact on PMF and retention (1-10) x Simplicity (1-10, 10 = trivial) x Confidence in the evidence behind it (0.5-1.0). Agent time is cheap and parallel; Simplicity mostly prices risk and review surface, not hours. Founder attention is the scarce resource, so tickets that need founder judgment say so.

## 6. Backlog

### Epic E1 · Session-one win (report → lesson → keep)

| Ticket | Title | I | S | C | Score |
|---|---|---|---|---|---|
| PMF-101 | Finish subject-lesson slice (APIs, lesson page, report CTA, Keep) | 10 | 4 | 0.8 | 32 |
| PMF-104 | Founder lesson quality gate before flag-on | 8 | 8 | 0.9 | 58 |
| PMF-102 | Keep affordance on chat material cards | 7 | 6 | 0.9 | 38 |
| PMF-103 | Empty states (Binder, planner, progress) point at the next-lesson CTA | 5 | 8 | 0.9 | 36 |

PMF-101 atomic actions (in flight, agent already briefed):
1. Reverify build/status/retry APIs in `.worktrees/subject-lessons`.
2. Restore lesson page (wait / ready / fail+retry / worksheet preview / print).
3. Restore report subject-card action (flag on: "Build the next lesson"; flag off: old month CTA unchanged).
4. New keep route + lesson-page Keep button → `materials.status=final` → Binder (owner-only, idempotent).
5. Local click-through: report → build → ready → keep → Binder; then stop and report.

PMF-104 atomic actions:
1. Generate 5 lessons + worksheets across ages/subjects with the eval harness in the worktree.
2. Founder reviews against materials-studio quality bar; record pass/fail in the worktree notes.
3. Only then: apply migration, set flag in prod, probe live with the founder test family.

PMF-102 atomic actions:
1. Add Keep action to `apps/web/app/app/material-card.tsx` calling the same family-scoped finalize path (no agent turn), idempotent "already kept".
2. Emit `materials.finalized` consistently so events stop undercounting keeps (3 keeper families vs 2 in events today).
3. Focused test on the finalize route policy.

PMF-103 atomic actions:
1. Binder empty state: point at the report's next-lesson CTA (currently "Ask HOMA" only).
2. Planner empty state: same target.
3. Keep copy rules: offers never commands, no red framing.

### Epic E2 · Daily loop enrollment and content

| Ticket | Title | I | S | C | Score |
|---|---|---|---|---|---|
| PMF-201 | Seed the morning brief at report creation (kill the 20h wait for briefed families) + backfill the 18 un-briefed | 9 | 8 | 0.9 | 65 |
| PMF-202 | Day-1 brief references the kept lesson/worksheet | 8 | 6 | 0.8 | 38 |
| PMF-203 | First brief asks cadence; never reference ignored texts | 6 | 7 | 0.9 | 38 |
| PMF-205 | Every brief ends with one replyable question (tune prompt) | 6 | 8 | 0.7 | 34 |
| PMF-204 | Evening check-in offer AFTER first brief reply, with consent copy fix | 6 | 6 | 0.7 | 25 |

PMF-201 atomic actions:
1. In `apps/web/lib/tasks/store.ts` `seedKind`, drop the 20-hour age gate for `morning_brief` when a scored report exists (keep it for `journal_prompt`); alternatively seed the brief schedule directly in the score route the moment the first report lands.
2. First-run timing: if seeded before noon local on a weekday, allow same-day delivery inside the 9-12 window; else next weekday.
3. Backfill: one-time script enables schedules for the 18 setup-done families with reports and no brief; stagger over 2 days.
4. Measure as a natural experiment: 7-day organic return (parent-message days excluding brief-reply-only days) for backfilled vs previously-briefed. This is the causation test for fact #2.
5. Guard: never double-seed (existing unique index), respect journal_opt_out, respect quiet-hours.

PMF-202 atomic actions:
1. Extend brief context builder (`apps/web/lib/tasks/brief-context.ts`) with the family's latest kept material and the child's current lesson target.
2. Prompt: when a kept worksheet exists, day-1 brief references it ("print another round of X?" / "next skill after X is Y").
3. Eval fixture: brief with kept-material context vs without.

PMF-203 / PMF-205 atomic actions:
1. First-brief copy asks cadence (daily / a few times a week / weekly) and stores the answer on the schedule (`weekdays`).
2. Prompt rule: never mention unanswered previous texts.
3. Brief template ends with exactly one concrete replyable question.

PMF-204 atomic actions (blocked on PMF-201 shipping first):
1. Trigger: first brief reply (open-loop resolution), not session one.
2. Copy per customer council: "Want me to check in most evenings to hear how the day went? I'll remember it so tomorrow fits. You can see and change anything I keep. Saying no changes nothing."
3. Yes → unpause journal schedule for that family (flag must be on; keep seedPaused default for everyone else).

### Epic E3 · Win-back and lifecycle email

| Ticket | Title | I | S | C | Score |
|---|---|---|---|---|---|
| PMF-301 | Handle Resend opens/clicks; one follow-up for unopened report emails at 48h | 7 | 7 | 0.9 | 44 |
| PMF-302 | One "ready to act" touch at 48h for report-but-never-chatted families | 7 | 7 | 0.8 | 39 |
| PMF-303 | Weekly note generator producing drafts for founder review (concierge send) | 8 | 5 | 0.8 | 32 |
| PMF-304 | Second-touch for claimed-no-setup (n≈10) and checklist abandons at 72h, then stop | 5 | 7 | 0.8 | 28 |

PMF-301 atomic actions:
1. Extend `lib/email-webhook.ts` + `app/api/email/webhook/route.ts` to record `email.opened` / `email.clicked` on `email_sends`.
2. Cron sweep: `report_link` sends with no open after 48h get exactly one follow-up ("Maya's report is waiting", two sentences, one button). One ever, stamped like `reminder_sent_at`.
3. Customer council validated this moment; Danielle flagged only that the subject must not guilt.
4. Never re-touch bounced or complained addresses.

PMF-302 atomic actions:
1. Audience: setup-done, report generated, zero parent-authored messages, 48h+ since report.
2. One email (or SMS if that becomes the norm) pointing at the single next action: the next-lesson CTA once E1 ships, the month plan until then.
3. One ever per family; log to `email_sends` with its own kind.

PMF-303 atomic actions:
1. New task kind producing a weekly note DRAFT per active family into the admin console (what we worked on, one visible improvement with evidence, one suggestion + printable).
2. Founder reviews and sends manually at first (concierge per journeys/03; customers ranked this #2).
3. Automate sending only after 2-3 weeks of accepted drafts.

### Epic E4 · Measurement truth

| Ticket | Title | I | S | C | Score |
|---|---|---|---|---|---|
| PMF-401 | Return metric = parent-authored message days; brief-reply vs organic split; weekly PMF review script | 8 | 8 | 1.0 | 64 |
| PMF-402 | First-session stopwatch + lesson funnel events | 6 | 7 | 0.9 | 38 |
| PMF-403 | Admin funnel keyed on account_created; add lesson stages | 5 | 7 | 0.9 | 32 |

PMF-401 atomic actions:
1. One SQL script (repo `scripts/`) computing, per signup-week cohort of setup-done families: create ≤48h, keep ≤48h, parent-message days (total and excluding days whose only messages are brief replies), brief reach, brief reply rate.
2. Wire into a weekly ritual: run, append summary to `.context/pmf-focus/limiting-factor-log.yaml` research_notes, update the canvas.
3. Document the metric definitions in `pmf-focus/references/reality-checks.md`.

PMF-402 atomic actions:
1. Emit lesson events (`lesson.build_started`, `lesson.ready`, `lesson.kept`, names per MJ-08 registry) from the subject-lesson slice.
2. Stopwatch query: minutes from `map.account_created` → `map.report_viewed` → first CTA → first kept artifact.

### Epic E5 · Sharing and advocacy (new, from councils)

| Ticket | Title | I | S | C | Score |
|---|---|---|---|---|---|
| PMF-501 | After Keep: "send this to your co-parent" (existing invite rails) | 6 | 5 | 0.6 | 18 |

Alessa's persona is the engine of homeschool distribution (co-ops). Only 4 invites ever sent. Low confidence, cheap probe: surface the existing invite at the moment of pride (just kept a worksheet), never before.

### Epic E6 · Monetization readiness (decision-gated, mostly parked)

| Ticket | Title | I | S | C | Score |
|---|---|---|---|---|---|
| PMF-602 | Concierge willingness-to-pay probe: founder personally asks the 5-9 engaged families | 7 | 9 | 0.7 | 44 |
| PMF-601 | Define the value-moment wall trigger (first kept artifact + first brief reply), build dark | 5 | 5 | 0.6 | 15 |

PMF-602 is founder time, not agent time: text the multi-day families, ask what they would pay and what would make it a no-brainer. Zero code. Do not turn the wall on until keep ≥40% and multi-day return ≥40% on a non-censored cohort.

### Epic E7 · Top-of-funnel (parked on purpose)

The 237 signup-screen abandons have no contact info and cannot be emailed. Do not spend agent waves here until the loops retain the people we already have. When reopened: sample-report → signup handoff, checklist length, signup-screen friction. Logged in say_no_queue.

## 7. Waves (agent-time sprints)

Waves are parallel dispatches with verification gates, not calendar weeks. A wave closes when its gate passes, and gates are production probes or founder reviews, never "code merged".

### Wave 1 · now (parallel)

| Ticket | Owner | Gate |
|---|---|---|
| PMF-101 | subject-lessons agent (in flight) | Local click-through: report → lesson → keep → Binder |
| PMF-104 | lessons agent + founder | 5 sample lessons pass founder review |
| PMF-201 | new agent | Backfill executed; 18 families seeded; natural-experiment cohorts labeled |
| PMF-401 | new agent | Weekly review script runs against prod and writes the first honest snapshot |
| PMF-301 | new agent | Opens recorded in `email_sends`; one test follow-up verified |

### Wave 2 · after lesson slice is green

PMF-202, PMF-102, PMF-203, PMF-402, PMF-302. Gate: day-1 brief cites a kept worksheet for a real family; keep possible from chat cards; stopwatch numbers appear in the weekly review.

### Wave 3 · habit deepening

PMF-303, PMF-103, PMF-204, PMF-205, PMF-403, PMF-304. Gate: first founder-approved weekly notes sent; evening check-in live for consenting brief-repliers.

### Wave 4 · decision-gated

PMF-602 (founder), PMF-501, PMF-601. Reopen E7 only if the Section 8 bars are met early.

## 8. Success criteria and falsification

Measured weekly on setup-done cohorts by signup week (non-censored where possible), from the PMF log:

- Create ≤48h: from ~24% to ≥50%
- Keep ≤48h (`materials.status=final`): from ~9% to ≥40%
- Return: ≥40% with 2+ parent-authored message days in week one (organic split reported alongside)
- Absolute: ≥30 creating families / ≥15 keeping families
- First trial > 0 only after the value bars are hit (wall stays off until then)

Falsifiers, written before the experiments:

- If backfilled brief families (PMF-201) show no organic return lift vs un-briefed within 7 days, the brief is correlation, not cause: shift weight to E1 and the weekly note (E3).
- If lesson create rises but keep stays under 15%, keep placement or the artifact itself is wrong: fix keep surfacing before adding lesson content types.
- If keeps rise but multi-day return does not, the artifact is not week-to-week useful: change artifact type before adding volume.
- If the Jul 7-13 pattern (5/5 multi-day in the high-touch era) fails to reproduce at n≥20 with the loops shipped, the retention story needs founder-level rethink, not more tickets.

## 9. Explicitly not doing now

- Signup-screen conversion work (E7 parked)
- Turning on the wall or any pricing UI (PMF-601 dark only)
- Auto-keep without parent action (founder ruling required)
- Daily-by-default texting or any reference to ignored messages (customer council blocker)
- "Part of his record" consent phrasing (replaced, see PMF-204)
- Moving the report into the chat transcript
- New push channels beyond SMS/email
- Resurrecting `skill_bank` / `family_skills`

## 10. Standing ritual

After every wave gate: run the PMF-401 weekly review, append the numbers and any falsifier verdicts to `.context/pmf-focus/limiting-factor-log.yaml`, and re-ask the WTF question (pmf-focus skill step 2) before dispatching the next wave. The limiting factor stays `lf-2026-07-16-core-loop-activation` until the Section 8 bars say otherwise.

## Appendix A · Key queries

Return metric (honest):

```sql
with fam as (
  select f.id,
    (select count(distinct (cm.created_at at time zone 'utc')::date)
     from conversation_messages cm
     where cm.family_id = f.id and cm.role = 'user') as user_msg_days
  from families f
  where f.profile_completed_at is not null
    and coalesce(f.sandbox, false) = false and f.status = 'claimed'
)
select count(*) as setup_done,
  count(*) filter (where user_msg_days = 0) as never,
  count(*) filter (where user_msg_days >= 2) as multi_day
from fam;
```

Brief reach vs return (confounded, for tracking only):

```sql
with briefed as (
  select distinct family_id from events where name = 'research.brief_sent'
)
select exists(select 1 from briefed b where b.family_id = f.id) as got_brief,
  count(*) as n,
  count(*) filter (where (select count(distinct (cm.created_at at time zone 'utc')::date)
    from conversation_messages cm
    where cm.family_id = f.id and cm.role = 'user') >= 2) as multi_day
from families f
where f.profile_completed_at is not null
  and coalesce(f.sandbox, false) = false and f.status = 'claimed'
group by 1;
```

Appendix B · Evidence snapshot (2026-07-16)

- 280 non-sandbox rows: 237 open (signup-screen abandons), 43 claimed, 34 setup done, 29-30 with a report
- Report: 23 families viewed, 200 views, 54 report emails delivered, 20 families tapped a CTA, 12 built a plan
- Materials: 9-10 created ever, 3 kept ever
- Messages: 18/34 setup-done never messaged; 9/34 multi-day; 5/34 3+ days
- Brief: 16/34 reached; 9/16 reached are multi-day vs 0/18 unreached; SMS 76 sent / 18 replied / 7 failed
- Task runs: morning_brief 29 done (live today), journal_prompt 3 (dark), custom 13
- Wall off; trials 0; paid 0; thank-you cards 6 sent
- Cohorts (setup done): Jul 7-13 n=5: 5 multi-day, 5 made, 2 kept · Jul 14-16 n=29: 13 multi-day (events-based, censored), 4 made, 1 kept
