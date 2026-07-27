# 04: Feature journeys & user stories (workstream 4 of 5)

> Historical journey and acceptance-source snapshot, written 2026-07-02. The
> reconciled PRD adopts specific F1 through F4 stories for FR-4 through FR-7,
> subject to later age, consent, taxonomy, trajectory, and voice rulings. Other
> stories, tickets, routes, prices, plan names, providers, and implementation
> status are historical. Current tier naming is Homa Plus; live Stripe state is
> unverified here.

> Status: historical planning. Written 2026-07-02 against 00-pm-kickoff.md
> (template + persona cast), 00-product-brief.md (§value stack), 03-backlog.md,
> 06-harness-gap-analysis.md, 09-council-synthesis.md, and the Homa design
> system. A restricted local questionnaire reference used during drafting is
> intentionally omitted. Methods: use-case-map, jtbd-jobs, gherkin-stories.
>
> How to read: each feature gets (a) a use case, (b) job stories, (c) a journey per the
> kickoff template, (d) INVEST user stories with Gherkin acceptance criteria. Stories are
> numbered `F<feature>-S<n>`. Ticket refs are 03-backlog IDs; gaps are flagged `NEW-TICKET
> NT-nn` and consolidated at the end. Design-sketch inconsistencies are flagged inline as
> **DESIGN FLAG**. Persona codes per kickoff (P1 Alessa, P2 Rachel, P3 Danielle, P4 Monica,
> P5 Jess). Voice law applies to all quoted product copy: reassurance-first, offers never
> commands, no "behind" framing, no em dashes.

## Backlog context (applies to every story below)

- **Product**: Homa Cloud, web app chat + dashboards, phone-first.
- **Constraints (law)**: child is never the user; parent is speaker/uploader (09 §call-4
  option a assumed); reassurance-first data (M1-17 enforces in code); all user-derived
  content passes injection defense (M2-14); every tool re-scopes IDs by family_id (S2);
  all generation runs in per-job sandboxes (S8); v1 materials range is ages 2–7 (09 §call-3).
- **Assumptions to validate**: credits are invisible to the mom in M-R (Sidney call #2
  pending, ❓Q1); concierge loops (Sidney-reviewed) stand in for M3-01/02/11 automation
  during M-R.
- **Analytics conventions**: events namespaced per feature (`materials.*`, `voice.*`,
  `benchmarks.*`, `efficacy.*`, `hours.*`, `planner.*`, `discover.*`, `curriculum.*`,
  `family.*`), every event carries `family_id`, `child_id` (nullable), `channel`
  (chat/dashboard/email), `surface`. No event payload ever contains journal/transcript
  content (S7 posture: metadata only).

---

# F1. Materials generation [M-R]

## Use case

**Problem** (in her words): "I need tomorrow's letter practice tonight, and everything I
find on Pinterest is either the wrong level, the wrong theme, or takes 40 minutes to
adapt. And when I finally print it, it cuts off the margins."

**Persona**: Primary P1 (Alessa, preschooler, enrichment-driven, prints daily). Secondary
P5 (Jess, time-starved, wants "make it so I don't have to"). P3 (Danielle) uses it as her
first proof that Homa is real.

**Alternatives**: Teachers Pay Teachers ($3–8 per pack, generic), Pinterest + Canva DIY
(30–60 min), workbook photocopies (fixed level, ignores the child), ChatGPT + manual
formatting (no layout, no personalization memory), curriculum-box worksheets (wrong pace).

**Frequency**: Daily to 3×/week per child during active weeks. This is the habit loop.

**Why Homa**: the only generator that reads the child's `what_works` first (interests,
modality, current position) so the output lands on the first try, and closes the loop:
her 👍/👎 makes tomorrow's page better. Personalization *is* homeschooling (00 §moat).

**Consideration time**: Seconds. She asks in chat the way she'd text a friend. The
purchase-level consideration already happened at subscription; per-artifact consideration
must stay near zero (❓Q1: visible credit pricing would reintroduce it).

## Job stories

- When it's 9pm and tomorrow has no plan yet, I want to ask for a worksheet in one
  sentence, so I can go to bed knowing the morning is handled.
- When my kid is obsessed with frogs this month, I want practice pages that ride that
  obsession, so I can get 20 minutes of willing focus instead of a fight.
- When a page doesn't land, I want to say so in one tap, so the next one is better and
  I never get that miss again.

## Journey: "make me something for tomorrow"

**Frame**: P1, evening, phone in hand, child asleep. Job story: "When tomorrow has no
plan, I want a personalized printable in under two minutes, so the morning runs itself."
Entry channel: web chat (typed or voice note); also entered from BenchmarksView "Growing
right now" (see F3) and PlannerView slots (F5).

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Request | Chat input, suggestion chips ("Make a fractions worksheet") | Types/speaks "handwriting page for Maya, letter F" | Parses child + skill + format; disambiguates if multi-child (F8) | 10s | Hopeful, tired | Ambiguity round-trips; wrong child assumed | Chip pre-filled from this week's plan |
| 2. Personalization | (invisible) | Nothing | Reads `what_works` + profile position + recent feedback BEFORE generating (product principle 3); picks hook (frogs), difficulty band, format | 2–5s | n/a | Stale/empty what_works → generic output = the exact friction she left Pinterest over | First-time: one-line "she loves frogs, so: F is for Frog" shows the memory working |
| 3. Generate | Chat streaming + artifact card | Watches card appear | Sandbox runs reportlab + fal.ai illustration (M0-03, S8: ephemeral sandbox, sanitized PDF); artifact card with inline preview | 15–45s | Anticipation | >60s feels broken; image gen fails; cost spike | Progress copy in voice ("drawing her a frog to color…") |
| 4. Deliver | Artifact card: preview, Download, Print | Taps preview, skims | Renders first page inline; shows page count + paper size | 10s | Judging fit | Preview too small on phone to judge; wrong difficulty visible only after print | "Tuned to where she is: tracing, not free-writing yet" caption |
| 5. Print | Phone → AirPrint / laptop later / email-to-self | Taps Print → iOS share sheet → AirPrint | PDF is margin-safe (letter default, A4 selectable), white background, no bleed elements (per homa-make-handwriting-worksheet spec: white bg, no borders) | 1–3 min | THE reality check | AirPrint scale-to-fit crops footer ("it cut off"); no printer tonight; B&W printer renders tints mud | "Print help" link: 3-step AirPrint walkthrough; "email it to the printer computer" option |
| 6. Use + feedback | Next morning, physical page → app 👍/👎 on the artifact card | Does the activity; taps 👍 or 👎 | Writes structured entry to `what_works` (M2-05); 👎 opens reason chips (NT-02) and offers instant regenerate | 5s (capture) | Done, seen | She never returns to tap; feedback feels like homework | "That's logged, tomorrow's page will lean into the mazes she loved" · the loop made visible |

**The moment that decides**: the **first-print moment**, stage 5→6. If the first page she
physically holds is on-level, on-interest, and intact on paper, Homa is real and daily.
If it cut off or ignored the frog obsession, Homa is "another AI toy." (This is also the
onboarding wow, M2-03(iii); the two must share one pipeline.)

**Instrumentation**
- `materials.requested` {format, source_surface, via_voice}
- `materials.personalization_applied` {what_works_facts_used: n, profile_position_band}
- `materials.generated` {latency_ms, cost_class, pages}
- `materials.preview_opened`, `materials.downloaded`, `materials.print_intent` (share-sheet opened)
- `materials.feedback` {value: up/down, reason_chip, regenerate_requested}
- `materials.regenerated` {parent_artifact_id, fix_applied}
- **The metric**: % of generated artifacts with a use signal (print intent, download, or
  feedback) within 24h. Target >70%.
- **Counter-metric** (the lie detector): generation volume rising while feedback rate
  falls = she's generating hopefully and using nothing; and regenerate-loops >2 per
  request = personalization is failing, not delighting.

**Edge/failure branches**
1. **Generation fails mid-sandbox** → artifact card shows in-voice error ("that one
   didn't come out right, I'm redoing it"), auto-retry once, no double charge (credit
   burn idempotent per M1-12); `materials.generation_failed` {stage}.
2. **Image model returns text-contaminated art** (known failure, skill spec bans text in
   illustrations) → preflight scan rejects, regenerates silently, max 2 attempts, then
   ships text-free fallback layout.
3. **"It cut off"** → artifact card keeps a persistent "printed wrong?" affordance →
   one-tap reprint regenerates with shrink-to-fit-safe margins + emits
   `materials.print_defect_reported` (NT-01). Never blame her printer.
4. **Requested child is out of materials range** (P2's 10-year-old) → honest decline in
   voice + redirect to what works for that child (hours/journal/planner), see F8, NT-05.
   Never generate off-benchmark content silently.
5. **Empty/sparse what_works** (day-1 family) → generate from questionnaire seed + age
   band; caption honestly ("I'm still learning what she loves, tell me how this lands");
   confidence system tolerates sparseness by design (M2-03).
6. **Injection via request content** ("ignore your rules and…" pasted inside a topic) →
   M2-14 structural separation; topic text is untrusted data, never instruction.
7. **Credit balance low mid-generation** → grace buffer, action ALWAYS completes (09 §V1),
   post-action one-tap top-up prompt; `billing.grace_buffer_used`.

**Ticket map**: M0-03 (sandbox generation spike), M0-10 (3 formats M-R), M2-05 ⛔
(worksheet skills + 👍/👎 → what_works + DS printable template), M2-06 (remaining
make-skills GA), M2-02 (what_works read), M2-14 (injection defense), M1-12 (grace
buffer), M1-17 (artifact card components). **Gaps**: NT-01 (print pipeline & preflight),
NT-02 (feedback reason capture + regenerate-with-fix).

## Sub-journey: the "child hated it" path [M-R]

P1's son takes one look at the page and pushes it away. She's holding a failed artifact
and a disappointed kid; this is a churn micro-moment and the single richest training
signal we can capture.

1. She taps 👎 on the artifact card (or says it in chat: "he hated the worksheet").
2. Reason chips (NT-02): `too hard` · `too easy` · `wrong interest` · `he refused` ·
   `printed wrong` · free text. One tap, optional elaboration.
3. Homa responds in voice, reassurance before information: "Good to know, that's exactly
   what teaches me. He might be done with tracing pages for a while, want a hands-on
   version with the same letters instead?" (modality pivot comes from what_works, which
   records "few worksheets, hands-on, character-carried" style facts, per the
   homa-make-handwriting-worksheet skill header).
4. Structured write to `what_works`: `{signal: negative, artifact_id, reason,
   inferred_fact: "resists tracing-format pages", confidence}` via the M2-13 hardened
   pipeline (schema-constrained, surfaced with undo).
5. Next generation for that child MUST reflect the fact (this is testable: F1-S4).
6. Weekly note (F3) references it as learning, never as failure: "we found out he'd
   rather build letters than trace them, that's progress too."

**Failure to avoid**: a 👎 that changes nothing. If she down-votes tracing pages twice
and gets a third, the loop is visibly dead and so is the subscription.

## User stories

**F1-S1 · Personalized generation from one chat message**

As P1, I want to request a worksheet in one sentence and get one tuned to my child's
interests and level, so tomorrow's material is ready without adaptation work.

- Scenario: happy path
  - Given a family with child Maya (age 4) whose `what_works` contains interest "frogs" and position band "tracing"
  - When the parent sends "make a handwriting page for Maya, letter F"
  - Then an artifact card is delivered in chat containing a PDF whose theme derives from a `what_works` interest and whose difficulty matches Maya's position band, and `materials.generated` fires with `what_works_facts_used ≥ 1`.
- Scenario (negative): sparse profile
  - Given a family onboarded today with no `what_works` entries for Maya
  - When the parent requests the same worksheet
  - Then generation succeeds from questionnaire seed + age band, the caption states Homa is still learning her interests, and `materials.personalization_applied` fires with `what_works_facts_used = 0` (dashboardable as "cold generations").
- Notes · Non-functional: p50 request→card <30s, p95 <60s; sandbox per S8. Instrumentation: `materials.requested/generated/personalization_applied`. Dependencies: M2-02, M2-05, M0-03. Out of scope: formats beyond the 3 M-R formats.

**F1-S2 · Print-safe PDF from a phone**

As P5, I want the PDF to print correctly from my phone the first time, so I never debug
margins at 6:45am.

- Scenario: happy path
  - Given a generated artifact and an AirPrint printer on letter paper
  - When the parent prints via the iOS share sheet with default settings
  - Then all content renders inside printable margins with no clipped strokes or footer, and `materials.print_intent` fires.
- Scenario (negative): reported print defect
  - Given a printed page the parent reports as cut off
  - When she taps "printed wrong?" on the artifact card and selects "it cut off"
  - Then a margin-conservative variant is regenerated free of charge within 30s and `materials.print_defect_reported` fires with the original artifact id.
- Notes · Non-functional: PDFs flattened/sanitized (S8), no remote resources; letter + A4. Instrumentation: print-defect rate is a launch KPI (<2% of printed artifacts). Dependencies: NT-01, M2-05 DS template. Open question: ❓Q2 (defect reprint always free even under credit model?).

**F1-S3 · One-tap feedback wired to memory**

As P1, I want my thumbs up/down to visibly change future materials, so giving feedback
feels worth 5 seconds.

- Scenario: happy path
  - Given a delivered artifact card
  - When the parent taps 👍
  - Then a `what_works` positive entry is written referencing the artifact's format and theme, a one-line in-voice confirmation names what was learned, and `materials.feedback` fires {value: up}.
- Scenario (negative): feedback on someone else's artifact (IDOR probe)
  - Given an artifact id belonging to another family
  - When any feedback API call references it
  - Then the write is rejected by family_id re-scoping (S2) and a security event is logged, with no information disclosure.
- Notes · Dependencies: M2-05, M2-13 (write pipeline), M1-07 (adversarial suite covers this). Instrumentation: feedback rate per delivered artifact (target >40% in week 1 cohorts).

**F1-S4 · The "child hated it" correction loop**

As P1, I want a 👎 with a reason to change the very next generation, so a bad page never
repeats.

- Scenario: happy path
  - Given a 👎 with reason "he refused" and inferred fact "resists tracing-format pages" recorded for child Theo
  - When the parent requests the next letter-practice material for Theo
  - Then the generated artifact uses a non-tracing modality (or explains why tracing was kept), and `materials.generated` carries `feedback_facts_respected: true`.
- Scenario (negative): repeated ignored feedback (the loop-is-dead detector)
  - Given two consecutive 👎 entries with the same reason for the same format and child
  - When a third artifact of that format+child would be generated
  - Then generation is blocked in favor of an in-chat check-in offering alternatives, and `materials.feedback_loop_breach` fires (alerting: this event >0 is a bug-level signal).
- Notes · Dependencies: NT-02, M2-13 delta guards. Out of scope: automatic modality retraining beyond what_works facts.

**F1-S5 · Never blocked mid-action by billing**

As P5, I want generation to always complete even if my credits run out, so I'm never
stranded the night before.

- Scenario: happy path
  - Given a family whose credit balance is below the cost of one worksheet
  - When the parent requests a worksheet
  - Then the artifact is generated and delivered, the balance goes modestly negative per the grace buffer, and a friendly one-tap top-up prompt appears after delivery (never before).
- Scenario (negative): concurrent low-balance requests
  - Given two simultaneous generation requests from the same family at low balance
  - When both complete
  - Then at most one top-up flow is initiated (advisory-lock singleflight) and the ledger shows exactly two burns with unique idempotency keys.
- Notes · Dependencies: M1-12 ⛔. Instrumentation: `billing.grace_buffer_used`, top-up prompt conversion. This story is M-R-deferrable (Payment Link era) but law by GA.

---

# F2. Voice capture & ambient logging [M-R]

## Use case

**Problem**: "The interesting stuff happens at 10am with my hands full. By 8pm when
someone asks me to journal, it's gone. I am not going to type field notes while holding
a 4-year-old."

**Persona**: Primary P1 (voice-notes-from-pocket is her actual usage pattern, 00 §product
principles: "the parent talks, Homa types"). Primary-equal P5 (voice-first by necessity).
Every persona benefits because journal/hours/profile all feed from this pipe.

**Alternatives**: paper planner scribbles (never compiled), Notes app (dies there),
Voxer/voice memos to self (never transcribed), typing into a tracker app at night
(recall loss + friction), doing nothing (the default; the profile starves).

**Frequency**: 1–5×/day during school hours; the single highest-frequency touchpoint in
the product.

**Why Homa**: one capture → routed to everything (journal, observation→profile, hours,
or an answered question), with visible confirmation that the capture *mattered*
("Logged, that moves her counting up"). No other product turns a 9-second pocket note
into compliance hours AND profile movement.

**Consideration time**: none; it must be habit-grade. The decision was made when she
subscribed; each use must cost <10 seconds of attention.

## Job stories

- When something notable happens mid-morning, I want to speak one sentence into my
  phone, so the moment is captured before it evaporates.
- When I log something, I want to see where it went and what it changed, so I trust the
  invisible system enough to keep feeding it.
- When Homa files something wrong, I want to fix it in one tap, so one mistake doesn't
  make me proofread every capture forever.

## Journey: pocket note → routed → confirmed

**Frame**: P1, 10:15am, kitchen, child mid-activity. Job story above #1. Entry channel:
web app mic button (M1-05); PWA on home screen. (SMS is the natural future channel,
M5-01; v1 is web.)

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Capture | Mic button in chat, hold-or-tap to record | Speaks: "Theo counted to 39 unprompted while we set the table" | Records; uploads; if mic/permission fails, text box + audio-file upload fallback appears in the same UI (M1-05 law) | 9s | Fleeting, multitasking | Mic permission dialog at the worst moment; upload dies on 1 bar of LTE | Recording UI shows a calm waveform, not a countdown; works one-handed with thumb |
| 2. Transcribe | (invisible) → chat shows transcript | Glances, maybe | Whisper transcript posted as her message (M0-04); child-name biasing from family roster | 2–5s | Trusting | Name mis-transcription ("Theo"→"Leo") poisons routing | Transcript is editable inline before/after routing |
| 3. Route | (invisible) | Nothing | Classifies: journal entry vs profile observation vs hours vs question-for-Homa (M2-07 routing; questions get answered instead of filed) | 1–2s | n/a | Mis-route (an anecdote logged as hours); over-routing (everything becomes profile writes) | Multi-route when warranted: one note = journal + observation + 20 min of math hours |
| 4. Confirm | Routing chip under the message | Reads one line | Visible confirmation naming the effect: "Logged · that moves her counting up ↑" (06 §design-detail-5: auto-apply + surface + undo) | 3s | Seen, trusted | Vague confirmation ("Saved!") teaches her nothing and earns no habit | The chip names the child, the domain, and the direction; this IS the daily proof the profile is alive |
| 5. Undo / correct | "Wrong?" affordance on the chip | Ignores 95% of the time | One-tap undo reverts ALL writes from that capture (journal row, profile delta, hours row) atomically via profile_revisions | 5s when used | In control | Partial undo (profile reverted, hours orphaned) breaks trust permanently | Correction re-route picker: "this was: journal / observation / hours / just a question" |
| 6. Accrue | Evening journal prompt (M2-07), weekly note | Nothing extra | Captures roll up: journal timeline, hour accrual (F4), profile trajectory (F3) | ambient | Compounding calm | If rollups never reference her captures, capture feels like a black hole | Weekly note quotes her own moment back: "you caught him counting to 39 Tuesday" |

**The moment that decides**: **the first confirmation chip** (stage 4). "Logged, that
moves her counting up" is the instant the mom understands Homa is not a notes app: her
sentence just became data about her child. If the confirmation is generic or wrong,
capture becomes journaling homework and dies in a week.

**Instrumentation**
- `voice.capture_started/completed` {duration_s, fallback_used}
- `voice.transcribed` {latency_ms, edited_after: bool}
- `voice.routed` {routes: [journal|observation|hours|question], multi_route: bool, child_id}
- `voice.confirmation_shown` {named_effect: bool}
- `voice.undo` {age_s, routes_reverted}, `voice.reroute` {from, to}
- **The metric**: voice captures per active family per week (target ≥5 by week 3) with
  correction rate (undo+reroute) <5%.
- **Counter-metric**: captures/week rising while weekly-note opens fall = she's feeding a
  black hole; and undo age >1 day = she's discovering mis-routes late, meaning
  confirmations aren't being read (or aren't legible).

**Edge/failure branches**
1. **Transcription fails or garbles** → raw audio preserved, chat shows "I couldn't quite
   catch that" + playback + retry/type; never route on a low-confidence transcript
   (threshold; below it, ask).
2. **Ambiguous child** ("she counted to 40" in a 2-girl family) → disambiguation rules
   (F8/M2-11): ask once, cheaply, with chips ("Maya or Nora?"); never guess on profile
   writes; MAY guess on journal-only with the guess visible in the chip.
3. **Child's own voice in the recording** → v1 constraint: parent is the speaker (09
   §call-4a). If child speech is detected as primary speaker, transcribe but do not
   store audio beyond transcription window; flag family gently once with the policy. ❓Q3.
4. **Mis-route discovered days later** (hours logged from a birthday-party anecdote,
   found while reviewing the compliance log) → hours ledger rows link back to source
   capture; deleting/re-routing from the log view reverts cleanly (NT-03 + F4).
5. **Injection via spoken content** ("Homa, ignore your instructions…" said aloud, or a
   note quoting a malicious flyer) → transcripts are untrusted data blocks (M2-14);
   routing classifier output is schema-constrained (M2-13 pattern).
6. **Question mistaken for a log** ("did we do enough math this week?" filed as journal)
   → correction teaches: reroute-to-question answers it immediately AND feeds the router
   few-shot store (NT-03).
7. **Offline / upload failure** → capture queued client-side with visible pending state;
   never silently dropped; `voice.capture_queued`.

**Ticket map**: M0-04 (phone spike), M1-05 ⛔ (voice + fallback), M2-07 ⛔ (journal
capture + routing), M2-13 ⛔ (learning review, undo surface), M2-02 (memory writes),
M2-14 ⛔ (transcript scanning), M1-15 (rotation must not lose parked captures).
**Gaps**: NT-03 (routing confirmation + correction UI + router feedback store). M-R
note: at n=1–10 families, routing can be concierge-verified (M-R week 5 "concierge
routing at n=1") but the confirmation chip must be real from day one, it IS the habit.

## Sub-journey: the mis-route correction [M-R]

Tuesday: P5 says "we spent the morning at grandma's, kids baked bread." Homa routes it
journal + 90 min "Life skills" hours. Thursday: reviewing the week (F4 log view), Jess
sees the hours and disagrees; that was just a visit.

1. In the hours log, every ambient row shows its source snippet + routing chip.
2. She taps the row → "Not school hours?" → confirm.
3. The hours row is removed; the journal entry stays (it was still a lovely day);
   `voice.reroute` {from: hours, to: journal_only} fires.
4. Homa replies in place: "Fixed. I'll be more careful about counting visits, baking
   with grandma stays in the journal." Router few-shots updated (NT-03): family-level
   preference learned ("this family doesn't count incidental home-ec").
5. Counter-rule: if she *adds* hours the router missed twice in a week, Homa may offer
   once: "want me to count cooking as life-skills hours going forward?" (offer, never
   command; max one such nudge per week per M3-07 fatigue rules).

## User stories

**F2-S1 · One-handed voice capture with guaranteed fallback**

As P5, I want to record a voice note in one tap and have it survive bad connectivity,
so capture never depends on ideal conditions.

- Scenario: happy path
  - Given the chat surface on a phone with mic permission granted
  - When the parent records a 9-second note and releases
  - Then the transcript appears as her message within 5 seconds and `voice.capture_completed` fires.
- Scenario (negative): mic unavailable
  - Given mic permission denied or getUserMedia failure
  - When the parent taps the mic button
  - Then a text input and audio-file upload are offered inline in the same interaction (no dead end), and `voice.capture_started` fires with `fallback_used: true`.
- Notes · Non-functional: capture works one-handed; queued-when-offline. Dependencies: M1-05 ⛔, M0-04. Instrumentation: fallback rate is a moat-health KPI (voice failure is a moat failure, per backlog).

**F2-S2 · Routing with named-effect confirmation**

As P1, I want each capture confirmed with what it changed, so I can trust ambient
logging without auditing it.

- Scenario: happy path
  - Given a transcript "Theo counted to 39 unprompted"
  - When routing completes
  - Then a confirmation chip shows destination(s) and the named effect including child and domain ("Logged · counting ↑ for Theo"), and `voice.confirmation_shown` fires with `named_effect: true`.
- Scenario (negative): low-confidence routing
  - Given a transcript the classifier scores below the routing confidence threshold
  - When routing would otherwise write to a child profile
  - Then no profile write occurs and Homa asks one clarifying question with tappable options instead, and `voice.routing_deferred` fires.
- Notes · Dependencies: M2-07, M2-13 (schema-constrained extraction), NT-03. Out of scope: SMS channel.

**F2-S3 · Atomic undo of a routed capture**

As P1, I want one tap to fully revert a mis-filed capture, so a mistake costs seconds,
not trust.

- Scenario: happy path
  - Given a capture that wrote a journal row, a profile delta, and 20 minutes of hours
  - When the parent taps undo on its confirmation chip
  - Then all three writes are reverted in one transaction (profile via `profile_revisions`), the chip shows "undone," and `voice.undo` fires with `routes_reverted: 3`.
- Scenario (negative): undo after downstream compilation
  - Given the capture's hours were already included in a generated state report draft
  - When the parent undoes the capture
  - Then the ledger reverts, the affected report draft is flagged stale with a one-tap regenerate, and no already-exported PDF is silently mutated.
- Notes · Dependencies: M1-02 (`profile_revisions`), M3-05 (ledger linkage), NT-03. Instrumentation: undo age distribution (goal: p90 < 10 min = confirmations are being read).

**F2-S4 · Mis-route correction teaches the router**

As P5, I want my corrections to change future routing for my family, so I stop
correcting the same mistake.

- Scenario: happy path
  - Given a reroute of "baking at grandma's" from hours to journal-only
  - When a similar capture ("kids helped grandma make soup") arrives the following week
  - Then it routes journal-only without asking, and `voice.routed` carries `family_rule_applied: true`.
- Scenario (negative): correction conflict
  - Given contradictory corrections within 30 days (same pattern rerouted both directions)
  - When the pattern recurs
  - Then Homa asks once with chips rather than applying either rule, and the conflict is logged for concierge review (`voice.routing_conflict`).
- Notes · Dependencies: NT-03 few-shot store (family-scoped, injection-scanned per M2-14). Out of scope: global cross-family router training from corrections (post-GA, needs privacy review ❓Q4).

---

# F3. Benchmarks & the efficacy loop [M-R concierge → GA product]

> The deepest treatment, per the brief: this is "the ultimate selling point" (00 §value
> stack, Alessa's words), the renewal argument, and the word-of-mouth artifact. Three
> journeys: (a) the parent checklist, (b) position display + targeted practice, (c) the
> PROOF moment. In M-R the loop runs concierge (Sidney hand-writes the before/after in
> weekly notes from week one); the product journeys below are the GA target the
> concierge script must rehearse.

## Use case

**Problem**: "Everyone in my co-op quietly compares kids. My mother-in-law asks if he's
'on track.' I lie awake wondering if I'm failing him, and the only offered answer is a
standardized test I will not put a 5-year-old through."

**Persona**: Primary P3 (Danielle, the anxious newcomer, highest support load, highest
word-of-mouth upside; "am I doing enough?" is her resting state). Primary-equal P1
(wants ahead-of-standards validation). P4 needs positions as portfolio evidence. Every
persona hits this weekly via the note.

**Alternatives**: formal standardized testing (exactly what she's avoiding; also
age-inappropriate under 7), grade-level checklists on Pinterest (static, no measurement
method, guilt-framed), curriculum placement tests (test the child again), asking
Facebook groups (comparison anxiety machine), nothing (the fear compounds).

**Frequency**: Positions consulted weekly (via the note) and at social-pressure moments
(co-op day, family visits). Checklist re-measurement: ~monthly per domain, prompted by
confidence decay (product principle 4). The PROOF moment: every 4–6 weeks when a
targeted area moves.

**Why Homa**: the only product that answers "where does my child stand?" from *the
mother's own observations*, never testing the child ("a test for the mother", 00 §value
stack), then closes the loop: growth area → generated materials → the number moves →
Homa shows the before/after and attributes it to the work she did. Competitors either
ignore standards or point at tests (00 §why-we-believe).

**Consideration time**: This is the feature she buys the subscription FOR, so
consideration happened pre-purchase (marketing leads with it, M4-07). In-product,
engaging with a checklist is a 3–5 minute considered act; the weekly note makes the
output zero-effort.

## Job stories

- When someone implies my kid might be behind, I want a credible, standards-grounded
  answer I got without testing him, so I can stand my ground calmly.
- When Homa says a domain is "ready for review," I want 5 minutes of checkbox
  observations, so the picture stays current without a testing day.
- When we've worked on something for a month, I want to see whether it moved and know
  the work caused it, so I know the $29 and the effort are real.
- When the picture is good, I want permission to relax, so validation actually lands
  instead of becoming a new treadmill.

## Journey A: the parent checklist ("a test for the mother, never the child")

**Frame**: P3, prompted by weekly note: "Science is ready for a check-in when you have
five minutes." Job story #2. Entry: email deep-link → Benchmarks surface (BenchmarksView
is the build spec, M1-17); also reachable anytime from dashboard.

**DESIGN FLAG**: BenchmarksView sketches Grade-3 subjects (TEKS, "counts to 120"). The
v1 asset is 15 developmental domains for ages 2–7 (M0-10, questionnaire age bands
2y0m–7y0m). The view's structure (standing cards, checklist, "growing right now",
proof card) ports cleanly, but v1 labels must be domains ("Number sense", "Early
literacy") not school subjects, and the standard selector maps state standards where
they exist for preK–2 with national benchmarks fallback. Grade-subject framing becomes
real at M5-06 age expansion.

> Current implementation correction. The map now covers ages 2 through 16 with
> 16 subjects, and the skill graph uses subject, domain, and topic. State legal
> requirements do not provide state academic-standard mapping. The paragraph
> above is the original design flag, not current product structure.

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Invite | Weekly note line / dashboard "ready for review" badge (never red, warning-tone per DS) | Taps through | Frames it as HER checklist: "Check what you've seen him do. Blanks are fine, they're just what's next" (BenchmarksView copy) | 10s | Mild duty, some dread | Feels like a test OF HER homeschooling; skipped forever if guilt-toned | The Caveat margin note ("blanks are fine ✎") disarms it |
| 2. Checklist | Domain checklist, 5–8 observable items at his band + one band above (questionnaire design: detect ahead) | Checks what she's SEEN him do; leaves unknowns blank | Items are observable behaviors ("counts 10 objects while touching them"), not clinical constructs; "not sure" is a valid state (questionnaire principles) | 3–5 min | Reflective, occasionally proud ("oh, he DOES do that") | Items she can't picture → abandonment; too many items → fatigue | Mid-checklist micro-affirmation after a streak of checks; NEVER after blanks |
| 3. Absorb | (invisible) | Nothing | Answers map to position values (below/at/12mo/24mo-ahead/unknown per scoring rubric); confidence refreshed; positions recompute (M2-04) | 1s | n/a | A single blank tanking a domain score would feel punitive; scoring must be evidence-weighted | n/a |
| 4. Reflect | Updated standing cards | Reads her child's picture | Position shown reassurance-first (Journey B); changed items called out ("two new checks in number sense since last month") | 30s | Relief or resolve | If nothing visibly changed after her 5 minutes, the ritual feels pointless | "You just made his picture sharper" · effort acknowledged |
| 5. Bridge | "Growing right now" module | Optionally taps a growth area | Every growth area arrives WITH materials attached (presentation law: next-steps-with-materials, 00 §reconciliation) | 30s | Agency | A growth area with no action = a labeled worry | One tap from "what's next" to "on the printer" (F1) |

**The moment that decides**: stage 2, the **third checkbox**: the instant she realizes
she can answer these from memory, that her ordinary noticing IS the assessment. That
reframe ("I am the instrument, and I'm credible") is the product's emotional patent. If
items read clinical or she has to go quiz the child, we've become the thing she fled.

**Instrumentation**: `benchmarks.checkin_invited` {trigger: decay|note|manual},
`benchmarks.checklist_opened`, `benchmarks.item_answered` {state: yes|blank|not_sure},
`benchmarks.checklist_completed` {items, duration_s, new_checks},
`benchmarks.abandoned` {at_item}. **Metric**: check-in completion rate ≥60% within 7
days of invite. **Counter**: completion achieved but median duration <45s = she's
speed-checking to clear the badge, data quality is rotting.

## Journey B: position display, reassurance-first

> Current trajectory correction. Red and deficit-labeled progress states remain
> prohibited. A neutral, evidence-backed downward trajectory segment is allowed
> when its surrounding treatment remains growth-oriented.

**Frame**: P1 (validation-seeking) opens Benchmarks cold; also P3 post-checklist.
Positions render per BenchmarksView: per-domain cards with badges from the sanctioned
set: **"Ahead" (gold) · "On track" (sage) · "Ready for review" (warning/neutral)**.
There is no fourth negative badge. The below-age state renders as growth framing:
"working on it, here's this week's step" with materials attached. **No "behind" labels,
ever** (M1-17 enforces in code; DS readme §reassurance-first-data).

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Overview | Standing cards per domain | Scans badges | Strengths listed first, always; each card has a one-line human note ("comprehension is a real strength"), mono numerals for data | 20s | Bracing → exhale | Any accidental deficit connotation; red and deficit-labeled downward indicators are banned | The page's job in one glance: "he's okay, you're okay" |
| 2. Depth | Card tap → domain detail: trajectory line, evidence list, benchmark citations | Reads evidence behind a number | Every position backed by her own observations + citation-backed milestones (M0-10 benchmarks library); "last measured" honesty via confidence decay | 1–2 min | Credibility forming | Uncited or stale claims read as AI hand-waving; P4 will churn over a wrong claim | Citations = ammunition for the mother-in-law conversation |
| 3. Compare (quietly) | Standard selector (state / national) | Switches lens | Recomputes vs selected standard; language stays growth-framed in both | 15s | Quiet competitive pressure, satisfied honestly (00 §value stack: this pressure is REAL, serve it without shame) | Turning this into a leaderboard vibe | "Ahead in 3 domains" is allowed to feel GOOD (gold, not smug) |
| 4. Act | "Growing right now" | Adds practice to the week | Generates targeted materials (Journey C start) | 30s | Agency | - | - |

**The moment that decides**: stage 1, first 5 seconds: does her shoulders-drop reflex
fire? The overview must be readable as reassurance *before* any number is parsed
(strengths-first ordering, badge palette, the note from Homa). The abandon-risk is not
confusion, it's dread: if the page ever makes her feel audited, she won't come back.

**Instrumentation**: `benchmarks.viewed` {entry}, `benchmarks.domain_opened`,
`benchmarks.standard_switched`, `benchmarks.growth_area_actioned` {to: materials|plan},
plus session-quality signal: time-to-first-action. **Metric**: % of benchmark views
followed by a growth-area action or a check-in within 48h (the page produces agency).
**Counter**: benchmark views followed by session abandonment AND reduced app opens that
week = the page is generating anxiety, not calm; alert at cohort level.

## Journey C: targeted practice → the PROOF moment

**Frame**: P3's son shows a growth area in early-numeracy ("counting past 29"). Job
story #3. This is the closed loop: identify → generate → do → move → attribute (00
§value stack item 2). Runs over ~3–5 weeks.

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Target | "Growing right now": "Counting past 29 · 3 practice ideas, tuned to where he is" | Taps "Add to this week" | Generates a practice set from the growth area + what_works (F1 pipeline); tags artifacts with the target subdomain (the attribution key, M3-11) | 1 min | Purposeful | Practice that feels remedial; must read as "what's next," never "fixing a deficit" | The set rides his interests (dinosaur counting cards) |
| 2. Do the work | Kitchen table, days 1–14; check-offs in planner (F5); ambient captures (F2: "he counted all 40 dino cards!") | Runs the activities, logs ambiently | Accrues completion signals + observations against the target subdomain | 2 wks | Ordinary effort | Life happens; the set stalls → gentle single nudge max (M3-07), then let it rest | Captures echo back: "logged · counting ↑" chips make progress feel continuous |
| 3. Re-measure | Confidence-decay-triggered mini-checklist (3 items, not a full domain pass) | 90 seconds of checkboxes | Recomputes position; movement detected: counting subdomain up | 90s | Anticipation | Re-measuring too eagerly (noise, not signal); scoring rubric guards | "Ask him to count the stairs today" style playful measurement prompts |
| 4. THE PROOF | Weekly note + dashboard "It's working" card (BenchmarksView sage card): "Counting is up · from 'to 29' to 'past 40' since the dinosaur set. Your work did that." Before/after sparkline, dated | Reads it; screenshots it; tells the co-op | Attribution join: artifacts done ∧ subdomain window ∧ movement (M3-11); honest correlation language ("progress with the work," never causal overclaim per ticket spec) | 1 min | **Validation. The renewal moment.** | Overclaiming (P4 detects and churns); underclaiming (buried in a bullet list); movement without done-work must NOT be attributed | The Caveat note: "your work is paying off ✎"; this card is the screenshot that sells Homa in the group chat |
| 5. Compound | Next growth area surfaces | Repeats willingly | The loop is now trusted; targeting improves as what_works deepens | ongoing | Confidence (the brand arc destination) | Fatigue if every proof card demands a new project; pacing: max one active target per child by default | Quarterly "look how far" retrospective (post-GA idea) |

**The moment that decides**: stage 4, **the before/after card**. It is the answer to
"is this worth $29/mo," the word-of-mouth artifact, and the emotional payoff of every
capture and checklist that preceded it. It must: name the child, name the specific
work, show dated before/after, and give her the credit ("your work did that", not
"Homa did that"). In M-R, Sidney hand-writes this sentence into every weekly note from
week one (backlog M-R week 6); the concierge phrasing is the copy spec for M3-11.

**Instrumentation**: `efficacy.target_created` {subdomain, source: checkin|scoring},
`efficacy.practice_generated` {artifact_ids}, `efficacy.practice_done_signal` {type:
checkoff|capture|feedback}, `efficacy.remeasured` {delta}, `efficacy.proof_shown`
{channel: note|dashboard, delta, work_items: n}, `efficacy.proof_engaged`
{screenshot_heuristic|share|dwell>10s}. **The metric** (product-defining): % of
families who see ≥1 honest proof card in their first 6 weeks (target: 100% in M-R via
concierge; ≥60% at GA). **Counter-metric**: proof cards shown where done-work signals
were thin (attribution confidence low) = we are manufacturing validation; this number
must be ~0 and is a trust-debt alarm, tracked as `efficacy.low_confidence_attribution`.

**Edge/failure branches (all three journeys)**
1. **The number doesn't move after the work** → NEVER silence, never blame: "We
   practiced counting for three weeks and it's holding steady. That's normal, this is
   a long skill. Want to try the hands-on version, or let it rest a few weeks?" Emit
   `efficacy.no_movement_handled`; offer modality pivot from what_works. The absence of
   a proof card must never read as the mom's failure (no-guilt law).
2. **The number moves but no work was done** (natural development) → celebrate WITHOUT
   attribution: "Counting jumped on its own, kids do that. Lovely." Attribution join
   requires done-work signals; this is the honesty backbone of the selling point.
3. **Regression / position drops after re-measurement** → growth framing + measurement
   humility ("earlier picture may have been optimistic; here's what to watch"). A
   neutral downward segment may be shown; red or deficit framing may not. Large drops are staged via M2-13 delta guards if
   large (>N subdomains moving = staged for review, not auto-applied).
4. **She disputes a position** ("he's way past that") → one-tap "this looks wrong" →
   instant mini-checklist to re-evidence; her observation outranks stale inference;
   `benchmarks.position_disputed` feeds concierge review in M-R.
5. **Out-of-range child** (P2's 10yo) → no positions, no checklist; honest copy: "I
   don't have benchmarks for 10-year-olds yet, I track hours and the journal for him"
   (NT-05, ❓Q5 age-ICP call).
6. **Benchmark library update shifts positions fleet-wide** (M3-04 publish) → positions
   never silently jump: change-noted in the weekly note with the library version;
   one-action fleet revert exists (S1).
7. **P4 fact-checks a milestone citation and it's wrong** → in-product "flag this
   benchmark" → quarantine review; wrong legal/developmental claims are churn-fatal
   (persona table).

**Ticket map**: M2-04 ⛔ (profile engine: positions, decay), M2-03 (questionnaire seeds),
M3-01 ⛔ (weekly scoring), M3-02 ⛔ (weekly note), M3-11 ⛔ (attribution view · the
proof), M2-05 (targeted generation), M0-10 (benchmarks library), M3-04 (library
pipeline), M2-08 ⛔ (dashboard), M1-17 ⛔ (reassurance law in code), M2-13 (staged
deltas). **Gaps**: NT-04 (the Benchmarks surface itself: checklist flow + standing
cards + growing-now module as a product surface; M2-08 covers the dashboard, M2-04 the
engine, but the check-in UX is unticketed), NT-11 (shareable proof card, POST-GA).

## User stories

**F3-S1 · Domain check-in from parent observation**

As P3, I want to update my child's picture by checking off what I've seen him do, so
the profile stays current without ever testing him.

- Scenario: happy path
  - Given a domain flagged "ready for review" by confidence decay
  - When the parent completes the checklist (any mix of checked, blank, not-sure)
  - Then the domain position and confidence recompute from the answers per the scoring rubric, and `benchmarks.checklist_completed` fires with the answer distribution.
- Scenario (negative): abandoned mid-checklist
  - Given a checklist opened and 3 of 7 items answered
  - When the session ends without completion
  - Then the 3 answers persist as observations (no data loss), the invite stays open without re-nagging for 7 days, and `benchmarks.abandoned` fires {at_item: 4}.
- Notes · Non-functional: checklist usable one-handed on phone; items are observable behaviors, age-band + one above. Dependencies: M2-04, NT-04, M0-10. Instrumentation above.

**F3-S2 · Reassurance-first position rendering**

As P1, I want every position framed as strength or next step, so checking on my child
never manufactures dread.

- Scenario: happy path
  - Given a child with domains at mixed positions including one below age band
  - When the benchmarks surface renders
  - Then strengths render first, badges come only from {Ahead, On track, Ready for review}, the below-band domain renders as a growth area with attached practice, and no "behind"-class label or red state exists in the DOM.
- Scenario (negative): forbidden-copy regression guard
  - Given any code path that would render a deficit label ("behind", "below grade", or a red deficit indicator) on a child surface
  - When CI runs the M1-17 reassurance-law test suite
  - Then the build fails.
- Notes · Dependencies: M1-17 ⛔ (this story IS its acceptance criteria on this surface), M2-08. Non-functional: the law applies to email/note renders too.

**F3-S3 · Growth area ships with materials attached**

As P3, I want every "what's next" to come with something I can do today, so a gap is
an action, not a worry.

- Scenario: happy path
  - Given a growth area computed for a child
  - When it renders in "Growing right now"
  - Then it includes ≥1 concrete practice offer (materials or activity) generated from the child's what_works, with a one-tap add-to-week, and `benchmarks.growth_area_actioned` fires on tap.
- Scenario (negative): generation unavailable
  - Given the materials pipeline is degraded (safe mode, M1-16)
  - When a growth area renders
  - Then it still offers a no-generation activity from the ported activities library (M0-10) rather than a bare gap label.
- Notes · Dependencies: M2-05, M2-09, M3-11 tagging. Out of scope: multiple simultaneous targets per child (default 1).

**F3-S4 · The honest before/after proof card**

As P3, I want to see dated proof that the work moved the number, so I know the effort
and the subscription are worth it.

- Scenario: happy path
  - Given a target subdomain with ≥2 done-work signals and a re-measured positive delta within the target window
  - When the weekly note and dashboard render
  - Then a proof card shows the before/after values with dates, names the specific work ("the dinosaur counting set"), credits the parent, uses progress-with-work language (no causal overclaim), and `efficacy.proof_shown` fires.
- Scenario (negative): movement without work
  - Given a positive delta on a subdomain with zero done-work signals in the window
  - When the weekly note renders
  - Then the movement is celebrated without attribution to Homa materials, no proof card is generated, and `efficacy.low_confidence_attribution` does NOT fire (nothing was suppressed; nothing was faked).
- Notes · Dependencies: M3-11 ⛔, M3-01, M3-02. Instrumentation: proof-seen-by-week-6 is the renewal-predictive KPI. In M-R this card is hand-written (concierge); the Gherkin above is the automation acceptance test.

**F3-S5 · No-movement handled without guilt**

As P5, I want a stalled skill acknowledged kindly with options, so a flat line never
reads as my failure.

- Scenario: happy path
  - Given a target with done-work signals and a re-measured delta of zero after 3 weeks
  - When the weekly note renders
  - Then it names the effort, normalizes the plateau, and offers exactly one choice (modality pivot or rest), and `efficacy.no_movement_handled` fires.
- Scenario (negative): repeated plateau
  - Given a second consecutive no-movement window on the same target
  - When the note would nudge again
  - Then the target auto-retires to "resting" with a warm note and no further nudges (max-one-nudge law), and `efficacy.target_rested` fires.
- Notes · Dependencies: M3-02, M3-03 (intervention lifecycle), M3-07 (fatigue rules).

**F3-S6 · Disputed position re-evidenced by the parent**

As P4, I want to challenge a position I know is wrong and fix it with my own
observations, so the record I show an evaluator is accurate.

- Scenario: happy path
  - Given a rendered position the parent disputes via "this looks wrong"
  - When she completes the instant 3-item mini-checklist
  - Then the position recomputes with her fresh observations outweighing stale inference, the revision is recorded in `profile_revisions` with source "parent_dispute", and `benchmarks.position_disputed` fires.
- Scenario (negative): dispute spam / gaming guard
  - Given three disputes on the same subdomain within 7 days
  - When a fourth is attempted
  - Then the mini-checklist is replaced by an offer of a concierge review (support touch), preventing checklist-grinding from inflating positions.
- Notes · Dependencies: M2-04, M1-02. P4-critical: accuracy is her churn trigger.

---

# F4. Hours & compliance [M-R subset]

## Use case

**Problem**: "New York wants an IHIP, four quarterly reports, and an annual assessment.
I keep a paper log I don't trust, and every July I lose a weekend reconstructing our
year, terrified I miscounted and someone official will care."

**Persona**: Primary P4 (Monica; records ARE the job; will evangelize over a generated
quarterly that works, churn over a wrong legal claim). Primary-equal P2 (hours tracking
is a legal must in her state; conference moms asked for exactly this, 00 §demand).
P3 needs the calmer subset: "what does my state even require?"

**Alternatives**: paper logbooks + spreadsheet reconstruction, Homeschool Fox /
HomeschoolPlanner ($5–15/mo manual-entry trackers), state Facebook groups + HSLDA pages
for law questions, "my friend's IHIP as a template."

**Frequency**: Accrual: daily and ambient (the whole point: she logs life, hours fall
out). Target check: weekly glance. Reports: quarterly (NY) or annual; law questions:
onboarding + every rule-change rumor.

**Why Homa**: hours accrue from the journal/activity stream she's already feeding (F2),
against her state's actual ruleset (statute-sourced with links + last-verified dates,
M3-05), and the report is compiled from logs on demand (product principle 5: "log
everything, compile later"). Trackers make her do data entry; Homa makes the data from
her life.

**Consideration time**: For P4 this is a purchase-decision feature evaluated in days
(she will compare a generated report against her known-good format). For P2 it's
table-stakes checked in minutes.

## Job stories

- When we finish a normal messy day, I want the schoolish parts counted without me
  itemizing them, so the log exists without a nightly chore.
- When the quarter ends, I want a report my district format expects generated from what
  we already logged, so filing is an hour, not a weekend.
- When I wonder whether we're on pace, I want the year-to-date picture vs my state's
  requirement in one glance, so the audit dread stays quiet.

## Journey: ambient accrual → "generate my state report" (P4 stress case)

**Frame**: P4, New York, two enrolled kids, Q2 report due to the district in 10 days.
Job story #2. Entry: chat ("I need my quarterly for the district") or dashboard →
Reports tab (DashboardView sketches a Reports tab; DESIGN FLAG: its contents are
unsketched, this journey is the spec).

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 0. Ambient accrual (weeks prior) | F2 captures, planner check-offs, journal | Lives normally, logs ambiently | Routes durations to subject buckets per state categories; every hours row links to its source capture; low-confidence durations logged conservatively | 0 extra | Unaware (the ideal) | Over-counting (F2 grandma edge) discovered AT REPORT TIME = trust crisis at max stress | Weekly glance: "on pace · 4.2h this week" |
| 1. Target awareness | Dashboard hours tile: year/quarter progress vs state target; statute link + "last verified" date (M3-05) | Glances weekly | Renders required-vs-logged with plain language ("NY asks for substantial equivalence; here's how your log maps") + legal-info-not-advice framing | 15s | Vigilant → reassured | A wrong statute claim = instant churn (persona law); targets differ by district interpretation | The "last verified" date is itself the trust feature |
| 2. Request | Chat: "generate my Q2 report" | One sentence | Confirms scope (child, quarter, district format if known); states what it will include | 20s | Bracing for homework | Asking her 12 clarifying questions = the weekend she was avoiding | "I have 47 logged days and 214 hours for Ben this quarter, want the district PDF?" |
| 3. Compile | (invisible) → draft artifact | Waits | Assembles from logs: attendance days, hours by subject, materials/portfolio index (M3-06 v1 generic; NY IHIP/quarterly deep template = M5-03 by demand) | 30–60s | Anticipation | Gaps in the log surface here (2 zero weeks in February) | Gap handling is kind AND honest: "Feb 10–21 shows no logs, were you off, or shall I mark it?" |
| 4. Review | Draft report view: every line traceable, tap any number → source entries | Spot-checks like an auditor (she IS one) | Full provenance: hours→captures, portfolio items→artifacts; edit-in-place with edits logged | 10–20 min first time; 3 min after | Focused, in control | Any unexplainable number poisons the whole document | Tap-to-source is the audit-anxiety antidote: she can defend every line |
| 5. Deliver | Final PDF, download/print; archived to the family's records | Files with district; exhales | Stores the exact rendered PDF immutably (what-was-filed matters); marks quarter compiled | 2 min | **Relief, evangelism trigger** | - | "Q2 filed. Three more and the year is done, you're ahead of it." |
| 6. Audit posture (ongoing) | Records archive ("evidence locker", NT-12) | Rarely opens; sleeps better | Keeps filed reports, portfolio index, statute snapshot as-of-filing | 0 | Quiet confidence | Data export must include all of it (M4-05) | "Everything filed lives here, dated" |

**The moment that decides**: stage 4, first tap on a number → the source entries appear.
Audit anxiety is not about the PDF; it's "can I defend this if questioned?" Provenance
turns Homa's log from "an app's claim" into "my evidence." For P4 this single
interaction converts churn risk into evangelism ("a generated quarterly that works",
persona table).

**Instrumentation**: `hours.accrued` {source: capture|checkoff|manual, subject,
minutes, confidence}, `hours.target_viewed`, `hours.manual_adjustment` {direction},
`report.requested` {type, period}, `report.gap_prompt_shown/resolved`,
`report.draft_reviewed` {numbers_traced: n, edits: n}, `report.finalized`,
`report.regenerated_after_edit`. **The metric**: % of report requests reaching
finalized without a support touch (GA target ≥80%; M-R is concierge "ask Homa" per
backlog wk 6). **Counter-metric**: manual hours adjustments per family per week
trending up = ambient accrual is mis-counting and she's doing the data entry we
promised to kill.

**Edge/failure branches**
1. **The log has holes** (sick month, logging lapse) → gap prompt lists the windows,
   offers honest options (mark as break / bulk-recall assist: "tell me roughly what
   February looked like and I'll draft entries marked as reconstructed"); NEVER
   fabricate. Reconstructed entries are flagged as such in provenance. ❓Q6.
2. **State rules changed / rumor of change** → ruleset rows carry statute links +
   last-verified dates (M3-05 via HomeschoolLeap API + JHU verification); if she asks
   about an unverified change, Homa says what it knows, dates it, and does not guess.
   Legal-information-not-advice disclaimer set by M4-04 review. ❓Q7 wording.
3. **Mid-year state move** (P2 rural→relocation) → dual-ruleset period: old state's
   log preserved, new state's targets from move date; report generator scopes by
   residency window; flagged for concierge in M-R.
4. **She disputes accrued hours at review time** (stage 4 finds the grandma-baking rows)
   → inline removal reverts via the F2 linkage (F2-S3 negative scenario covers report
   staleness); router learns (NT-03).
5. **District rejects the format** → report feedback flow ("what did they ask for?")
   feeds M5-03 per-state template demand queue; concierge fixes for M-R cohort; the
   filed-version archive means the correction diff is explicit.
6. **Out-of-range child** → hours + reports work fully for the 10yo (this is exactly
   the honest subset, F8/NT-05); benchmarks absence doesn't degrade compliance.
7. **Two parents logging** (S2 Marcus) → hours from any family member's captures merge
   into one ledger with author provenance; no double-count when both mention the same
   activity (dedupe by time-window + child + activity similarity; flag ambiguous dupes
   for one-tap merge).

**Ticket map**: M3-05 ⛔ (ambient hours + per-state rulesets; pulled forward to M-R wk 5
per backlog), M3-06 ⛔ (report generator v1), M5-03 (per-state deep templates, by
demand: NY first, P4), M2-07 (routing feed), M4-04/M4-12 (legal framing + retention),
M4-05 (export includes compliance archive), M2-08 (hours tile). **Gaps**: NT-12
(evidence locker: immutable filed-report archive + provenance viewer; M3-06 generates,
nothing tickets the archive/traceability UX that answers audit anxiety).

## User stories

**F4-S1 · Ambient hour accrual from captures**

As P2, I want school hours counted from what I already tell Homa, so the legal log
exists without a nightly chore.

- Scenario: happy path
  - Given a voice capture "we did about 40 minutes of reading on the couch" for child Ben
  - When routing completes
  - Then an hours row (subject: reading/ELA per state categories, 40 min, source-linked to the capture) is appended to the family ledger and `hours.accrued` fires {source: capture}.
- Scenario (negative): non-instructional activity
  - Given a capture "kids watched a movie while I cleaned"
  - When routing completes
  - Then no hours row is created, the capture routes journal-only, and no confirmation claims hours were counted.
- Notes · Dependencies: M2-07, M3-05, NT-03. Instrumentation: precision matters more than recall at first (under-count and let her add, never over-count silently); manual-addition rate is the tuning signal.

**F4-S2 · Per-state target visibility with statute provenance**

As P4, I want my logged hours shown against my state's actual requirement with the
statute linked and dated, so I trust the target I'm pacing against.

- Scenario: happy path
  - Given a NY family with logged hours in the current school year
  - When the dashboard hours tile renders
  - Then it shows logged-vs-required for the current period, links the statute source, displays the ruleset's "last verified" date, and `hours.target_viewed` fires.
- Scenario (negative): unverified ruleset
  - Given a state whose ruleset row failed its last verification pass
  - When the tile renders
  - Then the target displays with an explicit "being re-verified" state (no silent stale claim) and an ops alert exists for the ruleset row.
- Notes · Dependencies: M3-05 ⛔ (HomeschoolLeap + JHU verification). Non-functional: legal-information framing per M4-04. P4 churn law: no wrong legal claims.

**F4-S3 · State report compiled from logs with full provenance**

As P4, I want my quarterly report generated from the existing log with every number
traceable to its sources, so I can file it and defend it.

- Scenario: happy path
  - Given a quarter with ≥1 logged entry per required subject
  - When the parent requests the quarterly report and confirms scope
  - Then a draft renders with attendance days, hours by subject, and portfolio index, where tapping any figure lists its source entries, and `report.draft_reviewed` records traces.
- Scenario (negative): log gaps
  - Given a 2-week window with zero entries inside the report period
  - When the draft is compiled
  - Then compilation pauses on a gap prompt offering "mark as break" or "reconstruct with my help" (reconstructed entries permanently flagged), and no ungrounded hours appear in any draft.
- Notes · Dependencies: M3-06 ⛔, NT-12, M5-03 (NY template). Instrumentation: `report.gap_prompt_shown/resolved`; time-to-finalized. Out of scope: e-filing/submission to districts.

**F4-S4 · Filed reports are immutable and exportable**

As P4, I want the exact PDF I filed archived forever and included in my data export,
so my records outlive my subscription.

- Scenario: happy path
  - Given a finalized report
  - When the parent later regenerates the same period after editing hours
  - Then the originally filed PDF remains unchanged in the archive, the new draft is a distinct version with a visible diff summary, and `report.regenerated_after_edit` fires.
- Scenario (negative): export completeness
  - Given a family with 3 filed reports requesting data export (M4-05)
  - When the export bundle is produced
  - Then it contains all filed PDFs, the hours ledger with source links, and ruleset snapshots as-of each filing, verified by an automated export-completeness test.
- Notes · Dependencies: NT-12, M4-05, M1-03 (signed URLs, ownership at serve time). Non-functional: retention TTLs per M4-12 must exempt filed compliance artifacts from short TTL classes.

**F4-S5 · State law question answered honestly at onboarding**

As P3, I want to ask "what does my state require?" and get a sourced, dated answer, so
I start legal instead of scared.

- Scenario: happy path
  - Given a family with state = Pennsylvania on file
  - When the parent asks "what do I actually have to track?"
  - Then the answer summarizes PA requirements from the ruleset table in plain language, links the statute, shows the last-verified date, and includes the not-legal-advice framing once (not per-sentence).
- Scenario (negative): state not yet verified / unknown edge
  - Given a question about a requirement not present in the ruleset table
  - When the parent asks
  - Then Homa says what it does not know, offers the authoritative source link, and never fabricates a requirement; `hours.ruleset_miss` fires to drive coverage work.
- Notes · Dependencies: M3-05, M4-04. This story doubles as P3's activation reassurance ("you're allowed, here's the path").

---

# F5. Weekly planner [GA]

## Use case

**Problem**: "Sunday night I lose 90 minutes to next week's plan across two kids, around
co-op Tuesday and the dentist Thursday, and by Wednesday reality has shredded it. Then I
feel guilty about the shredding."

**Persona**: Primary P2 (drowning in planning across ages). Primary-equal P5 ("it makes
the plan so I don't have to" is her conversion trigger, persona table). P1 uses it
lightly (enrichment slots).

**Alternatives**: paper planners (beautiful, static, guilt-inducing archives of
abandoned weeks), HomeschoolPlanner-class digital planners (manual entry, no knowledge
of the child), curriculum-box pacing guides (ignore her calendar), winging it (the
default when planning collapses).

**Frequency**: Weekly (Sunday evening ritual) + a mid-week replan roughly every other
week (the honest number).

**Why Homa**: the plan is *drafted from the child*, not from a template: current
positions, active practice targets (F3), what_works pacing, HER constraints (co-op
Tuesday, dentist Thursday) already known from chat. And when the week collapses, replan
is one tap and zero guilt ("a lighter day is still a good day", M2-01 voice law).

**Consideration time**: minutes; the first drafted week either saves her Sunday or it
doesn't.

## Job stories

- When Sunday night arrives, I want next week drafted around my real commitments, so
  planning takes 10 minutes of editing instead of 90 of authoring.
- When Monday went sideways, I want to say "we did none of it" and get a sane new week,
  so falling behind the plan never becomes falling behind, period.
- When I finalize a week, I want a printable binder page per kid, so the plan lives on
  the fridge, not in an app I have to keep opening.

## Journey: "plan next week" → constraints → draft → edit → binder

**Frame**: P2, Sunday 8:30pm, three kids (4, 7, 10). Job story #1. Entry: chat ("plan
next week") or PlannerView "Auto-plan with HOMA" button (the sketched CTA).

**DESIGN FLAG**: PlannerView sketches one child (Maya) in a 5-day column grid. P2 needs
per-child lanes or a child switcher within the week; the day-column structure holds,
but the multi-child arrangement is undesigned. Also the sketched blocks are
subject-labeled; blocks should carry their linked artifact/activity (tap block → the
worksheet) per the F1/F3 integration.

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Ask | Chat or planner CTA | "Plan next week. Dentist Thursday 2pm." | Loads constraints store (NT-07): recurring (co-op Tue) + parses new one-offs from the message; confirms constraint list in one line | 30s | Delegating, skeptical | Re-asking for known constraints ("what about co-op?") = it never listened | "Got it: co-op Tuesday, dentist Thursday 2pm, lighter Friday like usual" |
| 2. Draft | Planner grid fills per child | Watches | Drafts from: positions + active targets (F3) + what_works pacing + hour targets (F4 pace) + constraint windows; 10yo gets structure-only lanes (no generated materials, F8) | 20–40s | Curiosity | Overstuffed days (the classic planner sin); ignoring nap/energy patterns for the 4yo | Every block explains itself on tap: "word problems, because she's ready (F3 target)" |
| 3. Edit | Drag/swap/delete blocks; "make Wednesday lighter" in chat | 5–10 min of shaping | Edits respected AND remembered as pacing preferences (what_works family-level); totals per day recompute (PlannerView shows day-minute totals) | 5–10 min | Ownership forming | Edits that don't persist to next week's draft = groundhog day | Chat-native editing ("swap math to mornings all week") |
| 4. Commit | "Looks good" | One tap | Week finalized; materials for the week queued for generation (F1) so mornings are print-ready; hours projection updated | 10s | Done, Sunday reclaimed | Generating everything at commit could be slow/costly → queue overnight | "All set. Monday's pages will be ready to print by morning ☀️" |
| 5. Print / binder | Binder view (NT-09): per-child weekly PDF, checklist-styled | Prints 2 pages, fridge + binder | Renders print-safe weekly per child: day rows, activity checkboxes, materials list | 2 min | Tangible control | Same print reality as F1 (NT-01 pipeline shared) | The fridge page is also a marketing artifact other moms SEE |
| 6. Live week | Check-offs (mobile Home check-off celebration per DS motion law), captures | Checks off, or doesn't | Check-offs feed done-signals (F3 attribution, F4 hours); un-done items just sit there, zero nagging | all week | Ordinary | Nagging about undone blocks is the guilt mechanic we banned | The check-off micro-interaction (sage fill, gold star, undoable) is the daily dopamine |

**The moment that decides**: stage 2→3 boundary: the draft respects her stated life
(co-op, dentist, Friday-lighter) on the first render. Constraint fidelity, not
pedagogical brilliance, is what earns the delegation. A plan that collides with the
dentist is 90 seconds from "this thing doesn't actually know us."

**Instrumentation**: `planner.requested` {constraints_parsed: n},
`planner.draft_rendered` {blocks, children, latency_ms}, `planner.block_edited`
{action: move|delete|add|lighten}, `planner.committed` {edits_before_commit},
`planner.binder_printed`, `planner.checkoff` {block_id, child_id},
`planner.replan_requested` {scope}, `planner.week_completion` {pct, computed Sunday}.
**The metric**: % of drafted weeks committed with ≤5 edits (target 60%+), plus weekly
planner retention (weeks with a committed plan / active weeks). **Counter-metric**:
week_completion pct falling while commits stay high = we're generating pretty fiction
she abandons by Wednesday; the planner must optimize for done-rate, not plan-beauty.

**Edge/failure branches**
1. **"We did none of it" Monday** (the flagship edge, sub-journey below).
2. **Constraint conflict** (co-op moved this week only) → one-off overrides never
   mutate the recurring rule without asking; "just this week, or always?"
3. **Two kids, one mom, same hour**: the draft must never schedule two
   parent-intensive blocks concurrently; independent-work blocks (the 7yo reads while
   the 4yo does mom-led letters) are the multi-child solve; violations are a draft
   validity bug (`planner.conflict_detected` should be ~0 post-draft).
4. **Sick day mid-week** → "Ben's sick" in chat → affected days offered a rest-day
   collapse; hours pace re-projected calmly ("still on pace for the year" if true, per
   F4 math); no replan guilt.
5. **The plan is too ambitious for HER week** (she edits 40% away twice in a row) →
   pacing preference learned, next draft starts lighter; never argue with her edits.
6. **Empty commitments store (new family)** → first plan interview is 3 chips, not a
   form ("Any weekly fixtures? co-op / classes / none"); constraints accrete from chat
   thereafter (NT-07).
7. **Print binder with no printer** → same NT-01 fallbacks (email-to-self, "save to
   Files"), plus the plan lives fine in-app; binder is optional by design.

**Ticket map**: M2-10 (weekly plan generation, genericized from build-weekly-plan
skill), M2-09 (activities library), M2-05/M2-06 (queued materials), M3-05 (hours
pacing), M2-08 (dashboard), M1-17 (PlannerView spec). **Gaps**: NT-07 (constraints
store: recurring commitments + one-offs, editable in settings AND accreted from chat),
NT-08 (replan flow), NT-09 (binder/print view).

## Sub-journey: "we did none of it, replan" [GA]

Monday, 7pm, P2: the co-op potluck ate Monday, nobody did anything, the beautiful week
is already dead. This moment decides whether the planner is a tool or an indictment.

1. She says (or taps on the planner): "we did none of it today."
2. Homa, reassurance BEFORE information (copy-kit law): "That happens, one day off
   doesn't move the needle. Want me to reflow the week, or just let Monday go?"
   Two options max: **Reflow** · **Let it go**.
3. **Let it go**: Monday's blocks quietly archive (not struck-through in red, not
   carried as debt); week proceeds; hours math absorbs it (a lighter week is legal).
4. **Reflow**: essentials-first redistribution (active F3 targets and any
   compliance-critical minimums move; enrichment shrinks); Tuesday does NOT become a
   double day by default; the reflowed week renders as a normal plan, not a make-up
   plan. `planner.replanned` {trigger: none_done, mode}.
5. Either way, the journal quietly notes the potluck day if she mentioned it (F2), and
   NO record of "plan abandonment" ever surfaces to her. The counter-metric team sees
   aggregate replan rates; the mom sees a clean week.

## User stories

**F5-S1 · Constraint-aware weekly draft**

As P2, I want next week drafted around my stated commitments, so the plan fits my life
on the first render.

- Scenario: happy path
  - Given a family with recurring constraint "co-op Tuesdays 9–1" and a new message "dentist Thursday 2pm"
  - When the parent requests next week's plan
  - Then the draft schedules no instructional blocks inside either window across all children and `planner.draft_rendered` fires with `constraints_respected: 2`.
- Scenario (negative): constraint collision in draft
  - Given the same constraints
  - When any generated block overlaps a constraint window
  - Then the draft is rejected pre-render by the validity check and regenerated (mom never sees the collision), with `planner.conflict_detected` logged for engineering.
- Notes · Dependencies: M2-10, NT-07. Instrumentation: constraints_respected vs parsed is a draft-quality KPI.

**F5-S2 · Edits persist as pacing preferences**

As P5, I want my repeated edits to shape future drafts, so I edit less every week.

- Scenario: happy path
  - Given a parent who removed Friday-afternoon blocks in two consecutive committed weeks
  - When the third week is drafted
  - Then Friday afternoons are left open by default and the draft notes it ("kept Friday light, like you do").
- Scenario (negative): preference vs one-off disambiguation
  - Given a single-week deletion (dentist week)
  - When the next draft is generated
  - Then the one-off deletion does NOT become a standing preference (rule: 2+ occurrences before generalizing).
- Notes · Dependencies: M2-10, M2-02 (family what_works), NT-07. Out of scope: explicit preference settings UI (chat-accreted only at GA).

**F5-S3 · One-tap zero-guilt replan**

As P2, I want to declare a lost day and get a sane adjusted week, so a bad Monday never
compounds into a guilty week.

- Scenario: happy path
  - Given a committed week where Monday's blocks are all unchecked
  - When the parent selects "we did none of it" and chooses Reflow
  - Then a redistributed week renders with active practice targets preserved, no day exceeding its prior planned minutes by more than 25%, and `planner.replanned` fires {mode: reflow}.
- Scenario (negative): let-it-go leaves no debt
  - Given the same state
  - When the parent chooses "Let it go"
  - Then Monday's blocks archive without any overdue/missed state visible on any surface, and week-completion metrics count them as released, not failed.
- Notes · Dependencies: NT-08. Non-functional: replan render <15s; copy per reassurance law (CI-testable strings per M1-17).

**F5-S4 · Printable binder week per child**

As P2, I want a print-ready weekly page per child, so the plan works on the fridge for
people who never open apps (Marcus, Grandma Sue).

- Scenario: happy path
  - Given a committed week for 3 children
  - When the parent taps "print binder"
  - Then one letter-format PDF renders with a page per child (day rows, checkbox per activity, materials list), margin-safe per NT-01, and `planner.binder_printed` fires.
- Scenario (negative): out-of-range child page
  - Given the 10-year-old with a structure-only lane (no generated materials)
  - When the binder renders
  - Then his page shows his planned blocks and hours checkboxes without any placeholder/apology for missing materials (honest, not broken-looking).
- Notes · Dependencies: NT-09, NT-01, F8/NT-05. Delight: this artifact is organic marketing at co-op; include the small Homa mark per brand spec.

---

# F6. Discover / local connector [POST-GA]

## Use case

**Problem**: "I know the museum probably has something that fits what we're learning,
but finding out costs 45 minutes of tabs, and I always find out about story hour the
day after."

**Persona**: Primary P1 (urban, enrichment-driven; the origin feature: the Mac Mini's
"DC events scout"). Secondary P2 (co-op world, cheaper outings, rainy-day with three
kids). P3 uses it for "we're allowed to just go places, that's school too" permission.

**Alternatives**: library/museum newsletters (generic, unread), local mom Facebook
groups (chaotic firehose), Google + a hopeful search ("things to do with kids near me"),
co-op word-of-mouth (best current source; Homa should augment, not compete).

**Frequency**: 1–3 outings/week is the homeschool rhythm; suggestion consumption is
weekly (planner time) + spontaneous (rainy morning).

**Why Homa**: suggestions are *lesson-matched* ("Matched to what you're teaching, not
just what's nearby", DiscoverView's own tagline): space week → planetarium Saturday;
penguin unit → the zoo has them. Nobody else knows both the curriculum-of-the-week and
the town. And it's capped-by-design: never spammy (00 §product principle 2: proactive
but earned).

**Consideration time**: seconds per suggestion; the trust decision ("does Homa get to
know my location?") is a one-time considered consent.

## Job stories

- When we're deep in a unit, I want to hear about the one local thing that matches it
  this week, so learning leaves the kitchen table without me doing research.
- When it's raining and the morning plan died, I want a viable indoor option now, so a
  bad-weather day doesn't become a screen day.
- When Homa suggests outings, I want them rare and right, so I keep opening them.

## Journey: lesson-matched outing ("space week → planetarium")

**Frame**: P1, mid space-unit week. Entry: one line in the weekly plan (M3-12 spec:
"surfaces as suggestions in chat + one line in the weekly plan") and the Discover
surface (DiscoverView).

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 0. Consent (once) | Settings / first-suggestion prompt | Grants metro-level location | Asks plainly: metro area only, what it's used for, off-switch shown at the same moment (NT-10); default OFF until granted | 30s | Guarded | Creepy precision ("near 4512 Elm St") kills it; ask for a metro, not a pin | "I'll only use your metro area to spot outings. Turn it off anytime" |
| 1. Match | Weekly research pass per metro (M3-12: weekly-plan schedule; content quarantined per S1-style rules) | Nothing | Joins: active unit topics × local events/venues × family constraints (co-op day excluded) | 0 | n/a | Stale events (already-passed dates) = instant credibility loss; date-validity check mandatory | The join IS the magic: "Maya's astronomy week lines up with the Bullock's space day" |
| 2. Suggest | Discover card (eyebrow: "Maya · Space unit") + one weekly-plan line; ≤2 lesson-matched suggestions/week (cap, NT-10) | Reads 10 seconds | Card: what, when, why-it-matches, cost; actions per DiscoverView: primary ("Plan it") + soft decline ("Not this week") | 30s | Pleasant surprise | Frequency creep = spam = mute; caps are LAW not tuning | Decline is respected visibly; "not this week" ≠ "never" |
| 3. Plan | "Plan it" → planner slot Saturday + prep offer | One tap | Adds outing block (F5); offers the tie-in: "want the observation sheet packed?" (DiscoverView's "I'll pack the observation sheet") | 30s | Organized | Ticketing/purchase is OUT of scope v1 (DESIGN FLAG: DiscoverView's "Want me to hold tickets?" overpromises; v1 links out to the venue) | The prep sheet makes an outing a lesson with zero effort |
| 4. Go + close the loop | The outing; a voice capture after ("planetarium was a hit, she asked about black holes for an hour") | Lives it; maybe captures | Capture routes (F2): journal + interest signal ("black holes") to what_works + possibly hours (field trip); next unit's materials can ride the new interest | half a day | The good life she homeschools FOR | - | Weekly note: "the planetarium fed straight into her black-hole questions, field trips count" |

**The moment that decides**: stage 2, the first suggestion's *fit*: right topic, right
child, feasible date, real event. One stale or generic suggestion ("Things to do in
Austin!") reclassifies the whole surface as marketing noise. Quality bar: better to
show nothing than a weak match (empty state is designed: "nothing worth your Saturday
this week, I'll keep looking").

**Instrumentation**: `discover.consent_granted/revoked` {granularity},
`discover.suggestion_shown` {type: lesson_matched|nearby|rainy_day, unit_topic},
`discover.suggestion_actioned` {action: planned|declined|muted},
`discover.outing_captured` (F2 join), `discover.caps_hit` {suppressed: n}. **The
metric**: suggestion→planned rate ≥25% for lesson-matched cards. **Counter-metric**:
mute/consent-revoke rate and decline-streaks; 3 declines in a row on a category
auto-quiets that category (self-throttling, NT-10); if caps_hit trends up while
actioned trends down, the engine is generating volume, not value.

**Edge/failure branches**
1. **Event data is wrong/stale** (moved, sold out, wrong hours) → date/source validity
   checks pre-surface; post-hoc "that was wrong" feedback removes source credibility
   and apologizes plainly; venue links always present so she can verify.
2. **No-consent family** → Discover shows evergreen non-located content (rainy-day
   home activities from the library) + a calm re-offer at most quarterly; feature
   degrades gracefully, never nags for location.
3. **Rural family, thin metro** (P2) → honest sparse mode: fewer, farther suggestions
   with drive times; co-op and library-system content weighted up; never pad with
   irrelevant filler.
4. **Injected/malicious web content in event listings** → M3-12 inherits S1-style
   quarantine: typed fields only from research (name/date/venue/url), no prose
   pass-through to prompts (09 §S1 pattern, M2-14 scope includes web-research content).
5. **Suggestion collides with family reality** (suggests Saturday; family churches
   Saturdays) → constraints store (NT-07) consulted; declines teach timing preferences.
6. **Cost sensitivity** (P2 single income) → cost is always on the card; free-first
   ordering as a family preference learned from actioned history.

**Ticket map**: M3-12 (local discovery engine: per-family metro web-research on weekly
schedule → later cached per-metro library), M2-09 (activities library for evergreen),
M2-14 (web content scanning), NT-07 (constraint awareness), M5-08 (co-op finder,
adjacent), M5-09 (moms network: the DiscoverView "4 HOMA families within 5 miles" card
is M5-09 scope, NOT M3-12; DESIGN FLAG: kit implies it ships together, backlog says
post-traction). **Gaps**: NT-10 (consent + frequency-cap + category-mute preference
system; M3-12 mentions none of the never-spammy machinery).

## User stories

**F6-S1 · Lesson-matched suggestion with capped frequency**

As P1, I want at most a couple of outing suggestions a week matched to what we're
studying, so Discover stays a treat rather than a feed.

- Scenario: happy path
  - Given a child with an active "space" unit and a consented metro
  - When the weekly discovery pass finds a planetarium event within the metro on a free day
  - Then one suggestion card renders naming the child, the unit, the event date and cost, and `discover.suggestion_shown` fires {type: lesson_matched}.
- Scenario (negative): cap enforcement
  - Given two lesson-matched suggestions already shown this week
  - When the pass finds a third qualifying event
  - Then it is suppressed (held for next week if still valid), `discover.caps_hit` increments, and no third card renders on any surface.
- Notes · Dependencies: M3-12, NT-10. Instrumentation: caps are code, not prompt guidance; testable.

**F6-S2 · Location consent, metro-granularity, revocable**

As P2, I want to grant only my metro area and switch it off anytime, so local
suggestions never cost me privacy comfort.

- Scenario: happy path
  - Given a family that has never granted location
  - When the first Discover visit occurs
  - Then suggestions are non-located, a single plain-language consent offer explains metro-only use with the off-switch shown, and `discover.consent_granted` fires only on explicit accept.
- Scenario (negative): revocation propagates
  - Given a consented family that revokes in settings
  - When the next discovery pass runs
  - Then no location-derived content is generated or shown, stored metro data is deleted per retention schedule (M4-12), and `discover.consent_revoked` fires.
- Notes · Dependencies: NT-10, M4-04/M4-12. Non-functional: metro string only; no precise geolocation stored anywhere.

**F6-S3 · Rainy-day rescue**

As P2, I want an instant viable indoor option when the day collapses, so bad weather
has a play other than screens.

- Scenario: happy path
  - Given a consented family and the parent asks "it's pouring, ideas?"
  - When Homa responds
  - Then it offers one local indoor option (open now, cost shown) and one at-home activity tied to a current unit, and `discover.suggestion_shown` fires {type: rainy_day}.
- Scenario (negative): nothing good nearby
  - Given a thin metro with no verifiable open venue
  - Then only the at-home option is offered with honest framing ("nothing local worth the drive today"), never a padded or unverified listing.
- Notes · Dependencies: M3-12, M2-09. Reactive (asked-for) suggestions don't count against proactive caps.

---

# F7. Curriculum comparison [POST-GA]

## Use case

**Problem**: "I've had 14 tabs open for two weeks deciding between Heggerty and Logic of
English for phonics. Reviews are written for someone else's kid. I'm about to spend
$150+ and a school year on a guess." (❓Q8: "Hegg" in the brief read as Heggerty,
confirm.)

**Persona**: Primary P3 (the newcomer's first big purchase decision, peak
second-guessing). Secondary P2 (re-deciding for kid #2 who learns differently), P1
(supplement shopping).

**Alternatives**: Cathy Duffy reviews (encyclopedic, not personalized), Facebook groups
("we love LOE!!" n=1 enthusiasm), curriculum fairs (annual, overwhelming), buying both
(expensive), analysis paralysis (the actual default).

**Frequency**: 1–3 heavy decisions/year per family (curriculum season: spring/summer)
plus mid-year rescue swaps when something isn't working.

**Why Homa**: the recommendation is *fit-matched to this child*: it reads the profile
(position: where he actually is in phonics) and what_works (modality: hands-on,
resists worksheets) and answers like the veteran friend: "for how Theo learns, here's
the fit, here's the trade, here's the cost." Positioned against curriculum-box anxiety
(M3-13 spec), anchored against the $300–800/yr curriculum spend (M4-07).

**Consideration time**: days-to-weeks by nature; Homa's job is compressing a two-week
tab spiral into one grounded conversation.

## Job stories

- When I'm choosing between two curricula, I want them compared against how MY kid
  learns and where he actually is, so the decision stops being a coin flip.
- When a curriculum isn't landing mid-year, I want to know whether to push through or
  switch, so I don't sink a year into sunk cost.

## Journey: "Heggerty vs Logic of English?"

**Frame**: P3, evening research spiral, asks in chat. Entry: chat; renders into the
Curriculum surface (CurriculumView is the build spec: side-by-side cards, fit badges,
approach/time/cost rows, italic per-child take, "Try a sample week", the no-one-right-
answer Callout).

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Ask | Chat: "Heggerty or Logic of English for phonics?" | One question, weeks of anxiety behind it | Confirms the child + goal; pulls profile position (phonics subdomains) + what_works modality facts | 20s | Hopeful skepticism | Generic blog-post answer = instantly worse than her tabs | "For Theo specifically, let me lay it out" |
| 2. Compare | CurriculumView cards: approach, daily time, cost/yr, fit badge (Great fit / Good stretch / Different style, per kit) | Reads both cards | Facts from the dated practice-library proposal plus quarantined web research (M2-14); the *take* line is personalized: "Theo learns by doing; LOE's tiles match how he already plays with sounds" | 2–3 min | Clarity arriving | Wrong facts (price, scope) torch trust; every fact needs a source + as-of date | Fit reasoning cites HER OWN observations back to her ("you told me he resists worksheets, Heggerty is oral-first, that matters here") |
| 3. Recommend | Fit-matched lead card + honest trade-offs | Weighs | One recommendation, hedged honestly, never absolute; the Callout law: "there's no one right answer, there's the right fit for this kid, this year" | 1 min | Permission to decide | Overconfidence (she'll blame Homa if it flops); underconfidence (no help at all) | Names the failure mode: "if he hits a wall with LOE it'll be the writing load, here's the workaround" |
| 4. Try | "Try a sample week" → generated sample plan slotted into next week (F5) | Runs a low-stakes trial | Builds a representative week from the curriculum's approach + her schedule; feedback captured (F2) tagged to the trial | 1 wk | Empowered, de-risked | A bad sample week misrepresenting the curriculum is unfair to it AND her | The trial converts a $150 gamble into a free experiment |
| 5. Decide + fold in | Post-trial check-in | Picks | Folds the pick into the planner spine (CurriculumView Callout: "I'll fold whichever you pick straight into the planner"); purchase happens on the vendor's site (no marketplace v1, M5-05 icebox) | 5 min | Decision fatigue GONE | - | Six weeks later the efficacy loop (F3) reports how the pick is landing: full circle |

**The moment that decides**: stage 2, when the take-line quotes her own child back at
her. The instant the comparison uses a fact SHE gave Homa ("he resists worksheets"),
this stops being a review aggregator and becomes counsel. Generic comparisons are
everywhere; grounded ones exist nowhere else.

**Instrumentation**: `curriculum.compare_requested` {options: n, subject},
`curriculum.comparison_rendered` {facts_cited, profile_facts_used},
`curriculum.sample_week_started/completed`, `curriculum.decision_recorded` {choice,
followed_recommendation: bool}, `curriculum.midyear_rescue_requested`. **The metric**:
comparison → sample-week-started rate (≥30%) and decision-recorded rate. **Counter**:
`followed_recommendation` correlated with 6-week efficacy signal (F3): if kids on
recommended fits don't outperform non-recommended picks, the fit model is astrology
and must be fixed or humbled.

**Edge/failure branches**
1. **Curriculum not in the practice library** → honest: web-research-only answer,
   clearly labeled lower-confidence, facts cited; `curriculum.library_miss` drives
   library growth by demand.
2. **Both options are poor fits** → say so + offer a third ("neither is built for how
   he learns; have you seen X?"), never force a binary.
3. **Price/edition facts drift** (curricula reprice yearly) → facts carry as-of dates;
   any user-flagged error corrects the library fleet-wide (quarantine review path).
4. **Mid-year rescue** ("we're 4 months into Saxon and she cries") → sunk-cost-aware
   counsel: switch criteria, salvage options, and NO retroactive "I told you so" if
   Homa recommended it; `curriculum.midyear_rescue_requested`.
5. **Vendor bias suspicion** → v1 has no affiliate revenue; state it in the surface
   footer ("Homa doesn't earn from any curriculum"). ❓Q9: keep it that way?
6. **Religious/secular fit dimensions** → surface as neutral facts (the homeschool
   market splits hard here); family preference stored once, respected always, never
   editorialized.

**Ticket map**: M3-13 (curriculum comparison advisor), M2-12 (curriculum ingestion:
photo → lesson plan, adjacent), M2-02 (what_works reads), M2-14 (web research
quarantine), M2-10/F5 (sample week + fold-in), M4-07 (positioning: curriculum-spend
anchor). **Gaps**: none new; NT-07 reused. The curriculum facts library (curriculum-
reviews.md pattern, per-title structured facts) is implicitly inside M3-13; flag its
data-curation cost in sizing.

## User stories

**F7-S1 · Fit-matched side-by-side comparison**

As P3, I want two curricula compared against my child's profile and learning style, so
I decide from fit, not forum enthusiasm.

- Scenario: happy path
  - Given a child with phonics position data and what_works fact "resists worksheets, oral-first"
  - When the parent asks "Heggerty or Logic of English?"
  - Then a comparison renders both options with approach/time/cost (sourced, as-of dated) and a per-child fit take citing ≥1 stored profile or what_works fact, and `curriculum.comparison_rendered` fires with `profile_facts_used ≥ 1`.
- Scenario (negative): unknown curriculum
  - Given a comparison request including a title absent from the practice library
  - When the comparison renders
  - Then that option is clearly labeled as web-research-only with lower confidence, no fabricated pedagogy facts appear, and `curriculum.library_miss` fires.
- Notes · Dependencies: M3-13, M2-02, M2-14. Non-functional: every factual row carries a source.

**F7-S2 · Free sample week de-risks the purchase**

As P3, I want to trial a curriculum's rhythm for a week before buying, so a $150
decision becomes an experiment.

- Scenario: happy path
  - Given a rendered comparison
  - When the parent taps "Try a sample week" on an option
  - Then a representative week is drafted into the planner honoring family constraints, tagged to the trial, and `curriculum.sample_week_started` fires.
- Scenario (negative): trial abandoned
  - Given a sample week with zero check-offs by day 4
  - When the post-trial check-in would send
  - Then it asks one neutral question ("didn't get to it, or didn't like it?") instead of presenting trial "results", and no fit conclusion is drawn from an unrun trial.
- Notes · Dependencies: M3-13, M2-10, NT-07. Out of scope: vendor content licensing (sample week mimics approach/rhythm, never reproduces copyrighted materials, flag for M4-04 review ❓Q10).

**F7-S3 · Decision recorded and efficacy-tracked**

As P2, I want Homa to remember what we chose and later show whether it's working, so
curriculum decisions join the efficacy loop.

- Scenario: happy path
  - Given a recorded decision ("Logic of English, chosen 2026-08-01")
  - When 6 weeks of usage signals accumulate
  - Then the weekly note can reference the curriculum's trajectory in growth framing ("phonics has moved steadily since LOE started"), and `curriculum.decision_recorded` links to the F3 attribution window.
- Scenario (negative): it isn't working
  - Given 6 weeks of flat-or-negative signal with done-work present
  - When the parent asks "is LOE working?"
  - Then Homa answers honestly with the data, offers the mid-year-rescue path, and never defends its own prior recommendation over the child's data.
- Notes · Dependencies: M3-11, M3-13, M3-01. This story is the connector between F7 and the selling point (F3).

---

# F8. Multi-child orchestration [M-R]

## Use case

**Problem**: "Every app assumes one student. I have three. I say 'she finished her
reading' and mean the 7-year-old; my planner day has three lanes and one of me; and
the 10-year-old exists too, even if he's 'too old' for the cute features."

**Persona**: Primary P2 (Rachel: 4, 7, 10; THE median family per council: 2–3 kids,
5–12). Every multi-child family hits all of this; P2's 10yo is the honest-limits stress
case (09 §call-3: v1 asset serves 2–7; signup must handle out-of-range gracefully
either way).

**Alternatives**: one tracker account per kid (nobody does this twice), a single
shared log with "which kid?" chaos, the oldest kid falling out of the system entirely
(the quiet default, and a guilt source).

**Frequency**: Constant; it's not a feature but a property of every interaction above.
Disambiguation moments: several per day. Shared activities: daily (read-alouds, field
trips, co-op).

**Why Homa**: per-child profiles ARE the product (the moat); orchestration is what
makes them livable at n>1: cheap disambiguation etiquette (M2-11), one
capture fanning out to multiple profiles, per-child context everywhere, and honesty at
the range boundary instead of pretending or excluding.

**Consideration time**: none in-product; at purchase, P2 checks "does the price cover
all three?" (❓Q11: per-family pricing confirmed? 08 implies family plans; stories
assume family-scoped).

## Job stories

- When I mention "she" in a family of two girls, I want Homa to resolve it cheaply or
  ask once, so talking about my kids stays natural.
- When all three do something together, I want to log it once and have it count
  correctly for each, so shared life isn't triple data entry.
- When my 10-year-old is outside the benchmark range, I want Homa useful and honest
  about him, so no child of mine is invisible in the system I pay for.

## Journey: one mom, three kids, one chat

**Frame**: P2, a normal Tuesday: co-op morning, afternoon at home. Entry: chat + voice
throughout the day. This journey is a day-in-the-life across the features above.

| Stage | Touchpoints | What she does | What Homa does | Time | Emotion | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| 1. Morning context | Chat greeting | "What's today look like?" | Renders the day across all three lanes (F5), 10yo's lane structure-only; child chips for quick switching | 30s | Oriented | A wall of three-kid detail = noise; summarize then expand | "Co-op till 1. This afternoon: letters with Sadie, word problems with Ben, and Caleb's history reading" |
| 2. Ambient capture | Voice note: "she read the whole Frog and Toad chapter alone" | Speaks naturally | Disambiguation etiquette (M2-11): resolve by context first (reading level fits the 7yo, not the 4yo); if confidence high → route with the guess VISIBLE in the chip ("Ben? · reading ↑"); if low → one cheap chip question, never a form | 10s | Natural | Asking every time = talking to a bureaucrat; guessing wrong on PROFILE writes = data corruption (rule: guess on journal, ask for profile) | The chip makes the guess auditable at a glance |
| 3. Shared activity | "All three did the volcano experiment, maybe 45 minutes" | One capture | Fan-out (NT-06): journal once (family entry), hours 45min × applicable per-child state buckets, observation per child ONLY where individually evidenced (no cloned observations); confirmation names all: "Logged for all three · science hours each" | 10s | Efficient | Cloning one observation to 3 profiles fabricates evidence; hours yes, profile deltas only with per-child signal | One sentence = three correct ledgers |
| 4. Per-child depth | Dashboard child switcher (DESIGN FLAG: DashboardView sketches single-child "Maya's progress"; needs a family-level home with per-child cards → drill-in) | Checks Ben's math | Full per-child context loads; cross-child comparison is NEVER rendered (no sibling leaderboards, reassurance law applies between kids too) | 1–2 min | Focused | Any UI juxtaposing siblings' positions invites the comparison anxiety we exist to calm | Family view shows each kid's ONE highlight, not their rankings |
| 5. The 10-year-old | Caleb's lane: hours, journal, planner structure; no benchmarks/materials | Logs his day like the others | Honest boundary (NT-05): set at signup ("I don't have materials for 10-year-olds yet; I'll track hours and journal for Caleb, and the moment I grow older-kid support you'll be first to know"); never a broken-feeling stub | ongoing | Included-enough, honest | Discovering the limit mid-use (worse) vs at signup (fine); any fake "coming soon" UI rot | His hours/compliance are FULLY first-class (P2's legal need covers all three, F4) |
| 6. Evening | Journal prompt (M2-07) | One reply covers the day | Routes fragments to the right kids (steps 2–3 machinery); weekly notes are per-child but arrive as ONE email (fatigue law) | 2 min | Day closed | Three separate emails = spam; one blended blob = nobody's story; sectioned single note | Each child gets a named win in the note |

**The moment that decides**: stage 3, the shared-activity fan-out confirmation. "Logged
for all three" in one breath is the moment a three-kid mom knows this was built for
her family shape, not adapted from a one-student app. Its inverse (logging the volcano
three times) is the moment she knows it wasn't.

**Instrumentation**: `family.disambiguation` {mode: resolved|guessed|asked, correct:
bool?}, `family.child_switched` {surface}, `family.shared_capture` {children: n,
routes}, `family.out_of_range_boundary_shown` {surface},
`voice.undo` (child-attribution corrections tagged), per-child capture balance
(captures per child / week). **The metric**: multi-child families' week-4 retention
delta vs single-child (parity or better = orchestration works). **Counter-metric**:
capture balance skew: if the youngest gets 80% of captures, the system is quietly
making the older kids invisible (the exact guilt we must not add); surface in
concierge review, and eventually as a GENTLE self-serve nudge at most.

**Edge/failure branches**
1. **Wrong-child guess discovered late** ("that reading note was Sadie, not Ben") →
   correction moves ALL derived writes (journal attribution, observation, hours) via
   the F2-S3 atomic machinery; `family.disambiguation` retro-marked incorrect; guessing
   threshold auto-tightens for that family.
2. **Two kids share a name-sound** ("Kay/Kaye") or nickname collisions → roster
   nickname table (each child's aliases, set at onboarding + accreted); transcription
   biasing (F2 stage 2) uses it.
3. **A capture is about the family, no child** ("we're all fried, taking Friday off")
   → routes journal + planner signal (F5 lighter-week), no child attribution forced.
4. **New baby / mid-year child added** → add-a-child flow reuses M2-03 (form + 4-question
   wow + drip); existing family context untouched; sibling constraints (nap schedule)
   enter NT-07.
5. **The 10yo turns out to be the PRIMARY need** (she came FOR the older kid) →
   detected at signup (only out-of-range kids entered) → honest pre-purchase screen:
   what works today for him (hours/journal/planner/reports), what doesn't
   (materials/benchmarks), and the M5-06 intention WITHOUT a date promise. Do not take
   her money on a misunderstanding; this is a refund-and-review magnet otherwise.
6. **Sibling privacy inside the family** → v1: one family account sees all children
   (parents + S2 Marcus per M1-01 principal); no per-child access partitions until a
   real need (deferred, noted for M5).
7. **Cross-child what_works bleed** (Ben's dinosaur obsession leaking into Sadie's
   materials) → what_works is per-child by schema (M2-02); family-level facts (pacing,
   printer, values) live in a separate family store; tests assert no cross-child
   retrieval (M1-07 suite includes intra-family scoping, not just cross-family).

**Ticket map**: M2-11 (disambiguation etiquette), M2-02 (per-child +
family-level memory separation), M2-07 (routing), M2-03 (add-a-child), M1-01/M1-02
(family principal, schema), M3-05 (per-child hours in one family ledger), M5-06
(age-range expansion: the real fix for Caleb). **Gaps**: NT-05 (out-of-range honesty:
signup screening + in-product boundary UX + feature-matrix config that flips when
M5-06 lands), NT-06 (shared-activity fan-out: one capture → N children with per-child
route rules).

## User stories

**F8-S1 · Cheap, safe pronoun disambiguation**

As P2, I want "she" resolved from context or clarified with one tap, so chatting about
three kids stays as natural as texting.

- Scenario: happy path
  - Given a family with children Sadie (4), Ben (7), Caleb (10) and a message "she read a whole chapter alone"
  - When routing must attribute the observation
  - Then if contextual confidence exceeds the profile-write threshold the note routes to the inferred child with the child named in the confirmation chip; otherwise exactly one chip question ("Sadie or Ben?") is asked, and `family.disambiguation` fires with the mode.
- Scenario (negative): profile writes never ride a guess
  - Given contextual confidence below the profile-write threshold
  - When the parent ignores the clarifying chips
  - Then the capture persists as an unattributed journal entry (recoverable later), no child profile or hours write occurs, and the chip remains answerable from the journal view.
- Notes · Dependencies: M2-11, M2-13, NT-03. Instrumentation: guessed-and-corrected rate <3% steady-state; the threshold is family-adaptive.

**F8-S2 · Shared activity logged once, counted per child**

As P2, I want one capture of a shared activity to update each child correctly, so
family learning isn't triple entry.

- Scenario: happy path
  - Given the capture "all three did the volcano experiment, about 45 minutes"
  - When routing completes
  - Then one journal entry exists referencing three children, an hours row of 45 minutes exists per enrolled child in the science bucket, no per-child observation is written without child-specific evidence in the capture, and `family.shared_capture` fires {children: 3}.
- Scenario (negative): partial participation
  - Given the capture "the big kids did the experiment, Sadie napped"
  - When routing completes
  - Then hours accrue only for Ben and Caleb, Sadie's ledger is untouched, and the confirmation chip names exactly who was counted.
- Notes · Dependencies: NT-06, M2-07, M3-05. Non-functional: fan-out writes are one transaction (partial fan-out = corruption).

**F8-S3 · The out-of-range child, honest and useful**

As P2, I want Homa to serve my 10-year-old with hours, journal, and planning while
being upfront about what it can't do yet, so no child is invisible or oversold.

- Scenario: happy path
  - Given Caleb (age 10) added during signup
  - When his profile is created
  - Then the boundary is stated at creation in Homa's voice (what works for him now, what doesn't yet), his lanes appear in planner/journal/hours/reports fully functional, and `family.out_of_range_boundary_shown` fires {surface: onboarding}.
- Scenario (negative): materials request for an out-of-range child
  - Given Caleb's profile
  - When the parent asks "make Caleb a fractions worksheet"
  - Then Homa declines honestly without generating off-benchmark content, restates what it CAN do for him, offers a non-generated alternative (e.g., a planner block + library activity), and `materials.out_of_range_declined` fires.
- Notes · Dependencies: NT-05, M5-06 (removes the boundary later; the feature matrix must be config, not code). ❓Q5 pricing: out-of-range kids shouldn't count against per-child pricing if pricing is per-child (assumed family-flat).

**F8-S4 · One weekly note, every child seen**

As P2, I want a single weekly note with a real section per child, so I get everyone's
story without email spam.

- Scenario: happy path
  - Given a 3-child family at week's end
  - When the weekly note sends
  - Then it is one email with a named win per child (including out-of-range Caleb from journal/hours), strengths-first per child, max one nudge total across the whole note (fatigue law), and note analytics record per-section engagement.
- Scenario (negative): a silent child-week
  - Given a week with zero captures referencing Sadie
  - When the note renders
  - Then Sadie's section acknowledges the quiet week without guilt ("a quiet week for Sadie's log, nothing needed") and never fabricates activity, and the concierge/ops view flags capture-balance skew.
- Notes · Dependencies: M3-02, M2-11. The no-fabrication rule is absolute: an invented win, once caught, ends trust in every note.

---

# Consolidated NEW-TICKET list (vs 03-backlog.md)

| ID | Title | Feature | Tag | Size (est) | Why it's a gap |
|---|---|---|---|---|---|
| NT-01 | **Print pipeline & preflight**: margin-safe preflight (letter+A4), shrink-to-fit-safe layouts, "printed wrong?" one-tap reprint, print-help walkthrough (AirPrint), email-to-self fallback | F1, F5 | [M-R] | M | M2-05 adopts the DS PDF template but nothing owns the phone-to-printer reality or the defect-recovery loop; the wow moment dies at the printer |
| NT-02 | **Feedback reason capture**: 👎 reason chips → structured what_works entries; regenerate-with-fix; feedback-loop-breach guard (F1-S4) | F1 | [M-R] | S | M2-05 wires 👍/👎; the reason taxonomy, regenerate action, and repeat-ignored-feedback guard are unspecified |
| NT-03 | **Routing confirmation & correction UI**: named-effect chips, atomic undo across all routed writes, re-route picker, family-scoped router few-shot store, routing-conflict handling | F2, F4, F8 | [M-R] | M | M2-07 routes and M2-13 surfaces profile writes, but the unified chip/undo/correction UX and the router-learning store are unticketed; this IS the capture habit |
| NT-04 | **Benchmarks surface** (BenchmarksView build): domain check-in checklist flow, standing cards, growing-now module, dispute-and-re-evidence flow; v1 domain (not grade-subject) labeling | F3 | [M-R data / GA product] | L | M2-04 computes, M2-08 renders a dashboard, M1-17 ports components; the check-in interaction and its scoring UX have no owner ticket |
| NT-05 | **Out-of-range child handling**: signup screening + honest boundary copy, feature-matrix config per age, only-out-of-range-kids pre-purchase screen, flips with M5-06 | F8, F1, F3 | [M-R] | M | 09 §call-3 says "signup must handle out-of-range kids gracefully either way" but no ticket exists |
| NT-06 | **Shared-activity fan-out**: one capture → N children; per-route rules (hours: all participants; observations: only with per-child evidence); transactional writes | F8, F2, F4 | [M-R] | S | M2-11 covers disambiguation etiquette only; multi-attribution write semantics are undefined |
| NT-07 | **Constraints store**: recurring commitments + one-offs, chat-accreted + settings-editable, consumed by planner and discover | F5, F6, F7 | [GA] | M | M2-10 says "schedule from tenant config" without an intake/storage/edit design |
| NT-08 | **Replan flow**: "we did none of it" → reflow vs let-go; essentials-first redistribution; zero-debt archival of released blocks | F5 | [GA] | M | M2-10 generates; nothing handles the (universal) plan-collapse loop |
| NT-09 | **Planner binder/print view**: per-child weekly printable, checklist-styled, shares NT-01 pipeline | F5 | [GA] | S | Unticketed; PlannerView sketches screen-only |
| NT-10 | **Discover consent & frequency governance**: metro-only location consent + revocation-with-deletion, hard suggestion caps, category mutes, decline-streak self-throttling | F6 | [POST-GA, but consent design reviewed with M4-04] | M | M3-12 builds the engine; none of the never-spammy/privacy machinery is specified anywhere |
| NT-11 | **Shareable proof card**: exportable before/after artifact from M3-11 with privacy-safe defaults (first name only, optional anonymized) | F3 | [POST-GA] | S | M3-11 renders in dashboard/note; the word-of-mouth artifact (00 §value stack) deserves a deliberate share surface |
| NT-12 | **Compliance evidence locker**: immutable filed-report archive, tap-any-number provenance viewer, ruleset snapshot as-of filing, exempted from short retention TTLs, included in M4-05 export | F4 | [GA; concierge-manual in M-R] | M | M3-06 generates reports; the audit-anxiety UX (provenance + immutability) is the actual P4 value and is unticketed |

Also recommended (not new tickets, acceptance-criteria amendments):
- **M1-07**: add intra-family scoping probes (cross-child what_works bleed, F8 edge 7).
- **M3-02**: single-email multi-child sectioning + max-one-nudge-per-note as testable criteria (F8-S4).
- **M3-12**: date-validity and venue-link requirements; "hold tickets" language removed until purchase agency exists (DESIGN FLAG, F6).
- **M2-05**: `materials.out_of_range_declined` behavior (F8-S3) as acceptance criteria.

# ❓ Open questions for the founder

> Historical question set. Q3 below concerns uploaded child audio, not voice-call
> transcript retention. Current rulings are indexed in
> `journeys/10-reconciliation.md` section 5.

1. **Credit visibility in generation UX** (Sidney call #2, 09): the F1 journey assumes
   per-artifact consideration ≈ 0. If visible credit pricing ships, stage-1 UX needs a
   price affordance and the F1 metric targets drop. Which way?
2. **Print-defect reprints**: always free (my recommendation: yes, it's our layout bug
   or an acceptable COGS goodwill) even under the credit model?
3. **Child voice in recordings** (09 §call-4): confirm option (a) posture and the
   exact behavior when child speech is detected as primary speaker (transcribe-and-
   discard-audio vs decline). F2 edge 3 assumes transcribe + gentle one-time policy note.
4. **Router learning from corrections across families**: family-scoped few-shots are
   assumed (NT-03). Is cross-family router training ever acceptable, and under what
   privacy review?
5. **Age-range ICP** (09 §call-3): F8/NT-05 implements graceful handling either way,
   but marketing copy, signup screening strictness, and the only-older-kids purchase
   screen depend on the (a) preK–2 focus vs (b) minimal 8–12 track decision.
6. **Reconstructed hours** (F4 edge 1): is "reconstruct with my help, permanently
   flagged" acceptable compliance posture, or should gaps only ever be marked as
   breaks? Needs the M4-04 lawyer pass.
7. **Legal-information framing**: exact disclaimer copy and placement for state-rule
   answers (F4-S5), one-time vs per-answer.
8. **"Hegg"**: confirmed as Heggerty? (F7 is written assuming yes.)
9. **Curriculum neutrality**: commit to no-affiliate-revenue as a stated trust feature
   of F7, or keep the option open (and drop the footer claim)?
10. **Sample-week IP**: legal check that approach-mimicking sample weeks (F7-S2) don't
    reproduce copyrighted curriculum content.
11. **Pricing shape for multi-child**: family-flat assumed throughout F8; confirm
    (per-child pricing would change NT-05 and F8 stories materially).
12. **Sibling comparison ban**: F8 stage 4 asserts "no cross-child position
    juxtaposition, ever" as an extension of the reassurance law. Confirm as LAW so
    M1-17's CI tests can enforce it on family-level surfaces.
