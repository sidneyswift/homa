# Onboarding + paywall + retention: reflective inquiry (2026-09-01)

Opened per `.agents/skills/reflective-inquiry/SKILL.md`, triggered by a live
temptation to rebuild mobile onboarding to match Headspace's structure and
polish before checking why the last two rebuilds didn't fix retention.

## Felt difficulty

We expected that completing the full child-info questionnaire and reaching
the progress report would hook families into returning. Observed: families
who created an account almost always finished the questionnaire to reach
the report, then mostly did not come back. This survived one full
structural rewrite already: chat-first onboarding (`chat-first-onboarding`,
PR #139, merged 2026-07-24) merged the questionnaire into conversation, and
the return problem persisted. Two rebuilds have not moved this number.

## Defined problem

The gap is not "onboarding is unpolished." It is: families who complete the
full data-capture flow and receive their first deliverable (the progress
report) do not form a habit of reopening the app afterward, and this held
across both a form-based flow and a chat-based flow, so the mechanism is not
obviously about input modality.

## Rival hypotheses

Ranked by how directly each is grounded in the actual data point, not by
how appealing each is to fix.

| # | Hypothesis | Predicts, if true | Fix it implies |
|---|---|---|---|
| H1 | The report is terminal: a destination, not a hook. Nothing about it creates a reason to reopen tomorrow. | Drop-off clusters right after report delivery regardless of onboarding polish. Families with no forward action on the report screen churn hardest. | Redesign what the report ends on, not the path to it. |
| H2 | Wrong value shown first. A report is diagnostic; a worksheet is something to use with the kid immediately. If the report arrives before/instead of a worksheet, the parent never forms "Homa = ongoing material generator." | Families who saw a real worksheet before/alongside the report return more than report-only families. | Change what ships first, not the report screen's design. |
| H3 | No re-engagement trigger exists at all, independent of what onboarding delivered. There is currently no notification ask in onboarding. | Families with any working reminder (push/SMS/email) return more than families with none, regardless of onboarding quality. | Ship the notification ask + a real reminder. Cheap, testable alone. |
| H4 | The chat-merge experiment is confounded by the ~18-24s turn latency recorded in `onboarding-turn-latency` notes (partially fixed to ~6-12s as of 2026-07-23). A bad first impression from slow replies could sink retention independent of format. | Engagement/sentiment in that cohort correlates with response wait time, not with chat-vs-form format itself. | Fix latency first, re-test chat-first clean, before concluding the format failed. |
| H5 | Ours simply is not polished enough next to Headspace. (The flattering story, and the one furthest from the actual retention data point.) | Families should show confusion or low trust tied specifically to visual quality, not to what happens after report delivery. | Reskin/reanimate onboarding. |

H5 is real but should not get to cut the line ahead of H1-H4: it is the
easiest to believe, the most fun to fix, and the least connected to the one
fact that actually motivated this inquiry (completion without return).

## Smallest useful test (not yet run)

Pull the real cohort: families who finished the questionnaire, received
the report, and did not return. For that cohort, check:
- Did they see a real worksheet/material before or alongside the report?
- Was there any explicit next step on or after the report screen?
- Did any reminder mechanism (push/SMS/email) actually fire for them?
- How does turn latency in their sessions compare to families who did
  return?

This is a read-only prod query against `homa-prod`
(ref `kzplntcdtsvdowntvlza`), cheap relative to a rebuild, and should move
confidence on H1-H4 before any redesign commitment.

## Headspace comparison, for context (not the driver of the inquiry)

Full launch-to-paywall screen set pulled via Appllama and saved as
reference: `/private/tmp/claude-501/-Users-sidneyswift-Documents-Projects-Sidney-homa/3a9630ed-ec86-4053-b049-004144a48a94/scratchpad/headspace-compare/`
(session-local scratch, not durable; re-pull via Appllama if needed later).
Structure observed: splash -> breathing entrance (~11s, continuous growth,
not two static frames) -> welcome/sign-in -> full account creation (SSO
stack, conflicts with Homa's passwordless ruling, not recommended to copy)
-> 3-screen pitch (product overview, human support, social proof) ->
2-question interview (goals multi-select, priority single-select) ->
personalized-plan screen (loading CTA, unclear if it is a real choice or a
pure transition, not confirmed) -> notification permission (a real gap
Homa should close regardless of this inquiry's outcome) -> guided
breathing exercise framed as "a short exercise" -> paywall (this captured
variant showed annual-only, $69.99/yr, not the toggle variant referenced
in `ios-headspace-pricing`; do not assume this is the only or canonical
Headspace paywall).

Worth transferring regardless of inquiry outcome: the notification ask,
and framing the worksheet-generation wait as an explicit named exercise
("a short exercise") rather than an unlabeled wait. Both are cheap,
non-architectural, and do not depend on resolving H1-H5 first.

## Existing infrastructure relevant to the chat-latency question (H4)

`agent-jobs` (Postgres claim-lease long-running-task runner) shipped
2026-07-18 for curriculum-studio (`HOMA_AGENT_JOBS_ENABLED`). Whether it is
wired into the onboarding chat path specifically is unverified as of this
writing. If not, the fast-ack-plus-background-worker pattern discussed for
onboarding chat may be a wiring gap, not new infrastructure.

## Findings (2026-09-01, same-session data pull)

Cohort: 45 non-sandbox families (excluding `+homatest` and one internal
field-study account with 400+ materials/800+ turns, clearly not organic)
who completed the profile questionnaire and had at least one child reach a
progress report. **This cohort is entirely web.** `mobile_onboarding_state
.completed_at` is non-null for zero real families, all 101 rows in that
table belong to sandbox/test accounts. The chat-first mobile rebuild
(PR #139) has not yet been completed by a single real family, so nothing
in this pull, or in any future pull until real mobile volume exists, can
speak to whether mobile onboarding specifically retains. Everything shipped
today (build 48, the Headspace-recipe paywall, the re-added annual plan)
remains unvalidated by real usage for the same reason.

Headline: of the 45, 32 (71%) showed no genuine follow-up more than 24h
after onboarding; 13 (29%) returned and did something real. A first pass
showed 91% "return," which was an artifact of the hourly dispatch cron
(`apps/web/agent/schedules/dispatch.ts`) synthesizing fake `role='user'`
messages to wake the agent for journal prompts/briefs, not the parent doing
anything; excluding that channel produced the 29% figure, which matches
the founder's lived experience.

Per hypothesis:
- **H1 (report is terminal):** consistent with the 71% figure, but every
  other hypothesis predicts the same base rate, so this cut alone can't
  isolate H1.
- **H2 (wrong first value):** SUPPORTED, directionally. Returners were 3x
  more likely to have already received a real worksheet before/alongside
  the report (31% of returners vs. 9% of non-returners). Small N, held
  before and after the dispatch-cron correction.
- **H3 (no re-engagement trigger):** SUPPORTED, strongly, on its factual
  premise. `reminder_sent_at` has fired for 2 of 85 real families, ever.
  `journal_prompt_last_sent_at` has fired for 4 of all 1,100 family rows in
  the database. This is a confirmed near-total absence of any working
  reminder mechanism, not underuse, though the pull can't show that adding
  one would fix return rates on its own.
- **H4 (latency confound):** WEAKENED, and in the opposite direction of the
  prediction. Returners had a *higher* average onboarding reply-gap (52s)
  than non-returners (30s). Families created after the 2026-07-23 partial
  latency fix returned less often (11%, 1/9) than families from before it
  (33%, 12/36), though the post-fix group is tiny. No positive evidence for
  H4 in this population.
- **H5 (polish):** silent. No table measures visual quality or trust; this
  pull cannot confirm or deny it, correctly, since privileging it without
  evidence was the exact trap this inquiry was opened to avoid.

Limitations: N=45 is small, every contrast rests on single- or low-double-
digit counts. `child_reports.generated_at` is upserted per child (can be
overwritten by a regeneration), so cutoffs were anchored to
`profile_completed_at` instead to avoid misreading a later regen as first
delivery.

**Updated belief:** the report-then-no-return pattern is real on web and
has two supported, cheap, non-architectural levers, get a worksheet in
front of the parent before or with the report (H2), and ship the reminder
mechanism that currently does not exist in practice (H3), rather than a
third structural rebuild aimed at polish or latency, neither of which this
data supports. Separately and just as importantly: mobile onboarding has
no real family volume yet, so any mobile-specific retention question is
currently untestable, and getting real families through it is a
precondition for this inquiry ever extending to mobile.

## Companion finding: the broader usage/top-user survey (2026-09-01)

Run alongside the retention test, against the same window, to answer a
separate founder question: who are our most active real users, what do
they actually do, and do fluent-chat users convert.

**The active population is tiny.** Of 85 non-sandbox, non-`+homatest`
family rows, only 17 ever sent one real (non-`dispatch`-channel)
parent-authored message in the ~2 month window, and only 16 ever had a
material created. That is the entire active population, not a slice of a
larger one. A raw `role='user'` count would have overstated this: 1,518 of
3,003 such rows are the scheduler injecting synthetic turns to trigger its
own proactive replies (morning briefs, evening check-ins), not parents.

**The top message-volume account (889 messages, 430 materials) is
Carolyng, a known co-founder collaborator and dedicated product tester,
not an organic customer**, and was excluded from "typical family" reads
accordingly. The next-highest (326 messages) is also billing-exempt with
no Stripe/Apple activity. Genuine organic signal in this population is
thin.

**The founder's hunch ("fluent chat users converted") is unresolved, not
confirmed.** Only 2 of 85 real families have ever had any Stripe status:
one active, one canceled. That is because the card-upfront paywall went
live 2026-07-28, four days before this window closes; the other real
families predate it and were grandfathered in for free, never asked to
pay. n=2 cannot support or refute the hunch. What little exists cuts
mildly against it: both billing-engaged families rank mid-pack (7th, 10th
of 17) by message volume and show ordinary, sometimes lost chat ("i cant
find the upgrade"), not fluent power-prompting.

**Feature adoption among the 17 active families:** materials/worksheets
16/17 (94%), the only broadly-adopted feature. Binder 4/17 (24%),
hours-log 3/17 (18%, one family drives nearly all rows), planner 2/17
(12%). Planner, binder, and hours-log are single-family habits, not
adopted features, at current real volume.

**Real behavioral texture:** most parents ask once and take what comes
back; one family (`halesme`) iterates hard on craft (seven refinements on
one flashcard deck, matches the "knew how to go back and forth" picture
the founder described, but is one family of 17); one true power user
(`busbyhomeschool`) is the only account using planner + hours-log +
recurring custom tasks together. A real, sharp complaint surfaced and is
worth a direct look, not yet confirmed as a bug: a parent asked for a game
for a 2-year-old, got one with no instructions ("wtf is this he is 2 he
can't read... Do better"), and separately wrote "I have answered this 5
times now," a possible repeated-question or memory-recall miss.

**Implication:** the honest answer to "what would a deep dive find" is
that there is not yet enough real post-paywall usage to find a conversion
pattern in. The paywall this population lived under barely existed for
most of the window. The highest-value next step both investigations agree
on: get real volume through the now-live paywall and the reminder
mechanism this ledger already flagged as absent, then re-run this exact
pull in 4-6 weeks against a real post-paywall cohort.

## Status

- [x] Data pull run against the real cohort (see "Findings" above)
- [x] Belief updated based on findings
- [x] Broader usage/top-user survey (see "Companion finding" above)
- [ ] Decision made on what to build, tied to whichever hypothesis survives
- [ ] Re-run against a real post-paywall cohort, target ~2026-10-01 or once
      real Apple conversions exist

Tracked in [gh#1053](https://github.com/sidneyswift/homa/issues/1053).
