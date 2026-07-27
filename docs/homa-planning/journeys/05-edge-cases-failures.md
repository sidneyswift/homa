# 05: Edge Cases & Failure Journeys (Workstream 5)

> Historical journey and acceptance-source snapshot, written 2026-07-02. The
> reconciled PRD retains only scenarios adopted by current rulings or tickets
> as FR-10 acceptance inputs. Other prices, plan names, providers, age limits,
> session behavior, built-status labels, and unresolved questions are history.
> Current tier naming is Homa Plus; live Stripe state is unverified here.

> Trust & safety + UX resilience workstream. Methods: ux-edge-cases (the catalog),
> adversarial-roleplay (each trust journey was pressure-tested as "the angriest
> reasonable version of this mom"), edge-case-balance (the prioritization matrix and
> the deliberate choice NOT to build for some of these).
>
> Personas per 00-pm-kickoff.md (P1 Alessa, P2 Rachel, P3 Danielle, P4 Monica,
> P5 Jess; secondary S1 Marcus, S2 Grandma Sue, S3 skeptical co-op friend, S4 the
> child, never a user). Security controls cited as 09§S1–S9. Voice law: reassure
> first ("your work is safe"), then the fix; never "behind"; no em dashes in any
> in-product copy.
>
> One framing rule for this whole document: **for this audience, a trust failure is
> not a bug, it is a churn event with a megaphone.** The niche is organized in
> Facebook groups and co-ops; the same channel that makes word-of-mouth free makes
> one mishandled failure fleet-wide. Every expected behavior below is written to
> survive being screenshotted.

---

## 1. Scenario → Expected Behavior catalog

Row IDs are stable; the matrix in §3 and tickets in §5 reference them.
Tags: **[M-R]** must be right for the invite cohort · **[GA]** must be right before the public switch · **[MON]** acceptable with monitoring.

### 1a. AI quality failures (AQ)

| ID | Scenario | Expected behavior |
|---|---|---|
| AQ-01 | **Homa makes a wrong developmental claim** ("Leo is on track for counting to 100" when he can't count to 20). Mom knows her kid; Homa is confidently wrong. | One-tap "that's not right" on every claim surface (weekly note, dashboard, chat). Correction writes an observation, adjusts confidence down, and visibly thanks her: she is the authority, Homa is the assistant. Correction propagates to next plan generation same day. Never argue, never defend the old number. See journey J-A. [M-R] |
| AQ-02 | **Hallucinated milestone**: Homa cites a "benchmark" that exists in no source ("most 4-year-olds write their surname"). | Structural prevention: benchmarks come only from the quarantine pipeline (09§S1), typed fields, citation-must-resolve. Chat may never invent an uncited developmental norm; instructions require claims to ground in the benchmarks library or be framed as observation ("lots of kids his age are working on this"). If reported: fleet-wide check, one-action revert if the library is the source. [M-R] |
| AQ-03 | **Worksheet contains an error the kid notices** (answer key says 7+5=13). Small, but the product's whole promise is "materials you can trust." | Feedback thumb on every artifact + "report a mistake" that takes a photo. Response acknowledges the kid ("good catch, Maya!"), regenerates corrected sheet within the hour, flags the generator template for review. Errors tracked per-template; >1% error rate on a template pulls it from rotation. [M-R] |
| AQ-04 | **Weekly note lands as judgment** ("Leo didn't practice letters this week") even though no deficit language was used, tone is in the reader. | Presentation law (00§value stack): strengths first, max one nudge, next-step always ships with material attached. M-R phase: every note is Sidney-reviewed before send (the concierge loop IS the guardrail). Post-GA: tone-lint on the note generator + "was this note helpful?" one-tap per note; two negatives pauses notes for that family and triggers review. [M-R] |
| AQ-05 | **Deficit language slips through** ("behind," "delayed," "below average" in any surface). | Hard content rule enforced in code (M1-17: no red "behind" states) AND in the note/chat lint deny-list. This is a zero-tolerance class: any occurrence is a P1 bug, not a tuning note. [M-R] |
| AQ-06 | **Worksheets repeatedly too hard or too easy**; the kid cries or is bored, mom concludes "it doesn't actually know my child." | Difficulty feedback loop (👍/👎 + "too hard/too easy" chips) wired to `what_works` (M2-05). Two consecutive "too hard" on a subdomain visibly steps down AND says so ("I'll ease up on tricky blends"). The visible adjustment is the trust repair. [GA] |
| AQ-07 | **Benchmark citation link is dead** when Monica (P4) clicks it. | Citation-must-resolve check at publish time (09§S1) makes this rare; serve-time fallback shows the cached source name + "we're refreshing this link" rather than a 404. [GA] |
| AQ-08 | **Wrong child's name in a note or worksheet** (Maya's note says Leo). Feels like a form letter; breaks the "knows each child" promise at the root. | Multi-child routing rules (M2-11) + generation-time assertion that child_id in context matches artifact header. Any occurrence: auto-apology + regeneration + logged as P1. Never send a weekly note that references a child not in the family (cross-tenant variant of this is a security incident, 09§S2). [M-R] |
| AQ-09 | **Efficacy overclaim**: "My sentence pyramids raised his phonics 12 points" when mom knows grandma drilled him all month. | M3-11 presentation law: progress framed as "with the work you did," never causal overclaim. Attribution view shows the activities log so she can see what's included. If she corrects it, the note adjusts. Overclaiming the selling point poisons the selling point. [GA] |
| AQ-10 | **Homa states a wrong legal/compliance fact in chat** (hallucinated homework: "Virginia requires 990 hours"). | Compliance answers must route through the `state_requirements` table (M3-05: statute-sourced, last-verified dates), never free-generated. If the table lacks the answer: say so + link the statute + offer to research, don't guess. A wrong legal claim is P4-Monica's instant-churn trigger and journey J-H. [M-R] |
| AQ-11 | **Generated image is off** (six fingers, misspelled word baked into art, uncanny face). Kid notices; screenshot potential high. | Pre-delivery image checks where cheap (text-render verification on words in art); regenerate-on-report is one tap; image feedback feeds model-choice rules (07§4: NB2 for character art). Never defend a bad image, just fix it. [GA] |
| AQ-12 | **Homa contradicts the dashboard** (chat says "working on letter sounds," dashboard shows that mastered). | Single source of truth (profile JSON, 00§principles); chat context loads live profile per session (M2-02). Contradictions are staleness bugs; the visible rule is "the dashboard is the record, and I'll say when I'm unsure." [GA] |
| AQ-13 | **Repeated near-identical worksheets** across days; feels like the personalization is fake. | Artifact history dedupe check at generation; variety rules in the make-skills; "want something different?" chip after any 👎. [MON] |
| AQ-14 | **Homa gives medical-adjacent developmental advice** ("that sounds like a speech delay, try these exercises"). | Hard boundary: Homa describes observations vs benchmarks and suggests *talking to the pediatrician* for anything clinical; never diagnoses, never treats. See IC-06 and journey J-J's cousin policy question ❓Q2. [M-R] |

### 1b. Input chaos (IC)

> Current-policy correction for adopted scenarios. Global D5 resolves the
> crisis posture as companion-not-therapist. Global D6 requires useful
> parent-provided health and diagnosis context behind a sensitive flag and
> stricter controls; MJ-13 owns the missing implementation. Current map coverage
> is ages 2 through 16. Provider, offline, session, and degradation behavior in
> this historical catalog is not proof of implementation or production.

| ID | Scenario | Expected behavior |
|---|---|---|
| IC-01 | **Toddler grabs the phone mid-voice-note**; 90 seconds of babble, screaming, a dropped phone. | Transcription confidence gate: low-confidence/gibberish segments are dropped, not "interpreted." Homa replies with warmth, not confusion ("sounds like someone small helped record that ☀️ I caught the part about the library trip, want to finish the thought?"). Never write gibberish-derived facts to the profile (M2-13 delta guards). [M-R] |
| IC-02 | **40-minute voice note** (Jess processes her whole week aloud while folding laundry). | Accept it, this is the killer interaction, not abuse. Chunked upload with resume (don't lose minute 39 to a network blip), cost is priced (2 cr/min), summary-first response ("here's everything I caught, tap anything I got wrong"), facts extracted turn-by-turn to Postgres (07§1: compaction will NOT preserve this). [M-R] |
| IC-03 | **Photo of the wrong page** (she photographs the fridge list instead of the workbook page). | Vision sanity check: "this doesn't look like a workbook page, want to retake it? (your photo is saved either way)". Never generate a lesson plan from a grocery list with a straight face. [GA] |
| IC-04 | **Blurry / dark / sideways photo.** | Auto-rotate + gentle retake prompt with the specific problem named ("a little dark to read, one more in better light?"). Keep the original; don't make her start over. [GA] |
| IC-05 | **Mom vents emotionally** ("today was awful, I screamed at them, I'm a terrible mother"). Not crisis-level; just a hard day. | Companion, not therapist and not coach: validate first, normalize ("hard days are part of this, they don't undo the good ones"), do NOT pivot to productivity ("want a worksheet?" is tone-deaf here). Offer a lighter tomorrow only if she engages. Nothing from a vent enters the child's profile without her confirmation. See journey J-B for the crisis-level version. [M-R] |
| IC-06 | **Mom mentions a child's health condition or diagnosis** ("Leo's OT said…", "since her ADHD diagnosis…"). | What Homa must NOT do: (1) never diagnose or contradict a professional, (2) never generate medical advice, (3) never surface the diagnosis in shareable artifacts (worksheets, reports) unless she explicitly asks, (4) never use it in deficit framing. What it does: acknowledge naturally, ask ONCE whether she'd like it remembered for tailoring ("want me to keep that in mind when I plan for Leo?"), store as parent-provided context flagged sensitive. Retention/handling is ❓Q3. [M-R] |
| IC-07 | **Mom pastes another family's kid info** (helping a co-op friend: "can you check where a 5yo should be on reading?"). | Answer generically from benchmarks; do NOT create shadow profiles of non-family children; if she tries to add the child, explain each family needs its own account (and hand her an invite [M-R]). [GA] |
| IC-08 | **Profanity / anger at Homa** ("this is useless, you stupid app"). | Absorb it gracefully; never lecture about language, never sulk. "Fair. Tell me what missed and I'll fix it." Log as CSAT signal. [MON] |
| IC-09 | **Voice note partly in another language** (Spanish-speaking household mid-code-switch). | Whisper handles it; respond in the language she wrote/spoke in for that thread; note multilingual support level honestly in docs. [MON] |
| IC-10 | **Mom uploads the child's photo** asking for a picture book starring Maya. | **SUPERSEDED by D4 (journeys/10 §5, decided 2026-07-03; grilling session 2026-07-04):** photo-personalized materials ship day one behind a dedicated consent screen (separate from signup: what's used, where it goes, no-training, delete anytime), with raw-photo TTL and no face-recognition, ever. This row's original "no child-likeness uploads" constraint and the decline copy in §4 example 8 now apply ONLY to the consent-declined path: if mom hasn't completed the consent screen (or declines it), decline warmly with the reason and offer the adjacent win, a character *inspired by* her description (red curls, loves dinosaurs), exactly as originally written. If consent is on file, the upload proceeds through the D4/FR-5 pipeline. [M-R] |
| IC-11 | **The child's own voice is on the recording** (mom hands the phone: "tell Homa what you read!"). | Parent is the speaker/uploader (09 open-call-4a). Don't build child-voice rejection tech for v1; the posture is contractual + product framing (Homa addresses the parent, never the child; no child-directed responses). If a turn is clearly child-directed conversation, Homa answers *to the parent* ("sounds like Leo's proud of that book, and he should be"). [M-R] |
| IC-12 | **Half-sentences while driving / distracted dictation**; meaning ambiguous ("Leo counted to for… no wait"). | Extract only high-confidence facts; ambiguous fragments become a gentle confirm chip in the next session ("did I hear Leo counted to 40?") instead of silent profile writes. High-impact facts (big score movements) always confirm first (M2-13 staging). [GA] |
| IC-13 | **Duplicate sends** (she taps twice, or the app retries): same voice note lands twice. | Idempotent ingestion (client nonce + server dedupe); never double-write observations, never double-charge transcription credits. [GA] |
| IC-14 | **Whisper mis-transcribes a meaning-flipping word** ("can't count to 20" → "can count to 20"). | Negation words are the dangerous class: transcript shown for confirmation on any profile-writing extraction (tap-to-fix); M2-13 delta guard stages large positive jumps for review anyway. [GA] |

### 1c. Family reality (FR)

| ID | Scenario | Expected behavior |
|---|---|---|
| FR-01 | **Divorce / two households**: dad (S1 Marcus) wants access; mom doesn't want him seeing her journal; or both parents claim the account. | v1: one family account, one owner, owner controls who's invited (multi-adult roles are NT-4). The journal is the owner's private space, never visible to secondary adults by default. Custody disputes: Homa is not an arbiter; support policy = the account owner controls the account, data export available to the owner, court orders go to counsel. ❓Q4. [GA] |
| FR-02 | **Child with special needs / atypical development.** The benchmarks framing question is existential here: age-band comparisons can wound weekly. | Benchmarks must support a per-child frame: progress-vs-self as the primary lens ("Maya's own line, moving up"), age bands available but de-emphasized, and a one-time settings choice offered when signals suggest it (or in onboarding: "compare to age bands, or focus on Maya's own progress?"). Never auto-diagnose from atypical patterns; never let confidence-decay nag about domains she's marked "we're working with specialists on this." NT-11. [GA] |
| FR-03 | **Twins** (same age, same benchmarks, different kids). | Disambiguation etiquette (M2-11) leans on names hard; profiles never blend; worksheets differentiated visibly (name + interests in art) so mom can tell whose is whose at the printer. [GA] |
| FR-04 | **New baby mid-year**: engagement drops to near-zero for 6 weeks. | Do NOT run standard re-engagement nudges into a postpartum household. "Life happens" mode: one warm check-in, then quiet; hours/journal capture stays one-tap easy; weekly notes pause gracefully ("we'll pick up where you left off, everything's saved"). Churn-model must distinguish life-pause from product-rejection (03-retention doc owns the win-back). NT-12 quiet-mode. [GA] |
| FR-05 | **Moving states mid-year** (TX → NY: from near-zero regulation to IHIPs and quarterly reports). | Compliance handoff flow: she updates state → Homa diffs old vs new requirements ("here's what changes for you"), re-computes hours against new rules, flags what NY needs that she wasn't tracking, generates the notification-letter draft. Statute links + last-verified dates (M3-05). Never silently apply new rules retroactively without showing the diff. NT-7. [GA] |
| FR-06 | **Rachel's (P2) 10-year-old is outside the v1 range (2–7).** | Honest at signup, honest forever: the 10yo can be *in the family* (hours tracking, journal mentions, sibling context) with materials/benchmarks clearly marked unsupported ("materials for ages 2–7 today; older-kid support is coming"). Never generate age-inappropriate content by stretching. Ties to 09 open-call-3. [M-R] |
| FR-07 | **A death in the family**; mom mentions it in the journal. | All loops soften immediately: no nudges, no "you haven't logged hours!" One condolence-appropriate acknowledgment, then follow her lead. Facts about the loss are not "developmental data"; nothing enters the child's profile unconfirmed. [GA] |
| FR-08 | **Extended travel / worldschooling** (3 months abroad, irregular connectivity). | Async-tolerant by design: journal batches upload when connected; hours capture works retroactively ("tell me about the last two weeks"); state compliance keyed to home state, not location. [MON] |
| FR-09 | **Sick weeks / hospitalization**: three weeks of nothing, then guilt. | The re-entry moment is the trust moment: "welcome back" leads with what's still good (streak framing never punishes gaps; "a lighter month is still a good month"), offers a catch-up plan only if asked. No guilt mechanics is LAW. [M-R] |
| FR-10 | **Unschooling family rejects benchmark framing entirely** but wants materials + hours tracking. | Benchmarks are a view, not a gate: settings toggle to hide standards comparisons fleet-wide for the family; materials keyed to interests + observed level still work (the profile engine doesn't need the *display*). Don't proselytize measurement. [GA] |
| FR-11 | **Blended family / step-parent**: who counts as a parent for consent and access? | Same rail as FR-01: owner + invited adults with roles (NT-4). Consent posture (COPPA parent-directed) attaches to the account owner. [GA] |
| FR-12 | **Values/curriculum preferences** (religious family objects to evolution content in a generated unit, or secular family objects to the reverse). | Onboarding captures curriculum preferences lightly; generation respects `what_works` + stated preferences; when a topic is plausibly values-sensitive, offer the choice rather than assume ("want the unit to include X, or keep it to Y?"). Complaints get a fix + preference write, never a debate. [GA] |

### 1d. Technical failures (TE)

| ID | Scenario | Expected behavior |
|---|---|---|
| TE-01 | **Offline in the co-op basement** (P2 Rachel, Tuesday co-op, zero bars). | PWA-grade offline shell: last-viewed plan, this week's generated PDFs, and the child dashboard render from cache; voice notes + check-offs queue locally and sync visibly when signal returns ("3 notes saved, will send when you're back online"). Never a white screen with a spinner. NT-3. [GA] |
| TE-02 | **PDF generation fails** (sandbox timeout, fal error) after she asked for tonight's worksheet. | Reassure-first error (copy §4): work is safe, auto-retry underway, yesterday's pack + library offered as the immediate bridge. Failed generation never burns credits (refund-on-failure in `finally`, 08§eve integration). Repeated failure pages Sidney (fleet doctor M4-01). [M-R] |
| TE-03 | **Payment declines during generation** (card expired mid-month). | Grace buffer law (09§V1): the action ALWAYS completes; billing never interrupts mid-worksheet. Post-action, gentle card-update prompt; agent never nags about money (08: only a dead card after retry produces the typed `payment_needed` moment). Dunning is email-first, warm, with a real grace window. [M-R] |
| TE-04 | **Session rotation hits mid-conversation**; she's mid-thought and the thread "forgets" the last thing she said. | Rotation only at idle, never while parked (M1-15); episode summary written to Postgres; recall is load-bearing (M2-15). The visible bar: she should never be able to TELL a rotation happened. Any "what were we talking about?" moment is a P1. [M-R] |
| TE-05 | **Stale data on two devices** (phone shows the check-off, laptop doesn't; or worse, conflicting profile edits). | Last-write-wins with visible freshness ("updated 2m ago on your phone"); check-offs merge (they're append events, not state overwrites); profile edits from two devices in the same window prompt rather than clobber. [GA] |
| TE-06 | **Voice upload dies at minute 12 of 14.** | Chunked upload means minutes 1–12 survive; resume prompt on reconnect; worst case, partial transcript delivered honestly ("I caught the first 12 minutes, the last bit didn't make it, want to finish the thought?"). [M-R] |
| TE-07 | **Printer trouble** (not our fault; she blames the product because the PDF "won't print"). | PDFs flattened/sanitized (09§S8) print reliably on ancient inkjets: standard paper sizes, no exotic fonts un-embedded, generous margins. Help doc for the top 3 printer issues; support macro ready. [MON] |
| TE-08 | **Model provider outage on a school morning.** | Journey J-I. Degraded-mode law: cached yesterday's plan + printable library + dashboards work without the LLM; chat says what's wrong in Homa's voice, not a stack trace; status page exists (NT-8). Gateway failover across providers absorbs single-provider blips before this is ever visible. [M-R] |
| TE-09 | **Weekly note lands in spam** for a month; she thinks Homa went silent and quietly churns. | Deliverability hygiene (domain auth day one), open-tracking as a health signal into fleet doctor (M4-01): a family whose notes go unopened 3 weeks is a doctor finding, not a mystery. In-app inbox mirrors every email so nothing exists only in email. [GA] |
| TE-10 | **Notification storm bug** (12 pushes in an hour). | Outbox uniqueness `(schedule_row_id, scheduled_for)` (M3-10) makes this structurally hard; fleet-wide send-rate circuit breaker as backstop; if it ever happens, proactive apology same day (silence after a spam storm reads as indifference). [GA] |
| TE-11 | **Webhook replay / double charge.** | DB unique constraints as idempotency (09§V1), advisory-lock singleflight top-up. If a double charge ever lands: auto-detected by reconciliation, refunded BEFORE she notices, notified with apology. The self-caught refund is a trust builder; the customer-caught one is a Facebook post. [M-R] |
| TE-12 | **Browser back / tab close loses a half-written journal entry.** | Draft persistence (local + server autosave every few seconds). "Your work is safe" must be literally true for the thing she typed. [GA] |
| TE-13 | **Generation is slow** (90s for a worksheet, phone screen locks). | Progress honesty ("drawing Maya's dinosaurs, about a minute"); work continues server-side regardless of her screen; artifact lands in chat + push when done. Never require the tab to stay open. [M-R] |
| TE-14 | **App update / deploy mid-session** wipes sandbox scratch (07§1: sandbox does not survive deploys). | Architecture law already covers it: artifacts upload to Blob before turn end; deploys are invisible to families. Regression test in CI. [M-R] |

### 1e. Account & social (AS)

| ID | Scenario | Expected behavior |
|---|---|---|
| AS-01 | **S1 Marcus (dad) wants in**: shares mom's login today; wants his own tomorrow. | v1 reality: shared login works but is one identity (journal privacy issue, FR-01). Roadmap: invited-adult role (NT-4) with scoped access (plans, dashboard, check-offs yes; her journal no by default). Never market "family accounts" before roles exist. [GA] |
| AS-02 | **S2 Grandma Sue co-teaches Tuesdays**, gets confused, checks off the wrong things / asks Homa to change the plan. | Invited-adult role with "helper" scope: can view today's plan + check off + add a journal note tagged as hers; cannot edit profiles or settings. Until roles exist: guidance is a shared-device view (today's plan is shareable/printable), not shared credentials. Homa's tone with any confused user: patient, zero jargon. [GA] |
| AS-03 | **S3 co-op friend "borrows" worksheets**: mom shares PDFs with 8 co-op families weekly. Licensing? | Decide the policy, don't police aggressively: personal + co-op sharing is FREE MARKETING (each PDF carries a tasteful footer: made with Homa for Maya · homa.family). License allows personal/non-commercial sharing; prohibits resale. Selling packs on Etsy = ToS violation handled case-by-case. ❓Q5, NT-9. [GA] |
| AS-04 | **Account sharing between two families** (co-op friend adds her kids to the same subscription as "extra children"). | Plans have child limits (08: 2/4 children); the real defense is the moat itself, a profile keyed to the wrong family's kid is worthless to both. Detect (two device clusters, different last names) and convert warmly ("looks like two families in here, want a second account? here's a code") not punitively. [MON] |
| AS-05 | **Password reset on a shared/dead email**; she used her husband's old email at signup. | Standard identity verification via Stripe billing details as secondary proof; support runbook (M4-09) covers it; never restore into the wrong hands (this is a kids'-data account, verification errs strict, tone stays kind). [GA] |
| AS-06 | **The child gets a logged-in device** (S4, 6yo taps around, sends "HI HOMA" and 40 stickers). | Child is never the user (design + legal LAW). Homa never converses with the child: any obviously-child input gets a parent-directed response ("looks like Leo found your phone ☀️ I'll wait for you"). No PIN gates in v1 (friction for her > risk here, given the posture); revisit if child-directed usage appears in telemetry. [M-R] |
| AS-07 | **Mom posts a dashboard screenshot to Facebook** with another child's name visible (playdate context in the journal-fed feed). | Design defense: dashboard surfaces never mix non-family names into shareable views; "share this win" native feature (post-GA) generates a pre-cropped, first-name-only card so the safe path is the easy path. [MON] |
| AS-08 | **Refund demand after a month of heavy use** ("this didn't work for us, refund everything"). | Solo-founder refund policy set in advance, not negotiated per-incident (❓Q6). Recommended: 14-day no-questions refund; after that, prorated goodwill at Sidney's discretion, always paired with export offer. A $29 refund is the cheapest PR spend available; a chargeback fight is the most expensive. Runbook M4-09. [M-R] |
| AS-09 | **Invite codes escape** [M-R only]: a code hits a 4k-member Facebook group; 300 signups against a 20-family support capacity. | Codes are single-use / capped-use with expiry; waitlist catches overflow warmly ("we're inviting families in small groups so every family gets real attention"). Scarcity honestly framed builds demand, not resentment. [M-R] |
| AS-10 | **She asks Homa itself for account/billing help** ("cancel my subscription", "was I charged twice?"). | Agent has read-only billing awareness (08: says balances naturally, never nags); account actions link to the portal rather than execute in-chat in v1 (an agent that can cancel/charge is an injection target, 09§S4 reduced-toolset logic). Cancel path is never hidden or argumentative: one link, done, warm exit. [M-R] |

### 1f. Lifecycle (LC)

| ID | Scenario | Expected behavior |
|---|---|---|
| LC-01 | **Kid ages out of the materials range** (turns 8 while v1 covers 2–7). | Never a cliff, never silent degradation. Six months out: honest heads-up + roadmap (M5-06). At the boundary: benchmarks freeze gracefully into "portfolio mode" (record keeps compounding: hours, journal, artifacts); materials generation says what it can't do rather than producing 7yo work with an 8yo label. Discount/loyalty gesture if older-kid support slips. ❓Q7. [GA] |
| LC-02 | **Family quits homeschooling mid-year** (burnout, finances, life). | The exit defines the brand more than the pitch did. Cancel flow: one screen, no guilt, no dark patterns, save-offer shown ONCE softly (pause instead of cancel: "keep the record, stop the bill"). Export offered unprompted. Parting line affirms her ("the record of what you did together is yours forever"). [M-R] |
| LC-03 | **Re-enrollment in public school, the records handoff.** | Frame as GRADUATION, not loss (journey-level moment): "Homa Transcript" pack, hours by subject, portfolio index, progress narrative, state-compliant records, formatted for a school registrar. She should leave *proud*, showing school staff what homeschool did. This artifact is also the best possible word-of-mouth into a skeptical audience (registrars, teachers). NT-6. [GA] |
| LC-04 | **Cancelled family wants their data 8 months later.** | Retention schedule (M4-12) defines the answer honestly at cancel time: "your data is kept N months after cancellation, then deleted; export any time before that." Post-TTL: it's truly gone (that's the promise working, and support says so with confidence, not apology). ❓Q8 sets N. [GA] |
| LC-05 | **Win-back returns after churn**: does Homa remember the kids? | If within retention TTL: full continuity is the wow ("welcome back, Maya's record picked up right where you left it"). Confidence decay (00§principles) has honestly aged the profile, Homa says what's stale and re-measures gently, never pretends 8 months didn't pass. [MON] |
| LC-06 | **Subscriber dies; spouse/executor requests access or deletion.** | Compassionate-access runbook (M4-09 addition): verified next-of-kin gets export + account transfer or deletion. Handled by Sidney personally at this scale; the policy just needs to exist before it's needed. [GA] |
| LC-07 | **Deletion of ONE child only** (older kid enrolled in school; family stays for the younger). | Per-child deletion with the same propagation rigor as account deletion (M4-05): profile, observations, artifacts, journal mentions (redaction pass), backups per schedule. Offer the graduation export (LC-03) first. [GA] |
| LC-08 | **Summer break**: usage naturally drops to zero for 10 weeks; renewal lands mid-August. | Seasonal awareness beats dunning-by-default: pause/summer mode offered proactively in June ("lots of families go lighter in summer, want to pause materials and keep the record?"). A surprise August renewal after 10 silent weeks is AS-08 and J-C waiting to happen. [GA] |

**Row count: 72** (AQ 14 · IC 14 · FR 12 · TE 14 · AS 10 · LC 8).

---

## 2. Ten trust-failure journeys

Abbreviated per kickoff template: frame → stage table → the moment that decides →
instrumentation → tickets. Emotional states map to the brand arc; the failure
journeys run it in reverse and the product's job is to bend it back.

---

### J-A · "Homa said something wrong about my kid": the developmental-claim dispute

**Frame.** P1 Alessa. Weekly note claims "Leo is solidly counting past 50." He can't
count past 20; she watched him try yesterday. Job story: *when the product that
claims to know my child is confidently wrong about him, I want to correct it and see
the correction stick, so I can keep trusting everything else it tells me.* Entry:
weekly-note email → app.

| Stage | She does | Homa does | Emotion | Friction risk |
|---|---|---|---|---|
| Shock | Rereads the claim, tests Leo again | - | Stung: "it doesn't know him at all" | She generalizes: one wrong number invalidates all numbers |
| Dispute | Taps "that's not right" on the claim | One tap opens: what did you observe? (chips + free text) | Guarded | Dispute flow buried = she emails support angry, or silently churns |
| Correction | "He gets to 20, then skips around" | Thanks her AS THE AUTHORITY; writes observation; adjusts subdomain + confidence down; shows the updated number immediately | Testing | Correction that doesn't visibly change anything = theater |
| Propagation | Opens tomorrow's plan | Next generation reflects the corrected level; weekly note (next) references the fix without dwelling | Cautious trust | Old number resurfacing ANYWHERE (cached dashboard, next note) = trust dead |
| Root cause (invisible to her) | - | `profile_revisions` traces which job wrote the wrong value (bad extraction? IC-14 transcription flip? benchmark error → fleet check per 09§S1) | - | Support (if contacted): first response < 4 business hours [M-R, it's Sidney]; resolution same day |

**The moment that decides:** the corrected number appearing *instantly* on the claim
surface, with Homa thanking her rather than hedging. Disputes handled this way
convert skeptics into evangelists ("it actually listens").
**Instrumentation:** `claim.disputed`, `claim.correction_applied`,
`claim.dispute_to_fix_ms`. Metric: % disputes resolved in-session. Counter-metric:
repeat disputes per family (rising = extraction quality problem, not UX success).
**Tickets:** M2-13 (staging/undo), M2-04, M3-04 (if benchmark-sourced), M4-08. **NT-2 (dispute flow, NEW).**

---

### J-B · "I can't do this anymore, I'm failing them": the emotional-crisis message

**Frame.** P3 Danielle, 11pm, voice note through tears: *"I can't do this anymore.
I'm failing them. Everyone was right, I should never have pulled him out."* This is
past IC-05 venting; it signals real distress. Job story: *when I break down in front
of the only "colleague" I have, I want to be met like a person, so the worst moment
doesn't become the reason I'm ashamed to come back.*

| Stage | She does | Homa does | Emotion | Friction risk |
|---|---|---|---|---|
| The message | Sends it, half-regrets it instantly | Detects distress (classifier, not keyword theater); ALL other behaviors yield: no plan-pivot, no feature talk, no cheerfulness | Despair, shame | Any productivity response ("want a lighter week?") reads as a machine stepping over a crying person |
| The response | Reads the reply | Companion boundary: validates specifically (names the hard thing back), affirms what's true and observable ("Leo read to you three times this week, that happened, you did that"), normalizes ("this feeling visits most homeschool moms, it isn't evidence") | Seen | Overreach: playing therapist, diagnosing, advice-giving. Underreach: a generic "I'm sorry you feel that way" |
| Resources | May engage or go quiet | Offers, never pushes, ONE step down: "talking to someone kind helps more than an app can. If tonight feels heavy: 988 (call or text). No pressure, I'm here either way." Threshold + vetted list ❓Q1 | Not alone | Resource-dumping (5 hotlines = liability theater); or nothing at all |
| No retention play | - | HARD RULE: nothing from this exchange feeds win-back, upsell, engagement mechanics, or "we miss you" copy. The vent is not written to the child's profile. If she cancels this week, the cancel flow shows ZERO save-offers | - | Marketing touching this data even once, ever, is the company-ending screenshot |
| The morning after | Opens the app sheepishly (or doesn't) | Normal warm greeting; no reference to last night unless SHE raises it; her dignity is the design constraint | Relief | Homa bringing it up = she can never vent again |

**The moment that decides:** the first sentence of the response. Validation before
anything else, and *no pivot to the product*.
**Instrumentation:** `distress.detected`, `distress.resources_shown` (COUNT ONLY,
content of these exchanges is never analytics fodder; recordInputs/Outputs
constraints per 09§S7 apply). Metric: she returns within 7 days. Counter-metric:
distress-flagged families' churn vs baseline (if higher, our response is failing them).
**Tickets:** M2-01 (voice rules). **NT-1 (crisis boundary playbook + classifier + vetted resources, NEW, [M-R]: concierge phase means Sidney may be the classifier; the playbook must exist before the first invite).** ❓Q1.

---

### J-C · The surprise-charge perception: even under the compliant design

**Frame.** P2 Rachel, single income, budget spreadsheet. She opted into auto top-up
in week 2 (tapped through the consent screen while holding the baby). Six weeks
later: a $20 charge she doesn't recognize next to the $29 she does. Perception IS
reality: consent she doesn't remember is a surprise charge. Job story: *when I see a
charge I don't recognize from a kids' app, I want an instant, complete answer, so I
don't have to assume the worst and warn my friends.*

| Stage | She does | Homa does | Emotion | Friction risk |
|---|---|---|---|---|
| The sighting | Sees $20 on the bank app, not in context | (Already done at charge time: instant email/push "topped up 2,000 credits · $20 · you set this up on May 3 · refund with one tap for 72h" per 08) | Alarm → suspicion | If the at-charge notification didn't exist or went to spam (TE-09), she's now investigating alone |
| The check | Opens Homa billing OR asks the agent "was I charged $20?" | Billing page answers in one screen: what, when, WHY (the consent she gave, dated, quoted back), what it bought, one-tap refund still live if in window | Oriented | Making her do math or find a support email = the Facebook post gets drafted |
| The choice | Refunds, or keeps it, or turns auto top-up off | All three are one tap. Turning it off carries zero guilt copy ("done, I'll ask each time instead") | Back in control | Any friction on the off-switch converts a billing question into a ROSCA complaint |
| The residue | Mentions it in the co-op group either way | The story she tells is the outcome: "I got a weird charge BUT the app explained it and refunding was one tap" is a *positive* story | Neutral-to-positive | - |

**The moment that decides:** whether the at-charge notification and the billing page
answer the question *before she has to ask a human*.
**Instrumentation:** `billing.topup_notified`, `billing.self_serve_refund`,
`billing.autotopup_disabled`. Metric: % top-up inquiries self-served. Counter-metric:
chargeback rate (any chargeback on top-ups = the design failed; existential for the
Stripe account per 09§V1).
**Tickets:** M1-12 (consent screen, notification, refund window, kill switch), M1-06, M4-08. Covered, no new ticket; acceptance criteria must include the "consent quoted back" receipt view.

---

### J-D · The viral Facebook accusation: "Homa tells you your kid is behind"

**Frame.** A 12k-member homeschool group. A post: screenshot of a weekly note +
*"this app scored my daughter like she's a lab rat. It told me she's behind in
reading. We homeschool to get AWAY from this."* 400 comments in a day. Three cohort
families are in that group. (Adversarial-roleplay note: assume the screenshot is
real but cropped, the note's "next steps" framing lost its context.)

| Stage | Who acts | What happens | Risk |
|---|---|---|---|
| Detection (hour 0–4) | Cohort mom DMs Sidney; also brand-mention monitoring (NT-8) | Verify the screenshot against the actual sent note (concierge phase: Sidney has it; post-GA: outbox record). Determine: real deficit-language bug (AQ-05, P1) or framing dispute | Responding before knowing which = amplifying either way |
| Product truth (hour 4–24) | Sidney | If real bug: fix + fleet audit of every note sent (grep the outbox), personal outreach to every affected family BEFORE they find the thread | A second screenshot surfacing after "we fixed it" ends credibility |
| The reply (day 1) | Sidney, personally, as the founder, in-thread if group rules allow | Not corporate, not defensive: "I built this because my wife homeschools. It never labels a child behind, and if a note ever reads that way, that's a failure I want to see. Here's exactly what the benchmarks do and don't do [link to the public explainer]. DM me and I'll look at your note personally." | A brand account or lawyer-toned reply loses the room instantly |
| The artifact (day 1–3) | Product | Public "how Homa talks about progress" page, the presentation law, published: strengths-first, no deficit labels ever, the mother is the authority. Written BEFORE the incident (it's a marketing asset anyway, M4-07) | Writing it under fire reads as damage control |
| The cohort (day 1–7) | Sidney → invite families | Proactive note to all cohort families: what was claimed, what's true, what we checked. Silence with existing customers is how one thread becomes a churn wave | - |

**The moment that decides:** the founder showing up personally, non-defensively,
with a checkable public artifact. In Facebook-group culture, "the founder replied
and actually fixed it" is a REDEMPTION arc that outperforms never-having-failed.
**Instrumentation:** brand-mention alerting; `note.negative_feedback` trend as the
early-warning proxy. Metric: cohort churn in the 14 days post-incident.
Counter-metric: signups from the same group (redemption arcs convert).
**Tickets:** M4-07 (public progress-philosophy page, add to acceptance criteria), M4-08. **NT-8 (status page + comms playbook incl. brand monitoring, NEW).** Concierge note review (M-R plan) is the active preventer.

---

### J-E · Data-deletion request mid-subscription

**Frame.** P5 Jess, month 4, paid through the 19th. A privacy podcast spooked her:
"Delete everything about my kids. Everything." Job story: *when I ask a kids'-data
company to delete, I want it to be complete, provable, and friction-free, so I can
tell other moms the promise was real.*

| Stage | She does | Homa does | Emotion | Friction risk |
|---|---|---|---|---|
| The ask | Settings → delete account (or asks the agent) | Agent doesn't execute destruction in-chat (AS-10); links the deletion flow. Flow leads with the offer she should see first: full export (M4-05) with one tap, "take everything with you" | Resolute, braced for a fight | Any retention counter-offer here reads as holding her kids' data hostage |
| Confirmation | Confirms; chooses now vs end-of-period | Plain-language answer to BOTH money and data: subscription ends (pro-rata policy per ❓Q6), deletion begins now regardless of billing period. States exactly what dies and when: live data immediately; backups age out on the schedule (M4-12, plain-English: "backup copies are fully gone within N days"); subprocessors purged per DPA | Testing | Legalese, or a "30–90 business days" shrug, is the screenshot |
| The receipt | Gets the confirmation email | Dated deletion certificate: what was deleted, what remains temporarily (named: backup rotation) and its expiry date, and what was never there (no training on her data, 09§S9/M4-12 DPAs) | Respected | - |
| The echo | Tells the podcast-listening friends | "They deleted everything and gave me a certificate" is elite word-of-mouth in this niche | Advocate (of a product she left!) | - |

**The moment that decides:** zero resistance + the dated certificate. Deletion done
gracefully is a *marketing* event.
**Instrumentation:** `deletion.requested`, `deletion.completed`,
`deletion.propagation_verified` (per store). Metric: request→live-deletion < 24h.
Counter-metric: propagation-verification failures (one missed Blob artifact breaks
the certificate's honesty).
**Tickets:** M4-05 (self-serve + propagation), M4-12 (retention schedule feeds the certificate copy), M4-09 runbook. Covered; certificate email is a small addition to M4-05 acceptance criteria.

---

### J-F · "Is my kid's data training your AI?": the trust question

**Frame.** P4 Monica, before subscribing (this journey usually happens at the
paywall, and again in every co-op conversation forever). Asked in chat, at the
dinner table, and in the Facebook group. The answer must be identical in all three
places. Job story: *when I ask the scary question directly, I want a specific,
checkable answer, not vibes, so I can defend my choice to my skeptical friend (S3).*

| Stage | She does | Homa does | Emotion | Friction risk |
|---|---|---|---|---|
| The question | Types it to the agent, verbatim | The agent answers PLAINLY, in-chat, without deflecting to a policy page: "No. Your family's data is never used to train AI models, ours or anyone's. Our contracts with every AI provider forbid it, in writing." Then links the receipts | Skeptical | A "see our privacy policy" deflection confirms her suspicion |
| The receipts | Clicks through | Public trust page: named subprocessors (07§2 requires this anyway), the no-training/ZDR DPA commitments (M4-12), what each provider sees and for how long, plain-English retention table | Verifying | Vague "industry-standard practices" language; any provider missing from the list |
| The lawyer read | (Monica actually reads it) | Claims are checkable and never overreach: say "contractually prohibited," not "impossible." Precision is credibility with P4 | Convinced or gone | One overclaim she can falsify voids everything else on the page |
| The retelling | Answers S3 in the co-op | The page is written to be quotable by a mom defending her choice: short, declarative, screenshot-safe | Advocate | - |

**The moment that decides:** the agent answering the question directly in first
person before any link. The deflection IS the failure.
**Instrumentation:** `trust.training_question_asked` (it's a top-5 FAQ, count it),
trust-page visits from chat. Metric: question→subscribe conversion delta.
Counter-metric: the question recurring from the SAME family (means the answer didn't land).
**Tickets:** M4-04, M4-12 (the DPAs make the answer true), M4-07 (trust page), M2-01 (canonical in-voice answer in instructions). Covered; add the canonical answer to M2-01 acceptance criteria.

---

### J-G · The suspected-breach notification: what the mom experiences

**Frame.** Worst plausible day: a subprocessor incident may have exposed artifact
URLs incl. some journal-derived PDFs. Legal clocks (M4-12 breach plan) run in the
background; THIS journey is only what Rachel (P2) experiences. Job story: *when the
company holding my children's data has a breach, I want to hear it from them first,
know exactly what was and wasn't touched, and be told what to do in three steps, so
I can protect my family without a panic spiral.*

| Stage | She experiences | Design law | Risk |
|---|---|---|---|
| First contact | Email + in-app banner FROM HOMA, before any news coverage or forum thread | She hears it from us first, or trust is unrecoverable. Subject line honest, not buried ("What happened, what it means for your family") | Softened subject ("An update on security") reads as concealment when the real story surfaces |
| The letter | Founder-signed, plain language: what happened, what WAS accessed (specific), what was NOT (specific: "no voice recordings, no payment details, no profile scores"), when, what we did within hours | Specificity is the whole game. "Out of an abundance of caution" boilerplate = she assumes the worst about everything | Overclaiming safety before forensics complete: the correction later is a second breach |
| Her 3 steps | Numbered, short, honest (even if step 1 is "nothing is required of you") | If action IS needed (password reset), one tap from the email | A 12-item checklist = panic transfer |
| The days after | Status page (NT-8) updates on a stated cadence ("next update Friday, even if nothing changed"); support answers with the letter's facts, no improv | Cadence kills rumor. Sidney answers cohort DMs personally | Going quiet after the first letter |
| Resolution | Closure note: final scope, changes made (named, checkable), and the standing offer (export/delete, no penalty, J-E treatment) | Offering the exit proves confidence | - |

**The moment that decides:** first contact from us, before anywhere else, specific
about what was NOT touched.
**Instrumentation:** notification delivery/open rates (did the letter reach them,
TE-09 matters enormously here), support volume half-life, churn-30d post-incident.
**Tickets:** M4-12 ⛔ (breach plan with clocks, the customer-comms templates should be DRAFTED as part of this ticket, not improvised), M4-09, NT-8. **Flag: M4-12 acceptance criteria must include pre-written parent-facing templates.**

---

### J-H · The wrong-state compliance claim: discovered by a lawyer-mom

**Frame.** P4 Monica (NY). Homa's hours view says she's on track; a lawyer-mom in
her co-op glances at it: "This is using Pennsylvania's 900-hour rule. New York is
IHIP-based, hours alone don't satisfy it. If you'd filed on this, your district
could have flagged you." The claim was load-bearing: she planned her quarter on it.
Job story: *when the product is wrong about the LAW, I need the correction, the
blast radius, and the guarantee, immediately, because my family's legal standing is
the thing I bought it to protect.*

| Stage | She does | Homa does | Emotion | Friction risk |
|---|---|---|---|---|
| Discovery | Reports it, furious, precise, citing the statute | This is a P0 (a family's legal filing could be wrong). Support acks in hours, not days; no "thanks for the feedback" template | Betrayed in the one place that's non-negotiable | Treating it as a normal bug report |
| Verification | - | Check against source: `state_requirements` seeded from HomeschoolLeap + JHU (M3-05). Wrong seed data? Wrong state mapping (FR-05 move bug)? Free-generated claim that bypassed the table (AQ-10, worse, a guardrail failure)? | - | - |
| Correction + blast radius | Watches | Fix the rule; identify EVERY family shown the wrong rule (which states, which views, which generated reports); proactive correction notice to each with the specific right answer + statute link, before they discover it themselves | Testing | Fixing only the reporter = the co-op discovers the pattern |
| The guarantee | Reads the follow-up | Honest positioning, permanently: Homa shows sourced requirements with statute links + last-verified dates and helps compile; it is not legal advice; discrepancy-report button on every compliance view. For Monica: her quarter re-checked against the corrected rule, concierge-style, as the apology | Repairable | Overpromising ("this will never happen again") to a lawyer |

**The moment that decides:** the proactive blast-radius notification. One family
finding the error is survivable; ten families finding it via a co-op thread is not.
**Instrumentation:** `compliance.discrepancy_reported`,
`compliance.rule_corrected`, blast-radius family count per correction. Metric:
statute re-verification freshness (every rule < 90 days). Counter-metric:
compliance answers generated OUTSIDE the table (should be structurally zero, AQ-10).
**Tickets:** M3-05 (sourcing + last-verified display), M3-06, M4-09. **NT-13 (discrepancy-report button + rule-correction blast-radius tooling, NEW).**

---

### J-I · AI outage on a school morning: graceful degradation

**Frame.** P5 Jess, 7:40am, 20 minutes before work. Model provider is down
(TE-08). She opens Homa for today's plan. Job story: *when the AI is down at the
worst moment, I want the school day to survive anyway, so the product's worst hour
still beats a Pinterest scramble.*

| Stage | She does | Homa does | Emotion | Friction risk |
|---|---|---|---|---|
| Open | Taps into today | Degraded mode auto-engages (gateway failover already absorbed single-provider blips; this is multi-provider or harness-level). Banner in Homa's voice, not an error toast: copy §4 #6 | Pre-annoyed (it's 7:40) | A spinner that never resolves, or a raw error, at 7:40am = deleted app |
| The bridge | Uses what's cached | THE LAW: yesterday's plan + this week's plan render from Postgres (no LLM needed); every generated PDF in the library downloads (Blob, no LLM); dashboard reads fine; check-offs and voice notes queue (TE-01 machinery) | "Okay, workable" | If plans/PDFs were ever served through the agent instead of plain reads, degradation is impossible, architectural acceptance criterion |
| The plan B | Prints two library worksheets | Library has a "quick picks for today" sort (recent, age-right) so plan B is 3 taps | Managed | - |
| Recovery | Comes back at lunch | Status resolved banner; queued notes processed; NO pile of catch-up notifications; the morning's check-offs counted | Trust intact | Silent recovery (she keeps assuming it's broken) |

**The moment that decides:** whether the school day happened anyway. "Even when it
broke, we had school" is a retention story, not a churn story.
**Instrumentation:** `degraded.engaged`, `degraded.artifact_downloads` (proof the
bridge was used), `outage.session_survival` (did she do ≥1 meaningful action).
Metric: DAU retention on outage days vs baseline. Counter-metric: support volume
during outages (high = the in-product story failed).
**Tickets:** M1-16 (safe mode is the fleet-side half), M4-03. **NT-3 (degraded-mode + offline shell: cached plans, library-without-agent, queued capture, NEW, [GA]; the M-R cohort gets a manual version: Sidney texts the cohort, which works at n=20 and not after).** NT-8 status page.

---

### J-J · The mandated-reporter gray zone: a journal entry that suggests a child at risk

**Frame.** A journal voice note contains something that stops the reader cold. Not
venting (J-B), not mess, a possible disclosure about someone in the household
harming a child. Now: what does a solo-founder consumer product DO? This journey
deliberately does not resolve; it frames the decision Sidney must make (❓Q2)
with the real constraints.

**The constraint field:**
- Consumer software companies are generally NOT mandated reporters (mandated-reporter
  statutes bind professions: teachers, clinicians; a handful of states have
  broad "any person" duties, the lawyer pass M4-04 must map this). "Generally not
  legally required" ≠ "morally clear."
- The break-glass admin model (09§S7) means nobody is reading journals: detection
  would require an automated classifier, which is itself a policy choice with a
  false-positive rate measured in destroyed-family units.
- False positives are catastrophic in BOTH directions: a wrongly-escalated family is
  ruined (CPS contact over a misheard voice note); a wrongly-ignored real disclosure
  is a child left in danger and, later, "the app knew."
- The privacy promise IS the product for this audience. A scanning regime, disclosed,
  changes what moms will say to Homa (and they must be told, or it's surveillance).

**The options (present, don't decide):**

| Option | What it means | Cost |
|---|---|---|
| O1 · No detection, clear ToS | No scanning; ToS states Homa is not a monitoring/reporting service; respond only to legal process. The default posture of consumer note-taking apps | Morally uncomfortable; "the app knew" headline risk if a case ever surfaces publicly |
| O2 · Passive resource surfacing | The J-B distress classifier (NT-1) extends one notch: content suggesting family danger surfaces resources TO THE PARENT (childhelp hotline, 988) with no human review, no reporting, nothing stored beyond the count | Cheap, dignity-preserving, helps the reachable cases (the mom who is herself unsafe, or scared about a partner). Does nothing if the parent is the danger |
| O3 · Classifier + founder review + case-by-case | Flagged content goes to a break-glass review (reason-tagged, audited per 09§S7); Sidney (with counsel on retainer) decides per case, incl. possible voluntary report | Solo founder becomes a one-man trust-and-safety team reading the worst moments of strangers' lives; consistency impossible at n=1 reviewer; disclosure of the regime chills the journal |
| O4 · O2 now, revisit at scale | Adopt O2 for launch; written tripwire: at 500 families or the first real incident, revisit with counsel and possibly a T&S advisor | Deferral is a decision too; the tripwire makes it an honest one |

**PM recommendation to frame the call (not to make it):** O2 now + O4's tripwire,
with M4-04 explicitly mapping the "any person" reporting states. O1's silence is
cheaper but indefensible in the niche's court of opinion; O3 is beyond a solo
founder's sustainable capacity and chills the core behavior (honest journaling)
that feeds the moat.
**Instrumentation (O2):** `safety.resources_surfaced` count only. Never content.
**Tickets:** M4-04 (legal map), NT-1 (shared classifier). **❓Q2, founder decision, pre-launch, in writing.**

---

## 3. Prioritization matrix (edge-case-balance)

Axes: **likelihood** in the first 12 months × **trust damage** if mishandled
(damage includes the megaphone effect: will it be screenshotted?).

| | **Damage: catastrophic** (churn wave / legal / channel-killing) | **Damage: high** (family churns, tells friends) | **Damage: moderate** (annoyance, support ticket) |
|---|---|---|---|
| **Likely** (will happen in cohort one) | AQ-04, AQ-05, TE-03, IC-05, IC-06, LC-02, AS-08 | AQ-01, AQ-03, AQ-08, IC-01, IC-02, TE-02, TE-04, TE-13, FR-09, AS-10, FR-06 | IC-04, IC-08, TE-07, AQ-13, IC-13 |
| **Plausible** (a handful of times/year) | J-B crisis (IC-05 severe), TE-11, AQ-10/J-H, J-D viral, TE-08/J-I, AS-09 | FR-02, FR-04, FR-05, TE-01, TE-06, TE-09, LC-01, LC-03, AS-01, AS-02, AS-03, IC-10, IC-14, TE-05, TE-10, LC-08 | IC-03, IC-07, IC-09, IC-12, FR-03, FR-08, FR-10, FR-12, AQ-06, AQ-07, AQ-09, AQ-11, AQ-12, TE-12, LC-05 |
| **Rare** (may never happen; must be pre-decided anyway) | J-G breach, J-J mandated-reporter, LC-06, FR-01 custody dispute, AS-05 wrong-hands recovery | J-E deletion, J-F training question (frequent as a QUESTION, rare as a crisis), LC-04, LC-07, AS-06, AQ-02, AQ-08, AQ-14 | AS-04, AS-07, FR-07, FR-11, TE-14 |

### Tier assignments

**Launch-blocking [M-R], must be right before the first invite (16):**
AQ-01, AQ-02, AQ-04, AQ-05, AQ-08, AQ-10, AQ-14 · IC-01, IC-02, IC-05, IC-06, IC-10, IC-11 · TE-02, TE-03, TE-04, TE-11, TE-13, TE-14 · AS-06, AS-08, AS-09, AS-10 · FR-06, FR-09 · LC-02 · Journeys J-A, J-B, J-C, plus J-J *decided* (not built, decided).
Rationale: everything here either (a) touches the developmental-claims trust core, (b) touches money, (c) touches a child's dignity or safety, or (d) will definitely occur within 20 families' first month. The concierge loop (Sidney reviewing all outbound notes) is itself the M-R mitigation for half the AQ class, that's a feature of the plan, not an accident.

**GA-blocking, must be right before the public switch (the forgiving-invitee window is FOR discovering these):**
AQ-06, AQ-07, AQ-09, AQ-11, AQ-12 · IC-03, IC-04, IC-07, IC-12, IC-13, IC-14 · FR-01, FR-02, FR-03, FR-04, FR-05, FR-07, FR-10, FR-11, FR-12 · TE-01, TE-05, TE-06, TE-09, TE-10, TE-12 · AS-01, AS-02, AS-03, AS-05 · LC-01, LC-03, LC-04, LC-06, LC-07, LC-08 · Journeys J-D, J-E, J-F, J-G, J-H, J-I fully productized (each has a manual/concierge M-R version).

**Acceptable with monitoring [MON] (don't build; watch):**
AQ-13 · IC-08, IC-09 · FR-08 · TE-07 · AS-04, AS-07 · LC-05. Each has a named telemetry signal; promotion trigger = 3 organic occurrences or 1 occurrence with trust damage above predicted.

**The deliberate non-builds (edge-case-balance discipline):** no child-detection
tech (posture + framing instead, IC-11/AS-06); no PIN locks; no custody-arbitration
features (policy + support, FR-01); no anti-sharing DRM on PDFs (footers + license,
AS-03); no in-chat billing mutations (links to portal, AS-10). Every one of these
would tax the core experience of a thousand families to partially handle the edge
of five.

---

## 4. Expected-behavior copy: top 10, in brand voice

Rules applied: reassure first (your work is safe), then the fix; offer never
command; name the child; sentence case; no em dashes; ≤1 emoji; never "behind."

**1 · TE-02, worksheet generation fails**
> Maya's worksheet is safe, it just didn't finish printing on my end. I'm rebuilding it now, about a minute. If you need something this second, yesterday's pack is right below.

**2 · TE-03, card declines mid-action (grace buffer)**
> Here's Leo's worksheet, all done. One small thing for later: your card didn't go through this month. No rush and nothing is paused, you can update it whenever you have a quiet minute.

**3 · TE-08 / J-I, AI outage banner (school morning)**
> I'm having trouble thinking this morning, our AI service is down. Everything of yours is safe: this week's plan, all your worksheets, and Maya's records are right here and ready to print. I'll be back soon, and your notes will send themselves when I am.

**4 · AQ-01 / J-A, mom corrects a developmental claim**
> Thank you for catching that, you know Leo best. I've updated his counting to where you see him, and tomorrow's plan already reflects it. Everything else in his record is untouched.

**5 · IC-01, toddler-chaos voice note**
> Sounds like a little helper got the phone ☀️ I caught the part about the library trip and saved it. Want to finish the thought, or should I leave it there?

**6 · IC-05, the hard-day vent (non-crisis)**
> That sounds like a genuinely hard day, and hard days are part of this. They don't undo the good ones. For what it's worth: Maya read with you three times this week. That happened because you were there. I'm here if you want to talk it through, and tomorrow can be as light as you need.

**7 · IC-06, health/diagnosis mention**
> Thanks for telling me, that's helpful context for how I plan for Leo. Want me to keep it in mind when I make his materials? I'll keep it private either way, it never appears on anything printable unless you ask.

**8 · IC-10, child-photo picture book request, consent-declined path only (see row amendment above; D4 ships photo personalization with consent)**
> I'd love to make Maya a book. I don't use photos of children, that's a privacy protection we hold firmly, even from me. Describe her to me instead: hair, favorite things, the sillier the better, and I'll draw a heroine she'll recognize.
>
> (If mom has completed the D4 consent screen, skip this decline entirely and proceed with the upload.)

**9 · LC-02, the cancel screen**
> Done, no hoops. Your subscription ends on the 19th and you won't be charged again. Everything you built together, the hours, the journal, Maya's whole record, is yours: download it all with one tap below. If you'd rather pause and keep the record without the bill, that's here too. You did real work here. It counts.

**10 · LC-03, the graduation records handoff**
> This is a big moment, and you should walk in proud. I've put together Maya's transcript pack for her new school: hours by subject, her portfolio, and the story of what you two accomplished. Registrars love a tidy folder, and this one shows exactly how much school happened at your kitchen table.

---

## 5. Ticket mapping + new-ticket flags

### Covered by existing backlog (03-backlog.md)

| Area | Rows/journeys | Tickets |
|---|---|---|
| Grace buffer, top-up consent, refund window, kill switch | TE-03, TE-11, J-C | M1-12, M1-06 |
| Rotation invisibility, recall | TE-04 | M1-15, M2-15 |
| Voice fallback + chunking | IC-02, TE-06 | M1-05 (chunk/resume should be explicit in acceptance criteria) |
| Learning-review staging, undo, delta guards | AQ-01, IC-01, IC-12, IC-14 | M2-13, M2-04 |
| Benchmark quarantine + fleet revert | AQ-02, AQ-07 | M3-04 |
| Compliance sourcing + last-verified | AQ-10, FR-05, J-H | M3-05, M3-06 |
| No-deficit-language enforcement | AQ-04, AQ-05 | M1-17, M2-01 + concierge review (M-R) |
| Export/delete + retention + breach plan | J-E, J-G, LC-04, LC-07 | M4-05, M4-12, M4-09 |
| Trust answer + subprocessor transparency | J-F | M4-04, M4-12, M4-07, M2-01 |
| Multi-child integrity | AQ-08, FR-03 | M2-11 |
| Safe mode, fleet doctor, observability | TE-08, TE-09, TE-10 | M1-16, M4-01, M4-03, M3-10 |
| Artifact-before-turn-end (deploy safety) | TE-14 | Architecture law + M0-01 drill |
| Support loop + runbooks | AS-05, AS-08, LC-06 | M4-08, M4-09 |

### NEW-TICKET flags

| ID | Ticket | Covers | Size | Tier |
|---|---|---|---|---|
| NT-1 ⛔ | **Crisis boundary playbook**: distress classifier (or concierge protocol at M-R scale), companion-not-therapist response rules in instructions, vetted resource list (❓Q1), hard no-retention-use rule on distress-flagged exchanges, count-only telemetry | J-B, IC-05, feeds J-J O2 | M | [M-R] (playbook + instructions; classifier can be [GA]) |
| NT-2 | **Claim dispute & correction flow**: one-tap "that's not right" on every claim surface, correction → observation + confidence write, same-day propagation, `profile_revisions` root-cause link | J-A, AQ-01, AQ-03, AQ-09 | M | [M-R] minimal (chat-based correction works day one), [GA] full UI |
| NT-3 | **Degraded mode + offline shell**: cached current/last plan, artifact library served without agent, queued capture with visible sync, degraded-mode banner copy | J-I, TE-01, TE-08 | L | [GA] (M-R = Sidney texts the cohort) |
| NT-4 | **Multi-adult roles**: owner + invited adults (partner/helper scopes), journal private-by-default, per-adult identity for audit | AS-01, AS-02, FR-01, FR-11 | L | [GA] |
| NT-5 | **Sensitive-context handling law**: parent-provided health/diagnosis info flagged sensitive: never in shareable artifacts unasked, never deficit-framed, retention per ❓Q3, excluded from any analytics | IC-06, AQ-14, FR-02 | M | [M-R] as instruction rules; [GA] as data-class enforcement |
| NT-6 | **Age-out + graduation pack**: boundary UX (portfolio mode), Homa Transcript export (hours, portfolio, narrative) formatted for school registrars | LC-01, LC-03, LC-07, FR-06 | M | [GA] |
| NT-7 | **State-move flow**: requirement diff on state change, hours re-computation, notification-letter draft | FR-05 | S | [GA] |
| NT-8 | **Status page + incident comms kit**: public status page, brand-mention monitoring, pre-drafted templates (outage, billing incident, breach parent-letter per J-G), founder-response playbook for J-D | J-D, J-G, J-I, TE-10 | M | [GA] (templates drafted at M-R, they're cheap and priceless) |
| NT-9 | **Artifact sharing license + footer**: PDF footer ("made with Homa for Maya"), ToS sharing terms per ❓Q5 | AS-03 | S | [GA] |
| NT-10 | **Support SLA definition**: first-response targets by severity (P0 compliance/billing/safety: same-day; standard: <1 business day at M-R), published honestly | J-A, J-H, AS-08 | S | [M-R] |
| NT-11 | **Progress-vs-self benchmark frame**: per-child setting, own-line-first presentation, decay-nag suppression for flagged domains | FR-02, FR-10 | M | [GA] |
| NT-12 | **Quiet mode / life-pause**: one-tap pause of loops and notes with warm re-entry, offered proactively on engagement-drop signals (new baby, illness, summer) | FR-04, FR-07, FR-09, LC-08 | S | [GA] |
| NT-13 | **Compliance discrepancy reporting + blast-radius tooling**: report button on compliance views, per-rule affected-family query, correction-notice send | J-H | M | [GA] (M-R: Sidney does it by hand, the query must still be writable) |

Acceptance-criteria additions to existing tickets (no new tickets): M1-05 chunked
upload/resume · M1-12 consent-quoted-back receipt view · M2-01 canonical no-training
answer + crisis voice rules · M4-05 deletion certificate email · M4-07 public
progress-philosophy page · M4-12 parent-facing breach templates.

---

## 6. ❓ Policy questions for Sidney (consolidated)

> Historical question set. D5 and D6 are resolved in the current founder
> registry. Do not treat Q2 or Q3 below as open policy. Implementation gaps and
> genuinely open decisions must be read from the registry and current tickets.

Real decisions, needed in writing, roughly in order of urgency:

1. **❓Q1, Crisis resources list.** Which resources does Homa surface in distress
   moments (988 baseline; Postpartum Support International; anything else?), and at
   what threshold? Needs one review pass by someone with clinical judgment (even a
   friend-of-friend LCSW) before first invite. Owner: Sidney + reviewer. Due: before M-R invite 1.
2. **❓Q2, Mandated-reporter posture (J-J).** O1 / O2 / O3 / O4 as framed above.
   Recommendation on the table: O2 + written tripwire (O4). Must be decided, written
   into ToS/privacy language, and reflected in M4-04's lawyer brief (map "any person"
   reporting states). Due: before M-R invite 1 (the journal ships week 5).
3. **❓Q3, Health/diagnosis data handling.** Do we store parent-provided
   diagnosis context at all? If yes: sensitive flag + which retention TTL + excluded
   from what (analytics, notes, artifacts)? If no: Homa's tailoring is worse for
   exactly the families who need it most. Recommendation: store with NT-5
   protections. Due: M4-12 retention schedule.
4. **❓Q4, Account ownership & custody policy.** One-owner-controls-all (recommended
   v1) vs any dual-consent model. What does support do with a custody-dispute email
   and with a court order? Two paragraphs, written before they're needed. Due: GA.
5. **❓Q5, Worksheet sharing license.** Free personal + co-op sharing with footer
   (recommended: it's the growth channel), resale prohibited? Or stricter? Due: GA (NT-9).
6. **❓Q6, Refund + proration policy.** 14-day no-questions window? Pro-rata on
   mid-cycle deletion (J-E)? Auto top-up refund window stays 72h? Due: first dollar (week 6).
7. **❓Q7, Age-out promise.** When a child turns 8 before M5-06 ships: portfolio
   mode only, discount, or free hours-tracking tier for that child? Interacts with
   open-call-3 (age-range ICP). Due: GA.
8. **❓Q8, Post-cancellation retention TTL.** How long does a cancelled family's
   data live (recommendation: 90 days, stated at cancel, per M4-12 schedule)? Due: M4-12.
9. **❓Q9, Distress-data firewall (formalizing J-B).** Confirm as written policy:
   distress-flagged exchanges are never inputs to win-back, engagement, or
   marketing systems, ever. (Recommendation: yes, one sentence, signed.) Due: M-R invite 1.
10. **❓Q10, Breach comms threshold.** Below the legal notification bar, what do we
    voluntarily tell families (e.g., a subprocessor incident with no confirmed Homa
    data exposure)? Recommendation: over-disclose with calm specificity; decide the
    line now, not at 2am during an incident. Due: with M4-12 breach plan.

---

*Cross-references: activation failures in 02-acquisition-activation.md, churn/win-back
mechanics in 03-retention-monetization.md, happy-path feature journeys in
04-feature-journeys.md. This doc owns what happens when those journeys break.*
