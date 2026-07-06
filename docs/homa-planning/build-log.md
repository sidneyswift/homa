# Build log — decisions agents made alone

Per BUILD.md: anything an agent was forced to decide without a founder ruling is
logged here so decisions stay auditable. Newest entries first.

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
