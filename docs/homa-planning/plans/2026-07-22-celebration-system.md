<!--
Status: PROPOSAL. Nothing here is ruled except where it cites an existing
founder ruling by name. Six decisions are open at the bottom; D1 is
time-critical because lesson audio deletes on a 30-day timer and deletion
is one-way.

Produced 2026-07-22 by a nine-agent research round (seven dimensions:
artifacts, narrative, rituals, portfolio and compliance, multi-kid,
timing, surprise) plus an adversarial critic whose CUT verdicts are
recorded in the "On the shelf" table. Builds on `abilities-map-v1`.
-->

# The celebration system

Spec, 2026-07-22. Builds on founder ruling `abilities-map-v1` (`docs/homa-planning/journeys/10-reconciliation.md`, later-ruling register). Read once as a founder; build from sections 2, 5 and 6.

---

## 1. The thesis

Homa already holds, for every child, a dated ledger of things that actually happened: the mother's own sentences, her own recordings, her own worksheets, each stamped at the moment she said it. The celebration system is the second reader of that ledger. It is not a new capture surface, not a score, and not a motivational layer aimed at a child. It is Homa noticing, on the mother's behalf, the growth she cannot see because she is standing too close to it, and handing it back to her as something she can hold: a warm Friday letter, a page of firsts, a certificate, a printable year, a legal portfolio. The same rows do all five jobs, which is why this is cheap to build and impossible for anyone selling a blank template to copy.

**The one law: a celebration is a receipt, never a verdict.**

Every surface in this system must name something that already happened, must trace back in one tap to the parent's own words or her own recording with its date, and must never render, count, imply, or gesture at what is not there. The law is the reason there are no denominators, no scores, no streaks, no inactivity nudges, and no child-facing view. It is also the reason a thin week produces a short true letter rather than a manufactured one, and the reason a mother can darken any star Homa lit and Homa says thank you.

Three laws sit under it, unchanged and non-negotiable:

- **Never the word "behind", never a deficit frame, never a sibling comparison.** One artifact carries at most one child's numbers, enforced in code, not prose.
- **The model proposes, code verifies.** Every celebratory sentence is composed by a model over a facts payload and passes `packages/core/src/map/narrative-gate.ts` before a parent reads it: allowed numbers only, no sibling names, no banned words, no em dash, no negative numbers, no diagnosis phrasing.
- **Silence is a design decision with a cost.** A suppressed beat must never leave a visible empty slot, a greyed placeholder, or an unexplained gap.

---

## 2. The celebration ladder

Twelve rungs, smallest to largest. Rungs 5, 7, 8 and 9 are content that rides inside rung 6; they never open a second proactive beat.

### R1. The in-turn moment (seconds, unlimited, reactive only)

**Trigger.** The parent volunteers a win in chat, SMS, voice, or it lands in a lesson review as a `breakthrough` or `sweet` moment (`apps/web/lib/lessons/synthesis.ts:22-35`). Homa is already in the turn.

**Parent gets.** A real, specific, active response in that same turn, naming the thing she said, and one question back. This response *is* the celebration. The evidence row it produced is stamped `celebrated_at` (additive column on `child_progress_evidence`), so the Friday letter later reopens the moment instead of reporting it as news.

**Copy.**
> She picked the book herself and read it alone. That is a first. What did she choose?

**Never.** Do not make a moment of every routine report. Most reports get a warm plain acknowledgment; a true first gets the stop-and-look. If everything is a moment, she learns to skim and every rung above this one loses its value.

### R2. The five minute marker (same day, inline, never pushed)

**Trigger.** An ability lit this week AND the parent is already in a conversation she started AND at most one marker has been offered in the last seven days AND no hard-day hold is active.

**Parent gets.** One two-sentence offer for a zero-prep, same-day, physical thing the child does, anchored to something already in the house. Homa reaches first for a remembered family form (poetry teatime, pancake Sunday, the dinner candle, the front-step chalk), stored as durable memory the same way `remember` already stores routines and rhythm. Only when nothing is remembered does she name a generic small form.

**Copy.**
> Ellis wrote his name without asking how it goes. If tonight is easy, he could light the dinner candle and show you. If tonight is not easy, this one keeps.

With a remembered form:
> You mentioned poetry teatime on Tuesdays. Nora's rhyming clicked this week, so if teatime happens, she could pick every poem this time. Nothing extra to plan.

**Never.** Never a notification. Never a ceremony, a guest, a display, or anything requiring purchase or preparation. The exit lives inside the offer, not appended after it. A stale remembered form must be trivially correctable, so recall carries the date the fact was learned.

### R3. A first lands (silent accrual, permanent page)

**Trigger.** `min(observed_at)` for an `item_id` for this child. Deterministic, no model. Implied abilities never appear: `deriveAbilityMap` sets `observedAt: null` for them by design (`apps/web/lib/child-progress/abilities.ts:52-53, 183-190`) and an invented date would break the receipt law.

**Parent gets.** A permanent, always-growing page per child, ordered strictly by date, never by subject, with the parent's own quote from that day. The earliest row in each subject carries a subject marker naming where it came from. The very first row Homa ever wrote about this child sits at the top of the page, labelled as the beginning. Nothing ever leaves this list, including after a regression report.

**Copy (page row).**
> First time Noah read a whole sentence out loud: March 3. You told me that evening.

**Copy (subject marker).**
> Science has its first light here. It came from the tide pools on Saturday, not from a lesson, and it counts exactly the same.

**Copy (share offer, at most once per first, only on a genuine first, never inside the letter).**
> Grandma would love this one. Want me to make a little card with Story's name on it?

**Never.** No month or year headers for empty periods, no axis, no density that reads as a rate, never two children's lists in a comparable layout or on one screen. Never the words "finally" or "at last". The share offer never attaches to an implied ability, never fires in a week where a hold ran, and a decline puts that child's share offers away for at least 30 days.

### R4. Movement (level-agnostic, any child, any level)

**Trigger.** A dated state transition in the per-change history that landed with `progress-signal-capture-v2`: `not_yet` to `emerging`, or `emerging` to `mastered`. The trigger is identical for every child at every level, by construction, so the category is never legible as "the ritual for the child who is struggling".

**Parent gets.** One line in the Friday letter naming the act and the date, and optionally a five-minute physical marker the child performs (a stone in a jar, a bead on a string, a mark on the doorframe).

**Copy.**
> Theo went back to borrowing in subtraction four times this week, and by Thursday it was working. Some families keep a jar by the sink for that: he drops in a stone for a thing he came back to. One minute, and it is his to do.

**Never.** Never describe the effort, the difficulty, or that he kept going. Name the act and the date. No keyword detector for effort language; that is a judgment call and belongs to the model with code verifying the quote and the item id.

### R5. Free credit and the door that opened (one graph moment per child per letter)

**Trigger.** Deterministic, from machinery that already runs. Either (a) a confirmed ability's `hardPrerequisiteClosure` lit eight or more abilities nobody reported, or (b) the newly confirmed ability's `unlockClosure` opened a frontier far above this child's running median. If both fire, the larger event wins and the other is discarded. One graph moment per child per letter, never two.

**Parent gets.** One paragraph. For (a), the count plus two or three of the actual abilities named in plain language, plus the one thing she reported that proved them. For (b), one sentence about space, with nothing enumerated and explicit permission to do nothing.

**Copy (a).**
> Good news that took no extra work. When Rowan showed you two-digit subtraction on Tuesday, that settled eleven smaller things underneath it at the same time. Place value to a hundred, regrouping, counting back. They were already true. Now they are on the map where you can see them.

**Copy (b).**
> Place value clicked this week, and that one carries a lot. A whole stretch of math opens up from here, and it opened on its own. Nothing you need to do about it today.

**Never.** The count never appears without named abilities beside it, or it reads as a score. Never enumerate what opened in (b), or a gift becomes a to-do list. Explicit answers stay strictly dominant over implication, which the derivation already enforces (`abilities.ts:139-141`).

### R6. The Friday letter (the only proactive CELEBRATION beat)

> Reconciliation note (D3 ruled 2026-07-22): the Friday letter is the only proactive *celebration* beat. There is now exactly one other proactive channel, and it is not a celebration: a portfolio-deadline reminder for a family in a state that legally requires a portfolio. It does not ride the letter and follows different rules (see §7 D3). Everywhere this doc says "the only proactive beat", read it as "the only proactive celebration beat".

**Trigger.** Once per child per seven days, at the end of the family's own school week, in the family's own time zone. The school day is derived from rhythm memories ("school four mornings a week, Fridays are co-op"), the weekday distribution of parent-initiated events over the last six weeks (`apps/web/lib/activation/signals.ts:18-38`), and her own message pattern. If the derived day does not beat Friday by a clear margin, use Friday. Homa states the derived day out loud the first time and it is changeable in one tap.

**Structure, enforced by code, written by the model.**

- **One letter per child.** N children means N separate emails, never one email with N sections. The composer takes exactly one `childId` and cannot see another child's data. Send order rotates by ISO week number so no child is permanently first in the inbox. Staggered sends, varied subject lines.
- **Exactly three items, always.** A quiet week changes the content, never the length. Slots fill by walking an ordered fallback chain that cannot run dry:
  1. an ability reported this week
  2. a movement transition this week (R4)
  3. a newly implied ability from this week's confirmations (R5)
  4. an already-lit ability used again this week (a lesson, a worksheet, a check-off)
  5. a ready-next with its receipts, framed as open, never as owed
  6. a durable remembered fact about what this child loves, tied to a lit ability
  7. an earlier lit ability restated with its date, still true
- **No ability fills a slot in two consecutive letters for the same child.** Track `fallbackDepth`, the deepest rung used. Three consecutive weeks at depth 5 or greater changes the letter's opening and triggers one cadence offer (see section 5B).
- **Peak last.** The model picks which of the three items is the peak and why, as structured output naming a slot. Code verifies the slot exists and that the chosen item is not a `not_yet` answer and does not come from a lesson segment with a `frustrated` tone beat. The peak is restated as the closing line. No chronological list, no counts of abilities, no "3 new abilities".
- **The named-worry rail.** One slot is reserved, at minimum every fourth letter and whenever there is anything true to say, for one honest sentence about the subject the mother herself named as her worry (section 5A). This overrides the peak-picker's preference for whatever subject is moving fastest.
- **One offer, at the end, after the wins.** At most one ritual or dinner-question offer per letter, after the three items. Declines are recorded against the existing offer ledger (`apps/web/lib/conversation-continuity/offer-fulfillment.ts`, `conversation.offer_fulfilled`). Two declines with no accept and Homa stops attaching offers to the letter, says so once and warmly, and keeps them for completion moments only.
- **Recipient is per adult, opt-in.** Default recipient is the adult who has been reporting evidence for that child. A second adult opts in explicitly, per child, and can mute per child without affecting the other adult's letters.
- **Fences, both already built.** One proactive email per family per seven days with a five-per-tick burst ceiling (`apps/web/lib/drip/sweep.ts`), and a delivery window so a stale claim records `skipped` rather than arriving late (`apps/web/lib/tasks/store.ts:273-280`; the window exists because three real families got 11pm journal emails from leftover rows, `apps/web/lib/tasks/kinds.ts:56-59`). Plus a hard closed window: no proactive message of any kind between Saturday 18:00 and Monday 07:00 local, enforced at the delivery layer so a badge, a lesson-ready notification, or a finishing agent job cannot walk through it.

**Copy (subject).**
> Three things Ivy did this week

**Copy (closing, peak restated).**
> The thing to hold onto from this week is Tuesday. She sounded out the whole line by herself, and she did not look up once.

**Copy (first letter a family ever receives).**
> This is the first of these. It will get better as I know more, and everything in it came from you.

**Never.** No forward-looking content pushed on a Sunday; ready-next waits on the Progress surface for her to come to it. No causal attribution to her own effort unless it is true and traceable. Never a total, never a period-over-period number, never another child's name.

### R7. Your own words, answered (inside the letter, at most once a month)

**Trigger.** Two evidence rows on the same `item_id` for the same child, an earlier `not_yet` or `getting_there` and a later `easily`, both carrying a `quote` and an `adult_display_name_snapshot`. Supersession retains the earlier row rather than overwriting it (`supabase/migrations/20260711213330_agent_led_live_progress.sql:66-111`), so complete pairs already exist in production today. Both quotes are re-verified as substrings of their stored rows before render, and both are passed to the narrative gate as an `allowedQuotes` set.

**Parent gets.** Two of her own dated sentences, side by side, attributed to her, with Homa positioned as the keeper of the record rather than its narrator.

**Copy.**
> You have been keeping track all along. Last October you told me "we are still working on counting past twenty." On Monday you told me Sam counted to one hundred. You saw both of those. I only kept them.

**Never.** Never a pair where the later quote does not answer the earlier one; if there is no answering quote, this beat simply does not fire. Never resurface a quote naming a diagnosis, a hard day, a sibling, another adult, or the mother herself. Never frame her past worry as an error.

### R8. Then and now, in their own words (inside the letter, at most once a quarter per child)

**Trigger.** Two verified transcript excerpts from the same child in the same subject, separated by a span the recording history actually supports. Span-relative, never anniversary-keyed: lesson listen went fleet-wide 2026-07-21, so no family has a year-old recording until July 2027. Every candidate excerpt has already passed `verifyLessonClausePair`'s verbatim-substring check (`apps/web/lib/lessons/pairs.ts:96-140`).

Gates, all hard, all verified in code after the model proposes:
- the later excerpt must be the stronger one, judged by a model against a measured fixture set, not a prompt instruction
- neither segment may carry a `frustrated` tone beat
- child utterances only, never a parent utterance
- never a fluency pair in the subject she has named as her worry unless she asked for it

If any gate fails, publish nothing. Never a hedged version.

**Copy.**
> Earlier this year, in a lesson you recorded, Emma said "c... a... t... cat!" This week, in the same subject, she said "the cat sat on the mat and then it ran away." Both are her own words, saved from your recordings.

**Also available:** the deterministic version, which needs no model at all. `worksheets` carries `skill`, `preview_url` and `created_at` per child (`supabase/migrations/20260710031000_worksheets.sql:22-38`), so two dated instances of the same skill pair with zero judgment. Homa proposes, she approves, and an approved pair becomes a keepsake and a grandma-card candidate. Never pair across children.

> Same kind of page, six months apart. You saved both of these. Want to keep them together?

### R9. One question to ask at dinner (one per letter, maximum)

**Trigger.** A stored lesson moment of kind `breakthrough` or `sweet`, or a parent observation, from this week. Never `friction`, never `openQuestions`, never a segment with a `frustrated` beat.

**Parent gets.** One specific open-ended question to ask her child about one real remembered moment. She asks it, the child tells it, she asks what else they remember. Homa never asks the child anything, never sees the answer, never follows up, and never asks whether she did it.

**Copy.**
> If you want one, here is a question for the dinner table: "do you remember the day you finally got the coins to count out right?" Then just let Emma tell it, and ask what else she remembers. Skipping it is completely fine.

### R10. What ninety days looked like (evidence-gated, no calendar slot)

**Trigger.** Run `deriveAbilityMap` twice over the same effective evidence, once filtered to `observed_at <= now - 90 days` and once to now. `deriveAbilityMap` is pure over evidence plus `ageMonths` (`apps/web/lib/child-progress/abilities.ts:105-229`), so this is an honest diff with no new table. Fires only when the diff contains something worth one sentence. Silent otherwise, with no visible slot and no "nothing to show this quarter".

**Parent gets.** One card. One sentence of change with the dates that bound it, and one sentence of absolution naming the mechanism.

**Copy.**
> Nothing about Tuesday looked different from Monday. Across the last ninety days, though, Ava has started reading three-syllable words on her own. Change this gradual is close to impossible to see day to day. That is how looking works, not a failure of attention.

**Never.** Never state the change as a score, a rate, or adjacent to a previous period's number.

### R11. The area completion certificate (printable, rare, gated in code)

**Trigger.** A deterministic eligibility function, not a skill instruction. All of:
- the area holds at least 8 topics (2 of 65 areas in `packages/taxonomy/data/topics.json` hold exactly one, and a certificate minted on one sentence is a participation trophy)
- every topic in the area is confirmed
- at least half are confirmed by a directly reported `easily`, not by implication (`abilities.ts:122-127` lights a whole closure off one answer)
- confirmations span at least 3 distinct `observed_at` dates and at least 60 elapsed days
- no open correction on any node in the area
- offered at most once per child per area, ever

**Parent gets.** A one-page printable through the existing pipeline (`apps/web/agent/tools/create_printable.ts`, Chromium letter PDF with per-page preview and vision review; a `certificate` kind joins `apps/web/lib/materials/kinds.ts:8-18`). Front page for the child's wall: the thing the child can now do, in plain words, the date, and "at home". Back page for the binder: the dated list of abilities in that area, each with its date, its source, and its standards citation where one exists (818 of 1,721 taxonomy topics carry one).

**Copy (offer).**
> Nora has shown every ability in hearing and playing with the sounds inside words. That is a whole area of reading, complete. There is a certificate here if you would like to print it, and the dated list is on the back for your binder. Letting it pass quietly is a fine choice too.

**Copy (front page).**
> Nora can hear and play with the sounds inside words. Every step. 14 March 2027, at home.

**Never.** The denominator is computed inside the eligibility check and never rendered anywhere: no bar, no fraction, no count remaining, no "almost". A mother must never be able to see how far from a certificate her child is. Never the word "domain" in copy; speak the area's plain name. Never "awarded", "certified", "official", or a signature line implying an authority Homa does not have. Never surface a certificate in a shared family feed, never batch two children's certificates into one moment, and never issue one for an area the child fought through where it would read as consolation.

### R12. The year on one page, and the portfolio packet (annual, on request, the only retrospective)

**Trigger.** Parent request, or one offer at the end of a term, above an evidence floor. Never scheduled. Never on a Friday. Never during the week before a filing deadline she has told Homa about.

**Parent gets.** A single printable letter sheet: new abilities by subject in plain language, the lessons that happened, a few photographed work samples, the dates. Fridge-sized, black-and-white safe, zero setup. It is also the front matter of the portfolio packet (section 4), so there is one pipeline, not two.

**Copy.**
> You did more this year than you probably remember. Here is Nora's year on one page, ready to print if you want it.

**Never.** No period-over-period comparison. No count against any total larger than a single area. Never the first thing she sees on a Friday. This is the only free-form annual retrospective Homa produces; there is no narrated year story, no bound book, no anniversary reel.

---

## 3. The artifacts

### Digital, zero marginal cost

| Artifact | Path | Cost |
|---|---|---|
| The Friday letter | Existing drip and task rails, per child, per adult opt-in | Model tokens only, one composition call per child per week |
| The list of firsts | Read-time projection, `min(observed_at)` grouped by `item_id` | None |
| The abilities map and the household view | `deriveAbilityMap`, pure and synchronous | None |
| Provenance viewer | Rows already carry `quote`, `channel`, `message_id`, `observed_at` | None |
| Then and now pair | Existing worksheets rows, existing verified lesson excerpts | None (deterministic) or one model call per candidate |
| The grandma card | Already ruled, already an image, leaves the tenant with a first name only, parent-initiated per card | None |

### Printable, she prints

| Artifact | Path | Cost to Homa | Cost to her |
|---|---|---|---|
| Area completion certificate | `create_printable`, new `certificate` kind, one page front plus dated back | Model tokens plus one Chromium render | Paper and ink |
| Year on one page | Same pipeline, one page | Same | Paper and ink |
| Portfolio packet | New server-side multi-page assembly. `MAX_PACKET_PAGES` is 12 (`apps/web/agent/tools/create_printable.ts:80`) and a year exceeds it, so this reuses the render geometry and the per-page preview plus vision review discipline outside the packet tool | Model tokens plus N renders | Paper and ink |

Mandatory for every printable: the preview must rasterize from the shipped PDF bytes, not the screen render. The 2026-07-19 materials false-pass class was exactly this, and a certificate that looks right on screen and prints broken is a worse failure than a broken worksheet because she framed it.

### Physical, mailed

**None. Not in v1, not in v2.** This is a decision, not an omission. Every mailed object is permanent, unrecallable, arrives at different rates for two children in one house, and hangs in a hallway where Homa's rules cannot reach. The specific candidates and why they stay off:

- **Wall poster**, 18x24 mailed: roughly $9 to $14 delivered at budget print-on-demand wholesale plus rolled shipping. Two charts in one hallway is sibling comparison Homa built and cannot un-build. The mitigation (a density floor, so Homa silently declines to offer her son a poster) is itself the harm.
- **Ability stickers**: $1.02 to $1.39 per kiss-cut sheet plus $4 to $5 shipping, so $5 to $7 to ship a $1 object, and the object's most likely destiny is a fridge chart, which is a variable-ratio reward economy by proxy with a child at the other end.
- **Bound year book**: roughly $18 to $30 print plus $5 to $8 ship for a 30 to 40 page hardcover. Most expensive to get wrong, least fixable, and a Homa-written caption on a photo it half-understood is a fabrication with a spine.
- **Mailed grandma postcard**: PostGrid 6x9 first class is about $1.02 all in, which is cheap, but it needs a new table (`thank_you_cards` is `unique(family_id)` and once-ever by the 2026-07-14 ruling), address handling, returns, and permanent egress of a child's first name plus a postmark, all to save her forwarding an image that is already free and instant.

### Audio, pending a ruling

A kept 20-second clip of a child working something out, retained past the 30-day lesson audio TTL. Storage cost is negligible. The TTL is real and deliberate (`supabase/migrations/20260714033500_lesson_listen.sql:5-8, :144`: raw audio deletes at 30 days, rows and transcripts persist). This is not a bug and not an escalation; it is a privacy commitment with a competing value on the other side, and the cost of deciding slowly is one-way. Audio deleted in 2026 is not recoverable in 2027. See open decision D1.

> In the lesson you recorded in March, there are about twenty seconds where Sam works out the pattern out loud. That audio is set to be deleted next week. Want me to keep just that part for you?

If ruled in: per clip, parent-initiated, one-tap deletable, offered only where the review's `siblingNote` is null, trimmed to the child's utterance rather than the full segment, never a default, never a settings toggle that silently retains everything.

---

## 4. The compliance overlap

### One write, two readers

The evidence ledger already stores, at capture time, everything a portfolio needs: `quote`, `source`, `channel`, `adult_display_name_snapshot`, `observed_at` (`supabase/migrations/20260711213330_agent_led_live_progress.sql:66-111`). Pennsylvania and Florida both require a log "made contemporaneously with the instruction". **A capture-time timestamp is the one legal property that cannot be added in June.** Every competitor ships a blank portfolio and puts the assembly on the mother at the exact moment she is most depleted. Homa was there all year.

So the same row that lights a star renders as a dated log line. A second read-time projection over effective evidence, following the pattern `abilities.ts` already proved: no migration, no new capture, no reconciliation.

### The portfolio packet

One child, one date range, one PDF, four sections named the way the statutes name them:

1. **Activity log.** Dated observations and hours blocks in order, from the evidence ledger and `hours_log`.
2. **Reading and materials list by title.** From `apps/web/lib/materials/binder.ts`, which already holds dated finalized materials with title and subject.
3. **Work samples.** Finalized materials with their dates and page previews, date-ordered, which produces the beginning-middle-end spread evaluators ask for at no extra effort.
4. **Abilities summary.** Plain-language abilities with dates. The year-on-one-page sheet (R12) is the front matter.

Where this is not sentiment but the family's legal position: Pennsylvania (contemporaneous log listing reading materials by title, plus writing and creative samples, plus third-party evaluator certification by June 30, with a district hearing on failure, 44,692 students), Missouri (plan book or log plus portfolio, and the log is the statutory defense), Maryland (district portfolio review two to three times a year, 42,151 students), Utah Fits All and WV Hope (annual portfolio to renew the ESA).

**Hard boundaries.** The packet carries the state card's exact boundary language and never claims compliance, never renders a checkmark against a statute, never states an hours total it cannot fully evidence, and never shows what is missing. It opens with what is there, not with the span it covers, so a sparse year is never paginated into whitespace. It is generated on request. A quarterly-report render is the same packet in the state's four-element shape, on request, with no dates, no scheduling, and no reminder.

**Copy.**
> This is your year in one file. What you and Nora did, when you did it, in the order it happened. Read it over and change anything before you send it. Your evaluator is the one who decides whether it is complete.

### The private crosswalk

Statutory subject names do not match Homa's ten `HOURS_SUBJECTS` (`apps/web/lib/hours-model.ts:8-19`, which has no civics, geography, health or safety) or the taxonomy's ten. A reviewed, versioned, per-state-verified crosswalk table seeds through the same reviewed-snapshot pipeline as `state_requirements` and is scoped only to states with real families in them.

**It is a private reference. It orders and labels the packet's sections and nothing else.** It is never a parent-facing surface, never a coverage view, never a fraction, never a color. A coverage claim is a separate founder ruling, not a follow-on ticket, because a coverage view is one design decision away from a red deficit dashboard wearing a legal justification.

### Why this is the retention engine

The warm layer and the legal layer are the same rows. A mother who has rendered one portfolio out of Homa cannot leave in March without abandoning her legal record. That is powerful and it is one step from coercion, so: **full unconditional export ships in the same release**. Any child, any range, any time, free, including after cancellation. Nothing is ever sealed or made immutable. The provenance viewer is the trust half: tap any line and see the date, the channel, and her own words, which is the honest answer to the question evaluators will start asking by 2027. Every line traces to a human sentence with a timestamp. The model never authored a fact.

---

## 5. The hard cases

### A. The struggling child, and the subject she is actually afraid of

The failure mode nothing else in this spec prevents: every growth-framed beat fires on the subjects that are moving, so the subject she cares about most is the one Homa is quietest about. Her whole worry is reading. Week after week the peak-picker hands her science and math and says nothing about the thing keeping her awake, and she reads that as Homa changing the subject.

**The named-worry rail.** Homa stores, as a durable dated memory in her own words, the subject the mother herself named as her worry. It is correctable in one sentence. Then:

- One letter slot is reserved for one true sentence about that subject at minimum every fourth letter, and in every letter where there is anything true to say. This overrides the peak-picker.
- The sentence is one of, in order: a movement transition, a newly implied confirmation, an already-lit ability used again, a ready-next with receipts, or the honest slow answer.
- The honest slow answer is allowed and is the point. Growth framing does not mean pretending.

> You told me in October that reading is the one you think about. Here is where it is right now: Sam sounds out three-letter words on his own, and the thing sitting open next is words that start with two consonants together. It is moving slowly, and it is moving.

When genuinely nothing moved:

> Reading did not move this week. What is under him is still under him: he reads three-letter words on his own and he knows every letter sound. If you want, there is a ten-minute way into the next piece whenever you have it.

**Everything else for this child.** His letter is exactly three items like every other child's, via the fallback chain. The movement marker (R4) fires for him and for every child at every level, so the category is never legible as his. The certificate is never mentioned, never previewed, and has no progress indicator, so he cannot be seen to be far from one. No inactivity nudge, ever, in any wording, on any surface.

### B. The quiet week

**Definition.** No parent-initiated signal in the window. Homa's own activity never counts, which `apps/web/lib/activation/signals.ts:18-38` already gets right.

**Behavior.** The letter still fires. It does not manufacture a win and it does not skip. Three items, all honest, all dated, drawn from the deeper rungs of the chain. An implied ability is a real derived fact with no date attached, so "still true" is defensible where "new this week" is not. No ready-next, no suggestion, no question.

> This week was quiet. Story still counts past twenty and still sounds out three-letter words on her own, and none of that went anywhere.

**The sameness fence.** Quiet weeks are most of this mother's weeks, and four near-identical notes read as automation, which costs more trust than skipping would have. So: no ability may ground two consecutive quiet-week letters, and after three consecutive weeks at fallback depth 5 or greater, the opening changes and Homa makes one offer, once, then never mentions it again.

> These have been quiet for a stretch, and quiet stretches are normal. If you would rather these came monthly for a while, say the word. If two minutes ever turns up, three questions would light a good part of Sam's map.

**Never.** Nothing that states or implies an accounting of the week. No "nothing happened", no elapsed time, no count of quiet weeks.

### C. The family of four, one thriving and one not

- **Four letters, not one letter with four sections.** Joint evaluation is the mechanism, and no careful copy undoes it. The composer sees one child. Send order rotates weekly. Per-child mute that does not mute the others. The repo already ruled this way for memory entries, refusing one entry covering two children precisely because it puts the siblings side by side every time it is read.
- **The floor runs both directions.** Ivy's letter is never shortened to make room for Sam's, and Sam's is never shorter than Ivy's.
- **The comparison guard, in code.** Extend `packages/core/src/map/narrative-gate.ts`, which already enforces sibling names, allowed numbers, banned words including "behind", and diagnosis phrasing per piece at runtime, to cover agent-composed emails, printables, and chat. Scope it to numbers and ranked labels, never names, or it blocks the household view and legitimate multi-child surfaces. Keep the prose law in `instructions.md` alongside it, because the guard cannot catch a comparative sentence carrying no figure.
- **Fix the live hazard first.** `apps/web/components/dashboard/kid-pill.tsx:20-44` emits "Ahead ✦", "On track", and "Growing right now" on the per-kid page header, one tap from a sibling's page. A standing chip that ranks a child is a comparison the kid switcher makes trivial to perform. Remove the ranked labels.
- **Coverage is not ability, on every count.** In production, family a64e1ba5's 12-year-old has 10 `easily` answers and the 7-year-old has 36; c9e840dd's 8-year-old has 14 and the 6-year-old has 45. Age bands ask older children harder questions and implied closure pushes the other way, so a bare cross-child number is not merely unkind, it is wrong. Every count renders with what it measures, in one short clause, with Homa as the actor.

> Sam's map is young. It is built from six things so far, and each one you add lights more of it.

- **The household view.** Ship the union derivation over the family's effective evidence and render it unattributed by default. A plain grouped list is fine for v1; the sky can come later. Attribution is per ability and on demand only, never aggregated, never sortable or filterable by child. It is an additional frame she chooses, never a replacement for his own page. It also fixes a live defect: `resolveProgressChildId` degrades "family" to `childIds[0]` (`apps/web/lib/view-context.ts:46-56`), so "Whole family" silently means the first kid today.
- **The question she actually asks.** When she types "is Ben behind his sister?", Homa has a designed move, because today the model improvises at the highest-stakes moment in the product. Name the worry, stay entirely with the child she named, one true concrete thing he does now, the one ability sitting open next, one small way in. Never answer the comparative question, never say the banned word back, never mention the sibling.

> I hear the worry in that. Let me stay with Ben. He reads three-letter words on his own now, and the next thing open for him is words that start with two consonants together. Want a ten-minute way in?

- **The quiet child's own invitation.** 11 of 25 multi-kid production families have a child with zero evidence rows beside a sibling with up to 45, so his map renders empty one tap away. The cause is parent coverage, not the child. Trigger on evidence count, never on elapsed time. His own letter opens with a two-minute, three-question offer aimed at his map, at most once per child per long window, no escalation, no second ask, no badge, no warning color. It never mentions the gap, the time, or the siblings. For a child who is in Homa but not being homeschooled, Homa asks once, stores the answer, and stops forever.

> If you have two minutes, three questions would light a good part of Sam's map. Happy to wait until you do.

### D. The mother who just said something painful

**Trigger.** A model classifies each inbound message into a small enum: `none`, `frustration_logistics`, `distress_about_child`, `distress_at_homa`, `grief_or_crisis`. Code applies the fence for the last three. Both distress shapes are attested, one verbatim from production ("This looks awful. The images are not even coming up..." `apps/web/lib/child-progress/journal-recall-corpus.ts:223") and one from the journaling fixtures ("I am so tired of fighting about school every single morning", `scripts/fixtures/journaling-trigger.ts:177`).

**Behavior.** A 72-hour hold on the family's proactive channel. It suppresses the letter, every celebration, every ready-next, and every share offer. **It adds no new outbound message**, because the founder ruled the Friday letter is the only proactive beat. Presence happens on her next inbound turn: Homa's first line acknowledges, without celebrating and without fixing.

> Yesterday sounded heavy. Nothing from me about the week today. I can take one thing off the list, or we can just talk.

**Storage.** A timestamp and a coarse tier only, never the words. `apps/web/agent/instructions.md:289` forbids storing anything shared in acute distress and that is not relaxed here.

**Expiry.** The hold expires on its own, never announces itself, and the suppressed letter skips rather than doubling up. The next letter says nothing about the gap.

**Still allowed during a hold.** If she volunteers a win, the in-turn response (R1) still happens, because it is her news and she raised it. No share offer, no ritual offer.

**The other side of the same coin: closing a hard season.** When she says, in her own words, that she is stopping, quitting, dropping, or switching a named curriculum, subject, or term, Homa may offer, once, inside that turn, a closing ritual rather than a fix. Gated on an explicit statement naming a verifiable object, never on inferred tone, because a false positive here means Homa told a tired mother her year went badly, which is the single most damaging sentence this product could produce.

> You said handwriting this term was rough. If it would help to close it out rather than carry it, you two could write down what did not work, put it in a box, and pick one thing worth keeping. Only if that sounds right to you.

### E. Five more that will happen in the first month

**"He cannot actually do that."** Every lit ability is contestable in one tap. The correction writes an evidence row with source `correction`, and because an explicit answer always beats implication (`abilities.ts:139-141`), a corrected implied ability structurally stays dark with no new mechanic. Homa thanks, never argues, never re-lights from the graph. Any certificate whose eligibility depended on a corrected node is withdrawn from offer.

> Thank you, that is exactly the kind of thing I get wrong. It is off Nora's map. It came from her multiplying two-digit numbers on the fourteenth, which implies it, and implication is not the same as watching her do it.

**"He used to read those and now he will not."** Automatic mastery decay is banned; her own report is not. The report writes a `not_yet` row and the node's state changes honestly. The lit-node count does not fall, because a node stays lit as a node. **The list of firsts is never edited by a regression.** History does not un-happen.

> I have written that down as it is today. The day he first read them is still on his list of firsts, because that day happened. Do you want a small way back in, or leave it for now?

**The first two weeks.** Every fallback chain draws on history a new family does not have. The letter does not fire until the child has at least three lit abilities and the family is at least seven days old. Before then, celebration is entirely in-turn (R1). The coverage clause carries the explanation, and the first letter says it is the first.

**The second adult.** Per-adult opt-in, per child, per-child mute. Never auto-add a co-parent to a wins recap. A skeptical co-parent receiving unrequested celebration about a child he thinks should be in school is a harm Homa would have caused, and the recap's recipient is currently unspecified per adult.

**Deletion and departure.** One-tap full export of any child's record at any time, free, including after cancellation. Per-child erase removes evidence rows, firsts, kept clips, and pending offers. Nothing is ever sealed or immutable, so a sentence she regrets about a struggling child is always retractable. Kept voice clips are the first thing removed on erase.

### F. The model-judgment budget

Five judgment surfaces, each proposing structured output that code verifies, per the models-judge-code-verifies law:

| Judgment | Cadence | Code verifies | Eval fixture set |
|---|---|---|---|
| Letter composition and peak pick | 1 per child per week | Slot exists, no `not_yet` or `frustrated`-beat item as peak, narrative gate | Production letters plus hand-built quiet-week and struggling-child cases |
| Distress classification | 1 per flagged inbound | Enum membership only, code applies the fence | The two attested production shapes plus annoyed-logistics negatives |
| Stronger-later gate (R8) | At most 1 per child per quarter | Both excerpts verbatim in their segments, same child, same family | Real transcript pairs, ratcheted |
| Named-worry sentence selection | 1 per letter carrying the rail | Item id in catalog, quote verbatim, subject matches the stored worry | Her own worry statements from production |
| Ritual form selection | At most 1 per letter | Remembered form exists and is dated, or the generic form is used | Positive and adversarial-negative routing fixtures |

A four-child family costs four letter compositions a week plus incidentals. State the number in the ticket; do not discover it in a bill.

### G. Measurement, shipped with the first rung

One instrument, one ticket, alongside R6: per-child letter opens over weeks (not sends), per-child mute rate, offer decline rate, `conversation.offer_fulfilled`, correction rate per lit node, and the share of letters filled at fallback depth 5 or greater. Kill conditions, stated up front: if per-child opens decay below 40 percent by week eight, the letter is wallpaper and its shape changes or it stops. If the correction rate on implied abilities exceeds 10 percent, R5 pauses until the graph is fixed. If offer declines exceed accepts three to one fleet-wide, ritual offers come out of the letter entirely.

---

## 6. Build order

### v1, the first four weeks, in this order

1. **The comparison guard and the kidPill fix.** Remove the ranked labels from the per-kid header; extend the narrative gate to agent-composed emails, printables, and chat. Safety floor first, because everything else adds surfaces it must cover. **S**
2. **The receipt spine.** The list of firsts (with subject markers and the first-ever row at the top), the provenance viewer, and the second read-time projection that renders evidence as portfolio lines. Deterministic, no migration, one pattern. **S**
3. **The in-turn moment.** `celebrated_at` on `child_progress_evidence` (additive, may lead the deploy), plus the calibration rule. **S**
4. **Coverage is not ability.** One clause on every count, everywhere a count renders. **S**
5. **The question she actually asks.** The designed chat move for the comparative question. **S**
6. **The Friday letter.** Per child, per adult opt-in, three-slot floor with the fallback chain, peak last, the named-worry rail, her Friday not the calendar's, Sunday closed at the delivery layer, the existing weekly cap and delivery window, the hard-day hold, the honest quiet week with grounding rotation. This is the large ticket and everything above is its prerequisite. **M/L**
7. **Free credit and the door that opened**, as the single graph moment inside the letter. **S**
8. **Correction and regression paths**, with the firsts list explicitly immune. **S**
9. **The measurement instrument and the eval fixtures.** Not deferred. **S**

### v2, weeks five to ten

- Your own words, answered (R7)
- What ninety days looked like (R10)
- The ritual layer: remembered family forms, the five-minute marker, the dinner question, one offer a week with the decline ledger
- The area completion certificate with the code eligibility floor and the dated back page, plus a `certificate` kind
- Then and now, deterministic worksheet pairs only
- The portfolio packet, the year-on-one-page front matter, the private state crosswalk, and unconditional export
- The household view: union derivation, unattributed, grouped list
- The quiet child's own invitation
- Share at the moment of pride, bound to a genuine first
- Kept voice clips, if D1 rules yes

### On the shelf, with reasons

| Not building | Why |
|---|---|
| Every mailed physical object (poster, stickers, year book, postcard) | Permanent, unrecallable, arrives at different rates for siblings in one house, and $5 to $38 per unit for unproven payoff |
| The bound year book | Fabrications with a spine; a 40-page returned product instead of a one-page retry |
| Constellations (hidden completion sets) | Set-completion tension hidden rather than removed; any leak converts the best moment into a checklist of holes; 40 to 60 authored figures over a taxonomy still growing |
| Above typical / advanced signals | A giftedness label with a denial attached; its own mitigation is unachievable once a sibling receives one the same day |
| The evaluator share link | Largest egress surface in the product, to save attaching a PDF she was already going to send |
| Transcript spine | A 2033 feature against a July 2026 deadline; reintroduces grade level for a seven-year-old |
| Immutable filed archive | Makes a regretted sentence un-retractable and fights the audio TTL posture |
| Narrated annual year story / long view | Duplicate of the year page at L effort with the full Meyer risk |
| Ritual catalog with a ceremony tier | A menu of labor for a depleted mother; the catalog is reached exactly when an imposed form is most alienating |
| One table, four jobs | The maximum comparison surface in the product, level-differentiated in disguise |
| Per-child count of firsts as a tradition counter | The exact number she will compare across her children |
| Deep-zoom easter egg | Unmeasurable, needs its own accessibility path, and sits adjacent to grief; its content is free at the top of the firsts list |
| Any coverage view against state subject lists | One design decision from a red deficit dashboard wearing a legal justification; needs its own ruling |

### Genuinely open founder decisions

Listed separately in `openDecisions`. D1 is time-critical: audio is being destroyed on a 30-day timer while the decision is open, and deletion is one-way.


---

## 7. Founder decisions (all ruled)

All seven decisions are ruled as of 2026-07-22. The rulings are also in the
build log and the founder-ruling register (`docs/homa-planning/journeys/10-reconciliation.md` §5).
Kept here in full because the plans in `celebration-v1/` were written against
the open questions.

### D1 (time-critical, one-way) , RULED

Keep their voice: may a parent retain a child utterance past the 30-day lesson audio TTL? **Ruled yes, and NOT opt-in ("if there's a good clip, let's save it for them; they don't need to opt in").** Narrowed the same day and SHIPPED (PR #122): Homa keeps the WHOLE lesson, not a trimmed clip, because the transcriber returns no word timings and no diarization, so a clip of "the child's own voice" cannot be verified. The parent is told on the review page and deletes it in one tap. See `keep-their-voice` ruling.

### D2 (blocks the certificate R11) , RULED

What may a certificate say when a child will read it? **Ruled: the child's first name, what they can now do in warm plain words, the date, and "at home."** No score, no ranking, nothing a sibling could be measured against. The parent decides whether to print it and hand it over. This is the narrow exception to no-child-facing-view: a parent-chosen physical object, never a screen Homa shows the child.

### D3 , RULED (overrides the spec's recommendation)

May the portfolio be mentioned proactively? **Ruled: yes, Homa MAY proactively remind families in states that legally require a portfolio, ahead of their deadlines.** This overrides the recommendation of on-request-only.

Consequence to reconcile, not a contradiction to hide: the spec elsewhere calls the Friday letter "the only proactive beat" (§2 R6, §5D). That invariant now has ONE narrow, legally-grounded exception: a portfolio-deadline reminder for a family in a state that requires one. It is not a celebration beat and does not ride the letter. Building it needs the family's state, per-state deadline data, and the private state crosswalk (§4), so it is a larger commitment than "on request" and has no build plan yet; scope it separately. It must still never invent a date, never nag, and stay a reminder rather than a countdown.

### D4 , RULED

Deletion and departure. **Ruled: a family can download their child's full record for free for as long as the account exists (until they delete it), indefinitely, including after cancellation.** Nothing is ever sealed or made immutable, so a parent can always retrieve the record or delete a sentence they regret. Kept voice clips live with the record and are removed only by per-child erase or account deletion. The grace-period-then-delete alternative was declined.

### D5 , RULED

The second adult. **Ruled: the Friday letter defaults to the adult who has been reporting evidence for that child only.** A second adult opts in explicitly, per child, and can mute per child without affecting the other adult. Auto-including both parents was declined, because it risks sending unrequested celebration about homeschooling to a co-parent who may be skeptical of it.

### D6 , RULED

The named-worry rail. **Ruled yes: the subject the mother named as her worry gets one true sentence at minimum once a month, including the honest slow answer when nothing moved** ("reading did not move this week; what is under him is still under him"). Minimum cadence is monthly (every fourth weekly letter), not every letter. This deliberately places a non-celebratory true sentence inside a celebration beat, so Homa is never seen to be avoiding the subject the mother cares about most.

### D7 (live surface, verified in code)

The standing chip on the per-kid page header. `apps/web/components/dashboard/kid-pill.tsx:20-45` emits one of "Ahead ✦" (gold), "On track" (sage), or "Growing right now" (sky) from the child's scored subject positions. It is live today.

What is verified, and what is not: `BANNED_WORDS` (`packages/core/src/map/copy-laws.ts:12`) bans "behind" but not "ahead", and the narrative gate that enforces it runs only over model-composed prose, never over hand-coded chips. So this chip breaks no rule the codebase currently states, which is why it is a decision rather than a bug fixed on sight.

The hazard is structural rather than lexical. The chip is a ranked standing label attached to one child, and the kid switcher sits directly beside it, so a mother of two reaches "Ahead ✦" and "Growing right now" one tap apart. Homa performs the comparison for her; no wording inside a single chip prevents that. "Ahead" also implies its complement, which is the one word the product has banned everywhere else.

Three options: (a) leave the chip as it is; (b) keep a per-child chip but drop the ranked vocabulary for something non-comparative and factual ("6 abilities so far", "last seen Tuesday"); (c) remove the chip from the per-kid header entirely and let the page's own content speak. Recommendation is (b): the header still says something, and it stops saying something that only means anything relative to another child.
