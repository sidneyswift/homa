# Tickets: Alessa's live read-through of the first LLM-written report

Source: recorded walkthrough 2026-07-07 (~10:30 PM), founder + Alessa
reading Story's report (age 3y 7m, 16 subjects, 41 observations), the
first real-parent contact with the narrative layer, the living-record
drawers, and the plan pages. Transcript: text-4776-B002-FD-0.txt.
Extraction date 2026-07-08. Ticket IDs RT-01.. (read-through).

What landed well, for the record: the note's reassure-first framing
("makes me feel at ease... telling me not to put pressure, I do like
that"), the synthesis pointing at ONE lean-in ("turning bathroom trips
into the same playful rhythm as the button board"), "Where to take music
next" ("that right there is the winner for me"), week-3 explaining WHY
it repeats ("I love that simple summary"), the live-music-moment idea,
and citations landing on a legitimate source ("not some random
Wikipedia page").

## P0 · Bugs seen live

- **RT-01 · Whats-working save button dead on strength cards.** She
  typed into the box on the Music strength card, tapped Save, nothing
  happened, no error, no hint ("the save button's not working, so I
  don't know what's happening"). Likely the migration gap window: her
  device cookie hashed to a lead-world resume token that was never
  backfilled onto families (and the lead table is now dropped), so
  /api/map/extras 401s; the no-session hint may also not render in the
  card context. Fix: verify her session recovers via the signed-in
  fallback door, make the failure state VISIBLE (never a silent dead
  button), and add "sign in" as the hint's action when a session exists
  but a cookie doesn't.
- **RT-02 · Self-care plan build stalled or errored live.** End of
  session ("See if I'm on track. Crap." / founder: "redo it... refresh"):
  building the self-care month visibly failed or hung. Investigate
  map.narrative_fallback + function logs for Story's self_care plan
  (~03:30 UTC 07-08); likely the plan writing beat never resolved.
  Whatever the cause, the beat needs a visible recovery path after the
  stale window instead of an indefinite spinner.

## P1 · The report says everything three times (information architecture)

- **RT-03 · Kill the note/synthesis redundancy.** "The note from Homa at
  the top is enough... that second paragraph, although lovely, is just
  redundant." Ruling direction: the note carries the summary; the
  synthesis piece must carry ONLY what no other piece has (cross-subject
  interpretation + the one lean-in), at half its current length, or be
  folded into the note entirely. Prompt change + version bump.
- **RT-04 · One evidence view per drawer, not three.** Inside a subject
  drawer she saw the same three facts as: the drawer paragraph, "The
  path so far" ladder, and "What I asked · your answers" receipts.
  Verbatim: "We need to pick one of these... pick one and then
  benchmarks checked against, and that's it." Direction: receipts stay
  (she explicitly wants to audit "where are you getting that
  information"); the ladder renders only when it adds an unanswered
  next-up rung; the drawer prose must interpret (what it means, what's
  next), never re-list what was answered. Note: the stacking is partly
  from tonight's living-record additions; this is the corrective pass.
- **RT-05 · Plan page: "This month, in short" duplicates "What this
  month aims at".** "I need one of these, not two." Fold the
  deterministic targets list into the narrative intro when narrative is
  ready (targets render only in template fallback).
- **RT-06 · Plan intro must not recap the report.** "It's recapping
  again." The plan writer should assume the report was just read: open
  with the month, not the diagnosis.
- **RT-07 · Sources deep-link to the exact page.** CDC link lands on the
  milestones index; she wants the age-specific page ("it would be nicer
  if it took me to the exact page"). Add per-item or per-age-band source
  URLs to the bank where the source supports it (CDC has per-age pages);
  fall back to the current top-level link.

## P1 · Voice (prompt v-next, regenerate fixtures, read-aloud)

- **RT-08 · Shorter, plainer, less poetic.** Founder verdict: "she needs
  to be shorter, she needs to not be so weird." The named offender: "a
  mind soaking in the world with real joy" ("sounds weirdly poetic").
  Craft rules to add: concrete over lyrical, no metaphor stacks, no
  poetry; cut length budgets for note (shorter) and synthesis (roughly
  half); every sentence must carry a fact or an action.

## P1 · The strength card is the wrong surface for the whats-working ask

- **RT-09 · Tapping a strength card should open the subject, not a text
  box.** Her expectation: "I would much rather push on this box and see,
  since he is so ahead, what else I can do." Make the card tap open that
  subject's drawer (or a strength-specific "where to take it next"
  view); the current in-card note box confused her twice.
- **RT-10 · Re-home and re-frame the whats-working capture as an actual
  question.** "It's not even a question... a terrible place to put it."
  The capture belongs where the conversation is (inside the drawer next
  to "where to take it next", or as Homa's follow-up question in
  chat/evening check-in), phrased as a question ("How did you get music
  this strong? What are you doing?").

## P2 · Plan architecture: one month, not sixteen

- **RT-11 · One unified monthly plan for the whole child.** Founder:
  "should it just be one four-week plan for all subjects combined?"
  Alessa: yes, weighted: core subjects (literacy, phonics, writing,
  math, fine/gross motor, self care) always present, the growing ones
  carry the emphasis, electives (music) sprinkle in. Replaces the
  16-per-subject plan buttons as the primary CTA; per-subject plans can
  remain as a drill-down.
- **RT-12 · The plan is an ADD-ON, never a replacement.** "Every mom
  already has her next four weeks planned... Homa just needs the lowest
  amount of effort that visibly moves a number." Frame the month as
  supplements to her existing curriculum ("the one hour on Wednesday
  that moves social studies"), not a schedule takeover.
- **RT-13 · Lead with the growth focus after the celebration.** The
  subject list is strengths-first, so gross motor (the one growth spot)
  sat at the bottom and she never reached it. After the note celebrates,
  the report should name this month's ONE focus and link straight to it
  ("we're going to focus on gross motor; two points moves Story from at
  age to ahead"), without breaking the strengths-first and anti-guilt
  laws.
- **RT-14 · Concrete media, not template fills.** "Find the songs of
  trucks. Learn one together" reads as nonsense. Two layers: (a) fix the
  interest-fill grammar in the deterministic patterns; (b) let the plan
  writer name REAL examples (actual song titles, with a YouTube/Spotify
  link) when the plan calls for media. She asked for "a drop-down for
  this week's curriculum of music to try with him."
- **RT-15 · Local events in the plan month (needs zip).** "Homa should
  be asking my zip code... suggest a couple concerts in my area to go
  along with this curriculum." Note: the PRD explicitly non-goaled a
  local-data engine for D0; log as the first post-conference plan
  upgrade, zip collection can ship earlier (one optional field).
- **RT-16 · Suggestion-to-score attribution.** The founder's loop: "Homa
  gave me this idea → the number moved → I can SEE Homa's suggestion
  increased the score." Practice lines (tonight's build) are the seed;
  extend so a completed plan's subject movement is explicitly credited
  on the next report (temporal never causal, per law).

## P2 · The habit loop (the "you got the report, now what")

- **RT-17 · Evening check-in: Homa asks, the parent voice-notes.** The
  co-designed shape: end-of-day text or call ("Did you get to reading
  today? What did you do in math?"), parent replies with a voice note or
  text, Homa answers with recognition ("Story did this, and I remember
  he did that one thing"). Telnyx SMS/voice groundwork exists behind
  flags; this is its first product loop. Opt-in, per the email doctrine
  extended to every channel.
- **RT-18 · Show THE line chart.** "The one I see in Slack is
  incredible: watching your child move up that line." Elevate the
  longitudinal line graph to a prominent report surface (tonight's
  rising sparklines are the seed): per-subject line over time, plus the
  founder's dotted-projection idea ("where you could be in a week/month
  if this keeps up"), projection framing must stay an offer, never a
  promise or a deficit.
- **RT-19 · Shrink the loop below a month.** Founder instinct: "do this
  ONE thing, tell me about it tonight, and watch this line." Explore a
  weekly micro-goal on top of the monthly plan: one named action, one
  check-in, one visible nudge on the chart. Alessa pushed back that
  months are fine for metric movement; the synthesis: month for
  numbers, week for habit.
- **RT-20 · Daily artifact, personalized to teaching style.** The
  worksheet debate: worksheet moms get the Paw Patrol letter-L sheet;
  unit-study/Montessori moms get a no-paper activity card for the same
  skill ("here's an activity to learn L without paper and pencil").
  Styles are already collected in extras; this is the personalization
  hook. Scope as the emailable/printable "one-pager" experiment.

## P3 · Backlog, needs a founder call before building

- **RT-21 · Shoppable suggestions tied to plan effects.** Alessa: "check
  out Homa's list of self-care items... get your child intrigued by
  these new undies." Founder skepticism on record: "would you buy those
  undies right now from Homa? No." Only viable attached to an effect
  ("these are part of the reward system that gets X"). Park until the
  habit loop exists.
- **RT-22 · Onboard the habit explicitly.** "It took two months of me
  being like, did you update Homa?" The report-to-habit handoff needs
  teaching (a first-check-in walkthrough, possibly the recall-style
  call for new signups). Pairs with RT-17; design together.

## Sequencing note

RT-01/02 tonight-adjacent (bugs, live user). RT-03..RT-10 are one
coherent "the report respects your time" pass: prompt + drawer IA +
strength-card rehoming, one PR, one fixture regeneration, one read-aloud.
RT-11..RT-16 are the plan re-architecture (biggest product change here;
worth its own design pass against the PRD before code). RT-17..RT-20 are
the habit loop, the founder's own "now what" answer, and the first real
consumer of the Telnyx groundwork.

## Status (2026-07-08 morning pass, "fix everything")

Shipped in this pass (build-log 2026-07-08 has the details):

- RT-01 SHIPPED: diagnosis first: her writes all landed (context_added
  01:51, whatsWorking+styles+curriculums 02:09 UTC), so the session
  survived the migration; the sin was a SILENT failure path. The form
  now renders every state visibly (saved, failed, no-session with the
  sign-in hint), and the capture moved into the drawer (RT-10).
- RT-02 SHIPPED: the self_care plan row + narrative both landed
  (02:31:25 built, 02:31:37 narrative ready, no fallback events), so
  the stall was the beat's lack of an exit, not a dead generation. The
  writing beat now offers "refresh now" after 90 seconds; the
  narrative-status self-heal stays the backstop.
- RT-03 SHIPPED: synthesis re-specced to 60-100 words, forbidden from
  restating the note or any card line; redundancy law added at the top
  of the craft rules. Prompt v2026.07.11, fixtures regenerated.
- RT-04 SHIPPED: the ladder list is gone from drawers; receipts are THE
  evidence view, plus a single unanswered "next up" line; drawer prose
  re-specced to interpretation only, 1-2 sentences.
- RT-05 SHIPPED: when the written intro exists the targets list folds
  into a "formal targets" details element; template fallback unchanged.
- RT-06 SHIPPED: plan intro re-specced: never recap or re-diagnose,
  open with the month, framed as an add-on.
- RT-07 SHIPPED: CDC citations now deep-link to the checklist page for
  the child's age (cdcChecklistUrl, clamped to the 2mo-5yr set); other
  sources keep their top-level links.
- RT-08 SHIPPED: anti-poetry voice rule, "every sentence carries a fact
  or an action", note cut to 2-3 sentences, caps tightened in the gate
  (note 520, synthesis 700, drawer 360, planIntro 450).
- RT-09 SHIPPED: strength cards are now buttons that open and scroll to
  the subject drawer ("Where to take it next").
- RT-10 SHIPPED: whats-working moved into the drawer as a real question
  ("How did X get music this strong? Tell me and I'll borrow it").
- RT-11 SHIPPED: buildMonthPlan, one unified four-week month: up to 3
  focus subjects (growing cores first, lowest on-track cores fill), one
  strength sprinkle weeks 1 and 4, stored under the `month`
  pseudo-domain so storage, narrative, retest, and progress machinery
  are unchanged. The report's consent card now builds THE month and
  sits right after the note; per-subject plans remain as drill-downs.
- RT-12 SHIPPED: month page + consent copy framed as an add-on ("it
  adds to what you already do, it never replaces it"); prompt says the
  same to the writer.
- RT-13 SHIPPED via the consent card move: the month offer (naming the
  focus subjects) is the first actionable thing after the note.
- RT-14a SHIPPED: interest-fill grammar fixed ("Find songs about
  trucks"); 14b half-shipped: the week framing lines may now name one
  real, well-known example (song/book) with an anti-invention guard;
  linked/streamable media links are deferred with RT-15.
- RT-16 SHIPPED (prompt layer): the note connects practice lines and
  movement lines temporally when they touch the same subject.
- RT-18 PARTIAL: the growth story moved up to sit directly under the
  whole-picture chart. The dotted projection is deferred: promise-vs-
  offer framing needs a founder call.

Deferred, with reasons:

- RT-15 (local events): needs zip collection + an events data source;
  PRD non-goal for D0. First post-conference plan upgrade.
- RT-17 (evening check-in): first real consumer of the Telnyx
  groundwork; needs cadence/consent design and 10DLC to clear. Design
  with RT-22.
- RT-19 (weekly micro-goal): design question on top of the unified
  month; revisit once the month has real usage.
- RT-20 (daily style-personalized artifact): new generation surface;
  scope as the one-pager experiment after the month ships.
- RT-21/RT-22: parked P3 per the doc, founder call first.
