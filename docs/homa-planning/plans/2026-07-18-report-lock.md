# The report lock: four open subjects, the rest with membership

Status: BUILT DARK 2026-07-18, behind `HOMA_REPORT_LOCK_ENABLED` layered on
`HOMA_WALL_ENABLED`. Nothing changes for any family until both flags are up
and the flip runbook below has been walked.

Founder ruling, 2026-07-18 (this document is the dated source; register:
`report-lock-four-open` and `paywall-naming-and-price` in
`docs/homa-planning/journeys/10-reconciliation.md` §5):

1. New-user paywall V1 is the founder's four-open-subjects direction from
   `plans/2026-07-18-paywall-directions.html`, steelmanned: assessment and
   scoring stay free, the report renders four subjects in full, and every
   other mapped subject is held behind the $19 membership offer. The unlock
   is an onboarding moment, not just an unlock (the first-subject chooser
   below).
2. This supersedes `paywall-door-placement`'s "the progress report remains
   free" for walled families while the lock flag is up, and it overrides the
   PMF master plan's "wall stays off until keep and return bars are hit"
   gate for this experiment. The founder accepts the activation risk on the
   record: the verified funnel collapses AFTER the report (29 report, 8
   created, 3 kept, 76% one-and-done, 0 trials, prod pull 2026-07-16), and
   the lock stands upstream of that break. The kill test below is the
   non-negotiable counterweight; flipping the lock without recording it is
   a process violation.
3. Naming: parent-facing paywall and report surfaces say "report" or
   "progress", never "map". Code identifiers (MapScores, MapFlow) are
   unaffected.
4. Prices at flip: $19 monthly only. The annual Payment Link env stays unset
   until the $99 sticker's exact collision with Homeschool Fox (T3) gets a
   founder read; `pricing-2026-07-06` already allows annual to begin at
   first conversion. The wall now treats the annual link as optional instead
   of failing open without it.
5. Existing families: quiet grandfather, free forever, via a one-time
   `billing_exempt` backfill (SQL below) run BEFORE the flip. They are the
   PMF-201/PMF-101 learning cohort; nothing they have changes, no
   announcement is sent, and their token links stay fully open.

## What shipped (all dark)

| Piece | Where |
|---|---|
| Free-four selector, fixed core (math, literacy, science, social-emotional), strengthOrder fallback, nothing locks at 4 or fewer mapped subjects | `packages/core/src/map/report-lock.ts` (+ tests) |
| Lock flag layered on the wall flag | `reportLockEnabled()` in `apps/web/lib/billing/wall.ts` |
| Held rows (name + answer count, no badge, no blur) and the one inline offer card between open and held rows | `apps/web/app/onboarding/r/[token]/report-view.tsx`, `apps/web/components/billing/report-lock-offer.tsx` |
| Lock copy (report/progress vocabulary, reassure first) | `apps/web/components/billing/wall-copy.ts` |
| Both report surfaces pass the lock; the shareable token URL holds rows for every viewer but renders checkout owner-only; sample and founder mirror never lock | `apps/web/app/app/[childId]/report/page.tsx`, `apps/web/app/onboarding/r/[token]/page.tsx` |
| Fifth wall door "report" for the existing beacon/event registry | `packages/core/src/events.ts` WALL_DOORS |
| Annual Payment Link now optional (monthly-only flip supported); the year-math bullet hides with it | `apps/web/lib/billing/wall.ts`, `wall-offer.tsx`, `report-lock-offer.tsx` |
| Unlock lands as onboarding: checkout carries the child in a short-lived cookie, `/api/billing/confirm` re-scopes it to the paying family and lands on that report with `?welcome=1`, where the first-subject chooser offers ONE default next step (build the first four-week plan) | `report-lock-offer.tsx`, `apps/web/app/api/billing/confirm/route.ts`, `apps/web/app/app/[childId]/report/welcome-chooser.tsx` |

Honesty rules encoded in the render: only mapped subjects lock (a not-mapped
row has no scored content to sell); held rows show the parent's own answer
count and nothing else; no blurred numbers, no teased badges, no urgency
timers; the free four are a fixed core so the held set never reads as "the
weak ones" (anti-guilt law).

## The kill test (pre-committed, record before the flip)

Windows and denominators use the locked language from
`.context/pmf-focus/limiting-factor-log.yaml`.

The lock comes OFF (flag down, doors wall may stay up) if, over the first
14 days after the flip, on new signed-up (claimed) families only:

- trials started per report-reached family < 10%, or
- report-reached to materials.created falls below 28% (the pre-lock rate)
  for families inside the lock cohort.

The lock has EARNED its place if ≥25% of report-reached new families start
trials AND trial families create and keep materials at rates at or above
the current cohort. Between the two bands: founder judgment, logged.

Falsification sentence (reality-checks habit): we abandon the lock if two
weeks of cohort data show it converting under 10% or suppressing the one
funnel step that worked.

## Flip runbook (founder actions, in order)

1. Stripe dashboard: create the $19/mo Payment Link with a 30-day trial,
   after-completion redirect to
   `/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`; register the
   webhook endpoint; leave annual UNSET per ruling.
2. Vercel env: `STRIPE_LIVE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL`. Do not set the annual
   URL. Keep `HOMA_WALL_ENABLED` and `HOMA_REPORT_LOCK_ENABLED` off until
   steps 3-6 are done.
3. Grandfather backfill (run against prod, then verify the count):

   ```sql
   -- Existing families keep Homa free: every claimed, non-sandbox family
   -- created before the flip timestamp. Adjust the timestamp to the
   -- moment the flag flips, never earlier than this ruling's date.
   update public.families
   set billing_exempt = true
   where status = 'claimed'
     and sandbox = false
     and created_at < '2026-07-18T00:00:00Z';  -- FLIP TIMESTAMP HERE

   select count(*) from public.families
   where billing_exempt = true and sandbox = false;
   ```

4. Founder read-aloud of every parent-facing wall and lock string in
   `wall-copy.ts` (the standing HUMAN-TODO gate).
5. Pricing page: the wall plan requires it in the same deploy as any flip.
   Still unbuilt; decide copy or explicitly waive on the record.
6. Test end to end in Stripe test mode: lock renders, checkout, confirm,
   welcome chooser, plan build, webhook mirror, cancel (PRD launch gate 6).
7. Flip `HOMA_WALL_ENABLED=1` and `HOMA_REPORT_LOCK_ENABLED=1`, watch the
   deploy READY, probe live: a fresh family's report shows four open rows
   and held rows; an exempt family's report shows everything.
8. Record the flip timestamp + kill-test bars in the build log the same day.

## Standing constraints this build leans on

- Trial stays card-upfront, uncapped (T1). At expiry V1 is fail-open on
  purpose (trial_started_at opens everything; nothing reads
  stripe_subscription_status yet). Known leak, accepted at current n.
- SMS never mentions payment or pricing. Briefs and inbound SMS are never
  gated by this lock.
- Do NOT enable `HOMA_LIVE_PROGRESS_ENABLED` while the lock is up without
  extending the lock to the live Progress surfaces: the flag-on redirect
  `/app/[childId]/report` → `/app/[childId]/progress` would bypass the lock
  entirely.
- The public sample report stays fully open: it is the tease that costs
  nothing.
- Concierge willingness-to-pay probe (PMF-602) on the 3 keepers and 8
  creators stays on the founder's plate; it is faster signal than the lock
  and unaffected by it.
