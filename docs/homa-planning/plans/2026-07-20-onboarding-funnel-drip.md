# Onboarding funnel and stage-aware drip: findings and proposal

Date: 2026-07-20. Status: PROPOSAL, awaiting founder rulings D1 to D6 below.
Evidence: production Supabase queries run 2026-07-20 (project kzplntcdtsvdowntvlza)
plus a four-reader code audit of this worktree. Production numbers in this
document are point-in-time snapshots, not live counters.

## 1. The funnel as it exists in production

The flow (code-proven, `apps/web/app/onboarding/map-flow.tsx`):

1. Landing CTA "Get your free report" leads to `/onboarding`. A silent
   POST `/api/map/start` creates an anonymous `families` row (status `open`,
   no email) and a 90-day resume cookie before any input.
2. Parent step (blocking): email + password or Google. This is account
   creation, first screen.
3. Family step (blocking, `family-step.tsx`): family name, parent name,
   street address, city, state, ZIP, and US cell number, all required by
   client-side validation. The server schema (`mapFamilySetupSchema`,
   `packages/core/src/map/schemas.ts:60-70`) treats address and phone as
   OPTIONAL. The wall is entirely client-side.
4. Homeschool context step (skippable, one-shot).
5. Kids step (blocking): first name + full birthday per kid, up to 5.
6. Checklist (about 5 min per kid, per-question skip allowed).
7. Extras (optional), next-kid choice, scoring, then hard navigation into
   `/app/{childId}/report?fresh=1`.

All-time distinct-family counts from `public.events` (survives the 7-day
anonymous-row purge, so this is the honest historical funnel):

| Step | Families | Conversion from previous |
|---|---|---|
| map.started (tapped start) | 301 | |
| map.account_created | 56 | 19% |
| map.family_setup | 43 | 77% |
| map.question_answered | 41 | 95% |
| map.report_generated | 39 | 95% |
| map.report_viewed | 30 | 77% |

Live snapshot (non-sandbox, after reclassifying the smoke account, section 3):
48 claimed accounts, 40 finished setup, 38 added a kid, 36 have a report,
27 viewed one. 13 families have exactly one kid, 25 have two or more.
48 of 48 were active in the last 7 days. 21 of 56 waitlist emails never
became families.

### Where people stop, and how often

- **Cliff 1, tap-start to account: 81% loss.** Mostly concentrated in the
  2026-07-14..16 traffic spike (230 of the 243 current `open` husks). These
  visitors never typed an email; they are unreachable and their rows purge
  after 7 days (`purgeEmptyAnonymousLeads`). This cliff is a landing/first-
  screen conversion problem, not a drip problem.
- **Cliff 2, account to family setup: 23% loss.** Every one of the 8 real
  stalled families stopped at exactly the same place: last event
  `map.account_created`, zero questions answered. They created an account,
  saw the family step (name + full address + phone before any value), and
  left. These families ALL have emails. This is the primary drip audience
  and the primary UX fix.
- **After setup, the flow works.** Setup to report is about 95% per step.
  The sunk-cost effect Sidney hypothesized is real and visible: once a
  parent passes the family step, they nearly always finish.
- **Cliff 3, report emailed but never viewed: 9 families.** The report email
  went out (`report_link`, 64 delivered) and the parent never opened the
  report. No second touch exists.

Direct answers to "how often does that happen": of parents who create an
account, about 1 in 6 (8 of 48, 17%) stop before finishing family setup,
all at the same card; of families who earn a report, 1 in 4 never view it.
The billing stage is dormant on purpose right now: 45 of the real families
are `billing_exempt`, zero trials started, so the /admin/funnels final stage
correctly reads zero.

### Measurement caveats (why some of these numbers cannot be sharpened)

- `map.started` fires the moment the landing popup opens or /onboarding
  mounts, before any input, and `events.family_id` has no foreign key, so
  events from purged anonymous rows are orphaned and permanently
  unfenceable. The 81% top-cliff is an upper bound on real-parent loss;
  bots and idle popup opens are inside it and cannot be separated
  retroactively.
- `map.account_created` also fires for returning re-sign-ins
  (`returning: true` in the payload) and the funnel query never filters it,
  so stage 2 overcounts slightly.
- SMS-native families emit only `map.started`, `map.child_added`, and
  `map.report_generated`, never `map.account_created` or
  `map.family_setup`, so the funnel's middle stages read worse than reality
  whenever SMS families exist and the funnel can be non-monotonic.
- Acquisition attribution is captured but unusable: both web start callers
  hardcode `source: 'organic'`, stored UTM is read by no funnel query, and
  the claim-time waitlist mirror drops UTM to `{}`. Per-channel drop-off
  cannot be reported today.
- `public.waitlist` is write-only in the entire repo (three writers, zero
  readers), and `phone_leads` (SMS/voice leads, own status ladder plus
  `lead.*` events) appears in no console surface: two invisible pre-signup
  funnels. Neither table has any sandbox/test concept, and `mirrorToWaitlist`
  copies `+homatest` signups into the waitlist, so both datasets carry
  permanent test contamination.

### Why the existing reminder cannot fix cliff 2

`familiesNeedingReminder` (`apps/web/lib/map/store.ts`) requires
`exists (children where not pending_band)`. The 8 stalled families have no
children, so they can never qualify. Only 2 reminder_24h emails have ever
been sent. This is the same failure class as the 2026-07-14 bug recorded in
the function's own comment ("zero reminders ever sent in production"): the
eligibility gate excludes the population the reminder exists for.
**Escalation: this is a live production failure.** The fix (relax the gate,
copy that handles the no-kids case) is bundled into Phase 1 below rather
than hot-fixed, because the send copy and cadence need founder sign-off
(D2, D3), and sending email to 8 real families is not reversible.

## 2. Constraints the drip must respect (currently shipped promises)

- Every outbound email footer: "We only email you about your own family's
  homeschool, never promotions. Every kind of email has an off switch."
  (`apps/web/lib/map/email.ts:243`)
- The reminder email copy: "This is the only reminder we'll send."
- The email module contract comment: transactional only, "No sequences
  exist by design."
- No unsubscribe link, no List-Unsubscribe header, no suppression list;
  a hard-bounced address can be emailed again. Opt-out exists only for the
  evening journal prompt and the email channel (`email.opt_out`).
- Waitlist signup sends nothing and promises nothing.

A stage-aware onboarding drip is defensible as "about your own family's
homeschool" (finish the report you started), but "product updates and add
them to our email list" is promotions under the shipped copy. These need
explicit rulings (D1) and compliance work (Phase 2) before any send.

## 3. Test-family identification audit

**How classification works.** One canonical column, `families.sandbox`
(migration 20260714210000), set by exactly two rules: automatically when a
password signup's email matches `/\+homatest[^@]*@/i` (`attachAuthUser`,
`apps/web/lib/map/store.ts:230`), and manually via the one-tap console
toggle (`setFamilySandboxAction`). The roster Test chip is the column
verbatim. The roster's 299-to-55 shrink is NOT sandbox filtering: it is
`status <> 'deleted'` plus `EXISTS family_members`, which hides the
anonymous signup-screen husks.

**State found (prod, 2026-07-20).** 7 families sandboxed, all correctly.
No `+homatest` alias escaped. The 243 `open` rows are anonymous drive-by
visitors (one `map.started` event each, no email); they self-purge and are
not test families.

- **Fixed during this audit: `homa-console-smoke@thankshoma.com`**, a manual
  console-test signup from 2026-07-12, was NOT sandboxed and sat in the
  roster and funnel as a real stalled family. Marked `sandbox = true` in
  production. The stalled-at-setup cohort is 8 real families, not 9.
- Both "send issues" alerts on the founder console are test-family noise:
  `claude-verify-test@example.com` (sandbox, Resend rejects the domain with
  HTTP 422 on every report send) and `sidney+homatest3@gmail.com` (bounced).

**Why test data still leaks into founder view.** Sandbox families sending
real email is deliberate ("product emails still send, they land in the
founder's own inbox via the alias, which is the point", `store.ts:174-177`).
The leaks are elsewhere:

1. Digest trouble lines, overview email/delivery/run trouble, pulse, chats,
   and sessions have NO sandbox fence, so any broken test family alerts the
   founder as if real (`digest.ts:53-97`, `overview-data.ts:293+`).
2. Google OAuth strips plus-aliases, so a Google-path rehearsal is never
   auto-marked, and `attachAuthUser`'s fold-target lookup can fold rehearsal
   kids INTO the founder's real family (`store.ts:206-219`).
3. The SMS email-capture path sets `families.email` without the alias check
   and mirrors test emails into the waitlist (`sms-onboarding.ts:350-360`).
4. Non-alias test emails (`@example.com`, `+test`, a colleague's address)
   are invisible to every rule; only a manual tap fixes each one.

## 4. Proposal

### Phase 0, hygiene (no founder ruling needed, small PRs)

1. Fence sandbox families out of the digest trouble lines and the overview
   email/delivery/run trouble queries, or label those rows "Test", so test
   breakage stops reading as fleet breakage. (Keep real email sending for
   sandbox: that is deliberate design.)
2. Delete the `claude-verify-test@example.com` family or change its email to
   a deliverable `+homatest` alias (Resend rejects `@example.com` on every
   send, generating perpetual alert noise).
3. Apply `isSandboxSignupEmail` in the SMS email-capture path and skip the
   waitlist mirror for alias emails (`sms-onboarding.ts:350-360`).
4. Smoke-account rule: any manual console-test signup uses a `+homatest`
   alias; Google-path rehearsals must be console-marked immediately (OAuth
   strips aliases), or better, rehearse only via password signups.
5. Family-fold sandbox boundary: `family-fold.ts` silently discards the
   source family's sandbox flag (plus source/utm), so a fold can launder
   test data into a real family. Folds should refuse to cross the sandbox
   boundary or propagate the flag.
6. Skip the waitlist mirror for `+homatest` emails at claim time too
   (`mirrorToWaitlist`), not just the SMS path.

### Phase 1, unblock the funnel (the client-side ask, Sidney's hypothesis)

Split the family step. Screen 2 becomes: family name, parent name, state
(one select, justified by "your state's homeschool rules"). Address and
phone move to a "complete your profile" card AFTER the first report is on
screen, each optional, each with its own honest value framing:

- Mailing address: "so Homa can mail materials, and point you to activities
  and homeschool communities near you." (Sidney's framing.)
- Cell number: "so you can text Homa." Shown when SMS becomes relevant
  (progress updates, journal), not as a signup toll.

Because the server already accepts both as optional, this is a client-side
change in `family-step.tsx` plus a new post-report profile card. Existing
SMS-dependent features degrade gracefully for phone-less families (email
delivery fallback already exists in `deliverTaskMessage`).

The 24h reminder eligibility drops the children-exist gate so the
stalled-at-account cohort qualifies, with copy variants for
"no kids yet" vs "checklist unfinished."

### Phase 2, instrumentation (see the funnel per card, and trust it)

1. New event `map.step_viewed` with `props.step` (one registry entry in
   `packages/core/src/events.ts` EVENT_SCHEMAS, emitted on every FlowPhase
   transition in `map-flow.tsx`; `pnpm check:events` enforces registry
   parity, MJ-08). This makes per-card drop-off measurable for the first
   time; today a family stuck on the parent step is indistinguishable from
   one that never arrived.
2. Signup-failure visibility: emit on auth error at the parent step
   (auth failures are currently invisible).
3. Funnel honesty fixes: exclude `returning: true` from the stage-2 count;
   split stage 1 by `props->>'source'` (web vs sms); emit
   `map.family_setup` from the SMS basics path and a signed-up-equivalent
   at SMS email capture (semantics ruling D7).
4. Attribution: stop hardcoding `source: 'organic'`, pass through UTM at
   both start callers, keep UTM in the claim-time waitlist mirror, and
   surface source/UTM breakdowns in funnel-data. Per-channel drop-off
   becomes reportable.
5. Billing tail: emit `billing.subscription_active` and
   `billing.subscription_canceled` from the Stripe webhook on status
   transitions (today trial-to-paying and churn are silent column
   overwrites), and add `wall.viewed`, `wall.checkout_started`, and the new
   events to FUNNEL_EVENTS. The existing sandbox fence covers them for free.
6. Drip attribution: `map.resume_link_opened` (with a stale/valid flag)
   from the resume-link redirect, which today emits nothing, so nudge
   clicks and dead-link rates are invisible.
7. `/admin/funnels` additions: per-step funnel from `map.step_viewed`,
   report-viewed and paywall stages, a "reachable by email" flag on stuck
   lists, drip-send status per family, and a first-ever waitlist read
   (count + unconverted list); optionally a phone_leads tile.

### Phase 3, the drip (deterministic, not agent-composed)

**Prerequisites, discovered in this audit and required before ANY
multi-email sequence:**

- **Per-email link tokens.** All four resume-style emails mint into ONE
  `families.link_token_hash` slot (`mintLinkToken`), so every newer mint
  silently kills every older emailed link, including two emails in the same
  cron batch. A drip that sends more than one link per family needs a
  `link_tokens` table (per-send token, optional expiry) first.
- **Stale-link behavior.** A dead link on a cookie-less device today lands
  on /onboarding and silently bootstraps a brand-new anonymous family,
  separating the parent from her saved answers. The redirect should offer
  sign-in instead of forking.
- **Destination hint.** `resume-link` can only land on /onboarding; the
  "your report is waiting" nudge needs the redirect to accept a safe report
  destination so one link plants the session AND opens the report.
- **Suppression keyed on `to_hash`.** email_sends stores sha256(address)
  and `family_id` nulls on family deletion, so the suppression list keys on
  to_hash to survive deletions. The `family-invites.ts` per-address 24h cap
  (MAX_SENDS_PER_DAY with compensating delete) is the working frequency-cap
  template to copy.

One hourly evaluator in the existing `/api/map/cron` (heartbeated, exactly
like the current promise loops). Per family, compute stage from timestamps
(reusing `deriveFamilyStage` inputs and the /admin/funnels stuck-list
queries in `funnel-data.ts`, which already express "account, no setup" and
"setup, no report" as SQL), pick the next eligible nudge, send at most one,
and stamp an atomic per-(family, nudge) claim before sending (the
`report-email.ts` claim/release pattern; email_sends stays best-effort
observer, never the dedupe guard).

Stage-keyed nudge table (all "about your own family's homeschool"):

| Stage (audience today) | Nudge sequence | Stop conditions |
|---|---|---|
| Account, no setup (8) | T+24h resume link "pick up where you left off" · T+72h sample-report value email · T+7d plain-text founder note "what got in the way?" | any activity, opt-out |
| Setup, no kid (2) | T+24h "add your first kid, the checklist takes 5 minutes" | kid added |
| Kid, no report | existing reminder_24h, gate fixed | report generated |
| Report never viewed (9) | T+48h re-send with different subject, T+7d last touch | report viewed |
| One kid, evidence of more (subset of 13) | single nudge "set up the rest of the family", ONLY when waitlist.kid_count or homeschool context proves more kids exist | second kid added |
| Activated then quiet 14d+ (1) | hand off to the agent layer (journal/brief personalization), not the drip | activity |
| Waitlist, never signed up (21) | one invite email + one follow-up | signup, opt-out |

Cadence rules (the not-pushy contract): maximum 3 nudges per stall stage,
then silence; global cap one nudge email per family per 7 days; quiet hours
by `families.time_zone`; every eligibility re-checked at send time; any
opt-out stops everything. Every send is a new `EmailLedgerKind` (no
migration needed) and a registry event, so the founder console and digest
see drip activity for free. The evaluator excludes `sandbox = true`
everywhere; any future trial/billing nudges additionally exclude
`billing_exempt`.

Vercel config has exactly one cron (`/api/map/cron`, hourly), so the drip
rides that pass like the existing promise loops; no new scheduling
machinery, no eve schedule involvement.

### Phase 4, compliance + list (required before Phase 3 ships)

1. Unsubscribe link in every non-transactional email + `List-Unsubscribe`
   header; one-click suppression stored per family (new column or table).
2. Suppression list honored by every send path (bounced/complained
   addresses never re-emailed; today they can be).
3. Rewrite the footer promise and privacy page to match reality (D1).
4. Product updates / newsletter is OPT-IN only, a separate checkbox at
   signup or in settings, never bundled with the drip (keeps the "never
   promotions" spirit for everyone who didn't ask).

## 5. Founder decisions needed

- **D1**: Revise the shipped "never promotions / only reminder we'll send"
  copy to permit a bounded onboarding drip? (Phase 3 blocked without it.)
- **D2**: Approve the nudge table, caps, and cadence above (or edit it).
- **D3**: Approve copy direction for the three stall-stage emails
  (reassure-before-inform, offers never commands, per the copy rulebook).
- **D4**: Split family step now (Phase 1) ahead of the drip? It contradicts
  no ruling: the 2026-07-08 call moved signup to the start, and signup
  stays at the start; only address/phone move post-report.
- **D5**: Waitlist invite: send one invite to the 21 pending emails?
- **D6**: Product-updates list: build opt-in now or defer past the
  2026-07-13 launch runway?
- **D7**: SMS stage-2 semantics: does "Signed up" mean auth user created,
  or reconciliation key (email) captured? Determines how SMS families
  enter the funnel.
- **D8**: Churn re-lock: `familyWallCheckout` opens all doors forever once
  `trial_started_at` is set, so a canceled subscriber keeps full access.
  Making churn observable (Phase 2) is separate from deciding whether it
  should also gate.

## 6. Pre-launch defects found in passing (not yet user-visible)

- The month-plan retest email's CTA promises "Retest the month" but carries
  an empty `dd` and lands on the hub, which offers no retest entry
  (`cron/route.ts:132-138` vs `email.ts:414`). No retest email has fired in
  production yet (zero `map.retest_emailed` events), so this is a
  pre-launch fix, not an outage.
- `finishChildReport` on the SMS path scores and emits
  `map.report_generated` before any email exists, so an emailless family
  can hold an unsendable report.

## 7. What was done

Session 1 (2026-07-20, investigation):

- Marked `homa-console-smoke@thankshoma.com` sandbox in production
  (2026-07-20), removing a fake stalled family from the roster and funnel.
- Proposal written (this document).

Session 2 (2026-07-20, implementation). Founder approved "UX split +
tracking now" and "revise the promise + draft the nudges for review". No
email sends and no drip machinery shipped; those wait on the copy in
Appendix A and the Phase 3/4 work.

Phase 1, split the family step (the funnel unblock):

- `apps/web/app/onboarding/family-step.tsx` now asks family name, parent
  name, and STATE only (state stays: one tap, not sensitive, drives which
  state's homeschool rules Homa follows), plus the optional photo. Street
  address, city, ZIP, and cell number are gone from this card, along with
  the phone-taken claim branch it no longer needs. The server schema
  already treated all of them as optional (`mapFamilySetupSchema`), so this
  is a client-only change; nothing downstream breaks (thank-you card
  mailing and SMS already degrade gracefully for a family without them).
- New post-report card `complete-profile-prompt.tsx` + optional server
  action `profile-extras-actions.ts`, rendered by
  `app/app/[childId]/report/page.tsx` on the fresh-from-scoring landing
  (`?fresh=1`) only when the family has no mailing address yet. It collects
  the mailing address and cell number the signup card used to demand,
  both optional, each with its own value framing, AFTER the parent has done
  the whole assessment and can see why they help. It writes through
  `setFamilyAddress` / `addFamilyPhone` (not `/api/map/family`, which
  short-circuits once `profile_completed_at` is set), with `familyId` from
  the caller's own membership.

Phase 2, per-card instrumentation (see the funnel):

- New event `map.step_viewed` in the registry (`packages/core/src/events.ts`
  EVENT_SCHEMAS, plus the shared `MAP_FLOW_STEPS` allowlist), the beacon
  route `apps/web/app/api/map/step/route.ts` (server-emitted, since the
  public events policy stays waitlist-only), and a fire-and-forget beacon on
  every phase change in `map-flow.tsx`. Emitted once per (family, step). For
  the first time, a family stuck on the account (parent) step is
  distinguishable in the data from one that never arrived. `pnpm
  check:events` parity passes.

Guards run green: `check:events`, `check:isolation`, `typecheck` (the four
`rasterize-pdf` errors are a pre-existing local missing-dep gap, unrelated),
`lint` (0 errors), and the 21 core events unit tests.

Session 3 (2026-07-20, drip dark + per-card view). Founder approved
building both, stacked on the Session 2 branch.

The drip (Phase 3), wired DARK:
- `lib/drip/flag.ts` `dripEnabled()` reads `HOMA_DRIP_ENABLED` and is false
  unless the value is exactly "true", so nothing reaches a real family
  until the copy clears review and compliance lands.
- `lib/drip/sweep.ts`: a pure `chooseDripNudge(signals, now)` (unit tested,
  11 cases) plus `runDripSweep()`. Two audiences ship, mutually exclusive:
  setup nudge (signed up, no report: setup unfinished or no kid) and
  report-unviewed (a report emailed, family never opened one). Caps: one
  drip email per family per 7 days, each kind once ever, any `email.opt_out`
  stops everything, every rule re-checked at send. The add-a-kid nudge
  template exists for preview but is NOT in the automated audience (never
  guess a family has more kids). Validated against prod: the query resolves
  the real ~8 setup-stall and ~9 report-unviewed families, and correctly
  leaves the kid-no-report families to the legacy 24h reminder.
- `lib/map/email.ts`: three new `EmailLedgerKind`s + submit functions; the
  revised A1 promise rides the drip footer ONLY (other emails unchanged).
- `/api/map/cron`: `runDripSweep()` runs only under `dripEnabled()`,
  heartbeated with the other loops.
- Founder preview: `sendDripPreviewAction` (admin, founder-gated) sends any
  nudge to the founder's own inbox, does NOT read the flag, carries no
  family_id, so it can never touch a real family's dedupe or cap.

Per-card funnel (Phase 2 visualization):
- `lib/admin/funnel-data.ts` `stepFunnel` counts distinct families per
  `map.step_viewed` step (sandbox-fenced), and `/admin/funnels` renders the
  per-card bars plus the drip preview panel.

Guards green again: typecheck, lint (0 errors), `check:events`,
`check:isolation`, the 11 drip unit tests, and the two new SQL queries
executed read-only against prod.

Session 4 (2026-07-20, Phase 4 compliance). Built the machinery that must
exist before the drip can be un-darkened. Stacked on the Session 3 branch.

- Suppression store: `email_suppressions` (additive migration, applied to
  prod; deny-all server-only like email_sends, isolation guard covers it).
  Keyed by the sha256 the ledger already stores. Scope `drip` (unsubscribe,
  "stop") vs `all` (hard bounce, complaint). `lib/email/suppression.ts` is
  best-effort by the ledger's law: a read failure fails open, never
  silencing or breaking a send.
- Unsubscribe: `lib/email/unsubscribe-token.ts` mints a stateless HMAC token
  of the address hash (no raw address in the URL), gated on
  `EMAIL_UNSUBSCRIBE_SECRET`. `/api/email/unsubscribe` GET renders a
  scanner-safe confirmation page (never mutates); POST suppresses, serving
  both the page button and RFC 8058 one-click.
- List-Unsubscribe: drip emails now carry `List-Unsubscribe` (https + mailto)
  and `List-Unsubscribe-Post: One-Click`; the mailto path always works, the
  https path appears only when the secret is set.
- Bounce/complaint: the existing Resend webhook now writes an `all`
  suppression on `email.bounced`/`email.complained` (best-effort).
- Inbound "stop"/"start": now also writes/lifts a `drip` suppression, and
  the sweep's opt-out signal moved to `journal_opt_out_at` (accurate on
  re-opt-in) plus the suppression store, replacing the ambiguous
  `email.opt_out` event check from Session 3.
- Tests: unsubscribe-token round-trip/tamper/no-secret (6) and a
  suppression case in the sweep tests. Guards green: typecheck, lint,
  `check:events`, `check:isolation` (with the new table), 18 unit tests.

Copy gate cleared (2026-07-20). The A1 promise, all three nudges, and the
unsubscribe page ran through `homa-copy-reviewer` (the ICP read) then
`homa-copy-editor` (the rulebook), and the accepted fixes shipped: the
reserved-word "progress" collision in the setup email is gone, the report
email no longer opens on a strengths-vs-practice verdict (it leads with what
the child already does well), the setup ask is front-loaded, and the "crew"
metaphor and the "onboarding" tech-speak are out.

Still blocked before the founder flips `HOMA_DRIP_ENABLED` (config, not
code): setting `EMAIL_UNSUBSCRIBE_SECRET` and confirming the Resend webhook
secret is live. A `link_tokens` table is only needed if the drip later grows
past one-nudge-per-audience into true multi-step sequences. It is not
required for what is here. Then the founder's go.

## Appendix A. Email drafts for review (not shipped)

Drafted per the 2026-07-20 approval to "revise the promise + draft the
nudges". These are DRAFTS: they must pass `homa-copy-reviewer` then
`homa-copy-editor` before any send, and no send happens without an explicit
per-audience go. House rules applied (no em dash, sentence case,
reassure-before-inform, offers never commands, no "behind"/red framing,
never compare siblings).

**A1. Revised standing promise** (footer + privacy, replacing "we only
email you about your own family's homeschool, never promotions / this is
the only reminder we'll send"):

> We email you about your family's homeschool: your reports, a reminder to
> finish what you started, and the occasional nudge when there's new
> progress to see. No marketing. Every kind has an off switch.

**A2. Nudge, account created but setup unfinished** (audience: 8 families,
last event `map.account_created`, no kid, no report). First of a bounded
sequence; the off-switch, not a false "only one", carries the honesty:

> Subject: Pick up where you left off, {firstName}
>
> Hi {firstName}, you started setting up your family on Homa, and
> everything you entered is saved. Whenever you have five quiet minutes,
> you can add your first child and Homa builds a free progress report tuned
> to their age.
>
> [Continue where you left off]
>
> No rush. You can turn these reminders off anytime.

**A3. Nudge, report ready but never opened** (audience: 9 families, report
emailed, `viewed_at` null):

> Subject: {childName}'s progress report is ready to open
>
> Hi {firstName}, {childName}'s report is finished and waiting for you. It
> shows in plain language where {childName} is shining and where a little
> practice helps.
>
> [Open {childName}'s report]
>
> If now isn't the time, it will be here whenever you are. You can turn
> these off anytime.

**A4. Nudge, one kid set up with evidence of more** (audience: subset of
the 13 single-kid families, ONLY where waitlist `kid_count` or homeschool
context proves more kids exist; never inferred, to avoid guessing a family
has more children than it does):

> Subject: Add the rest of your crew, {firstName}
>
> Hi {firstName}, {firstKid}'s report is set. When you're ready, you can
> add another child and Homa builds theirs the same way, tuned to their
> own age.
>
> [Add another child]
>
> One at a time is perfectly fine. Turn these off anytime.

## Session 5 (2026-07-20): SMS attribution + the loop-back nudge

Founder asked for both after the activation ladder shipped.

**SMS attribution fixed.** `sms.message_received` never carried a family id
(231 events, zero attributable), so every inbound text was invisible to any
per-family metric even though most families text. `emitMapEvent` already
accepted an `options.familyId`, so the fix passes the id that was already in
scope: it rides the COLUMN, never the props, so the props contract and the
MJ-08 registry are unchanged and nothing identifying was added. Historical
events stay unattributable, which is why the activation ladder keeps reading
`conversation_messages` (durable, family-scoped, every channel).

**The loop-back nudge**, aimed at the ladder's measured cliff (5 of 36
families ever told Homa how it went). Audience: said yes to a plan, never
closed the loop, a full week on. It names the actual plan, so it only fires
when a plan exists. Shares `lib/activation/signals.ts` with the console, so
the cliff the console reports and the cliff the drip aims at cannot drift.

Two things caught in verification, both from running the real queries:
- 13 of 20 plans in production are the whole-month plan (`MONTH_PLAN_SUBJECT`),
  which is not in the subject bank. Resolving it through `getMapSubject` alone
  would have silently skipped the majority of the audience. Handled with the
  same month/subject split `/api/map/cron` makes for the retest email.
- The funnel's sandbox fence was a negative `not exists`, TRUE for an event
  whose family id matches no family at all, so orphaned rows from purged
  anonymous leads counted as families. Fixed to a positive join (shipped with
  the ladder, PR #68).

Copy gated through `homa-copy-reviewer` then `homa-copy-editor`. The reader
refused to answer an email that only asked her for work, so it says what Homa
already did first; the open "what worked and what didn't" became one narrow
yes/no; and a line reassuring her that not doing the plan was "not a failure"
was cut for naming a judgment she had not made. The editor pass removed three
restatements of one idea, named the concrete artifacts, made the CTA its own
verb-first sentence, and unified the voice to first person. The shared drip
footer lost its "off switch" metaphor for the actual instruction, and now
says "progress report" per the one-name-per-concept law.

Still dark: `HOMA_DRIP_ENABLED` is unchanged, and the Phase 4 go-live gates
(unsubscribe secret set, suppression verified live) still stand.

## Session 6 (2026-07-21): drip observability in the founder console

The drip went live at 05:00 UTC and the founder asked to be able to track it:
what was sent, why, delivered, opened, and did it work.

New `/admin/drip` (nav entry added). Three parts: a per-nudge scorecard
(sent, delivered, failed, worked, waiting, unsubscribed), the live queue of
who gets emailed next, and every send with the reason it was picked.

Two honesty rules are baked in, because both were easy to get wrong:
- **Effect is scored against the nudge's own stated target**
  (`lib/drip/labels.ts`), and those targets are the same
  `lib/activation/signals.ts` rungs the drip aims at, so what is measured and
  what is nudged cannot drift apart.
- **A nudge sent an hour ago has not failed, it is waiting.** Effect is only
  scored once the 7-day window closes, and the rate is reported over settled
  sends with the settled count beside it. All 22 live sends are currently
  pending, so the page says "too early" rather than 0%.

**Why** is now recorded at send time into the previously unused
`email_sends.meta` (no migration): "signed up 5d ago, setup never finished,
no report yet". Written at send time on purpose, since the audience that
picked her will have changed by the time anyone asks. Also surfaced on the
family detail page beside each send.

Caught by running the scoring query against live prod: a bounced send had
written an `email_suppressions` row, and the draft counted it as
"unsubscribed". A dead mailbox is not a person choosing to stop. Opt-outs now
count only `reason in ('unsubscribe','stop')`; bounces stay in `failed`. The
same check proved the bounce-to-suppression pipeline works in production, and
that there have been zero real opt-outs across 22 sends.

Opens and clicks are deliberately NOT tracked: no pixel, no rewritten links.
Outcome is measured by what the family did instead, which is unfakeable and
is the thing we actually care about. Founder decision pending if that changes.
