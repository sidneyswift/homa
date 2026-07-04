# Homa Cloud — User Journeys

> Status: PLANNING. Each journey lists the happy path, the failure modes we must design
> for, and what it demands from the architecture. Persona: "Rachel," homeschool mom of
> two (5 and 8), found Homa at a conference, not technical, lives on her phone.
> Last updated 2026-07-02.

## J1 — Discover → Sign up → First "wow" (the make-or-break journey)

**Goal: from landing page to a personalized artifact in under 20 minutes, all self-serve.**

1. Rachel hits the marketing site (conference QR code). Sees: real worksheet samples, the
   dashboard, "built by a homeschool family," pricing, privacy promise.
2. Signs up (email or Google/Apple sign-in). Card required after 14-day trial — not before
   (test this; competitors are freemium).
3. **Onboarding = the first conversation with Homa** (ported BOOTSTRAP flow):
   - Phase 1 — family intake: her name, state (drives compliance rules), schedule,
     philosophy, kids' names + DOBs. Conversational, voice-friendly.
   - Phase 2 — per-child questionnaire (ported `domains.json`): explicitly framed
     "~15 min per child, we can pause anytime." Progress bar. Resumable (durable session).
   - Phase 3 — **immediate value**: Homa generates something personal on the spot
     (e.g., handwriting worksheet with the 5-year-old's favorite animal + a first
     dashboard view of both kids' profiles). This is the wow; it must be fast (<2 min)
     and printable immediately.
4. Homa explains the rhythm: "Text me here anytime. Every evening I'll ask you one
   question about the day. Saturdays I re-score. Here's your dashboard."

**Failure modes to design for:** abandons questionnaire mid-child (resume + partial
profile still useful); kid's DOB outside supported bands (2–7 in template — decide v1
age range honestly); mom answers "unknown" a lot (fine — confidence system handles it);
voice note fails on mobile Safari.

**Demands:** durable resumable onboarding session; profile writes mid-conversation;
sandbox worksheet gen inside a chat turn; per-state compliance ruleset lookup.

## J2 — Daily loop (retention engine)

1. Morning: Rachel opens Homa (or taps last night's email) — "What should we do today?"
   → Homa proposes 2–3 activities keyed to each child's profile position + interests,
   offers a printable if relevant.
2. During the day: voice notes as things happen ("Ella counted to 40 in the car!") →
   Homa logs observation → updates profile (visible confirmation: "Logged — that moves
   her counting confidence up").
3. Evening: journal prompt (email/push → one-tap into chat). One question, ported skill.
   Reply routes to: journal log, compliance/hours log, child profile, memory.
4. Rachel sees the dashboard update. The system visibly gets smarter — that's the moment
   she renews.

**Failure modes:** prompt fatigue (skip-if-unanswered rule ported from Mac Mini); two
kids mentioned ambiguously (disambiguation rule ported from SOUL.md); mom goes quiet
for a week (gentle re-engagement, never guilt).

## J3 — Make me materials (the visible daily value)

1. "Make handwriting practice for Ella, she's into horses this week."
2. Homa reads `what_works` for Ella → generates HWT-style PDF (ported generator +
   fal.ai art) → delivers in chat + saves to the family's worksheet library.
3. Rachel prints from her phone (PDF opens → iOS/Android print). V1 punts on direct
   printer integration; PDFs must be flawless on Letter paper.
4. Feedback loop: "Did she like it?" 👍/👎 in the web UI — **wired from day one**
   (it's been dead since April on the Mac Mini; in cloud it feeds `what_works`).

**Catalog (all ported):** handwriting, flash cards, coloring pages, decodable readers,
sentence pyramids, picture books, weekly plan PDF, word-of-the-week.

## J4 — Track my hours / satisfy the state (the conference-mom ask)

1. Rachel's state requires (e.g.) 900 hours + portfolio. Homa knows her state from
   onboarding; compliance ruleset sets targets.
2. Hours accrue from ambient sources: journal replies, logged activities, "we did 2
   hours of co-op" messages. Homa never makes her fill in a timesheet.
3. Dashboard shows hours-vs-target per child, per subject.
4. End of period: "Generate my state report" → assembled from logs (capture-now,
   compile-later — ported principle) → PDF download.

**V1 honesty:** ship hour-tracking + generic report for all states; deep templates
(affidavits/IHIPs) per state prioritized by customer demand (ArborSlate model).

## J5 — Weekly coaching loop (the moat, running quietly)

1. Saturday: scoring job re-scores each child from the week's observations, decays stale
   confidence, updates trajectory.
2. Sunday: Homa sends the weekly note: what moved, what's stale ("we haven't seen
   scissor work in 6 weeks — try this 10-min activity and tell me how it goes"),
   next week's plan offer.
3. Interventions ported from story-coach: propose → mom accepts → track → retire.

## J6 — Subscription lifecycle

Trial→paid conversion prompts anchored to value moments (after Nth worksheet, first weekly
report). Card fails → grace period, data retained. Cancel → immediate export offer
(markdown+JSON+PDF bundle), 90-day retention, then delete. Price changes grandfathered.

## J7 — Sidney's journey (ops as a first-class user)

1. Morning: admin console — fleet health (doctor findings), overnight cron runs, cost
   outliers, new signups, churn risk (7-day-quiet families).
2. Alert fires (family's scoring job failed 2×) → session inspector (privacy-gated) →
   ticket → Cursor agent fixes with full telemetry context.
3. Weekly: cost per family vs plan, model mix tuning, benchmark research review before
   it ships to everyone (one global library = one review, not N).

## J8 — Alessa's migration (design partner #0)

Mac Mini keeps running until cloud reaches parity on HER workflow (worksheets, journal,
dashboard, weekly plan). Then: import script (`story-profile.json` → cloud schema, journal
JSONLs → journal table, `what-works.md` → what_works). Her migration is the launch gate:
**if Alessa won't switch, it's not ready.** (Slack channel is the one thing she loses in
v1 — she is explicitly the guinea pig for whether web-chat-only retains a power user.)
