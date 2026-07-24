# Chat-first onboarding: vision, spec, and modular build plan (v2)

Date: 2026-07-21 · Branch: `claude/new-onboarding-flow` · Status: SPEC v2.3 (council-revised; prod-verified §13; lesson-listen §14; subject-lessons §15)
Owner surface: the free period, from account creation to credit-card capture.

v2 incorporates a 15-agent council review (7 expert perspectives, 5 aha-moment
generators, 3 adversarial judges; ~1.5M tokens of code-grounded analysis).
Section 12 is the findings register. The spec stays deliberately modular: the
founder tunes the sequence by feel; the spec keeps every ingredient swappable.

---

## 1. Vision and the objective

**Onboarding is everything from account creation to credit-card capture.**
Not one sitting: the mom may do five minutes, leave, come back, do an hour,
leave again. Re-entry is a first-class surface, not an edge case.

During the free period three things happen at once: the user learns the
product, the product learns the user, and the user is showered with value.

**The only metric that matters:** when the credit lockout appears ("this
week's makings are used up, subscribe to keep going, or they refill Monday"),
does she pull out the credit card? Every beat in this spec carries a one-line
justification of its contribution to that moment, and anything that cannot be
justified that way is decoration.

The five jobs (unchanged from v1): delightful context capture, value
throughout, onboarding-as-tutorial, mobile-first chat-centered UI, top-tier
anti-slop craft. Plus, now explicit: **habit installation.** The lockout only
converts if it interrupts a rhythm. The free period's real work is installing
the loops (section 6.4) whose continuity the subscription buys.

### Decisions locked in session

| Decision | Choice |
|---|---|
| Chat engine | The real eve agent, with a pre-warmed deterministic welcome (2 short copy-gated lines render instantly client-side while the kickoff round-trips; the model's personalized opener streams as beat 3) |
| Checklist | Deterministic loop, model bookends. Rendered as a focused takeover (reuses ChecklistStep), with a live receipt card in the thread |
| Account | Before the chat. The existing account step stays first |
| Generation beats | Async delivery: Homa starts the build, the turn ends with an honest promise card, the artifact lands as a new transcript card when ready |
| Rollout | `HOMA_CHAT_ONBOARDING` flag; old flow intact |

---

## 2. Architecture (amended by the engineering review)

### 2.1 Flow

```
/onboarding
  parent step (existing, unchanged)
    -> chat phase: full-height chat, Homa opens
         sitting 1 (section 6.1) ... exit ramp
    -> the free period continues in /app chat (same session, same mode)
         re-entries, daily loops, ambient beats (section 6.2-6.3)
    -> the lockout (section 7) -> card capture -> paid state
```

### 2.2 Onboarding is a family state, not a page

No `web-onboarding` channel. The eve channel's auth walk stamps attributes on
every request; extend it: the membership query joins `families` and stamps
`attributes.onboardingActive = 'true'` while onboarding is incomplete
(`profile_completed_at` null OR `families.context.onboarding.state != 'done'`).
`onboarding-mode.ts` keys off `channel === 'web' && onboardingActive`.

Consequences, all load-bearing:
- The mode follows her. If she abandons `/onboarding` and opens `/app` three
  days later, the same instructions pick up where the family record says she
  is. Drip re-entry links point at `/app`, always.
- Zero client trust: the flag derives from DB truth, survives refresh,
  devices, and the 4am session rotation.
- Durable stage store: `families.context.onboarding =
  { state, beatsDone[], checklist: {childId: status}, updatedAt }`.
  Derivable stages (kids exist, answers count, report row) are computed;
  only non-derivable facts (tutorial beats fired, aha beats delivered,
  paywall shown) are written. The `onboardingState` context line renders
  both, one line, e.g.: `Onboarding: basics done · kids 2/2 · checklist Mia
  done, Leo 12 answered · report Mia scored · beats T2 T3 · paywall not shown`.

### 2.3 The card contract v2

Every card kind specifies three renders: **active, spent, error.**

- Active: the newest card with no user message after it (snap-card rule).
  Carries `shadow-md`; only the active card may have button-shaped children.
- Spent: collapses to the MemoryChip receipt grammar (`rounded-pill
  border-sage/30 bg-sage/10`, sage label + detail): "Added · Leo, 6",
  "Questionnaire done · 41 answered, 3 skipped". Spent checklist receipts
  tap through to the report, never back into the questionnaire. Nothing in
  scrollback looks pressable.
- Error: reassure-then-fix in `text-body`, never danger red ("That answer
  was not saved. You can answer it again."). Retries queue silently and
  flush before scoring. Danger tokens are reserved for account-level failure.

| kind | Active render | Backed by |
|---|---|---|
| `onboarding_checklist` | live receipt card in thread (name chip, "about N min left", hairline bar) fronting the focused takeover | `/api/map/answer` + queue from `nextChecklistItem` |
| `kid_setup` | name + birthday (single tap-friendly control, not three dropdowns) | `signup_add_child` (generalized) |
| `family_setup` | call-you name + state chip + quiet timezone confirm | `signup_set_family` (generalized) |
| `tag_pick` | TagInput chips, prefillable from her own words | `save_onboarding_extras` |
| `panel_door` | PlannerCard grammar: tinted icon tile, title, one Open pill; doubles as reopen receipt | the SidePanel chassis |
| `promise` | icon + "arriving tonight/tomorrow" + what it will contain | async generation and B-tier starts |
| `learning_receipt` | the endowment recap at the lockout (section 7) | server-composed counts |

Rhythm law: at most one card per Homa turn wherever possible. Beats 2-3 risk
three form cards in a row; conversation must separate them, and Homa never
narrates a card's fields ("now your family name!"): cards appear, her voice
is reserved for reactions and feelings.

### 2.4 The hidden-directive contract (new, required before any client code)

Client-sent machine messages (kickoff, resume kickoff, checklist completion)
use one marker grammar: a user message reading
`[[homa:onboarding kickoff]]` /
`[[homa:onboarding checklist_complete childId=... answered=41 skipped=3]]`.

1. **Rendering**: a shared `isHiddenDirective(text)` returns null-bubble in
   both the onboarding surface and `/app` transcript building.
2. **Persistence**: `persistCanonicalMessage` marks matching web user rows
   `visibility='internal'` (recall and `fetchChatHistory` already filter to
   family), so scrollback, recall, and the founder console stay clean.
   Rows still persist: turn-recovery matches against them.
3. **Send lane**: `QueuedChatMessage` gains `kind: 'parent' | 'directive'`.
   Directives never string-join with her words: they wait for idle and send
   alone; the flush sends at most one directive turn, then joins parent
   entries as today.
4. **Kickoff idempotence**: save the session id on the first stream event
   (not only onFinish), and guard the kickoff behind no-live-events +
   no-persisted-onboarding-rows + a localStorage flag keyed by familyId.

### 2.5 Checklist geometry (resolved)

The checklist is a **focused takeover**, not an inline card: `start_checklist`
mounts the existing ChecklistStep experience full-height (chat recedes
behind). That component encodes six dated founder corrections (fixed-height
no-jump card, 140ms chip flash, kicker consolidation, undo naming, time-left
framing, kid's name in every question); re-rendering it inside a 26rem chat
card would re-fight settled battles. The transcript holds the live receipt
card, which becomes the spent receipt on completion, and is exactly what a
returning mom sees next sitting. Exiting the takeover is safe by construction
(every tap already saves). The card is a pointer, not a snapshot: it hydrates
position and counts from `GET /api/map/state` on every mount, so device B and
post-rotation resume work from map state, never transcript reconstruction.
`start_checklist` is idempotent (re-invocation returns the remaining queue).

Framing (ICP-corrected): "we can do a few and stop whenever, even five tells
me a lot", with the measured ~5 minutes per kid as the ceiling, never
"15-ish minutes". The rail labels count value earned ("already learned 6
things about Mia"), never N of 41. Skip microcopy: "Skipped. Never counts
against her."

### 2.6 Generation delivery (resolved: async, never in-turn masking)

Eve is one-turn-at-a-time: while `create_printable` runs, no model text can
stream and her sends queue. "Masked by conversation" is therefore delivered
by the materials-lab/agent-jobs shape: Homa starts the build, **the turn
ends** with a promise card ("Mia's dinosaur page is being drawn, a few
minutes"), the conversation stays fully live, and the finished material
lands as a new transcript card with a soft entrance. This also makes the
one-generation-per-sitting cap cheap to honor, and it lets a creation aha
start early in the sitting without blocking anything (see 6.1 variants).

### 2.7 Panel chassis (resolved)

One `SidePanel`, geometry and motion from `ProgressDetailPanel` (the fit
donor): mobile bottom sheet `max-h-[78dvh]`, rounded-t `radius-xl`, stone
grabber, scrim `rgba(51,42,33,0.42)`, Escape + scrim close, focus trapped,
`@starting-style` translate entrance, `motion-reduce` opt-outs, chat visibly
peeking above so the conversation is never gone. Desktop: right sheet
`min(440px,92vw)`. The planner canvas comes down to this chassis during
onboarding; full-screen takeover is reserved for the later app shell.
PlannerCanvasPanel additionally gets a board skeleton (its bare-text loading
state is below the bar).

### 2.8 Storage, resume, handoff

- The onboarding chat uses `/app`'s storage key (`homa-chat-${userId}`) and
  fetches server history, so same-day handoff is literally the same session,
  device B shows the conversation so far, and episode continuity is
  automatic (same `web:${principalId}` thread key). No titling work needed:
  the handoff marker is the next day separator, and that is the intent.
- The account step navigates to the chat phase only after `attachAuthUser`
  returns (avoids the missing-family fallback), fires the kickoff at submit
  success so the 3-8s cold path (function cold start + auth walk + blocking
  persist + context assembly + TTFT) runs behind the entrance transition,
  and a warm fetch to the eve route fires when the account step mounts.
- Onboarding stall/recovery copy gains the reassurance clause ("your answers
  are saved") because a first-session mom has no history proving recovery.

### 2.9 Tools

As v1 (generalize `signup_set_family`/`signup_add_child` with a web
resolution path: family from auth-stamped attributes, never a relaxed SMS
gate; add `start_checklist`, `save_onboarding_extras`, `score_child_report`
as thin wrappers over existing store functions; `createReport` is already
advisory-locked and idempotent). New: every costed making tool calls one
shared deterministic pre-flight (section 7.4). All new tools ship with
`TOOL_STATUS_LABELS` and worked-for STEP_REGISTRY entries in the same PR
(section 8.2), plus positive and adversarial-negative routing fixtures for
onboarding-mode (an onboardingActive session loads it; a completed family's
session must not).

Honest budget: the spine is ~12-20 model turns, roughly $0.40-0.90 per
single-kid family at gateway rates; each extra kid adds 3-4 turns; each
generation beat adds $0.10-0.50. The deterministic checklist loop is the
single biggest cost decision in the spec; defend it.

---

## 3. Context inventory

Unchanged from v1 (3.1 captured today, 3.2 opportunity list) with the
capture principle: forms for facts, conversation for feelings. Amendments:

- Time zone: captured silently from the browser with the kickoff payload,
  confirmed with a light touch inside the family card. Never "I detected
  your timezone" (reads as surveillance to a skeptic).
- **3.3 minimum viable context gains a fifth non-negotiable: one rehearsed
  debrief with receipts rendered** (section 6.4, H1). A session may not end
  "complete" with the keystone behavior never performed once; that is the
  state 31 of 36 live families are in.

---

## 4. The aha catalog (modular, swappable)

Insertion rules (v1, plus council additions): an aha beat interrupts only at
section boundaries, never mid-checklist-run; every beat ends with the way
back; **one generation-class beat per sitting** (was: before the report);
every dark-flag beat has a scripted honest fallback; every forward promise
must be backed by a verified scheduled row or not made (tool-honesty);
memory chips fire sparingly, on things she volunteered.

### 4.1 Tier 1 and 2 (v1 catalog, retained, with fold-ins)

A1-A7 stand as specced in v1. **The B-tier's maturity labels are corrected
by the production verification (section 13): most of what v1 called dark is
live and running.** Corrected B-tier status:

| # | Moment | Actual prod state (2026-07-21) |
|---|---|---|
| B1 | Subject lesson build | **PROVEN 2026-07-21** by a full end-to-end test build (section 15): 158 seconds, correct frontier target, real lesson + brand-correct worksheet, both lifecycle events fired. Still flag-dark in prod |
| B2 | Curriculum studio (agent jobs) | **LIVE**: one real family's 22-stage curriculum job completed 2026-07-20; runner ticking |
| B3 | Morning research brief | **LIVE, daily**: 124 done runs, briefs sent to 38 families, last today |
| B4 | Lesson listen | **LIVE and proven**: first real lesson 2026-07-21 (Alessa, 13.8 min, 4 segments, review in ~15 min, founder verdict "amazing"). Review quality is excellent. **But the progress fan-out wrote nothing** (section 14) and tone notes did not run |
| B5 | Handwritten card | **LIVE since 07-11**: 38 sent to 37 families. Nearly every claimed family already gets one |
| B6 | SMS / contact card | **LIVE**: 433 SMS conversation messages, 52 number links, 31 contact cards sent |

Judge-approved fold-ins:
- **A1** uses friend language, never placement language ("four is such a
  funny age", not "kinder-first-grade territory").
- **A3** absorbs *In her own words*: material titles and plan rows reuse her
  stored phrasing verbatim, and Homa says so once, quietly.
- **A5** absorbs *One fact reorients everything*: the named curriculum
  persists (atlas profile + remember) and visibly re-shapes later artifacts
  ("I matched this to where Level 2 would have Mia about now"); alignment
  claims come only from atlas content.
- **A6** capped: one chip per volunteered fact, never a chip per line.
- **B3** absorbs *The noticing note* as its preferred day-one content: the
  first morning email plays back what Homa learned about HER family, not
  topic research. One morning send per family, ever, merged.
- **C1-C4** stand; C3 amended: on mobile the rail stays the hairline +
  value-earned counter (resurrecting the full rail on phones re-litigates a
  settled simplification).

### 4.2 New: in-session moments (D-series)

| # | Moment | Size/tier | The experience, and the guardrail |
|---|---|---|---|
| D1 | **The question under the question** | small/live | At the reveal, Homa names the worry under her focus answer ("at 6, most moms asking that are really asking whether it is a problem or just timing") and answers it plainly. Converts the report from data into counsel, which is what the subscription sells. Highest-risk copy in the flow; full gate chain; absorbs *Something you didn't say* as alternate content (one honest map-to-interest connection, silence if none exists). |
| D2 | **Test me** | small/live | "Ask me anything about your kids." Recall answers with receipts. Gated on the 3.3 context bar so it cannot embarrass itself; the honest miss becomes a capture. Re-entry variant (*Try to stump her*) is a timing parameter, ship one. |
| D3 | **Tell her she's wrong** | small/live | Right after the first kid card commits, Homa invites correction; the chip and profile visibly update. Kills the fear that a wrong answer is permanent. Never stage a fake error. |
| D4 | **Complain at the calendar** | small/live | With the month plan on the canvas, one pointed question ("which day is always chaos?") and the board rearranges via plan-edits. Her complaint was a command. |
| D5 | **Ask her what Mia actually knows** | small/live | "You can interrogate this": free-form Q&A over the map via explore_child_map, answers cite real evidence, never invented coverage. |
| D6 | **The blank check** | small/live | Post-report: "ask me for anything for Mia", three deliberately weird seed chips. The lesson: there is no menu. Honest fallbacks for real misses teach T10. |
| D7 | **Not quite? Say so** | small/live | The first worksheet ships with "one revision is on me". Materials are a conversation, not a vending machine. Cap: one free revision, then the remember fallback (itself a delight). |
| D8 | **The muffin ledger** | small/live | Day 2: "tell me about today the way you'd tell a friend." The receipt reframes her ordinary Tuesday as school (45 min reading, 30 min hands-on math). T6 sharpened into an aha; the rehearsal beat (6.4 H1) is its in-session seed. |
| D9 | **The skeptic brief** | small/live | "Want a version of this you can forward to your husband, or your mother-in-law?" Emailed to her own inbox, framed for the doubting co-decider, who is frequently the credit-card co-decider. Printable one-pager and forwardable footer are v2 pending a founder call on the viral link. |
| D10 | **Never-compared promise** | small/live | At the multi-kid branch, once: "I measure each kid against their own last month. Never against each other." Verbalizes an existing law; subscription-decision material for exactly the multi-kid families with the highest willingness to pay. |
| D11 | **Chips already filled in** | small/net-new-small | She rambles about Mia; the tag_pick card arrives pre-filled from her words, removable. Talking to Homa IS data entry. |
| D12 | **Skips-don't-count receipt** | small/net-new-small | The skip microcopy plus Homa's honest completion line ("you skipped three, that's fine, the map leaves those edges open"). Trust at the exact moment moms expect to be graded. |
| D13 | **The family through-line** | small/live | After kid 2's checklist, one shared-strength family pattern, "both/your family" framing only. Adversarial eval required: when the honest pattern IS a contrast, Homa declines. 2+ kids only. |
| D14 | **A letter to your kid** | small/live | At the reveal, a short printed letter addressed to the child, only report-supported claims, read at bedtime, photographed for grandparents. Cheapest tear-jerker on the board; gate the template hard. |
| D15 | **The schoolhouse founding** | medium/live | Name the homeschool together; a frameable founding poster (name, est. 2026, state, kids as illustrated characters) lands in the binder. Generation-class: post-report or day-1 closer. "Many families name their school", never "legally registered". |
| D16 | **Hand her the phone: the first hello** | medium/net-new-small | Homa greets the kid by name, one true thing, one playful working-edge challenge, an illustrated badge. Child-directed voice needs its own review pass; the tap posts nothing to child_answers. The kid asking to do it again tomorrow is the habit engine. |
| D17 | **Birthday on the board** | small/net-new-small | The month plan renders with "Mia turns 7" in the right week, computed client-side, render-only. Moms screenshot this. |
| D18 | **Composer that knows Mia** | medium/net-new-small | Suggestion chips name her family minutes after the gather, refresh on capture milestones and resume. The chips seed the exact phrasings she will type daily after subscribing. |

### 4.3 New: ambient and re-entry moments (E-series)

| # | Moment | Size/tier | The experience, and the guardrail |
|---|---|---|---|
| E1 | **Kept-your-place return chip** | small/net-new-small | The re-entry survivor. One line ("we were partway through Leo's questions") plus one chip: "Pick up Leo's questions · 12 left". Greeting content rules folded in from the merged cluster: at most one applied memory echo, used not recited; cite only what recall/find_materials actually return (no-invented-work eval); an optional single tally sentence. Never a recap wall, never silent mid-form resume. |
| E2 | **Half-report postcard** | medium/net-new-small | She bails 18 answers in; that evening: "from Mia's first 18 answers I can already see she's solid on counting... about 6 minutes of taps left to see the whole picture." A cliffhanger made of her own kid's data. Positives only; supersedes the generic loop-back nudge for chat families. |
| E3 | **The rules, already read** | small/net-new-small | At checklist completion: "while you were answering, I looked up what Pennsylvania actually asks of you." **The data layer already exists in prod**: `state_requirements` (51 rows: regulation level, compulsory ages, notification/assessment flags, pathway, verified sources) with a read-only module (`lib/map/state-requirements.ts`) already powering the report's state card. The build shrinks to the chat beat, an agent-facing read, and the hold-until-hands-free timing. Tees up T6 in heavy-regulation states. |
| E4 | **Tomorrow's morning basket** | medium/dark-or-async | The consent-based nightly ritual: one PDF, a page per kid at each kid's edge, ordered for the morning. Night-one kickoff variant: *Stocked binder* (2-3 overnight printables revealed at re-entry). Email form at 7am her time with one line of why. One merged morning send per family; HTML path by default; auto-stops at lockout, named honestly. The strongest pull-out-the-card behavior on the board. |
| E5 | **Overnight crosswalk** | medium/dark-or-async | "I lined Mia's map up against TGTB Level 2 last night... expect friction at unit 5 in about three weeks." Atlas facts + map facts only; forbid precision the atlas lacks; behavioral eval mandatory (a wrong unit claim burns trust). |
| E6 | **Quiet hours ledger** | small/net-new-small | Sunday email: "your first week: 6.5 hours across reading, math, and PE, all on the record if your state ever asks." Exact math in code; zero-hours weeks get silence, not guilt. In heavy-reg states, the moment the subscription starts feeling like insurance. |
| E7 | **The before picture** | small/live | "Take a picture of Mia's handwriting today, exactly as it is." Dated receipt, kept forever, week-8 side-by-side promised. Opens a loop only a subscription keeps open, and she knows it. The promise must have a real owner and monitoring. |
| E8 | **The credit receipt** | medium/net-new-small | Mid-free-period, no ask: "so far your free makings made: Mia's report, 4 worksheets, her character art, a month plan." Pre-frames the lockout as "keep this factory running". Deterministic counting; model only voices it. |
| E9 | **The co-op gift pack** | medium/live | The beloved page, five times, each starring a different co-op friend's name, one PDF, physically distributed at Thursday co-op. 5-8 generations: day 2+, its own budget line, candidate first visible credit spend ("this will use about half of this week's makings, worth it?"). Footer link needs a founder call. |

### 4.4 New: at-paywall moments (F-series)

| # | Moment | Size/tier | The experience |
|---|---|---|---|
| F1 | **The family file** | medium/net-new-small | The lockout opens with the endowment, not the gate: kids' names with scored maps, the memory count with two quotes in her own words, artifact thumbnails with the kids' names, hours banked, the plan in motion. Then the honest choice. Folded in from the merged cluster: the itemized counts layer, the thumbnail wall, and the load-bearing "nothing is hostage" line (binder and report stay readable while locked, which must be true and must be in the ruling). This is where every other moment compounds; spec it WITH the wall, not after. |
| F2 | **Locked but not idle** | medium/net-new-small | She chooses to wait; Homa does not go dark. Refill morning: "your credits are back. While we waited I kept thinking about Leo's reading." Composed from zero-cost tools only, honestly. The most directly measurable conversion moment in the set. |

### 4.5 Bench (parked, judged viable but not first-wave)

Section breather lines · Answer odometer · Second look · Finished anyway ·
Hand her the dread list · The family field guide (post-PMF deluxe of B3's
noticing content) · Shelfie (A5 photo-input variant, gated on an eval set) ·
The you-are-here trail poster. Cut outright: bedtime awareness, a-note-from-
you-delivered-tomorrow, bookshelf noticing.

---

## 5. Tutorial catalog

Every unit is show-not-tell: a real action in the session, never a tour
bubble.

| Unit | She learns | Delivery in chat |
|---|---|---|
| T1 | Chat is home base | implicit: the whole onboarding IS this |
| T2 | Materials and the binder | A3, then a `panel_door` opening the binder showing it saved (H3's first rep) |
| T3 | The planner | A7 canvas + D4, and one guided check-off (H4 rep 1, the sage+gold moment) |
| T4 | Progress, and how Homa tracks | A2 + C4: explain the model in one short beat |
| T5 | How Homa learns | A6 + D2 "test me" |
| T6 | **Logging (promoted to mandatory)** | the sitting-1 rehearsal (6.4 H1). It was the only unit installing a repeatable behavior and v1 had it deferrable; that inverted the habit priority |
| T7 | Photos | `ask_for_photo`; ties to A4 and E7 |
| T8 | Channels | phone capture reframed as tomorrow's promise ("want me to text you in the morning?"), the highest-leverage single field in the free period (brief-reached families: 9 of 16 multi-day vs 0 of 18 unreached) |
| T9 | **Lesson listen** | see 5.1: promoted from a deferred door to a primary day-2 module |
| T10 | Limits and correcting her | D3 + honest fallbacks throughout |

The handoff composer seeds 2-3 tappable starters so the empty box is never
a blank stare (D18 takes over from there).

### 5.1 Lesson listen (T9), rewritten from the first real lesson

The 2026-07-21 recording (section 14) changes this unit's status from
"offer it if there's room" to **one of the strongest modules in the
catalog**, for a reason the v1 and v2 catalogs both missed.

What the review actually gave the parent was not an assessment of the
child. It was **the first time anyone had ever watched her teach and told
her she did well.** The transcript is a genuinely hard lesson: fifteen
minutes of trying to start, a child who will not sit still, repeated
prompts, an audible "nope, that's the wrong answer". What came back led
with "Story worked hard today, and there were sweet bursts of
encouragement", then named her own moves back to her: the reassurance she
opened with, turning the coins into a "magic coins" game, praising small
successes immediately.

The ICP's defining fear is being judged as a teacher. This is the only
module in the catalog that answers that fear directly, with evidence, in
her own lesson. That makes it a conversion asset, not a feature tour.

Design consequences:
- **It is a day-2+ module, never sitting 1** (it needs a real lesson to
  exist). It is the strongest "come back tomorrow" hook available: the ask
  is "record even five minutes of your next lesson", which costs her
  nothing and no typing (the ICP's stated bail risk).
- **The ~15-minute processing is a feature**: it is the canonical async
  promise beat (2.6). She records, closes the phone, and the review lands
  as the re-entry surprise. It should be surfaced through the promise card
  plus the day-2 re-entry greeting.
- **Lead the review with what she did well.** `whatWorked` is the payload;
  the child's moments are the supporting material. Homa's chat framing of
  an arrived review must follow the same order.
- **It is H1's audio twin.** The evening debrief (H1) and lesson listen do
  the same job (turn a real day into receipts) at two different efforts.
  Offer recording as the zero-typing path for the parent who will not type.
  Both are habit loops, so per 7.1 **neither is ever metered**, even though
  a lesson costs real money (transcription x N segments + synthesis +
  tone). Flag the true per-lesson cost into P2.
- **Honesty gate**: until section 14's defect is fixed, Homa must not
  promise that recording moves the child's progress. She may promise the
  review. Packaging the current behavior with a progress claim would ship
  a false promise to every family.

---

## 6. The free-period arc

### 6.1 Sitting 1 (target: report by minute 12, clean exit by 15)

Priced at 2 kids (52% of live families). Every beat boundary from minute 10
is a designed stopping point; every capture persists on tap.

| Min | Beat | Notes |
|---|---|---|
| 0:00 | Pre-warmed welcome (2 lines, instant) + kickoff fires | first bubble in <400ms; model's personalized opener streams as line 3 |
| 0:40 | Micro-gather: call-you name + state chip + quiet tz confirm | max 2 fields 1 chip row; family name defaults, editable later |
| 2:00 | Kid 1 card, one interest question in conversation; **A1 fires** | first aha no later than minute 4; D3 correction invite here |
| 4:30 | Checklist takeover, kid 1 | stop-anywhere framing; rail counts value earned; D12 |
| 10:00 | **The reveal** (A2, staged per 8.3) + D1 | the sitting-1 non-negotiable |
| 12:00 | ONE follow-on beat: default A7 planner (instant) + D4 + first check-off (H4 rep 1) | A3 becomes an async promise ("a dinosaur page will be in your binder tonight"), doubling as re-entry bait |
| 13:30 | **The rehearsal** (H1 rep 1): "tell me one thing you two did today, even something tiny" → receipt fan → one specific reaction → "when does your school day usually wind down?" → evening check-in visibly opts ON at her hour | mandatory; eval asserts the tools actually fired |
| 14:30 | Exit ramp: kid 2 default-deferred with a named promise ("Leo's questions will be ready tomorrow"), morning-text offer (T8), composer open | promises only where a scheduled row exists |

Feel-test variants (founder judges by feel, the spec carries both): V-A
"report-first" (the table above); V-B "creation-first" (A4 coloring page
async-started during the gather so an artifact lands mid-checklist; the ICP
persona wants a holdable thing in the first five minutes, the PM wants the
report unblocked; async delivery makes both possible, feel decides).

### 6.2 Re-entry playbook (by absence, always in-conversation, never a summary screen)

| Gap | She sees |
|---|---|
| <1h | Silent resume; checklist restores the exact question; no greeting |
| 1-8h | One line + next step with honest time cost ("12 answers left, about 3 minutes"); never a recap |
| Overnight | Day separator, then value produced in absentia leads (the promised worksheet in the binder, the noticing note); then E1's one-chip resume |
| 2-6 days | Stage-keyed drip email (beat-keyed audiences; E2 for mid-checklist; artifact-led for revealed-never-returned), deep-landing in chat with the artifact rendered |
| 7+ days | One plain-text founder note ("what got in the way?"), then silence per the standing caps |

Mechanics: the resume kickoff is a hidden directive firing when
onboardingState is incomplete and the gap exceeds ~30 minutes or the session
rotated; busy line "picking up where we left off…"; Homa opens with state,
not greeting flourish; zero gap-length guilt, ever.

### 6.3 The day-by-day arc (account → lockout)

- **Day 1 evening**: close-the-loop prompt referencing the sitting-1
  artifact by name (H1 rep 2). The measured cliff this attacks, re-verified
  in prod 2026-07-21: 5 of 48 claimed real families have ever produced a
  loop-back event.
- **Day 2 morning**: first brief with B3's noticing content; kid 2
  checklist re-entry (the primary day-1-3 hook). The brief machinery is
  LIVE and running daily in prod (124 done runs, 38 families reached); the
  change here is only the seed gate: adopt PMF-201 for chat families,
  killing the 20-hour + next-weekday delay (verified still present at
  `lib/tasks/store.ts:89`).
- **Day 3-4**: the compounding proof: after her second debrief, auto-offer
  worksheet 2, naming the specific detail it used ("it leans into what you
  told me"). Requires ≥1 prior debrief so the causality is real. This is the
  moment the habit converts from chore to investment.
- **Day 5-6**: after the 3rd distinct-day loop, the low-balance pill may
  become visible for the first time (7.2); visibility precedes enforcement
  by ≥48h.
- **Day 5-7**: weekly note 1 (concierge-drafted per PMF-303 until
  automated): additive counts, endowment statement. The 2nd note is the
  strongest conversion anchor on record; it must exist before the wall flips
  (or the pre-declared fallback anchor applies: report + kept-artifact count
  + brief-reply streak).
- **Week 2+**: rhythm; the lockout arms per 7.3.

### 6.4 The habit ladder (H1-H5, each gets exactly one guided first rep in the arc)

| H | Loop | First rep | Why it converts |
|---|---|---|---|
| H1 | **Evening debrief** (keystone): plain sentence → receipt fan (logged hours + progress move + memory chip) → one specific reaction | sitting 1 rehearsal | The only loop that compounds into stored value; stored value is the only honest answer to "why keep paying" |
| H2 | Morning-brief reply | day 2 | The strongest measured return signal in the fleet |
| H3 | Keep-to-binder | the make-something beat ends with a guided Keep | kept-artifact is the strongest retention correlate |
| H4 | Planner check-off (the sage+gold moment) | beat 12:00 | the daily five-second touch |
| H5 | Weekly-note read | promised by name and day in the exit ramp | the conversion runway |

Receipt fan spec: chips stack under her message within ~400ms of each tool
result, max 4, MemoryChip styling, each naming its artifact exactly; chips
render individually as tools resolve (immediacy beats tidiness); then exactly
one Homa line reacting to the CONTENT, never generic praise. Consistency
mechanics: no streaks, no resets, no absence framing; the picture filling in
and additive counts only. The daily cadence rides the tasks dispatcher
(per-family local hours), never the drip (a once-per-7-days fall-off net,
structurally incapable of carrying habit cadence). Voice ramble routing: one
40-second voice note must fan out to hours + journal + memories in one pass;
test explicitly.

---

## 7. The credit economy and the lockout

**Current wall state, verified in prod 2026-07-21 (correcting v1/v2's
"exists dark")**: the $19 door wall is ENABLED in production. `wall.viewed`
has fired for 3 real families (last 2026-07-19) plus sandbox tests; one
sandbox `wall.checkout_started`; zero trials started. 45 of 48 claimed real
families are `billing_exempt`, which is why exposure is rare, but any new
non-exempt family hits the door wall today, including at the first chat
send (`chat-client.tsx` blocks the send and opens the modal when `wall` is
non-null). **Phase-1 hard requirement**: chat onboarding must bypass the
door wall for `onboardingActive` sessions (or chat-onboarded families are
walled at Homa's first exchange, inverting the entire design). The interim
rule until the P1 ruling lands: onboardingActive families never see the
door wall; what they see instead, and when, IS the P1 decision.

Design principle (CRO + behavioral + PM consensus): the meter exists to
create one earned conversion moment, not to police usage. Meter anxiety
suppresses exactly the abundance the free period needs.

### 7.1 Two-pool economy

- **Never metered, on any channel, forever**: conversation, planner edits,
  progress, report views, memories, journaling, logging, photo reading.
  This is the context engine and the habit loop (H1-H5 all ride free).
  Charging for the debrief would punish the behavior that makes the product
  smarter.
- **Metered: makings** (visible artifact creation): worksheet, coloring
  page, lesson+worksheet, month plan; picture book = 3. Flat legible whole
  units, never credit arithmetic. The noun ("makings" vs alternatives) goes
  through the copy gates once and is the only name used anywhere.

### 7.2 Allowance and visibility

- Onboarding exempt: sitting-1 generations never touch the meter (invisible
  hard cap ~4 generations, enforced in the same predicate, not prose).
- Taper: week 1 = 10, week 2 = 10, week 3+ = 3, refilling Monday 7am family
  time (the homeschool planning rhythm; the refill gets a ritual slot). An
  engaged family hits the lockout day 3-6 of week 1-2, habit forming, value
  memory hot. Unused makings never roll over (stated once, plainly).
- Visibility state machine: HIDDEN (balance > 3) → QUIET PILL at the
  composer ("3 makings left this week", no color escalation, no countdown)
  → LOCKOUT (zero balance + a making requested). One honest disclosure at
  the handoff ("every week you get a fresh set of makings. This first
  stretch is on me."), no number. No pill during onboarding, ever; never for
  billing_exempt/trialed/sandbox families. Balance visibility precedes any
  enforcement by ≥48h.
- Shadow metering starts in **phase 1, dark**: per-family consumption
  computed from model_usage + ACTION_COSTS, surfaced only in /admin with a
  predicted lockout date. This answers P2 with data and sizes the refill
  before anything is visible to families.

### 7.3 The lockout moment

Arming rule (both must hold):
(a) ≥3 LOOP_BACK_EVENTS on ≥2 distinct days (computed from the same
signals.ts lists the console uses), and (b) she is mid-intent on a making
with zero balance. Floor: never before day 5 AND first weekly note
delivered; early exhaustion soft-degrades ("that one's queued for Monday")
instead of walling. Ceiling: if credits never run out, a value-anchored ask
still fires after the 2nd weekly note (a lockout that never appears is a
conversion moment that never happens). Never-fire: during onboarding,
mid-checklist, mid-aha, near regression-toned content, at session
boundaries, on login, after a debrief; at most one lockout message per
session.

The beat (Homa in-voice, inline card on the .wall-card recipe, never a
modal ambush):
1. "Mia's fractions worksheet is ready to make."
2. "This week's makings are used up. They refresh Monday morning."
3. **F1, the family file**: the endowment recap, her own week enumerated.
4. "Membership makes makings unlimited: $19 a month, and your first 30 days
   are free."
5. Two equal-weight choices: [Start your 30 free days · then $19/mo] (the
   existing monthly Payment Link, untouched plumbing) and [Wait until
   Monday], which **queues the making**: Homa makes it at refill and
   notifies her (F2), converting the wait path into a guaranteed re-entry
   and a second conversion moment.

Post-checkout: land back in the same chat; Homa acknowledges and immediately
delivers the queued making. The first paid-state moment is receiving, not a
receipt. The composer never disables; report, binder, planner stay readable
while locked ("nothing is hostage" must be true). SMS at zero balance states
the fact and sends the web link, never a price. Copy bans: no tutor or
competitor dollar comparisons (endowment is the anchor), no "you ran out",
no countdowns, no red. Second-lockout pattern note at most once per family
lifetime.

### 7.4 Enforcement (v1 is a predicate, not a ledger)

`makingsRemaining(familyId)`: allowance for the family's week minus a count
of metered creation rows in the current refill window; exemptions in order
(billing_exempt → trial_started_at → sandbox); fails open on read error
exactly like the wall. Called inside each making tool's execute BEFORE
generation starts (D1 grace: in-flight work always completes); at zero it
returns a typed `out_of_makings` result carrying refillAt and weekMade[] so
the model relays facts, never invents them. No credit_ledger, no grant jobs:
the 08-design ledger is the post-revenue graduation path at 20+ payers.

### 7.5 The ruling package (P1, one dated §5 append, before any phase-3 code)

The credit lockout supersedes four recorded decisions, in one entry:
paywall-door-placement (doors become the lockout for chat families),
report-lock-four-open (the report stays fully free in this flow), **D2**
("meter is internal-only" becomes parent-visible at low balance only, flat
units, preserving D2's spirit), and **T1** (free period = capped no-card
makings + unlimited conversation; the 30-day card trial remains uncapped, so
the paid state is the abundant one and post-conversion never feels worse).
Pre-registered bars in the same append: lockout_viewed→checkout_started
≥15%; waiters converting within 2 refills ≥10%; suppression guard: makings
per active family within 20% of the pre-meter cohort; kill test: meter off
if suppression >30% while lockout conversion <10% over two weeks. Also note
the accepted trial fail-open leak (re-lock is open D8) and the double-free-
period consequence (first charge ~6 weeks post-signup) as pre-registered,
not surprises. A/B slots in priority order: week-1 allowance 7/10/14; pill
threshold; recap present/absent; queue-the-ask vs plain wait.

---

## 8. The moment-to-moment experience

The codebase already has an incident-hardened waiting language in five
pieces (staged narration in ScoringStep/PreparingStep, the NarrativeBeat
ambient theater, the busyLabel phase ladder, the never-locked composer with
queue semantics, the check-off celebration). This section canonizes it as
law for the new surface; invent nothing parallel.

### 8.1 Wait classes (the complete state inventory)

- **Sub-1s** (chip taps, check-offs, panel doors, undo): same-frame
  feedback; chip fills brand-soft with press scale 0.98 over 120ms; the
  140ms selected flash before the next question swaps; fixed-height cards so
  nothing jumps; optimistic saves, failures queue silently and flush before
  scoring. No spinner, skeleton, or busy label may EVER appear in this
  class. The check-off: sage fill pop + ONE gold star floats up, light
  haptic, only ever triggered by her tap.
- **1-5s** (turn start → first token): 0-300ms nothing new (her bubble
  mounting IS the feedback); at 300ms the bobbing home mark (1100ms cycle,
  never three dots) + "thinking…" fading in over 200ms; at 1s the seconds
  counter joins. The moment text streams, the label unmounts. Intro cadence:
  deterministic welcome beats reveal at ~600ms stagger with the nb-line rise
  grammar; never insert an artificial pause into model-streamed text
  (cadence is a client-reveal trick on pre-written copy only).
- **5-30s** (multi-tool turns, scoring): every executing tool shows its
  TOOL_STATUS_LABELS line; never blank while busy. Scoring is a CARD:
  staged ✓/○ lines at 700ms stagger ("reading Mia's answers…", "checking
  against national benchmarks…"), minimum hold ~2.2s even when the server
  answers in 200ms, "worth the wait ✎" sign-off. The wait IS the value
  narration; never shorten below the floor. "thinking…" is banned between
  checklist completion and the reveal.
- **30-120s** (in-turn builds, where kept): forward-only phase labels
  ("designing the page…" → "writing the page…" → "fixing a detail…" on QC
  fail, never a repeated label); seconds → "about a minute" at 60s → the
  honesty line at 90s ("this one is taking longer than usual, nothing is
  lost"); never raw three-digit seconds. Ambient doodles (nb-float/
  nb-twinkle) are allowed at this class only. Material placeholder: a
  MaterialCard-shaped skeleton at final dimensions, 200ms crossfade on fill;
  if the tool refuses, the skeleton unmounts and Homa's honest fallback text
  is the only trace.
- **Async-hours** (B1/B3/E4/E5, credit refill, C1): the turn ends with a
  **promise card** (icon + arrival window + contents), the receipt; arrival
  lands under the day separator naming the promise it fulfills. Never a
  progress bar for hours-scale waits; promise-then-surprise is the design.

### 8.2 Busy labels and receipts for the new tools

`start_checklist` "getting Mia's questions ready…" · `score_child_report`
"reading Mia's answers…" then "checking against national benchmarks…" ·
`save_onboarding_extras` "saving what you told me…" · `signup_add_child`
"adding Leo…". Ship with worked-for STEP_REGISTRY entries in the same PR
(the fallback is "Worked on it", a silent regression of three documented
incidents). Loading-affordance policy promoted to law: nothing loading
appears before 500ms; anything that appears lives ≥800ms; skeletons only
for known-final-size fills; computed artifacts get staged narration, never
a shimmer.

### 8.3 The reveal, staged (three acts from existing parts)

Act 1: the rail's final check lands (rail-check 200ms, scale 0.6→1), ~400ms
hold, "All subjects placed". Act 2: the scoring wait borrows NarrativeBeat's
writing moment (rotating status lines + the 1400ms hand underline). Act 3:
the report panel slides in; the trajectory line draws itself over ~1200ms
(pathLength dash), endpoint dot pops last, KPI counts up 600ms in mono; only
then Homa's growth story streams, annotating a chart she is already looking
at. Reduced motion: everything settles instantly, order preserved. The chart
obeys the honest-chart laws (one sage line, no red, downward segments never
warning-treated).

### 8.4 Transcript rhythm and card craft

Cards enter with @starting-style opacity 0 + translateY(6px), 200ms
ease-out; never scale from 0. Her bubble: max-w-[76%] soft coral right; Homa
text renders flat; cards are left objects at 26-36rem. The alternating
rhythm is the metronome; one card per Homa turn. Full-dim behind a card only
when it is the live CTA (the snap-card founder rule). Undo/skip are text
links labeled by consequence, never a second pill. tag_pick selected state
is border-brand + brand-soft (solid coral is reserved for actions); chips
min-h-11; answer chips min-h-12, scale order preserved. One playful device
per surface (the checklist owns the Caveat hand-note; the chat gets none;
the report panel may use the band-sky header). Day separators render on
every re-entry; the top-edge past-fade stays.

### 8.5 Streaming, queueing, recovery

Markdown renders progressively with no entrance (arrival is the motion);
block artifacts appearing mid-stream get the shared 200ms rise. She types
during a wait: her bubble renders at opacity-70 with "Sends when Homa
finishes" + "Send now"; directives never join this queue. Recovery order:
silent reconnect (nothing shown) → auto-stop on the 20s/5s/180s triad →
"Reconnecting…" with the bob for up to 240s → success folds in with zero
banner; failure: "Your conversation is safe; that last message didn't go
through." Onboarding adds "your answers are saved" to both recovery lines.

### 8.6 Timing constants (single source of truth)

120ms hover/press · 140ms chip flash · 200ms state/panel/card entrances ·
260ms step mount · 320ms line rise · 550-700ms narration stagger · 800ms
minimum-display floor · 1100ms think-bob · ~2.2s scoring floor · 2.8/4.6s
ambient loops · 500ms loading gate · 20s/5s/180s stall triad · 60s phrasing
shift · 90s honesty line · 240s recovery deadline. Reduced motion: every
loop stops, slides become fades, entrances become instant, labels carry the
meaning. Gate all new motion through review-animations.

---

## 9. Build inventory and phases

### Reused as-is
Everything in v1's list, plus: transcript-days day separators, the
progress-question-card spent grammar, snap-card active-scoping, PlannerCard
reopen receipts, NarrativeBeat, ScoringStep/PreparingStep narration,
chat-suggestions generation engine, the wall plumbing end to end, drip caps/
suppression/unsubscribe, the tasks dispatcher with per-family hours,
log_hours' existing receipt loop, requireFamilyWithActor's cookie-or-session
resolution, resolveInboundContinuity episode threading.

### Updated
- eve channel auth walk: stamp `onboardingActive` (families join)
- `persistCanonicalMessage`: internal visibility for directive rows
- `chat-send-policy`: directive send lane; chat-client: early session save
- `signup_set_family`/`signup_add_child`: web resolution path
- `family-context.ts`: onboardingState line
- `lib/tasks/store.ts` seedKind: kill the 20h gate for chat families (PMF-201)
- `lib/drip/sweep.ts`: beat-keyed audiences (mid-checklist, revealed-never-
  returned, kid-2-pending); build the deferred `link_tokens` table (multi-
  email sequences dead-link without it)
- planner canvas: SidePanel chassis + board skeleton
- message-parts: TOOL_STATUS_LABELS + STEP_REGISTRY + shared card entrance
  + log_hours receipt chip

### Net-new
onboarding-mode.ts · the lean onboarding chat surface (shared parts with
chat-client) · onboarding_checklist receipt card + takeover mount ·
kid_setup/family_setup/tag_pick/panel_door/promise/learning_receipt cards ·
start_checklist / save_onboarding_extras / score_child_report tools ·
hidden-directive module (isHiddenDirective + persistence rule + send lane) ·
pre-warmed welcome · resume kickoff + E1 · receipt fan · shadow metering
(/admin) · makingsRemaining predicate + out_of_makings result + lockout card
(F1) + queue-the-making + refill delivery (F2) · the aha modules per
catalog, each its own small build.

### Phases (resequenced by the council)
1. **Spine walking skeleton + the directive contract + shadow metering +
   the lockout designed dark.** The conversion moment is prototyped (behind
   the flag, unreachable by families) in the same phase the fun beats are,
   so feel-testing includes the moment that matters, with cost-per-family
   reported alongside delight. Includes the rehearsal beat and E1 resume.
   **Also phase 1, non-negotiable: the door-wall bypass for onboardingActive
   sessions (section 7's current-wall-state note), because the door wall is
   live in prod and fires on the first chat send for non-exempt families.**
2. **The arc**: day-1 evening prompt, PMF-201 seed change, beat-keyed drip,
   D-series in-session modules, panel chassis, D18 chips.
3. **The credit wall live**: ruling package first (7.5), then the predicate,
   pill, lockout, queue, refill (F1/F2). Weekly note (concierge) sequenced
   ahead of the flip, or the fallback anchor pre-declared.
4. **Net-new ahas**: E4 basket, E5 crosswalk, E3 state table, C1 events
   scout, C2 picture book, D16 kid hello, E9 gift pack.

### Process gates
As v1 (finding-unknowns, exploring-ui-directions, copy gates on every
string, homa-uxui-reviewer on recordings, review-animations, behavioral
evals) plus: routing fixtures for onboarding-mode (positive + adversarial-
negative), the no-invented-work re-entry eval, the sibling-contrast decline
eval (D13), the tools-actually-fired rehearsal eval, and the voice-ramble
fan-out test. Guards per push: check:isolation, check:events (all new
beacons registered), VERCEL=1 eve build + check:eve-stream-duration.

### Instrumentation (the fragmented funnel)
Every `chat.beat_viewed`/`beat_completed`/`aha_fired`/`tutorial_done`/
`rehearsal_completed` carries `sitting_index`, `entry_vector` (direct |
resume_email | drip_email | sms | push), `gap_hours`, and `wait_ms`; per-
family computed: time_to_first_aha, time_to_report, beats_by_sitting,
credits curve (shadow), predicted_lockout_date, habits_active (H1-H5
booleans). Lockout vocabulary: credit_low_viewed, lockout_viewed,
lockout_wait_chosen, lockout_checkout_started, refill_delivered,
queued_making_delivered, all flow=chat. **The conversion table**:
lockout_seen → card_captured segmented by days_since_signup,
weekly_notes_opened (0/1/2+), habits_active, aha_beats_fired. The
falsifiable bet: habits_active ≥2 and 2nd-note-opened predict card-pull; if
the note segmentation shows no delta, the value-anchoring theory is wrong
and the arc needs rework, not louder asks. `map.*` events unchanged for
honest old-vs-new comparison.

---

## 10. Open decisions (founder)

- **P1 (expanded)**: the one-ruling package of 7.5, superseding four
  decisions with pre-registered bars. Required before phase 3 code.
- **P2 (near-answered)**: sitting-1 generation cap ~4, enforced in the
  predicate; shadow metering sizes the weekly allowance with data. Founder
  confirms the 10/10/3 taper and Monday refill.
- **P3**: net-new priorities. Council ranking by conversion contribution:
  E4 morning basket > E3 state table > E5 crosswalk > C1 events scout >
  C2 picture book > D16 > E9.
- **P4**: old card flow's fate (unchanged).
- **P5**: does the chat spine become the SMS procedure (one mode doc, two
  renderings)?
- **P6 (new)**: sitting-1 variant, V-A report-first vs V-B creation-first
  (6.1). Feel-test decides; both are built on the same machinery.
- **P7 (new)**: D9's forwardable footer / E9's referral link, the first
  deliberate viral loops. Where does the link land, and does capture_lead
  back it?
- **P8 (new)**: journal_prompt ships seedPaused by ruling; the rehearsal's
  consent beat flips it per-family on an explicit yes. Confirm this
  satisfies the ruling's intent (opt-in, not default-on).

## 11. Unknowns (updated)

Resolved by the council with mechanisms now specced: channel attribute
(→2.2), hidden-message queue survival (→2.4), rail on mobile (→hairline +
value-earned counter), cold-session first token (→pre-warmed welcome +
kickoff-at-submit + warm fetch), credit unit (→flat makings), transcript
titling (→day separators suffice; episode continuity automatic).

Still open: the takeover-mount mechanics for start_checklist on the lean
surface; receipt-fan chip renders for log_hours/journal results (verify
message-parts today); whether suggestion chips (D18) can render pre-report
without offering post-report actions; E2's partial-score composer safety
rails; Vercel function warm strategy effectiveness (measure, then decide).

## 12. Council findings register

15 agents: designer(surfaces), designer(waiting), engineer, PM, CRO,
behavioral scientist, ICP mom; 5 aha lenses; 3 judges (57 candidates → 24
survivors + bench, 4 duplicate clusters merged). Blocking findings and
dispositions:

| Finding | Disposition |
|---|---|
| Zero re-entry design despite multi-sitting reframe (5 perspectives) | §6.2 playbook, E1, resume kickoff, 2.2 family-state architecture |
| Lockout least-designed while being the only metric (3 perspectives) | §7 fully designed; prototyped dark in phase 1; F1/F2 |
| In-turn wait masking mechanically impossible (waiting designer, engineer) | §2.6 async delivery; promise cards; 8.1 wait classes |
| Hidden messages render as her bubbles + queue-join corruption (3 perspectives) | §2.4 directive contract |
| Credit model contradicts D2 + T1, not just the two named rulings (CRO) | §7.5 four-way ruling package |
| Visible meter suppresses the abundance the period needs (CRO, PM, habits) | invisible-until-low; two-pool economy; suppression kill test |
| Aha catalog trains the artifact habit the meter then punishes (behavioral) | H1 keystone debrief; rehearsal mandatory; habit loop never metered; lockout armed by loops not ahas |
| First-week habit carrier does not exist as configured (behavioral) | Partly withdrawn by prod verification (§13): dispatch runs daily, briefs reach 38 families, journal fires for opted-in families, drip delivers all three nudge kinds with suppression live. What stands: journal is per-family opt-in (2 families today, consent beat P8), drip stays a 1-per-7-days net, and the 20h brief seed gate still delays day-2 (PMF-201) |
| Sitting-1 unbounded for 52% multi-kid families; "15-ish min" framing self-inflicted (PM, mom) | 6.1 budget; kid-2 default-deferral; measured framing |
| Spent/error card states unspecified (designer) | §2.3 lifecycle contract |
| Checklist geometry unresolved (designer, mom) | §2.5 takeover + receipt |
| Activation scoreboard measured the wrong metric (PM) | §9 conversion table; per-beat lockout-contribution justifications |

Key convergent observations worth keeping in view: the chat flow's single
biggest structural conversion win is making the reveal in-session (1 in 4
report-earners never open the emailed link today; re-verified: 39 families
generated, 30 viewed); after setup the current flow converts ~95% per step,
so the rebuild must not re-break the fixed cliff by re-bundling early
captures; the Jul 7-13 high-touch cohort went 5/5 multi-day when the
founder closed loops by hand, and the free-period arc is that week,
mechanized.

## 13. Production ground truth (verified 2026-07-21, prod Supabase)

The council's capability inventory read local dev flags and mislabeled
several live systems as dark. This section is the authoritative correction;
where any earlier section disagrees, this table wins. Method: direct
read-only queries against prod (homa-prod), behavioral evidence over env
inspection.

| System | Spec/council assumed | Prod reality (evidence) |
|---|---|---|
| Agent jobs | dark | **LIVE**: 1 real-family curriculum-studio job, completed, 22 stages built 07-20; `job.stage_completed` x25 |
| Morning brief | dark, flag off | **LIVE daily**: 124 done `morning_brief` runs; `research.brief_sent` to 38 families, last today |
| Drip | built dark, blocked on config | **LIVE**: `drip_setup_nudge` x9, `drip_report_unviewed` x9, `drip_loop_back` x3 delivered, last today; `email_suppressions` active |
| Thank-you cards | dark | **LIVE since 07-11**: 38 sent / 37 families, 2 failed |
| SMS (Telnyx) | dark in dev | **LIVE**: 433 sms conversation rows, 52 `sms.family_linked`, 31 contact cards |
| Journal prompt | flag off | **Enabled, per-family opt-in**: 9 prompts sent to 2 opted-in families, last today |
| Fleet research | behind flag/infra | **LIVE nightly**: 66 done runs; knowledge_bank 137 rows |
| Report narrative | behind flag | **LIVE**: `map.narrative_generated` x138 (39 families) |
| Live progress | flag false (dev read) | **LIVE**: child_progress_evidence 1937 rows, projections updating through 07-19, check-ins exist |
| The $19 door wall | exists dark | **ENABLED**: `wall.viewed` by 3 real families (07-18/19), 1 sandbox checkout test, 0 trials. See §7's phase-1 bypass requirement |
| Subject lessons | dark, never used | **Exercised and proven 2026-07-21** (section 15). Flag `HOMA_SUBJECT_LESSONS_ENABLED` confirmed OFF in prod: the build route 404s by design, and `claimOrReuseSubjectLesson` + `claimSubjectLessonSessionInput` both check the flag, so nothing can be built until it flips |
| Lesson listen | live, unexercised | **Exercised and proven 2026-07-21**: 1 real lesson, pipeline end to end in ~15 min, review quality high. Two defects found (section 14) |
| Walk engine | dark (correct) | Confirmed: `map_walk_prompts` 0 rows |
| E3 state table | net-new build | **Exists**: `state_requirements` 51 verified rows + `lib/map/state-requirements.ts`, already rendering the report state card |
| Suggestion chips (D18) | engine exists in code | Confirmed live: `chat.prompt_suggestions_shown` firing (3 families) |
| model_usage (shadow meter) | exists | Confirmed: 4,680 rows, all surfaces |
| conversation_messages.visibility | mechanism to extend | Confirmed applied in prod: 190 internal rows (dispatch + web) already filtered from history |
| map.step_viewed | shipped 07-20 | Live but nascent: 1 event so far |
| Funnel (family-level) | 07-20 audit numbers | Re-verified fresh: started 302 → account 56 → setup 43 → report 39 → viewed 30; kids: 48 claimed real, 25 with 2+ kids (52%), 45 billing_exempt, 0 trials |
| Loop-back cliff | 5 of 36 | Re-verified: 5 claimed real families ever (of 48); `chat.hours_logged` 3 families, `map.plan_progress` 4 |
| 20h brief seed gate | assumed present | Confirmed in code: `lib/tasks/store.ts:89` |

Consequences already folded into this spec: the corrected B-tier table
(4.1), E3 resized (4.3), the §7 wall-state note and phase-1 bypass, the
§6.3 brief note, and the §12 register amendments. Net read: the free-period
machinery this spec leans on is substantially MORE live than the council
believed; the genuinely unbuilt surfaces are the credit economy, the weekly
note sender, the onboarding chat itself, and the E/F-series composers.

## 14. Lesson listen: first real lesson, and two live defects

Evidence: lesson `578edf91`, family "The Swift family" (Alessa, real not
sandbox), child Story, 2026-07-21 16:09 UTC. 827 seconds, `source=recorder`,
final status `ready`. Four ~181s segments, transcribed at 16:13 / 16:16 /
16:19 / 16:22, review synthesized 16:24: **about 15 minutes from stop to
review.** Review quality is high (see 5.1). Founder verdict: "amazing".

### D-LL-1 (live, user-visible by absence): every progress clause was rejected

`lesson_reviews.evidence_count = 0`, `observation_count = 0`, and all four
`progressNotes` carry `outcome: "rejected"`. Nothing reached
`child_progress_evidence` or `child_observations`. The review page filters
progressNotes to evidence/conflict/observation, so **rejected notes render
nowhere**: the parent sees a beautiful review, the child's ledger gains
nothing, and there is no error anywhere. Silence, not a failure message.

Root cause, verified by replaying the four real pairs through the shipped
gate (`verifyLessonClausePair`, `lib/lessons/pairs.ts`): check 1 (excerpt
appears verbatim in the transcript) **passed on all four**, so the model
quoted real audio and did not hallucinate. Check 2, the clause-to-excerpt
meaningful-token overlap floor of `CLAUSE_TOKEN_OVERLAP_FLOOR = 0.5`,
failed all four, measured:

| clause | excerpt | overlap |
|---|---|---|
| "Story identified the letter sound for n after a few tries." | "Um, N. N." | 0.17 |
| "Story could not yet sound out the word without guessing." | "I fed the... I fed the..." | 0.00 |
| "Story lost track of the counting order once past ten." | "18 19 20 11 12 14 14 16 17..." | 0.00 |
| "Story counted successfully up to five coins." | "four, five." | 0.20 |

This is structural, not a bad-luck run. In a lesson recording the child's
audible utterance is a bare fragment, while the clause must be a
parent-report sentence describing what the fragment demonstrates. A
paraphrase-overlap floor of 0.5 is unreachable when the excerpt is two
tokens of dialogue. The check was calibrated for journal text, where the
parent's own sentence is both the claim and the quote and 50% overlap is
natural. **On the lesson channel it rejects essentially everything, so the
"and it moves her progress" half of lesson listen has never worked and
would not work for any family.** This is a concrete mechanism behind the
07-21 progress signal-capture audit finding that the chart cannot gain a
point post-onboarding even when signal lands.

Fix options (the calibration of an anti-invention trust boundary is a
founder call, so this is escalated rather than silently tuned):
1. **Quote the exchange, not the answer** (recommended): change the
   synthesis prompt so an excerpt spans the adjacency pair (the parent's
   prompt plus the child's response), because in dialogue the semantic
   content lives in the pair. This *strengthens* the evidence requirement
   (more verbatim text must match real audio) and leaves both checks
   intact. Worked example: excerpt "What sound does this letter make? Um,
   N. N." scores 0.50 against clause 1 and passes. Risk: model compliance
   is probabilistic, so it needs a live re-run to confirm.
2. **Channel-aware floor**: keep 0.5 for journal, lower it for `lesson`
   where check 1 already pins provenance. Simple and deterministic, but it
   admits more paraphrase, which is exactly what the gate was built to stop.
3. **Score the clause against an excerpt window**: compare the clause to
   the excerpt plus surrounding transcript context. Most faithful to how
   dialogue carries meaning; largest change, needs new tests.

Note that passing this gate is necessary but not sufficient: the 0.85
journal matcher still decides scoring, and unmatched clauses land as
`child_observations`. Even the floor case is a large improvement over
silence, because observations feed the weekly reinforcement loop.

### D-LL-2 (live, degradation): tone notes never ran

`tone_noted_at` and `tone_notes` are null on all four segments, so the
review was transcript-only and the tone lane contributed nothing. The lane
is fail-soft by design (`lib/lessons/tone.ts` returns null on any failure
and never throws), so this is silent degradation rather than an outage, and
the review was still good without it. Unresolved: whether
`HOMA_LESSON_TONE` is off in prod, or the default audio model
(`google/gemini-3-flash`) is failing or timing out at 45s per segment. The
module's own header notes the model choice was to be pinned by a spike
"before the flag ever flips", which may never have happened. Worth one
check of the Vercel runtime logs for the tone lane before deciding.

### Consequence for this spec

Lesson listen is promoted (5.1) on the strength of the review, and the
progress claim is embargoed until D-LL-1 is fixed. The module is otherwise
ready: the pipeline is proven end to end on real audio, and the 15-minute
turnaround fits the async promise pattern exactly.

## 15. Subject lessons: first build ever, verified working

Tested 2026-07-21 against sandbox family "The Test Family", child Jon
(age 6, 22 answers, scored report). Method: the flag is off in prod, and
both `claimOrReuseSubjectLesson` and `claimSubjectLessonSessionInput` check
it, so the build ran on a local server with the flag on, against the prod
database, doing exactly what the authenticated build route does after auth:
claim the lesson row, then `POST /eve/v1/subject-lesson/start`.

**Result: worked, first attempt, no retries.** Lesson
`ae3ed523`, attempt 1, `build_status: ready`, `error_code: null`,
**158 seconds** from claim to ready.

| Stage | Outcome |
|---|---|
| Target selection | `phonics.digraphs-cvce`, "Reads words with sh, ch, th, and silent-e words like cake". Correctly picked the high-confidence growing frontier, not a random subject |
| Lesson content | 5 progressive steps (sh, then ch initial/final, then th, then the cap/cake contrast, then three more silent-e words), a materials list, and a sort-into-two-piles practice. Pedagogically sound and genuinely runnable |
| Worksheet | `create_printable` HTML path, no image generation. Brand-correct (display green, clay headings, warm neutrals, "made with Homa for Jon" footer) |
| QC | `materials_review` fired (gpt-5.4-mini) |
| Print fidelity | **PDF matches the preview exactly.** Clean pass on the known screen-vs-print false-pass class |
| Personalization | The "Try this together" box reads "Jon looks through a favorite dinosaur or horse book", pulled from his stored interests |
| Events | Both `map.subject_lesson_started` and `map.subject_lesson_ready` fired |
| Material state | Attached as `draft` (awaiting the parent's Keep), which is the intended state |

**Cost, and why it matters for section 7.** The build consumed 8 model
calls, 412k input tokens (352k of them cache reads) and 6.2k output, plus
one small review call: roughly **$0.35-0.40 per lesson**, against the
`ACTION_COSTS.subjectLessonWithWorksheet` registry estimate of $0.12. The
registry is low by about 3x. Update the estimate, and price a subject
lesson as the most expensive single "making" in the credit economy (7.1).

**One nit, not a defect**: each worksheet section prints its words twice,
once as a plain sentence ("Ship, wish, shop, fish") and again as word
cards. It reads like a leftover word list. Worth one line in the
materials-studio recipe rather than a fix here.

**Consequence for this spec**: B1 moves from "unproven" to "proven, dark".
It fits the async promise pattern (158s is well past a chat turn, so it
must deliver as a promise card plus a later arrival, per 2.6). It is a
credible day-2+ module, though at ~$0.38 and 2.5 minutes it is a
considered spend, not a casual one. Nothing in the spine depends on it.
