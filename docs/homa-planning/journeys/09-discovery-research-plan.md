# Journey Workstream 9 — Discovery & Research Plan (2026-07-02)

> Mixed lifecycle record. Sections 1 through 6.1 and 6.3 are historical
> discovery planning from 2026-07-02. Section 6.2 is the current upcoming
> phone-only M0-07 field-kit specification; HUMAN-TODO.md records that its
> founder review remains pending. Booth, printer, preorder, fake-door pricing,
> old plan names, and provider-state claims elsewhere are history. Current tier
> naming is Homa Plus; live Stripe state is unverified here.

> Mom-Test conference kit, design-partner interview guides, riskiest-assumption register,
> experiment backlog, evidence log. Methods: mom-test-guide, interview-guide,
> research-brief, risky-assumptions, experiment-design.
>
> **The one rule everything below enforces:** we collect *evidence* — past behavior,
> money spent, time given, reputation risked — never opinions, compliments, or
> hypothetical enthusiasm. A homeschool mom at a conference booth will be *nice* to
> Alessa. Niceness is noise. This plan is built to filter it out.

## 0. Why this workstream exists (read before the conference)

Three structural biases threaten every piece of customer evidence we have so far:

1. **Origin-user bias.** The entire value stack (00 §value stack) comes from Alessa —
   P1, one child, age 3, **ahead of standards**, tech-adjacent household, husband built
   the product. Her testimony that "metrics validated the journey" was earned by a mom
   whose numbers were *good news*. We have **zero evidence** about how the standards
   view lands for a mom whose kid is behind — which describes a large share of P3
   (mid-year pull-out) and many P2 households. That mom is the one the "no guilt
   mechanics" law exists for, and we've never met her.
2. **Compliment bias.** Our two demand signals are "Alessa's friend said I want one"
   and "conference moms asked for hours tracking." Both are words, not commitments.
   The Mom Test's currency hierarchy — **time > reputation > money** — says neither
   has been spent yet.
3. **Interviewer bias.** Our conference researcher is the founder's wife demoing her
   husband's product. Everyone she talks to will want to make her feel good. The kit
   below (§2) is designed so that even a perfectly polite conversation still yields
   usable data — because the questions are about *their* life, the demo comes *last*,
   and the only success metric is *commitments made*, not smiles.

**Mom Test rules, one box (tape this to the laptop):**

> 1. Talk about **their life**, not your idea.
> 2. Ask about **specifics in the past**, not generics or the future.
> 3. **Talk less. Listen more.**
> 4. Compliments are worthless. Deflect them and dig ("that's kind — when did this
>    last actually happen to you?").
> 5. Ideas and feature requests are data about *their problem*, not instructions.
>    ("Why do you want that? What would it let you do? How do you cope today?")
> 6. Anything after "I would…" is a hypothetical. Convert it to a commitment or
>    discard it.

---

## 1. Riskiest-assumption register

Every load-bearing customer assumption extracted from 00/03/04/09 and the journey
kickoff. Scored **Impact (1–5)** — how badly the plan breaks if this is false —
× **Uncertainty (1–5)** — how little real evidence we hold today (5 = pure faith).
Risk = I×U. Category: **D**esirability / **V**iability / **U**sability / **F**easibility.
Cheapest-test column references the conference kit questions (§2, `K#`),
design-partner guides (§3, `DP-a/b/c`), and experiment backlog (§4, `E#`).

Sorted by risk score. Top block (≥16) must have evidence before the M-R week-6
"first dollar" gate; middle block (10–15) before GA; bottom block monitors.

| # | We believe that… | Cat | Persona | I | U | Risk | Impact if wrong | Cheapest test |
|---|---|---|---|---|---|---|---|---|
| A1 | Metrics-against-standards feel like **validation, not judgment** for a mom whose kid is *behind* — not just for one (Alessa) whose kid is ahead | D | P3, P2 | 5 | 5 | **25** | The emotional core becomes a churn/harm engine for half the market; positioning (07) and weekly note (J3) rebuilt | K7–K8 at conference (deliberately sample behind-kid moms); E4 concierge note incl. ≥2 behind-kid families; DP-b |
| A2 | Weekly value is **felt** enough to beat 3–5× tracker pricing — retention survives month 2 (R6) | V | all | 5 | 5 | **25** | The business doesn't exist; wow-then-churn | E4 concierge notes (do they *reply*?); DP-b artifact archaeology; DP-c renewal ask |
| A3 | **$29/mo clears the household-budget conversation** in a single-income, subscription-scrutinizing home | V | P2, P1 | 5 | 4 | **20** | Price ceiling is tracker-tier; margin law + credits design moot | K11–K12 (actual spend this year); E6 preorder at conference; E1 fake-door price A/B; DP-c Van Westendorp |
| A4 | Moms will **voice-note into a web app** they must remember to open — habit survives without SMS/Slack (R5) | U | P5, P1 | 5 | 4 | **20** | The ambient capture that feeds the moat never happens; profile goes stale | E5 voice-vs-text cohort test; DP-b "show me your last capture"; M4-11 Alessa parity |
| A5 | The **efficacy loop is believed** — "Homa's materials moved his phonics numbers" reads as proof, not AI marketing | D | all | 5 | 4 | **20** | "Ultimate selling point" is a dud; renewal argument gone | E4 hand-written before/after notes — watch for *forwarding*; DP-c "what would you tell a friend this did?" |
| A6 | Out-of-range **older kids (8–12) don't kill the sale** for the median family; graceful partial coverage is buyable | V | P2 | 4 | 5 | **20** | ICP shrinks to preK–2 niche; open call #3 decided wrong | K3 (ages in every convo — count 8–12 share); E3 older-kids fake door; DP-a screener quota |
| A7 | The **3-minute wow converts** — 4 questions → personalized worksheet produces visible desire (not politeness) at first contact | D | P1, P3 | 4 | 4 | 16 | Onboarding inversion (council #1) built on sand; conference booth is a demo of nothing | E9 wizard-of-oz wow at booth; count commitment-after-demo rate |
| A8 | The **religious/conservative homeschool segment** (largest US segment) will let an AI near their homeschool | D | P2, S3 | 4 | 4 | 16 | TAM halves; FB-group channel hostile | K13 + E10 targeted interviews at conference (it will be full of this segment) |
| A9 | Moms will hand a **child's developmental data to an AI company** — privacy objection is manageable at signup | D | all | 4 | 4 | 16 | Activation cliff at the intake questionnaire | K13; DP-a intake objections; watch E2 waitlist→intake drop |
| A10 | A mom whose kid is "fine" still feels **"am I doing enough?"** acutely enough to seek an external answer | D | P1, P2 | 4 | 4 | 16 | Core hook (brand foundation) only works on anxious newcomers | K7–K9; count who *did something* about the worry vs shrugged |
| A11 | **First families will pre-pay** before the product exists ($29 preorder / deposit) | V | P1–P3 | 4 | 4 | 16 | Invite cohort fills with tourists; revenue-in-6-weeks slips | E6 — the conference IS the test |
| A12 | The **week-one drip questionnaire completes** (3 q/day × 7) instead of dying at day 2 | U | all | 4 | 4 | 16 | Sparse profiles → generic materials → wow decays; council re-scope of M2-03 wrong | E4/cohort telemetry `onboarding.drip_day_completed`; DP-b |
| A13 | **Hours/compliance is a purchase trigger**, not a satisfied-elsewhere checkbox (the "externally validated" demand was words) | D | P2, P4 | 4 | 3 | 12 | First-build-wave priority misallocated | K5–K6 (what do they use now, what did it cost); E12 concierge state report |
| A14 | Moms **print daily** — printer access + habit make paper worksheets the right artifact | U | P2, P5 | 3 | 4 | 12 | Materials pivot to screen/tablet delivery | K4 ("what did you last print?"); DP-b photo of the fridge/binder |
| A15 | **Visible credits pricing is legible, not alienating** — a mom accepts "this picture book costs 12 credits" (open call #2) | V | all | 4 | 3 | 12 | Rationing kills the daily habit the moat needs; billing design (08) reworked | E7 two-pager comprehension test; DP-c pricing section |
| A16 | The **"assessment is a test for the mother"** framing is understood and differentiating (vs "they test kids?!" recoil) | D | P3, P4 | 3 | 4 | 12 | Category-defining mechanic mispositioned; 07 message house rewrite | K8 listen for language; E8 message A/B |
| A17 | **Card-after-trial** fits this audience better than card-upfront (Q9) | V | all | 3 | 4 | 12 | Trial mechanics chosen blind; conversion cliff either way | E11 cohort split (n small — treat as directional); DP-c |
| A18 | Moms **show artifacts to other moms** — worksheet/weekly note is a word-of-mouth object (CAC thesis, R8 accepted-trade) | V | P2, S3 | 3 | 4 | 12 | Growth model has no engine; paid CAC in a niche = death | K10; E4 (did any recipient forward it unprompted?); DP-c referral ask |
| A19 | **Conference/co-op/FB-group moms convert to a waitlist** at a rate that seeds 20–50 invite families | V | P2, P3 | 3 | 3 | 9 | Cohort recruitment slower; GA gate delayed | Conference waitlist count vs conversations count (capture sheet totals) |
| A20 | The **connector features** (local events, curriculum compare, co-op finder) are wanted, not a nice-to-have we love | D | P1, P2 | 2 | 4 | 8 | M3-12/13, M5-08/09 deprioritized — cheap to learn late | K14; E2 feature-interest ranking |
| A21 | **Monica-types will file a generated report** with the state — trust clears the compliance bar | D | P4 | 3 | 3 | 9 | Compliance wedge stalls in exactly the states that need it | E12; DP-b with any P4 in cohort |
| A22 | **Personalization is perceivably better** than free worksheet sites (education.com, Teachers Pay Teachers) at first glance | D | P1, P3 | 3 | 3 | 9 | The wow reads as "cute but I get these free" | E9 booth observation: does she ask "how did it know that?"; K4 follow-up |

**Register maintenance:** each assumption gets a row in the evidence log (§5). An
assumption is *retired* when it has ≥3 independent pieces of strong evidence
(commitment, observed behavior, or money) pointing the same way — never by interview
quotes alone. Falsified assumptions escalate to Sidney the same day, not at weekly
synthesis.

---

## 2. The conference kit — Alessa's field guide

> **Correction (build-log #11, 2026-07-04; re-scoped in the 2026-07-04 grilling
> session): there is no booth, no banner, no booth printer, and no live Stripe
> account for a preorder link.** Alessa walks the floor and tells moms
> "thankshoma.com" in conversation. The kit for July 13 is: the laminated
> question card (§2.2), phone-based capture (fill the capture sheet questions
> into her phone's notes app or a simple form — no printing required), and the
> commitment ladder (§2.4) **stopping at the waitlist-email rung**; the $29/$19
> Stripe preorder rung (§2.4, §6.2 deliverable #2) is **dropped for this
> conference** — no Stripe account exists yet and there's no booth to run a QR
> off. Below, treat every booth/printer/QR-banner reference as the original
> design kept for its underlying logic (commitment ladder, capture-sheet
> questions), not as this July 13's spec.

**Replaces ticket M0-07** (see §6.2 for the re-scoped ticket spec). Alessa is not
a researcher and shouldn't have to be one. Everything here fits on: one laminated
question card, phone-based capture notes, one phone (waitlist link to hand
someone), one laptop (demo — closed until the end).

### 2.0 Goals for the weekend (in priority order)

1. **15+ capture sheets** filled in (≈15 real conversations, not booth drive-bys).
2. **Commitments counted**: preorders, intros, and scheduled calls — each one logged.
3. **5+ conversations with moms outside our bias**: kid behind grade level, kids 8–12,
   religious-curriculum families (Classical Conversations, Abeka, My Father's World).
   *These are worth double. Seek them out.*
4. Waitlist emails are the floor, not the goal.

**Not goals:** convincing anyone, defending the product, pitching, getting compliments.
If a conversation feels great and produced no facts about her life and no commitment,
it was entertainment.

### 2.1 The 30-second booth flow

People stop for seconds. The flow buys a real conversation without pitching:

> **Open (5s):** "Hi — how many are you schooling, and what ages?" *(everyone answers
> this; it's the homeschool handshake — and it feeds A6 age data)*
>
> **Hook with a question, not the product (10s):** "We're building something for
> homeschool moms and I'm trying to learn before we get it wrong — can I ask you two
> quick questions about how *you* do it? Not selling anything yet."
>
> **First question (15s):** K1 ("walk me through yesterday…"). If she engages →
> full conversation, pull the capture sheet. If she's rushed → K4 (the print
> question, fastest signal-per-second) → waitlist QR → thank her.
>
> **Demo only if she asks or after ≥5 learning questions.** Never open with the laptop.

### 2.2 The question card (12 questions about her life — laminate this)

Ask in roughly this order; skip freely; **never all of them**. Each has a
*listen-for* — that's what goes on the capture sheet, not her opinion of Homa.

| # | Ask | Why / listen for |
|---|---|---|
| K1 | "Walk me through yesterday's schooling — from when it started to when you called it done." | The real workflow, not the idealized one. Listen for: planning done the night before? improvised? screens? where the day broke down. *(A2, A4, A14)* |
| K2 | "What part of that do you dread — the thing that eats your evening or your Sunday?" | The actual pain, in her words. If nothing is dreaded, she may not be a customer — that's a finding too. *(A2, A10)* |
| K3 | "What ages are your kids, and does the schooling look different for each?" | A6 census — tally every household's ages. Multi-age juggling stories = P2 gold. |
| K4 | "What did you last print for school, and where did you get it?" | Materials supply chain: paid curriculum? free sites? Pinterest? Did she modify it? Printer friction? *(A14, A22)* |
| K5 | "How do you keep track of what you've done — hours, subjects, portfolio? Show me if it's on your phone." | Current tracking tool + whether it's for the state or for herself. "Show me" beats "tell me." *(A13)* |
| K6 | "What does your state make you file, and what did that cost you last year — in evenings or dollars?" | Compliance pain, quantified. P4 detector. *(A13, A21)* |
| K7 | "When did you last worry one of your kids was behind? What set it off?" | The trigger event for our emotional core. Comparison at co-op? A test? Grandma? *(A1, A10)* |
| K8 | "…and what did you *do* about it?" | **The most important question of the weekend.** Did she pay for an assessment, buy a curriculum, ask a group, test the kid, or do nothing? Action = real problem. Shrug = not a problem worth paying for. Note her exact words about testing/measuring kids. *(A1, A10, A16)* |
| K9 | "How do you know a school year *worked*? What did you look at last May/June?" | Does any validation loop exist today? Portfolio review? Standardized test? Vibes? *(A1, A5)* |
| K10 | "What's something another homeschool mom showed you that you then copied or bought?" | Word-of-mouth mechanics — what artifact traveled and through which channel (co-op, FB group, church). *(A18, A19)* |
| K11 | "What have you actually paid for this school year? Curriculum, apps, printables, co-op — roughly what did each cost?" | The real budget envelope and who approves it. Anchors all pricing work. *(A3)* |
| K12 | "Was any of that a fight to justify — to yourself or your husband? Which one, and what made it okay?" | The purchase-approval story: what arguments clear the household conversation. *(A3)* |
| K13 | "Do you use any AI stuff — ChatGPT, anything — for schooling? What happened?" | AI posture, in behavior. If negative: is it accuracy, screens, data, faith-based? Verbatim quote. *(A8, A9)* |
| K14 | "How did you last find something to *do* — a field trip, museum thing, co-op class? How'd that go?" | Connector-thesis check: is discovery a felt pain or a solved one? *(A20)* |
| K15 | *(only if kids 8+)* "If something only covered your youngest, preK–2 — is that useful or annoying?" | The ONE product-frame question allowed pre-demo, because open call #3 needs it. Listen for deal-breaker vs fine. *(A6)* |

**Deflection scripts** (she will be nice — redirect it):
- "That sounds amazing!" → "Thanks — *when's the last time you needed something like
  that?* What did you use?"
- "You should add ___!" → "Interesting — *what would that let you do?* How do you
  handle it today?"
- "I would totally use this." → go to the commitment ladder (§2.4). If she won't
  climb it, log as compliment.

### 2.3 The demo protocol — demo LAST

The demo is a **reward for a finished conversation** and a commitment-generator, not
an opener.

1. **Trigger:** at least 5 learning questions answered, or she explicitly asks.
2. **Personalize from what she told you:** "You said Emma's 4 and obsessed with
   horses — watch this." Run the wow: 4 questions → generate the worksheet live
   (E9 wizard-of-oz; Sidney on standby remotely if generation needs a human behind
   the curtain). Print it on the booth printer if at all possible — the physical
   handoff is the artifact test.
3. **Then be quiet.** Watch, don't narrate. On the capture sheet, mark what she DID:
   - reached for it / photographed it / asked "how did it know that?" (A22 signal)
   - asked about *her* kids' ages ("would this work for my 9-year-old?" — A6 signal)
   - asked what it costs **unprompted** (strongest desire signal there is)
   - said "wow, neat" and put it down (compliment — mark it honestly)
4. **The one thing we never demo:** anything that frames a child's numbers negatively.
   If asked "what if he's behind?", the answer is honest and short: "It shows what to
   work on next and builds the materials for exactly that — never a red F." Then ask
   K7/K8 if not yet asked — her reaction IS the A1 data.
5. **Close every warm conversation with the commitment ladder.** A demo without an
   ask is a wasted demo.

### 2.4 The commitment ladder — what counts as evidence

Currency of evidence: **money > reputation > time > email**. Always start one rung
higher than feels comfortable.

| Rung | The ask (verbatim) | Counts as | Log as |
|---|---|---|---|
| 3 — Money | "We're taking **25 first families** — $29 preorder locks the first month, first-cohort rate for a year, and you're in the first cohort in ~6 weeks. Fully refundable anytime. Want in?" *(Stripe Payment Link QR on the phone — existing Stripe, set up before the conference)* | **STRONG.** She spent money on a promise. | 💰 PREORDER |
| 2 — Reputation | "Would you **introduce me to 2 friends** who'd want this? Text them right now and I'll wait — or give me their info and tell them I'll reach out." *(The on-the-spot text is the real test; "I'll mention it" is nothing.)* | **STRONG.** She staked her name. | 🤝 INTRO ×N |
| 1 — Time | "Can I get **30 minutes on a video call** in two weeks to show you the real thing and get your honest reaction? Here's the calendar link." *(Booked = evidence. "Email me" = nothing.)* | Medium. | 📅 CALL |
| 0 — Email | Waitlist QR. | **WEAK — floor, not signal.** | ✉️ LIST |

A "yes" that stalls at rung 0 after a glowing conversation is a **polite no**. Log it
that way. The register's A11 test is literally: *how many rung-3s did the weekend
produce?* (Threshold in E6.)

### 2.5 Red flags — mark the ☠ box when you hear these

- **Compliments:** "This is so cool / you're so smart / what a great idea." (Data
  value: zero. Deflect per §2.2.)
- **Hypotheticals & generics:** "I would definitely…", "Moms would love this",
  "I usually / I always…" (Ask for the *last specific time* instead.)
- **Future promises:** "I'll sign up when it launches." (Offer rung 3 now. Watch.)
- **The pivot to her friend:** "My friend would LOVE this" — often deflection. Counter
  with rung 2: "Text her now?"
- **Feature requests taken at face value:** log the request, but capture the *why*
  underneath or it's noise.
- **Alessa-specific:** anyone being extra-nice because it's her husband's product —
  disclose late or not at all ("we're building" not "my husband built"), and weight
  friends-of-friends conversations lower in synthesis.

### 2.6 The capture sheet (print 30; one per conversation; fill in <60 seconds)

Designed for between-conversation scribbling. Circles and checkboxes, no prose
required. Verbatim quote box is the only writing.

```
HOMA FIELD SHEET  ·  Conv #___   Time: ____
──────────────────────────────────────────────────────────
KIDS  ages: __ __ __ __      Any 8–12?  Y / N
STATE: ____   Compliance-heavy (NY/PA/etc)?  Y / N / ?
SEGMENT (circle): enrichment / median-juggler / newcomer /
                  compliance / working  ·  faith-based curric? Y/N
──────────────────────────────────────────────────────────
TRACKS with: nothing / paper / spreadsheet / app: ________
LAST PRINTED: ______________  from: paid / free / made it
SPENT THIS YEAR: <$100 / $100–300 / $300–600 / $600+ / ??
WORRIED "BEHIND"?  Y / N   → did she ACT on it?  Y / N
   what she did: ___________________________________
AI TODAY: uses / tried&quit / never / hostile  why: ______
──────────────────────────────────────────────────────────
BEST QUOTE (her exact words):
"________________________________________________"
──────────────────────────────────────────────────────────
DEMO SHOWN? Y / N   If Y, she: reached-for-it / photo'd /
   asked-price-unprompted / asked-older-kids / just-polite
COMMITMENT:  💰 preorder   🤝 intro ×__   📅 call   ✉️ list   ∅ none
RED FLAGS ☠:  compliments-only / "I would…" / friend-pivot
FOLLOW-UP owed: ______________________  ⭐ TALK TO AGAIN? Y/N
```

**End of each day (10 min, with Sidney on the phone):** count the tallies — total
sheets, ages histogram, rung-3/2/1 counts, behind-kid conversations, AI-hostile
count. Photograph every sheet into `journeys/evidence/raw/conference-YYYYMMDD/`.

---

## 3. Design-partner interview guides (the 20-family cohort)

Cadence per family: **intake (30 min, video, before invite code)** → **week-2
check-in (25 min)** → **month-1 renewal interview (30 min)**. Sidney runs these;
recorded with consent (audio only is fine); notes coded per §5 within 24h.

**Cohort screener quotas** (fight the P1 bias in recruitment, not in analysis):
≥6 families with a child aged 8–12 in the house (A6); ≥5 where mom reports a child
behind in ≥1 area (A1); ≥4 faith-based-curriculum families (A8); ≥3 in
compliance-heavy states (A21); ≥4 working/part-time moms (P5). Max 5 Alessa-friends.

### 3a. Pre-onboarding intake (30 min) — before they see the product

Purpose: baseline her current reality so week-2 and month-1 measure *change*, and
qualify against quotas. **No product talk for the first 20 minutes.**

1. **Warm-up & household (4 min).** Kids/ages; how long homeschooling; why she
   started (verbatim — this is her renewal motivation, we'll quote it back at
   month 1).
2. **Yesterday, replayed (8 min).** K1 equivalent, in depth: "Walk me through
   yesterday hour by hour." Probe: who planned it and when; what got skipped; what
   she made vs bought vs printed; where the kids' attention broke.
3. **The last three purchases (6 min).** "What are the last 3 things you paid for,
   for school? For each: what triggered it, what it cost, did it work, would you buy
   it again?" *(A3 anchor — write the numbers down.)*
4. **The worry loop (6 min).** K7/K8/K9 in depth. Extra probe for behind-kid
   families: "When something showed you where he stands — a test, a chart, another
   kid — what did that *feel* like, and what did you do that week?" *(A1 — the
   single most valuable minute of the cohort program. Do not lead. Do not comfort.
   Just listen and write.)*
5. **Tools & AI posture (3 min).** K5, K13.
6. **Setup & logistics (3 min).** Printer situation; phone vs laptop; when in the day
   she'd realistically have 3 minutes for us. Consent for telemetry + recordings;
   schedule week-2 call *now*.

**Note template** (one file per family, `evidence/interviews/DP-<family>-intake.md`):
frontmatter `persona: P?`, `quotas: [behind-kid, ages-8-12, …]`, `state:`, then
sections mirroring 1–6, each ending with `TAGS:` lines per §5.3, plus
`BASELINE: hours-tracking=?, materials-spend=$?/yr, current-tools=[…], worry-action=…`.

### 3b. Week-2 check-in (25 min) — what did you ACTUALLY do

Purpose: observed behavior vs telemetry vs her account. **Rule: everything must be
shown, not described.** Screen-share is mandatory; "show me" is the whole method.

1. **Open cold (2 min).** "Pull up Homa right now and share your screen." (Where does
   she navigate first? Is she logged in? Hesitation is data.)
2. **Artifact archaeology (8 min).** "Show me the last thing Homa made that you
   actually used with a kid." Then: "Walk me to where it is physically — fridge,
   binder, recycling?" Then: "Show me one it made that you *didn't* use — why not?"
   *(A2, A14, A22. The used:generated ratio matters more than anything she says.)*
3. **Capture behavior (6 min).** "Show me the last thing you told Homa — scroll to
   it." Voice or typed? When/where was she? "When did you last *mean* to log
   something and not do it — what happened?" *(A4, and E5 cross-check against
   telemetry: her memory vs the event log.)*
4. **The drip (4 min).** Check `onboarding.drip_day_completed` before the call. If
   she stalled: "Day 3 was your last one — what was happening that day?" No guilt,
   just the mechanism. *(A12)*
5. **The note (4 min).** "You got a weekly note Saturday — open it. What did you do
   after reading it, if anything?" Forwarded it? Mentioned it to husband? Acted on
   the nudge? *(A2, A5, A18)*
6. **Close (1 min).** "If we turned Homa off tomorrow, what would you miss first?"
   (One answer, verbatim.) Confirm month-1 slot.

**Note template:** `DP-<family>-wk2.md` with `SHOWN vs SAID` two-column log —
every claim gets an `observed: Y/N` mark — plus `used:generated ratio`,
`capture-mode: voice/text/mixed`, `drip-status: n/7`, `note-action: none/read/acted/forwarded`.

### 3c. Month-1 renewal-intent interview (30 min) — incl. willingness-to-pay

Purpose: A2/A3/A15/A17 with money on the table. Run *before* any real renewal event
so the commitment ask is genuine.

1. **The month, replayed (6 min).** "Take me through last week — where did Homa
   actually show up in it?" Then the mirror: "At intake you said you started
   homeschooling because ___ — has this touched that at all?"
2. **Value in her words (5 min).** "Your best friend asks what this thing actually
   does for you — what do you tell her, exactly?" *(This verbatim is positioning
   gold for 07 — and tests A5: does the efficacy story appear unprompted?)*
   Then: "What's it replaced — anything you've stopped doing or stopped paying for?"
3. **Van Westendorp lite (7 min).** Frame: "Real talk about price — we're setting it
   and your answer changes it. Think about what it did for you this month, next to
   the $___ you told me you spend a year" *(quote her intake number back)*:
   - "At what monthly price would this be **so cheap you'd doubt it**?"
   - "At what price is it **a bargain** — you'd sign up without thinking?"
   - "At what price does it start feeling **expensive — you'd have to think about
     it or run it past your husband**?" *(the A3 threshold — note if a husband
     conversation is invoked and what argument she says would win it)*
   - "At what price is it **too expensive — you're out regardless**?"
   Then the credits probe (A15): show the two one-pagers from E7 — flat plan vs
   credit menu — "which do you understand faster, and which feels fairer? Why?"
4. **Churn probe (4 min).** "What almost made you stop using it this month? What
   would definitely make you cancel?" And the counter: "What would have to be true
   for this to be a no-brainer at renewal?"
5. **The commitment ladder, cohort edition (6 min).** In order, stop at first no:
   - 💰 "First-cohort annual: **$290/yr locked forever**, starting now — in?" *(prepaid
     annual = the strongest renewal-intent evidence that exists)*
   - 💰 "Then month-to-month at $29 continues after cohort — keep the card on?"
   - 🤝 "Two homeschool moms you'd *actually* text about this — can you intro us
     this week?"
   - 📅 "Join a 30-min group call with 3 other cohort moms next month?"
6. **Close (2 min).** "What should I have asked that I didn't?"

**Note template:** `DP-<family>-m1.md` with `VW: too-cheap/bargain/expensive/too-much
= $/$/$/$`, `husband-convo-invoked: Y/N + winning-argument`, `pricing-model-pref:
flat/credits + why`, `commitment: annual/monthly/intro/none`, `churn-trigger:`,
`friend-pitch-verbatim:`.

---

## 4. Experiment backlog

Cheap tests pre/at launch, each tied to register assumptions, open calls #1–4
(09 §four calls) and R5/R6/Q4/Q9. Ordered by (decision urgency × cheapness).
"Cost" = Sidney-hours + dollars. Success thresholds are pre-committed here so we
can't grade on a curve later.

| # | Experiment | Assumptions | Unblocks |
|---|---|---|---|
| E6 | First-cohort preorder at conference | A11, A3 | Q4 price point; M-R cohort fill |
| E9 | Wizard-of-oz 3-min wow at booth | A7, A22 | Onboarding-inversion bet (council #1) |
| E3 | Older-kids fake door | A6 | **Open call #3 (age-range ICP)** |
| E1 | Waitlist pricing A/B | A3 | Q4 |
| E2 | Feature-interest ranking on waitlist | A20, A13, A5 | M-R build order |
| E4 | Concierge weekly note (5 FB-group moms) | A1, A2, A5, A18, A12 | R6 retention; positioning law |
| E5 | Voice-vs-text week-one preference | A4 | R5; **open call #4 posture check** |
| E7 | Credits-legibility one-pager test | A15 | **Open call #2 (visible credits vs flat)** |
| E8 | Message A/B: metrics-led vs reassurance-led | A16, A1 | 07 positioning; homepage headline |
| E10 | Religious-segment AI-objection interviews | A8, A9 | TAM sizing; channel strategy |
| E11 | Card-upfront vs card-after-trial split | A17 | Q9; **open call #1 context** (payment-trust posture) |
| E12 | Concierge state-report ("ask Homa") | A13, A21 | Hours/compliance priority; P4 wedge |

**E6 — First-cohort preorder (at conference).**
Hypothesis: ≥15% of demo'd, engaged conversations will pay $29 today for a product
shipping in ~6 weeks. Method: Stripe Payment Link ($29, refundable, "First
cohort — price locked for year one"), QR on Alessa's phone, offered
per commitment ladder §2.4. Sample: every rung-3 ask (target ≥20 asks).
**Success: ≥3 preorders.** 0–1 = A11/A3 falsified at this price → run the $19 link
day 2 (prepared in advance). Cost: 1h setup, $0. Decision: Q4 anchor; cohort seeding.

**E9 — Wizard-of-oz wow (at conference).**
Hypothesis: 4 answers → personalized printed worksheet produces a physical desire
response in ≥50% of demos. Method: booth demo per §2.3; Sidney remote-generates if
the M0-03 path isn't live; portable printer. Measure via capture-sheet demo
checkboxes (reached / photographed / asked price / asked older-kids). Sample: every
demo (target 10+). **Success: ≥50% show ≥1 desire behavior; ≥30% ask price or ages
unprompted.** Cost: prep day + ~$150 printer. Decision: keep or rethink the 3-min-wow
onboarding bet before M2-03 splits are built.

**E3 — Older-kids fake door (week 1–2).**
Hypothesis: ≥25% of waitlist signups indicate an 8–12-year-old and ≥40% of *those*
still join when told v1 covers preK–2(–7). Method: waitlist form asks kids' ages
(natural question, not creepy); after submit, out-of-range households see "v1 covers
ages 2–7 — 8–12 track is next; join the 8–12 interest list?" — a second explicit
click. Sample: first 150 waitlist signups + all conference K3/K15 tallies.
**Success gate for open call #3:** if ≥35% of households have 8–12 kids AND <40%
of them click through, option (b) (pull the 8–12 track forward) wins; otherwise
launch preK–2 honestly per council recommendation. Cost: 3h. Decision: **open call #3**.

**E1 — Waitlist pricing A/B (week 1–4).**
Hypothesis: signup rate at $29 is within 20% of $19 (price-insensitivity in this
band). Method: fake-door pricing on the landing page — three rotating variants show
"plans from $19 / $29 / $49/mo" above the waitlist CTA; measure signup rate per
variant + a post-signup one-question survey ("what would you expect this to cost?").
Traffic: 2 FB-group posts + conference QR (~300 visits realistic). **Success:
readable separation (n≥40/variant); decision rule: if $29 within 20% of $19, price
$29; if $49 within 30% of $29, test $39 next.** Cost: 4h. Decision: Q4 with M0-06
cost floor.

**E2 — Feature-interest ranking (same page, week 1–4).**
Hypothesis: "know where your child stands + watch the numbers move" out-ranks
materials, compliance, and connector features. Method: post-signup screen: "pick the
2 you'd want first" — (a) daily custom materials, (b) know where each child stands
without testing them, (c) hours/state reports done for you, (d) local
activities/curriculum matching. Order randomized. Sample: all waitlist signups.
**Success: a top-2 with ≥25pt lead → leads M-R build order and homepage.** Cost: 2h.
Decision: build order + 07 message hierarchy.

**E4 — Concierge weekly note (weeks 2–6).**
Hypothesis: hand-made weekly notes get ≥60% open-and-reply by week 3, and behind-kid
moms respond to standards framing without distress signals. Method: recruit 5 moms
from FB groups (NOT friends; ≥2 with a self-reported behind child); they email/voice-memo
3 observations per week; Sidney hand-writes the weekly note (strengths-first,
one nudge, before/after where possible — the M-R concierge loop, started early).
Sample: 5 families × 4 weeks. **Success: ≥3 still replying in week 4; ≥1 unprompted
forward/screenshot-share; zero distress/defensive responses to standards content
from behind-kid moms — any such response = A1 red alert, escalate same day.**
Cost: ~2h/week, $0 (or $25 gift cards). Decision: R6 evidence; validates/falsifies
the entire weekly-note retention thesis AND the metrics-lead positioning before a
line of it is built.

**E5 — Voice-vs-text preference (cohort week 1, from first invite).**
Hypothesis: ≥50% of capture events are voice when voice is one tap from open.
Method: instrument `capture.voice` vs `capture.text` (M1-02 events table); voice
button and text box visually co-equal; week-2 interview (§3b.3) probes the gap
between claimed and logged behavior. Sample: first 10 cohort families × 2 weeks.
**Success: ≥50% voice share AND ≥3 captures/family/week. Voice <25% = R5 confirmed
→ SMS fast-follow escalates + PWA/push work re-prioritized.** Cost: telemetry
already planned; 0 extra. Decision: R5; capture roadmap.

**E7 — Credits-legibility test (before M1 billing build).**
Hypothesis: ≥7/10 moms correctly answer "what happens when you run low?" from the
flat-plan sheet vs ≤4/10 from the credit-menu sheet. Method: two one-pagers (A: flat
plan, generous fair-use, premium items labeled; B: credit menu with per-action
prices); show 10 moms (cohort intakes + E4 moms) both, alternating order; 3
comprehension questions + "which feels fairer?" + record confusion verbatims.
**Success: clear comprehension winner (≥3-person gap) → that model ships; fairness
split noted for pricing-page copy.** Cost: 4h. Decision: **open call #2**.

**E8 — Message A/B (weeks 2–5).**
Hypothesis: metrics-led copy ("Know exactly where your child stands — and watch the
numbers move") beats reassurance-led ("Finally feel confident you're doing enough")
on CTR without attracting a judgment-averse bounce. Method: two $75 Meta ad sets
into homeschool-interest audiences → matching landing variants → waitlist conversion,
not just CTR. Sample: ~2×2,500 impressions. **Success: one variant ≥30% better on
visit→signup; ALSO read comments/reactions for A1 backlash signals on the metrics
variant.** Cost: $150 + 4h. Decision: 07 message house lead; A16 wording.

**E10 — Religious-segment probe (at conference + 1 follow-up week).**
Hypothesis: <30% of faith-based-curriculum moms reject AI involvement outright once
"parent stays the teacher; it's a helper that makes materials" is the frame. Method:
conference K13 tally split by faith-based flag + 5 follow-up 20-min calls recruited
there (rung-1 asks); objection card sort: rank concerns (screens, data, doctrine,
accuracy, "replaces me"). Sample: ≥10 tallies + 5 calls. **Success: rejection <30%
and the top objection is addressable in copy (not doctrinal).** Cost: 4h. Decision:
channel + copy strategy for the biggest US segment; A8 stays or TAM re-cut.

**E11 — Card timing split (cohort invites, weeks 6–10).**
Hypothesis: card-upfront (with first-cohort framing) does NOT depress invite→active by
more than 25% vs card-after-trial. Method: alternate invite batches — batch A:
card-upfront w/ 30-day full refund; batch B: no card, promotional credits, card at
day 14. Compare invite→onboarded→week-2-active. Sample: ~10 per arm (directional
only — treat with humility, combine with DP-c interview data). **Success: pick the
arm with better week-2 active; if within noise, card-upfront wins (simpler billing,
council trial-credits design still applies).** Cost: 0 extra. Decision: Q9.

**E12 — Concierge state report (weeks 4–8).**
Hypothesis: ≥2 of 3 compliance-state moms will hand over their logs and then say
they'd file the produced report. Method: offer 3 P4/P2 moms (from cohort or E4):
"email me your log/hours notes; you get back a state-formatted report in 48h"
(Sidney compiles per M-R "ask Homa" concierge plan). Then: "would you file this
as-is? what would you change?" Sample: 3. **Success: 2/3 would file with only
cosmetic edits; any legal-substance correction = A21 flag → M3-04-style review
tightens.** Cost: ~4h. Decision: hours/compliance stays in first build wave with
confidence, and we learn the report format from real filings.

---

## 5. Evidence log — where findings live and how they become decisions

### 5.1 Folder structure

```
docs/homa-planning/journeys/evidence/
├── README.md                  # this section, copied — the operating manual
├── assumptions.md             # the living register (§1 table + status/evidence columns)
├── raw/
│   ├── conference-YYYYMMDD/   # capture-sheet photos + end-of-day tally notes
│   ├── recordings/            # interview audio (consented; delete after coding)
│   └── experiments/           # E# raw exports (waitlist CSVs, ad screenshots)
├── interviews/
│   └── DP-<family>-{intake,wk2,m1}.md   # coded notes per §3 templates
├── experiments/
│   └── E01-pricing-ab.md …    # one file per E#: pre-registered threshold, result, verdict
└── synthesis/
    └── YYYY-WW.md             # weekly synthesis output (§5.4)
```

### 5.2 How an interview becomes a coded insight (the pipeline)

1. **Capture** (day 0): raw notes/sheet/recording into `raw/`.
2. **Code** (within 24h — memory decays fast): write/annotate the interview file.
   Every discrete finding becomes one tagged line (§5.3). One finding = one line;
   verbatim quotes preserved in quotes; interpretation clearly separate from
   observation.
3. **Post** (same sitting): append each finding line to the relevant assumption's
   evidence list in `assumptions.md`, with strength grade.
4. **Verdict check**: if an assumption hits the retire bar (≥3 strong, same
   direction) or a falsify signal (any strong contradicting evidence on a 20+
   risk-score row), flag it in the file header and tell Sidney *now*.

### 5.3 Tag taxonomy (grep-able, boring on purpose)

```
TAG: [P2] [A3] [STRONG-money] "We spent $600 on Abeka and I'd drop it in a
     heartbeat if something actually adjusted to each kid" — conf #14, 2026-07-12
```

- **Persona:** `[P1]…[P5]`, `[S1]…[S4]`, `[P?]` if unclear.
- **Assumption:** `[A1]…[A22]` (multiple allowed).
- **Strength:** `[STRONG-money]` (paid/preordered) · `[STRONG-reputation]` (intro
  made, name staked) · `[STRONG-behavior]` (observed/telemetry, incl. time given) ·
  `[MED-specific-past]` (concrete story about a real past event) · `[WEAK-opinion]`
  (feelings, preferences) · `[NOISE-compliment]` (logged only to keep ourselves honest).
- **Direction:** `[SUPPORTS]` / `[CONTRA]` / `[MIXED]`.
- Source + date always at line end.

Rule of the log: **WEAK and NOISE lines can never retire an assumption**, no matter
how many pile up. That's the whole Mom Test, operationalized in one constraint.

### 5.4 Weekly synthesis ritual (solo founder, 30 min, agent-assisted)

Every Friday (or Sunday night), timeboxed:

1. **Agent pass (0 min of Sidney's time, run before the session):** an agent reads
   the week's new files in `interviews/`, `raw/`, `experiments/` and drafts
   `synthesis/YYYY-WW.md`: new evidence lines per assumption; register rows whose
   score should move; contradictions between SAID and SHOWN; experiment threshold
   checks (met / not / pending); the 3 most decision-relevant verbatims.
2. **Sidney reads + rules (20 min):** accept/correct the draft; move register
   scores; mark any assumption RETIRED or FALSIFIED; check open calls #1–4 — has
   evidence arrived that decides one? If yes, decide it *this session* and note it
   in 09-council-synthesis or the backlog.
3. **Re-aim (10 min):** pick next week's top 3 evidence targets (highest risk ×
   least new evidence); adjust interview scripts if a question is consistently dead;
   queue any same-day escalations that slipped.
4. Output is committed. The synthesis file is the memo — no separate reporting.

---

## 6. Open questions + ticket replacement

### 6.1 ❓ Research-priority questions (for Sidney)

1. ❓ **Conference date & logistics:** exact date (sets the prep deadline for the
   Stripe link, printed capture sheets, booth printer, and E9 wizard-of-oz dry run —
   minimum 3 evenings of prep), and does Alessa have a booth or is she walking the
   floor? (§2.1 flow works for both; the printer doesn't.)
2. ❓ **Preorder terms:** is "$29 refundable first-cohort preorder, price locked
   for year one" approved as written? It creates a price commitment before M0-06's
   cost floor lands — acceptable, or cap first-cohort seats at 25 to bound it?
3. ❓ **Disclosure line for Alessa:** "we're building" vs "my husband built this for
   us." The second is a better story but maximizes compliment bias (§2.5). Which
   does she lead with, and does she get to choose per conversation?
4. ❓ **E8 ad budget (~$150) approved?** It's the only experiment costing real money;
   everything else is Sidney-hours.
5. ❓ **Behind-kid research ethics guardrail:** when E4/DP interviews surface a mom
   in real distress about a child's development, what's our line? (Proposed: never
   advise, always "informational, not diagnostic," have a we-can't-help-with-that
   script ready. Needs a yes before E4 recruits.)
6. ❓ **Who codes conference sheets?** Alessa fills them; proposed that Sidney codes
   them (§5.2) with Alessa on the phone for the nightly tally only — confirm she's
   up for a 10-min nightly debrief during the conference.
7. ❓ **Cohort quota enforcement:** if the waitlist can't fill the §3 screener quotas
   (esp. 5 behind-kid families), do we delay cohort start or fill with
   convenience sampling and flag the bias? (Proposed: recruit the gap directly in
   FB groups; delay ≤1 week max.)

### 6.2 Replacement spec for ticket M0-07

> **M0-07 (re-scoped 2026-07-04, no-booth reality) — Conference research kit,
> phone-only.** Size: **S** (back down from M — no printer, no Stripe rung).
> ⛔ for the conference date.
>
> Deliverables:
> 1. Field kit produced from §2 of `journeys/09-discovery-research-plan.md`:
>    laminated question card (K1–K15 + deflection scripts), phone-based capture
>    (notes app or a simple form — no printed sheets, no booth), commitment-ladder
>    card (§2.4) **stopping at the waitlist-email rung**.
> 2. ~~$29 refundable founding-family Stripe Payment Link + QR~~ **Dropped for
>    this conference**: no Stripe account exists yet and there is no booth to run
>    a preorder QR off. Revisit once Stripe is live (Phase D) and/or a future
>    conference has a booth.
> 3. E9 wow demo path rehearsed end-to-end (wizard-of-oz allowed, verbal only,
>    **no portable printer**) — demo-LAST protocol briefed with Alessa, including
>    the §2.3 "what if he's behind?" answer, verbatim.
> 4. `journeys/evidence/` scaffolded per §5.1 with `assumptions.md` seeded from the
>    §1 register; nightly-tally ritual scheduled for each conference day.
> 5. One 30-min dry run: Sidney plays a polite conference mom who compliments
>    everything and commits to nothing; Alessa must reach the waitlist-email ask
>    and log the note in under 90 seconds.
>
> Acceptance: kit exists (question card + phone capture method briefed), dry run
> done, evidence folder committed. Success metric for the conference itself:
> real conversations logged with an honest commitment count (waitlist emails,
> not preorders) — whatever the number is, it's the first real datum this
> product has.

### 6.3 Cross-workstream notes

- **07-positioning-messaging:** E8's winning variant and the DP-c "friend pitch"
  verbatims are direct inputs; don't finalize the message house before E8 reads out.
- **02-acquisition-activation:** A7/A12 evidence (E9, drip telemetry) should be
  reflected in the wow and week-one drip stage designs; the drip's day-3 stall
  probe (§3b.4) belongs in its instrumentation section.
- **06-metrics-instrumentation:** events this plan depends on: `capture.voice|text`,
  `onboarding.drip_day_completed`, `note.opened|replied|forwarded` — please include
  in the tracking schema so E4/E5 graduate from concierge to telemetry.
- **01-personas-jtbd:** the register's persona mappings assume the kickoff cast;
  intake interviews (§3a) will produce forces/JTBD verbatims — coded lines tagged
  `[P#]` in the evidence log are yours to mine.
