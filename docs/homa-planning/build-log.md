# Build log — decisions agents made alone

Per BUILD.md: anything an agent was forced to decide without a founder ruling is
logged here so decisions stay auditable. Newest entries first.

## 2026-07-08 · One onboarding for every door (signup, signin, setup unified)

Founder instruction: "we make all sign in, sign up, and onboarding use the
same stuff", with the expected flow spelled out: popup signup (Google or
email+password) creates the account, then a create-your-family card
(family name, her name, address, phone, optional profile photo), then the
SIGNIN flow's add-a-child card (not the onboarding one), then the
questionnaire, results, and the /home dashboard.

What changed:

- **FamilyStep** (`apps/web/app/onboarding/family-step.tsx`): new step
  between the account moment and kids. Gated by
  `families.profile_completed_at` (migration #26), shows exactly once.
  Saves via new `POST /api/map/family` (cookie/session-scoped, tenancy
  law intact) with `mapFamilySetupSchema` + the `map.family_setup` event.
- **KidsStep rebuilt** as the /home "Add a child" card (first name,
  birth month + year selects, interests, help-with), multi-kid via "Add
  child" then one primary start button. Reuses `POST /api/map/children`
  unchanged (it already accepted interests/helpWith).
- **/home redirects** unfinished setups into /onboarding (no family,
  family card not done, no kids, or no results while an in-range kid
  waits); its CreateFamilyForm + createFamilyAction are deleted (the
  `create_my_family` RPC stays in the DB for the mobile app).
- **/signin is sign-in only** (create-account tab and signUpAction
  removed); "New to Homa?" links to /onboarding.
- **Report page** (non-sample): the closing band's stale invite-list copy
  and the footer link now point at /home ("Go to your family dashboard").
- **Migration #26** (`20260708124500_family_profile_setup.sql`, applied
  to homa-prod): families gains address_line/address_city/address_zip,
  parent_avatar_url, profile_completed_at; public `avatars` storage
  bucket with owner-scoped write policies.

Decisions made alone, flagged for review:

1. **Month + year only for kids' birthdays** (day saves as 01, the /home
   convention). This follows today's explicit "use the signin add-kid
   card" instruction and screenshot over 2026-07-06's "get the actual
   birthday" ruling. Age-band math needs month precision only.
2. **The extras step never asks twice**: with interests/help-with now
   collected on the kid card, extras shows only for a kid who left both
   empty there.
3. **Address granularity**: one street line + city + state + ZIP as real
   columns (state feeds the existing us_state compliance path). Address
   and phone are required by the card's own validation but tolerated as
   optional by the server schema, so a degraded save can never strand
   anyone.
4. **Phone soft-link**: the number always saves to families.phone_e164
   (contact info); the family_phones texting link (unique per number)
   stands down quietly when another family already claimed it, instead
   of blocking setup. The /home texting card remains the place to sort
   that out.
5. **Avatar bucket is public-read** (standard avatar posture; owner-only
   writes). The D4 consent floor gates photos of KIDS in materials; this
   is the parent's own photo, uploaded by them, of themselves. The
   /api/map/family route only stores URLs that point into our bucket.
6. **Deep links (?dd=, ?start=) bypass the family-setup gate**: they
   serve engaged families mid-task; the card catches them on their next
   plain visit.
7. **Existing families were NOT backfilled** as setup-complete, so every
   current family (the founder's own included) sees the family card once
   on their next /onboarding visit; there is no launched cohort to
   protect yet.
8. **Signed-in users with no family self-heal**: /onboarding's bootstrap
   now re-reads state after opening the anonymous session, so an auth
   session with no membership row links server-side instead of being
   asked to sign up again.

Verification: typecheck, lint, check:events, check:isolation, check:map,
and the web build all green. Full browser walkthrough against the dev
server (signup, family card, add kid with interests, 47-question
checklist, report, "Go to your family dashboard" landing on /home with
no redirect bounce): every step passed, the extras step correctly
skipped for a kid with interests, and a cookieless /signin shows
sign-in only with the /onboarding link.

## 2026-07-08 · Report gains the snapshot TLDR + by-subject trajectory chart

Founder instruction (with screenshots of the mac mini's daily Slack post and
dashboard hero chart): "the report / dashboard should have this chart and
tldr." Ported from `homa-macmini` (`post_dashboard_slack.py`,
`generate_dashboard.py`) into the web report as two new server components,
`report-snapshot.tsx` (the TLDR card, after the note from Homa) and
`report-trajectory.tsx` (months-ahead-by-subject line chart over check-in
dates, SVG, no client JS), shared by the live report and the public sample.

Two translations the anti-guilt display law forced, decided alone:

1. **"⚠️ Lowest standing" does not port.** The internal post ranks the
   bottom three domains under a warning glyph; the product law bans deficit
   framing. The TLDR's second column is "Growing right now" (sky, worded,
   never numbered), falling back to "Closest to age" with honest at-age
   labels when nothing is growing. Same information, sanctioned frame.
2. **The target reference lines do not port.** "Academic target (24mo)" and
   "Socioemotional target (12mo)" are Story-family philosophy, not product
   policy; drawing every family against them would be manufactured guilt.
   The chart keeps plain gridlines (+6 to +24, the display cap) and the
   at-age baseline. Growing subjects plot on a quiet slot just below the
   baseline, worded "growing", matching the whole-picture dot chart.

The trajectory chart renders only once a second check-in exists (one date
is a dot, not a trajectory); first reports get the TLDR alone. "Next
re-check" row appears only when a plan's four-week clock is armed. Colors
are design-system tokens only, one per subject. No schema, scoring, or
event changes (pure display over already-stored history).

Verification: typecheck + lint green; sample report (2 eras) renders the
card and chart correctly via Playwright screenshot against the dev server.

**Follow-up (same morning), founder design review ("yours vs mine"):** the
first cut read as flat lines with no timeline and no room. Rebuilt to the
mac mini chart's comprehension model, two conventions founder-ruled
explicitly:

1. **Every subject starts at the at-age line** one week before the first
   check-in ("start" tick, no fabricated date printed), so the first week
   renders as a burst of measured progress; this also un-gates the chart
   for FIRST reports (one check-in + the origin is a drawable story).
   Growing subjects start on their own quiet slot instead: starting them
   at zero would draw a dip that never happened (anti-guilt).
2. **The axis always extends four weeks past today** (open future,
   founder: "chart breathing room"). Chose empty space over dashed
   expected-results projections (the other sanctioned option) since no
   expectations model exists yet; the armed plan re-check date renders as
   a named sage marker in that future window when present.

Also: calendar gridlines with evenly spaced date ticks, ringed markers at
every check-in (latest point solid), per-series hairline lanes (2px,
upward only, never below the at-age line) so identical whole-month values
stay countable, two color collisions fixed (executive function to
stone-700, gross motor to gold-400), and the section retitled to the
founder's phrasing: "How ahead is {child}, by subject (months)".

**Second follow-up (same morning), senior-design pass on the card:**

1. **The y-axis now fits the child**: max reading plus headroom snapped
   to 6-month bands (floor +12, cap +24). The old fixed +26 axis parked
   a +10 kid in the bottom half of an empty frame, quiet deficit
   framing by composition.
2. **Emphasis hierarchy**: lines that moved (or sit clearly ahead) render
   featured (2.5px, full opacity, drawn on top); flat lines recede
   (1.5px, 45%). Six at-age subjects are one message, not six shouts.
3. **Direct end-labels replace the legend**: every line is named at its
   endpoint in the open future space (colored anchor dot, muted mono
   text, collision dodging, hairline leaders, width-budget truncation).
   No more matching thirteen hues against a legend.
4. **Figure-ground**: the plot sits on its own white bg-card inside the
   sunken snapshot card, same treatment as the whole-picture chart.
5. **TLDR rows are now jumps** (reusing SubjectJump) to their subject
   drawers, the TLDR doubling as the report's table of contents; growing
   rows' redundant "growing" value became the offer "next step ↓".

**Third follow-up, founder RULE (2026-07-08): "downward on the line chart
is ok. make that a rule."** Codified in BUILD.md law #4 as a scoped
exception: trajectory line charts may draw honest downward segments
(copy still never says "behind"; a drop never gets red or warning
treatment). In code: growing-first subjects now start at zero like every
other subject, so their week-one segment dips to the growing slot as it
actually happened, and the hairline lanes center on the true value
instead of nudging upward-only. Scope note: movement chips, sparklines,
and prose remain positive-only; the ruling covers line-chart geometry.

## 2026-07-08 (afternoon) · S1 becomes a full sign-up, overturning "password last"

Instruction "add a create password input... basically a sign up / create
account page, with google as an option or email/password" ran straight into
2026-07-06's explicit, twice-revised ruling that password is the LAST
question, right before the report, specifically to keep the highest-friction
ask off the entry screen. Flagged the conflict; instructed to override it.
Two decisions made in the same sitting, both confirmed with the founder
before touching code:

1. **Password moves to S1.** `ParentStep` now creates the real Supabase
   Auth account directly (`/api/map/claim`, signUp + signInWithPassword +
   attachAuthUser), the same moment a Google sign-up would. `mapClaimSchema`
   gained `firstName`/`lastName`/`password`; the old email-only shape and
   the `map.claimed` event (superseded by `map.account_created`) are gone.
2. **Name moves to S1 too, `SignupStep` is retired.** Since the flow's
   routing only ever showed `SignupStep` while `!hasAccount`, and hasAccount
   is now always true the moment kids exist (matching how Google sign-ups
   already worked), that step could never fire again. Rather than leave it
   dead, folded its one required field (name) into `ParentStep` alongside
   password, and deleted `SignupStep` + `/api/map/signup` outright.
   `decidePostKidsRoute`/`needsPreHubSignup` simplified accordingly: no
   route past S1 needs to ask "does she have an account yet."

**Follow-up (same day):** `SignupStep`'s optional cell number field
(2026-07-07, "so you can text Homa") had no other home to fold into and was
dropped rather than force it into S1 uninvited. Rather than lose that
capture point, moved it to `/home` under a new "Settings" section: the
existing `TextingCard` (previously gated behind `TELNYX_SMS_ENABLED`, so
it never rendered at all in deployments without a live texting line) now
always renders, since saving a number never actually depended on Telnyx,
only the confirmation text and the "text her directly" framing did. Copy
adapts: "Text with Homa" once a live line exists, "Your phone number" as
plain contact settings otherwise.

Verification: typecheck, lint, `check:events` green (registry parity holds:
`map.account_created` still has three emitters, one more than before).
`check:map`/`check:isolation` not re-run (no bank or query-path changes).

## 2026-07-08 (morning) · Tester feedback T1-T4 shipped

Founder instruction "implement t1-t4" against
`plans/2026-07-07-tester-feedback-tickets.md` (cut from the 2026-07-07
tester voice memos):

- **T1, copy:** the Stories band heading is now "It helped run our
  homeschool first." Wording decided alone (the plan had it
  founder-gated, the instruction implied delegation): "helped" is the
  minimal change that moves the control framing back to the mom while
  keeping the dogfooding story. Owes the founder read-aloud before
  July 13.
- **T2, nav:** the wordmark in the `/home` and `/chat` headers is now a
  link to `/home` (aria-label "Home"); the right-side Home button in
  chat stays.
- **T3, worksheet voice:** `create_worksheet`'s `encouragement` is
  redescribed as written TO the child (description-only change, the
  payload shape is untouched so older saved transcripts render as
  before); the tool's note now tells the model to give the parent her
  own warm line in chat; the printed footer carries the line-treatment
  Homa mark beside "made with Homa for [name]" (D7 footer attribution),
  stroke in the footer's ink color so grayscale printers render it
  clean. `HOUSE_PATH` is exported from `Logo.tsx` so the raw-HTML print
  window shares the one source of brand art.
- **T4, thinking state:** `busyLabel` now judges the LAST message part
  instead of scanning backwards, closing a real blank-screen gap (busy,
  tool finished, next token not yet streaming, previously returned null,
  the exact "is it working?" panic in memo 1); the busy bubble now
  carries the Homa mark bobbing gently (`chat-think-bob`, transform
  only, brand easing, still under reduced motion).

Verification: typecheck, lint, `check:map`, `check:events` green.
`check:isolation` not re-run (no schema or query-path changes).

## 2026-07-08 (past midnight) · "Send an email" tool, web chat/SMS + both voice lines

Founder decision (chat, "what tools can she trigger, can she send an
email" → "both"): give Homa a real, live email-sending capability on
every surface: web chat, SMS, the general inbound voice line, and the
curriculum outbound line.

Shipped (deployed, verified live against real Telnyx assistants):

1. **`lib/map/email.ts` gained two exports**: `sendAgentComposedEmail`
   (model composes subject + a few body lines; the visual shell, footer,
   and unsubscribe framing stay code-controlled exactly like every other
   Homa email, so the model never emits raw HTML) and `getFamilyEmail`
   (server-only lookup of the family's own registered address).
2. **Web chat + SMS**: new eve tool `send_followup_email` (family email
   resolved under the caller's own RLS via `createCallerDbClient`,
   exactly like every other tool in this codebase; never an
   address the model supplies).
3. **Voice, both assistants**: a new webhook tool (`type: "webhook"`,
   Telnyx's live mid-call tool-calling mechanism, confirmed via their
   Async Tools docs before building) at
   `POST /api/voice/tools/send-email`. `family_id`/`child_id` are
   templated straight into the tool's URL from each call's own dynamic
   variables (`{{family_id}}`/`{{child_id}}`), never something the model
   fills in; only `subject`/`body` are model-supplied parameters. The
   general line's `/api/voice/context` webhook now also resolves and
   returns `family_id` (and `child_id` when the family has exactly one
   child, blank/ambiguous otherwise), so the SAME tool config works
   unmodified on both assistants.
4. **Guardrails, both surfaces**: recipient is ALWAYS the family's own
   `families.email`, never model input (BUILD.md law #1: a
   model-controlled recipient would turn the transactional domain into
   a spam relay); the same brand-law gate (no em dash, no banned words)
   runs on subject+body before anything sends, and on a voice-tool
   rejection the error is phrased as an instruction so the model can
   rephrase and retry live in the conversation; a per-family rate limit
   (5/day, the existing in-memory coarse damper already used by the
   public map routes, same honest "not a hard global guarantee" posture).
5. **Both Telnyx provisioning scripts now sync `tools` AND
   `instructions` on every run** (previously only the curriculum script
   synced instructions; the general script was create-once-only).
   Verified live via a direct GET on both assistants after running:
   identical tool config present on each.
6. New events `voice.email_sent` {family_id, child_id?} and
   `chat.email_sent` {family_id, channel: "web"|"sms"}, no content ever
   in props.

Decisions made alone (auditable):

- **A shared tool definition** (`sendEmailToolConfig` in
  telnyx-shared.mts) used verbatim by both assistants rather than two
  near-duplicate configs, so a future change to the tool (rate limit,
  URL, schema) can never drift between the two lines.
- **Synchronous, not async, webhook tool**: Resend calls resolve in
  under a second, so there is no "keep talking while it processes" need
  that would justify the added complexity of Telnyx's async-webhook +
  Add Messages API pattern (built for slow lookups, not fast sends).
- **Rejection reasons are written AS instructions to the model**
  ("Rephrase without an em dash... and call this tool again") rather
  than terse error codes, specifically so a live voice conversation can
  self-correct instead of the call just going quiet on a gate failure.
- Fixed a pre-existing gap while touching `telnyx-provision.mts`: the
  10DLC campaign step's "still processing" error (10036, the ongoing
  registry wait from earlier tonight) was crashing the whole script
  before it ever reached the voice-assistant sync step; now handled the
  same gracefully-logged way as the account-level block.

Follow-ups: no live send was fired to a real user as a test (verified
the auth and brand-law rejection paths instead, both correct, and the
send path itself reuses `send()`, already proven by every other
transactional email in this app); worth watching whether 5/day per
family is the right ceiling once real usage exists.

## 2026-07-07 (night) · "Call Homa" curriculum feature: report → voice call → LLM curriculum

Founder decisions (chat): a "Call me" button on the generated report
triggers an outbound voice call where Homa reviews the report and digs
deeper; the resulting curriculum is LLM-authored and richer than the
existing four-week plan (real lesson ideas, materials, weekly themes),
whatever length Homa judges the family needs (not a fixed 4 weeks); it
shows up in a lightweight new section on `/home` (the real M2-08
dashboard stays backlog); the number dialed reuses the family_phones
system built earlier tonight (prefill if linked, prompt inline if not).

Shipped (deployed to production, all guards green):

1. **Data layer** (migration `child_curriculum_calls` + `child_curricula`,
   applied to homa-prod): product-side only, no lead-side twin needed,
   by the time a report is viewable the parent has already signed up
   (password is the last onboarding question) and the score route has
   already bridged a family workspace, so every report viewer already
   has a real family_id/child_id. Same `is_child_family_member` RLS
   posture as `child_plans`/`child_reports` (migration #23). Members can
   start a call (their own insert policy) but never forge its completion
   or a curriculum directly: only the server-only connection (the
   insights webhook) transitions status or writes a curriculum.
2. **Curriculum content** (`packages/core/src/map/curriculum.ts` +
   `curriculum-gate.ts`): a new, freer schema than the four-week plan
   (title, Homa's own duration call, overview, per-subject weeks with
   activities/materials, a consolidated materials list, a parent note).
   The gate reuses the brand-law checks (no em dash, no banned words)
   but NOT the report gate's numeric-citation enforcement, since a
   curriculum inherently proposes new activities, it does not restate
   computed facts.
3. **Generation** (`agent/curriculum-writer.md` + `lib/map/
   curriculum-generate.ts`): same `generateObject`/gateway posture as
   the report narrative writer, fed the report's existing `ReportFacts`
   plus the call-extracted facts. Two-strike safety net: a gate failure
   retries once, a second failure falls back to wrapping the EXISTING
   deterministic `buildFourWeekPlan` output in the curriculum shape, so
   a family never gets nothing.
4. **Mechanism** (researched live against Telnyx docs before building):
   a SECOND, outbound-only assistant ("Homa curriculum call",
   `assistant-f96c8f74…`, provisioned via new idempotent script
   `scripts/telnyx-curriculum-provision.mts`), separate from the general
   inbound voice line, paired with a Telnyx **Structured Insight**
   ("Curriculum call extraction") whose instructions extract subjects/
   concerns/interests/goals AND echo back `family_id`/`child_id` as
   dynamic variables verbatim, wrapped in an **Insight Group** with a
   webhook pointed at `/api/voice/curriculum/insights?key=...` (same
   keyed-URL auth posture as `/api/voice/context`). This is the
   documented, purpose-built Telnyx mechanism for exactly this ("extract
   structured data from a finished conversation, deliver it by
   webhook"), found after the first attempt (`post_conversation_settings`
   tool-calling) turned out to be the wrong tool for this job.
5. **Two new routes**: `POST /api/voice/curriculum/start` (signed-in
   only; verifies child ownership under RLS FIRST, links/reuses the
   family's phone via the existing `family-phone.ts`, builds report
   facts, places the outbound call with family_id/child_id/report
   summary as dynamic variables, records the attempt) and
   `POST /api/voice/curriculum/insights` (the webhook; correlates the
   insight's echoed ids against a real `initiated` call row before
   trusting anything, generates, gates, upserts, emits the event).
6. **UI**: `CallHomaCard` on the report page (beside `ConsentCard`,
   phone prefilled from `family_phones` when linked); a lightweight
   curriculum card per child on `/home` (title + overview once ready, a
   quiet "Homa is building it" state while a call is in flight).
7. **Events**: `voice.call_started`, `voice.call_failed`,
   `voice.curriculum_generated` (registry + parity check green).
8. **Isolation**: `expectEmptyRead`/`expectInsertDenied` probes added
   for both new tables, verified against homa-prod.

Decisions made alone (auditable):

- **No lead-side mirror tables**: unlike the SMS phone link (which had
  to support pre-signup leads), a report is provably post-signup, so
  building this product-side-only is simpler and was verified against
  the actual signup-then-bridge flow, not assumed.
- **Correlation via echoed dynamic variables, re-verified against a real
  call row**: the Structured Insight echoes `family_id`/`child_id` back
  in its own structured result (documented Telnyx capability: insight
  instructions can reference dynamic variables). The webhook never
  trusts those alone, it requires a matching `initiated`
  `child_curriculum_calls` row for that exact child within a 2-hour
  window, so forging a write needs both the webhook secret AND control
  of the Telnyx account, at which point the account is already
  compromised. Simpler and more robust than fetching conversation
  metadata by a separately-tracked `call_control_id`.
- **A second assistant, not variable-branched instructions on the
  first**: the general inbound line and this outbound review call have
  materially different jobs (warm companion vs. structured
  info-gathering) and different post-call behavior (one needs the
  Insight Group, one does not); a dedicated assistant kept both
  instruction sets clean instead of one prompt branching on a
  `call_purpose` variable.
- **The curriculum gate skips numeric-citation enforcement** (unlike the
  report gate): a curriculum is inherently generative (new activities,
  new materials), so there is no fixed "every number must come from
  facts" contract to check it against; only the universal brand laws
  (em dash, banned words) apply.

Follow-ups this creates: real dashboard (M2-08) still supersedes the
/home lightweight section whenever it's built; multiple curricula per
child over time (currently one row, latest call wins) if a family calls
back later and wants history kept; the model choice for this second
assistant inherits tonight's "no Haiku" veto (Qwen3-235B, same as the
general line) but was not separately re-confirmed by the founder.

**Addendum (later, first real call, founder repro "that didn't go
through"):** a real call to alessallanes@gmail.com's report surfaced two
bugs, both fixed and deployed, found by replaying the exact outbound
request against the live Telnyx API rather than guessing:

1. **Root cause of the failure**: the outbound-call POST never included
   `AIAssistantId` in the body (only the TeXML app id in the URL path,
   which Telnyx's docs example shows alongside, not instead of, the
   body field). Telnyx rejected every attempt before a call row was
   ever created, hence zero rows in `child_curriculum_calls` and the
   generic client-side error.
2. **Latent bug caught while verifying the fix**: the response is a flat
   `{call_sid, from, to, status}`, not `{data: {call_control_id}}` as
   assumed; the tracking id would have silently stored as null.
3. Separately, `.env.local`'s `TELNYX_CURRICULUM_TEXML_APP_ID` had
   somehow picked up extra trailing digits (corrupted to
   `299919608238833845220024` instead of `2999196082388338452`);
   corrected. Vercel production's copy was set from a clean string
   earlier and was not affected.

Also mid-session: a separate, larger concurrent change (migration #25,
`20260708021500_drop_lead_world.sql`) retired the entire `lead_*` table
family (one-world unification: `families`/`children` are now created
directly from the first tap, no separate staging schema). The
curriculum feature was unaffected because it was deliberately built
product-side-only from the start (see the original entry above); this
turned out to be exactly forward-compatible with that consolidation.

**Addendum (founder call-quality notes, first live call heard):** Homa
was too talkative, wandered into questions that did not resolve a real
gap, and never mentioned that the parent can check back in tomorrow.
Fixed by feeding the call TARGETED information instead of a flat
subject list:

- New `buildCallFocusSummary()` (`lib/map/curriculum-store.ts`): ranks
  subjects worst-first, keeps only those actually needing help
  (`not_mapped`/`growing`), and for each states what is CONFIRMED versus
  what is an UNCONFIRMED GUESS to check. Deliberately does NOT pad to a
  fixed count: a child with one real gap gets one focus area, not a
  manufactured second question. Caught live against Story's real report
  data: the naive "always top 2" version was pairing the one genuine gap
  (self-care) with an already on_track subject where the confirmed skill
  and the "gap to check" were the identical sentence, exactly the
  wasted-question pattern being fixed.
- `agent/curriculum-call-instructions.md` rewritten: one sentence per
  turn, never explore for its own sake, spend the whole call on the new
  `{{focus_subjects}}` block, one simple concrete offer per resolved
  gap, explicit closing line inviting a call or text tomorrow for a
  quick day-review, hang up once the focus list is resolved rather than
  filling time.
- The provisioning script now syncs instructions to the live Telnyx
  assistant on EVERY run (previously create-once-only), so a prompt
  edit takes effect the moment the script re-runs instead of silently
  drifting from what is actually deployed; verified live via a direct
  GET against the assistant after running it.

## 2026-07-07 (late night) · Tester voice memos transcribed and ingested

Fourteen voice memos (~11 minutes, recorded this afternoon by a pilot tester
walking the product) arrived in `~/Downloads/homa-notes-july-7/`; founder
instruction was "transcribe and ingest".

- **Transcription:** fal.ai Whisper (`fal-ai/whisper`) with the existing
  `FAL_API_KEY`; audio re-encoded m4a to mp3 first (fal rejects mp4 data
  URLs). The audio itself stays out of the repo.
- **Canonical transcript:**
  `docs/homa-planning/journeys/evidence/raw/2026-07-07-tester-voice-memos.md`,
  verbatim per memo, with an index mapping each product ask to its surface
  and ticket (MJ-06 thinking state, M1-02 chat history, M2-05 worksheet art,
  M2-03 tutorial, M3-11 efficacy loop, create_worksheet closing-line swap
  plus watermark per D7 attribution).
- **Marketing extraction:** 7 new signals in `marketing/signals/`
  (reader-story series, testimonial anatomy, chapters, trial release
  program, socials cross-post loop, "assists never runs" voice insight, the
  efficacy loop in her words), all `status: new`, sourced to the transcript
  with line locators. No duplicates against the existing reservoir.
- **Copy flag surfaced, not changed:** "It ran our homeschool first."
  (`apps/web/components/marketing/Stories.tsx` L28) reads to her as Homa in
  control "instead of Homa is assisting". Founder call on any rewording.

Decided alone (auditable): the evidence folder (journeys/09 §5.1) did not
exist yet since M0-07 is pending, so only `raw/` plus this one file were
created, not the full scaffold. Kids' names were redacted to roles in the
transcript per the family-data law; "Alyssa" kept as transcribed with a note
that it is most likely Alessa. Formal §5.2 assumption coding deferred to
M0-07.

## 2026-07-07 (night) · Family workspace, Phase A: report data moves to product tables (founder rulings, this session)

Two founder decisions this session, both about turning the single long
tokenized report into a managed family workspace:

1. "Migrate reports/scores into product tables so the workspace owns them
   natively." Report data had lived only in the lead tables (deny-all,
   reached by a token). It now also lives in family-scoped product tables
   the signed-in parent reads under RLS.
2. "No more invite-only." This extends the 2026-07-07 homepage InviteBand
   removal to the whole product (report CTA, FAQ, terms, privacy, hub
   pending states, emails). Only the schema/data groundwork ships in this
   entry; the invite-only copy sweep is Phase C, still pending.

Shipped in Phase A (migration + write path), applied live to homa-prod:

- **Migration #23 `20260707190000_child_reports.sql`:** `child_reports`,
  `child_answers`, `child_plans`, mirroring the lead_* shapes minus the
  funnel/sharing columns (token, viewed_at, emailed_at, revoked_at). RLS
  on all three, four policies each, scoped through a new
  `is_child_family_member(cid)` security-definer helper (child to family
  membership without RLS recursion, same shape as `is_family_member`). A
  one-time backfill copied every already-linked kid across via
  `lead_children.child_id` (4 reports, 145 answers, 1 plan on prod).
- **Advisor hygiene:** the new helper was anon-executable via the default
  PUBLIC EXECUTE grant; patched to mirror migration #3 (revoke PUBLIC +
  anon, grant authenticated). Security advisors then clean except the
  pre-existing accepted set.
- **`report-mirror.ts` + score-route hook:** every score now mirrors the
  report into the product tables under the parent's session (no service
  role), once in the foreground (scores + answers immediately) and once
  after the background narrative pass (the words reach parity). Reads via
  the server-only mapDb, writes via the caller's RLS client.
- **`scripts/isolation-check.mjs`** extended: anon can neither read nor
  forge the three new tables. `pnpm check:isolation` and `check:events`
  green; typecheck green. (`check:map` has 3 pre-existing failures from
  in-flight narrative-fixture work, unrelated to this change.)

Decided alone (auditable): mirror shape mirrors lead_* verbatim so the
scorer/renderer are reused; member-write RLS policies (a parent can write
their own child's rows, consistent with children/family_memories) accept
that a parent could in principle rewrite their own scores, this is not a
cross-tenant issue and matches the existing pattern. NOT yet done: the
authed read module + the workspace UI (Phase B, built together against
the real render needs), and the invite-only copy sweep (Phase C).

## 2026-07-07 (night) · Ribbon ticker bug: words vanishing mid-loop, fixed (founder screenshot: "this squiggle is missing words")

Root cause: the ticker's `<textPath>` (added earlier tonight) rode the
ribbon's own visible curve, only ~1570 user-units long. Animating
`startOffset` toward negative pushed early characters below arc-length 0
(invalid, no such point on the path); animating toward positive ate into
the path's remaining length faster than the repeating phrase needed,
running out of valid arc-length before the visible band's right edge.
Both are silent SVG behavior, no console error, so it only ever showed up
as characters/words missing from the rendered band, worse at certain
points in each ~11-13s loop.

Fix in `dividers.tsx`: the colored visible band keeps the original short
curve unchanged (pixel-identical); a second, invisible path with the same
curve extended by 3000 user-units of straight line at each end is now the
`textPath` target, so every offset the loop ever reaches stays inside
`[0, pathLength]`. Base `startOffset` moved from 0 to 3000 (the extension
length) so the un-animated/reduced-motion rest state still lands text at
the exact original visual position. Verified live: extended path length
now ~7569 per ribbon, all three ribbons' animated ranges fall inside it,
and screenshots across full loop cycles (0s, 5s, 10s, 12s+) show complete
text at every sample, all three ribbons. `pnpm --filter web
typecheck/lint/build` green.

Founder: "We're no longer doing this invite-only thing... we just remove
this part," pointing at InviteBand (`We're letting families in a few at a
time`), and asked for a scroll-triggered popup pointing at the
questionnaire instead. Scope taken literally: this homepage section only,
not the site-wide "invite-only" / "invite list" copy in the FAQ, terms,
privacy, hub pending states, or report views (those still say invite-only
and are UNCHANGED, pending a separate founder call like the 2026-07-06
"founding families" sweep).

Shipped:

1. `InviteBand.tsx` deleted, `app/page.tsx` no longer renders it. Footer's
   "Joining Homa" link (`/#pricing`, InviteBand's old anchor id) repointed
   to `/onboarding` so it doesn't now scroll to nowhere.
2. New `ScrollCta.tsx`: a small dismissible card (bottom-right on desktop,
   full-width bottom bar under 640px) that appears once a reader has
   scrolled past the Features section and hides again whenever CtaBand's
   closing CTA is on screen (reactive both ways, via a `data-final-cta`
   attribute the two components share with no prop link), routing to
   `/onboarding` like every other CTA on the page. Dismissal persists
   30 days via localStorage (read through `useSyncExternalStore`, the
   plan-weeks.tsx pattern, hydration-safe and avoids the
   `react-hooks/set-state-in-effect` cascade lint). Respects
   `prefers-reduced-motion` (no slide animation) and Escape-to-dismiss.
3. Trigger is a rAF-throttled scroll-position check, not
   IntersectionObserver: a threshold-crossing observer never fires for a
   scroll that jumps clean over the "past the sentinel" frame (fast
   flick, Page Down, back/forward-cache restore), which was caught live
   in Playwright verification (instant `scrollTo` never flipped
   `visible`) before it could ship as a silent dead feature.
4. `pnpm --filter web typecheck/lint/build` all green; homepage (`/`)
   still statically prerendered.

## 2026-07-07 (midday) · Phone-to-family link: SMS sessions get family context

Founder rulings (chat): one phone number per family for cohort one;
capture it as an optional signup field AND on /home; trust the
signed-in parent's typed number WITHOUT text-back code verification
(explicit founder choice over the agent's verify-first recommendation).

Shipped (deployed to production):

1. **Migration #22 `family_phones`** (applied to homa-prod): one row per
   family (unique family_id, droppable later for multi-number), number
   unique across ALL families (+1E164 check), deny-all RLS + revoked
   privileges, lead_families gains nullable phone_e164. Isolation check
   gains both probes (anon read empty, anon insert denied), green.
2. **Capture**: optional cell field on the onboarding SignupStep (schema
   `phone`, server normalizes via new @homa/core normalizeUsPhoneE164
   and silently skips unparseable values so the optional field can never
   block signup); lead bridge copies the number into family_phones at
   workspace creation (never overwriting a /home-set number); /home
   gains a "Text with Homa" card (set/change/clear) that renders only
   when the deployment's texting line is on.
3. **Routing**: the Telnyx channel resolves the sender through
   family_phones and stamps familyId into the session auth attributes;
   family-context now has a second load path for SMS sessions (server
   reads pinned to the channel-authenticated familyId, since no Supabase
   token exists on SMS); sms-mode instruction speaks linked vs unlinked;
   sms.message_received.linked_family is now real; new registry event
   sms.family_linked {family_id, source, replaced}.
4. **Typo safety net** for the skipped verification: whoever owns a
   freshly linked number gets one "it's Homa, reply STOP if this wasn't
   you" text (best-effort, Telnyx enforces STOP platform-wide).

Decisions made alone (auditable):

- **Verification skipped is bounded, not ignored**: the founder accepted
  the wrong-number risk; the agent bounded it with the notification SMS
  + STOP, the cross-family uniqueness constraint (a number can never
  route to two families), and fail-closed lookup errors (an inbound text
  becomes an unlinked session rather than being dropped or mis-routed).
- **SMS context reads are family-pinned server queries** (same server
  connection as the lead tables), NOT a service-role client and NOT
  RLS-bypassing convenience anywhere else: the familyId is stamped by
  the channel from the parent-written mapping (auth context, law #1's
  letter on "from auth context only" holds; its RLS-role clause is
  satisfied at M1-02, and until then this is the same posture bridge.ts
  already established). Token-backed tools still refuse over SMS.
- **Tools over SMS stay off** until M1-02 SET LOCAL lands; the sms-mode
  instruction turns worksheet asks into web-visit offers.
- The 10DLC campaign attach is now a self-removing cron job (chat-session
  watchers kept getting reaped); it attaches the number the moment the
  registry finishes provisioning and texts the founder the go-live
  confirmation.

Follow-ups: M1-02 SET LOCAL role (unlocks SMS tools properly); an
in-chat "want to text me?" offer (deferred, needs a tool or UI hook);
multi-number-per-family (drop the unique(family_id) constraint when a
second parent's phone matters); phone field on the standalone /signin
signup form (map flow covers the real funnel today).

**Evening addendum (founder: "voice agent is dumb and sounds like a
robot, give her the family's account"):** the hosted voice assistant was
upgraded in place (assistant-0f2cfd3a):

- Model moonshotai/Kimi-K2.6 → anthropic/claude-haiku-4-5 (Telnyx-native,
  no external key).
- Voice default → Telnyx Ultra "Callie, Encourager" (natural US English)
  + Krisp noise suppression. Greeting switched to the model-generated
  special value so known callers are greeted by name.
- **Family context on calls**: new deny-all-posture webhook
  POST /api/voice/context (auth: long random key in the URL query,
  TELNYX_WEBHOOK_SECRET in .env.local + Vercel prod; the keyed URL lives
  only in the Telnyx assistant config). At call start Telnyx sends the
  caller number; the route resolves it through family_phones (same
  lookup as SMS) and returns {caller_known, parent_name, family_context}
  as dynamic variables templated into the instructions. Unknown callers
  and any error fail open to the general-companion experience.
- Context loading/rendering extracted to lib/family-context.ts, now
  shared by the agent's family-context instruction (web + SMS paths) and
  the voice webhook, so all three surfaces render one identical block.
- scripts/telnyx-provision.mts creation payload updated to match, so a
  from-scratch re-run reproduces the live assistant.
- Verified live: webhook 401s without the key, returns empty vars for
  unknown numbers; instructions/voice/model confirmed on the assistant
  via GET. Note: trial-tier disclaimer and 10-min cap should be gone now
  that the account is Verified (founder completed KYC 2026-07-07
  morning); confirm audibly on the next call.

## 2026-07-07 (night) · ONE WORLD: the lead world, bridge, and mirror retire (founder: "architect the db and onboarding as scalable and simple as possible BEFORE we launch")

Founder ruling, overriding the agent's own wait-until-after-conference
recommendation with the stronger argument: we have zero real users today
(one friend family), so pre-launch is the cheapest this migration will
ever be, and every day after launch adds compatibility constraints.
Executed the same night.

The shape: a `families` row is the account container from the FIRST tap.
Migration #24 folds the funnel columns into families (email, names,
phone, source, utm, status, resume/link token hashes, reminder stamp,
context, updated_at), the checklist columns into children (context,
pending_band, band_ready stamp), and the share token + email/view/revoke
stamps into child_reports. Onboarding writes children / child_answers /
child_reports / child_plans directly; signup is an identity upgrade (one
family_members insert inside attachAuthUser, which also folds
same-email/same-user families together and seeds what_works memories).
DELETED OUTRIGHT: lib/map/bridge.ts, lib/map/report-mirror.ts, the
map.family_bridged/skipped events, and every lead_* read and write in
the app. requireLead became requireFamily with a second door: a signed-in
Supabase session resolves the family via membership when the cookie is
absent. All map.* event props renamed lead_id to family_id.

Deliberate postures, unchanged: pre-signup families are RLS-invisible
(memberless) and reachable only through the server module by cookie-token
hash, so the deny-all posture survives the unification; report tokens
stay unhashed shareable artifacts (D7) and now live where the report
lives; anonymous sign-ins stay DISABLED in Supabase auth (probed 422):
the cookie IS the pre-signup identity, no auth.users row until signup,
which keeps bounce abuse away from auth entirely.

Verified: typecheck, lint, build, check:map, check:events,
check:isolation (probes rewritten: lead_* probes retired, child_* read +
insert-forge probes in), plus a full scripted e2e against homa-prod
through the running app: start, add kid, 5 real answers, extras with
whats-working + curriculums, claim, password signup, score (token
returned), state (hasAccount true, token matches), report correction,
consent tap (plan built + retest armed), progress sync, report page
serving the writing beat, plan page serving its beat. Test family
deleted scoped by ids, residue zero.

Migration-window note, proving the founder's timing argument: Alessa
re-onboarded on the OLD prod code while this was being built; her new
lead rows were backfilled into her family (funnel columns + report
token) by re-running the #24 backfill before the deploy. The lead_*
tables drop in a follow-up migration only after the new code is READY in
prod and a final backfill sweep of the gap window comes back empty.

## 2026-07-07 (morning) · The 100x report build: living record, memory, months, proof (founder: "Do all this. BOIL THE OCEAN.")

Executed the six directions of docs/ideation/2026-07-07-report-100x-value-ideation.html
in one pass, on the founder instruction to think one level of abstraction
above and reason hard about how data is generated, saved, stored, and used
so it stays easy to use and never rots. The architecture that came out of
that instruction, now written into the code:

- **Four data classes, four freshness rules.** (1) Versioned static
  content (bank, prompt, templates): stale only by deploy, guarded by
  version stamps and CI locks. (2) Slowly-changing reference data
  (state_requirements): joined at RENDER time, never copied into a report
  row, so a statute change can never strand a stale claim on a permanent
  URL. (3) Source-of-truth family data (answers with new provenance,
  birth dates, interests, whatsWorking, curriculums, plan check-offs now
  server-side): the only data a parent edits, and every new surface
  writes here and only here. (4) Derived artifacts (scores, narrative,
  plans): never edited, only re-derived through the one existing pipe
  (createReport archives words next to numbers, resets, regenerates).
- **Staleness is derived, never stored.** packages/core/src/map/staleness.ts
  is a pure function of birth date + generation time + the bank; the
  report page computes it on every visit. No cron, no stored flag that
  could itself rot.

Shipped (all typecheck/lint/build/check:map/check:events/check:isolation
green; narrative pieces ride the existing REPORT_NARRATIVE_ENABLED flag):

1. **The living record.** Migration #22 (lead_answers.source provenance,
   lead_plans.progress). Tap-to-correct receipts (receipts-list.tsx, one
   batched save = one rescore + one rewrite via POST /api/map/report/correct),
   the sharpness meter (per-subject "well observed" vs "one clear look",
   with the deep-dive probe question inline, one tap), and the
   self-renewing report (staleness banner offering the ?start= re-check).
   All writes session-gated like whats-working; shared links stay
   read-only. New events: map.answers_corrected.
2. **Homa the correspondent.** The writer now receives lastLetter (the
   archived note + synthesis out of history) and writes chapter N, plus a
   new gated `keepsake` piece: a dated letter addressed to the child, no
   numbers, rendered as a memory-box card. Prompt v2026.07.3; both
   fixtures regenerated through the live pipeline, gate clean.
3. **The month, default-on with consent.** The fold-it-into-the-plans
   promise is now kept: PlanFacts carries whatsWorking (all subjects, for
   strength-to-struggle transfer), curriculums, and helpWith. Check-offs
   sync server-side (debounced, localStorage kept as the offline copy;
   server ∪ local, true wins), render as a positive-only "your month"
   line on the report, and feed the writer as code-computed practice
   lines. The consent card offers the clearest growing subject's month in
   one tap: the tap IS the explicit ask, so the retest email arms without
   touching the email doctrine. New events: map.plan_consented,
   map.plan_progress.
4. **The growth story.** The 12-snapshot archive is finally read: a
   chapters timeline (oldest first, era note excerpts as period voice,
   pairwise positive-only movement) plus rising-only sparklines (a curve
   may never draw a dip; drops stay in the quiet re-check lane, per the
   anti-guilt law).
5. **The proof stack.** The state card renders the seeded
   state_requirements summary at render time (reassure-first copy, the
   last-verified date, the this-satisfies-nothing boundary, never legal
   advice), replacing the one-line teaser. Two deterministic audience
   editions shipped as print-first token routes: /evidence (composite
   framing, dated growth lines, full receipts with standards codes and
   citations) and /one-pager (strengths, chart, counts; D6 respected: no
   helpWith, no whats-working, no private letter on either). Linked from
   the report's action row.
6. **Bands and paths.** MapItem.typicalRangeMonths ships the band
   mechanism with the three corpus-documented ranges (counts-to-100 per
   CCSS vs trajectories, stranger-clear per Hustad, rides-bike per AAP);
   receipts render a window band where a range exists, the dot elsewhere,
   with a new check:map consistency rule (range must contain its anchor).
   Each drawer draws the ladder as a lit path (confirmed, emerging, one
   "next up" rung, never a locked state) via core ladderRungs().

Decisions made alone (auditable):

- Corrections are BATCHED (up to 24 changes per save) because every save
  triggers a full rescore + uncapped rewrite behind the writing beat;
  per-tap regeneration would hold the page hostage repeatedly.
- The keepsake rejects alone, never fails the whole generation (it has no
  template equivalent; the report stands without it).
- Sparklines render only monotonically rising series with net growth.
  Honest display of a dip would violate the positive-only movement law,
  so dips simply do not get a curve.
- Bands shipped with exactly three items because only three ranges are
  airtight in 00-synthesis today; the mechanism is general and more
  ranges port with the corpus open (never invented ranges).
- The evidence pack and one-pager are deterministic v1 (no model call):
  for a third-party evidence document, determinism is a feature, and the
  existing report narrative is addressed to the parent so reusing it
  would misfire. Model-written audience cover letters can layer on the
  proven generate-gate-store pattern later.
- The re-check CTA reuses the existing ?start= resume flow (which serves
  the current-age frontier questions) instead of building a bespoke diff
  UI; the answered questions stay answered, so it IS the diff.
- whats-working placeholder copy fixed in passing ("what's driving",
  banned-word law; "behind" had shipped in a placeholder).

Deferred, with reasons (not silently):

- Photo receipts / work-sample uploads: minors' media behind unhashed
  share tokens needs its own access-control design first (D4 consent
  floor gates photo upload until DPAs exist; the ideation doc flags the
  same). Needs a founder decision on private-by-default artifacts vs D7.
- The observation inbox (reply-to-email ingestion): inbound email parsing
  is provider infrastructure that does not exist yet; the footer's
  "reply and a real person answers" stays a human promise.
- The overnight "second read" letter and any annual growth edition email:
  both collide with "no sequences exist by design" and need an explicit
  founder overturn, per the ideation doc's own flag.

STOP for the founder (same gate as the narrative layer): fixtures were
regenerated at prompt v2026.07.3 and include the new keepsake pieces; read
both aloud (scripts/map-narrative-fixtures.mts already printed them; the
red-team keepsake for Riley is the wince test) before flipping
REPORT_NARRATIVE_ENABLED. Everything deterministic in this build (bands,
paths, state card, editions, corrections, check-off sync, staleness
banner, growth story) goes live on deploy with no flag.

## 2026-07-07 (small hours) · Voice + text via Telnyx: M5-01 groundwork pulled forward

Founder rulings (chat, 2026-07-07): set up voice and text on Telnyx now;
SMS/MMS routes into the eve agent behind a flag; voice is a hosted Telnyx
AI assistant on the same number as a call-Homa experiment; carrier
registration goes the Sole Proprietor 10DLC path (personal identity + SMS
OTP, no LLC), superseding M5-01's "Entity/EIN first" assumption and the
HUMAN-TODO Twilio line. The PRD's cohort-one non-goal (NO SMS) stands:
everything ships dark behind TELNYX_SMS_ENABLED.

Shipped:

1. **SMS channel** (`apps/web/agent/channels/telnyx.ts`): eve
   `chatSdkChannel` + the vendor-official `@telnyx/chat-sdk-adapter`
   (Ed25519 webhook verification built in), mounted at
   `/eve/v1/chat/telnyx` (proxy matcher already skips `/eve`). One
   durable eve session per phone-number pair. Inbound MMS images ride
   along as image parts. Dark unless TELNYX_SMS_ENABLED="true" AND
   api key + from-number + public key are all present; the public-key
   requirement means unverifiable webhooks are never processed.
2. **SMS-mode instruction** (`agent/instructions/sms-mode.ts`): dynamic,
   Telnyx-channel sessions only; short replies, no markdown, point
   family-workspace asks to the web app.
3. **Event** `sms.message_received` (registry + server-side insert via
   the existing map-events path; no phone numbers or content in props).
4. **Provisioning** (`pnpm telnyx:provision`, scripts/telnyx-provision.mts
   + telnyx-shared.mts): idempotent walk (balance gate → number →
   messaging profile + webhook → sole-prop brand → OTP → campaign →
   number assignment → voice assistant), stops cleanly at the two human
   gates (funding, OTP PIN). Executed tonight up to the account-level
   wall:    messaging profile 40019f3a… created and bound to +13467588011;
   voice assistant assistant-0f2cfd3a… created (instructions ported from
   agent/instructions.md voice section + phone-call rules) and the
   number's calls route to it. 10DLC blocked at trial account level
   (HTTP 403 code 10038) pending funding, script says so instead of
   crashing. **Correction (morning, founder repro "busy beep"):** the
   voice line is wired correctly (number → TeXML app → assistant, all
   active, verified via API) but Telnyx TRIAL accounts only connect
   inbound/outbound calls with the account's ONE verified number, and
   zero numbers were verified, so every caller got busy. Per
   docs/account-setup/levels-and-capabilities/trial: trial = 1 verified
   number, 10-min call cap, disclaimer prepended to TTS, outbound SMS
   only to the verified number, and 10DLC needs the "Verified" level
   (KYC), which plain "Paid" does not include. HUMAN-TODO updated: the
   2-minute unblock is verifying the founder's cell in the portal; the
   real fix is the account-level upgrade.
5. **Env plumbing**: TELNYX_* in .env.example + .env.local;
   TELNYX_FROM_NUMBER / TELNYX_MESSAGING_PROFILE_ID / TELNYX_PUBLIC_KEY
   mirrored to Vercel production. TELNYX_SMS_ENABLED deliberately NOT
   set in prod (dark until founder flips it post-10DLC). HUMAN-TODO
   gained the funding/OTP/flip checklist.

Decisions made alone (auditable):

- **SMS senders are unlinked principals** (`authenticator: "telnyx-sms"`,
  principal = phone number, NO familyId, NO supabaseAccessToken). Law #1
  says familyId comes from auth context only, and SMS has no Supabase
  auth context; any phone-to-family mapping shortcut would bypass the
  RLS story. Family tools already refuse gracefully without context, so
  texting works as a general companion. Linking a phone to a family is
  its own future design (needs the M1-02 SET LOCAL pattern or a signed
  link flow), not tonight's hack.
- **chat-sdk channel over eve's twilio channel**: Telnyx is not Twilio;
  the Chat SDK adapter is Telnyx-official and eve ships the bridge.
  npm `chat` (4.32.0) is installed alongside eve's vendored copy; the
  vendored orchestrator has no instanceof checks against it, and
  typecheck passes. chat's `ai@^6` peer warning against our ai@7 is
  accepted (we never use its ai-message conversion path).
- **Memory state adapter** for the Chat SDK (dedupe/locks only); eve owns
  the durable session keyed by thread id, so serverless cold starts
  cannot lose conversation state.
- **Messaging profile whitelists US only**; cohort one is US, an
  international outbound text is a bug by definition.
- **Voice assistant gets telephony only** (no messaging feature): the eve
  channel owns SMS, the assistant owns calls; same number, no overlap.
  Known tradeoff, accepted for the experiment: the voice line is a
  second brain (Telnyx-hosted, no family data, no tools); its
  instructions carry the same voice rules and it says so when asked
  about family specifics.
- **sms.message_received inserts server-side** through the existing
  map-events connection: the public events RLS policy stays
  waitlist-only on purpose.

Follow-ups this creates: phone-to-family linking design; action_costs
row for SMS once it carries billable traffic (law #3's billable clause);
outbound/proactive SMS (needs opt-in UX per the campaign's stated flow);
10-digit long code throughput is sole-prop-tier (fine for cohort one,
revisit at scale); revisit the voice assistant fork (import into eve or
retire) after the experiment.

**Addendum (morning, founder "how do we get texts to work"):** founder's
cell verified (+1 954 990 3497, via API, the trial account's one
verified number), after which the voice call connected end to end
(founder confirmed). SMS channel then shipped live: TELNYX_SMS_ENABLED
set in Vercel prod and production deployed via `vercel deploy --prod`
from the working tree (the project's established deploy path; the
selective git commit is pending because packages/core/src/events.ts is
shared with other uncommitted overnight work whose emitters are
untracked, and committing the file wholesale would fail check:events).
Webhook verified live: unsigned POST to /eve/v1/chat/telnyx returns 401.
Outbound test message (API → founder's verified cell) was accepted by
Telnyx but **carrier-blocked with error 40010 "Not 10DLC registered"**:
the trial tier's "outbound to verified number" allowance is
Telnyx-side only; US carriers require 10DLC registration regardless of
destination. So texting waits solely on the human chain in HUMAN-TODO:
account upgrade (Verified/KYC) → TELNYX_SP_* → pnpm telnyx:provision →
OTP. Zero code or deploy steps remain.

## 2026-07-07 (small hours) · apps/mobile: Expo companion app, first cut

Founder instruction ("START A MOBILE BUILD WITH EXPO. BOIL THE OCEAN")
overrode the default sequencing (D0 remains the only real deadline; no
D0 work was displaced, this landed as a parallel lane). Shipped: a new
`apps/mobile` workspace app (Expo SDK 56, expo-router, TypeScript
strict) that is a pure client on the existing backend: Supabase
email/password auth with AsyncStorage sessions, RLS-scoped family +
children reads/writes (`create_my_family` RPC, children insert), and
the real eve chat: `useEveAgent` from `eve/react` pointed at
`EXPO_PUBLIC_API_URL` with a per-request Supabase bearer, exactly the
web channel's auth contract (`agent/channels/eve.ts` needed zero
changes). Transcript + session cursor persist per user in AsyncStorage
(the web chat's localStorage pattern; M1-02 replaces both). Screens:
sign in, Today, Chat (streaming, worksheet cards, memory chips, busy
labels), Family. Brand: tokens + Logo hand-copied per the AGENTS.md
sync rule, icons/splash generated from the house mark into
`assets/brand/*.svg` + PNGs. Verified: workspace `pnpm typecheck` and
mobile `eslint .` green, `expo export` (Metro iOS bundle) builds clean.

Decisions made alone (auditable):
- **eve/react used directly, not a hand-written client.** Verified
  eve 0.19.0's client layer has no DOM globals and rides plain fetch +
  ReadableStream; the one gap (React Native's fetch cannot stream) is
  closed by installing `expo/fetch` as the global fetch at startup
  (`src/lib/streaming-fetch.ts`, eve exposes no per-client fetch
  injection). Law 8 note: the web chat also uses `useEveAgent`
  directly today; when M1-14 wraps the frontend hook behind the
  harness, both surfaces adopt it together.
- **SDK 56 over week-old SDK 57**: current default template, settled
  ecosystem, Expo Go for 57 still in store review; the upgrade path is
  one `expo install --fix` away.
- **Email/password only for now**; Google OAuth needs a Supabase
  redirect-URL registration (HUMAN-TODO) and expo-auth-session wiring.
- **Onboarding/map flow deliberately not mirrored**: its auth is an
  httpOnly resume cookie, web-only by design; mobile assumes a
  signed-in family.
- **No `build`/`dev` scripts in apps/mobile on purpose**: CI runs its
  lint + typecheck via turbo, native builds belong to EAS later, and
  `pnpm dev` should not try to boot a simulator.
- **Payments stay on the web** (App Store IAP rules); nothing billing
  related ships in the app.

## 2026-07-07 (small hours) · M3-05 data layer pulled forward: state_requirements seeded

Founder: "build it so we can pull all the data and save it to build on
top of" (the HomeschoolLeap API identified in 07-deep-research-notes §3).
Shipped:

1. **Snapshot layer** (`data/state-requirements/`): all 51 jurisdictions
   pulled verbatim from HomeschoolLeap's free public API (CC BY-SA 4.0,
   attribution required) via `pnpm pull:state-requirements`. Deterministic
   sorted-key JSON so re-pulls diff cleanly; script validates count and
   shape before writing anything.
2. **Migration #21** (`state_requirements`, applied to homa-prod,
   version 20260707032148): one row per jurisdiction; typed summary
   columns (regulation_level, notification/assessment flags, compulsory
   ages, default pathway, HomeschoolLeap's per-state last-verified date)
   plus the full upstream document as `payload` jsonb (payload wins if
   they disagree). RLS: members READ, deliberately NO write policies
   (skill_bank / M3-04 reasoning: legal claims are fleet-wide blast
   radius; no Data API role or compromised model turn can alter one).
3. **Seed** (`pnpm seed:state-requirements`): direct pooler connection
   (the only write path), upserts snapshots, fails unless the table ends
   at exactly 51 rows. `pulled_at` always advances; `updated_at` moves
   only on real content change so it stays an honest "this rule last
   changed" signal. Verified idempotent (second run: 51 unchanged, zero
   updated_at movement).
4. **Guards + docs**: isolation check gains state_requirements probes
   (anon reads nothing, anon insert 403), green on homa-prod; refresh
   procedure + J-H correction steps in
   runbooks/state-requirements-refresh.md; README repo map + supabase
   README + backlog M3-05 row updated. Security advisors: no new
   findings after the migration.

Decisions made alone (auditable):
- **Snapshots in git as the review gate** before any seed (quarantine
  reasoning ported from M3-04): a re-pull must land as a reviewable diff
  and git history must preserve every version we ever served, for J-H
  blast-radius work. Straight API-to-table was rejected.
- **Read posture starts authenticated-only** (mirrors skill_bank).
  Public SEO state pages (journeys/02 §1) render server-side, so no anon
  policy is needed yet; widening to anon is a deliberate later decision
  when that surface lands.
- **Kept upstream text verbatim** in snapshots and payload (including
  upstream punctuation): archival fidelity beats house style inside
  quoted data; everything Homa-authored around it follows repo style.
- Table lives at the STATE grain with pathways inside payload; a
  per-pathway relational split waits until the hours engine (M3-05
  remainder) proves it needs one.

## 2026-07-07 (small hours) · Cleanup audit executed: every non-destructive fix applied

Executed docs/homa-planning/plans/2026-07-06-codebase-cleanup-audit.md on
founder instruction ("fix everything that is non destructive"). Code: em
dashes out of page metadata + llms-full.txt, Nav "Sign up" casing, terms
"waitlist" wording, FAQ single-sourced into faq-items.ts (page JSON-LD +
Faq component), forget_skill documented in agent instructions,
plansNeedingRetest gains the missing email-null guard, .env.example gains
RESEND_API_KEY/CRON_SECRET/SUPABASE_DB_PASSWORD/NEXT_PUBLIC_SITE_URL.
Guardrails: scripts/events-check.mts (MJ-08 registry parity, both
directions) wired as check:events; skills-targeting-check wired as
check:skills-targeting; both + lint added to CI; CI node 22 to 24 (matches
apps/web engines and local). Docs: PRD non-goal/FR-1/pricing supersession
patches, BUILD.md signup gate + D0 remaining list + CI text, supabase
README count, HUMAN-TODO Stripe ticks + /onboarding URL, 18 planning docs
got pricing-v1 supersession notes, lead-magnet HTML specs got D8-overturn
banners, benchmarks docs moved 15 to 16 domains, Florida percentile claim
resolved against lane 16, root docs swept of em dashes.

Judgment calls made alone, flagged for review:
1. Deleted apps/web/public/videos/homa-brand-film.mp4 (16 MB in every
   deploy, zero references since the founder removed the hero film) and
   the byte-identical uploads/hf_20260705_*.mp4 duplicate; canonical copy
   stays at docs/homa-design/assets/videos/homa-brand-film.mp4.
2. Removed the fictional `pnpm test` (turbo no-op, no workspace defines
   test); AGENTS.md now lists the four check:* guards as the test suite.
3. Did NOT touch: applied migration files (comment fixes skipped on
   purpose, applied migrations stay byte-stable), @homa/core unused barrel
   exports (API-surface call, needs an owner), privacy/method page wording
   (owed inside the LLM-report PR per the D8-overturn ruling), MapFlow
   internal naming (deliberate), marketing signal top-up (content task).
4. One audit claim inverted on inspection: packages/core/src/map/schemas.ts
   comments were already correct (email at S1, name at signup) and were
   left alone; the claim route comment really was stale (said name-at-S1)
   and was fixed to the email-at-S1 order.

## 2026-07-07 (small hours) · Family workspace bridge SHIPPED (D3 re-decision built)

Implementation of plans/2026-07-06-family-workspace-at-report-implementation-prompt.md,
uncommitted, awaiting founder review of the e2e screenshots. Every score now
runs `ensureFamilyWorkspace` (apps/web/lib/map/bridge.ts) after createReport:
family via the create_my_family RPC, children mirrored from lead kids with
REAL birth dates, profiles mirror forward on rescore, all writes as the
signed-in caller under RLS, no service role. Migration 20260707021827 adds
`lead_children.child_id` (nullable FK, on delete set null). New registry
events: map.family_bridged, map.family_bridge_skipped. Verified: typecheck,
forced build, check:map, check:isolation (extended with a lead_children
insert-forge probe covering child_id) all green; live e2e on homa-prod
through the real UI (fresh email, 2 kids incl. one pending-band, checklist,
extras, password signup, report, /home, /chat context reply naming both
kids, whats-working + rescore, later sibling into the SAME family); test
rows then deleted scoped by lead id AND family id in both worlds, residue
check all zeros.

Decisions made alone (auditable):
- **Session-lead identity check added beyond the prompt**: requireLead also
  honors the emailed link token, so a report link opened in a browser
  signed into a DIFFERENT account would have mirrored kids into that other
  family. The bridge only runs when the session user IS the lead's linked
  auth user; anything else emits map.family_bridge_skipped
  {reason: "auth-user-mismatch"} and stands down. Self-healing: state-route
  linking fixes the lead, the next score bridges.
- **Race hardening, caught live in e2e run 1**: two parallel score calls
  (dev StrictMode double-effect; a double-tap or two devices in prod)
  both saw child_id null and duplicated the product children. The mirror
  phase now runs in one transaction holding `select ... for update` on the
  lead row, plus an orphan-adoption pass (a product child matching name +
  birth date that no lead kid links to is adopted, never twinned), so even
  an interrupted run cannot duplicate kids on retry. Run 1's rows were
  cleaned scoped by ids; run 2 (post-fix) was fully green.
- **map.family_bridged emits only when something changed** (family created,
  child created, or profile updated). A pure no-op rescore stays silent,
  per the 2026-07-06 lesson about flooding the funnel during analysis.
- **The prompt's "the product profile has no other writer for these fields
  today" is not quite true**: the chat agent's update_child_profile tool
  writes interests/focus. Founder-ruled last-write-wins mirror stands, but
  a rescore can clobber an agent-era interest with stale lead data; the
  extras step also REPLACES the lead's interests list per save (its own
  semantics), so the mirrored list is the newest sitting's list. Flagged
  as a known sharp edge for the M2-04 profile engine.
- **Stretch memory seed built, gated to first-time only**: one what_works
  row per child, seeded only while the child has NO what_works memories
  (agent consolidation is never fought, rescores never duplicate), content
  is the parent's own words behind the scanMemoryContent injection gate,
  source "onboarding". Notes arriving after a child's memory exists are
  NOT re-seeded; the narrative build feeds them into report facts anyway.
- **Isolation checker**: read probes already covered the new column via
  select=*; added an insert-forge probe (anon inserting a lead_children
  row with a child_id link) rather than extending reads.
- Advisors after the migration: no new findings (deny-all INFO lines and
  the documented create_my_family SECURITY DEFINER warn, unchanged).

## 2026-07-06 (night) · Multi-kid order is the parent's call: the next-kid choice ships

Founder: "it needs to be easier to add your second or third kids
questions", the parent chooses whether to answer the other kids before
generating, or generate kid 1's report and do kid 2 after, and the ask
must be "simple, easy to understand, under 10 words".

Shipped, all in the onboarding flow (no schema or query changes):

1. **The next-kid choice (`next-kid-step.tsx`, new phase).** After one
   kid's checklist + extras, if another in-range kid still has open
   questions, one screen asks: **"Leo's questions now, or Maya's report
   first?"** (7 words; plural form "...or the reports first?" once two or
   more are queued). Secondary sage button starts/continues the sibling's
   questionnaire (kids-step task-order precedent, detour above primary);
   clay primary goes to the report(s). Caption reuses the report handoff
   line ("Same questionnaire, tuned to Leo's age. About five minutes.")
   or, for a started sibling, the saved-answers count.
2. **One scoring beat, several reports.** `reportQueue` in map-flow
   tracks kids finished this sitting, in order; ScoringStep now takes
   `kids[]`, scores each sequentially (per-kid status lines, "Building
   the progress reports…"), and lands on the FIRST kid's report. Any kid
   finished in an earlier sitting but never scored is swept into the same
   beat. Signup heading names the landing kid, not the last-answered one.
3. **Report page: sibling-ready card.** After a multi-kid build, the
   landing report shows "Leo's report is ready too" linking to
   /onboarding (the session-scoped family page), deliberately NOT the
   sibling's token URL: report pages are shareable capability links, and
   embedding a sibling's token would let anyone holding one kid's link
   open the other kid's report.
4. **Honesty fixes the seams exposed:** extras' finish button says
   "Continue" (and its headline drops "while I build") whenever the
   choice or the account step comes next, not "See the report"; the hub
   gained a finished-kid card ("Every question is answered. The report is
   one tap away." → scoring) replacing a dead "Continue the
   questionnaire" that mounted an empty checklist; ?start= links for
   already-finished kids route to scoring instead of that same dead card.

Verified: typecheck, lint, build green; two Playwright e2es (answer-both
lane with plural ask + both reports in one beat + ready-too card, and
report-first lane with single-kid beat + handoff card + second sitting
pointing back at kid 1). Test leads and their bridged families/children/
auth users deleted by lead id afterward, per the standing lesson.

## 2026-07-06 (night) · D3 re-decided: family workspace provisions at first report (founder ruling)

Same session as the D8 overturn below. Founder, on learning that a lead's
auth account exists by report time but the product workspace does not:
"ok so we should probably fix that so once they generate a report they
create a family workspace." This completes the erosion of lead-magnet
decision D3 (option A, "lead records now, account claim at invite") that
open signup (2026-07-05) and password-before-report (2026-07-06) started:
accounts AND workspaces now exist during the flow. MJ-09's invite-time
bridge shrinks to legacy-lead reconciliation.

Shape (full spec:
plans/2026-07-06-family-workspace-at-report-implementation-prompt.md):
idempotent bridge at the score route, RLS-only writes as the signed-in
user (create_my_family RPC + children inserts, NO service-role key),
lead_children gains a child_id link column, profiles mirror forward on
rescore, bridge failure never blocks a report. Deliberately NOT included,
flagged for a separate founder call: exposing /chat or /home to
report-holding families (report CTA still says invite list; the FAQ's
invite-only line stands until ruled otherwise).

## 2026-07-06 (night) · D8 overturned: the LLM writes the report's words, code keeps the numbers (founder rulings)

Grilling session on the report-depth exploration prompt
(docs/homa-planning/plans/2026-07-06-llm-report-depth-exploration-prompt.md).
Full Q&A and options table: plans/2026-07-06-llm-report-depth-options.md.
Rulings, in the founder's words where they ruled:

1. D8 (lead-magnet index.html, "curated sentence banks, zero model calls")
   is OVERTURNED for report prose: "fuck privacy. customers care about
   results." The scorer, ages, badges, chart, movement math, and citations
   stay deterministic code, unchanged.
2. Scope: "LLM should write all of it," with facts "deterministic or at
   least tracked in the database over time." Read as the facts/voice split:
   code computes every number, the model writes every parent-facing word
   (top note, card lines, new whole-picture synthesis, drawer explainers,
   four-week plan prose), and every generation is stored on the report row
   versioned by bank version + prompt version + model, snapshotting into
   history on rescore. "Building homa into an 'agent' for the user that is
   personal to them": report generation shares the chat agent's voice
   source and model (gateway claude-sonnet-5).
3. Latency: report waits behind an honest writing beat, UNCAPPED. "I would
   rather the report and the deep dives and the 4 week ciricculums be
   FUCKING INCREADIBLE, then have it take less than 20 seconds." Templates
   render on hard failure only, never on slowness. Report email sends after
   generation completes so the emailed link opens a finished report.
4. Defaults accepted without veto: regenerate on every rescore; v1 email
   stays the two-line pointer; sample report narrative generated once, hand
   reviewed, committed as fixture (doubles with the struggling-kid fixture
   as the read-aloud bar for every prompt change); runtime gate ports the
   map-check laws plus a no-invented-numbers grounding check, rejected
   pieces fall back per piece.
5. Consequences owed in the same PR: privacy page subprocessor section and
   the "No AI provider receives your questionnaire answers" line rewritten
   (the page promises it "changes first"), method page determinism wording
   becomes "numbers by plain arithmetic, never AI; Homa writes the words,
   checked against safety rules." FAQ's "your child never talks to an AI"
   stays, still true.
6. Conference timing was asked and not explicitly ruled; standing default
   logged: build behind a server flag now, flip on when the founder
   read-aloud passes, before or after July 13 as quality decides.

Implementation prompt handed off:
plans/2026-07-06-llm-report-narrative-implementation-prompt.md.

## 2026-07-06 (night) · Pro renamed Homa Plus + Plus annual at $249/yr (founder: "same discount, don't call it pro")

Follow-up to the pricing entry below, both environments:

- "Homa Pro" product renamed "Homa Plus" (converges with the name the
  planning corpus always used, R4 conversion screen). "Homa+" stays a
  UI-surface wordmark treatment if design ever wants it; the Stripe
  product name and receipts say "Homa Plus".
- Monthly lookup key renamed homa_pro_monthly_49 to homa_plus_monthly_49.
- New annual price homa_plus_annual_249 + payment links. Judgment call on
  "same discount": base annual is 56.6% off ($99 vs $228); the exact same
  ratio on $49/mo is $255.32/yr, rounded to the clean sibling price $249
  (57.6% off). One API call to change if the founder wants a different
  number.
- Env vars renamed/extended: `..._PAYMENT_LINK_PLUS_MONTHLY_URL` +
  `..._PLUS_ANNUAL_URL` in `.env.local` and `.env.example` (nothing reads
  them yet).

## 2026-07-06 (late evening) · Pricing v1 set by founder: Homa $19/mo or $99/yr, Homa Pro $49/mo ("let's not overthink this")

Founder call, superseding the $29/$49 numbers from D2/C1 (structure decided
2026-07-03; numbers were always provisional under T2). Executed in BOTH
Stripe environments: new prices on the existing "Homa" product
(homa_monthly_19, homa_annual_99), new "Homa Pro" product + price
(homa_pro_monthly_49), three payment links per environment (recorded in
`apps/web/.env.local` as `..._PAYMENT_LINK_{MONTHLY,ANNUAL,PRO}_URL`), old
$29 price archived and its link deactivated in both environments.

Judgment calls + flags, made alone and noted for review:
1. Pro's "bells and whistles" were founder-delegated ("we'll make some
   stuff up"); chose ONLY claims that are true or hand-deliverable today,
   per C2/no-fiction law: "Everything in Homa, plus the best intelligence
   we can run, custom worksheets made for your kids, and priority support
   from a real person." Editable in the dashboard when the tier sharpens.
2. FLAG: $99/yr is Homeschool Fox's exact annual price (T3 says never
   compete on their price axis). Stated to founder in-session; his call.
3. FLAG: $99/yr is a 57% discount vs $19/mo (norm is 15 to 20%), and
   annual-at-first-conversion reverses R3's September/month-3 timing
   recommendation. Both accepted as founder prerogative, logged so the
   reversal is deliberate, not drift.
4. Site copy untouched: the FAQ's "pricing gets published before anyone
   pays a cent" promise still holds until the paywall placement decision.

## 2026-07-06 (late evening) · "Founding families" framing retired everywhere (founder ruling)

Founder: "remove all references to founding families. everywhere." Scrubbed
and replaced across product surfaces, active specs, and forward-looking
drafts; replacement vocabulary is plain: "invite list", "first families",
"invite-only", "first cohort".

- Web copy: report CTA band, plan-page band, hub pending line ("You're on
  the invite list"), FAQ, Community section, footer link (now "Joining
  Homa"), Stories promise line, terms, email footer, signin comment.
- `components/marketing/FoundingFamilies.tsx` renamed to `InviteBand.tsx`
  (eyebrow now "Joining Homa"); `app/page.tsx` updated.
- Active specs and drafts: BUILD.md hard-constraints row (now also records
  this ruling), journeys/02 waitlist copy guidance, journeys/09 preorder
  experiment language (E6, ladder rungs, open question 2: now
  "first-cohort"), map-announcement-draft, lead-magnet mocks.

Judgment calls on scope, flagged for review:
1. LEFT INTACT: historical build-log entries and the already-superseded
   migration #7 (applied migrations and audit history stay immutable; the
   invite-code store it seeded was dropped by migration #8).
2. LEFT INTACT: icp-research citations of competitors' founding-family
   rates (Homeschool Managed) and the dated A11 research verdicts; they
   are evidence about the market, not our copy. The pattern (early price
   lock) is not retired, only the phrase.
3. LEFT INTACT: "founding story" / "founding documents" usages (different
   sense of the word).

## 2026-07-06 (late evening) · Post-review polish rounds: kids copy arc, checklist consolidation, extras split, report drawer rebuilt twice

A string of founder read-throughs after the "do it all" overhaul, each
implemented and verified live the same evening:

1. **Kids step copy, four rounds.** "Nice to meet you, Sidney." + "Now,
   add your family." was ruled two disconnected beats ("I hate this");
   collapsed to one headline, finally "Let's add your kids(, Sidney)".
   The subtitle was cut entirely (its one job, "a nickname is fine",
   already lives in the field label), the label became "Your child's
   name (or nickname)" after the greeting-adjacency made a bare "Name or
   nickname" re-enterable as HER name, and the birthday reason moved to
   a muted parenthetical, reworded once more because "(for their exact
   age)" restated what a birthday is instead of why it's asked:
   "(so questions match their age)".
2. **"+ Add a sibling" fix.** After saving kid one, the primary CTA
   latched onto the first saved kid's name ("Start Story's
   questionnaire") right as she'd asked to add another, read as the flow
   forgetting her. The button now only ever names the kid being typed
   right now; empty form = generic label, two-plus kids = plural.
3. **Checklist consolidated to one meta row + card** ("still seems like
   a lot going on"): hint bar, domain intro, and ladder note now share
   the card's single kicker slot (also killing a whole-screen jump on
   the first answer), the 16-segment dots died (the rail is desktop
   progress, one hairline bar on mobile), the mobile report strip died,
   the question centers in the card's fixed height, the card took the
   screen's strongest elevation, undo renamed "undo last answer", and
   the exit label became "back to your family" (the header already says
   everything saves; the hub is also where "add another kid" lives,
   answering a real founder question). "1 answers saved" pluralization
   fixed on the hub.
4. **Extras split to one question per card** with an "extra 1 of 2"
   counter; saving moved to the end so skipping question two never
   discards question one. "Done. The report is next." became a
   hand-note celebration ("questionnaire done ✓") over one beat ("Two
   quick extras while I build Story's report"). Selected chips use the
   soft clay tint (solid clay stays reserved for the CTA), free text
   became a dashed "add your own..." pill.
5. **Report subject drawer, two passes.** First: "at age"/"growing"
   right-column labels removed (numberLabel in sentences.ts now speaks
   only when it adds beyond the badge), plan CTA clay only on growing
   subjects, the "Go deeper..." riddle became "Answer a few deeper
   questions", sources muted, answer pills flattened to text, "often
   solid by" replaced "typical by", mid-dot eyebrow, "hide ↑"
   affordance. Second ("make the national average vs the child
   legible"): each answer is now a soft block reading top-down
   (question, "You said: Easily", age strip), where the strip puts the
   national benchmark (grey dot, "most kids by 4y 6m") and the child
   (clay marker, "Maya · 4y 2m") on one shared hairline per drawer, so
   the comparison is read, not computed. Every drawer zone opens with a
   one-line plain-language explainer, per the data-viz guideline (dots
   on one baseline, stages not scores, no red, no "behind").
6. Housekeeping: deleted the dead `email-step.tsx` (orphaned since the
   auth restructure made ParentStep the email screen).

All verified with Playwright walkthroughs (desktop + narrow) against the
sample report and live flow; typecheck, lint, build, isolation, and
map-check green after every round; every test lead removed from
homa-prod afterward.

## 2026-07-06 (evening) · Stripe payment rails stood up (founder: "create the recurring product + payment link so we can test; paywall placement decided later")

Live Stripe activated as sole proprietor (founder canceled the Atlas LLC
application after the cost discussion; entity deferred per the existing
HUMAN-TODO ruling). Created via API in BOTH environments, per the cohort-one
mechanism in 08-billing-credits-design ("Payment Link $29/mo, usage watched
manually"):

- Product "Homa", $29/mo recurring (price lookup_key `homa_monthly_29`),
  statement descriptor THANKSHOMA.
  - Test (sandbox acct_1TqIhu…): prod_Uq01TGhJROfVQ5 /
    price_1TqK1oLyeN6YfdNkoCqM9HbM
  - Live (acct_1TqJCq…, charges_enabled: true): prod_Uq02Zo8DUidRnH /
    price_1TqK24GnIMAiH0MJcLf0aoyB
- Payment Links recorded in `apps/web/.env.local` + `.env.example` as
  `NEXT_PUBLIC_STRIPE_{TEST,LIVE}_PAYMENT_LINK_URL`. No product code reads
  them yet.
- Live keys mirrored to Vercel Production (Sensitive):
  `STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_RESTRICTED_KEY`,
  `NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY`. Local `.env.local` renamed the
  test pair to `STRIPE_TEST_*` so test/live can never be confused.

Judgment calls made alone, flagged for review:
1. Product description written honest-to-today ("A fresh progress report for
   every kid, every month."), NOT the Branch B plan copy (materials daily,
   weekly notes), because none of that exists yet and a live link can charge
   a real card. Editable in the dashboard when the offer is decided.
2. No trial on the link: trial shape is open founder question #2 in
   journeys/10-reconciliation §Open questions (300 credits vs 2-weekly-notes
   sizing), and T1's card-upfront ruling can be honored later by adding
   `trial_period_days` when the offer ships.
3. Paywall placement, price framing ($29 first-cohort membership vs
   report-only price), and fake-door vs real-charge remain UNDECIDED founder
   calls; the 07-04 ruling "no Stripe preorder ask at the conference" still
   stands.

## 2026-07-06 · Onboarding UX review implemented in full (founder: "do it all, boil the ocean")

A senior-designer review of the whole onboarding flow was delivered and the
founder approved implementing everything in one pass. Shipped, in priority
order, with the judgment calls noted:

1. **Two real defects fixed.** (a) The page shell centered steps with
   flexbox `justify-center`, which clips a too-tall step's heading up
   underneath the nav, unreachable by scrolling (seen live on the account
   step); auto margins center-when-room / top-align-when-not instead.
   (b) A returning parent whose email already had an account hit
   `signUp` failure with a "try again" that could never succeed; the
   signup route now returns `reason: "exists"` and the step offers
   "sign in and you'll come right back here" (`/signin?next=/onboarding`;
   the signin page + actions grew a validated `next` param). The
   sign-in return path works because `/api/map/state` links ANY live
   Supabase session to the lead, not just Google ones.
2. **Quiet chrome mid-flow.** The founder's earlier "use the nav bar and
   the footer" ruling stands on the page-like moments (entry, hub) via
   the new `OnboardingShell`, but during kids/questionnaire/extras/
   signup/scoring the marketing nav (whose Sign Up button navigates to
   /onboarding itself and dumped mid-questionnaire parents onto the hub)
   gives way to logo + "everything saves as you go" + the original
   two-link footer. Judgment call: this narrows, not reverses, the
   founder's nav ruling; flagging here in case it should be reversed.
3. **The live-assembling report rail.** The entry page's report-preview
   mock disappeared for the whole questionnaire, exactly when motivation
   is spent. New `ReportRail` (desktop) and `ReportRailStrip` (mobile):
   the subjects fill in with sage checks as she answers, "N subjects to
   go" underneath, same visual language as the entry mock.
4. **Kids step**: numeric MM/DD/YYYY fields with auto-advance replace the
   three `<select>`s; the primary button stays enabled and explains
   what's missing on tap; it personalizes ("Start Maya's questionnaire")
   the moment a name is typed; "+ Add another kid first" (ambiguous)
   became a quiet "+ add another kid" link; the 2-to-16 range is stated
   up front; name field autofocuses.
5. **Checklist**: chips in scale order (single row desktop, ordered stack
   mobile, the 2x2 grid shuffled the scale); a tapped chip flashes
   selected ~140ms before advancing; "subject 4 of 16" became "about
   N min left" (16 subjects read as long; time was the promise).
6. **Extras dieted from nine asks to two** (interests + help-with, the
   ones that feed the report). "About your homeschool" (style,
   curriculums, values) moved to the report page as
   `HomeschoolContextCard`, gated by `hasFamilyContext`, saving through
   the same cookie-authed extras route as the whats-working boxes.
   Judgment call: activities/crew/notes were dropped from the lead flow
   entirely (product-stage context, collectable in-app later).
7. **Account step re-offers Google** (one tap beats name+password at the
   moment friction costs most), autofocuses, and gained a show-password
   toggle. Entry email label now carries the why: "Where should I send
   the report?".
8. **Routing**: a fully-answered unscored child now resumes at the finish
   line (signup/scoring) instead of the hub, closing the Google-redirect
   loop; focus moves to fresh step content on phase changes.
9. **Housekeeping found along the way**: fixed "Mayadoes" (the Turbopack
   JSX leading-space strip) in the report's method section; fixed the
   three pre-existing React lint errors (ref-read during render in the
   checklist, `Date.now()` in a ref initializer in scoring, and
   setState-in-effect in plan-weeks, now `useSyncExternalStore`), so
   `pnpm lint` is green again.

Verified end to end against homa-prod with a real account creation
(desktop + mobile Playwright walkthroughs, every step screenshotted);
all test leads and the test auth user deleted afterward. Typecheck,
lint, build, isolation all green.

## 2026-07-06 · S1 becomes the parent's name; birthdates are now real days, not month/year

Founder call, same session as the email-to-signup reversal above, one step
further: "I don't want the first question to be the kids' name, collect the
parent's name (first, last), then add your family," plus "get the actual
birthday, not just month, year." Two changes:

1. **New true S1: `ParentStep`.** First and last name, both required,
   right after the silent anonymous bootstrap, carrying the hero headline
   and the benchmark trust strip that used to live on `KidsStep`. New
   `/api/map/name` route + `saveParentName` (migration `lead_last_name`
   adds the column, applied to homa-prod) update the caller's own
   cookie-resolved lead directly, no upsert-by-anything needed since the
   lead already exists from the anonymous bootstrap. `KidsStep` drops back
   to a plain "add your family" step, no hero, no entry branching.
   `MapFlow`'s name gate (`!firstName`) takes priority over every other
   routing decision, including resume-link `?dd=`/`?start=` params (moot
   in practice: anyone holding such a link already claimed, and claiming
   is downstream of naming).
2. **Since name is now known before signup, `SignupStep` shrank back to
   one field: email.** Re-collecting the name there would have meant
   asking twice. `mapClaimSchema.firstName` stays accepted for backward
   compatibility (a route contract, not a UI field anymore); the claim
   route now forwards the already-known `lead.first_name`/`last_name`
   into both `claimLead` and the waitlist mirror instead of trusting the
   client for it.
3. **Real birthdates.** `mapChildSchema.birthMonth` (YYYY-MM) became
   `birthDate` (YYYY-MM-DD, validated as a real calendar date, e.g.
   rejects Feb 30). `lead_children.birth_month` already a bare `date`
   column, no migration needed, just stopped force-appending `-01`.
   `ageInMonths` became day-precise (a child isn't credited a whole month
   until the calendar reaches their exact birth day), verified live: a
   kid born 2022-05-17 read 4y 1m on 2026-07-06 (not 4y 2m, which the old
   month-only math would have shown). Backward compatible with bare
   "YYYY-MM" callers (the pinned sample report): a missing day just skips
   the day-adjustment, identical to the old behavior. Six `to_char(...,
   'YYYY-MM')` reads in `store.ts` (report view, plan builder,
   band-ready cron, etc.) all widened to `'YYYY-MM-DD'` so the stored day
   actually reaches `ageInMonths`. `KidsStep` gained a Day select between
   Month and Year, clamped to the real day count for the chosen month
   (handles Feb 28/29 without a separate leap-year check).
4. **Scoped to the lead-magnet only.** `public.children`/`lib/family.ts`/
   `lib/child-age.ts` (the real, post-signup product's family system) were
   deliberately left untouched: separate table, separate age math, out of
   the ask, and changing it risks the live chat agent's age-targeted
   material selection for no requested benefit.

Verified live end to end twice against homa-prod: the full happy path
(name → family → checklist → extras → signup-by-email-only → scored
report, name and real birthday confirmed in Postgres) and the
all-pending-band edge case (name → family with only an out-of-range kid →
pre-hub signup, personalized off the still-known name → hub with the
email-me-this-link option now live). All test rows deleted after.

## 2026-07-06 · Email moves from S1 to signup: "no email needed, sign up as the last question"

Founder call, reversing the /onboarding lead magnet's original zero-friction
ruling (email first, S1): kids and the checklist now auto-save under a fully
anonymous session, and email is asked for once, framed as creating the
account, right before the report scores. Real architecture change, not copy:

1. **Schema.** Migration `lead_email_optional` (applied to homa-prod):
   `lead_families.email` drops `not null`, the unique constraint becomes a
   partial index (`where email is not null`), so many anonymous rows can
   share null. `mapStartSchema` shrank to `{source, utm}` (no email, no
   name); a new `mapClaimSchema` (email, optional firstName/usState) covers
   the signup moment. `map.claimed` added to the event registry rather than
   reusing `map.started`, since this is now a genuinely separate moment
   from session start (a lead can answer the whole checklist before it
   fires).
2. **Store.** `upsertLead` split into `startAnonymousLead` (always inserts,
   email null) and `claimLead` (attaches email to the caller's own
   cookie-resolved lead). If that email already belongs to a different,
   older lead, `claimLead` reparents this sitting's `lead_children` onto
   the older account and deletes the now-empty anonymous row, so a second
   sitting on a new device never splits or loses a family. Verified live:
   claim against a pre-existing email correctly merged and left one row.
3. **Routes.** `/api/map/start` is now the silent, idempotent anonymous
   bootstrap (a caller who already holds a valid cookie gets a no-op
   success). New `/api/map/claim` is the only place email is ever asked
   for; `/api/map/score` now 409s defensively if a lead somehow reaches it
   unclaimed.
4. **The honesty gap this reversal opens, closed:** the hub already
   promises "I'll email you the moment the checklist is ready" for
   out-of-range kids. A family whose only kids are outside the scored band
   never reaches the checklist/signup path at all, so `needsPreHubSignup()`
   routes to signup before the hub whenever there is no reachable
   checklist and no email yet, keeping that promise honest. Verified live
   with a same-day-born kid: lands on signup ("...I'll email you the
   moment X's checklist is ready"), then the hub, with the email-me-this-
   link option now available.
5. **First name moved with it.** It had just been added to the old email
   step; rather than ask it twice (once vaguely upfront, once again at
   signup), it now lives only in signup, paired with email as "create your
   account." `ExtrasStep`'s "what should Homa call you" question is
   removed to match (it would have fired before signup on a fresh lead).
6. **Known trade-off, not fixed:** the 24h "you started but didn't finish"
   reminder cron is now mostly unreachable for a first sitting, since a
   family stalled mid-checklist has no email yet by design. Only a family
   that reached signup and stalled after (mid-extras) can still be
   nudged. `leadsNeedingReminder` and `childrenNowInBand` were both
   email-gated defensively so a null email can never reach a send
   attempt; this is a real reduction in recoverable abandonment, accepted
   as the direct cost of removing the upfront email ask.
7. **Also fixed while in this code:** `checklist-step.tsx`'s "answer from
   what you've seen {name} do" hint was silently rendering as one word
   ("Mayado") in Turbopack/SWC's build, not Babel's: a multi-line JSX text
   node right after an expression loses its leading space differently
   than the documented Babel algorithm. Rewritten with an explicit
   `{" "}` rather than relying on source whitespace across the line
   break; other `{child.name}` interpolations elsewhere in the app were
   spot-checked but not exhaustively swept for the same pattern.

## 2026-07-06 · The Homa skills bank: shared craft, targeted by age and capability

Founder: "we should have a homa skills bank... per age (or capability) or
general, so great family skills can be generalized for all users", with
the concrete example that a letter-worksheets skill should load for kids
learning letters and never for families that don't need it. Shipped:

1. **Migration #15** (`skill_bank`, applied to homa-prod): fleet-wide
   curated skills with targeting metadata: nullable min/max_age_months,
   lowercase stem tags (text[]), published flag, provenance note. RLS:
   members READ published rows only; deliberately NO write policies over
   the Data API, so nothing (member, anon, or a compromised model turn)
   can write fleet-wide instructions. Unpublish = one-action revert
   (M3-04 quarantine reasoning applied to skills).
2. **Targeting semantics** (pure functions in lib/agent-skills.ts): a
   bank skill advertises when at least ONE child passes EVERY gate it
   sets: inside the age band (when set) and matching a capability stem
   against the child's focus + interests text (when set). Both gates on
   the same child on purpose (a teen whose focus mentions letters must
   not summon the ages 2.5-7 letter skill). No gates = general, always
   advertised. 15 deterministic checks in
   `scripts/skills-targeting-check.mjs` (node --experimental-strip-types,
   no model, no network).
3. **One merged resolver** (`agent/skills/skill-library.ts`, replaces
   family-skills.ts): family_skills + filtered skill_bank in one map;
   family skill overrides a same-named bank skill (personalization, and
   also required: two dynamic resolvers emitting one name is a runtime
   ambiguity error in eve).
4. **Seeded the first two bank skills** (data insert, not migration):
   `letter-sounds-worksheets` (30-84 months, stems letter/phonic/
   alphabet/abc/sound/read; sound-first craft, the founder's Alessa
   example generalized) and `counting-worksheets` (24-72 months, stems
   count/number/math; cardinality + just-past-the-edge aiming).
5. Instructions now tell Homa the advertised set includes shared Homa
   craft skills and to load a match before improvising.

E2E on the real stack: member reads published bank rows; member POST to
skill_bank rejected (403); fresh session for a 5-year-old with focus
"letter sounds" loaded `letter-sounds-worksheets` via load_skill and
produced a D-and-M letter page themed to her dinosaurs ("tracing, letter
hunts, and a name finish": the seeded craft, followed). Test family and
user deleted (0 remain); the 2 bank rows stay, they are product content.
Typecheck, build, isolation (with skill_bank probes) all green.

Decisions made alone (auditable):
- **Promotion policy · FOUNDER RULING 2026-07-06 (overrides the agent's
  initial consent-first call, logged here for the audit trail)**: during
  beta, promotion from a family skill to the bank is founder-curated
  only. No family notification or consent step: "the objective is to
  make the product amazing; families won't (and don't need to) know."
  What stays regardless: the founder generalizes and strips anything
  family-identifiable before a row goes fleet-wide (that part is privacy
  posture, not permission), promotion happens outside the product via
  SQL, and no auto-promotion by the model ever. Revisit the consent
  question at the M4-04 privacy-policy lawyer pass before public GA.
- **Tags are curator-chosen lowercase stems**, substring-matched, because
  child focus is free text; stems ("letter", "count") hit the natural
  phrasings without a taxonomy. A real capability taxonomy can ride in
  when M2-04 gives profiles structured domain positions.
- **No audience enum column**: generality is derived (no age gate + no
  tag gate), one less thing to keep consistent.
- Bank read query capped at 100 published rows; advertised-per-family
  stays small by targeting, and the count cap on family skills (20)
  still bounds the family tier.
- markdownlint's first-line-heading warning on agent/instructions.md is
  pre-existing (the file is a prompt, not a doc); left alone.

## 2026-07-06 · Hero background warmed (founder screenshot: "update the hero bg like this")

The flat band-sky hero background is now warm cream with a soft gold glow
rising from the top-right, matching the founder's reference screenshot.
Calls made alone, keeping it in-system per the design law (never invent new
colors): the reference's sampled corner color (#FDEEC3) maps to the existing
`--gold-100` (#FFF3C2) and the base to `--bg-page`, rendered as one radial
gradient, no new tokens. The ribbon seam below the hero previously filled
its top half with band-sky to match the old hero; both halves are now
bg-page. Only the landing hero changed; the report page's band-sky header
and the Wave default are untouched.

## 2026-07-06 · Hero slimmed to one CTA, brand-named headline (founder call: "remove watch the film, remove the free-to-start trust line, add Homa is your homeschool assistant")

Founder gave three hero edits. Removals were literal: the "Watch the film"
button and the "Free to start ... See a sample report" trust line are gone.
The film modal (video element, resume-position localStorage, Escape handler)
only existed for that button, so it left too, along with the `.lp-film-*`
CSS; Hero no longer holds state and became a server component. The brand
film asset stays in `public/videos/` (unreferenced, cheap, likely reusable
for social). Call made alone: "add Homa is your homeschool assistant" was
read as the headline, replacing "Your homeschool assistant.", because it is
that exact sentence with the brand name added and the founder's 2026-07-05
ruling was already "say exactly what it is"; the accent color moved with the
word "assistant". /onboarding/sample keeps its other entry points (email
step, sitemap); the report promise now lives only in the onboarding flow
itself.

## 2026-07-06 · Benchmark demo removed from landing (founder call: "remove the where would homa start section, keep the Curious how Homa works card")

The "Where would Homa start?" three-question demo (BenchmarkDemo + DemoMap +
ds/Chip) is gone from the landing page. The surviving peek card now lives in
`components/marketing/HowHomaWorksCard.tsx` with `SkillWeb.tsx` moved up
beside it (the `benchmark/` folder no longer described anything). Calls made
alone, as consequences of the removal rather than new policy: the "Try it"
links in the nav and footer pointed at the removed section's `#try` anchor,
so they were removed rather than left dead (a "How it works" nav link still
covers the how-does-this-work intent); the demo's `.bd-sum` pop animation
CSS was dead and removed; the demo's inline "See where your child stands"
lead-magnet link is gone with the section, the hero, nav, and CTA band still
route to /onboarding.

Founder asked for a senior design review of the /onboarding first screen.
All changes use existing tokens; the surface now carries exactly two playful
devices (ruled paper + one hand note) per the restraint rule. Decisions made
alone, auditable:

- **Found a real layout bug**: the :root `--container-*` tokens (820/1100/
  1280) shadow Tailwind v4's `max-w-md/lg/xl` scale, so the page's `max-w-xl`
  column rendered 1280px wide (the near-full-bleed card in the founder's
  screenshot). /onboarding now uses explicit rem widths. Still shadowed
  elsewhere (signin `max-w-md` renders 820px, report fallback `max-w-xl`
  1280px); flagged for a follow-up sweep.
- Page shell: warm paper schoolbook background (`--bg-page-warm` +
  `--bg-paper`, the web-app onboarding kit's treatment), the trust line as a
  quiet pill chip, the flow column vertically centered, and a 260ms ease-out
  rise on step change (opacity + transform only).
- Footer no longer repeats the card's reassurance sentence on the same
  viewport; it slims to the method + privacy links. The sentence stays inside
  the card at the decision point. All ruled copy kept verbatim.
- "See a sample report first" moved from inside the action card to just
  below it: one action per card.
- Flow cards moved from `border-default` to `border-subtle` per the tokens
  doc (default is the input tone); answer chips keep default. Email step gets
  the kit's elevated single-card treatment (shadow-lg), DS-spec input (1.5px
  border, 54px, clay focus glow), arrow on the CTA, danger border on the
  invalid state.
- Pre-existing lint: eslint fails on 3 react-hooks errors that fail on clean
  HEAD too (checklist-step ref-read-in-render, plan-weeks setState-in-effect,
  scoring-step Date.now-in-render). Not introduced here; typecheck and build
  are green.

## 2026-07-06 · Skillify: "save this as a skill" works in the cloud (family skill library)

Founder asked whether eve can do what the Mac Mini's OpenClaw setup did:
Alessa says "make a worksheet that looks like Paw Patrol", then "save this
as a skill", and Homa can reuse it forever. Answer: yes, via eve's dynamic
skills (defineDynamic in agent/skills/ resolving per turn from the caller's
auth), with rows replacing files since deploys orphan sandbox filesystems.
Shipped the whole loop:

1. **Migration #14** (`family_skills`, applied to homa-prod): name
   (kebab-case, unique per family), description (the always-advertised
   routing hint, capped 200 chars), markdown (the procedure, capped 6,000
   chars, loaded only on demand), source, RLS member-CRUD like
   family_memories.
2. **Dynamic resolver** (`agent/skills/family-skills.ts`): turn.started,
   reads the caller's rows under their own RLS token, returns a map of
   defineSkill entries. eve advertises each description next to its
   built-in load_skill; the body enters context only when loaded
   (progressive disclosure). Failure posture: on DB error skills are
   absent for a turn rather than failing the turn.
3. **Tools**: `save_skill` (same injection scan as memory, count cap 20
   with a retire-one-first error, upsert-by-name so "tweak that skill"
   works) and `forget_skill` (exact name match, deleted body returned so
   "keep it" can re-save).
4. **Instructions**: new section drawing the line (memory = facts, skills
   = repeatable procedures), when to offer ("at most once per
   conversation, never nag"), and to load a matching skill instead of
   re-deriving.
5. **Chat chips**: "Skill saved / updated / removed" + busy labels
   ("looking up how we do this…" while load_skill runs).

E2E on the real stack, the founder's literal scenario: turn 1 made a
Chase-and-Skye letter-sounds worksheet; turn 2 "save this as a skill" →
save_skill wrote `paw-patrol-worksheet` with a proper routing description
(model-authored); a BRAND NEW session asked for "your Paw Patrol skill,
counting this time" → load_skill fired, create_worksheet followed the
saved style ("the whole pup crew helping her count to 5"). Both test
families and users deleted after (0 remain). Typecheck, build, isolation
(with new family_skills probes) all green.

Decisions made alone (auditable):
- **Two-tier skill model**: fleet skills (authored, git, ship by deploy)
  vs family skills (these rows). A family skill sharing a future fleet
  skill's name overrides it for that family only, eve's documented
  behavior, kept deliberately as personalization.
- **Skill saves are explicit-request or accepted-offer only** (Hermes
  staging insight, adapted): the model never silently grows the library,
  and every save/delete is chip-visible in the transcript.
- **Count cap 20** so the advertised list stays one bounded block of
  context; consolidation is a conversation ("which one should we retire?").
- **No skill events emitted**: same registry gap as memory (journeys/06
  §4 has no skill.* names and inventing names is banned); flagged for the
  registry v2 pass alongside M2-13's events.
- First E2E run's turn 1 "failed" only in the harness: 300s stream timeout
  during dev-server cold compile; the turn completed server-side (turn 2
  proved it). Rerun on the warm server passed 14/14. Noting so nobody
  chases a phantom.

## 2026-07-06 · /map renamed /onboarding (founder call: "instead of /map can we call it /onboarding")

The public route only. `app/map` moved to `app/onboarding` (report pages now
`/onboarding/r/[token]`, sample and method pages likewise), every internal
link, the sitemap, the emailed report URL, the share button, and the
resume-link redirect target updated. Permanent redirects added in
`next.config.ts` (`/map` and `/map/:path*`, plus `/conference` and
`/waitlist` now pointing at `/onboarding`), so every report or resume link
already sitting in an inbox keeps working. Deliberately NOT renamed, to keep
the change shippable and honest to the founder's ask (the URL): the
`/api/map/*` endpoints, `lib/map/`, `@homa/core` map modules, `map.*` event
names, `check:map` tooling, and the `lead_*` tables. "Map" stays the internal
concept name; "onboarding" is the public word.

## 2026-07-06 · The chat gets a brain: persona + durable memory (M2-01, M2-02 slice)

Founder direction: "make the chat incredible, Homa should be so smart; turn
onboarding info into files eve can use, maintain, and grow." Design answer
first: eve has no file memory, and sandbox files die on every deploy, so the
"files" are Postgres rows injected into context every turn (eve's documented
multi-tenant memory pattern; 01-architecture.md state model). Shipped:

1. **Migration #13** (`family_memory`, applied to homa-prod):
   `family_memories` table (kind fact / what_works / daily_note-reserved,
   500-char check, RLS: members CRUD their own family's rows, child
   coherence enforced through the caller's own RLS view of children);
   `families.parent_display_name` + `create_my_family(family_name,
   family_us_state, parent_name)` (old 2-arg signature dropped so
   PostgREST stays unambiguous); events INSERT policy for authenticated
   members emitting `chat.%` stamped with their own family_id.
2. **Per-turn family context** (`agent/instructions/family-context.ts`,
   defineDynamic on turn.started): family name/state/parent name, children
   with computed ages + interests + focus + child ids, and saved memories
   with budget usage, rendered as a labeled data-not-instructions block.
   A fresh session starts already knowing the family, which is what makes
   session rotation free, and turn 2 of the E2E proved it (new session,
   zero tools, correct recall).
3. **Memory tools**: `remember` (dedupe, 4,000-char family budget with the
   Hermes consolidate-on-full error shape, write-time injection scan:
   invisible-unicode blocklist + threat regexes in `lib/agent-memory.ts`),
   `forget` (substring match, ambiguity returns candidates, deleted content
   returned for undo-by-resave), `update_child_profile` (schema-bounded
   interests/focus only, scanned like memory). All caller-scoped via
   lib/agent-db (RLS is the tenancy wall); get_children demoted to a
   mid-conversation refresher.
4. **Persona port (M2-01)**: instructions.md now carries the SOUL/IDENTITY
   voice (opinions with conviction, proactive-when-earned, coach-the-parent,
   multi-child disambiguation, boundaries) merged with the design-system
   content fundamentals (offers never commands, reassure-before-inform,
   never "behind", sibling-comparison ban, one nudge max, no sycophant
   openers) + memory laws incl. the distress-data firewall (D5: acute
   distress is never written to memory).
5. **Onboarding → context**: "What should Homa call you?" field on family
   setup writes parent_display_name; child intake (interests/focus) already
   flows into the context block, so everything collected at onboarding now
   reaches Homa's head every turn without seeding duplicate rows.
6. **Chat surface**: assistant replies render markdown (react-markdown +
   remark-gfm, DS-token styles); busy bubble shows named tool activity
   ("saving a note…", "putting the worksheet together…") and hides while
   text streams; sage "Noted / Forgot / Profile updated" chips make memory
   effects visible in the transcript (MJ-02 confirmation spirit); error
   copy reassures first. Greeting uses the parent's name.
7. **Events (MJ-08)**: `chat.turn_completed` added to the typed registry
   (status/error_class/modality/latency_ms/model_tier/tool_calls);
   emitEvent gained optional accessToken + familyId so browser emits ride
   the caller's own RLS. Emitted from the chat client on finish and on
   error.

Verified against the real stack (next+eve dev, homa-prod, real model):
full E2E passed: signup → create_my_family with parent name → child →
turn 1 shares "co-op every Friday" → Homa calls remember unprompted → row
in family_memories → brand-new session answers "Fridays!" with zero tool
calls (pure injected context) → member can emit chat.turn_completed, cannot
emit for a foreign family_id. Test rows + user deleted after (0 remain).
Typecheck, build, isolation checks (extended with family_memories + chat
event probes) all green. Security advisors: no new findings (the
create_my_family SECURITY DEFINER warn is the documented, intended one).

Decisions made alone (auditable):
- **Memory medium is Postgres rows, not files**: forced by verified eve
  behavior (deploy-scoped sandboxes); the template's MEMORY.md layering
  survives as kinds on rows.
- **Timezone**: context date pinned to US Eastern for cohort one (families
  have no timezone column yet; the drip scheduler MJ-05 owns per-family
  timezones). TODO for human if a non-Eastern family joins earlier.
- **No approval gate on forget**: eve HITL parking would strand the lean
  chat UI (no approval surface yet, M1-04 proper). Guardrails instead:
  family-scoped RLS, single-row deletes, deleted content returned so the
  model can restore on "keep that".
- **Client-side event emit**: journeys/06 marks chat.turn_completed source
  "agent", but eve hooks don't expose auth attributes, so the browser emits
  under the caller's token until M1-02's server-side event persistence.
  tool_calls counts the last assistant message's tool parts (honest v0).
- **No memory.saved event invented**: the registry law forbids inventing
  names; the closest spec'd event (observation.logged) requires domain
  codes M2-13 owns. Logged as a known gap for M2-13.
- **Migration file named to the remote-assigned version** (20260706061222)
  so local files match `supabase migration list`. (A parallel agent session
  running tonight committed migration #11's file and this session's
  events.ts registry change mid-build; reconciled, no divergence left.)
- Pre-existing `pnpm lint` failures in map/* files (react-hooks purity
  rules) left untouched; CI gates typecheck + build + isolation, not lint.
  New chat code lints clean.

Still open toward "incredible chat": M1-04 proper (shadcn chat components
+ streaming scroll polish), cross-device history (M1-02 conversations
table), voice notes (M1-05), the M2-13 post-turn learning review (the
automated "gets smarter" loop; today Homa saves memories in-turn per her
instructions), M2-15 recall_conversations search.

## 2026-07-06 · Movement pass: the report becomes a living document

Founder asked "what would make this better for the user," then "do this
all." Shipped the full movement layer on top of the deep-dive loop:

1. Score history (migration #11, `lead_reports.history` jsonb): every
   rescore snapshots the prior per-subject scores with a timestamp before
   overwriting. History is capped at 12 snapshots.
2. Movement on the report, anti-guilt enforced: subjects that moved up
   since the last sitting get a "+N mo since last time" chip and the note
   from Homa celebrates the count ("1 subject moved since last time. Your
   work is showing up in the numbers."). Drops render nothing, silence,
   never a down arrow. The picture chart shows a faded hollow ring at the
   prior position, connected to the solid dot, only when movement is
   positive.
3. Shared `ReportView` server component now renders the live token page
   and `/map/sample`. The sample is a fictional demonstration child
   ("Maya", clearly bannered as sample data) so parents can see a finished
   report before giving an email. Linked from the hero's secondary CTA.
4. Next-kid handoff: when a family has another kid without a report, the
   report page ends with "[Name] is next" linking to `/map?start=<id>`,
   which drops straight into that kid's checklist.
5. Back button in the checklist and deep dive: undoes the last answer
   (server-persisted answers are simply overwritten on re-answer).
6. Plan check-offs: each plan activity gets a checkbox persisted in
   localStorage (key `homa-plan-<child>-<domain>`), no schema change,
   celebration line when a week completes.
7. State legal line: if the family gave a US state in extras, the report
   footer says homeschooling is legal in all 50 states including theirs,
   worded as reassurance, no legal advice. Sample shows Texas.

Decisions made alone: movement chips only ever show gains (drops are
noise at this sample size and violate the anti-guilt law); prior rings
capped at one per subject (latest prior, not the whole trail); the sample
child's answers climb full ladders so the sample shows a strengths-first
report, matching what a real strong sitting produces.

## 2026-07-06 (morning, wave 2) · World-class benchmark push: provenance codes, freshness loop, re-norm loop, 6 new research lanes

Founder: "do everything except 5&6 [paid instruments, expert review].
Boil the ocean." Four workstreams, decisions made alone:

1. **Provenance codes.** `MapItemContent` gained an optional `standards`
   field; 89 of 220 items now carry formal codes (CCSS, NGSS, CSTA, CEE,
   ELOF, C3, ACTFL, NCAS, SHAPE) populated only where the corpus verified
   the code. Re-verification after a standards revision is now a grep,
   not a research project. check:map validates the field.
2. **Freshness loop.** `pnpm check:sources`
   (scripts/benchmarks-freshness.mts): probes all 24 MAP_SOURCES URLs,
   enforces a verified-date manifest both directions, warns at 180 days
   stale, carries a revision watchlist (CSTA 2026, NCAS review, CEE 3rd
   ed, CCSS site move). Deliberately not in CI (network). First run
   caught two dead government URLs (CDC and ELOF both moved hosts in
   2025 site redesigns): fixed in MAP_SOURCES, which also fixes the
   public /onboarding/method source links. Paywalled journal hosts that
   reject probes are marked botBlocked (warning, not failure). Runbook:
   runbooks/benchmark-freshness.md.
3. **Re-norm loop (Homa-native norms).** `pnpm report:norms`
   (scripts/map-norms-report.mts): founder-ops, read-only, aggregate-only
   report over lead_answers x lead_children.birth_month, per item per
   6-month age bucket, next to the published anchor. Privacy posture:
   no PII in output, buckets under n=30 render as "low n", runs locally
   with the server-only DB credential, never deployed. Anchor-move gates
   (100+ observations, selection-bias check, wording check, conservative
   direction) live in runbooks/map-renorm.md. Smoke-tested against prod:
   38 answers, 1 child, everything correctly "insufficient data". No
   schema changes. Root devDep added: postgres (for the script only).
4. **Research wave 2, 6 parallel lanes** into docs/homa-benchmarks/:
   11 score distributions (percentile curves: Wordbank CDI, MAP, ORF,
   Lexile, NIH Toolbox), 12 ND/2e trajectories (tolerance implications
   per domain, D5 boundary respected), 13 math curriculum crosswalk
   (Saxon, Singapore, Math-U-See, and 7 more mapped to bank items),
   14 ELA curriculum crosswalk (AAR, Logic of English, IEW, and more),
   15 refresh sweep (executes the synthesis follow-up queue: CSTA 2026
   status, NAEP gaps, ORF grades 7 to 8, World Book missing grades,
   ELOF indicators, and more), 16 the 50-state homeschool assessment
   sweep (not legal advice; product re-verifies before display).
   Corpus README index updated with all six lanes.

Verified: check:map green (220 items, 89 coded), check:sources green,
typecheck green, build green, norms report runs against prod read-only.

Wave-2 outcome (all six lanes returned by 09:19): 1,793 corpus lines
added, dash law clean, every lane structured with porting notes and dry
wells. Load-bearing results folded into 00-synthesis.md sections 5 to 7:
the 14-item follow-up queue fully executed (NAEP civics cuts and grade 4
math average recovered, Ohio language hours table recovered, ELOF
indicators completed, tooth brushing and monkey bars anchored); one
supersession (Florida has NO statutory percentile line, correcting lane
10's unverified figure; Ohio abolished homeschool assessment Oct 2023,
lane 16 now canonical for states); one policy shift (AAP replaced its
2016 media policy Feb 2026, displacement model, affects future screen
copy); tolerance-band method with 13 verified bank-item windows (lane
11); the 16-domain ND/2e tolerance table (lane 12); and 134 curriculum
level rows mapped to bank items (lanes 13, 14). CSTA 2026 final text
lands July 13 to 15: computer_science re-verify is calendared.

## 2026-07-06 (morning, later) · Computer science ships as the 16th domain

Founder: "add the computer science domain." Decisions made alone:

1. Exposure-based, like spanish. CSTA anchors are when-taught placements,
   not developmental norms; a child who never met Scratch is not "growing"
   in anything. Exposure domains never render months-ahead, and the report
   frames them as "part of your world / whenever you like", which is the
   honest framing for CS. Anchors (66 to 192mo) order the ladder rungs.
2. 8 items on CSTA 2017 (the published edition): unplugged robot game,
   block sequence, debugging, loops and events, variables, decomposition
   and planning, text language, ships-something-real. New `csta` source
   key renders on /onboarding/method. Placed before spanish so spanish's
   "Last one:" intro stays true; checklist grows to 16 base questions.
3. Exposure copy in sentences.ts generalized (the "second language" line
   was hardcoded for all exposure domains); CS gets its own line. CS
   practice patterns added to plans.ts (the fallback would have served
   math patterns). Hardcoded "15 subjects" copy fixed: scoring step and
   map-check now derive from MAP_DOMAINS.length, BenchmarkDemo says 16.
4. Same MAP_BANK_VERSION (2026.07.2): the version has not shipped yet
   today, one bump covers the day's change set.
5. Queued for the CSTA 2026 release (this month): re-verify item wording
   against the renamed concepts, consider an AI-literacy rung (UNESCO
   2024 / AI4K12 were captured in corpus lane 09).

Verified: check:map green (16 domains, 220 items), typecheck green, build
green.

## 2026-07-06 (morning) · Benchmark corpus ported into the bank (v2026.07.2)

Founder: "do everything you need to use this to make our product better,
update everything." First porting pass from docs/homa-benchmarks/ into
`packages/core/src/map/content.ts`, 188 to 212 items, MAP_BANK_VERSION
2026.07.1 to 2026.07.2. Decisions made alone:

1. Applied the synthesis's top corrections: focus-5/focus-15 lost their
   minute claims (the minutes-per-year rule is unsourced folklore per lane
   08); short-sentences re-anchored to familiar listeners with a new
   stranger-clear item at 46mo (Hustad 2021); counts-to-100 moved 72 to 78
   (CCSS vs Clements-Sarama tension split, dual-cited); rides-bike moved
   108 to 84 (AAP 4-to-7 window). Anchor moves are safe: every stored
   report records the bank version that scored it (method page states
   this), and rescoring only happens on a new sitting.
2. Added 24 ladder items across 13 domains from lane porting notes, only
   parent-observable statements with verified anchors: theory of mind at
   56mo, Lowenfeld drawing stages, Tabors/Hoff-Core spanish exposure rungs,
   gallop/swim/bike sequence, rhythm notation, savings plan (CEE),
   continents and oceans, stop-and-go inhibition game, time estimation.
   7 new source keys (hustad, crowe-mcleod, wellman, lowenfeld, ufli, cee,
   hoff-core) render automatically on /onboarding/method.
3. Deliberately NOT ported: per-minute fluency rates (field disagrees 2x),
   topic-placement items (no national grade placement exists), legal ages
   (facts, not development), FitnessGram zones (display-law risk). The CS
   domain is deferred: CSTA 2026 lands this month and a 16th domain
   lengthens every child's checklist, so that is a founder call, queued.
4. Plans/sentences needed no changes: practice patterns are per-domain and
   new statements were written to read correctly through skillPhrase's
   gerund transform (verified by check:map plan fixtures).

Verified: check:map green (212 items, all fixtures pass), typecheck green,
build green. Corpus synthesis and README updated with porting status.

## 2026-07-06 (overnight) · National benchmark corpus commissioned

Founder: capture national benchmarks on all subjects and milestones for
ages 2 to 16, via deep parallel research, kept so progress reports get
better anchors. Decisions made alone, in the ICP-research pattern:

1. Location: new tracked folder `docs/homa-benchmarks/` (README + 10 lane
   files + synthesis). `homa-research/` is off-limits by repo law, and the
   corpus must be tracked and agent-readable. Root README repo map updated.
2. Shape: internal reference docs, never parent-facing. Assessment
   vocabulary is allowed inside the corpus; anything ported to product
   surfaces still passes the map content laws (parent-observable, banned
   words, citations) and the anti-guilt display law.
3. Anchor convention: whole months, end-of-grade grade-to-month table in
   the folder README matching the anchors already in content.ts (gr 3 =
   108mo etc). Grade conversions are marked convention, not fact.
4. Nothing auto-flows into `packages/core/src/map/content.ts`: porting is
   deliberate, per item, with a MAP_BANK_VERSION bump and check:map green.
   Each lane file ends with "Product porting notes" naming its candidate
   anchors.
5. Sourcing law copied from the ICP folder: every claim linked with access
   date, FACT vs INFERENCE labeled, unverifiable numbers go to "dry wells"
   sections instead of being estimated.

Ten research agents dispatched in parallel (early childhood 2 to 5, math,
reading, writing and language, science, social studies, arts/PE/health,
SEL/EF/life skills, world languages/CS/digital, assessment norms and the
homeschool testing landscape). Synthesis file written after their return.

## 2026-07-06 · Deep dive now ends in the curriculum (founder live-test feedback)

Founder, testing on production: "when I click dive deeper and answer more
questions, it just brings me back to the progress report. Expected: it
creates a custom curriculum for the next month." Fixed: a deep-dive
sitting now rescores and lands directly on that subject's four-week plan,
REBUILT from the refined answers (`getOrBuildPlan` gained a rebuild mode:
fresh targets from the just-found starting line, retest clock restarted,
retest email re-armed, which IS the monthly loop). The plan page shows a
"built from your deep dive" banner; the report's go-deeper buttons now
promise the plan ("pin down the start, get the plan"). The first full
checklist still lands on the report, deep dives land on the plan.

Also fixed while reading rendered plans: skill statements now conjugate
into sentences (gerundize: "Knows multiplication facts" reads as "ten
minutes a day of knowing multiplication facts", with colon-example and
second-verb-clause trimming so week focuses stay short). Verified live:
initial plan targeted multiplication, deep dive walked down to the 7y
foothold, rebuilt plan re-targeted skip-counting first, retest clock
reset and email re-armed, banner rendered. Test rows cleaned scoped by
email; one real lead (with a plan) appeared during the session and was
left untouched.

## 2026-07-06 (later still) · Full copy simplification pass

Founder: "do a pass that simplifies and clarifies all copy." Ran the
copy-editing skill's clarity/voice/word-level sweeps over every parent-
facing string: the sentence bank (domainLine, homaNote, tryHeading), all
15 domain intros and both growing-activity sets, all ~45 plan practice
patterns and 9 style notes, every flow screen (email, kids, checklist,
extras, deep dive, scoring, hub), the report, plan, method, and privacy
pages, the four transactional emails, and the landing sections. Rules
applied: cut weak intensifiers (completely/totally/genuinely), one idea
per sentence, front-load the point, verbs over abstractions, keep the
warmth but never at the cost of the meaning. ~130 strings tightened; the
banned-word/em-dash linter guarded the whole pass.

Two real fixes surfaced by reading rendered output during the pass:

1. homaNote grammar: with zero ahead subjects the note read "on track in
   12 more" with no preceding clause; "more" now only follows an "ahead
   in N" clause.
2. Plan floor bug: when a subject had ONLY a not-yet answer (no confirmed
   easier skills), plan targets fell to the bottom of the bank, so a
   6-year-old's fine-motor plan targeted block-stacking. The target floor
   now anchors at the named not-yet itself (the deep dive refines it
   downward only with evidence). Regression fixture added to check:map.

Verified: check:map, typecheck, build green; fresh 6-year-old e2e with
screenshots of the report, plan, /map, and hero; scoped test cleanup (the
two real leads untouched). Committed together with the parallel session's
/terms page (below), which was verified in the same build.

## 2026-07-06 (later still) · /terms shipped for Google OAuth branding

Google's consent-screen branding form (part of making the Google sign-in
screen say "Homa" instead of the raw Supabase URL) requires public privacy
and terms URLs. /privacy existed; /terms did not, so it was written in the
same plain-language voice and shipped at apps/web/app/terms/page.tsx
(+ footer Support column + sitemap). Two deliberate omissions, both because
the LLC filing is deferred until Stripe activation (entry #11 above): no
legal entity name and no governing-law clause. Revisit both when the entity
exists. Content commitments mirror what is already true in code and copy:
free today, parents only (18+), children never use Homa, not-a-test and
not-medical-advice disclaimers matching /map/method, data terms deferring
to /privacy, delete-anytime via hello@mail.thankshoma.com.

## 2026-07-06 (later) · The go-deeper loop shipped (founder: "don't defer these, BOIL THE OCEAN")

The read-through session's "deferred" list, built the same night on founder
order. What shipped:

1. **Subject deep dives** (the click-into-a-subject ask): up to 8 extra
   questions per sitting via an adaptive probe (`nextDeepDiveItem` in
   packages/core): walks DOWN after a not-yet to find the honest starting
   line ("how far back does the struggle begin", framed as footing, never
   as testing-at-N-years-old), climbs UP past the report's two-rung cap
   for strong subjects. Mode chooser first, straight from the transcript:
   answer from memory, or sit with the kid and try them together (mode
   captured in map.deep_dive_started). Rescoring updates the same report
   token; the report email is now sent once ever (rescores never re-mail).
   Entry points: per-subject "Go deeper" buttons on the report and the
   `?dd=childId.domainId` param the retest email uses.
2. **Four-week plans + the retest loop** (the addiction mechanic): pure
   deterministic builder (`buildFourWeekPlan`): the child's confirmed
   footing sets the starting line, the bank's next two rungs become week
   1-2 and 3-4 focuses, ~45 hand-written practice patterns (3 per subject:
   daily rep, interest-flavored rep, out-in-the-world rep) fill the weeks,
   the first interest flavors the copy, and the family's homeschool style
   adds a one-line bend (9 style notes). Plan page at
   /map/r/[token]/plan/[subject], tokenized + printable, built on first
   view (migration #9 `20260706035723_lead_plans`, deny-all RLS). Building
   a plan arms retest_at (+28 days); cron job 3 sends the one retest email
   into the subject's deep dive, so the number can visibly move. Verified
   once-only send.
3. **What-are-you-doing-right capture**: strength cards on the report ask
   "what are you doing in [subject] that works?", saving per-subject into
   the child's context (deep-merged so subjects never clobber each other).
4. **Extras additions**: per-kid activities tags (gymnastics, co-op...)
   and the family "crew" tags (family members, pets, stuffed animals, the
   neighbor kid) for future personalized materials. Names only.
5. **Bug found and fixed live (migration #10 `20260706040958_lead_link_token`):**
   every cron/resume email used to ROTATE resume_token_hash, which silently
   logged out the device the mom actually used. Emailed links now mint a
   separate link token; both are honored on lookup, so an email never kills
   the cookie. Also fixed: plan targets could aim below already-confirmed
   skills after a deep dive (now floored at the highest confirmed anchor),
   and long two-clause skill statements are trimmed to their first clause
   inside plan sentences.

NOT built, still law-gated (not scope-gated): photo upload for
personalization. BUILD.md law 5 / D4 requires the dedicated consent screen,
TTL on raws, and executed no-training DPAs first; those are founder
artifacts. The crew capture is the text-only forerunner. Location-aware
suggestions stayed generic-outing level on purpose (PRD non-goal:
discover/local engine); health/weight capture stays in the notes field per
MJ-13/D6.

Checks grew with the surface: deep-dive direction fixtures (down after
not-yet, up after easily, sitting cap), plan fixtures (4 clean weeks × 15
subjects × 4 ages, no placeholders, no banned words). Verified live end to
end as a 10-year-old with growing math: base checklist → deep dive walking
down to the 7-year-old foothold → rescore (no duplicate email) → plan
targeting skip-counting and multiplication (not baby skills) flavored with
minecraft + Montessori → forced retest_at → cron sent exactly one retest
email → whats-working deep merge kept two subjects. Test rows cleaned,
scoped by lead id; the two real production leads untouched.

## 2026-07-06 · Progress report v2: founder + Alessa read-through implemented

Source: the recorded 45-minute walkthrough (founder + Alessa driving the live
flow, transcript in Downloads). Every actionable ruling extracted and shipped:

1. **Vocabulary, everywhere user-facing:** "progress report" not map,
   "subject" not domain, plain age words not "band", color words
   yellow/green/blue in copy (tokens stay gold/sage/sky in code). Rebased
   over and merged with the parallel copy commit 5f861c4 (same direction,
   subset), keeping its further ruling: the "a checklist for you, never a
   test for them" tagline is dropped everywhere as confusing without
   context.
2. **Landing hero says what it is:** "Your homeschool assistant." with the
   old tagline demoted into the sub-line; CTAs are "See where your child
   stands" (hero/nav/founding families) and "Get your free progress report"
   (blog/method).
3. **Flow simplification:** S1 is email-only ("Enter your email to get
   started"); kids are name + age only with an explicit nickname-is-fine
   line; no interstitial before question one (a one-time hint rides above
   it); fixed-height question card so nothing jumps; "subject 4 of 15".
   Item fixes: "without a wobble" and "for a few turns" rewritten; the
   second-language questions are now self-explanatory and lead with "skip
   if it's not part of your home."
4. **The extras step (new):** after the checklist, before the report, all
   optional: typeable interest tags with age-aware suggestions, multi-select
   help-with, per-kid notes, and (first time only) what to call her,
   homeschool style + how-closely, current curriculums as tags, and a
   family-values free text. Migration #8 (`20260706023548_lead_context_jsonb`)
   adds jsonb context bags on lead_families and lead_children; new
   /api/map/extras route + map.context_added event. Rationale from the
   session: ask context AFTER she's invested, and style/curriculums are
   load-bearing for future curriculum generation.
5. **Report fixes:** the note-from-Homa is spoken by the logo mark (the
   "h" circle read as a mystery); growing subjects name the child's actual
   next skill (frontierStatement from the scorer) with rotating phrasings
   instead of one repeated sentence 13 times; the top note reads the room
   (a growing-heavy picture gets "solid footing in N subjects, a clear
   next step in the blues", never a defeating tally); "with something
   small to try attached" phrasing gone; the things-to-try section
   right-sizes to "Where to start, pick one for this week" when 3+
   subjects are growing; every subject card expands (details/summary) to
   show what was asked, her answers, "typical by [age]" anchors, the
   growing activity, and linked benchmark sources, answering "where did
   you get that benchmark?" in two taps.
6. **Verified:** typecheck, build, check:map, check:isolation green; live
   e2e as a struggling 10-year-old (12 not-yets) confirming the kind
   read-the-room note, named frontiers, expanders, and context persistence;
   screenshots reviewed; test rows cleaned.

Deferred to the product backlog, captured from the session but NOT built
into the lead magnet (they are product scope): click-to-go-deeper quizzes
per subject with optional kid-sits-with-you mode, build-a-curriculum from
a growing subject + retest in four weeks (the retention loop, ties to
FR-9/M3-03), what-are-you-doing-right follow-up on far-ahead subjects,
photo upload + family members for personalization (D4 consent floor
applies), location-aware activity suggestions (museum trips), and health/
weight/social context capture (sensitive: MJ-13/D6 firewall applies).
The extras step's notes field captures the light version of the last one.

Operational notes: two real leads existed in prod during this session (one
with 2 kids + 2 reports generated), so the map.* events cleanup used during
testing wiped their funnel events too, analytics-only loss, lesson logged:
future test cleanup must filter by the test lead's ids, not by event name.
Announcement draft updated to progress-report wording; still unsent.

## 2026-07-05 (later) · Map bank v2026.07.1: ages 8 to 16 shipped (LM-7)

Continuation of the "ship all" mandate: 75 new upper-band items across all
15 domains, anchored to school grade bands (gr 3 ~108mo, gr 5 ~132mo, gr 8
~168mo, gr 10 ~192mo, ladder headroom to ~17.5y) and cited to the same
frameworks the template benchmark library carries for PreK-12 (CCSS math +
ELA, NGSS MS/HS, C3, National Core Arts, SHAPE, CASEL, ACTFL Seal-of-
Biliteracy path, plus three new source keys: Dawson & Guare executive
skills, AAP HealthyChildren life-skills/chores guidance, ASHA school-age
language). Scored range now 2y0m to 17y0m; under-2s keep the pending-band
promise flow. Each domain gained an age-appropriate "growing" activity for
kids 8+ (report picks by age). Agent calls made alone: plateaued skills
(e.g. phonics for teens) deliberately read "at age" rather than
manufacturing ahead-months; teen items lean on artifacts a parent has seen
(essays, laundry, schedules, ensembles) rather than quiz-the-kid prompts,
per the plan's face-validity risk note. Verified: check:map extended to the
full range with 10yo and 15yo golden-kid fixtures (all green), live 12yo
e2e against homa-prod (base selection, scoring, teen report render, older
activity swap, no toddler copy leaks), test rows cleaned. The read-aloud
debt now covers all 188 items.

## 2026-07-05 · Lead magnet v2 SHIPPED (founder: "ship all, start with your recommendations, make room to improve")

Founder ruled all eight planning decisions to the recommended options
(D1 two-stage ages 2-7 first · D2 "where your child stands" vs national
benchmarks, months-ahead framing · D3 lead tables + claim-at-invite ·
D4 full adaptive checklist · D5 report on screen + email · D6 one announce
email to the existing waitlist · D7 capture out-of-range kids + automatic
promise-keeping · D8 human-reviewed sentence banks, zero model calls).
Built and verified end to end this session:

1. **Migration #7 (`20260705223838_map_lead_tables`)**: lead_families /
   lead_children / lead_answers / lead_reports, RLS enabled with ZERO
   policies plus privileges revoked from anon+authenticated (stricter than
   the waitlist). Applied to homa-prod via MCP; file renamed to the applied
   version. `scripts/isolation-check.mjs` gained 6 lead-table cases, all
   green.
2. **Server data path**: first server-only secret enters `apps/web`
   (SUPABASE_DB_PASSWORD via the Supabase transaction pooler,
   `lib/map/db.ts` + postgres.js, prepare=false, max=2). Added to Vercel
   prod+preview (Sensitive) via CLI. Lead ids never come from the client:
   an httpOnly resume cookie (sha256-stored token) is the only session
   mechanism, and every child-scoped write re-checks ownership.
3. **packages/core `map/`**: bands math, versioned content bank
   (v2026.07.0: 15 domains, 113 parent-observable items, ages 2 to 7,
   every item cited to CDC/ELOF/CCSS/NGSS/C3/NCA/SHAPE/CASEL/ACTFL/
   Harvard-EF/Clements-Sarama/HWT), adaptive ladder (base + up to 2 rungs,
   unlocked only by "easily"), deterministic scorer (frontier months-ahead,
   +24 cap, growing floor, confidence), sentence bank, map.* typed events.
   Bank content derives from homa-template's questionnaire + benchmark
   library (the M0-10 asset), extended to cover 4.5-7 where the template
   bank thinned out.
4. **`pnpm check:map` + CI step**: content linter (banned words per the
   never-say law, em dash ban, citation presence, sane anchors) + golden-kid
   scorer fixtures (ahead/mixed/sparse/struggling, determinism, no negative
   number ever rendered). Caught one real violation pre-ship ("behind" in a
   social-studies item, rewritten).
5. **The flow at `/map`**: email-first (lead secured before any work, dup =
   welcome back), kids with interests + help-with chips and the sage
   out-of-range card, per-kid checklist (4 chips + skip, tap-to-save with
   retry queue, finish-later), 2.2s scoring theater, report page at
   `/map/r/[token]` (strengths first, server-rendered SVG dot chart, per-
   domain evidence echoing her own answers, growing activities attached,
   methodology + sources, founding-families close, print styles), report
   email via Resend, `/map/method` methodology page, `/privacy` (launch
   gate 7 pulled forward: we now hold child names + birth months + answers,
   so the policy ships with the feature naming Supabase/Vercel/Resend and
   the delete-anytime path).
6. **Promise-keeping cron** (`/api/map/cron`, hourly via apps/web/
   vercel.json, CRON_SECRET-gated): the single 24h reminder (one send ever)
   and the band-ready email that fires automatically when a pending child's
   age band ships.
7. **Landing claims pass**: hero "Loved by 12,000+ homeschooling families"
   avatar row and "Start free for 14 days" CTA (rulings C2/T2 violations,
   ported from the kit) replaced with the honest map CTA + trust line;
   pricing tier grid replaced by a founding-families band (D9's unlimited-
   children promise is the only plan claim); invented testimonial quotes
   replaced by the true our-story band with an explicit no-invented-
   testimonials promise; community section's fake "4 families within 5
   miles" stat reframed as roadmap; FAQ rewritten honestly (ages 2-7 today,
   child never uses it, pricing published before anyone is charged);
   benchmark demo now hands off to /map. `/waitlist` + `/conference` 308 to
   `/map`; old form + page deleted; every lead still mirrors into
   public.waitlist so MJ-09 invites read one list. This also resolves DM7's
   flagged tension for map leads: the S1 microcopy now says "your email gets
   each child's map and your founding-family invite," which is the consent
   scope for everything the flow sends.
8. **Verified**: typecheck, build, check:isolation, check:map all green;
   live e2e against homa-prod (start → dup → 2 kids → 26 answers → score →
   report page renders lawfully → Resend delivery to delivered@resend.dev →
   viewed_at stamped → cron auth + run → resume no-enumeration → bad token
   soft page); report + /map + landing screenshotted; all test rows deleted
   after.

Agent-made calls within the founder's mandate, logged: ladder capped at 2
rungs per domain (reaches the +24 display cap; more taps add fatigue, not
signal) · offline S1 falls back to the existing waitlist queue so a dead-
wifi lead is still captured · exposure-based domain (second language) never
produces a months number · report email contains no numbers (sibling-
comparison law applied to inboxes) · cron reminder requires 4h of
inactivity and one child unfinished. Founder still owes: read-aloud pass on
the 113 item statements + report sentences (same bar as the copy kit), the
D6 announce email send (draft: `docs/homa-planning/map-announcement-draft.md`),
and the phone test.

## 2026-07-05 · Marketing demand engine spec (14-marketing-demand-engine.md)

Founder-approved design session for the B2C demand-gen pipeline, ported from the
founder's B2B consulting content engine. Founder rulings recorded as DM1 to DM6 in
the spec: lives inside this repo as `marketing/` (not a separate repo), blog built
in `apps/web` as part of the project, all six social channels plus blog plus
waitlist email at launch, manual trigger first with routines shipped disabled,
full-engine scope, email lane day one.

Agent calls made alone (all in the spec): raw/ and signals/ live beside content/
(reservoir vs outputs lifecycle), micro-copy formats get a batched gate pass
instead of nine full double-gates (cost), skills named `marketing-*` in
`.agents/skills/`, scorer is stdlib Python local-only (not in CI yet), no empty
growth-map folders.

Tension flagged, not resolved: **DM7**, the live waitlist form promises "email
only used to send your invite," so pipeline nurture emails are staged but never
sent until the founder rules on consent scope (options in spec §10). Sources
honored: `homa-macmini/`, `homa-research/`, `homa-template/` were not read and are
banned as signal sources in the spec's safety rails.

## 2026-07-05 · Lead magnet v2 planning session (artifacts only, no product code)

Founder asked for a plan to replace the write-only waitlist with a
context-grab lead magnet ("see where your child ranks" report per child,
ages 2 to 16, benchmark-compared, emailed). Produced five reviewable HTML
artifacts in `docs/homa-planning/lead-magnet/` (index + decisions, flow
chart, user journey, states + backend map, full report mock). No decisions
were made unilaterally; eight decision points (D1 to D8: conference timing,
claim framing, account-vs-lead storage, checklist depth, delivery, existing
waitlist emails, out-of-range capture, narrative source) are presented with
recommendations and await founder rulings via the artifact composer.

Tensions flagged for the record, not resolved here:

1. "See where your child ranks" vs the never-say law: artifacts recommend
   "see where your child stands" + months-ahead vs national benchmarks
   (the shipped hero's own promise), never percentile/"national average"
   claims we cannot substantiate.
2. Real accounts during the flow would touch the PRD non-goal ("public
   signup: invite codes only") and would put family-creation on a public
   surface before the M1-07 adversarial suite exists; artifacts recommend
   lead tables + claim-at-invite instead (rides MJ-09).
3. Report generation needs the first server-only Supabase secret in
   `apps/web` (build-log 2026-07-04 #3 anticipated this moment for MJ-09).
4. Privacy policy (launch gate 7) effectively pulls forward: this feature
   holds children's names, birth months, and developmental answers, not
   just emails, and the current form promise ("email only used for your
   invite") must be re-vetted.
5. Pre-existing violation spotted in shipped code: `Hero.tsx` renders the
   kit's "Loved by 12,000+ homeschooling families" avatar row (fabricated
   social proof, ruling C2) and a "Start free for 14 days" CTA (pricing
   claim, T2 + Deliverable 0 hard constraint). Journeys/02's header note
   explicitly says both may not ship. Needs a fix regardless of v2.

Sources honored: `homa-macmini/` was NOT read (repo law; founder-provided
screenshots used instead). Reference material came from `homa-template/`
(read-only): the 15-domain questionnaire bank (2y0m to 7y0m) and the
PreK-12 citation-backed benchmark files, which is the ported asset M0-10
already names.

## 2026-07-04 · Deliverable 0 build session

1. **"Never used to train AI" claim withheld from the landing page.** The
   journeys/02 landing spec includes the no-training privacy line, but claim
   rule 6.6 (journeys/07 §6) says data promises ship only when the DPAs are
   executed. The DPAs do not exist yet, so the page says only what is already
   true: "we'll only use your email to send your invite" and "we'll publish our
   full privacy policy before the first family joins." Swap in the strong claim
   the day the DPAs are signed.
2. **No pricing anywhere on the page**, including the "$29 when you're ready"
   line the journeys/02 conference spec suggests. BUILD.md Deliverable 0 hard
   constraint ("no pricing on the page," decision T2) outranks the older
   journey doc per the documented precedence order.
3. **Waitlist storage pattern: write-only RLS with the publishable key.** The
   anon role can INSERT a pending waitlist row and waitlist.* events, and can
   never SELECT/UPDATE/DELETE (verified by scripts/isolation-check.mjs). No
   service-role secret exists in the app at all yet. When the invite service
   (MJ-09) needs to read the list, it gets a server-only secret key via env.
4. **Age bands on the waitlist form:** under 2, 2–3, 4–5, 6–7, 8–10, 11+.
   Chosen to cover the full boil-the-ocean range (D3) while keeping the proven
   2–7 core visible as distinct bands for cohort prioritization.
5. **Typed event registry (MJ-08) lives in `packages/core`** and writes to
   `public.events` over the Data API, best-effort (analytics never break the
   feature). First registered event: `waitlist.joined`. Event props carry no
   PII; the email lives only in the waitlist row.
6. **UI is deliberately wireframe.** Sidney is running the design pass; copy,
   structure, and behavior are binding, visuals are placeholders. The
   worksheet-sample slot on the landing page is an empty dashed box on purpose
   (no fabricated artifacts, ruling C2).
7. **Tenancy v0 (M0-05) shipped read-side only.** families/family_members/
   children tables exist with deny-by-default RLS and member-scoped SELECT
   (plus children INSERT/UPDATE for members). Family creation policies land
   with FR-1's server-side invite flow, so nothing can create a family from
   the public surface today.
8. **Advisor fix applied to a project-level helper:** revoked Data API EXECUTE
   on `public.rls_auto_enable()` (Supabase auto-RLS trigger helper) plus our
   `is_family_member()`, per security advisors 0028/0029.

9. **Deployed to production; canonical project is `homa`.** Sidney bought
   **thankshoma.com** and attached it (via the dashboard) to a Vercel project
   named `homa` (team Homa) rather than the agent-created `homa-web`; both
   pointed at the same repo/rootDirectory. Consolidated on `homa`: copied the
   env vars over (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
   VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1), redeployed from main, added
   www.thankshoma.com as a 308 redirect to apex, deleted the duplicate
   `homa-web` project, relinked the local checkout. Verified on the domain:
   /, /conference, www redirect, and a waitlist POST that landed in Supabase
   (then cleaned). Nameservers were already on Vercel DNS. eve's /eve routes
   fail closed (no auth policy configured yet), which is correct until FR-1.
10. **Deliverable 0 definition-of-done status:** deployed ✓, waitlist rows
   verified in Supabase ✓, phone test ☐ (Sidney), Alessa read-aloud ☐
   (Sidney + design pass).

11. **No booth at the conference (founder correction, 2026-07-04).** Alessa
   tells moms "thankshoma.com" in conversation; there is no QR banner. So `/`
   is the primary conference capture surface (spoken-word signups arrive as
   source=organic), and `/conference` is repurposed as the link Alessa texts
   a mom mid-conversation, keeping clean source=conference attribution when a
   link can carry the path. Post-conference, conference-weekend organic rows
   can be classified in SQL at invite time. Booth-presuming copy removed from
   the page.
12. **`/conference` renamed to `/waitlist` (founder call, 2026-07-04:
   "waitlist instead of conference, let's not overcomplicate it").** One
   generic direct-to-form page, source=organic, channel attribution via utm
   params if a shared link ever carries them, plus created_at time windows.
   `/conference` 308-redirects to `/waitlist` so anything already shared
   keeps working. The `conference` value stays in the source enum for future
   use.
13. **Wireframe carries no drafted copy (founder correction, 2026-07-04).**
   The first wireframe pass drafted voice-level copy (hero, trust points,
   form microcopy, SEO metadata); founder ruled the wireframe must be
   non-opinionated. Now: voice-level copy renders as labeled
   `WireframeSlot` placeholders pointing at the copy kit (journeys/07 §5);
   headings, form labels, buttons, and validation messages use neutral
   functional text (best-practice defaults: visible labels, optional
   marking, plain error text, form-adjacent privacy note); metadata is
   neutral. The one voice sentence kept is the vetted always-true privacy
   line (entry #1). Copy kit + design pass fill the slots.

## 2026-07-04 · Blindspot pass + grilling session (finding-unknowns skill)

A full BUILD.md/planning review (blindspot pass on the plan corpus + repo-state
audit, then a one-question-at-a-time grilling interview) surfaced 9 gaps.
Decisions made, in the order asked:

1. **July 13 copy/design path:** agents draft final landing copy from the
   `journeys/07 §5` kit (variant B) and apply the homa-design v2 pass,
   replacing the wireframe slots; founder + Alessa do the read-aloud + phone
   test after. BUILD.md's Deliverable 0 DoD line corrected to drop the
   "at a booth" framing (there is no booth, per entry #11).
2. **M0-07 conference kit:** re-scoped for no-booth reality, question card +
   phone-based capture (no printed sheets), commitment ladder stops at the
   waitlist-email rung, the $29/$19 Stripe preorder rung dropped (no Stripe
   account exists yet, no booth to run a QR off). Entity/LLC filing deferred
   until it actually blocks (Stripe activation, ahead of invite #1) rather
   than done tonight. See `journeys/09 §2, §6.2` (re-scoped M0-07 spec).
3. **IC-10 vs D4 photo contradiction resolved:** `journeys/05` IC-10 ("no
   child-likeness uploads") is superseded by D4 (photo personalization ships
   day one with consent). IC-10's decline copy now applies only to the
   consent-declined path. Amended in `journeys/05` directly (the row + §4
   example 8).
4. **CI added now**, before any Phase A code: `.github/workflows/ci.yml` runs
   typecheck + build + `check:isolation` on every push/PR to `main`. Required
   secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   — both public-safe publishable values) set on the GitHub repo. Satisfies
   BUILD.md law #1 ("isolation tests green in CI always") for the first time;
   extend with the MJ-08 events-registry check once that registry covers more
   than `waitlist.joined`.
5. **M0-01 timing:** next major agent task after the copy/design pass, not
   run in parallel and not skipped. `eve` pinned to an exact version (`0.19.0`,
   was `^0.19.0`) in `apps/web/package.json` so upgrades are always a
   deliberate, logged decision; started `docs/homa-planning/eve-churn-log.md`
   to feed the eject tripwire (`12-roadmap-okrs.md` §tripwires) with real data.
6. **Email/invite bridge named explicitly:** BUILD.md's Phase B bullet list now
   names **M1-08 minimal** (Resend transactional email: welcome, journal-prompt,
   weekly-note, receipt templates + the opens/clicks/unsubscribes webhook
   bridge that `journeys/06 §7` requires for the anti-guilt ratio law) and
   **MJ-09** (waitlist read path + invite codes + invite email — today's
   waitlist is write-only with no way to invite anyone off it) — previously
   both were only implicit under FR-1/FR-3.
7. **Cost-telemetry timing (Gateway `ai-reporting-*` headers + per-key budget
   caps moved into Phase B vs staying in Phase C with FR-11): left open,
   question skipped.** BUILD.md's Phase A section gained a platform-ceilings
   summary (sandbox region/rate/snapshot limits, Workflow event/step caps,
   function duration) so the next agent designing M0-01/M0-03 sees them, but
   the FR-11/T2 telemetry sequencing itself was not changed.
8. **Resend domain live:** `mail.thankshoma.com` verified in Resend (DKIM, SPF
   MX+TXT, DMARC, tracking CNAME all green; click+open tracking on per
   `journeys/06 §7`'s explicit opens/clicks webhook requirement; inbound
   receiving deliberately left off — `journeys/02` line 890 defers
   reply-to-email to POST-GA, v1 is deep-link-to-chat only).
   `RESEND_API_KEY` is in `apps/web/.env.local` (gitignored) and in Vercel
   production env (added via CLI, type Sensitive).

## 2026-07-04 · Deliverable 0 copy + design pass (grilling decision Q1)

Replaced the wireframe's placeholder slots with final copy and the homa-design
v2 visual system, closing the loop the grilling session opened.

1. **Copy**: hero is variant B verbatim from `journeys/07 §5` ("Know exactly
   where your child stands. Without ever testing them."). How-it-works,
   trust, and paperwork bands pull from pillars A/B/C one-liners. Trust point
   #3 uses the vetted honest claim from entry #1 ("we'll publish our full
   privacy policy before the first family joins"), not the gated "never
   trains AI" line. Waitlist band uses "Founding families" framing per
   BUILD.md's hard constraint (no pricing, T2). CTA stays functional ("Join
   the waitlist") rather than the kit's more evocative "Meet your child's
   map" — no product exists yet for that CTA to honestly lead to.
2. **Design**: homa-design v2 tokens (colors, radius, shadows, fonts) copied
   into `apps/web/app/globals.css` and wired through Tailwind v4's
   `@theme inline`, so classes like `bg-brand`, `text-strong`, `rounded-pill`
   work directly. Fonts (Newsreader, Hanken Grotesk, Caveat, JetBrains Mono)
   load via `next/font/google` instead of the design system's raw `@import`,
   for self-hosting and zero layout shift. `Logo` component ported from
   `docs/homa-design/components/brand/Logo.jsx`. This is a hand-copied
   subset, not the formal `packages/design` workspace package; M1-17 still
   owns porting the full component library.
3. **Verification**: typecheck + production build green; rendered and
   screenshotted at desktop and mobile (390px) widths via Playwright for
   both `/` and `/waitlist` — readable, on-brand, touch-friendly. Founder
   phone test + Alessa read-aloud (build-log #10's two remaining DoD boxes)
   are next.
4. Deleted `wireframe-slot.tsx` (no slots remain, per its own comment).

## 2026-07-04 · M0-01 GO/NO-GO criteria written (not yet run)

Per the council re-scope's requirement ("GO/NO-GO criteria written BEFORE
starting"), wrote `docs/homa-planning/m0-01-adversarial-prototype-gate.md`
covering the five adversarial tests from `03-backlog.md` (eve upgrade drill,
deploy+rollback mid-run, dispatcher kill mid-fan-out, HITL-parked rotation,
100-family fan-out), each with a concrete pass/fail bar, plus: a strict
2-session/≤2-day timebox distinct from BUILD.md's no-calendar-estimates
roadmap stance, a contained-blast-radius environment plan (Vercel preview
branch, real homa-prod schema with tagged+cleaned-up synthetic rows, never
production), and a verdict rule (any leakage/data-loss/stuck-state = NO-GO
regardless of the other four; eject to M0-02 on failure). BUILD.md now links
it. **The spike itself has not been run yet** — this session only produced
the criteria, per the gate's own requirement that they exist first.

## 2026-07-04 · M0-01 test (a) run: NO-GO

Ran the eve upgrade drill (test a of `m0-01-adversarial-prototype-gate.md`)
locally, isolated on a throwaway `spike/m0-01` branch (deleted after, no code
diff to keep — this was a pure test, nothing to merge). Parked a session in
HITL under eve 0.18.2, bumped to 0.19.0 (today's `latest`; no newer version
exists to test a true forward upgrade), and tried to resume it.

**Result: reproducible failure.** The parked session's event log corrupts on
replay (`CorruptedEventLogError`, 3 failed recovery attempts, confirmed on
retry), and the resume API silently opens a fresh, memoryless session instead
of erroring, `{"ok": true}` with no indication anything went wrong. The
original question and its answer are permanently lost. Likely cause: a
patch-level (not flagged breaking) change to how 0.19.0 records tool-call
results in the durable workflow log. Full evidence in `eve-churn-log.md`;
gate writeup in `m0-01-adversarial-prototype-gate.md`.

**Per the gate's own verdict rule, this single failure is enough: NO-GO.**
Tests (b)–(e) were not run — the verdict doesn't change once (a) fails this
decisively, and they remain available for a custom-harness retest later.
**This is now an open decision for Sidney**, not resolved here: eject to
M0-02 (custom harness) per the rule as written, treat it as a narrower
operational risk (drain HITL-parked sessions before every upgrade) and
re-test, or report upstream and wait for a fix. Phase B work should not
proceed on eve, as-is, until this is decided.

## 2026-07-04 · Mitigations for the M0-01 finding (fix without diverging)

Asked "what would fix this without diverging too much" after the NO-GO.
Built three things, all in our own code/process, none touching eve
internals:

1. `apps/web/lib/harness/resume-session.ts` — narrow seed of M1-14. Every
   resume of an eve session must go through this. It doesn't trust eve's
   synchronous `ok: true` alone (the finding showed that's not confirmation);
   it watches the event stream for a real new turn or an explicit failure
   before calling a resume successful, and throws a typed error otherwise.
   Verified against the live bug: 2/2 correctly caught the real corruption,
   1/1 correctly passed a healthy same-version control (no false positive).
2. `scripts/eve-upgrade-check.mjs` — automates the exact repro against any
   candidate version pair. Verified: correctly passes a same-version no-op,
   correctly fails the known-bad 0.18.2→0.19.0 pair (twice).
3. `docs/homa-planning/runbooks/eve-version-bump.md` — the procedure: read
   the changelog for tool/replay/workflow language, run the script, check
   for live parked sessions (stubbed until M1-02), deploy, smoke-test, log
   the outcome in `eve-churn-log.md` either way.

This does not resolve the open decision (eject to M0-02 vs. stay on eve with
these mitigations vs. report upstream and wait) — that's still Sidney's call.
It does mean Phase B is no longer flatly blocked: BUILD.md now says
"mitigated, not resolved" instead of "blocked."

## 2026-07-05 (later) · Test (b) retested for real: "let's test on real Vercel builds"

Resolved the local-vs-production caveat on the deploy/rollback finding.
Deployed two separate real Vercel previews (fixing a genuine gap along the
way: no `.vercelignore` existed, so a local `vercel deploy` tried to upload
the multi-gigabyte `homa-research/`/`homa-macmini/` folders and failed —
added `.vercelignore` mirroring `.gitignore`'s exclusions). Started a
session on the first deployment, let it complete, deployed the second, sent
a follow-up to the second deployment's URL using the first's session and
token.

**Result: clean pass.** The second deployment correctly resumed the exact
session with real context intact (recalled a secret code from the first
turn). This is strong evidence the earlier "stuck forever" finding was a
limitation specific to `eve dev`'s local disk-backed workflow world, not a
production-relevant risk — Vercel Workflow (the managed service actual
production uses) handles cross-deployment continuity correctly.

Still open, narrower: this tests session portability across deployments,
not literal mid-step crash recovery, which is much harder to replicate
against real Vercel infra (deploys take far longer than a model turn, and a
preview-to-preview deploy doesn't tear down the first one). De-risked, not
fully closed. Full detail: `eve-churn-log.md`,
`m0-01-adversarial-prototype-gate.md`.

Also: enabled Vercel's Protection Bypass for Automation on the project
(`vercel project protection enable --protection-bypass`) to make this kind
of preview-deployment testing possible; documented the mechanism for reuse.
Cleaned up both throwaway preview deployments and the test branch after.

## 2026-07-05 · Founder decision: stay on eve; spike continued

Sidney: "stay and continue." Resolved the open M0-01 decision — not
ejecting to M0-02, staying on eve with the mitigations from 2026-07-04.
Continued the spike since committing to eve means the other adversarial
tests should actually be checked against it:

- **Adapted test (e)** (concurrent sessions, no schedule dispatcher exists
  yet to test the original version): 12 concurrent synthetic-tenant
  sessions, zero cross-session leakage, confirmed twice. Clean pass on the
  single most safety-critical property.
- **Test (b)** (deploy + rollback mid-turn): failed, reproducibly, across
  three variants (hard kill, graceful stop, explicit nudge) — a step killed
  between start and completion never resumes, with zero server-side error
  logged. **Important caveat**: this is against the local dev workflow
  world, not real Vercel Workflow, which the docs describe as a different,
  managed durability substrate. Needs a Vercel-preview retest before being
  trusted as production-relevant. Logged in full in `eve-churn-log.md` and
  `m0-01-adversarial-prototype-gate.md`.
- Tests (c) and (d) stay deferred — they need a schedule dispatcher and a
  session-rotation state machine that don't exist yet (M3-10/M1-02, M1-15).
  Not skipped, just correctly sequenced.
- Relocated `resume-session.ts` from `apps/web/agent/harness/` to
  `apps/web/lib/harness/` — the old path is an eve-discovered directory
  convention and eve's discovery warned on it; the module is app code
  calling eve's API, not an eve capability.

Phase B is clear to start with the mitigations in place and the deploy/
rollback finding tracked as an open risk, not a blocker.

## 2026-07-05 · Playable MVP: auth → family → child → chat → worksheet

Founder asked "can we get an mvp shipped so i can start playing with it" —
built the trimmed walking-skeleton slice end to end, real code not hacks:

1. **Auth (minimal M1-01):** Supabase Auth email/password via @supabase/ssr.
   `lib/supabase/{server,client}.ts` helpers, `proxy.ts` (Next 16's renamed
   middleware) refreshes sessions per request and gates /home + /chat with
   `getClaims()` (JWT-verified, not spoofable). /signin page with a
   founding-family gate: signup requires the invite code in
   `HOMA_SIGNUP_CODE` (set in Vercel prod env; unset locally = open signup
   for dev). MJ-09's real invite codes replace this.
2. **Family creation (migration #6):** `create_my_family()` RPC — an
   authenticated user with no membership creates exactly one family
   atomically; the one-family rule lives in the function body. RLS advisor
   warning is intentional (documented in the migration).
3. **Child intake (minimal M2-03i):** /home shows create-family → add-child
   → children list; children write to `children.profile` jsonb (interests,
   focus) under the existing "members add children" RLS policy.
4. **eve auth (FR-1 slice):** `agent/channels/eve.ts` custom AuthFn — chat
   sends the caller's Supabase access token as a bearer (resolved fresh per
   request by useEveAgent), the channel verifies it via `auth.getUser()`,
   resolves familyId under the caller's OWN RLS, and stamps
   `{ principalId: userId, attributes: { familyId, supabaseAccessToken } }`.
   The raw token in attributes is server-custody state, never model-visible,
   refreshed per turn; M1-02's SET LOCAL pattern replaces it.
5. **Agent tools (first two):** `get_children` (reads the family's kids +
   profiles as the caller — RLS is the wall inside tools too, no service
   key exists in the app) and `create_worksheet` (schema-validates the
   worksheet the model composes; the UI renders it as a printable card).
   `lib/agent-db.ts` is the shared caller-scoped DB helper. Instructions
   updated: call get_children at conversation start, worksheet composition
   rules, voice laws.
6. **Chat UI (trimmed M1-04):** /chat with useEveAgent, on-brand bubbles,
   suggestion chips, worksheet card with a print button (browser print
   dialog → paper/PDF; v0 of MJ-01). shadcn integration stays with M1-04
   proper.

**Verified end to end with Playwright against the real stack** (Next dev +
eve dev + homa-prod Supabase + real model calls): unauthenticated /chat
bounces to /signin; sign in lands on /home; create family; add child (Maya,
5, dinosaurs+drawing, letter sounds); chat "make Maya a worksheet" →
get_children + create_worksheet tool calls → on-brand printable "Maya's
Dino Letter Sounds" card with 5 themed exercises. Test rows deleted from
homa-prod after. Typecheck, production build, and isolation checks green.

Known deferrals: voice, photo personalization, conversation persistence
(chat history resets on reload — eve session is durable server-side but the
UI doesn't rehydrate it yet), real invite codes (MJ-09), the reportlab/fal
worksheet pipeline (M0-03/M2-05 — current output is text-exercise layouts),
proper session-tracking table.

## 2026-07-05 · Fixes: signup dead-ended, chat history lost on reload

Two real defects in the MVP slice, both found and fixed:

1. **Signup dead-ended.** The project has email confirmation ON, so the
   first real signup returned no session and parked on a confirmation email
   (default Supabase mailer, not our Resend, rate-limited/spammy). Also the
   app-layer HOMA_SIGNUP_CODE check was bypassable by calling the Supabase
   auth API directly with the publishable key. **Fix (migration #7):** a
   `before insert` trigger on auth.users enforces the invite code (from
   `private.settings`, not exposed over the Data API) at the database
   boundary and auto-confirms the account when the code matches, so
   password sign-in works immediately with no email round-trip. The signup
   action now passes the code in user metadata and signs in right after;
   the trigger's 500 rejection is translated to a friendly "invite code
   isn't right" message. Invite code required in the UI now.
2. **Chat history vanished on reload.** The chat didn't persist the eve
   session cursor, so every reload silently started a fresh, memoryless
   conversation. **Fix:** wired eve's documented resumable-sessions pattern
   into chat-client.tsx — initialEvents/initialSession from localStorage
   (keyed per user id), snapshot saved onFinish. Added a "New chat" button
   to deliberately start fresh. /chat is now a server component that resolves
   the user id for the storage key.

Verified end to end with Playwright against the real stack: UI signup with
the code confirms and lands on /home (no email), wrong code shows the
friendly error, family+child setup works, chat knows the child; a hard
reload restores the transcript AND a follow-up resumes the SAME durable
session (POSTs to /eve/v1/session/{id}, and Homa correctly recalled a
secret word set before the reload — real continuity, not just restored
pixels). All test users deleted from homa-prod after (0 users remain).
Typecheck, build, lints green.

Note the deferred item is now smaller: chat history persists client-side
(localStorage); the Postgres conversations table (cross-device history,
M1-02) is still the future proper version.

## 2026-07-05 · Open signup (founder decision: "as easy as possible, no hoops")

Founder chose fully open signup over the invite-only gate. This reverses the
PRD's "public signup (invite codes only)" non-goal and the founding-families
framing — a deliberate founder call, logged here as the auditable override.

- **Migration #8:** dropped the invite-enforcing trigger + `private.settings`
  code store from migration #7; replaced with a plain `autoconfirm_new_user`
  trigger that confirms every new account at creation. So signup is email +
  password with an immediate session and no email round-trip, regardless of
  the project's email-confirmation setting.
- **Signup action:** removed the invite-code handling; plain signUp +
  signInWithPassword.
- **Signup form:** removed the invite-code field.
- **Vercel:** removed the now-unused `HOMA_SIGNUP_CODE` production env var.

On email confirmation itself: the project-level setting can't be toggled with
the tools available here (no admin/management token; the MCP is DB-scoped).
The auto-confirm trigger makes it moot for signup either way. If the founder
turns off "Confirm email" in the dashboard (Authentication → Sign In /
Providers → Email), the trigger becomes redundant and can be dropped.

Verified: raw-API signup with no code returns a confirmed session; full UI
flow (signup with just email+password → family → child → chat) passes E2E.
Test users deleted from homa-prod (0 remain). Typecheck, build, lints green.

## File additions this session

- `supabase/migrations/20260704033725_waitlist_and_events.sql`: waitlist +
  events tables, write-only RLS for public traffic.
- `supabase/migrations/20260704033742_tenancy_v0.sql`: families,
  family_members, children + deny-by-default RLS + `is_family_member()`.
- `supabase/migrations/20260704033812_function_grant_hygiene.sql`: EXECUTE
  grant hygiene per security advisors.
- `packages/core/src/waitlist.ts`: waitlist submission schema + age bands +
  sources (shared by form, API, future invite service).
- `packages/core/src/events.ts`: typed event registry (MJ-08) + `emitEvent()`.
- `packages/core/src/us-states.ts`: US state list for the form.
- `apps/web/app/page.tsx`: landing page (hero variant B, efficacy lead; final
  copy + homa-design v2 styling as of the copy/design pass above).
- `apps/web/components/brand/Logo.tsx`: brand lockup, ported from
  `docs/homa-design/components/brand/Logo.jsx`.
- `apps/web/app/conference/page.tsx`: QR conference variant (`/conference`).
- `apps/web/app/api/waitlist/route.ts`: validated capture endpoint; duplicate
  email = success (idempotent retries).
- `apps/web/components/waitlist-form.tsx`: optimistic form, offline queue.
- `apps/web/components/wireframe-slot.tsx`: labeled placeholder primitives
  for undecided copy/media (deleted when the copy kit lands).
- `apps/web/lib/waitlist-client.ts`: timeout + retry + localStorage queue +
  online-event flush (bad conference wifi survival).
- `scripts/isolation-check.mjs`: anon-key isolation smoke checks (M1-07 seed);
  run with `pnpm check:isolation`.
- `.github/workflows/ci.yml`: typecheck + build + isolation check on every
  push/PR to `main` (see entry #14 above).
- `docs/homa-planning/eve-churn-log.md`: dated log of eve version bumps and
  breaking changes, feeding the eject tripwire.
- `docs/homa-planning/m0-01-adversarial-prototype-gate.md`: GO/NO-GO criteria
  for the M0-01 spike, written before the spike runs.
- `apps/web/lib/harness/resume-session.ts`: resume-identity + forward-
  progress guard (M1-14 seed), mitigating the M0-01 finding. Lives in
  `lib/`, not `agent/` — it calls eve's API, it isn't an eve capability.
- `scripts/eve-upgrade-check.mjs`: automated pre-bump regression check for
  any eve version change.
- `docs/homa-planning/runbooks/eve-version-bump.md`: the procedure for
  bumping the pinned eve version safely.
