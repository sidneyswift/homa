# Findings: what two weeks of real use actually shows

Evidence notation: timestamps are America/New_York. "Call" rows come from
`call_transcripts`, chat from `conversation_messages`, materials from `materials`.
Family `304f0003-6c55-4c31-807a-941aff214283`. Where a finding overlaps an open
issue, the issue is named; where it is new, it feeds [05-bugs.md](05-bugs.md) or
[04-features.md](04-features.md).

> COUNCIL CORRECTIONS (06-council.md): B1's "nowhere durable to land" is
> overstated (save_homeschool_profile.curriculums[], the curriculum atlas, and
> chat_attachments all exist and were not invoked; the 07-23 loss was routing,
> not a missing plane). D4's missing hours UI is stale: the per-child hours
> surface shipped 2026-07-26 (PR #228); the still-real gap is that the web
> agent has no read path over hours_log. B2's QC diagnosis is corrected in
> 06-council.md item 1.

## A. What works (keep doing, and say so out loud)

**A1. Themed materials are the wow.** "I made her a Kirby. She's so happy about it"
(transcript). Alma "foaming at the mouth waiting on the printer" for her curvy
worksheet. The interest memory loop works end to end: `family_memories` picked up
Kirby, Astro Bot (with visual detail: "white-and-blue robot with round eyes"), and
Rocket Math milestones on 07-28, and materials reflect them same-day. Specific
prompts with a named child, subject, and theme produce usable output in one round
(Doctor Who Whoniverse page, Poseidon fractions, the Spanish-baking coloring page
the transcript praises).

**A2. Hours capture is trusted and habitual.** She logged hours via SMS on 07-10,
07-17, via phone call on 07-25 (3h science, 1h social studies, 30min geography from
the NYC museums), via chat on 07-27 (45min read-aloud). The phone hours-logging
that the 07-25 field check verified is now a habit. What is missing is the read
side (D4 below).

**A3. Life-level concierge deepens the relationship.** On 07-24 she ran her whole
NYC day through Homa: subway routing, museum hours, a tired 6-year-old contingency
re-plan, cab car-seat law, rooftop with a minors-curfew warning. This is the
"super Homa" north star her own words define: "no separations between home and
school" (07-25 evidence file). It also produced the failure evidence in D6/D7.

**A4. Honesty copy has visibly improved mid-window.** 07-16: Homa claimed the
scavenger hunt was ready when it was not, then corrected. By 07-26/27 the failure
copy is exemplary: "I'd rather tell you it didn't go through than pretend it did",
and the 07-27 06:38 reply audits the file itself "not just what the last message
claimed". The honesty investment is landing. The remaining violations are
structural (QC false-pass, D2), not tonal.

**A5. She is already trying to build the family library herself.** 07-23 18:19:
"Can I take pictures of all the books I have so you can reference books I have for
lessons?" Homa said yes. On 07-27 she sent 9 book-cover photos ("Read all of these
to the girls today"); captions correctly identified all titles. The demand side of
the ingestion engine is proven; the supply side (durable, tagged, retrievable
storage) does not exist. See B1.

**A6. The state pack shipped 07-28 and she used it the same day.** "Your District
of Columbia pack" is `final` in her materials, dated 07-29 00:49 UTC.

**A7. The positioning writes itself.** Her tagline: "she does everything but
teach. Because that's your job." Homa's own self-description on 07-23 SMS (the
"describe yourself to a friend" exchange) is close to shippable marketing copy.

## B. The headline product gaps

**B1. Ingested context has nowhere to land (the family knowledge plane).**
The single most expensive loss of the window: on the 07-23 call she dictated her
entire curriculum stack (Blossom and Root per grade, Horizons, Beast Academy
Online, Beautiful Feet Books, plus gaps in art, music, PE) and her Yoto setup.
What survived in `family_memories`: the Yoto player and jiu jitsu. The curriculum
stack, the request for recommendations, and the promised research email all
evaporated (zero `email_sends` rows on 07-23/24). The 10 photographed book titles
on 07-27 were acknowledged in chat and never durably recorded either. The
transcript's asks are precise:

- Subject and entity tagging on every asset ("this is about Christopher Columbus",
  "the Mayflower", "all the books about bunnies for age three").
- Curriculum decomposition: ingest the whole curriculum AND each lesson within it
  as its own retrievable unit ("she has a language arts curriculum for that age
  but she isn't ingesting all of the subjects or the titles of the books").
- Retrieval at planning time: "we're learning about insects, I want her to pull
  everything we put in there about insects", "oh Anna wants to read A Wrinkle in
  Time, I have all this stuff about A Wrinkle in Time".
- Week-aware curricula: "my curriculums tell you what you're doing every week...
  so when I go in on week eight and say I need a supplemental worksheet for
  science, she knows what we're talking about."

The fleet corpus plan (gh#328, PR #329) deliberately covers the fleet plane
(anonymous, training-oriented). This is the missing third plane: family-owned,
tenant-scoped, retrieval-oriented. See [04-features.md](04-features.md) F1.

**B2. Materials converge too slowly, and the QC lies.** 166 material rows in 14
days. The Amalia living/non-living packet: requested 07-23 16:25, `final` 07-27
13:00, roughly 60 revision rows across 5+ sessions, including a session past
midnight. The dominant failure class is layout, not content: empty bottom space,
cut-off pages, images too small for a 3-year-old's scissors or crayons, tracing
lines that do not fill the row. Nearly every revision reply claimed "it passed the
quality check" and was immediately contradicted by her next message. On 07-28 the
handwriting sheet failed the same "letters don't fill the line" check twice and
Homa correctly concluded the page was over-packed, then hit tool downtime. The
transcript diagnoses it the same way: HTML-mode worksheets are the failure locus;
image-mode is more reliable but rationed (the illustration budget cap visibly bit
on 07-23: "my image generator for illustrated art is tapped out for today").
See F6 and bugs FB-2, FB-7.

**B3. The binder hides the work (drafts, versions, and "where is it?").**
Three distinct sub-failures, all confirmed live:

- Draft stranding: 07-27 09:39 "I dont see my packet... in my binder" answered by
  "both were still sitting as drafts, which don't show in your binder view". On
  07-28 a finalize save timed out on two materials and they remain `draft` today,
  as do the meeting-day Artemis, Kirby, Astro-Bot, and handwriting sheets
  (issues #197, #241, #175 now have their strongest evidence).
- No version history: the transcript verbatim: "as soon as she redoes it I can't
  see the old version... I have to start screenshotting." The `materials.revises`
  chain already stores every version; this is purely a surfacing gap. See F5.
- Deliverable invisibility: "Where is it?", "Where is my scavenger hunt?",
  "Where is almas packet" (three times in 90 minutes on 07-27), "Where is amalias
  worksheet" (three times on 07-28). Whether each instance is a phantom card, a
  mobile silent render (#256), or late paint (CG-06 / #170 class) needs per-turn
  telemetry, which still does not exist. See FB-4.

**B4. The calendar is where she wants to live, and it is not connected.**
07-17 SMS: "Can I add my own curriculum to my calendar check off list?" (Homa: no
visibility into the planner from SMS). 07-22 web: "Can you add a calendar to my
planner where I can keep track of everything?" Month plans cannot be started by
Homa at all ("that's a one-tap button in each of their progress reports, I can't
create one from nothing"), an authority inversion where the agent redirects the
parent to UI chores. The transcript's target state is explicit: plan the four
weeks, see it on the calendar by kid, click a lesson, print what is attached,
check it off, photograph the result, log the time. The one-planner arc (#255,
#258-#267) is the substrate; what it lacks is the curriculum feed (F2) and the
material attachment loop (F7).

**B5. One brain across channels is still three brains.** Repeats of the known
class, plus new instances: 07-23 12:49 web/SMS could not find "our call earlier
today" (call ended 11:34 ET; hourly cron sync). 07-25 16:48 web said "nothing from
the NYC trip has been logged yet" three hours after the phone call logged 4.5
hours of it. The transcript: "I already had my therapy session with you. I'm not
going to do it again." Covered by #171/#278/#287; this study adds fresh evidence,
not a new arc.

**B6. Voice promises have no fulfillment engine.** The 07-22 04:20 call promised
post-call worksheets for each girl: delivered 8 hours later, but 2 of 3 diverged
from the promised trip-review content (Ara got generic rocket math, Alma got
Poseidon fractions). The 07-23 call promised a curriculum-recommendation email
with Yoto links: never sent, zero email rows, and when she chased it twice she got
status narration instead of the deliverable. The offer-recovery engine (#198)
watches morning-brief offers; in-call promises are the same class on a channel
with zero coverage. See F10 / FB-6.

**B7. Interest theming needs a dial, not a switch.** The transcript is a design
spec: theming has levels (a sticker-level Astro Bot at the top vs an immersive
Whoniverse where the math problems live in the fiction), older kids detect
imitation ("anim was like, you need to get me more Emerson because they're gonna
know"), some subjects must not be themed (reading real literature), and
over-theming burns the interest ("they're going to get sick of it"). Her proposed
interaction: blanket-create unthemed, then offer "I can update this based on
Amalia's interests" per item. See F4.

**B8. Material taxonomy: worksheet vs lesson vs unit study vs curriculum.**
The transcript defines the ladder: worksheet (supplement, smallest unit), lesson
(multi-page: hook/explainer, worksheets, answer key), unit study, four-week
curriculum as the hard ceiling ("your child changes; four weeks is the perfect
amount of time to get the data to make the next four weeks"). Answer keys should
be default for anything with answers (she had to request one for parts-of-speech;
Homa printed it upside-down on the same page first). The `materials.kind` enum
already distinguishes worksheet/packet/coloring/game; the request ladder and
answer-key defaults live in the skill layer. See F3, and F9 for the four-week cap
as policy.

## C. New bugs confirmed this study (full detail in 05-bugs.md)

- FB-1: web chat input truncates long messages at ~1500 chars (her 07-25 edit list
  stored at exactly 1502 chars, cut mid-word; Homa saw the truncation).
- FB-3: lesson recording cannot be reattributed, and the agent is blind to
  lesson recordings entirely (07-27: three asks, "I don't see any recording
  anywhere" while `lesson_recordings` held her 28-minute Alma-attributed row).
- FB-5: video and screenshot fallbacks summarize instead of transcribe; she sent
  a screen recording of her own truncated message and Homa could not recover the
  text from it, nor from the follow-up screenshot.
- FB-6: in-call promises have no fulfillment ledger (B6).
- FB-7: create_printable was unavailable for stretches of 07-26 and 07-27 with
  honest apologies but no operator-visible alert; she was told to "report it to
  the Homa team" (the product asking the user to be its pager).
- FB-8: 17 "Minimal Test" / "Diag" debug material rows sit inside this real
  family's data from 07-23 debugging (superseded status; invisible today, but any
  draft-surfacing UI would expose them; hygiene and trust issue).
- FB-9: assistant replies visibly truncate mid-sentence on long answers (the
  NYC itinerary cut off twice, forcing "Where is my nyc scheduke", "I didn't get
  first half of day").
- FB-10: STT hears "Homa" as "Alma" (a child's name) on calls; transcripts store
  "Thanks, Alma", a journaling misattribution hazard.

## D. Demand signals worth pricing in

- D1. "It would be a million times easier if she was just an app... I would just
  be clicking her face on my phone." (#299 iOS arc is the answer; her words are
  the App Store copy.)
- D2. Morning delivery: "she just sends you what you need when you wake up
  because she knows tomorrow's lesson, and you've approved it, and you just
  print." (F7; morning brief + planner + materials convergence.)
- D3. Whole-computer backlog: "a whole computer full of the last six years I've
  been homeschooling that I wasn't able to upload until now." Family ingestion
  must accept bulk, not just one photo at a time.
- D4. Hours read-side UI per child (CG-02, #172-adjacent): she logs constantly and
  still cannot see per-child running totals anywhere.
- D5. Laminating and flashcard workflows: she laminates cards; "cut into separate
  flashcard-sized pieces" was offered by Homa and is a real format need (F3).
