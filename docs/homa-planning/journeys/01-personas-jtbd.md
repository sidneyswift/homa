# 01 — Personas, Empathy Map, JTBD Jobs & Forces

> Workstream 1 of 5 (see `00-pm-kickoff.md`). Senior UX research + product strategy.
> Status: PLANNING. Last updated 2026-07-02.
>
> This document deepens the shared persona cast (P1–P5, S1–S4) pinned in the kickoff
> doc. Nothing is renamed. Every other journey doc cites personas by code from here.
> Methods applied: pm-os `proto-persona`, `create-empathy-maps`, `jtbd-jobs`,
> `jtbd-forces`, adapted into one cohesive markdown doc.

---

## 0. Evidence base, tags, and honesty rules

We have exactly **one real interview**: the origin user's testimony (00-product-brief
§"The value stack"). Everything else is triangulated from demand signals, competitor
data, brand research, and domain knowledge, and is **marked as assumption with a
confidence level**. This doc is a hypothesis set built for validation, not a claim of
knowledge we don't have.

| Tag | Source | Nature |
|---|---|---|
| `[UR-A]` | Origin-user (Alessa archetype) testimony, 00-product-brief §value stack + §product principles | The one real interview. Verbatims: "your child should be doing better than the other kids" · "a test for the mother" · "does he count to 40? what books did he read?" · "the ultimate selling point" |
| `[SIG-F]` | Friend demand signal: saw the system, said "I want one" (00-product-brief) | Real, thin (n=1 reaction) |
| `[SIG-C]` | Conference moms asked for hours-to-state tracking and per-child customization (00-product-brief) | Real, thin (unstructured) |
| `[MD]` | Market data: competitors at $5–15/mo trackers with AI sprinkles; none with a persistent child profile (00-product-brief); state-reg landscape (07-deep-research-notes §3) | Secondary, medium reliability |
| `[BRAND]` | Design-system brand research (docs/homa-design/readme §Brand foundation): "short on bandwidth and reassurance", the "Am I doing enough?" fear, isolation, Instagram comparison | Synthesized research, treated as informed assumption |
| `[COUNCIL]` | 09-council-synthesis: median family 2–3 kids ages 5–12; age-range ICP tension; invite-gated rollout | Internal analysis |
| `[A-H] [A-M] [A-L]` | Assumption at High / Medium / Low confidence | Ours to validate |

**Quote honesty rule:** quotes tagged `[UR-A]` are real or near-verbatim from the brief.
All other persona quotes are **invented plausible-voice** and are tagged `[inv]`. Do not
put an `[inv]` quote in marketing.

**Brand rule carried throughout:** no em dashes in any customer-facing copy example.
Reassurance-first, never "behind" framing, sentence case, offer never command.

---

## 1. Proto-personas (P1–P5)

### How to read these

Each persona gets: snapshot → day in the life → household & money → tech context →
homeschool philosophy and what it changes about product expectations → state regulatory
context → buying process → pains → goals → representative quotes → evidence basis +
confidence → top-3 validation questions. Confidence is rated per persona overall and
per claim where it matters.

A note on the philosophy spectrum, because it is the single biggest driver of product
expectation differences and no competitor handles it well `[MD]`:

| Philosophy | Core belief | What she expects from a tool | Landmines |
|---|---|---|---|
| **Classical** | Trivium stages, memory work, rigor, Great Books | Structured sequence, mastery tracking, Latin/logic subjects exist in the taxonomy, rigor signals | Fluffy "learning through play" framing reads as unserious |
| **Charlotte Mason** | Living books, short lessons, narration, nature study, habit formation | Book lists over worksheets, narration prompts, nature-study logging, "atmosphere" language | Worksheet-heavy output reads as "twaddle"; drill-and-kill is offensive |
| **Unschooling / child-led** | Learning is living; curriculum follows the child's interests | Interest-capture, ambient logging that turns life into evidence, zero "assignments" | Benchmarks, grade levels, and "shoulds" can read as the system she fled; needs opt-in framing |
| **Eclectic** (the plurality) | Mix and match per child per subject | Flexibility, per-child settings, curriculum comparison, permission to change approach mid-year | Forcing one method's vocabulary on her |
| **Religious (often overlaps all of the above)** | Education as discipleship; worldview matters in content | Content that respects (or at least never contradicts) her worldview; control over topics (evolution, holidays, sex ed); community trust | Secular-normative content sprung on her without control; also the deepest AI skepticism lives here |
| **School-at-home (newcomer default)** | Replicate school, but at the kitchen table | Schedules, checklists, grade-level language, "curriculum in a box" | Burns out by February; the tool must help her relax the model, not cement it |

Homa's benchmark/efficacy mechanic `[UR-A]` is philosophy-agnostic in principle
(observational, never tests the child) but philosophy-charged in presentation. This
table is why presentation law exists.

---

### P1 — Alessa (the origin archetype)

**Snapshot:** One preschooler (age 3). Urban, tech-adjacent household. Enrichment-driven;
wants ahead-of-standards validation. Voice-notes-from-pocket habit. Comfortable money
but scrutinizes subscriptions. She is the archetype of design partner #0, generalized.

#### Bio & demographics
- Age 30–36, DC-metro urban `[A-H]` (the origin system literally ran a DC events scout)
- Education: college degree, possibly graduate `[A-M]`
- Life stage: first child, homeschooling by conviction and enthusiasm before compulsory
  age, not by necessity `[UR-A]`-adjacent, `[A-H]`
- Household: married; partner works in tech or a technical field `[A-H]` (the archetype
  requires "tech-adjacent," per kickoff; the origin case is an engineer spouse)
- Income: dual income or single high income; comfortable `[A-M]`

#### Day in the life
- **7:00** Up with her 3-year-old. Breakfast, play. No formal "school start"; learning is
  woven through the day.
- **9:30** A focused activity block: a worksheet at the table, a sensory bin, letter
  practice. 20–40 minutes max, because he's three.
- **11:00** Out of the house: story hour, a museum, the park, a class. She plans one
  outing most days; enrichment is her love language `[UR-A]` (the connector value:
  museum/zoo/parade suggestions resonated because she already lives this way).
- **13:00** Nap time = her admin window. This is when she reads about phonics
  progressions, browses activities, prints things for tomorrow.
- **Throughout** She narrates observations into her phone the moment they happen:
  "he counted to 40 in the car" `[UR-A]` (voice-first capture is her actual usage
  pattern, per product principle 6).
- **21:00** Evening: reflects on the day; wants one place to answer "one question about
  the day" rather than write a journal `[UR-A]`.

#### Household & money
- Comfortable but not extravagant. **Scrutinizes subscriptions** (kickoff): she audits
  the family's recurring charges quarterly and cancels anything that stopped earning its
  spot `[A-H]`.
- Spends freely on the child's enrichment (classes, museum memberships, books) because
  those have visible payoffs. A subscription must produce **artifacts and evidence** to
  survive her audit `[UR-A]` (the efficacy loop as "the ultimate selling point" is
  exactly this psychology).
- Anchors price against enrichment spend (a single toddler class is $25–40/session),
  not against tracker apps `[A-M]`. $29/mo is defensible to her if the before/after is
  visible.

#### Tech context
- iPhone-first, AirPods in, voice notes constantly `[UR-A]`.
- High comfort with new apps; low patience for clunky ones. Has tried ChatGPT for
  activity ideas `[A-M]`.
- Household has a technical adult who could, in principle, duct-tape a DIY solution;
  Homa's job is to be better than the duct tape without needing the engineer
  (00-product-brief one-liner: "without her husband needing to be an engineer").
- Privacy-aware but pragmatic: she'll share child data with a product she trusts, and
  she reads the privacy page before onboarding `[A-M]`.

#### Homeschool philosophy → product expectations
- **Eclectic, enrichment-driven, secular-leaning, standards-aware** `[A-H]`. She isn't
  loyal to a named method; she's loyal to her child's trajectory.
- Distinctive trait: she wants **ahead-of-standards validation** (kickoff). Most moms
  fear "behind"; Alessa is playing offense. She wants to see "ahead of age band" and
  wants the next challenge queued `[UR-A]` (competitive pressure framing: "your child
  should be doing better than the other kids").
- Product expectations this creates:
  - Benchmarks must show **position above the band**, not just "on track." Gold/"ahead"
    states matter to her (design system already has the gold accent for this).
  - Materials must escalate: when he masters counting to 40, she expects the next
    worksheet to stretch, automatically.
  - The connector features (museum tied to this week's theme) are core value to her,
    not a nice-to-have `[UR-A]`.
  - She will not tolerate the product slowing to the median. Personalization IS the
    product for her.

#### State regulatory context
- Child is 3: **below compulsory school age everywhere.** Zero legal obligations today
  `[MD]`.
- Consequence: her benchmark hunger is 100% validation-driven, 0% compliance-driven.
  She is proof the metrics are an emotional product, not paperwork `[UR-A]`.
- In 2–3 years (DC or VA), she'll face notification and possibly portfolio review; the
  compounding profile becomes her effortless portfolio. Retention story: the record she
  builds now pays off at compulsory age `[A-H]`.

#### Buying process
- **She decides.** Sole decision-maker on child-development spend `[A-H]`.
- Influencers: her spouse (technical due diligence: "is this thing legit, who has the
  data"), a small circle of local moms, and her own research `[A-M]`.
- Trigger: she already wants it; the archetype's real-world friend said "I want one" on
  sight `[SIG-F]`.
- Selection criteria: (1) does it actually know my child, (2) artifact quality, (3)
  privacy posture. Price is criterion four `[A-M]`.
- Objections: subscription fatigue; "will this stay good or rot like every other app."
- Success metric: the before/after. "Homa's activities raised his phonics numbers, and
  here's the before/after" `[UR-A]`.

#### Pains
- Planning enrichment across a dozen sources (library calendar, museum sites, mom
  groups) is a nightly research job `[UR-A]` (nightly research was literally built).
- No trustworthy way to know where a 3-year-old "should" be without either testing him
  (unacceptable) or doom-scrolling milestone content `[UR-A]`.
- Observations evaporate: the "he counted to 40!" moments were being lost before
  voice capture `[UR-A]`.
- Generic materials bore a child who is ahead in some domains and average in others
  `[A-H]`.

#### Goals
- See evidence her enrichment investment is compounding `[UR-A]`.
- Stay ahead of standards without ever making it feel like school pressure on a
  toddler `[UR-A]`.
- Keep the daily rhythm rich and novel with less nightly research `[A-H]`.

#### Representative quotes
- "Does he count to 40? What books did he read?" `[UR-A]` (the assessment as
  conversation with the mother)
- "It validated the homeschooling journey itself." `[UR-A]` (paraphrase of testimony)
- "I'll pay for it as long as I can see it working. The day I can't, I cancel." `[inv]`

#### Evidence basis & confidence
- Sources: UR-A (heavy), SIG-F, MD. **Overall confidence: HIGH** for behavior and
  values (this is the one persona grounded in a real user); MEDIUM for demographics
  generalization (n=1; the archetype may skew more affluent/technical than the
  reachable segment of enrichment-driven preschool moms).
- Key assumption to watch: that Alessa-types exist in volume outside tech-adjacent
  households. If the archetype requires an engineer spouse to trust the product, the
  segment is tiny.

#### Top-3 validation questions
1. How many enrichment-driven preschool mothers (child under 5, pre-compulsory) will
   pay $29/mo when they have zero compliance need? What share of waitlist signups are
   pre-compulsory?
2. Does "ahead of standards" validation resonate outside the origin user, or does the
   competitive framing repel some early-years moms? (Test both framings on the landing
   page.)
3. Is voice-note capture a general behavior or an origin-user quirk? Instrument
   voice-vs-typed ratio in cohort one from day one.

---

### P2 — Rachel (the median)

**Snapshot:** Three kids (4, 7, 10). Suburban/rural. Co-op member. Single income.
Price-sensitive. Drowning in planning across three ages. Hours tracking is a legal
must. **The 10-year-old is outside the v1 materials range and every journey touching
P2 must handle that honestly** (kickoff, `[COUNCIL]` open call 3).

#### Bio & demographics
- Age 33–42, suburban or rural; placed in **Missouri** for this cast `[A-M]` (chosen
  deliberately: Missouri requires ~1,000 hours of instruction with a written log,
  making "hours tracking is a legal must" concrete; swap state without changing the
  persona if research says otherwise)
- Education: some college or degree; was the family's default educator from kid one
  `[A-M]`
- Life stage: mid-journey homeschooler, year 5. Homeschooling is identity, not
  experiment `[A-M]`
- Household: married, single income (spouse: trades/mid-level professional), three
  kids 4, 7, 10 `[COUNCIL]` (median family = 2–3 kids, 5–12)

#### Day in the life
- **6:30** Up before the kids to get one quiet coffee and stare at the planner.
- **8:30** Morning block: the 7-year-old needs her at the table for reading; the
  4-year-old orbits with interruptions; the 10-year-old is semi-independent but stalls
  the moment she stops checking.
- **The core problem of her day is scheduling herself**, not the kids: she is the
  scarce resource being triple-booked `[A-H]`.
- **12:30** Lunch + reset. She logs nothing; she means to log it all later.
- **Tuesday afternoons** Co-op: she teaches a class of other people's kids in exchange
  for her kids' classes. The co-op is also her staff room, her social life, and her
  information network `[A-H]`.
- **21:30** The guilt hour: planner open, catching up hour logs from memory, wondering
  if the 10-year-old's math slid again `[BRAND]` (the "am I doing enough" fear, at the
  median it's per-child triage).

#### Household & money
- Single income; homeschooling *is* her contribution to the family economy and she
  runs it lean `[A-H]`.
- Annual curriculum budget per child in the $150–500 range, hunted on sale, bought
  used, resold after `[A-M]` `[MD]` (curriculum-anchored pricing from the brief works
  only if Homa displaces real curriculum spend for her, not adds to it).
- $29/mo = $348/yr competes with a whole child's curriculum budget. She is the persona
  the "price against a planning assistant + custom curriculum shop" framing must
  actually convince `[MD]`.
- Subscription decisions above ~$15/mo get discussed with her husband (S1 Marcus
  pattern) `[A-M]`.

#### Tech context
- Android or older iPhone; laptop is shared and elderly `[A-M]`.
- Lives in Facebook groups and the co-op group chat `[A-H]` `[MD]` (the council flagged
  the niche as Facebook-group-organized).
- Printer is load-bearing infrastructure and a source of rage `[A-H]`.
- AI attitude: curious but wary; her feeds carry both "AI helped me plan our whole
  unit study" posts and "AI is coming for our kids" posts `[A-M]`.

#### Homeschool philosophy → product expectations
- **Charlotte Mason-influenced eclectic, Christian** `[A-M]`: living books and
  narration for the littles, but pragmatic workbooks for math, and whatever works by
  child three.
- Product expectations this creates:
  - Book lists and read-aloud suggestions must sit alongside worksheets, or the
    materials feel like "twaddle" for her 7-year-old.
  - Faith context: she doesn't need Homa to be Christian; she needs Homa to never
    surprise her (content settings she controls, no worldview landmines in generated
    materials) `[A-M]`. ❓ See open questions: religious-content stance.
  - Multi-age is non-negotiable: one plan that braids three kids around HER time,
    including combined activities (the 4- and 7-year-old share a science morning).
  - **The 10-year-old:** v1 materials (ages 2–7) can't serve him. Honest handling:
    Homa still tracks his hours, logs his work, includes him in the state report, and
    says so plainly at onboarding ("I can plan and track for him now; custom materials
    for his age are coming"). Overpromising here churns her; honest partial value
    retains her, because hours/records are her sharpest pain anyway `[SIG-C]`
    `[COUNCIL]`.

#### State regulatory context
- Missouri: ~1,000 hours/year (600 in core subjects, portions at "the regular home
  school location"), with a **written log the parent must maintain** `[MD]` (verify
  against statute per 07 §3 sourcing plan; show last-verified date in product).
- She is chronically behind on the log and reconstructs it from memory monthly, which
  she knows is legally fragile `[A-H]`.
- Homa's ambient hours capture (journal replies → hours log, "we did 2 hours of co-op"
  → logged) is aimed exactly at her `[SIG-C]` (conference moms asked for
  hours-to-state tracking unprompted).

#### Buying process
- **She champions, Marcus (S1) approves, the co-op influences.** A co-op mom's
  endorsement is worth ten ads; a co-op mom's warning kills the deal `[A-H]` `[MD]`
  (community-trust dynamics per council V1 discussion).
- Trigger: February collapse, a new baby, or a state-report deadline scare `[A-M]`.
- Selection criteria: (1) does it cut my planning hours, (2) does the state report
  actually work, (3) can I afford it / justify it to Marcus.
- Objections: price vs trackers she's seen at $8/mo `[MD]`; AI wariness; "another
  subscription."
- Success metric: Sunday-night planning shrinks from 2 hours to 20 minutes, and the
  hours log is just... done `[A-M]`.

#### Pains
- Triple-booked personal attention; planning three ages is a nightly optimization
  problem she solves in her head `[A-H]`.
- The hours log: legally required, chronically reconstructed, quietly terrifying
  `[SIG-C]` `[A-H]`.
- The middle child's needs are the ones that slip (the oldest demands, the youngest
  cries) `[A-M]`.
- Curriculum switching costs: she owns three math curricula that didn't work `[A-M]`.

#### Goals
- Get evenings back; stop being the family's human scheduling algorithm `[A-H]`.
- A defensible, always-current hours log and a one-tap state report `[SIG-C]`.
- Evidence per child, so triage decisions ("who needs me most this month") are made
  from data, not guilt `[BRAND]` `[A-M]`.

#### Representative quotes
- "I need the hours to count themselves. I am not a stenographer." `[inv]`
- "Can it do all three kids? Because everything says per-child and means one kid." `[inv]`
- "Eight dollars I don't have to ask anyone about. Twenty-nine we talk about." `[inv]`

#### Evidence basis & confidence
- Sources: SIG-C (hours demand is real), COUNCIL (median shape), MD (price landscape),
  BRAND. No direct interview. **Overall confidence: MEDIUM** on shape and pains, LOW on
  price tolerance and philosophy mix.
- She is the volume segment; the whole business case rests on her converting at $29.
  Treat every P2 claim as a launch-critical hypothesis.

#### Top-3 validation questions
1. Will a price-sensitive single-income family pay $29/mo when the visible alternative
   is $8/mo trackers? What does she compare Homa to, unprompted? (Interview 5+ co-op
   moms; run the pricing-anchor test in cohort one.)
2. Is honest partial value for the 10-year-old (track + report, no materials)
   acceptable, or does one out-of-range kid kill the whole-family purchase?
   ❓ Feeds founder call on age-range ICP.
3. How much of her planning pain is materials vs orchestration (sequencing three kids
   around her time)? v1 generates materials; if her pain is orchestration, the wow
   must be the weekly plan, not the worksheet.

---

### P3 — Danielle (the newcomer)

**Snapshot:** Pulling her 6-year-old out of public school mid-year. Anxious,
guilt-prone, doesn't know her state's law, second-guesses everything. Needs "you're
allowed, here's the path" energy. Highest support load, highest word-of-mouth upside
(kickoff).

#### Bio & demographics
- Age 28–38; placed in **Texas** for this cast `[A-M]` (deliberate: Texas has
  essentially no notification, testing, or reporting requirements, so her fear
  massively outpaces her actual legal burden; the gap between perceived and real
  requirements IS the persona)
- Education: varies; not an educator, and painfully aware of it `[A-M]`
- Life stage: crisis-triggered newcomer. The trigger was concrete: bullying, a school
  that stopped responding, anxiety that got worse every Sunday night, or values
  drift `[A-M]` (mid-year pulls are usually push-driven, not philosophy-driven)
- Household: married or single parent; recently rearranged work (dropped shifts, went
  part-time) to make this possible, which doubled the financial anxiety `[A-M]`

#### Day in the life
- **Week 1 after pulling him:** she recreates school at the kitchen table with a
  printed schedule, a flag-salute impulse, and six subjects a day. By 10:30 he's
  melting down and she's in the bathroom googling "am I ruining my child" `[A-M]`
  `[BRAND]`.
- She doesn't know that this arc (school-at-home → crash → deschooling → finding a
  rhythm) is so common it has a name. Nobody tells newcomers this `[A-H]`.
- Evenings: three hours in Facebook groups reading contradictory advice, one tab of
  state law she can't parse, one tab of curriculum reviews, cart holding $600 of
  boxed curriculum she's afraid to buy `[A-M]`.
- Every interaction with extended family includes a defense of the decision (see S3
  and the MIL job story JS-S2).

#### Household & money
- Income just took a hit to make homeschooling possible; every purchase is scrutinized
  through "did I just make an expensive mistake" `[A-M]`.
- Paradox: she's the most anxious about money AND the most likely to panic-buy a $400
  boxed curriculum for the feeling of legitimacy `[A-M]`. Homa at $29/mo positioned as
  "try a month before you buy a curriculum" can intercept that panic-buy; that framing
  is worth testing (see forces, path A).
- Will pay for reassurance. The support cost is high but the LTV driver is emotional,
  and her gratitude converts to evangelism (kickoff: highest word-of-mouth upside).

#### Tech context
- Phone-first entirely; the laptop belongs to the school district and went back with
  the Chromebook `[A-M]`.
- Found homeschooling via Facebook groups, TikTok/Instagram homeschool content, and
  one friend at church `[A-M]` `[MD]`.
- AI attitude: unformed. She'll accept AI help if it's framed as a knowledgeable
  friend; she'll bounce off anything that feels like the ed-tech her kid's school used
  to spam her with `[A-L]`.

#### Homeschool philosophy → product expectations
- **None yet; school-at-home by default** `[A-H]`. She will drift eclectic over 6–12
  months like most newcomers.
- Product expectations this creates:
  - Homa must NOT ask her to pick a philosophy at onboarding (she can't; the question
    itself is a stressor). Offer "not sure yet" as the first-class default and let
    the profile learn her drift `[A-H]`.
  - She needs **permission mechanics** more than planning mechanics: "a lighter day
    is still a good day" is aimed directly at her `[BRAND]`.
  - Deschooling guidance is a differentiator no tracker offers: Homa can pace her
    expectations ("most families take a season to find their rhythm, here's what this
    week can look like") `[A-M]`.
  - The state-law moment is her make-or-break trust moment: "You're in Texas. You're
    allowed to do this. Here is the whole legal path, in plain words." If Homa gets
    her state's law right and calm, she's loyal; one wrong legal claim and she's gone
    and posts about it (P4's churn trigger applies to P3 doubly because she can't
    detect errors herself) `[MD]`.

#### State regulatory context
- Texas: homeschools are unaccredited private schools; no notification, no testing, no
  hour logs; curriculum must cover basic subjects including good citizenship `[MD]`
  (verify per 07 §3; statute-linked, last-verified date shown).
- Her actual legal burden: nearly zero. Her perceived burden: enormous. The product
  moment is closing that gap gently, then redirecting her energy from compliance fear
  to rhythm-building `[A-H]`.
- Caveat for the cast: if she were in NY she'd be a different persona (that's P4's
  territory). Journeys should use P3 for the fear-exceeds-reality path and P4 for the
  reality-is-heavy path.

#### Buying process
- **She decides, in a hurry, at 11 pm** `[A-M]`. Lowest-friction buyer in the cast but
  also the most refundy: buys fast, churns fast if the anxiety isn't relieved fast.
- Influencers: Facebook group strangers (highest volume), the one church friend
  (highest trust), homeschool influencers on short-form video `[A-M]`.
- Trigger: the decision to pull him, or week-3 drowning.
- Selection criteria: (1) will this tell me I'm doing it right, (2) is it legal-safe,
  (3) is it easy right now, tonight.
- Objections: "I should be able to do this myself"; "one more thing to learn while
  I'm drowning."
- Success metric: she sleeps better within two weeks. Genuinely. The metric is
  anxiety, not hours saved `[BRAND]`.

#### Pains
- Doesn't know what she doesn't know; every choice feels irreversible `[A-H]`.
- Guilt stacked three deep: guilt about the school years, guilt about the messy
  present, pre-guilt about hypothetical future gaps `[BRAND]`.
- Contradictory advice avalanche in the groups; no way to know which advice fits her
  kid `[A-M]`.
- The 6-year-old is deschooling too (school behaviors, resistance) and she reads his
  resistance as her failure `[A-M]`.

#### Goals
- Confirmation she's allowed, legally and morally, to do this `[A-H]`.
- A this-week plan she can actually execute tomorrow morning `[A-H]`.
- Visible evidence within weeks that he's okay and learning, to show herself, her
  spouse, and her mother-in-law `[BRAND]` `[A-M]`.

#### Representative quotes
- "I pulled him Tuesday. What do I legally have to do? Nobody will give me a straight
  answer." `[inv]`
- "Everyone in the group says something different and they're all sure." `[inv]`
- "I just need someone to tell me this week went fine." `[inv]`

#### Evidence basis & confidence
- Sources: BRAND (the fear/reassurance research maps to her most directly), MD
  (newcomer surge patterns, group dynamics), A. No direct interview. **Overall
  confidence: MEDIUM** on the emotional shape (well-documented pattern in the
  community), LOW on channel mix and willingness-to-pay while income just dropped.
- She is the highest-support persona; council's invite-gated rollout `[COUNCIL]`
  means cohort one should include only 2–3 Danielles, deliberately, with concierge
  support watched closely.

#### Top-3 validation questions
1. Will a newcomer whose income just dropped pay $29/mo in month one, or is she a
   free-trial-heavy segment needing a longer runway (extended trial, newcomer plan)?
2. Is deschooling guidance a wow or scope creep? (Prototype one "first two weeks"
   conversational track with cohort-one newcomers before building anything.)
3. What share of her nighttime research questions can Homa answer safely without
   giving what reads as legal advice? Where is the "consult HSLDA/a lawyer" line?

---

### P4 — Monica (compliance-heavy state)

**Snapshot:** New York (or PA). IHIPs, quarterly reports, portfolio evaluations.
Records ARE the job. Will churn instantly over a wrong legal claim; will evangelize
over a generated quarterly report that works (kickoff).

#### Bio & demographics
- Age 36–46, suburban New York (Long Island / Hudson Valley) `[A-M]`
- Education: degree, often a former professional (teacher, nurse, paralegal energy:
  detail-orientation is the trait, whatever the field) `[A-M]`
- Life stage: veteran, years 4–10, two kids (6 and 9; the 9-year-old is near the v1
  materials edge, one more reason the age-range call matters ❓) `[A-M]` `[COUNCIL]`
- Household: married, dual or 1.5 incomes, financially stable `[A-M]`

#### Day in the life
- Her homeschool runs fine. Her **paperwork** runs her `[A-H]`.
- Four times a year, quarterly-report week eats 6–10 evenings: reconstructing what was
  covered per subject per child, mapping it to the IHIP she filed in summer, writing
  prose summaries, computing attendance/hours `[A-M]`.
- July: IHIP season. She drafts instructional plans per child per subject, cross
  checking last year's letter from the district and the group wisdom on what her
  district's reviewer nitpicks `[A-M]`.
- June: annual assessment (portfolio review or standardized test depending on grade
  and district posture); she keeps a physical portfolio box per child, chronically
  under-filed `[A-M]`.
- She knows her district administrator by name and reads every letter twice. District
  variance in how the regs are enforced is folklore she trades with other NY moms
  `[A-M]`.

#### Household & money
- Will pay real money for real compliance relief; already pays for record-keeping
  tools and/or an evaluator `[MD]` (ArborSlate-style per-state depth is the model).
- $29/mo is not her objection. Correctness is. She would pay $49 for the plan that
  does her quarterlies reliably `[A-M]`.
- Buying is hers; her spouse defers on all homeschool decisions but pays attention to
  the district's letters `[A-M]`.

#### Tech context
- Laptop + phone; spreadsheet power user; her records live in a fragile personal
  system of Google Sheets, folders, and the portfolio box `[A-M]`.
- Deeply skeptical of tools that "support all 50 states" with a generic template; she
  has been burned by generic before. She checks whether the tool knows the difference
  between §100.10 requirements and folklore `[A-M]`.
- AI attitude: instrumental. She doesn't want a friend; she wants a competent clerk
  whose work she can audit. **Show sources, show the statute, show last-verified
  dates** `[MD]` (07 §3 sourcing plan is aimed at her).

#### Homeschool philosophy → product expectations
- **Classical** `[A-M]`: memory work, structured progression, Latin for the
  9-year-old, high standards held calmly.
- Product expectations this creates:
  - Rigor-compatible taxonomy: her subjects include things like Latin, logic, and
    composer study; a taxonomy hardcoded to "reading, math, science, art" reads as a
    toy. The subject model must be extensible `[A-M]`.
  - Mastery language over encouragement language: she tolerates warmth but buys
    precision. For P4 the reassurance-first voice must never blur into vagueness;
    numbers with sources, then warmth `[BRAND]`-tension worth watching.
  - Her benchmark interest is different from P1's: not "ahead" validation but
    **defensible documentation** that ties observations to standards a reviewer would
    recognize `[A-M]`.

#### State regulatory context
- NY: among the heaviest in the country: annual IHIP filing, quarterly reports (4x),
  attendance records, required subject list by grade band, annual assessment with
  specific rules by grade, all with district-level enforcement variance `[MD]`.
- Records are not a feature for her; **records are the job** (kickoff). The product
  promise "log everything, compile later; reports assembled from logs when needed"
  (product principle 5) is her entire purchase rationale.
- **The churn trigger is asymmetric:** one confidently-wrong legal claim (wrong
  quarterly due date, wrong assessment rule for grade 4) and she's gone the same day,
  and she tells the NY groups why `[A-H]`. Conversely a quarterly report generated
  from her logs that her district accepts without comment makes her a lifetime
  evangelist in the exact groups where trust is decisive `[A-M]`.
- v1 honesty (02-user-journeys J4): generic report first, per-state depth by demand.
  For Monica, the product must be explicit about what it does and doesn't do for NY
  yet. "Concierge state-report" (council adoption #2: "ask Homa" → compiled from the
  log, human-reviewed) is the right cohort-one shape for her.

#### Buying process
- **She decides; the NY homeschool groups are the jury** `[A-M]`.
- Trigger: quarterly-report week pain, or an IHIP-season dread spike (July), or a
  district letter that scared her.
- Selection criteria: (1) NY-correct, provably, (2) report output quality she can
  file, (3) data export (she will not be locked in; the records are legally hers and
  she knows it).
- Objections: "generic 50-state tools always disappoint"; AI hallucination fear is
  rational and specific for her (a hallucinated statute is a real harm).
- Success metric: a filed quarterly with zero district pushback, produced in under an
  hour from logs she didn't have to manually keep `[A-M]`.

#### Pains
- Quarterly reconstruction burns 6–10 evenings 4x/year `[A-M]`.
- Fear of the district letter; enforcement variance means she over-documents
  everything defensively `[A-M]`.
- Her fragile personal system has a bus factor of one and she knows it `[A-M]`.
- Tools that claim her state and deliver a generic template `[MD]`.

#### Goals
- Compliance produced as a byproduct of living, not as a second job `[SIG-C]`-adjacent.
- An audit trail she could hand a reviewer with total confidence `[A-M]`.
- Keep the rigor of her classical program visible in the records (the records should
  make her homeschool look as good as it is) `[A-M]`.

#### Representative quotes
- "If it gets one date wrong for my district, I can never trust anything it says
  again." `[inv]`
- "I don't need encouragement. I need my quarterlies done." `[inv]`
- "Show me where the regulation says that." `[inv]`

#### Evidence basis & confidence
- Sources: SIG-C (compliance demand is validated in general), MD (competitor per-state
  model, NY reg structure), COUNCIL. No direct interview. **Overall confidence:
  MEDIUM** on pains (NY burden is objectively documented), LOW on her tolerance for
  v1's generic-report honesty and on the classical-philosophy pairing.
- Strategic note: P4 is the persona with the clearest willingness-to-pay and the
  sharpest failure mode. She should NOT be in the first invite wave until the NY
  ruleset is statute-verified `[COUNCIL]` (invite gating lets us choose this).

#### Top-3 validation questions
1. Will she accept a v1 that tracks everything but generates a *generic* report while
   NY templates are concierge/human-reviewed? What exact wording keeps her trust?
2. What does her district actually accept? (Collect 3–5 real accepted quarterly
   reports from NY moms as the gold-standard corpus before building the generator.)
3. Does the classical segment want a different materials engine (memory work,
   copywork) badly enough that v1's early-years materials feel irrelevant to her
   6-year-old? Where is her materials-vs-records value split?

---

### P5 — Jess (the working homeschooler)

**Snapshot:** Part-time WFH. Schools evenings/weekends. Time-starved, voice-first,
efficiency over enrichment. Most sensitive to friction; most likely to convert on
"it makes the plan so I don't have to" (kickoff).

#### Bio & demographics
- Age 30–40; placed in **Washington state** for this cast `[A-M]` (deliberate: WA
  requires a filed declaration of intent, annual assessment, and a parent
  qualification requirement, enough regulation to matter but light enough that it's a
  background task for a busy parent, which is exactly how she treats it)
- Education: degree; works ~25 hrs/week remote (customer success, bookkeeping, design,
  nursing shifts swapped with a spouse: the trait is a real job with real hours)
  `[A-M]`
- Life stage: two kids (4 and 6); homeschooling year two, chosen for flexibility and
  fit, sustained only because the logistics barely close `[A-M]`
- Household: dual income; she and her spouse tag-team; some weeks Grandma (S2) covers
  Tuesday and Thursday mornings `[A-M]`

#### Day in the life
- **6:00–8:30** Work block one, before the house wakes.
- **9:00–11:00** School block with the kids on non-work-morning days; otherwise
  Grandma Sue runs a Homa-printed activity set (see S2).
- **12:00–17:00** Work block two, kids in quiet time / co-op / grandparent care.
- **17:30** The gap: dinner prep with a kid narrating. Her logging happens here,
  voice, phone on the counter, exactly the "standing in a kitchen holding a
  4-year-old" posture the kickoff pins `[A-H]`.
- **19:30–20:30** Evening school: reading practice, math game. Weekends carry the
  bigger projects.
- She does not have a planning hour. **Any product that requires a planning hour has
  already lost her** `[A-H]`.

#### Household & money
- Two incomes; money is less scarce than time by an order of magnitude `[A-M]`.
- She already pays for convenience unapologetically (grocery delivery, meal kits).
  $29/mo clears instantly IF the time savings are felt in week one `[A-M]`.
- She decides alone, on her phone, possibly during a meeting `[A-M]`.

#### Tech context
- Power phone user; voice messages are her native format (she runs her job partly on
  them) `[A-H]`.
- Ruthless app churner: installs fast, deletes fast. Every extra tap is a churn vote.
  Most friction-sensitive persona (kickoff) `[A-H]`.
- AI attitude: enthusiastic and unsentimental. Already uses ChatGPT for work and
  sometimes for kid activities; knows its memory limitation firsthand (she's re-pasted
  "my daughter is 6, likes dinosaurs, reading at level X" into ChatGPT twenty times)
  `[A-M]`. She is the persona closest to switching path C (forces §4c).

#### Homeschool philosophy → product expectations
- **Relaxed eclectic, unschool-curious, efficiency-governed** `[A-M]`: she believes in
  child-led learning philosophically but runs a tight practical loop because time is
  scarce. Interest-led on weekends, workbook-efficient on weeknights.
- Product expectations this creates:
  - **The plan must arrive made.** "It makes the plan so I don't have to" is her
    conversion sentence (kickoff). Weekly plan generation is her wow, not the
    worksheet `[A-H]`.
  - Materials must be executable by a proxy adult (S2 Grandma Sue) without Jess
    translating: self-contained instructions on the printable itself `[A-M]`.
  - Unschool-curious wrinkle: benchmark framing must stay opt-in-feeling for her;
    she wants the evidence without the school-flavored ceremony. Ambient logging
    that turns ordinary life into progress evidence is the perfect fit for her
    philosophy AND her schedule `[A-M]`.
  - Evening/weekend cadence: Homa's daily rhythms (morning greeting, evening journal
    prompt) must adapt to HER schedule, not a 9am-school default. Scheduling
    assumptions are a hidden friction risk flagged for journey docs 02/03 `[A-H]`.

#### State regulatory context
- WA: annual declaration of intent to the district; annual assessment (standardized
  test or certificated-teacher evaluation); parent qualification requirement; subject
  coverage list `[MD]` (verify per 07 §3).
- She treats compliance as an annual chore to be automated: "remind me, prefill it,
  tell me when it's done" `[A-M]`. Deadline-aware nudges (one, calm) are high value;
  she will forget the declaration otherwise.

#### Buying process
- **Sole, instant decision-maker.** Fastest convert in the cast; also the fastest
  churn `[A-H]`.
- Influencers: almost none socially; she's time-poor, not community-embedded. A
  targeted ad, a podcast mention, or one friend's screenshot converts her `[A-M]`.
- Trigger: a week where the tag-team broke (spouse travel, deadline crunch) and school
  just didn't happen, and the guilt spike after `[A-M]` `[BRAND]`.
- Selection criteria: (1) minutes saved in week one, (2) voice-first everything, (3)
  does it hold state (never re-explain the kid).
- Objections: none philosophical; purely "will this actually be faster than my
  current hack."
- Success metric: Sunday plan arrives without her asking; Grandma Tuesday runs itself;
  the assessment reminder fires in April `[A-M]`.

#### Pains
- Time debt everywhere; school competes with work for the same scarce hours `[A-H]`.
- Re-explaining her kids to every tool and every LLM session (ChatGPT amnesia) `[A-M]`.
- Handoff friction: prepping activities a grandparent can run takes longer than
  running them herself `[A-M]`.
- Guilt spikes when work wins a week `[BRAND]`.

#### Goals
- The plan made for her, adapted to her actual calendar `[A-H]`.
- Capture-by-voice so progress tracking costs zero minutes `[UR-A]`-pattern, `[A-H]`.
- Proof the unconventional schedule is working, for herself and for the annual
  assessment `[A-M]`.

#### Representative quotes
- "If it takes more than one voice note, I'm not doing it." `[inv]`
- "I have told ChatGPT my daughter's reading level twenty times." `[inv]`
- "Make Tuesday something my mother-in-law can run without calling me." `[inv]`

#### Evidence basis & confidence
- Sources: BRAND, MD, the voice-first pattern from UR-A generalized. No direct
  interview. **Overall confidence: MEDIUM** on shape, and her existence as a segment
  is well-supported (working homeschoolers are a large and growing slice `[MD]`), LOW
  on cadence-adaptation needs and proxy-adult (S2) frequency.

#### Top-3 validation questions
1. What fraction of the target market schools on non-standard schedules, and does the
   product's daily-rhythm design (morning/evening defaults) alienate them? (Add a
   schedule question to onboarding; measure.)
2. Is the ChatGPT-amnesia pain real and articulated (making path C the easiest
   marketing wedge), or do working moms not yet connect "memory" to value until shown?
3. Does she need multi-adult access (S1/S2) in v1, or is "print the packet and text
   it" a good-enough handoff for the first year? ❓ Feeds shared-account scoping.

---

### Persona cast summary table

| Code | One-line JTBD center | Compliance load | Price posture | Philosophy | Riskiest assumption |
|---|---|---|---|---|---|
| P1 Alessa | Validate and extend an ahead-of-standards trajectory | None (pre-compulsory) | Comfortable, audits value | Eclectic enrichment | Segment volume beyond tech-adjacent households |
| P2 Rachel | Orchestrate 3 ages + make the hours log keep itself | High (MO ~1,000 hrs, logged) | Tight; $29 is a discussion | CM-influenced eclectic, Christian | Converts at $29 vs $8 trackers |
| P3 Danielle | Be told "you're allowed" + get a runnable this-week plan | Perceived huge, actually near-zero (TX) | Anxious; buys fast, churns fast | None yet (school-at-home) | Pays during an income dip |
| P4 Monica | Records as byproduct; file-ready NY reports | Extreme (NY: IHIP + quarterlies + assessment) | Pays for correctness, $49-capable | Classical | Tolerates v1 generic-report honesty |
| P5 Jess | The plan arrives made; capture costs zero minutes | Light-moderate annual (WA) | Pays for time instantly | Relaxed eclectic, unschool-curious | Friction bar is as brutal as assumed |

---

## 2. Empathy map — homeschool mothers × "an AI assistant that knows my child"

Audience: the composite core audience (P1–P5 weighted toward P2, the median). Topic:
adopting and living with an AI assistant that maintains a persistent, compounding
profile of her child. Insights draw on `[UR-A]`, `[BRAND]`, `[MD]`, `[COUNCIL]`, and
behavioral/psychological reasoning; all unattributed items are `[A-M]` analytical
assumptions. The unspoken items are marked 🔇.

### Thinks
1. "Am I doing enough? Are they behind? Am I enough?" The base loop, running under
   everything, mostly invisible to everyone around her `[BRAND]`.
2. 🔇 "Whose kid is further ahead, mine or hers?" Quiet competitive scanning of every
   co-op session and every group post. Never said aloud because the community's
   official value is "every child blooms in their own time," so the ranking instinct
   gets pushed underground, where it grows `[UR-A]` (the origin testimony names this
   directly: "your child should be doing better than the other kids").
3. "If I let an AI do the planning, am I still the one homeschooling him?" A quiet
   identity question. Her labor is her legitimacy; outsourcing it feels like it
   subtracts from her claim to the outcomes. (Design consequence: the promise
   architecture "You've got this. HOMA's got the rest" splits labor exactly along
   this line, affirming her part `[BRAND]`.)
4. 🔇 "An app that knows my child this well... what happens to all of that if I
   cancel? If they're breached? If they train on him?" The profile is the moat AND
   the deepest fear object. She thinks about this at 2 am even if she never asks
   `[COUNCIL]` (security review's whole posture exists because of this).
5. "I could probably do all of this myself with enough time." True, and the thought
   both blocks the purchase (guilt about outsourcing) and eventually drives it (she
   has run the experiment; she does not have enough time).
6. "The curriculum was expensive and we abandoned it in November. What's different
   this time?" Every prior tool/curriculum purchase is a scar that transfers onto
   the next one `[MD]`.

### Feels
1. **Overwhelmed as a baseline**, not a spike: the mental load of teacher + planner
   + principal + parent with no staff room `[BRAND]`.
2. **Isolated in responsibility.** Even with a co-op and groups, the accountability
   is hers alone; there is no colleague, no principal to share blame. "No one to say
   you're doing fine" `[BRAND]`.
3. 🔇 **Validation hunger.** Years of unpaid, unreviewed, invisible work with no
   performance review, no gold star, no one grading the teacher. The weekly note
   ("Math is up 12 points since the fractions set") is the first performance review
   of her career as an educator; the emotional payload is much larger than the
   information payload `[UR-A]` `[BRAND]`.
4. **Pride with no safe outlet.** When her kid reads early, the mixed company of
   school moms and struggling homeschool moms makes bragging costly; she needs a
   witness who can celebrate without social risk. An AI that notices ("that's ahead
   of his band") is a socially free witness 🔇.
5. **Guilt with many heads:** screen-time guilt (using an app to raise a child she
   pulled from screens 🔇), the messy-day guilt, the February guilt, the "I snapped
   at him during math" guilt `[BRAND]`.
6. **Fear of being audited**, by the state (P2/P4), by relatives (S3 dynamics), by
   the imagined future adult child ("will he thank me or resent me?").
7. **Relief-seeking exhaustion:** by evening her decision budget is spent; anything
   that asks her to decide one more thing gets deferred forever. (Design consequence:
   Homa proposes, never assigns homework to the mom.)

### Says
1. "We don't compare our kids to public school timelines." (Said in groups; the
   watching of timelines continues privately 🔇 `[UR-A]`.)
2. "What curriculum do you use?" The universal greeting of the community, and never a
   neutral question: it's identity-probing, ranking, and alliance-forming at once
   `[MD]`.
3. "I want one." What the origin user's friend said on seeing a compounding child
   profile with daily materials `[SIG-F]`: the demand is visceral when shown, not
   argued.
4. "Can it track hours for my state?" The first question conference moms actually
   asked `[SIG-C]`: compliance is the socially safe way to ask for help (asking for
   planning help admits overwhelm; asking for compliance help is just bureaucracy).
5. "I'm not against AI, I just don't want it teaching my kids." The stated line most
   moms hold; it conveniently permits an AI that helps HER (secretary, clerk,
   researcher) while the teaching stays hers. Positioning must live entirely on the
   right side of this sentence.
6. "We're relaxed about it, kids learn at their own pace." Frequently said by the
   same mom who privately screenshots milestone charts 🔇.

### Does
1. Plans at night in stolen hours: paper planner, spreadsheet, or nothing but
   anxiety. Reconstructs logs from memory before deadlines (P2/P4) `[A-H]`.
2. Photographs everything (the workbook page, the block tower) into an unsearchable
   camera roll: a portfolio nobody will ever assemble. Capture without compile
   `[A-H]`, exactly the gap product principle 5 closes.
3. Asks the group before asking any professional: crowdsources curriculum choice,
   legal interpretation, and reassurance in Facebook groups at 11 pm `[MD]`.
4. Buys curriculum in July at full optimism, abandons pieces by November, resells in
   spring. The annual cycle of hope and shelf-guilt `[MD]`.
5. Voice-notes into her phone when her hands are full, if any tool will receive it
   `[UR-A]`: the behavior exists; most tools just can't catch it.
6. Screens every new tool with one question: "show me what it makes." Artifacts are
   judged in seconds, phone-first, often from a group screenshot 🔇.
7. Lurks before posting; reads 50 threads for every 1 she writes. Marketing that
   relies on her asking questions publicly will under-measure her interest.

### Sees
1. Picture-perfect homeschool Instagram: nature-table tableaux, cursive-perfect
   copywork, sunlit reading nooks. She knows it's curated; it compresses her anyway
   `[BRAND]`.
2. Her actual kitchen table at 10 am: chaos, a crying 4-year-old, a math page with
   three tear blots. The gap between feed and table is where the guilt lives.
3. Group posts oscillating between "AI saved my homeschool" and "AI is a danger to
   our children," with the comment wars beneath `[A-M]`.
4. Public school outcomes in her feed and family conversations, framed as the
   default her choice is measured against.
5. Her child, closely, every day: she has more observational data on this child than
   any teacher has ever had on any student, and nowhere structured to put it. (This
   is the raw material the profile is built from; she already collects it 🔇.)
6. Competitor tools that look like school software: gradebooks, red/green dashboards,
   admin-speak. They look like the thing she left `[MD]`.

### Hears
1. "Aren't you worried about socialization?" On loop, from strangers, pediatricians,
   and family. She has a rehearsed answer and a private flinch.
2. The mother-in-law's polite doubt: "And how will you know he's keeping up?" (See
   JS-S2; the empathy map's single most convertible moment: Homa's benchmark view is
   literally the answer to this sentence.)
3. Co-op hallway intel: which curriculum, which evaluator, which district reviewer is
   strict, which mom's kid just tested three grades ahead 🔇.
4. Her spouse asking, kindly or not: "so how's it actually going?" and realizing she
   has feelings but no evidence either way `[BRAND]`.
5. In religious communities: sermons and group culture that prize the mother's
   personal formation of the child, and rising suspicion of AI as a worldly shortcut
   or a data harvester 🔇 `[A-M]`. (The AI-skepticism here is not tech-phobia; it's
   stewardship theology plus privacy instinct. Marketing that treats it as ignorance
   will backfire; marketing that respects it, "you talk, Homa types; the teaching is
   yours," can convert it.)
6. Homeschool podcasts/influencers she trusts more than any ad `[A-M]`.

### Pains
1. The planning tax: hours weekly, unpaid, invisible, recurring forever `[BRAND]`.
2. Evidence anxiety: required to prove learning happened (state, family, self) while
   having no system that turns daily life into proof `[SIG-C]`.
3. Multi-child arithmetic: N kids × M subjects × one mom; the constraint is her
   attention, and nothing on the market schedules HER `[A-H]` (P2's core pain).
4. Tool fatigue and re-explaining: every app starts from zero on her child; nothing
   compounds `[MD]` (the moat is the antidote: the profile compounds).
5. 🔇 The comparison wound: every co-op showcase and feed scroll re-opens it; no tool
   has ever dared to address it directly, which is exactly why the benchmark-without-
   testing mechanic is category-defining `[UR-A]`.
6. The February trough: motivation collapse mid-winter, curriculum abandoned, guilt
   compounding (see JS-E4).
7. Fear of the irreversible: "if I get this year wrong, he pays for it forever."
   Weight without evidence in either direction.

### Goals
1. **Feel calm, capable, and not alone** `[BRAND]`: the emotional job, verbatim.
2. **Know where each child stands without subjecting them to testing** `[UR-A]`: the
   validated core desire, in tension and resolution at once (she wants the data,
   refuses the method schools use to get it; the observational assessment resolves
   the tension).
3. **See her work move the numbers** `[UR-A]`: efficacy attribution as the renewal
   engine ("Homa's activities raised his phonics numbers, here's the before/after").
4. Get evenings back; shrink the planning tax toward zero (P5's conversion sentence).
5. Have the receipts: for the state, for the skeptics, for herself at 2 am.
6. Belong: find her people locally (co-ops, story hours, Homa families nearby), so
   the isolation gets structurally fixed, not just soothed `[UR-A]` (connector value).
7. Raise a child who is visibly thriving BY HER method: vindication of the whole
   life choice, which is what "validated the homeschooling journey itself" means
   `[UR-A]`.

### Key takeaways (for the other four workstreams)
1. **The product's true competitor is her guilt, not other apps.** Every journey
   should be scored against "does this reduce or feed the 2 am loop."
2. **The benchmark data is an emotional product wearing a data product's clothes.**
   Presentation law (strengths-first, no deficit language, one nudge max) is not
   polish; it's the product `[UR-A]` `[COUNCIL]`.
3. **Compliance is the socially acceptable door; validation is the house.** Market
   hours-tracking, deliver identity-validation `[SIG-C]` → `[UR-A]`.
4. **The AI must be positioned as HER staff, never the child's teacher.** "You talk,
   Homa types." This one sentence defuses identity threat, religious skepticism, and
   screen-time guilt simultaneously.
5. **The profile is both moat and fear object.** Privacy posture must be marketed as
   loudly as features to P2/P4 and religious segments; export-anytime is a trust
   feature, not a churn feature `[COUNCIL]`.

---

## 3. JTBD job stories

Format: "When [situation], I want [motivation], so I can [outcome]." Clustered by job
type. Each tagged with primary personas and evidence. Numbered for citation by other
workstreams (JS-F/E/S = functional / emotional / social).

The emotional and social clusters are the moat: every competitor serves some slice of
the functional cluster; none touch the emotional ones `[MD]` `[UR-A]`.

### Functional jobs

- **JS-F1 · The day's plan.** When it's 8 am and three kids are at three different
  points in five subjects, I want today's activities proposed for each child around
  MY available attention, so I can start teaching instead of triaging. (P2, P5)
  `[A-H]`
- **JS-F2 · Materials on demand.** When my daughter is obsessed with horses this
  week and her handwriting needs work, I want practice pages that use her obsession,
  so I can get willing practice instead of a fight. (P1, P2, P5) `[UR-A]` (the
  working system's daily reality)
- **JS-F3 · Ambient hours capture.** When we finish co-op or a museum afternoon, I
  want to say one sentence and have the hours land in the right child's log under
  the right subject, so I can be legally covered without being a stenographer.
  (P2, P4) `[SIG-C]`
- **JS-F4 · The state report.** When the reporting deadline approaches, I want the
  quarter's records compiled into the document my state expects, so I can file in an
  evening what used to eat a week. (P4, P2) `[SIG-C]` `[MD]`
- **JS-F5 · Observation capture.** When my son counts to 40 in the car, I want to
  speak it into my pocket and have it become part of his record, so the moment
  becomes evidence instead of evaporating. (P1, P5, all) `[UR-A]`
- **JS-F6 · Position without testing.** When I wonder whether my 5-year-old's
  reading is where it should be, I want to answer a few conversational questions
  about what he actually does, so I can see his position against real standards
  without ever putting a test in front of him. (P1, P3, P2) `[UR-A]`
- **JS-F7 · Curriculum triage.** When my math curriculum is failing my 7-year-old in
  October, I want a comparison of alternatives against HER specific profile, so I
  can switch once, correctly, instead of buying three more mistakes. (P2, P3) `[MD]`
  `[UR-A]` (connector value #3)
- **JS-F8 · The learning-linked outing.** When we're studying space this week, I
  want to know the planetarium has a show Saturday, so I can turn the unit into a
  memory without doing the research myself. (P1, P2) `[UR-A]` (connector value:
  "Maya's learning about space this week, want tickets to the Air & Space Museum?")
- **JS-F9 · The proxy-adult handoff.** When Grandma covers Tuesday morning, I want a
  self-contained activity packet she can run without calling me, so I can work my
  shift without directing homeschool by text. (P5, P2 + S2) `[A-M]`
- **JS-F10 · The newcomer's legal onramp.** When I've just decided to pull my son
  out of school, I want my state's actual requirements translated into a short
  checklist with dates, so I can stop being afraid of a law I haven't read. (P3,
  P4-lite) `[MD]` `[A-H]`

### Emotional jobs (the moat)

- **JS-E1 · The 2 am answer.** When it's late and the "am I doing enough?" loop
  starts, I want to open one screen that shows what my kids learned recently and
  where they stand, so I can put the phone down and sleep. (All; P3 acutely)
  `[BRAND]` `[UR-A]`
- **JS-E2 · Proof my work works.** When I've spent three weeks on phonics with no
  visible change, I want to see the numbers move and hear that the work we did moved
  them, so I can trust the process (and myself) enough to keep going. (All) `[UR-A]`
  ("the ultimate selling point," verbatim)
- **JS-E3 · Permission for a light day.** When the toddler is sick and school just
  isn't happening today, I want the plan to bend without a red mark appearing
  anywhere, so I can take the day off without paying for it in guilt. (P2, P5, P3)
  `[BRAND]` ("a lighter day is still a good day")
- **JS-E4 · February.** When it's deep winter, the curriculum is stale, everyone's
  burnt out and I'm fantasizing about the yellow bus, I want a genuinely fresh
  reset (new materials, a lighter rhythm, one encouraging picture of how far we've
  come since September), so I can get to spring without quitting or hating this.
  (P2, P3, P5) `[A-H]` (the February slump is community folklore; the
  September-to-now progress view is the product's unique answer)
- **JS-E5 · The bad-day spiral breaker.** When today ended in tears (his and mine)
  and I'm typing "should I put him back in school" into a search bar, I want
  perspective grounded in HIS actual trajectory, so I can tell one bad day from a
  wrong path. (P3, P2) `[BRAND]` `[A-M]`
- **JS-E6 · Witness to the win.** When she reads her first sentence alone and no
  colleague or principal exists to tell, I want the moment recorded and celebrated
  by something that knows how far she came, so the win lands somewhere besides my
  camera roll. (P1, P5, all) 🔇 validation hunger `[BRAND]` `[A-M]`
- **JS-E7 · Guilt-free delegation.** When I hand the planning to an AI, I want to be
  shown that the teaching, the patience and the love are still mine (and that
  they're the parts that matter), so I can accept the help without feeling like I'm
  cheating at motherhood. (All; religious segments acutely) 🔇 `[BRAND]` `[A-M]`
- **JS-E8 · The ahead child, fed.** When my kid is ahead of his age band, I want the
  next challenge queued automatically instead of coasting, so I can honor his pace
  without becoming the crazy pushy mom in my own head. (P1) `[UR-A]`
- **JS-E9 · Starting over without shame.** When I realize we've been doing
  school-at-home wrong for two months, I want to change approach without the system
  making my first two months look like failure, so I can adjust course and keep my
  dignity. (P3) `[A-M]`

### Social jobs

- **JS-S1 · The curriculum question.** When another mom asks "what curriculum do you
  use?", I want a confident, specific answer (and quietly, evidence mine is
  working), so I can hold my place in a community that ranks each other through
  this question. (P2, P1) 🔇 `[UR-A]` (competitive-pressure testimony) `[MD]`
- **JS-S2 · The mother-in-law hearing.** When my mother-in-law asks how I can
  possibly know he's keeping up, I want to show a calm chart of where he stands
  against state standards, so I can end the conversation with evidence instead of
  defending my life choice at Thanksgiving. (P3, P2, all) `[A-H]` (the benchmark
  view is literally this answer; likely the most-screenshotted artifact in the
  product)
- **JS-S3 · The spouse briefing.** When my husband asks how homeschooling is
  actually going, I want a shared view he can check himself, so I can turn my
  solo accountability into a team sport (and get credit for invisible work).
  (P2, P5 + S1) `[A-M]`
- **JS-S4 · The socialization comeback.** When the pediatrician or a stranger asks
  about socialization, I want our co-ops, classes and outings already documented,
  so I can answer with a list instead of a flinch. (P3, P2) `[A-M]`
- **JS-S5 · The show-don't-brag.** When my kid does something remarkable, I want a
  beautiful shareable artifact (his story, his progress, his creation), so I can
  post pride as content instead of as a brag. (P1, P5) `[A-M]` (also the organic
  growth loop: the friend who said "I want one" saw an artifact `[SIG-F]`)
- **JS-S6 · Defending the choice to herself in public.** When homeschooling comes up
  at a family event and the room goes quiet, I want to be carrying (mentally or on
  my phone) proof that my kids are thriving, so I can stay warm and unshaken instead
  of rehearsing my defense all night. (P3, P2, P4) `[BRAND]` `[A-M]`

### Cluster observations
- Functional jobs get her in the door (JS-F3/F4 are the ones she'll SAY out loud
  `[SIG-C]`); emotional jobs keep her paying (JS-E1/E2 are the renewal engine
  `[UR-A]`); social jobs make her spread it (JS-S1/S2/S5 are the word-of-mouth
  artifacts).
- JS-E2 (proof my work works) is the single job no competitor even attempts `[MD]`
  and the origin user's stated "ultimate selling point." It should anchor journey
  doc 03 (retention) and the M3-11 efficacy-attribution ticket.
- JS-S2 (the mother-in-law hearing) is the sleeper marketing asset: it converts a
  private tool into a social weapon. Consider it explicitly in 02 (acquisition).

---

## 4. JTBD forces of progress — the switching decision

Force model per path: **Push** of the current situation · **Pull** of Homa ·
**Anxiety** of the new solution · **Habit** of the present. Switching happens when
Push + Pull > Anxiety + Habit. For each path: the strongest anxiety, and what product
and marketing must do to defuse it.

Applying the jtbd-forces affinitization across all three paths first, the recurring
abstract force categories (cited below as F-codes):

| Code | Abstract force | Type | Appears in |
|---|---|---|---|
| F-P1 | Planning labor is unsustainable | Push | A, B, C |
| F-P2 | Evidence/records are fragile or nonexistent | Push | A, B |
| F-P3 | Current tool doesn't know my child | Push | B, C |
| F-L1 | The compounding child profile (it knows my kid) | Pull | A, B, C |
| F-L2 | The closed efficacy loop (proof my work works) | Pull | A, B, C |
| F-L3 | Compliance as byproduct | Pull | A, B |
| F-A1 | Child-data privacy / AI trust | Anxiety | A, B, C |
| F-A2 | Price jump justification | Anxiety | B, (A) |
| F-A3 | "What am I paying for that I can't already do" | Anxiety | C |
| F-A4 | Identity threat: outsourcing motherhood | Anxiety | A, (C) |
| F-H1 | Ritual attachment (the physical planner, the prompt library) | Habit | A, C |
| F-H2 | Sunk data / migration weight | Habit | B |
| F-H3 | Community embeddedness (the groups are also her social life) | Habit | A |

### Path A — from a paper planner + Facebook groups (P2, P3, religious-leaning P2s)

**Push of the current situation**
- The planner captures intentions, not evidence; nothing compiles into logs or
  reports; deadline weeks are reconstruction archaeology (F-P2) `[A-H]`.
- Group advice is contradictory, generic, and algorithmically drama-weighted; she
  spends hours to extract minutes of relevance (F-P1) `[A-M]`.
- Nothing in her stack knows HER child; every answer must be re-contextualized by
  her, the only integration layer (F-P3) `[MD]`.

**Pull of Homa**
- One place where saying it once makes it evidence forever (F-L1) `[UR-A]`.
- The hours log keeps itself; the report compiles itself (F-L3) `[SIG-C]`.
- A knowledgeable friend who answers HER situation, not the group's median drama
  (F-L2 adjacent) `[BRAND]`.

**Anxiety of switching**
- 🥇 **Strongest: F-A1, child-data privacy fused with AI distrust**, and in
  religious segments fused further with stewardship conviction: "I'm handing a
  tech company a dossier on my child, and letting a machine into something sacred"
  `[A-H]` `[COUNCIL]` (the security council's posture anticipates exactly this).
- F-A4 identity threat: "if the plan isn't mine, is the homeschool still mine?"
- Practical: "I'm not techy; what if I set it up wrong."

**Habit of the present**
- F-H1: the paper planner is a beloved ritual object (some of these planners cost
  $60 and get unboxing videos); it signals diligence to herself `[A-M]`.
- F-H3: the groups are her staff room and friendships; leaving isn't even
  thinkable, and any pitch that implies replacing them will be rejected.

**Defusal plan (product + marketing)**
- Product: plain-English privacy page as a first-class onboarding surface (named
  subprocessors, no-training commitments, export-anytime, delete-propagation), per
  07 §2 and council S-controls. Parent-directed posture stated in-product: the
  child never uses Homa.
- Product: printables keep the paper ritual alive; Homa feeds the planner rather
  than shaming it. A weekly plan PDF she can clip INTO the paper planner is a
  bridge, not a defeat.
- Marketing: never position against the groups; position as what she brings back
  to the group ("look what it made for us"). Word-of-mouth artifact > ad `[SIG-F]`.
- Marketing to the religious segment: lead with "you talk, Homa types" and "the
  teaching is yours"; treat AI skepticism as a value to respect, not an objection
  to crush. Copy example (brand-safe): "You do the teaching. Homa does the
  paperwork."

### Path B — from an $8/mo tracker app (P2, P4)

**Push of the current situation**
- The tracker records what she types and gives nothing back: no materials, no
  insight, no memory of the child as a person (F-P3) `[MD]`.
- Data entry is her job; skip a week and the record has holes she must backfill
  (F-P1, F-P2) `[A-M]`.
- The AI sprinkles competitors added are generic: no profile behind them `[MD]`.

**Pull of Homa**
- The profile compounds: same effort in, dramatically more out (materials,
  position, proof) (F-L1, F-L2) `[UR-A]`.
- Ambient capture beats data entry: voice note in, structured log out (F-L3)
  `[SIG-C]`.
- The efficacy before/after is something a tracker cannot produce structurally
  `[UR-A]`.

**Anxiety of switching**
- 🥇 **Strongest: F-A2, the price jump.** $8 → $29 is a 3.6× ask that she must
  re-justify to herself (and P2 to Marcus/S1) every month. Beneath it: "what if
  the AI parts are a gimmick and I end up paying $29 for the same tracker"
  `[MD]` `[A-H]`.
- F-H2 sunk data: years of hours logs and records live in the old app; starting
  fresh feels like burning her own archive (and for P4 it's a legal archive).
- F-A1 present but weaker (she already trusts an app with this data; the
  question is trusting a smarter one).

**Habit of the present**
- Muscle-memory logging workflow; the subscription is invisible at $8 (below the
  audit threshold, per P2's "$15 discussion line") `[A-M]`.
- For P4: her workarounds ARE her compliance confidence; she's built district
  folklore into her spreadsheet columns.

**Defusal plan (product + marketing)**
- Product: **import is a trust feature.** Accept CSV/export formats from the top
  trackers; even a rough import ("your history is here, keep building") deletes
  F-H2. Prioritize the 2–3 biggest competitors' formats `[MD]`.
- Product: the wow must be structurally impossible for a tracker: within the first
  session she sees a personalized artifact + a position view, not a better log
  screen `[COUNCIL]` (onboarding inversion: 3-minute wow).
- Marketing: never price-compare against trackers; reframe the reference class:
  "trackers record your homeschool; Homa runs the parts you're tired of carrying."
  Anchor against curriculum + planning time, per 00-brief pricing positioning.
  Copy example: "Your tracker keeps the log. Homa keeps the log, makes the
  materials, and shows you they worked."
- Marketing: the before/after chart is the ad. Show a real (consented) improvement
  attribution from cohort one; that artifact makes $29 legible `[UR-A]`.

### Path C — from ChatGPT + Google Docs (P5, P1)

**Push of the current situation**
- Amnesia tax: she re-pastes the child's context into every session; the "profile"
  is a prompt she maintains by hand (F-P3) `[A-M]`.
- Output is raw material, not artifacts: she still formats, prints, files, and
  turns chat answers into worksheets herself (F-P1) `[A-M]`.
- Zero structure: no logs, no hours, no position, no proof; ChatGPT can discuss
  standards but can't track against them `[MD]`.

**Pull of Homa**
- Memory as the product: never re-explain the kid (F-L1); the exact pain she can
  already name `[A-M]`.
- Finished artifacts: print-ready pages with her kid's name and obsession baked
  in, in one turn (F-L2 adjacent) `[UR-A]`.
- The structured record underneath (hours, benchmarks, efficacy) that a chat
  window structurally cannot keep (F-L3) `[UR-A]`.

**Anxiety of switching**
- 🥇 **Strongest: F-A3, "I already do this for $0 (or $20 I already pay), what
  exactly is $29 buying?"** She is the most AI-literate persona; she knows what
  raw LLMs can do, so Homa must be legibly MORE than a wrapper, or she'll rebuild
  it in a weekend of prompt-tinkering and feel clever `[A-H]`.
- Secondary: flexibility loss ("a product will box me in; my prompts do exactly
  what I want"), and mild F-A1 (she's pragmatic about data but notices).

**Habit of the present**
- F-H1: her prompt library and workflow are self-built and she's proud of them;
  switching devalues her own craft `[A-M]`.
- ChatGPT is already open all day for work; zero-marginal-effort default.

**Defusal plan (product + marketing)**
- Product: lead with what wrappers can't fake: the compounding profile with
  confidence decay, the benchmark library with citations, the closed efficacy
  loop, ambient hours→report. Make the "system, not a chat" depth visible in
  the first session (show the profile updating live after her first voice note:
  "Logged. That moves her counting confidence up" per J2) `[UR-A]`.
- Product: keep chat free-form ON TOP of structure, so she never feels boxed in;
  her power-user instincts get an outlet, not a wall.
- Marketing: name the amnesia tax directly; it's the sharpest already-felt pain
  in this segment. Copy example: "Stop re-introducing your kid to a chatbot.
  Homa already knows where Maya left off."
- Marketing: do the time math honestly (worksheet: 25 minutes of prompting,
  formatting and printing vs one sentence) and the money math against her
  existing $20 ChatGPT sub: Homa replaces it for the homeschool job at +$9.

### Cross-path insight
F-A1 (child-data/AI trust) is the only anxiety present in all three paths, and it is
the one anxiety that marketing alone cannot defuse: it requires product-visible
proof (privacy surfaces, export, the parent-directed posture) plus community
testimony. The privacy page is a conversion surface and should be designed and
instrumented like one (workstream 2 note). Meanwhile the strongest per-path anxieties
(A: trust, B: price, C: differentiation) map cleanly onto the three marketing pillars
already latent in the brief: the security posture `[COUNCIL]`, the efficacy proof
`[UR-A]`, and the moat/profile `[MD]`. The positioning system is coherent; it just
needs to be aimed per channel.

---

## 5. Secondary cast (S1–S4)

### S1 — Marcus (the dad, secondary account user)

Who he is across the cast: P2's budget-approver and evening co-teacher; P5's
tag-team partner; P1's technical due-diligence reviewer. Rarely the daily driver;
almost always in the buying loop above ~$15/mo `[A-M]`.

**What he needs from a shared account:**
- **A read-mostly window, not a second cockpit.** The dashboard, the weekly note,
  and each child's position view, without being asked to learn a workflow `[A-M]`.
- **The ability to log, minimally.** He does bedtime reading and Saturday science;
  his observations should count. One-tap or voice log, zero setup `[A-M]`.
- **Proof of value at renewal time.** The efficacy before/after `[UR-A]` is also
  the internal-to-the-household sales artifact: it's what P2 shows Marcus when the
  card renews. The weekly note should be forwardable/shareable with this in mind.
- **Not:** billing control by default, settings parity, or a parallel chat identity
  that confuses the profile's sense of who "I" is. Observations must be attributed
  (Homa should know Marcus logged it, disambiguation matters for trust).
- ❓ v1 scoping question: full second seat vs "household share link" (view + quick
  log). The cheap version may cover 90% of the need; see open questions.

### S2 — Grandma Sue (the co-teaching grandparent)

Who she is: P5's Tuesday/Thursday coverage; P2's occasional relief. Warm, willing,
possibly not tech-confident; large-print preference; her authority in the family
is real and her buy-in disproportionately shapes the family's comfort with "an AI
around the grandkids" `[A-M]`.

**What she needs from a shared account:**
- **The packet, not the product.** Today's plan + printed materials + simple
  instructions ON the printable itself (JS-F9). Ideally she never logs into
  anything: the artifact is self-contained `[A-M]`.
- If she does touch the product: a radically reduced surface: today's activities,
  a big "we did it" check, and voice-note logging ("Sue said he read the whole
  page himself"). Nothing else. No settings, no billing, no chat depth `[A-M]`.
- **Attribution again:** her observations feed the profile but should be marked as
  hers (a grandparent's "he read the whole page!" and a mother's carry different
  calibration weight, and moms will want to see who said what).
- Emotional note: done right, Grandma becomes an evangelist to her own generation
  ("you should see what my daughter-in-law uses"), a trust channel money can't buy.

### S3 — The skeptical co-op friend (buys nothing, influences everyone)

Who she is: veteran homeschooler, philosophy-confident, proudly analog or
AI-suspicious, high status in the co-op/groups. She will never convert, and doesn't
need to. Her influence outcomes are: hostile (posts warnings), neutral (says
nothing), or curious-positive ("it's not for me, but it's not what I feared")
`[A-M]` `[COUNCIL]` (one "check your statements" post kills the channel: the same
dynamic applies to one "it got our state law wrong" post).

**How she gets convinced or (realistically) neutralized:**
- **She is neutralized by respect and by artifacts, never by arguments.** The mom
  who brings a beautiful, personal, obviously-crafted worksheet to co-op ("Homa
  made this for Ella's horse phase") gives S3 nothing to attack: the artifact
  speaks, the mom's judgment stays central `[SIG-F]` (this is exactly the "I want
  one" moment, working through a skeptic instead of a friend).
- What arms her instead: overclaiming ("AI teacher!"), guilt-based marketing,
  referral spam that makes her friends into salespeople, a wrong legal claim, a
  privacy incident, or any child-facing AI feature (S4 rule violations are her
  strongest legitimate ammunition) `[COUNCIL]`.
- Product implication: shareable artifacts should carry quiet, dignified branding
  (a small mark, not a billboard), so the mom sharing never feels like an ad.
- Marketing implication: publish the hard commitments (child is never the user;
  no training on your family's data; export anytime) on a page skeptics can link.
  Give the fair-minded skeptic something accurate to cite and she becomes an
  accidental distributor of the trust story.

### S4 — The child (NEVER a user)

The hard rule (kickoff + council open call 4, assuming option (a)): the child never
uses Homa. The parent is the speaker, the uploader, the account. The assessment is
a test for the mother, never the child `[UR-A]`.

**What the rule means for features (checklist for every workstream):**
- **No child-facing surfaces.** No child login, no child chat mode, no "hand the
  phone to your kid" flows, no gamified kid UI, no child-directed rewards. The
  check-off celebration is for HER `[BRAND]`.
- **No child voice or likeness ingestion in v1.** Voice notes are the parent
  speaking; flows should not solicit recordings of the child, and picture-book
  characters are not generated from the child's photos `[COUNCIL]` (open call 4,
  option (a): keeps the COPPA parent-directed posture clean and avoids biometric
  statutes; if Sidney chooses (b), this bullet changes, marked ❓).
- **Assessment mechanics:** every benchmark input is phrased as a question to the
  mother about observed behavior ("does he count to 40? what books did he read?")
  `[UR-A]`. No feature may ever generate a quiz, test, or drill "for the child to
  complete on screen." Printables are the only child-touching artifact, and paper
  is the moat against scope creep here.
- **Data posture:** we collect data ABOUT children FROM a parent: the design must
  keep it that way (07 §2). Marketing must say it plainly, because it is also the
  answer to screen-time guilt (🔇 empathy map): Homa gives her MORE paper and
  more real-world outings, not more screen time for the kid. Copy example:
  "Homa is for you. The kids get paper, glue and the zoo."
- **Positive product consequence:** this constraint is a differentiator, not a
  limitation. Every ed-tech competitor points software at the child; Homa is the
  only one that structurally cannot become "more screen time." Sell the
  constraint.

---

## 6. ❓ Open questions for the founder (consolidated)

Ordered by how much downstream work each answer unblocks.

1. **Age-range ICP (restates council call #3, now with persona weight).** P2, the
   median and the volume segment, has a 10-year-old v1 cannot make materials for;
   P4's 9-year-old is at the same edge. Do we (a) own "early years (preK–2)"
   honestly at launch and design P2's journey around track-everything /
   materials-for-the-littles, or (b) pull a minimal 8–12 materials track forward?
   Workstreams 2–4 need this to write P2's onboarding and feature journeys.
2. **Religious-content stance.** A large share of the market (P2's segment)
   homeschools from faith conviction. Does Homa (a) stay worldview-neutral with
   parent-controlled content settings (recommended baseline: never surprise her),
   (b) offer opt-in faith-aware content packs, or (c) stay silent on it entirely?
   This decides onboarding questions, materials-generation guardrails, and which
   communities marketing can enter credibly.
3. **Shared-account scope for v1 (S1/S2).** Full second seat, or a lightweight
   "household share" (view + quick log + attribution)? The cheap version may serve
   Marcus and Grandma Sue at a fraction of the build; but attribution of
   observations to the right adult likely matters for profile trust either way.
   Workstream 4 (multi-child/multi-adult features) is blocked on this.
4. **Tracker import as a trust weapon (forces path B).** Do we commit to importing
   competitor exports (even roughly) for M-R/GA? It directly defuses the strongest
   switching habit (sunk data) for the P2/P4 tracker segment. Needs a scoping
   spike: which 2–3 formats cover most of the market?
5. **Newcomer (P3) monetization posture.** She's the highest word-of-mouth persona
   and the most financially fragile. Standard 14-day trial, extended "first
   season" runway, or a cheaper newcomer tier? Interacts with council call #2
   (visible credits vs flat plans).
6. **The "consult a professional" line for legal/state questions (P3/P4).** Where
   exactly does Homa stop answering? We need the drafted boundary language before
   cohort one includes any P3 or P4 (their trust breaks in opposite ways: P3 by
   vagueness, P4 by error).
7. **Validation-interview plan.** This whole document rests on one real interview
   `[UR-A]`. Before GA copy is written from it: can we run 5 × 30-minute
   interviews per persona (25 total), prioritized P2 first (business-critical
   price hypothesis), P4 second (sharpest failure mode)? The top-3 validation
   questions under each persona are the scripts' seeds.
8. **Origin-user quote release.** Which `[UR-A]` verbatims may marketing use
   publicly, and does the origin user want the "Alessa" veil maintained in all
   public materials? (The before/after artifact from her instance is the single
   best conversion asset we own, if she consents.)
9. **Child voice/likeness (restates council call #4).** This doc assumes option
   (a) (parent is speaker/uploader, no child-likeness uploads) everywhere,
   including S4's hard rule and the forces defusal plans. A choice of (b) reopens
   S4, the privacy story, and the screen-time-guilt positioning.

---

*End of workstream 1. Cited by: 02-acquisition-activation (personas, forces
defusal, JS-F/E/S numbering), 03-retention-monetization (JS-E2 renewal engine,
empathy takeaways), 04-feature-journeys (JS clusters → features, S4 checklist),
05-edge-cases-failures (P4 churn trigger, S3 arming events, F-A1 trust surface).*
