# 03: Retention & Monetization Journeys

> Historical journey and acceptance-source snapshot, last updated 2026-07-02.
> The reconciled PRD retains R2's three weekly-note examples as a dated tone
> source for FR-8, subject to current copy and efficacy laws. Billing branches,
> prices, plan names, provider state, annual timing, child caps, and open
> questions are historical. Current tier naming is Homa Plus; live Stripe state
> is unverified here. D9 permits unlimited children on every plan.

> Status: PLANNING. Workstream 3 of 5 (see `00-pm-kickoff.md`). Covers the daily/weekly
> habit loops, the month curve and homeschool seasonality, trial→paid, low-balance/top-up,
> churn/win-back, and the power-user shift. Methods applied: journey-map, churn-reduction,
> power-user-shift, feedback-loop (pm-os). Last updated 2026-07-02.
>
> **Inputs honored:** 00-product-brief §value stack (the efficacy loop IS the renewal
> argument), 08-billing-credits-design (grace buffer, opt-in auto top-up, trial =
> promotional credits with no card, Payment Link for cohort one), 09-council-synthesis
> (open call #2 covered in both branches below), docs/homa-design/readme §brand foundation
> (anti-guilt law, reassurance-first data, "a lighter day is still a good day").
>
> **Pricing branch key** (open call #2 is Sidney's; both branches designed here):
> - **Branch A, visible credits:** the mom sees a credit meter, per-action prices, packs.
> - **Branch B, flat fair-use:** flat plans, no customer-facing meter; internal
>   `action_costs` ledger and margin law unchanged; only genuinely expensive items
>   (picture books) surface as labeled premium.
> - **Recommendation: Branch B.** Reasoning in R4. Everything in R5 is written for both.
>
> Cross-references: 02-acquisition-activation.md (workstream 2) owns discover→wow→week 1;
> this doc picks up at the first full day of habitual use. 04-feature-journeys.md owns the
> deep feature mechanics (worksheets, voice, benchmarks); 05-edge-cases-failures.md owns
> the failure catalog. J2/J5/J6 in `02-user-journeys.md` are superseded by R1/R2/R4–R6 here.

---

## R1: The daily loop (the habit engine)

### Frame

- **Personas:** P5 (Jess) primary for friction design, P2 (Rachel) for chaos design,
  P1 (Alessa archetype) for depth design. P3 and P4 inherit the same loop with different
  anxieties (P3 needs reassurance density, P4 needs the hours line visible).
- **Trigger:** the day starting (whatever "morning" means for her, see time-of-day realism).
- **Job story:** *When a homeschool day is about to start and my head is already full,
  I want Homa to tell me what we should do today and hand me the materials, so I can
  spend my bandwidth teaching instead of planning.*
- **Entry channel:** web app (PWA on phone home screen), last night's journal email
  deep link, or web push. No SMS in v1.

The loop has four beats: **morning ask → materials → ambient voice capture → evening
journal prompt.** The design law: each beat must be independently skippable without
breaking the others. A day where she only sends one voice note is a successful day.

### Time-of-day realism per persona

| Persona | When "morning" is | The loop as she actually runs it |
|---|---|---|
| **P5 Jess** | 7:35pm the night before, or Saturday 8am | She plans tomorrow tonight. Homa learns this within 2 weeks (schedule inference from usage timestamps) and shifts her "what should we do today?" surface to an evening "here's tomorrow, want the PDF now?" Her journal prompt lands at 8:45pm, after the kids are down, never at 5pm mid-meeting. Weekend batch: Saturday morning she generates the week's materials in one 15-minute sitting. |
| **P2 Rachel** | 6:15am, before three kids wake | One coffee, one phone session. Homa's morning surface must be a *single screen*: today for the 4yo, today for the 7yo, an honest line for the 10yo ("I can't make her materials yet, but I've got her hours and her reading log"). Batch-print everything in one tap (three PDFs merge to one print job). Everything after 8am is interruption-driven: half-finished threads must resume without scolding or re-asking. |
| **P1 Alessa** | 8:30am proper, but the real usage is all day | Morning ask is a ritual she enjoys. The signature behavior is 5–8 pocket voice notes a day ("she counted to 40 in the car!"). Each needs a sub-second path: open app → hold mic → talk → done. The confirmation chip ("Logged · nudges counting confidence up") is the dopamine; it must render within seconds even if profile processing is async. |

### Stage table

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional arc | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| Morning ask | App home / push "Good morning ☀️" | Opens app, reads today's 2–3 suggestions, picks or edits | Proposes activities keyed to each child's profile position + interests + what-works; offers printable if relevant; respects her stated schedule (co-op Tuesdays = lighter list) | 2–4 min | overwhelmed → oriented | Suggestions feel generic (kills trust in the profile); too many options; wrong child focus | Suggestion references yesterday's voice note ("since she loved the penguin book…"), proof it listens |
| Materials | Chat, artifact card, phone print dialog | Taps "make it," prints or screens it | Generates within the turn (M0-03 latency budget <2 min), saves to library, asks nothing extra | 1–3 min | oriented → equipped | Print failure on mobile Safari; PDF layout broken on Letter; generation latency >2 min feels broken | The artifact visibly matches the kid (name, current interest, right difficulty) |
| Ambient capture | Mic button, share sheet | Voice notes as moments happen; sometimes photos of finished work | Transcribes, routes to journal/hours/profile/memory, shows confirmation chip naming the child + the skill it nudged | 10–30 sec × N | proud → *witnessed* | Transcription fails silently; wrong child attributed (two kids mentioned); chip jargon ("subdomain 4.2 updated" = death) | "Logged. That moves Ella's counting confidence up." The system visibly gets smarter, in her words not ours |
| Evening journal | Email/push → one-tap into chat | Replies in one sentence or one voice note, or skips | Asks ONE question, pre-warmed by the day's captures ("sounds like counting was the win today, anything else stick out?"); routes reply to journal/hours/profile | 1–2 min | tired → *day banked* | Prompt fatigue; prompt lands mid-bedtime chaos; feels like homework for mom | Prompt already knows the day (references her voice notes) so replying feels like finishing a sentence, not filing a report |

### Where the habit anchors, what breaks it, re-anchoring mechanics

**Anchors (in order of strength):**
1. **The evening journal prompt**, it arrives (proactive, earned per product principle 2),
   so it is the metronome. Anchored to *her* actual wind-down time, learned from reply
   timestamps within 2 weeks, adjustable in one tap ("send this later in the evening").
2. **The physical print moment**, paper in hand is a habit with a body. Morning ask →
   print is the strongest daily pairing for P2; weekly batch-print for P5.
3. **The pride reflex**, the kid does something → she reaches for the mic. This is the
   deepest anchor because the trigger is the child, not the app. Everything about voice
   capture optimizes for < 5 seconds from impulse to done.

**What breaks it:** sick week (whole family, no school happens), co-op/field-trip days
(no materials needed), printer death, prompt fatigue (answering starts feeling like a
chore around week 2–3), a bad generation (materials miss the kid twice in a row = trust
drop), vacation, and, most dangerous, **a guilt event** (any surface that implies she's
falling behind ends the relationship; she has Instagram for that).

**Re-anchoring mechanics (all [GA] unless noted):**
- **Skip-if-unanswered rule** (ported from Mac Mini, M2-07): an unanswered journal prompt
  is never followed up. Tomorrow's prompt is fresh, with zero reference to the gap.
- **Adaptive cadence:** 3 unanswered prompts in 7 days → drop to 3×/week automatically,
  silently. She can re-raise it in settings. Never announce the downgrade (announcing it
  is guilt with extra steps).
- **Return greeting law:** after any quiet gap, the first surface says nothing about the
  gap. Not "welcome back!", not "it's been a while." Just today: "Good morning ☀️ Want
  something light for today?" The gap is not a thing that happened, product-wise.
- **The lighter-day path:** morning ask always includes a low-effort option ("a reading
  day: 20 minutes on the couch with these two books counts"). Permission is a feature.
- **Co-op/field-trip awareness:** days she marked as out-of-house get a different morning
  surface ("co-op day, I'll just keep the hours. Have fun"), presence without demand.

### The moment that decides

**The confirmation chip after a voice note.** "Logged. That moves Ella's counting
confidence up." This is the second where Homa stops being a worksheet vending machine
and becomes the thing that *sees her work*. If capture feels like filing (silent, generic,
or wrong-child), the daily loop decays to a weekly materials errand and the moat never
compounds. Abandon-twin: a voice note that fails silently on mobile Safari, she tried to
give Homa the most valuable data she has and the app dropped it.

### Instrumentation

Events: `daily.morning_ask_opened`, `daily.suggestion_accepted` (with `edited` flag),
`daily.material_generated`, `daily.material_printed_or_downloaded`,
`daily.voice_note_captured` (with `transcription_ok`, `routed_to[]`),
`daily.capture_confirmation_shown`, `daily.journal_prompt_sent`, `daily.journal_replied`
(with `latency_min`, `modality`), `daily.prompt_cadence_downgraded`,
`daily.lighter_day_selected`.

- **The metric:** **capture-days per family-week**, distinct days with ≥1 voice note or
  journal reply. This is the moat's pulse (profile freshness) and the best single
  predictor of week-8 retention (hypothesis to validate at cohort one).
- **Counter-metric:** journal reply rate measured *without* cadence downgrades masking it.
  If reply rate holds at 60% only because we silently dropped half the prompts, the habit
  is thinner than the number claims. Track `prompts_sent` alongside always.

### Edge/failure branches

1. **Voice note fails on mobile Safari** → immediate visible fallback (text box + audio
   file upload, shipped same sitting per M1-05). Never a silent drop; the chip either
   confirms or apologizes with a retry.
2. **Two kids ambiguous in one note** ("he counted to 40" with two boys) → disambiguation
   etiquette from SOUL.md port (M2-11): one short question, never a form; if she doesn't
   answer, log to family journal unattributed rather than guessing.
3. **P2's out-of-range 10-year-old** → morning surface includes her honestly every day
   (hours, reading log, "here's a library list I found"), never a blank slot. A blank
   slot next to her siblings reads as "Homa forgot my kid." (Deep mechanics: workstream 4;
   ICP call is 09 §call 3.)
4. **Generation misses the kid twice in a row** (wrong difficulty, ignored interests) →
   the 👎 on the second artifact triggers a repair turn: "I missed. Tell me one thing
   about what she's into right now and I'll redo it free." Repair-after-miss is a
   retention save, not a support ticket. (Credits refunded in Branch A; invisible in B.)
5. **Sick week** → she says "everyone has the flu" in any channel → Homa enters quiet
   mode for 7 days unprompted (no morning push, no journal prompt), one warm line on
   return path. Detected keywords route to the same mechanic as a manual "pause prompts."
6. **Printer dead** → every printable offers a no-printer variant where the format allows
   ("do it on the screen" or "grab any paper: here's the 3-line version to copy out").

### Ticket mapping (detail in R9)

M2-07 (journal), M2-05/M2-06 (materials), M2-11 (disambiguation), M1-05 (voice+fallback),
M2-13 (learning review → the chip), M3-07 (cadence rules). **NEW-TICKET R-07**
(retention event schema). Gap: schedule inference (learning her hours) has no ticket,
folded into NEW-TICKET R-08.

---

## R2: The weekly loop (the weekly note is the retention artifact)

### Frame

- **Personas:** all; written for P1/P2 depth, P3 tone-sensitivity, P4's hours line.
- **Trigger:** Saturday scoring job (M3-01) → Sunday weekly note (M3-02) → week plan offer.
- **Job story:** *When the week ends and I can't tell if any of it added up to anything,
  I want Homa to show me what actually moved and what to try next, so I can start Monday
  confident instead of guessing.*
- **Entry channel:** email (the note itself), deep-linking into the web app for the plan.
- **[M-R] reality:** cohort one gets concierge notes, Saturday scoring script +
  Sidney-reviewed sends, with the efficacy before/after hand-written from week one
  (03-backlog M-R wk 6). The template below is the spec for both the concierge writer
  and the eventual generator.

### The weekly note: exact anatomy

The note is the product's heartbeat and the renewal argument in miniature. Every note,
every week, in this order:

1. **Subject line** = the win, named. Never "Your weekly report." ("Maya's week: counting
   jumped, and she noticed too")
2. **Warm open**, one line, her name.
3. **What grew**, 2–4 bullets, strengths first, always at least one even in the quietest
   week (confidence-stable skills count: "her sight words from two weeks ago are holding
   strong"). Numbers appear here in growth framing (▲, "up 9 points"), never red, never
   "behind."
4. **The proof** (the efficacy loop, 00 §value stack), when attribution exists, one
   before/after sentence tying materials done → metric moved: *"You started the number
   hunts on the 12th. Since then her counting has moved from 'counts to 20 with help' to
   'counts to 40 in the car, unprompted.' The work is working."* This block is why she
   renews. [M-R]: hand-written. [GA]: M3-11 attribution view feeds it. When no honest
   attribution exists, the block is omitted, never faked, never correlation-overclaimed
   (progress-with-the-work framing only).
5. **One gentle next step, MAX ONE**, a single small suggestion with the material
   already attached, framed as optional ("only if the week has room"). One nudge per note
   is law (00 §reconciliation). Two nudges = a to-do list = guilt.
6. **Hours/compliance line** (P2/P4 only, when the state needs it): "16.5 hours logged
   this week · 412 of 900 for the year, right on pace." Pace framing only when she IS on
   pace; when she isn't, show the count without the target math (the dashboard has the
   detail; the note never does deficit arithmetic at her).
7. **Week plan offer**, one tap: "Next week's plan is drafted, want me to print it
   Sunday night?"
8. **Permission close.** Rotating library of honest lines, never saccharine: "You've got
   this." / "Rest counts as part of the rhythm too." / "A lighter day is still a good day."

Length law: readable in 90 seconds on a phone. If it scrolls more than 2.5 screens,
cut bullets, never the proof block.

### Three example weekly notes (brand voice, spec-quality)

> Current efficacy-law correction. These examples remain dated tone references,
> not approved factual templates. Any statement connecting work with movement
> must stay temporal and correlational. It may not claim that an activity caused
> a child's measured change.

**Note A, the good week** (P1, child "Maya")

> **Subject: Maya's week: counting jumped, and she noticed too**
>
> Hi Alessa,
>
> What a week. Here's what I saw:
>
> **What grew**
> · Counting: up 9 points since the number-hunt pages (34 → 43 in early numeracy).
>   Three weeks of car-ride counting did that.
> · She retold the penguin story in order: beginning, middle, end. That's narrative
>   sequencing clicking into place.
> · Scissor work: two clean cuts on the snowflake, steadier than last month.
>
> **The proof**
> You started the number hunts on the 12th. Since then her counting has moved from
> "counts to 20 with help" to "counts to 40 in the car, unprompted." The work is working.
>
> **One thing to try, only if the week has room**
> She's close on "before and after" with numbers. The 10-minute number-line hopscotch
> (attached) would tell us. No rush.
>
> Next week's plan is drafted, want me to print it Sunday night?
>
> You've got this,
> Homa

**Note B, the quiet week** (P5, child "Sam")

> **Subject: A quiet week, and that's fine**
>
> Hi Jess,
>
> Lighter week on the logs: three journal notes and one worksheet. I want to say this
> plainly: a lighter week is still a good week. Skills don't evaporate in seven days.
>
> **What's holding strong**
> · Sam's sight words from two weeks ago are the kind of gain that sticks.
> · His pattern-block session from the 3rd still stands as his best spatial work yet.
>
> **What I'll do**
> Nothing changes on my end. The plan holds where it is and his profile stays warm.
> When you have 60 seconds, one voice note about anything he did this week, a game,
> a conversation in the car, keeps his picture sharp. Only if it's easy.
>
> Rest counts as part of the rhythm too.
>
> Homa

**Note C, the regression week** (P3, child "Leo"), the one that must not guilt

> **Subject: Leo's week: one number moved, here's what it actually means**
>
> Hi Danielle,
>
> First, the good stuff, because there's real good stuff:
>
> **What grew**
> · Leo read you two full pages of the dinosaur reader out loud. In January he wouldn't
>   try. That's the headline of this week.
> · Handwriting: his name, no reversals, twice.
>
> **About the letter-sounds number**
> His letter-sounds score came down 4 points this week (52 → 48). Here's what that
> actually is: he mixed up b and d during Tuesday's game, which tells me that pair
> hasn't fully settled yet. Numbers wobble while skills settle in. This is how learning
> looks up close, not lost ground, and nothing about it says you're doing this wrong.
>
> **One small thing, when it fits**
> A 5-minute b/d sorting page is attached. He can do it with the dinosaur stickers he
> likes. One pass this week is plenty.
>
> He's growing. The chart just breathes a little on the way up.
>
> Homa

Regression-note laws, explicit for the generator (and the concierge writer):
strengths block ALWAYS comes first and must be real; the down-number is named honestly
(metrics lead, they don't hide) but explained as measurement sharpening or consolidation;
the words *behind, regressed, dropped, lost, falling* never appear; exactly one small
attached action; the close reframes the chart, not the mother.

### Stage table

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional arc | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| Saturday scoring | none (invisible) | nothing | Re-scores from the week's observations, decays stale confidence, computes attribution joins, drafts note ([M-R]: Sidney reviews) | 0 | - | Scoring on a thin week produces a hollow note; job failure = silent missing note (worse than a bad note) | - |
| Sunday note | Email, ~5pm local Sunday | Reads on phone (90 sec), maybe forwards to spouse (S1 Marcus) | Delivers the anatomy above | 2–5 min | uncertain → *seen and validated* | Note feels templated by week 3; proof block absent too many weeks running; wrong tone on a hard week | The note quotes HER week back to her (her voice note verbatim as evidence: "you said on Tuesday: 'she counted to 40 in the car'") |
| Next-step accept | One tap in note → chat | Accepts the one nudge, or ignores it (fine) | Attaches material, adds to Monday's morning ask, tracks the intervention lifecycle (M3-03 folded into note) | 30 sec | validated → equipped | Nudge feels like homework; un-actioned nudges pile up visibly anywhere = guilt ledger | Accepted nudge shows up Monday morning already printed into the plan |
| Week plan | One tap → plan view/PDF | Confirms or lightens the drafted week | Drafts from profile position + her schedule + accepted nudge; offers "lighter version" toggle always | 2–4 min | equipped → *Monday-ready* | Plan over-programs (five subjects a day for a 4yo reads as judgment); ignores co-op days | "Lighter version" one-tap is permission built into the artifact |

### The moment that decides

**Opening the Sunday note and finding her own week reflected back with evidence.**
The aha is *"Homa was paying attention all week, and it added up to something."* The
abandon-twin is the hollow note: a thin week + a templated note with no proof block and
a generic nudge tells her the magic is a mail-merge. One hollow note is survivable;
two consecutive is a churn signal we instrument directly (`weekly.note_hollow` flag when
a note ships with no proof block and <2 real observations behind it).

### Instrumentation

Events: `weekly.scoring_completed` (per family, with `observation_count`),
`weekly.note_sent`, `weekly.note_opened`, `weekly.note_dwell_sec`,
`weekly.proof_block_present`, `weekly.note_hollow`, `weekly.next_step_accepted`,
`weekly.plan_confirmed` (with `lightened` flag), `efficacy.before_after_shown`,
`weekly.note_forwarded` (proxy: unique open device/geo spread).

- **The metric:** **weekly-note action rate**, % of delivered notes that produce ≥1
  action within 72h (open + next-step accept OR plan confirm OR any chat/capture).
  This is the strongest hypothesized leading indicator of renewal.
- **Counter-metric:** note opens alone (Apple Mail privacy inflates opens; an "opened,
  never acted" pattern rising means the note is becoming wallpaper, track
  `opened_no_action_2wk` as an explicit churn-risk flag, not a success stat).

### Edge/failure branches

1. **Scoring job fails for a family** → the note NEVER silently skips. Fallback note ships
   without scores (journal-quote recap + plan offer) and ops gets the alert (M3-10,
   J7 fleet doctor). A missing Sunday note breaks the metronome.
2. **Zero observations all week** → Note B pattern (quiet week). Never "we didn't see
   much this week" as an accusation; confidence-stable skills fill the grew-block.
3. **The week's only movement is downward** → Note C pattern; if there is genuinely no
   strengths material, pull from the archive ("his best reading session ever is still
   the 14th, and that hasn't gone anywhere"), always true, never invented.
4. **She replies to the note email** → it routes into chat as a first-class turn (the
   note is a conversation, not a newsletter). [M-R]: routes to Sidney's inbox.
5. **Multi-child families** → one note, sectioned per child, each child gets a grew-block;
   nudge budget is still ONE for the whole note, rotating focus child weekly. P2's
   out-of-range 10yo gets an hours/reading line inside the family note, never omitted.
6. **P4 quarterly boundary week** → the note gains one line: "Your Q2 report is ready to
   generate whenever you want it, everything's already in there", the compliance
   moment surfaced by the retention artifact (cross-ref workstream 4, M3-06).

### Ticket mapping (detail in R9)

M3-01, M3-02, M3-11 (proof block), M3-03 (folded into note per M-R), M2-10 (plan),
M1-08 (email), M3-06 (P4 line). **NEW-TICKET R-08** covers note personalization infra
(her-voice quoting, schedule inference). [M-R]: concierge process doc = the note anatomy
above.

---

## R3: The month curve and homeschool seasonality

### Frame

- **Personas:** all; curve annotated where persona-specific.
- **Job story:** *When the novelty wears off and the school year grinds (or stops), I want
  Homa to keep proving it's carrying weight, so paying for it stays an obvious yes.*
- This journey is the retention strategy viewed as a timeline. Stages are weeks/months,
  not minutes.

### Stage table (the curve)

| Stage | When | What's happening for her | What Homa does | Emotional state | Friction/churn risk | The save |
|---|---|---|---|---|---|---|
| Honeymoon | Days 1–10 | Onboarding drip (M2-03: 3 questions/day), first wow artifacts, first weekly note | Delivers wow, builds profile via drip | curious → hopeful | Drip feels like a form in disguise | Drip graduation moment: day ~7, "Maya's profile is filled in. Here's what I can see now" + first full-strength morning ask |
| **Week 2 dip** | Days 10–17 | Drip ends (structure disappears), novelty fades, prompts start feeling routine, trial decision looms | Second weekly note MUST carry a first mini-proof (even small: "two weeks of journal notes just taught me she learns best with her hands") | hopeful → wobbling | The product goes quiet right when the drip ends; conversion ask lands in the wobble | The week-2 note is the single highest-leverage artifact in the lifecycle; see R4 for the conversion anchor |
| **Week 4: "is this worth it?"** | Days 24–34 | First paid renewal approaching (converted ~day 12–14); she audits: what did I actually get? | 4th weekly note = **month-in-review edition**: the month's before/afters in one view, materials count, hours banked, one line of trajectory ("her curve since you started") | wobbling → convinced (or gone) | Hollow month = churn; renewal receipt arrives BEFORE the month recap = billing leads value | Month-recap note ships 2–3 days BEFORE the renewal date, always. Receipt references it ("this month: 14 worksheets, counting up 9") |
| Month 2–3: compounding | Weeks 5–12 | Rhythm set; she stops evaluating and starts relying | Trajectory lines get real slope; retired interventions show outcomes; what-works library visibly steers materials | convinced → invested | Plateau weeks; repetitive nudges; P2's planning load returns if multi-child support is thin | Month-3 note names the compounding explicitly: "Three months in, here's Maya's arc" with the day-1 profile vs today |
| Month 6: the pile | Weeks 13–26 | The records ARE the asset (council: the durable moat is the accumulating family record) | Hours toward state target, portfolio index, journal archive, what-works, surfaced as HER pile, exportable always | invested → anchored | Complacency reads as staleness if surfaces don't evolve | P4's one-tap quarterly report from the pile = the evangelism moment; P1 goes power-user (R7) |
| **Summer cliff** | June–August | Homeschool stops or goes feral. Usage drops 60–90%. She questions paying for a dormant tool | **Summer mode** (see below) | anchored → dormant-but-warm | Full-price bills against zero usage = cancellation of trust, not just plan | Pause/summer-mode offer arrives BEFORE she has to ask (early June), framed as normal: "most families go lighter now" |
| **September re-enrollment** | Late Aug–September | The homeschool new year: planning energy, curriculum buying ($300–800/yr), fresh guilt about starting strong | Win-back + re-onboarding: profile picks up where May left off, drafts week one of the new year, annual offer lands HERE | dormant → re-committed | Competitors and curriculum boxes are courting her at the same moment | "I can draft her first week from where she was in May, one tap." Nobody else has May. |

### Seasonality strategy: pause vs annual vs summer mode

The June–August cliff is structural (homeschool follows the school year even for
year-rounders' intensity). Three tools, used together, not as alternatives:

| Option | What it is | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Summer mode** | Same plan, product shifts value: discover-heavy (M3-12: zoo, library programs, rainy-day), light activity drops 2×/week instead of daily, journal prompt weekly not nightly, hours still logged (year-round states need summer hours) | Keeps revenue and the habit's pilot light on; the connector layer is genuinely summer-shaped; no billing mechanics needed | Some families still see a bill vs low usage; content investment | **Default.** Auto-offered early June: "Want me to switch to summer rhythm?" |
| **Pause plan** | Self-serve pause up to 3 months, $0, records safe, read-only dashboard, one-tap resume | Preserves trust exactly when cancellation impulse peaks; a paused family in June is a September return waiting to happen; kills the "I'm paying for nothing" Facebook post before it's typed | Forgone summer revenue; [M-R] Payment Link has no self-serve pause (Sidney pauses manually in Stripe, fine at n≤50) | **Always offered**, second position, in the summer-mode prompt AND the cancel flow (R6) |
| **Annual plan** | 12 months for the price of 10 (e.g., $290/yr) | Solves summer churn by pre-commitment; matches the school-year psychology and the curriculum-budget mental model (she buys curriculum annually) | At first conversion (day ~12) it's too much ask for an anxious first-time buyer; annual + visible credits compounds confusion in Branch A | **Offered at September and at month-3+**, never at first conversion. [POST-GA] |

**Recommended posture:** summer mode default-offered + frictionless pause always available
+ annual introduced at the September moment. Measure September return rate as its own KPI
(R8) rather than letting summer distort core churn.

### The moment that decides

**The week-4 month-in-review note.** It is the answer to "is this worth $29?" delivered
before she asks it, days before the renewal charge. If the first month can't show one
honest before/after plus a countable pile (materials, hours, journal days), the renewal
is a coin flip. [M-R]: this is why the concierge notes hand-write the efficacy line from
week one, cohort one's month curve IS the retention experiment.

### Instrumentation

Events: `curve.drip_graduated`, `curve.month_recap_sent/opened`, `curve.renewal_upcoming`
(join: recap sent before receipt?), `season.summer_mode_offered/accepted`,
`season.pause_started/resumed`, `season.september_winback_sent/returned`,
`curve.month3_arc_shown`, `curve.records_milestone` (hours banked, portfolio items).

- **The metric:** **W8 retention** (defined precisely in R8) and **September return rate**
  (% of June-active families active again by Oct 1, counting paused + summer-mode).
- **Counter-metric:** summer revenue retained via families who *forgot to pause*,
  if that number is material, we grew it with dark-pattern inertia, not value. We
  proactively offer the pause; this metric audits that we actually did.

### Edge/failure branches

1. **Year-round homeschooler** → summer-mode offer is dismissible with "we school
   year-round" → never offered again, flag on family, full cadence continues.
2. **She pauses in November** (burnout, not season) → same mechanics, no season framing:
   "Take the time you need. Everything holds." Re-engagement per R6, not September-gated.
3. **Paused family's card expires during pause** → nothing charges, so nothing dunns;
   on resume attempt, card update is step one of resume flow, framed forward ("pick up
   where you left off") not as a debt.
4. **Southern-hemisphere / non-US calendar** → seasonality engine keys off her stated
   schedule from onboarding, not the calendar constant. v1 is US-first but the flag
   must exist in the schema day one.
5. **Month-recap lands during a family crisis quiet period** (R1 edge 5) → recap defers
   until quiet mode lifts; renewal proceeds (she's paused prompts, not the service);
   if quiet >21 days, the R6 ladder takes over.

### Ticket mapping (detail in R9)

M3-12 (discover = summer-mode engine), M2-10, M3-01/02. **NEW-TICKET R-04** (summer
mode + pause mechanics), **NEW-TICKET R-05** (September win-back), **NEW-TICKET R-03**
(month-recap note edition + recap-before-receipt sequencing).

---

## R4: Trial → paid (the conversion journey)

### Frame

- **Personas:** P5 converts on "it makes the plan so I don't have to"; P2 on price-vs-
  planning-hours math; P1 on the efficacy proof; P3 needs the most reassurance that
  she's not signing up for another thing to fail at; P4 converts on the first generated
  report artifact.
- **Trigger:** trial value events accumulating; the anchor is **after the 2nd weekly note**.
- **Job story:** *When my trial is ending and I've seen what two weeks builds, I want to
  understand exactly what I'm paying for and what happens to what we made, so I can say
  yes without feeling tricked or say no without losing everything.*
- **Trial economics (08 §council revision):** trial = promotional credits, **no card**,
  hard stop at zero during trial. Weekly loops (scoring, notes) are plan-included, so
  they run free during trial, the trial is bounded by *generation* spend, not by the
  retention artifacts. [M-R]: cohort one = invite codes + Stripe Payment Link $29/mo;
  the "conversion screen" is an email from Sidney with the link. Same anchoring rules.

### The conversion moment: anchored to value, never to the calendar alone

The ask fires at whichever comes FIRST after the 2nd weekly note is delivered and opened:
(a) her next materials request, (b) trial credits crossing ~15%, or (c) day 13 of 14.
Never fire the full-screen ask mid-generation, never before the 2nd note exists, and
never within 24h of a regression-week note (tone collision: "your kid wobbled, pay us"
is exactly the vibe the anti-guilt law exists to kill).

Sequence:
1. **Soft signal** (from ~day 8 / 50% credits): a quiet meter or line in settings and
   after big generations. Branch A: "Trial credits: 140 left." Branch B: "Trial: 6 days
   left." No banners, no countdowns on the home surface.
2. **The ask** (the anchor above): full conversion screen, once. Dismissible.
3. **Trial end, no conversion:** the account enters **keepsake state** (below), read-only
   dashboard + export, no generation, no prompts except two emails (day 0 and day 21).

### The conversion screen (both branches)

**Shared recap block (top of screen, both branches)**, her pile, counted, hers:

> **Keep everything you've built**
> In 12 days, you and Homa made 9 worksheets, logged 14 journal moments, banked 11
> hours, and mapped Maya across 15 skill areas. Two weekly notes showed her counting
> climb. It compounds from here.

**Branch A, visible credits:**

> **Homa · $29/mo**
> 1,500 credits included monthly, enough for daily chat, about 15 worksheets, journal
> and voice capture, weekly notes with progress proof, hours tracking. Up to 2 children.
>
> **Homa Plus · $49/mo**
> 3,500 credits monthly: heavier making, picture books included. Up to 4 children.
>
> What credits buy: a worksheet is about 40 · a coloring page 20 · a picture book 330.
> Weekly notes and scoring never cost credits.
> Run low? Nothing ever stops mid-worksheet. Top up only if you choose to.
>
> [Start with Homa] [Start with Plus]
> No contracts. Export your records anytime, they're yours. Cancel or pause in two taps.

**Branch B, flat fair-use (recommended):**

> **Homa · $29/mo**
> Materials every day, journal and voice capture, weekly notes with progress proof,
> hours tracking. Up to 2 children. Make what your week needs.
>
> **Homa Plus · $49/mo**
> Everything in Homa for up to 4 children, plus picture books and premium illustrated
> sets included.
>
> [Start with Homa] [Start with Plus]
> No contracts. Export your records anytime, they're yours. Cancel or pause in two taps.

(Branch B fine print, linked not inlined: fair-use policy in plain language; picture
books labeled "premium · included in Plus, $3.30 each on Homa" at point of use.)

### If she doesn't convert: keepsake state (retention-respectful, honest about the pile)

Design law: **no hostage vibes, full honesty about what she's walking away from.**
The pile is hers; the compounding is ours. Concretely:

- Dashboard: read-only, indefinitely viewable for 90 days (J6 retention window), then
  deletion per policy (M4-04/05) with a heads-up email at day 75.
- Export: one tap, free, always, no signup-wall re-entry trick (markdown+JSON+PDF, M4-05).
- What stops: generation, prompts, scoring, notes. What she keeps: everything made so far.
- Exactly two emails, then silence:

**Day 0 email:**

> **Subject: Your trial ended, your records didn't**
>
> Hi Rachel,
> Your trial wrapped up today. No pressure and no tricks, here's exactly where things
> stand:
> · Everything you built is safe: 9 worksheets, Ella's profile, your journal, 11 hours.
> · You can read your dashboard and export all of it, free, for the next 90 days.
> · If you come back before then, it picks up right where you left off, nothing re-done.
> If Homa wasn't the right fit this season, that's okay. If it was the price, reply and
> tell me, a person reads these.
> [Download my records] [Keep going, $29/mo]

**Day 21 email:** one line + the strongest artifact from her trial (her best before/after
or her kid's best worksheet) re-attached. "This is still here, and still true." Then
nothing until day-75 deletion notice.

### The branch recommendation (feeds open call #2)

**Recommend Branch B: flat fair-use plans, internal ledger unchanged.** Reasoning:

1. **The meter taxes the habit that builds the moat.** The daily materials loop is the
   profile's food supply. A visible per-worksheet price makes P2 (price-sensitive, three
   kids) ration exactly that behavior, the council's product reviewer already showed
   the advertised use case (~2,400 credits/mo for two kids) structurally exceeds Basic's
   1,500. Under Branch A the flagship promise ("materials daily") is either a lie or a
   guaranteed top-up treadmill; a treadmill for this audience becomes a Facebook-group
   screenshot.
2. **A credit meter is a second anxiety meter.** The brand's entire job is reducing "am
   I doing enough?" A depleting balance next to her child's name imports spend-guilt
   into a product whose law is anti-guilt. Branch A UX can be softened but never neutral.
3. **The margin law survives intact.** Branch B keeps `action_costs`, the ledger, per-
   action COGS, CI enforcement, and the monthly margin review (M1-12/13), invisible
   accounting, visible honesty. Expensive items (picture books) surface as clearly
   labeled premium, which moms understand from every craft-supply purchase.
4. **Simpler conversion screen, simpler renewal argument.** "$29 for all of this" vs
   teaching a credit economy at the exact moment of purchase anxiety.
5. **Reversibility.** Branch B → A later is adding a meter (feature); A → B is a repricing
   apology. Start B.

Cost containment without the visible meter: fair-use soft ceiling at ~2× plan sizing,
enforced first by a friendly rate conversation ("you're one of my busiest families,
love it. Quick heads-up: at this pace, picture books are the only thing I'll ask about
separately") and by the two backstops already designed (per-session token limits, Gateway
budget caps). True outlier abuse is an ops conversation, not a paywall.

### The moment that decides

**The recap block on the conversion screen.** She converts when the pile is countable
and the proof is hers ("counting climbed 9 points *and I watched it happen*"). She
bounces when the screen leads with plan mechanics instead of her two weeks. Corollary:
a trial that never produced a 2nd weekly note (signed up, went quiet) should get a
**win-the-trial-back** touch at day 10 (one email, one great artifact offer), not a
conversion ask, converting a family with no habit buys a month-1 churn statistic.

### Instrumentation

Events: `trial.started` (with `credits_granted`), `trial.credits_50pct/85pct`,
`trial.second_note_delivered/opened`, `conversion.ask_shown` (with `trigger`),
`conversion.ask_dismissed`, `conversion.plan_selected`, `conversion.completed`,
`trial.expired_no_convert`, `keepsake.entered`, `keepsake.export_downloaded`,
`keepsake.day21_sent`, `keepsake.reactivated`, `trial.stalled` (no activity 72h+).

- **The metric:** trial→paid conversion, **segmented by "2nd note opened" (yes/no)**,
  the whole thesis is that the delta between those segments is enormous; if it isn't,
  the anchor is wrong.
- **Counter-metric:** month-1 post-conversion churn. High conversion + high m1 churn =
  we pressured wobblers over the line (the ask fired too early or too loud).

### Edge/failure branches

1. **Trial credits gone by day 4** (P2, enthusiastic, multi-kid) → weekly loops continue
   free (plan-included), generation stops with honesty: "You've used your trial's making
   budget, and honestly, that enthusiasm is the best signal Homa fits. Sunday's note
   still comes free. Want to start your plan now and keep making?" Early-exhaustion
   converts get their remaining trial days appended free. ❓ trial sizing, see open
   questions.
2. **She converts on day 2** (impulse) → allowed, celebrated, and the onboarding drip
   continues unchanged, conversion must not skip profile-building.
3. **Payment fails at conversion** (card typo, not dunning) → inline retry, no state
   change, no email. First-purchase failure gets zero dunning machinery.
4. **She returns at day 80 of keepsake** → full resume, profile confidence decayed
   honestly ("her picture's a little faded after the summer, one week of notes sharpens
   it right back").
5. **She returns at day 100** (post-deletion) → we tell the truth: records were deleted
   per the policy she was notified of; fresh start offered warmly, no fake recovery.
6. **[M-R] Payment Link edge:** link is sharable → invite-code check must gate account
   creation, not just the link (03-backlog M-R wk 6).

### Ticket mapping (detail in R9)

M1-06, M1-12 (trial promotional credits, grace machinery), M1-13, M4-05 (export),
M4-04 (retention policy). **NEW-TICKET R-01** (trial lifecycle UX: soft meter, conversion
screen, keepsake state, day-0/21/75 emails). [M-R]: Payment Link + manual keepsake.

---

## R5: Low balance & top-up (both branches)

### Frame

- **Personas:** all paid; P2 most price-sensitive (decline path matters most), P1 heaviest
  generator (hits ceilings first).
- **Trigger:** balance approaching zero mid-usage (Branch A), premium item or fair-use
  ceiling (Branch B), or a failed charge (both).
- **Job story:** *When I hit a money moment inside a tool my kid's education runs on,
  I want it handled like a grown-up conversation, so I never feel nickeled, blocked,
  or ashamed.*
- Governing design (08 + 09 §V1): **grace buffer, never block; auto top-up is explicit
  opt-in; instant notification + refund window; global kill switch.** [GA], cohort one
  has no ledger (Payment Link + manual watching).

### Branch A: visible credits

**Stage table:**

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional arc | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| Low balance | Quiet meter in settings; agent aware via dynamic context | Usually nothing; maybe asks "how many credits do I have?" | Answers naturally when asked ("about 120, a worksheet is 40"); NEVER nags proactively mid-conversation | - | neutral | Any proactive nag converts the assistant into a cashier | Agent fluency: "that picture book would use most of your remaining credits this month, want the coloring-page version instead?" only when ASKED |
| Grace-buffer moment | Post-action card in chat | Finishes her worksheet (always) | Action completes; balance goes modestly negative; THEN one card: see copy below | 10 sec | flow → mild admin | Card interrupting before delivery = broken promise; stacked cards from burst usage | The artifact arrives first, money talk second, always |
| One-tap top-up | Same card | Taps once (card on file from subscription) | Adds pack instantly, receipt by email, back to silence | 5 sec | admin → done | Anything more than one tap; upsell attach ("add MORE and save!") is banned | "Done. 500 credits added, receipt's in your email." Nothing else |
| Auto top-up opt-in | Own consent screen, offered at FIRST grace moment only | Reads, opts in or declines | Consent screen per copy below; declining = never re-prompted (settings-only thereafter) | 30 sec | admin → sorted forever | Re-prompting after decline = nag; bundling consent into any other yes = ROSCA violation | Opted-in families get pure silence + instant receipts + 7-day one-tap refund |

**Grace-buffer moment copy (post-action card):**

> That worksheet used your last credits, and it's yours either way, nothing pauses
> mid-make. Want to top up?
> [Add 500 credits · $6]  [Not now]

**Auto top-up consent screen copy (un-bundled, own screen, per 09 §V1):**

> **Never interrupt me**
> If your credits run low, Homa adds a pack automatically so nothing ever pauses.
> Here's exactly how it works:
> · Adds: 500 credits ($6), charged to your card on file
> · When: balance drops below 100
> · Monthly cap: $18 (3 packs). Change or turn off anytime in settings.
> · Every top-up: instant email receipt with a one-tap refund, good for 7 days.
>
> [Turn on auto top-up]   [No thanks, ask me each time]
> Either way, nothing ever stops mid-worksheet.

**Auto top-up receipt (instant, every time):**

> Subject: Added 500 credits ($6), tap here if you didn't want that
> Auto top-up just ran: 500 credits, $6, card ending 4242. Monthly total so far: $6 of
> your $18 cap. Didn't mean to? [Refund this, one tap] · [Adjust auto top-up]

### Branch B: flat fair-use

The everyday low-balance journey **does not exist**, that's the point. Two money
surfaces remain:

1. **Labeled premium at point of use** (picture books on the $29 plan): "A full picture
   book is a premium make: $3.30, or included on Plus. Want it, or want the story-page
   version (included)?" Charge rides the subscription invoice; no wallet concept.
2. **Fair-use ceiling conversation** (rare, ~2× plan sizing, agent-delivered, warm):
   "Quick heads-up, you're one of my busiest families this month, which I love. At this
   pace I may slow big illustrated sets until the 1st. Regular worksheets, notes, and
   everything daily keep going as always." Never a hard stop on core loop actions;
   backstops (token limits, Gateway caps) guard the true pathological case.

### The decline / dead-card path (dunning that doesn't shame)

Applies to subscription renewals and (Branch A) top-up charges. Laws: **retry silently
first, name the problem like a friend would, never threaten, value keeps flowing during
grace, and the child's data is never leverage.**

| Day | What happens | Copy (email; in-app is a quiet settings badge, never a banner over the child's dashboard) |
|---|---|---|
| 0 | Charge fails → silent smart retry (Stripe) within 24h. Auto top-up (if on) suspends silently; grace buffer keeps working | none |
| 1 | Retry failed → email #1 | **Subject: Quick card hiccup, nothing is paused** · "Hi Monica, your card didn't go through today. It happens, cards expire and banks get twitchy. Nothing has stopped: Leo's profile, this week's materials, and Sunday's note are all running as normal. When you have a minute: [Update card]. We'll retry on our own in a couple of days either way." |
| 4 | Retry 2 fails → email #2 | **Subject: Still no luck with the card** · "Tried again, no luck. Everything's still running, including Saturday's scoring. One tap fixes it: [Update card]. If money's tight this month, reply to this, we can figure something out, a person reads these." |
| 10 | Retry 3 fails → email #3, the honest one | **Subject: What happens Friday (and what doesn't)** · "One more heads-up. If the card isn't updated by Friday, I'll pause new materials and prompts. Here's what does NOT happen: Leo's records, hours, and profile stay safe and readable, nothing is deleted, and one tap brings everything back exactly as it was. [Update card]" |
| 14 | → **keepsake state** (same as R4: read-only + export). Subscription canceled in Stripe; win-back ladder (R6) takes over at its gentlest setting | none beyond keepsake norms |

The agent's rule (08): never mentions billing unless asked or a typed `payment_needed`
result exists, in which case: "Looks like the card needs a quick update before I can
make new things, here's the link. Everything we've made is safe." One sentence, then
back to being useful with what's already made.

### The moment that decides

**The first grace-buffer moment.** The artifact completing BEFORE any money talk is the
whole trust design shipped in one interaction. Handled right, it's also the single
best-converting instant for auto top-up opt-in (she just experienced why "never
interrupt me" is worth having). Handled wrong (block, nag, or a surprise charge), it's
the screenshot in the co-op Facebook group, the security reviewer's chargeback scenario
starts here.

### Instrumentation

Events: `billing.grace_buffer_entered` (balance at entry), `billing.topup_prompt_shown/
accepted/declined`, `billing.auto_topup_consent_shown/optin/declined`,
`billing.auto_topup_charged` (+ `billing.auto_topup_refund_tapped`),
`billing.premium_item_offered/accepted/downgraded` (Branch B),
`billing.fairuse_conversation_sent` (Branch B), `billing.charge_failed` (attempt #),
`billing.card_updated`, `billing.dunning_email_sent` (#), `billing.keepsake_from_dunning`.

- **The metric:** involuntary-churn recovery rate (% of failed-charge families with a
  successful charge within 14 days). Target >60%; card failure should be the most
  fixable churn we have.
- **Counter-metrics:** auto top-up refund-tap rate (>5% = consent screen isn't landing);
  top-up-prompt decline-then-churn correlation (Branch A rationing signal, feeds open
  call #2 with real data); any support ticket tagged `billing-surprise` (target: zero).

### Edge/failure branches

1. **Burst usage races the grace buffer** (three worksheets queued at low balance) →
   advisory-lock singleflight (M1-12) means at most one top-up prompt/charge; all three
   actions complete; one card summarizes.
2. **Auto top-up hits the monthly cap** → silent switch to manual prompts + one email:
   "You hit your $18 auto top-up cap for the month (you set that, smart). I'll ask
   normally till the 1st. Raise it in settings if you want."
3. **Refund tapped after credits partially spent** → refund the pack price in full,
   claw back only unspent credits, eat the difference. The refund promise is absolute
   or it's not a promise (clawback mechanics per M1-06 webhooks).
4. **Disputed charge** → per 08: clawback via webhook + auto top-up disabled for the
   family + Sidney alerted. Never auto-retry a disputed instrument.
5. **She asks the agent "why did you charge me $6?"** → the agent can read the ledger:
   names the pack, date, what it was spent on, links refund. Billing questions answered
   in-chat like a competent human would, not "contact support."
6. **Global kill switch flipped** (08) → all off-session charging halts fleet-wide;
   grace buffers extend; UX degrades to manual prompts only; families notice nothing
   except nothing being charged.

### Ticket mapping (detail in R9)

M1-12 (ledger, grace, opt-in, locks, kill switch), M1-06 (Stripe suite, portal, smart
retries), M1-13 (pricing registry), M1-08 (emails). **NEW-TICKET R-02** (dunning
sequence content + keepsake handoff + recovery deep link).

---

## R6: Churn & win-back

### Frame

- **Personas:** P3 churns from overwhelm (silently), P2 from price, P5 from friction,
  P4 from a single trust break (wrong legal claim = instant), P1 rarely churns but goes
  quiet in February like everyone. The February burnout and the summer cliff are the
  two seasonal churn concentrations; they need different treatment (R3 owns summer).
- **Job story (hers, even while leaving):** *When homeschool or money or life gets heavy
  and I step back, I want the tools in my life to make room instead of clinging, so the
  ones that respected me are the ones I come back to.*
- **Churn-reduction analysis (method applied):** pre-launch we have no churn data; the
  design below doubles as the data-collection instrument. Hypothesized churn drivers,
  ranked: (1) life/season overwhelm, silent (largest, mostly *pause-able* not lost);
  (2) price/value doubt at renewal moments (fixable by R3's recap-before-receipt);
  (3) trust break (bad generation, guilt event, billing surprise, preventable, fatal);
  (4) kid aged out / out-of-range (honest goodbye, referral still possible);
  (5) card failure (R5's involuntary path, most recoverable).

### Quiet-family detection ladder (7/14/30-day)

"Quiet" = zero core actions (message, voice note, material, journal reply) AND no weekly
note action. Note opens alone don't reset the clock (Apple MPP). Detection runs on the
fleet-doctor cadence (M4-01, [M-R]: Sidney's morning console).

| Threshold | Signal read | Response | Law |
|---|---|---|---|
| 7 days quiet | A heavy week, a trip, a sick kid. NORMAL homeschool texture | **Nothing user-facing.** Ops counter only. The weekly note ships as usual (it's the metronome, and Note B "quiet week" pattern exists for exactly this) | Reacting at 7 days is surveillance, not care |
| 14 days quiet | A stall, possibly burnout (February pattern), possibly product fell out of rotation | **One value-forward touch, zero absence language.** Not "we miss you", not "come back", not a streak. Deliver a thing: a ready-made artifact keyed to the child's last known position + explicit permission. See copy below. Journal prompts drop to weekly automatically (R1 cadence rule) | The touch must be worth opening on its own merits. If we have nothing to GIVE, we don't send |
| 30 days quiet | Disengaged (or paused-in-spirit without telling us) | **One honest structural offer:** pause. "Want me to hold everything for a while, $0, and keep the records warm? One tap to pause, one tap to resume whenever." Weekly notes stop after this (sending scored notes into a void eventually reads as invoices for a service she's ghosting) | Offering pause BEFORE she has to find the cancel button is the trust play; a paused family churns at a fraction of a canceled one (validate at cohort one) |

**14-day touch copy (the February email, the anti-"we miss you"):**

> **Subject: Made you something for a slow week**
>
> Hi Jess, no check-in needed and nothing to catch up on. I made one thing in case it
> helps: a 15-minute pattern game for Sam, keyed to where he was a couple of weeks ago.
> No printer needed, it's a floor game.
> February is the long hallway of the homeschool year. Lighter weeks count, and rest
> counts too.
> [The game's here if you want it]

Never in any re-engagement surface: streak language, "you haven't logged in," "Sam's
profile is getting stale" (true internally, guilt externally), countdowns, or the
child's regression as bait. The anti-guilt law binds hardest exactly here, where growth
teams traditionally cheat.

### Cancel flow

Reachable in two taps from settings (we promised at conversion). Steps:

1. **The two honest options screen** (pause offered BEFORE cancel, especially May–June):
   > **Before you go, two honest options**
   > **Pause instead?** Up to 3 months, $0. Everything stays exactly as it is: Ella's
   > profile, your hours, all of it. One tap brings it back. (Most families pause for
   > summer.)
   > **Cancel now.** Also fine. You'll keep read access for 90 days and you can export
   > everything, free, forever yours.
   > [Pause my plan] [Cancel my plan]
   No third option, no retention-offer carousel, no "are you sure" chain. One screen.
2. **Exit survey** (on cancel, optional, skippable, max 15 seconds): one chip question,
   "What's the biggest reason?" [Price / Not using it enough / My kids' ages / Taking a
   break, might return / Missing something I needed / Something felt off] + one optional
   text field: *"Did anything about Homa ever make you feel judged, or behind? Be blunt,
   this is the one we most need to hear."* (That question is the counter-metric goldmine;
   a single yes outranks ten feature requests.)
3. **Export offer, front and center** (not buried post-cancel): "Take your records with
   you" [Download everything], fires M4-05 bundle immediately, no email-gate.
4. **Confirmation:** effective end-of-period (no clawing back paid days), 90-day
   read-only window stated plainly, deletion date named. One receipt email. Silence
   except the win-back ladder below.

### Win-back

- **September (the big one, NEW-TICKET R-05):** one email to everyone dormant since
  spring, paused, canceled, and expired-keepsake (within retention window), segmented
  only by which records line is true:

  > **Subject: Ready when you are (no rush)**
  > Hi Rachel, September has a way of arriving fast. Ella's profile, your 62 logged
  > hours, and last spring's portfolio are exactly where you left them. If you're
  > planning the new year, I can draft her first week from where she was in May, one
  > tap. If this year looks different, that's okay too. Want your records anyway?
  > They're yours, free.
  > [Draft our first week] [Download my records]

  The asset nobody else has is May. Curriculum boxes sell her a fresh start; Homa sells
  her a *continuation*. Annual plan (R3) is offered on the reactivation screen, not in
  this email (one ask per surface).
- **Non-seasonal win-back:** canceled families get exactly ONE more touch, 60 days out,
  only if we shipped something that answers their exit-survey reason ("you said the
  10-year-old was out of range. That changed."). No reason on file or nothing shipped =
  no email. Absence of spam is the brand.
- **Trust-break churners (P4's wrong-legal-claim class):** no automated win-back at all.
  Human apology from Sidney or nothing.

### The moment that decides

**The pause offer landing before she reaches for cancel.** A family that pauses keeps
the pile, the September hook, and the trust. The abandon-twin is any re-engagement touch
that smells like a growth hack, this audience screenshots, and the co-op friend (S3)
is watching. One "we miss you!! 😢" to a burnt-out February mom costs more than the
40 families it statistically reactivates elsewhere.

### Instrumentation

Events: `churn.quiet_7d/14d/30d` (family flags), `churn.value_touch_sent/opened/acted`,
`churn.pause_offered/accepted` (with `source`: quiet-ladder | cancel-flow | summer),
`churn.cancel_started/completed`, `churn.exit_survey_submitted` (chips + guilt-flag
boolean), `churn.export_at_cancel`, `winback.september_sent/reactivated`,
`winback.reason_shipped_sent`, `pause.resumed` (with `days_paused`).

- **The metric:** **saves rate** = (pauses accepted + 14-day-touch reactivations) /
  (those + cancels), monthly. And pause→resume rate at 90 days.
- **Counter-metrics:** the **guilt flag** from exit surveys (any "yes, I felt judged" is
  a sev-1 on the brand, reviewed weekly, [M-R]: by Sidney personally); unsubscribe rate
  on re-engagement emails (>2% = the touches aren't valuable enough to send); pause
  abuse pattern (serial pause/resume gaming, expected ~nil, verify before adding rules).

### Edge/failure branches

1. **She cancels mid-billing-period then returns day 20** → still in period: one-tap
   un-cancel, nothing was lost, celebrate quietly, no "welcome back!" ceremony.
2. **Quiet family is quiet because of a life crisis** (divorce, illness, support learns
   of it) → manual family flag: all automated touches stop indefinitely; human-only
   contact. The ladder must have a human override switch per family (M1-11 per-family
   kill switch covers this).
3. **She cancels but keeps opening weekly-note archive in keepsake** → strong September
   candidate; flag for the win-back segment, do NOT touch earlier, reading the archive
   is her choice, reacting to it is surveillance.
4. **Exit survey says "price" from a P2** → win-back email 60 days later may carry a
   genuine offer (e.g., extended pause or a lighter plan if one exists by then), but
   only if a real lighter option shipped. No fake "special discount just for you" (it
   poisons every full-price payer in her co-op).
5. **Kid ages out of range** → honest goodbye flow: export + "when the range grows,
   you'll be the first to know" (M5-06 waitlist tag) + referral still offered ("know a
   mom with littles?"), the one churn type where a referral ask at exit is appropriate.
6. **Deletion at day 90 while a September win-back is queued** → suppression check:
   deletion always wins; never send "your records are waiting" after they aren't.
   (Outbox uniqueness + suppression list, M3-10 pattern.)

### Ticket mapping (detail in R9)

M3-07 (re-scope: this ladder IS the spec), M4-01 (quiet detection), M4-05 (export),
M1-11 (per-family overrides). **NEW-TICKET R-03** (cancel flow + pause + exit survey),
**NEW-TICKET R-04** (pause billing mechanics), **NEW-TICKET R-05** (September win-back).

---

## R7: Power-user shift & the referral moment

### Frame

- **Personas:** P1 is the archetype (the origin user IS the month-6 power user); P4
  becomes a power user through compliance depth; P5 through automation depth ("Homa
  runs my whole week"). Method: power-user-shift (current use case → target use case).
- **Current use case (month 1):** worksheet vending + journal + weekly note. 3–4 credits-
  meaningful actions/week.
- **Target use case (month 6):** Homa as the family's operating layer, multi-format
  materials daily, curriculum ingestion, discover outings weekly, hours running
  ambiently, the weekly note as the family's Sunday ritual.
- **Job story:** *When Homa has proven it knows my kid, I want to hand it more of the
  job (the curriculum, the outings, the records), so the whole homeschool, not just the
  worksheets, runs calmer.*

### What P1 looks like at month 6 (the target state, concretely)

- **Materials:** multi-format by default, decodable readers + sentence pyramids +
  a monthly picture book starring the kid's obsession (M2-06); she requests by outcome
  ("something for b/d confusion") not by format.
- **Curriculum ingestion (M2-12):** she photographs pages of the curriculum she bought
  anyway; Homa slots them into the week and generates the practice layer around them.
  This is the shift from "Homa makes extras" to "Homa runs the plan."
- **Discover weekly (M3-12):** the Saturday outing comes from Homa ("space week → the
  Air & Space Museum, Saturday 10am is quiet") and she's stopped double-checking it.
- **Voice notes:** 6–10/day, includes delegation ("remind me Tuesday to re-try the
  scissors"), Marcus (S1) sends 1–2/week from his own account.
- **The pile:** 200+ artifacts, 60+ hours banked, a portfolio she's shown her evaluator
  (P4 variant) or her skeptical co-op friend (S3, the demo that converts the town).

### The shift ladder (transition strategy)

Each rung is offered only after the prior behavior exists (earned proactivity,
product principle 2). Never a feature tour; always a next-rung nudge inside a moment
of demonstrated value, max one rung per month per family:

| Rung | Trigger (behavioral) | The offer (in-voice) | Ticket |
|---|---|---|---|
| 1. Format breadth | 10+ worksheets of same format | "Want me to turn this week's words into a little decodable reader instead? Same words, more fun to hold" | M2-06 |
| 2. Week delegation | 3 consecutive week-plans accepted with edits <20% | "I can just have next week ready every Sunday without asking. Stop me anytime" | M2-10 |
| 3. Curriculum ingestion | She mentions a curriculum by name in chat/journal | "Snap a photo of this week's pages and I'll build the practice around them" | M2-12 |
| 4. Discover ritual | 2 accepted outing suggestions | "Want a Saturday idea every week? I'll keep it to one, tied to what she's learning" | M3-12 |
| 5. Second adult | Marcus mentioned 3+ times in journal | "Want to give Marcus his own way to send me notes? His observations count too" | M5 (account sharing, NEW-TICKET R-06 flags the gap) |

### The referral moment

**When:** immediately after an **efficacy proof moment**, she just viewed a before/after
(weekly note proof block tapped, or the dashboard's impact view), OR she just exported/
shared an artifact of pride (the quarterly report generated, the picture book downloaded).
Behavioral definition: `efficacy.before_after_shown` followed by a positive action within
the session.

**Never:** within 7 days of ANY billing event (charge, top-up, dunning email, renewal
receipt), suppression is enforced in the event pipeline, not left to campaign hygiene.
Never during a regression-week, never in re-engagement or dunning surfaces, never in the
cancel flow (except edge 5 in R6).

**How (in-voice card, dismissible, at most once per quarter per family):**

> That climb is real, and you're the one who did the work. If you know a mom who'd want
> this kind of proof for her kids, I'd love to meet her: a month of Homa, on us, from you.
> [Share an invite] [Maybe later]

**Mechanics:** [M-R] this is literally invite codes (the gated cohort's growth channel,
each family gets 2 codes; scarcity is honest, we're capacity-limited). [GA/POST-GA]
productized referral: give-a-month (recipient) + get-a-month (referrer, credited at
recipient's first paid renewal, rewarding retained referrals, not signups). Branch A
could pay in credits, but give-a-month reads cleaner in both branches and doesn't
entangle open call #2. The share artifact is a **redacted proof card**, the before/after
chart with the child's name replaced by first initial, in the brand's social template
(docs/homa-design/social/), because the *proof* is the word-of-mouth artifact (00 §value
stack), not a coupon code.

### The moment that decides

**The first time she hands Homa a rung and it holds.** Power users are made when
delegation survives contact: the auto-drafted Sunday plan is right without edits, the
ingested curriculum comes back as a better week. Each held rung roughly doubles the
switching cost; by rung 3 the family record + the trained what-works is functionally
irreplaceable (the council's sharpened moat: the accumulating record, engine included).

### Instrumentation

Events: `power.rung_offered/accepted/declined` (rung #), `power.format_breadth`
(distinct formats/month), `power.week_autopilot_on`, `power.curriculum_ingested`,
`power.discover_ritual_on`, `referral.moment_eligible`, `referral.card_shown/shared`,
`referral.invite_redeemed`, `referral.referred_family_converted/retained_m2`.

- **The metric:** % of month-3+ families at rung ≥2 ("delegators"), and referral
  conversion per proof-moment card shown.
- **Counter-metrics:** rung-offer decline rate >50% at any rung = we're pitching, not
  earning; referred-family month-2 retention vs organic (referrals that don't stick
  mean we're incentivizing the wrong moment).

### Edge/failure branches

1. **Rung declined** → 90-day suppression on that rung; behavior re-earns the offer.
2. **Autopilot week is wrong** (rung 2 fails) → instant graceful fall-back: "I'll go
   back to asking first" + the repair turn from R1 edge 4. One bad autopilot week
   handled well builds MORE trust than none.
3. **Referral card shown during an unnoticed billing overlap** (webhook lag) →
   suppression check runs at render time against the ledger, not send time.
4. **She shares the proof card publicly** (Facebook group) → the redacted card is
   designed for exactly this; includes no PII beyond her own name, links a landing
   page (M4-07), never auto-posts.
5. **Invite redeemed by an out-of-ICP family** (kids 9+) → honest range messaging at
   signup (09 call #3 mechanics, workstream 2); referrer's reward still honored (her
   goodwill isn't hostage to our ICP).

### Ticket mapping (detail in R9)

M2-06/10/12, M3-11/12, M4-07, M5-09 adjacency. **NEW-TICKET R-06** (referral loop +
proof card + suppression rules + second-adult account gap).

---

## R8: Instrumentation: the retention metric tree

### What "active" means for a homeschool mom (definitions for THIS product)

Homeschool is a weekly-rhythm life with daily texture and a seasonal calendar. DAU is
the wrong lens; a mom who prints Monday, voice-notes Wednesday, and reads the Sunday
note is a HEALTHY user at 3 "active days." Definitions:

- **Core action:** message sent, voice note captured, material generated OR
  printed/downloaded, journal reply, week-plan confirm, or weekly-note next-step accept.
  (Email opens and dashboard views alone are **ambient**, not core, MPP-inflated and
  intent-free.)
- **Active family (week):** ≥1 core action in the ISO week. **Engaged family (week):**
  core actions on ≥3 distinct days (the habit signature).
- **D7 retention:** % of activated families (workstream 2's activation definition:
  wow delivered + ≥1 core action post-onboarding) with ≥1 core action in days 5–9.
  Window, not day, homeschool weeks are lumpy.
- **D30 retention:** ≥1 core action in days 26–34 AND weekly notes not muted.
- **W8 retention (the number that decides the business):** % of activated families
  active (≥1 core action) in ISO week 8 after activation. Eight weeks = two month-
  recaps + one full billing renewal survived, past the week-2 dip and the week-4 audit.
- **Seasonality law:** all retention cohorts are annotated with school-year month.
  June–Aug quiet does NOT count against W8/D30 for cohorts that entered summer mode or
  paused; those families move to the **September return rate** denominator instead
  (% of June-active back to active by Oct 1). Un-annotated churn math will lie every
  summer and flatter every September; build the annotation into the cohort tables from
  row one.

### The metric tree

```
NORTH STAR: Proof-Delivered Families / month
  (families whose weekly note contained a real efficacy block AND produced ≥1 action)
  = the renewal argument, measured
│
├── HABIT (leading, weekly)
│   ├── capture-days per family-week (target ≥3; the moat's food supply)
│   ├── journal reply rate (target ≥40%, measured against prompts SENT)
│   ├── materials printed/downloaded per family-week (target ≥2)
│   └── weekly-note action rate (target ≥50% of delivered notes → action in 72h)
│
├── RETENTION (lagging, cohort)
│   ├── D7 (target ≥70% of activated) → D30 (≥55%) → W8 (≥40%) [validate at cohort one]
│   ├── paid month-2 retention (post first renewal)
│   ├── September return rate (seasonal cohorts)
│   └── pause→resume rate at 90 days
│
├── MONETIZATION (lagging)
│   ├── trial→paid, segmented by 2nd-note-opened (the R4 thesis test)
│   ├── involuntary-churn recovery ≥60% (R5)
│   ├── saves rate (R6: pauses + reactivations vs cancels)
│   └── net revenue retention incl. top-ups/premium (Branch-sensitive)
│
└── COUNTER-METRICS (the tree's lie detectors)
    ├── guilt flag rate from exit surveys (sev-1 at ANY occurrence)
    ├── opened-no-action 2wk streak (notes becoming wallpaper)
    ├── reply rate propped up by silent cadence downgrades (report prompts_sent)
    ├── billing-surprise tickets + auto-top-up refund taps (>5% = consent failing)
    ├── conversion up + month-1 churn up (pressured wobblers)
    └── summer revenue from forgot-to-pause families (inertia posing as retention)
```

### Feedback-loop checkpoints (cohort one → GA, per pm-os feedback-loop method)

[M-R] the "dashboard" is Sidney's morning console + a weekly spreadsheet; the discipline
is the same:

| Checkpoint | Focus | Data | Decision it feeds |
|---|---|---|---|
| Week 1 post-first-cohort | Voice capture + note delivery actually working on real phones | error logs, per-family capture counts, note opens | hotfixes; M1-05 fallback quality |
| Month 1 | Week-2 dip shape; trial→paid on the 2nd-note anchor | funnel events above, concierge-note effort per family | conversion anchor tuning; note anatomy edits |
| Month 3 | W8 for cohort one; which rungs power users climb; Branch A/B evidence (do moms ask about costs? ration?) | cohort tables, exit surveys (n will be tiny, read every word), support themes | **open call #2 decision data**; GA gate evidence (10 stranger families) |
| Month 6 | September seasonality live-fire; pause/resume; referral moment conversion | seasonal cohort annotations, win-back outcomes | annual plan go/no-go; summer-mode investment |
| Month 12 | Full-year retention curve; LTV vs the $29/$49 hypothesis | NRR, realized margin per family (M1-13 review) | pricing v2; M5 sequencing |

Every exit survey and guilt-flag response is read by a human ([M-R]: Sidney) within
48h; qualitative churn reasons get quoted verbatim (with permission) into the monthly
retro doc, the churn-reduction analysis in R6 gets re-run with real data at month 3
and its hypotheses formally scored.

---

## R9: Ticket mapping & NEW-TICKET flags

### Coverage against 03-backlog.md

| Journey | Covered by existing tickets | Notes |
|---|---|---|
| R1 daily loop | M2-05/06 (materials), M2-07 (journal), M2-11 (disambiguation), M1-05 (voice + fallback), M2-13 (learning review → confirmation chip), M2-09 (activity recs), M3-07 (cadence rules) | Chip copy/voice: M2-01 scope. Batch-print for P2: fold into M2-05 acceptance criteria |
| R2 weekly loop | M3-01 (scoring), M3-02 (note), M3-11 ⛔ (proof block), M3-03 (nudge lifecycle, folded per M-R), M2-10 (plan), M1-08 (email), M3-06 (P4 line), M3-10 (no-duplicate sends) | The note anatomy in R2 = acceptance criteria for M3-02 and the [M-R] concierge writing guide |
| R3 month curve | M3-12 (discover/summer), M2-03 (drip graduation), M3-01/02 | Month-recap edition + recap-before-receipt: gap → R-03. Summer/pause: gap → R-04. September: gap → R-05 |
| R4 trial→paid | M1-06 ⛔, M1-12 ⛔ (trial promo credits, grace), M1-13 ⛔, M4-05 (export), M4-04 (retention policy) | Conversion surface + keepsake state: gap → R-01 |
| R5 top-up/dunning | M1-12 ⛔ (grace buffer, opt-in auto top-up, locks, kill switch), M1-06 (retries, portal, clawback), M1-08 | Dunning content + keepsake handoff: gap → R-02 |
| R6 churn/win-back | M3-07 (re-scoped by R6's ladder), M4-01 (quiet detection), M4-05 (export), M1-11 (per-family overrides), M3-10 (suppression/outbox) | Cancel flow, exit survey, pause, September: gaps → R-03/04/05 |
| R7 power/referral | M2-06/10/12, M3-11/12, M4-07 (landing), M5-09 (adjacent) | Referral loop + proof card + second-adult accounts: gap → R-06 |
| R8 instrumentation | M4-03 covers ops observability only | Product analytics is unowned: gap → R-07 |

### NEW-TICKET flags

| ID | Ticket | Size | Tag | Notes |
|---|---|---|---|---|
| NEW R-01 | **Trial lifecycle UX**: quiet trial meter, conversion screen (recap block + branch-appropriate plans), keepsake read-only state, day-0/21/75 email sequence, early-exhaustion path | M | [GA] | [M-R]: Payment Link email + manual keepsake. Copy specs in R4 |
| NEW R-02 | **Dunning sequence**: smart-retry config, 4-email content per R5 table, keepsake handoff at day 14, recovery deep link, agent `payment_needed` behavior | S | [GA] | Extends M1-06; copy specs in R5 |
| NEW R-03 | **Cancel flow + month-recap edition**: two-honest-options screen, exit survey (chips + guilt-flag question), export-at-cancel, un-cancel path; month-in-review weekly-note edition + recap-before-receipt sequencing | M | [GA] | Exit survey feeds the R6 churn analysis; guilt flag is a sev-1 pipeline |
| NEW R-04 | **Summer mode + pause plan**: seasonal cadence shift (discover-heavy, weekly journal), pause billing mechanics (Stripe pause or sub schedule), read-only-during-pause, resume flow, year-round opt-out flag | M | [GA] | [M-R]: manual Stripe pause. Depends on M3-12 for content |
| NEW R-05 | **September win-back campaign**: dormant segmentation (paused/canceled/keepsake), records-line personalization, draft-first-week reactivation, deletion-suppression check, annual offer on reactivation screen | S | [GA] | First run Sept 2026 if cohort timing allows; measured as September return rate |
| NEW R-06 | **Referral loop**: proof-moment trigger + billing-adjacency suppression (event-pipeline enforced), give-a-month/get-a-month-on-retention mechanics, redacted proof card (design-system social template), second-adult account gap flagged to M5 | M | [POST-GA] | [M-R]: 2 invite codes per family, manual |
| NEW R-07 | **Retention analytics**: event schema for all `daily.* / weekly.* / trial.* / conversion.* / billing.* / churn.* / winback.* / power.* / referral.*` events, cohort tables with school-year annotation, metric-tree dashboard, counter-metric alerts | M | [GA] | [M-R]: spreadsheet discipline per R8 checkpoints |
| NEW R-08 | **Schedule inference + note personalization**: learn her real hours from usage timestamps (prompt timing, P5 evening shift), her-voice quoting in weekly notes, co-op/out-day awareness | S | [GA] | Small but load-bearing for R1 anchors and R2 delight |

---

## ❓ Open questions for Sidney

1. **❓ Open call #2 (the branch decision).** This doc recommends **Branch B (flat
   fair-use)** with the full reasoning in R4, and R8's month-3 checkpoint defines what
   cohort-one evidence would confirm or overturn it. Decision needed before M1-12/M1-13
   UI work; everything pre-GA is branch-agnostic (Payment Link).
2. **❓ Trial shape.** 08 says promotional credits (~300), no card, hard stop; J1 said
   14 days. R4 assumes both bounds with loops free during trial, but 300 credits ≈ 7
   worksheets, which P2 burns by day 4, before the 2nd weekly note (the conversion
   anchor) exists. Recommend sizing trial credits so the median 2-kid family reaches
   two weekly notes (~600–800 credits) OR making the early-exhaustion convert path
   (R4 edge 1) the explicit design. Which?
3. **❓ Basic plan = 2 kids vs P2 = 3 kids.** The median persona (P2, three kids, one
   income) can't buy the $29 plan as designed. Is Plus-at-$49 the honest P2 price, or
   does Basic become "up to 3"? (Interacts with the plan-sizing problem 08 already
   flags.)
4. **❓ Pause mechanics under Payment Link ([M-R]).** Pause = Sidney manually pausing
   subscriptions in the Stripe dashboard for cohort one, confirm you're willing to
   carry that ops load through summer 2026, since R6 offers pause prominently.
5. **❓ Annual plan pricing + timing.** R3 recommends 12-for-10 (~$290) offered at
   September and month-3+, never at first conversion. Sanity-check the number against
   the curriculum-budget anchor ($300–800/yr) before it appears anywhere.
6. **❓ Weekly note channel for cohort one.** R2 assumes email with reply-into-chat
   routing ([M-R]: replies land in your inbox). Confirm email (vs web-push-first),
   since the note is the retention artifact and its channel is load-bearing.
7. **❓ Referral reward form.** Give-a-month/get-a-month (R7) vs credit grants,
   give-a-month recommended because it's branch-agnostic and doesn't pre-empt open
   call #2. Also: comfortable rewarding the referrer only at the referred family's
   first paid renewal (anti-gaming, but slower gratification)?
8. **❓ Keepsake window vs September.** 90-day retention means a June trial expiry is
   deleted by September, right before the strongest win-back moment. Extend keepsake
   for summer-adjacent expirations to Oct 15, or accept the loss? (Interacts with the
   M4-04 retention schedule, don't special-case silently.)
9. **❓ Quiet-mode keyword detection (R1 edge 5).** Auto-entering quiet mode from "we
   all have the flu" is high-empathy but is an inference about her life. Comfortable
   shipping inference-triggered quiet mode, or should it always be offered-not-assumed
   ("want me to go quiet for the week?")? Recommend offered-not-assumed for v1.
10. **❓ Marcus (S1) accounts.** R7's rung 5 (second adult) has no ticket anywhere in
    M0–M5 except implicitly in M5-05. Cheap to include in the auth model now
    (family has N adult users), expensive to retrofit. Pull the schema part forward?
