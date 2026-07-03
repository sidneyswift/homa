# 08 — Competitive Teardown, Parity Map & Moat Strategy (2026-07-02)

> Workstream 8 of the journey library (00-pm-kickoff.md). Methods: netmba four-component
> competitor analysis, parity-vs-differentiation, moats, Seven Powers. All competitor
> facts re-verified via web research on 2026-07-02; sources tagged [S#] in the Evidence
> Pack (§7). Personas cited by code (P1–P5, S1–S4). Milestone tags: [M-R] / [GA] / [POST-GA].

## ⚠️ Corrections to the planning docs (read before the tables)

Web verification found the competitor picture in `00-product-brief.md` ("hours tracking
and AI sprinkles at $5–15/mo") is **stale in two ways that matter**:

1. **Homeschool Fox is not "AI sprinkles."** It ships a named AI assistant ("Kit") with
   voice-and-chat activity logging, AI lesson suggestions, an AI-actions credit system
   (500/mo + purchasable packs), and 50-state compliance — at $12/mo family-flat [S1][S2].
   The council's 18-month threat "Homeschool Fox adds an LLM layer" (09 §threats) has
   **partially already happened**. What they still lack: a developmental profile, material
   generation, and any efficacy loop. Their AI writes the log; it doesn't know the child.
2. **ArborSlate charges $29/mo ($249/yr)** — not $5–15 [S3]. This is *good* news
   (a records-only product is already sustaining Homa's entry price point, validating
   willingness-to-pay) and *bad* news (they own the compliance-depth position: statute-
   checked rules with "last reviewed May 2026" dates, full AZ/PA/NY template generators,
   ESA tracking, co-op licensing).

Also new since the docs were written: a visible "AI homeschool" category is forming
below and beside us — AdaptiPath ($9.99–29.99/mo, K-6 AI lesson generation) [S8],
HomeschoolPlanner.com (AI worksheet generator on every plan, $5–17/mo) [S4],
Homeschool Managed (beta, "Clara" AI brain-dump, neurodivergent-support angle) [S8],
TheHomeschoolingCompany ($49/mo "AI-powered personalized tutoring", child-facing) [S9].
None has our shape, but the *category noise* means Homa's marketing can't win on
"AI homeschool assistant" as a phrase — it must win on the efficacy loop as a claim.
(Feeds workstream 07 positioning.)

---

## 1. Competitor teardown table

Threat rating: how likely this player takes or blocks Homa's customer (P1–P5), now →
in 18 months. Ratings assume Homa executes the M-R → GA plan.

| # | Player | Segment & price | Core loop | What they do well | Where they're weak vs Homa's value stack | Likely response if Homa succeeds | Threat now → 18mo |
|---|---|---|---|---|---|---|---|
| 1 | **The mom's current stack** (paper planner + Facebook groups + Pinterest + ChatGPT Free/Go) | Everyone; ~$0–8/mo [S7] | She plans on paper, asks the group, saves ideas she never uses, pastes context into ChatGPT and re-types it every session | Free, socially trusted, zero learning curve, the FB group answers state-law questions with local knowledge, ChatGPT makes a decent worksheet on demand | Nothing compounds: no record, no hours log she can hand an evaluator, no benchmarks, re-explains her kids to ChatGPT constantly, group advice is anecdotal and guilt-inducing (P3's anxiety loop lives here) | None — which is the problem; it never dies. It's the switch-back destination after every churn | **High → High**. The real competitor for every persona; beat it with time-to-wow + the record's accumulation |
| 2 | **Homeschool Fox** | Records/compliance trackers; $12/mo or $99/yr family-flat [S1] | Log activities (voice/AI chat via "Kit") → hours/attendance auto-tracked vs state reqs → PDF reports & transcripts | Best-in-class logging UX, 50-state + DC data, AI credits system already live, family-flat pricing, founder-couple authenticity, aggressive content/SEO (vs-pages, curriculum directory) [S2] | Activity-log data model, not child-development model: no profile, no benchmarks, no generation, no efficacy claim. Kit records what happened; it can't say what to do next or prove anything worked | Adds AI lesson *suggestions* → plans (already flagged on features page); could bolt on a worksheet generator in a quarter. A child profile + benchmarks pipeline is a re-architecture + repricing of a $99/yr base — much slower | **Medium → High**. The most capable direct player; watch them closest (§4 scenario B) |
| 3 | **ArborSlate** | Compliance-heavy records (P4's product); $29/mo, $249/yr; co-op $19.99/student/mo [S3] | Enter records → statute-checked compliance dashboard → auto-generated affidavits/IHIPs/quarterly reports (AZ/PA/NY) → ESA expense tracking | Legal depth and trust signals (statute links, last-reviewed dates — the pattern 07-research told us to copy), owns the P4/Monica segment, proves $29/mo WTP, co-op distribution motion | No AI, no generation, no profile, no discovery layer; records are the *whole* product so it's a filing cabinet with great labels — the "expensive tracker" Homa is accused of collapsing into, priced identically | Deepen state templates + ESA integrations; could add an LLM chat skin fast, but generation/efficacy is outside their DNA and margin model | **Medium → Medium-High**. Direct price-point collision for P4; Homa must match their trust signals or concede compliance-heavy states |
| 4 | **HomeschoolPlanner.com** | AI-flavored planner; $5–17/mo billed annually; family plan $10/mo for 5 students [S4] | Enter subjects/constraints → AI builds & re-balances schedule → daily checklists → gradebook/attendance/transcripts + 15–100 AI worksheets/mo | Cheapest credible "AI planner + worksheets" bundle; student app; proves worksheet generation is table stakes, not a wow | Worksheets are generic-by-grade, not profile-targeted; no assessment, no benchmarks, no attribution; margin at $10/mo can't fund per-family agent loops (our COGS math, 07 §4) | Raise worksheet quotas, add "adaptive" marketing language. Can't fund a real per-family agent without 3–5x repricing | **Medium → Medium**. Main damage is anchoring: "AI worksheets for $10" makes Homa's $29–49 need the efficacy story to be *visible* |
| 5 | **Homeschool Moment** | Photo-first documentation; $12/mo or $99/yr, freemium 5 entries/mo [S5] | Snap photo → GPT-4o writes educational caption + subject tag → timeline → PDF portfolio | 10-second capture beats everyone's friction (native iOS/Android, streaks, household sharing); closest UX cousin to our ambient capture | Capture terminates in a scrapbook: no hours math vs state reqs, no profile, no plan, no loop. Documentation without consequence | Add hours tracking (easy) and portfolio→report generation. Their capture + Fox's compliance = a real threat, but that's an acquisition/merger story | **Low-Med → Medium**. Validates voice/photo capture demand; also the cheap substitute for P2's "just prove we did school" job |
| 6 | **Homeschool Planet** | Legacy planner; $9.95/mo, $84.95/yr + paid lesson-plan marketplace ($5.95–14.95/plan) [S6] | Plan lessons on calendar → check off → reschedule; buy curriculum-specific plans | Deep curriculum-publisher plan library, co-op/microschool licenses, long-tenured trust, 30-day no-card trial | No AI at all; desktop-era UX; per-plan upsells feel dated; nothing about the child | Bolt-on AI scheduling assistant (their parent co. has the plan library to feed it). Slow mover historically | **Low → Low-Med**. Losing relevance; its marketplace idea matters for our curriculum-compare feature (M3-13) |
| 7 | **ChatGPT / Claude consumer** (deliberate use, not stack filler) | Horizontal AI; Free w/ ads, Go $8, Plus $20/mo [S7] | Mom maintains a "homeschool" project/thread; memory recalls kids' names & levels; generates plans, worksheets, report drafts on demand | Best raw generation quality anywhere; memory now spans conversations; $8–20 price umbrella over us; she already trusts it for everything else in her life | Memory is unstructured, non-auditable, non-exportable as legal records; no hours ledger, no statute-cited state reports, no benchmarks library, no confidence decay, no attribution, ads on Free/Go [S7]; a chat log is not a portfolio an evaluator accepts (P4 churn risk if she tries) | See §4 scenario A — the dangerous version is a product move (family profiles + printable artifacts + tasks), not organic usage | **High → High**. The ceiling on our chat quality AND our pricing narrative; counter-positioning analysis in §3 |
| 8 | **Khanmigo / Khan Academy** | Child-facing AI tutor; $4/mo or $44/yr parent plan covering up to 10 kids [S10] | Child works in Khan content → Khanmigo tutors Socratically → parent dashboard monitors | Nonprofit trust halo, absurd price, safety-first design rating (Common Sense), covers our out-of-range kids (P2's 10-year-old!) | Child-facing = our deliberate non-goal (S4 constraint: the child is never the user); no records, no compliance, no mom-side workflow; grades 3+ content center of gravity | None toward us — different user. Risk is only narrative confusion ("AI homeschool = child tutor") | **Low → Low**. Complement, not competitor. Recommend: position alongside, never against (P2 multi-age story) |
| 9 | **IXL** | Child-facing practice; $9.95–19.95/mo, +$4/mo per extra child [S11] | Child drills skills → analytics dashboard → "smart score" | Massive skill taxonomy K-12, diagnostic reports moms treat as benchmarks | Drill-and-kill reputation; the *child* is tested (Homa's category-defining inversion: the assessment is a test for the mother); no records/compliance; per-child pricing punishes P2 | None toward us; their diagnostic could be marketed as "know where your child stands" — watch messaging collision | **Low → Low-Med**. Their analytics language overlaps our benchmarks claim; differentiate on "no testing the child" |
| 10 | **Outschool** | Live-class marketplace; pay-per-class or credit plans $40–600/mo [S12] | Browse classes → book with credits → child attends live | Supply breadth, social proof, the "enrichment" budget line (P1/Alessa's category) | It's a marketplace, not an assistant; no records, no continuity; expensive per-hour | Could add an AI "class recommender" off their taxonomy — which is our connector-layer discovery job done shallowly | **Low → Low-Med**. Budget-share competitor for P1; also a *connector-layer partner target* (M3-12 discovery could deep-link classes) |
| 11 | **Curriculum publishers** (Abeka, BJU Press, The Good and the Beautiful) | Content incumbents; Abeka/BJU $500–1,800/grade/yr with video; TGTB free-to-cheap PDFs [S13] | Buy the year's box/videos → follow the teacher manual → their scope-and-sequence is the plan | Multi-decade trust in Christian homeschool core; BJU "Homeschool Hub" is a real digital planning platform; TGTB's free K-8 language arts/math removes the content-cost argument entirely; accreditation paths | No AI shipped as of research date [S13]; single-curriculum lock-in is their business model — they structurally can't be a neutral connector or serve curriculum-switchers; no cross-curriculum records | The giant-bundles-AI-free scenario (§4 scenario C): an Abeka/TGTB "AI planner for our curriculum" bundled free would commoditize planning *within* their walls | **Low → Medium**. Slow, but distribution is enormous and TGTB's price ideology ("free is the mission") is the scary version |
| 12 | **ESA platforms / ClassWallet** (state programs, e.g. AL CHOOSE: $2,000/homeschool student, $4,000 family cap, all spend through ClassWallet, no reimbursement [S14]) | State-funded wallet infra, expanding fast (AL universal by 2027-28) | State funds wallet → parent buys only via approved ESPs/marketplace → compliance documentation demanded | Owns the money pipe; makes homeschool cheaper (grows our market); their paperwork burden is *our demand driver*; HomeStudyPath already ships "ClassWallet-ready ESA scaffolding" [S8] | Not a competitor — a channel and a compliance-burden generator. Risk: marketplace gatekeeping (if moms only buy through ClassWallet, Homa must be an approved ESP or be invisible to ESA families) | If a records app gets blessed/integrated by ESA administrators, it becomes the default for funded families | **N/A as threat; High as channel**. NEW-TICKET flag: evaluate ESP application per active ESA state [POST-GA, paperwork starts earlier] |
| 13 | **HomeStudyPath** | Homeschool LMS; $20/student/yr or $75/yr family (4+) [S8] | Schedule curriculum resources → track progress/expenses → ESA/ClassWallet reporting | Dirt-cheap annual-only pricing, expense/ESA module nobody else has, community curriculum library, Smart Paste resource intake | Explicitly an LMS (our non-goal); no AI, no profile, no generation; "$75/yr" is the anti-anchor for our price | Deepen ESA tooling state-by-state — could own the "ESA families" niche before we get there | **Low → Low-Med**. Main lesson: ESA tooling is being claimed *now* |

### netmba four-component profiles (the three that matter most)

**Homeschool Fox** — *Objectives*: grow a bootstrapped family-flat subscription base;
own "homeschool tracking" SEO (their vs-pages target Notion, Sheets, "other apps") [S2].
*Current strategy*: freemium-ish trial → $12/mo; AI as retention/UX lever priced via
credit packs; content moat (state guides, curriculum directory). *Assumptions* (inferred):
moms won't pay >$15/mo for tracking; AI's job is to reduce logging friction, not to teach;
compliance data is the durable value. *Capabilities*: strong product velocity (docs show
recent AI features), thin team (founder couple), no evident capital for a research
pipeline or per-family agent COGS. **Implication**: they will copy any Homa feature that
looks like *logging UX* within months; they cannot copy the profile→generate→attribute
loop without abandoning their price point. Confidence: Medium (public-site evidence only).

**ArborSlate** — *Objectives*: own compliance-heavy states and co-ops; expand template
coverage on demand. *Current strategy*: premium single-product records play at $29/mo;
trust-signal marketing (statute citations, last-reviewed dates, "honest caveats" copy —
notice their pricing page explicitly anchors against à-la-carte tool stacks and even
prices AI tutors into the comparison [S3]). *Assumptions*: records ARE the job (true for
P4, false for P1/P5); legal accuracy is the brand. *Capabilities*: solo-founder homeschool
mom; deep domain knowledge; no AI infrastructure. **Implication**: in P4-heavy states we
fight them head-on at the same price with less compliance depth [M-R gap — see §2 parity
row 2]; everywhere else they validate our price. Their co-op licensing motion is worth
copying post-GA (M5-08 co-op finder adjacency). Confidence: Medium-High.

**OpenAI (ChatGPT)** — *Objectives*: consumer subscription growth + ad monetization of
Free/Go [S7]; education is a stated vertical (Khan partnership history, study-mode
features). *Current strategy*: horizontal assistant with memory/projects/tasks; family
features so far limited to parental controls, not family *records*. *Assumptions*:
general-purpose memory beats vertical structure; sensitive-category liability (health,
kids) is managed by disclaimers and controls, not by product specialization.
*Capabilities*: unlimited, except focus. **Implication**: they win any generic-capability
race; they will not build statute-cited state reports, evaluator-ready portfolios, or a
citation-backed benchmarks library for a niche of a niche — and *cannot* market
longitudinal child-development tracking without stepping into a regulatory/PR minefield
their scale makes worse (COPPA amendments explicitly target AI training on child data,
07 §2). The stress-test of that claim is in §3 (counter-positioning). Confidence: Medium.

---

## 2. Parity vs differentiation map

### A. Table stakes — match or lose the evaluation (she compares us to Fox/ArborSlate in the first session)

| Feature | Who set the expectation | Our bar | Status vs backlog |
|---|---|---|---|
| Hours + attendance tracking, auto-summed vs state requirement | Fox, everyone | Must be *effortless* (byproduct of journal/voice capture, never a second logging task) | Covered: pulled forward per council (09 §strong-consensus 2) [M-R] |
| 50-state requirements display w/ trust signals (statute links, last-verified dates) | ArborSlate set the trust bar [S3] | Match the *signal pattern* exactly; seed from HomeschoolLeap + JHU (07 §3) | M3-05 [GA] — ⚠️ P4 (Monica) churns on one wrong legal claim; concierge-verify her states first [M-R] |
| PDF portfolio / year-end / evaluator reports | Fox, Moment, ArborSlate | Compile-from-log (product principle 5); concierge at first | Covered [M-R concierge → GA product] |
| Multi-child, family-flat pricing | Fox ("no per-student fees") is the loudest [S1] | Family-flat. Per-child pricing is a P2 (Rachel) disqualifier | Pricing model decision — flag to 08-billing: credits must never feel per-child |
| No-card free trial | Fox (14d), Planet (30d), HomeStudyPath (30d) — category convention | Match; council already killed card-required trial (09 V1) | Covered |
| Voice/photo quick capture | Fox Kit (voice), Moment (photo, 10 seconds) | Must beat 10 seconds or match it; ours must *route* (journal + hours + profile), theirs only logs | M2 capture tickets [M-R] |
| Transcripts / GPA | Fox ($29 upsell), HomeschoolPlanner | **Eventually** [POST-GA] — out-of-range for ages 2–7 ICP; don't build, do state the roadmap so P2 doesn't disqualify us for later years | Non-goal v1, roadmap-visible |
| Spouse/co-teacher shared access | Fox, Moment (household sharing) | S1 (Marcus) + S2 (Grandma Sue) journeys require it | Check backlog — NEW-TICKET flag if absent [GA] |
| Calendar view/sync | Fox (iCal), HomeschoolPlanner (Google) | Basic feed export is enough; we are not a planner UI | Low priority [GA] |

### B. Differentiators — protect with mechanics, not marketing

For each: who is ONE feature away, and what actually makes copying hard.

| Differentiator | Nearest copier & their distance | What makes copying hard (the honest version) |
|---|---|---|
| **Closed efficacy loop with attribution** ("Homa's activities raised his phonics numbers — before/after") — M3-11 ⛔ | HomeschoolPlanner has worksheets; Fox has logging. *Neither has assessment*, so both are two features away, not one | Copying requires the whole chain: benchmarks library + observational assessment + profile + targeted generation + honest measurement (confidence decay). Each piece is buildable; the *chain* is 6–12 months of correlated work that only pays off if you already believe in the loop. Also: an attribution claim published without the honesty mechanics is a lawsuit/backlash magnet — our quarantine pipeline and presentation law (09 §S1, 00 §reconciliation) are part of the moat |
| **Test-for-the-mother benchmarks** (citation-backed, observational, never tests the child) | IXL markets diagnostics (child-tested — opposite mechanic). Fox could *display* state standards easily | The 15-domain library with citations is ~replicable by a funded team in a quarter. What's hard: the assessment *posture* (conversational, parent-reported, confidence-decayed) is a product-philosophy choice competitors' existing users didn't sign up for, and it requires believing un-tested data can be trustworthy — which our decay mechanics make true and their gradebook cultures make heretical |
| **Ambient voice capture that feeds everything at once** (one voice note → journal + hours + profile evidence + report fodder) | Fox Kit is literally one feature away on capture — voice logging is live [S1] | The capture isn't the feature; the *routing destination* is. Kit's voice note becomes a log row. Ours becomes four artifacts because the profile schema exists to receive it. Copy requires the data model, which requires the re-architecture (teardown #2) |
| **Connector layer** (curriculum compare M3-13, local discovery M3-12, contextual field trips: "studying penguins → your zoo has them Saturday") | Nobody is close. Outschool recommends its own inventory; Planet's marketplace sells plans | Requires being curriculum-neutral (publishers can't), locally aware (trackers have no reason), and profile-aware (nobody else has the profile). Cheap for us (Mac Mini prototyped it), structurally awkward for everyone else. Weakness to admit: also the easiest for ChatGPT to do shallowly |
| **Brand: quiet warmth / anti-guilt in an anxious category** (metrics lead, never "behind" framing) | Anyone can write warm copy. Fox's tone is already friendly | The barrier is *mechanical consistency*: presentation law (strengths-first, max one nudge, no deficit language) enforced across every generated artifact, forever. Incumbents whose engagement mechanics are streaks/goal-gaps (Moment's streaks, Fox's "falling behind" alerts [S2]) would have to *remove* working retention features to match our posture. That's counter-positioning, not copy protection |
| **The accumulating family record** (hours + journal + portfolio + what-works + profile, exportable) | ArborSlate has the records *shape* without the intelligence; Fox has the log without the structure | Time. A record can't be backfilled. Every month a family stays, the switching cost compounds (see §3). The copyable part is the schema; the uncopyable part is her two years of data in it |

### C. Deliberate non-goals — say no loudly (and what we say instead)

| Non-goal | Who owns it | Our line |
|---|---|---|
| LMS / curriculum scheduling & progress-through-materials | HomeStudyPath, HomeschoolPlanner | "Homa doesn't manage your curriculum; it knows your child. Keep your planner if you love it." |
| Child-facing tutoring/chat | Khanmigo ($4/mo!), TheHomeschoolingCompany | Design + legal constraint (S4; COPPA posture, 07 §2). "The child is never the user — Homa talks to you." Pairs *with* Khanmigo rather than fighting a nonprofit at $4 |
| Gradebooks / weighted GPA / high-school transcripts (v1) | Fox, HomeschoolPlanner | Out-of-ICP for ages 2–7; roadmap-visible for trust with P2 |
| Curriculum content publishing | TGTB (free!), Abeka/BJU | Never compete with free content ideology; we're the neutral layer that compares and connects them (M3-13) |
| Lesson-plan marketplace | Homeschool Planet | Generation replaces purchasing; revisit only if publishers partner [POST-GA] |

---

## 3. Moat analysis — Seven Powers mapping

Stage: **Origination** (pre-revenue). Helmer's phase-fit rule says the powers available
to us *now* are Counter-Positioning and Cornered Resource; Switching Costs and Network
Economies are Takeoff powers we architect for now and collect later; Brand and Process
Power are Stability powers we can only seed. Rating each claimed power: benefit + barrier
(no barrier ⇒ not a power), what must be TRUE, when it turns on, what kills it.

| Power | Status | Benefit → Barrier | What must be TRUE | Turns on | What kills it |
|---|---|---|---|---|---|
| **Counter-positioning vs trackers** | **Present** (strongest current power) | Benefit: agent-first product justifies $29–49 vs their $9–12. Barrier: Fox/ArborSlate matching us requires per-family LLM COGS (~$3–10/family/mo, 07 §4) their $99/yr price can't carry — they'd have to reprice their entire base or run two products; and their simplicity *is* their brand promise | Our COGS discipline holds (≥70% margin law); the efficacy loop demonstrably retains better than logging does | Now | A tracker successfully running a two-tier "classic + AI premium" split without base churn; or LLM costs falling so far that $12/mo carries a real agent loop (watch model pricing — this is eroding on a ~yearly clock) |
| **Counter-positioning vs ChatGPT** | **Present but narrower than the brief claims** | Benefit: purpose-built records/compliance vs generic chat. Barrier — stress-tested: the "trust/legal reasons" claim in the prompt is **half right**. Wrong half: ChatGPT *can* hold longitudinal child info (memory spans conversations, Plus expands it [S7]) and moms already use it that way. Right half: OpenAI can't *productize* child development records — marketing "we track your child's development over years" invites COPPA-amendment scrutiny (AI-training consent, retention rules, 07 §2) at a scale where the niche revenue can't justify the liability; ads on Free/Go poison "trusted child record" positioning [S7]; and a chat log is not an evaluator-ready artifact — no statute-cited reports, no auditability, no export schema, no confidence decay. The real barrier is *product-shape economics* (a $500B company won't build IHIP generators), reinforced by legal posture — not blocked by it | We make the record *legally load-bearing* (evaluator-accepted reports, retention policy, export) so the comparison is "filing cabinet with a lawyer" vs "chatty notebook"; we keep chat quality within striking distance via frontier APIs | Now, but decays at the edges every OpenAI release | OpenAI shipping family accounts with structured, exportable child profiles + printable artifacts (§4 scenario A). Watch signals listed there |
| **Switching costs (the records pile + compliance continuity)** | **Emerging — the flagship moat, by design** (09 §what-council-didn't-change: "the durable asset is the accumulating family record") | Benefit: renewal without discounting; price power. Barrier: hours logs, journal, portfolio evidence, what-works, and the profile accumulate; mid-year switching risks compliance continuity (P4 literally cannot lose her quarterly-report history); the *applied* value (generation tuned by two years of what-works) doesn't survive export even when the data does | The record must be **load-bearing within 90 days** — used for a real state report, a real evaluator meeting, or a real before/after — not just accumulating. Data that's merely stored is apathy, not lock-in (Helmer's false positive) | Month 3–6 per family; portfolio-season (spring) is the first hard test | (a) We ship export-friendly records and a competitor ships *import* + instant re-profiling from the export — mitigate by making the moat the loop, not the file; (b) family churns before the record proves itself → this is why time-to-first-load-bearing-artifact belongs on the 06 metrics tree (NEW-TICKET flag: instrument `record.first_load_bearing_use`) |
| **Process power (domain system: benchmarks pipeline, scoring loops, quarantine)** | **Emerging, honestly weak vs funded copycat** | Benefit: citation-backed benchmarks + weekly scoring + safety pipeline produce trustworthy claims competitors' bolt-on AI can't make. Barrier: it's know-how + accumulated craft (21 skills, presentation law, confidence decay), observable in output but not in mechanism | The pipeline stays *better than* what a good team copies in 2 quarters — meaning it must keep compounding (per-family what-works corpus feeding generation quality) rather than being a static library | 12–18 months of operating history | A funded ed-tech team hiring 2 child-development PhDs and rebuilding the library in a quarter. The defense is pairing it with switching costs — their library minus our two years of *her* data is a brochure |
| **Cornered resource** | **Mostly absent — don't claim it** | Candidates examined: benchmarks (public sources — not cornered); Alessa + the running Mac Mini instance (genuine but small: proof-of-efficacy artifacts and design-partner truth nobody else has); Sidney's ops knowledge (key-person risk, not a moat); conference/waitlist list (ordinary). No exclusive contract, dataset, or right exists | — | — | — . One real candidate to *build*: exclusive or first-mover data partnerships (e.g., HomeschoolLeap API relationship, ESA-platform ESP status) could become mildly cornered [POST-GA] |
| **Network economies (moms network, M5-09)** | **Absent — post-traction only, correctly sequenced** | Benefit if real: local mom-matching + co-op discovery makes each metro more valuable as density grows — the one thing no tracker or ChatGPT can copy. Barrier: density itself | Single-player value must stand alone first (Helmer cold-start warning); then seed *atomic networks* metro-by-metro (conference cities first), not nationally | Post-GA, realistically 18–36 months | Building it early and hosting a ghost town; or Facebook Groups (the incumbent network, free, dense) absorbing the job — our version must be *profile-aware matching* ("a mom 2 miles away, kids same ages, same curriculum"), not another forum |
| **Brand (quiet warmth in an anxious category)** | **Emerging — cheap for us, expensive for them** | Benefit: WTP premium + word-of-mouth in a trust-gated community (one FB-group endorsement > any ad); P3 (Danielle) converts on "you're allowed" energy. Barrier: consistency mechanics (presentation law enforced in every artifact) + the founder-family origin story, neither purchasable | Zero "AI said something weird about my kid" incidents in the first cohorts (concierge review, 09 V3, is the control); metrics always validating, never shaming | Seeds now; compounds 12+ months; real brand power is years out | One viral safety incident (the security review's refuse-to-launch items exist for this reason); or guilt-mechanic creep in our own growth features (streaks, "behind" nudges) — the brand dies by our hand before a competitor's |
| **Scale economies** | **Absent, one small seed** | Shared global research corpus (architecture: research once, serve all families) means our per-family COGS falls with scale while per-family-agent copycats' stays flat | Meaningful only past ~1,000 families | [POST-GA] | Not load-bearing; don't invest for it |

**Verdict (Helmer-style, ≤120 words):** Homa has one real power today — counter-positioning,
in two directions (trackers can't afford the loop; OpenAI won't build the niche's legal
artifacts) — and one moat under deliberate construction: switching costs via the
accumulating family record, which turns on per-family around month 3–6 *only if* the
record becomes load-bearing that fast. Process power and brand are seeded by the domain
system and presentation law but need 12+ months of operating history. Network economies
are correctly deferred. Cornered resource is the weakest claim in the deck and should be
dropped from any pitch. The strategy is coherent: use counter-positioning's window
(~18 months) to accumulate records nobody can backfill.

---

## 4. The 18-month threat model

Three scenarios, ranked by expected damage × plausibility. Each with early-warning
signals (leading, checkable) and pre-planned responses (decided now, so we don't panic then).

### Scenario A — OpenAI ships family memory + cheap printable learning artifacts
*The move:* family accounts with structured per-child profiles; Tasks + Agent Mode
produce weekly printable packets; $8/mo Go price point. Instantly the P1/P5 pitch
("it makes the plan so I don't have to") is available inside the app she already pays for.
- **Plausibility:** Medium. Education is a stated OpenAI vertical; parental controls
  already exist; ads strategy [S7] cuts against child-data positioning but Plus is ad-free.
- **Damage if it lands:** High for acquisition (top-of-funnel evaporates), Low for
  installed families (records don't migrate to a chat product).
- **Early warnings:** OpenAI "family plan"/family-account announcements; child-profile or
  education-mode features in release notes; a printables/worksheets partnership; Khanmigo-style
  consumer education product from OpenAI directly; homeschool-mom TikTok/FB tutorials
  showing a ChatGPT family workflow going viral.
- **Pre-planned response:** (1) reposition hard on what a chat product structurally isn't:
  evaluator-ready, statute-cited, auditable, exportable records — "your homeschool's legal
  memory doesn't belong in a chat log"; (2) accelerate compliance depth (ArborSlate-grade
  templates) to widen the artifact gap; (3) ship the efficacy attribution view (M3-11) as
  the demo-able thing ChatGPT can't fake without our measurement chain; (4) use frontier
  APIs so raw generation quality never lags by more than a model generation. **Do not**
  compete on chat quality or price.

### Scenario B — Homeschool Fox (or a funded equivalent) adds a child profile + generation loop
*The move:* Fox already has Kit, voice capture, AI credits, and 50-state data [S1][S2].
The dangerous sequence: AI lesson suggestions (live) → generated worksheets → per-child
"learning profile" → a "progress vs standards" view. At $12/mo with their SEO machine,
they'd be "80% of Homa at 40% of the price." AdaptiPath/TheHomeschoolingCompany raising
capital is the same scenario wearing a different logo.
- **Plausibility:** High for shallow versions (worksheet generator: months); Low-Medium
  for the full loop (assessment + benchmarks + attribution = re-architecture + repricing).
- **Damage:** Medium-High — hits P2 (price-sensitive median) hardest, exactly the
  persona where our v1 age-range is already weakest (09 §call-3).
- **Early warnings:** Fox changelog/blog mentions of "lesson plans," "child profile,"
  "standards," or "assessment"; a price tier above $12; hiring posts (they're a couple —
  any hire is a signal); AI-credit price changes (COGS pressure = deeper AI usage);
  AdaptiPath expanding past K-6 or raising a priced round.
- **Pre-planned response:** (1) the counter is *attribution depth*, not feature count —
  publish before/after efficacy artifacts (cohort-one concierge notes are already
  designed to produce these, 09 §9) that a logging company can't manufacture;
  (2) own the assessment inversion in messaging ("they show you a dashboard of what you
  typed in; Homa knows things about your child you didn't type in"); (3) if they ship
  "progress vs standards" without observational assessment mechanics, attack the accuracy
  honestly (their data is self-reported activity logs with no decay); (4) hold price —
  a panic cut concedes the premium story and breaks the margin law.

### Scenario C — A curriculum giant (or TGTB) bundles AI planning free
*The move:* TGTB — whose stated ideology is "free is the mission" [S13] — ships a free
AI planner/assistant for its own curriculum; or Abeka/BJU bundle an AI assistant into
their $500–1,800/yr packages. Planning gets commoditized inside the largest distribution
channels in the category.
- **Plausibility:** Low-Medium in 18 months (publishers are slow; no AI signals found in
  research [S13]), but highest *distribution* leverage if it happens.
- **Damage:** Medium — gated to their curriculum ecosystems; single-curriculum families
  (a large share of P2/P4's world) stop shopping for an assistant.
- **Early warnings:** publisher AI/product hires; BJU Homeschool Hub feature expansion;
  TGTB app releases beyond content delivery; conference booth demos of publisher AI.
- **Pre-planned response:** (1) neutrality is the counter — publishers structurally
  cannot compare curricula or serve switchers, and curriculum-switching is *normal*
  (mid-year switches are a top FB-group topic); Homa's record survives the switch,
  the publisher's assistant dies with the subscription; (2) M3-13 (curriculum compare)
  becomes more strategic in this world — prioritize it the moment a warning fires;
  (3) explore embedding *their* scope-and-sequence as first-class importable structures
  (partner posture, not war) — a publisher-AI that only knows its own catalog makes a
  neutral connector *more* valuable, not less.

**Standing early-warning routine [M-R, cheap]:** quarterly 30-minute sweep — Fox/ArborSlate
changelogs + pricing pages, OpenAI education announcements, publisher press, one ESA-state
policy check. Calendar it; the signals above are all public.

---

## 5. Strategic crux

**The one thing Homa must get right that competitors can't easily replicate: the trusted
longitudinal child record with efficacy attribution — "here is where he was, here is what
we did, here is where he is now" — delivered in a voice that makes an anxious mother feel
validated rather than judged.**

The argument, explicitly:

1. **Everything else on our feature list has a named copier within one to four quarters.**
   Worksheet generation: HomeschoolPlanner ships it today at $10/mo [S4]. Voice capture:
   Fox ships it today [S1]. Compliance depth: ArborSlate ships it today at our price [S3].
   AI chat about your homeschool: Kit, today. Local discovery: shallow-copyable by
   ChatGPT tomorrow. Any strategy resting on those is a strategy resting on a head start
   measured in months.
2. **The record + attribution chain is the only asset with a time axis.** A competitor
   can copy the schema in a sprint; they cannot copy eighteen months of one family's
   observations, confidence-decayed scores, and what-works history, because that data is
   *created by the family's life*, not by engineering. It is the only component whose
   replication cost grows every week we operate (switching costs, §3) — and the
   attribution claim is the only marketing claim that *requires* the record to make
   honestly (process power, §3). They interlock: the loop makes the record load-bearing;
   the load-bearing record makes the loop credible.
3. **The brand is the permission slip, not a separate moat.** A longitudinal record of a
   child is creepy from an ads-funded chat company [S7], clinical from a testing company
   (IXL's mechanic), and guilt-fuel from a tracker with "falling behind" alerts [S2].
   It is only *wanted* from a product whose every artifact says "you're doing enough, and
   here's the evidence" (00 §value-stack: metrics as validation; the assessment is a test
   for the mother). The anti-guilt posture is what makes families willing to feed the
   record for years — which is what makes the moat. Competitors face an ugly trade:
   their engagement mechanics (streaks, gap alerts, test scores) actively poison the
   trust required to collect this data class.
4. **Therefore the falsifiable success condition:** within 90 days of activation, every
   family has used the record for something that mattered (a state report, an evaluator
   artifact, or a before/after they screenshotted for a friend). If that number is low,
   Homa is an expensive tracker with good vibes — the product reviewer's attack (09 §9)
   made true — and no moat claim in this document survives. That metric belongs at the
   top of workstream 06's tree, next to retention.

---

## 6. ❓ Strategy questions for the founder

1. ❓ **ArborSlate collision:** we launch at $29 with *less* compliance depth than the
   incumbent at $29. For P4-heavy states (NY/PA), do we (a) concede compliance-heavy
   states until M3-05 template depth exists, (b) concierge-match ArborSlate's templates
   for early P4 families by hand, or (c) price M-R lower and step up at GA? (b) is
   recommended — P4 is the highest-evangelism persona per kickoff, and hand-built IHIPs
   for 5 families is cheap.
2. ❓ **Fox watch tripwire:** if Homeschool Fox ships a per-child profile or a
   "progress vs standards" view before our GA, does that change GA timing or messaging?
   Pre-decide the tripwire response now (recommendation in §4B: hold price, lead with
   attribution artifacts) so it's not decided under panic.
3. ❓ **ESA channel:** ESA spend must flow through approved-provider platforms
   (ClassWallet et al. [S14]) and programs are expanding toward universality. Becoming an
   approved ESP is paperwork + lead time per state. Do we start applications in the first
   2–3 ESA states during GA prep, or defer to post-GA? (This also affects pricing: an
   ESA-payable subscription is effectively free to the family.)
4. ❓ **Khanmigo posture:** do we explicitly market "pairs with Khanmigo/Khan for the
   kids' screen time; Homa is for you" — embracing the child-facing non-goal as a
   partnership story — or stay silent to avoid legitimizing an adjacent AI in her budget?
5. ❓ **Export/import asymmetry:** council locked self-serve export (M4-05, correctly, for
   COPPA/retention). A competitor could build "import your Homa export, get an instant
   profile." Do we accept that risk as the cost of ethical data posture (recommended —
   the moat is the loop + trust, not the file), or watermark/structure exports to be
   human-readable but not machine-trivial?
6. ❓ **Category naming:** research shows an "AI homeschool planner/assistant" noise floor
   forming (AdaptiPath, Homeschool Managed, HomeschoolPlanner). Does workstream 07 name a
   *new* category (e.g., around the efficacy loop / "homeschool record that proves it's
   working") rather than competing for "AI homeschool assistant"? My recommendation: yes —
   flag to 07-positioning as a cross-workstream dependency.
7. ❓ **Brief correction sign-off:** update 00-product-brief's competitor paragraph
   ("AI sprinkles at $5–15/mo") with §0's findings? It currently understates Fox and
   misprices ArborSlate, and anyone pitched from the brief will be corrected by a
   30-second Google.

---

## 7. Evidence pack

All checked 2026-07-02. Facts vs inference separated: table cells describing features/
prices are sourced facts; "likely response" columns and §4 scenarios are inference.

- [S1] homeschoolfox.com — homepage, /pricing, /docs/settings/subscription: $12/mo, $99/yr
  family-flat; Kit AI assistant; 500 AI actions/mo + credit packs (100/250/500); voice
  logging; 50 states + DC; transcripts w/ weighted GPA; $29/student official transcript;
  14-day no-card trial.
- [S2] homeschoolfox.com/features, /vs/notion, /try: AI lesson suggestions row; "falling
  behind" alerts; curriculum directory (54 programs); vs-pages SEO strategy; founder
  couple (Andy & Alyssa Leverenz).
- [S3] arborslate.com — $29/mo, $249/yr; co-op $19.99/student/mo (5-student min);
  statute-checked 50-state + DC data w/ "last reviewed May 2026"; full template
  generators AZ/PA/NY (affidavits, IHIPs, quarterly reports, evaluation portfolios);
  ESA tracking; solo homeschool-mom founder; pricing page anchors vs à-la-carte stack.
- [S4] homeschoolplanner.com + App Store/Play listings: Basic $5/mo ($60/yr, 1 student,
  15 AI worksheets/mo); Family $10/mo ($120/yr, 5 students, 40/mo); Pro $17/mo ($200/yr,
  10 students, 100/mo); AI scheduling + re-balance; gradebook/transcripts; student app;
  printed planner add-on $19.99+; 7-day trial.
- [S5] homeschoolmoment.com + App Store: $12/mo, $99/yr; free tier 5 entries/mo,
  1 child, watermarked PDFs; GPT-4o photo captioning + subject auto-tagging; native
  iOS/Android; household sharing; streaks.
- [S6] homeschoolplanet.com: $9.95/mo, $84.95/yr; 30-day no-card trial; lesson-plan
  marketplace $5.95–14.95/plan; co-op/microschool licenses.
- [S7] openai.com (ChatGPT Go announcement, pricing page) + 2026 pricing roundups:
  Free (ads, limited GPT-5.5 Instant, limited memory), Go $8/mo (ads, longer memory),
  Plus $20/mo (ad-free, advanced reasoning, projects/tasks, expanded memory), Pro $200/mo;
  ads testing on Free/Go in US began ~Feb 2026; memory references past conversations
  (rolled out to free tier 2024–25).
- [S8] homestudypath.com: $20/student/yr or $75/yr family (4+ kids); LMS positioning;
  expense/ESA module with "ClassWallet-ready" AZ ESA quarterly scaffolding; community
  curriculum library; Smart Paste; 30-day trial. Adjacent finds: adaptipath.com
  ($9.99/$19.99/$29.99/mo AI lesson generation, K-6); homeschoolmanaged.com (beta free,
  founding $9/mo — "Clara" AI brain-dump, ND-support per student); homeschoolledger.com
  ($6.99/mo, $59.99/yr).
- [S9] thehomeschoolingcompany.com/vs-abeka: $49/mo all grades, "AI-powered personalized
  tutoring" (child-facing), vs-page marketing against Abeka.
- [S10] khanmigo.ai (learners, parents) + Khan help center: $4/mo or $44/yr; parent plan
  activates up to 10 children; US-only; teacher tools free; district add-on ~$15/student/yr.
- [S11] ixl.com family pricing (via 2026 roundups): $9.95/$15.95/$19.95/mo ($79/$129/$159/yr);
  +$4/mo or $40/yr per additional child; Spanish add-on $40/yr.
- [S12] outschool.com/join-membership: pay-per-class or credit plans $40–$600/mo;
  credits $0.50 each; rollover; member library.
- [S13] 2026 curriculum reviews (homeschoolpicks.com, homeschoolcurriculum101.com) +
  goodandbeautiful.com: Abeka grade-1 w/ video $1,390–1,790; BJU $1,099; BJU "Homeschool
  Hub" digital planning platform; both accredited-path, video-instruction, no AI products
  found; TGTB free K-8 language arts/math PDFs, explicit low-price mission. (Inference
  flag: absence of AI announcements ≠ absence of internal projects.)
- [S14] revenue.alabama.gov (CHOOSE Act) + classwallet.com/alchoose + al.com: homeschool
  ESA $2,000/student, $4,000/family cap; all spend through ClassWallet, no reimbursement;
  ESP approval required (14-day decision); income cap 300% FPL for 2026-27, **universal
  eligibility 2027-28**; 2026-27 funds deposit from July 1, 2026.

### Unknowns & validation plan (netmba §9)

- Fox's actual AI usage/retention lift — unknowable from outside; proxy: watch whether
  AI-credit pricing/limits change (COGS pressure signal).
- Whether P4 families would accept a concierge-built IHIP from a new vendor over
  ArborSlate's automated one — testable in workstream 09's conference interviews.
- Real ChatGPT-for-homeschool penetration among our personas — add one question to the
  09 Mom-Test guide ("walk me through the last time you asked ChatGPT something about
  your homeschool") rather than guessing.
- TGTB/Abeka AI roadmaps — no public signal; quarterly sweep (§4) is the only monitor.

### Cross-workstream handoffs

- → 03-backlog: NEW-TICKET flags — `record.first_load_bearing_use` instrumentation (§3
  switching costs); spouse/co-teacher shared access check (§2A); ESA ESP application
  evaluation (§1 row 12).
- → 06-metrics: 90-day load-bearing-record metric as a North-Star-adjacent input (§5.4).
- → 07-positioning: category-naming question (§6.6); "pairs with Khanmigo" line (§6.4);
  anti-anchor handling for $10/mo AI-worksheet products (§1 row 4).
- → 09-discovery: ChatGPT-usage and ArborSlate-displacement interview questions (above).
