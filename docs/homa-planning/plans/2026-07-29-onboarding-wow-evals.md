# Onboarding: the wow bar, and the eval that decides when we have hit it

Status: proposal, 2026-07-29. Founder ask: "loop until the onboarding is
top tier and the customer never gets bored or distracted, and increases
retention over the course of the onboarding... so by the time the paywall
gets introduced, it's a no brainer."

This document is the bar and the scoring method. It does not contain the
work; it makes the work scoreable, because "loop until wowed" needs a
definition of wowed that is not one person's mood on one walk.

The arc itself lives in `apps/web/agent/skills/onboarding/SKILL.md`. This
file never restates a beat's content, only how a walk is judged.

## 1. The finding that reframes the whole thing

Every capability the founder listed as a wow moment already ships.

| Capability | Tool | Live? | Named in the onboarding skill |
|---|---|---|---|
| Make a worksheet mid-conversation | `start_first_making` | yes | 3 times |
| Show the planner | `open_planner` | yes, prod since 2026-07-20 | **0 times** |
| Long job running visibly | `start_agent_job` | yes, flag on since 2026-07-18 | **0 times** |
| Printable | `create_printable` | yes | 1 |
| The report | `score_child_report` | yes | the arc's payoff |

So the gap is routing, not construction. An un-advertised tool is a tool
Homa never reaches for: nothing errors, nothing looks broken, the beat
just quietly reads as prose. That is the same class of miss as the
interests question, which sat as a conversational ask for months while
`/api/map/children` accepted an `interests` array nobody filled.

Corollary for whoever runs this loop: before building a moment, grep the
tool directory. The cheapest wow is a capability the arc forgot it had.

## 2. Who we walk as

One ICP, held fixed across every walk so scores are comparable.

**Rachel, 34, first year homeschooling.** Two kids, 7 and 4. Pulled the
7 year old out of public school in March after a bad year with reading.
She is not a teacher and is quietly afraid she is going to do this
wrong. She has tried two curriculum sites and abandoned both because
they opened with a wall of setup. She has about twelve minutes tonight
and a four year old awake.

Two things follow from her and both are scoring rules:

- She has just paid. The dominant emotion at minute zero is not
  excitement, it is *doubt she has wasted money*. Every beat is scored
  against that, not against a neutral user.
- She is braced to be judged as a teacher. The checklist beat asks her
  to enumerate what her seven year old cannot yet do. That is the most
  exposed moment in the product and no amount of delight elsewhere
  offsets it.

## 3. The scale

Score every beat on the walk, in the moment, before knowing what comes
next. Three columns, all three required, because they fail differently.

- **Feels**: `-1` bad, `0` neutral, `+1` positive. What Rachel feels
  *during* the beat, including any wait she pays for it. A warm payoff
  behind a fifteen second spinner is a `0`, not a `+1`.
- **Who acts**: `robot` or `human`. Who produces the beat.
- **Need**: `need`, `nice`, `unneeded`. Whether the sitting fails
  without it.

The 2026-07-28 baseline, for reference and to be re-scored each pass:

| # | Beat | Feels | Who acts | Need |
|---|---|---|---|---|
| 1 | Open | +1 | robot | need |
| 2 | Setup cards | 0 | human | need |
| 3 | React once | 0 | robot | nice |
| 4 | Her kids | +1 | human | need |
| 5 | Go deep with one | 0 | robot | need |
| 6 | The questions | **-1** | human | need |
| 7 | The reveal | +1 | robot | need |
| 8 | One more thing | 0 | robot | nice |
| 9 | The rehearsal | +1 | human | need |
| 10 | A place to stop | +1 | robot | nice |

Net +4. Two patterns in that table are worth more than the total:

1. **Every `0` is a robot beat.** She feels nothing at exactly the
   moments she does nothing. Feeling comes from participating or from
   being handed something, and beats 3, 5 and 8 do neither.
2. **After the reveal she acts once in four beats.** Beat 7 is the
   natural place to close the laptop and what follows is mostly Homa
   talking.

## 4. Pass conditions

A walk passes when ALL of these hold. Any single failure fails the walk;
there is no partial credit, because the weakest beat is what she
remembers.

1. **No beat scores `-1`.** Beat 6 is the standing violation.
2. **No two consecutive `0` beats.** Two flat beats in a row is where
   attention goes.
3. **No stretch longer than 90 seconds without her acting.** Measured,
   not estimated.
4. **No single wait over 8 seconds** with nothing on screen to read or
   do. Measure from her last input to the next thing she can look at.
5. **She has received something she could keep** before the paywall.
   A report, a printable, a plan. Not a promise of one.
6. **She has seen at least one capability she was not told about.**
   Shown, not described.
7. **The last beat names something specific that happens next**, with a
   name in it: a child's name, a subject, a time.

Condition 4 exists because this session measured three separate waits
that each read as breakage and none of which were bugs: 11 to 17s before
the model's first hello (fixed by pre-warming), 2 to 6s before the first
card (fixed by app-drawing it), 16s between the two setup cards (fixed by
chaining). The remaining known offender is beat 3 at 12 to 24s.

## 5. How to run a walk

1. `pnpm --filter web dev` with `HOMA_CHAT_ONBOARDING=1` and
   `HOMA_DEV_TEST_SESSIONS=1` in `apps/web/.env.development.local`.
2. Fresh family every walk: `GET /api/dev/test-session`, or the Restart
   button on the page. Never reuse a family; a second walk on the same
   one skips the beats that matter most.
3. Walk as Rachel, in character, at her pace. Do not skip a card because
   you know what it does.
4. Score each beat in the moment, in a table, before reading on.
5. Record every wait with a stopwatch, not an impression.

**Known environment hazard:** the Supabase pooler intermittently returns
`CONNECT_TIMEOUT` from this machine, which surfaces in the UI as "That
did not save. Nothing is lost, you can try again." That is not a product
bug and must not be scored as one. Confirm with the dev server log before
recording a save failure.

## 6. The candidate moments, ranked

Ranked by feeling gained per unit of work, not by ambition. Each names
the beat it targets, because a delight with no beat is a demo.

**Wave 1, routing only. No new code, skill instructions plus data
already collected.**

- **Her child's own words during the checklist** (beat 6, the only
  `-1`). She has just said Story loves dinosaurs and drawing; that data
  is now captured by the child card. Putting `Story · dinosaurs,
  drawing` in the checklist header frames twenty minutes of "can he do
  this yet" with the warmest thing she said.
  **SHIPPED 2026-07-29, and it needed one file, not three.** The three
  file plumb this entry called for (store query,
  `OnboardingChatProps.kids`, takeover header) was not needed at all:
  `ChecklistTakeover` already fetches `/api/map/state` itself, and that
  payload has carried `interests` per child all along, read straight
  from `children.profile.interests` through `profileInterestList`. The
  change is one derived line and one span in `checklist-step.tsx`.
  Verified on screen at 1280px and at 375px, and the span truncates
  rather than pushing the time estimate off the row.
  This is the third time §1's corollary has paid: the data, like the
  tools, was already there. Grep before plumbing, not just before
  building.
  (Note while you are in there: `children.profile.interests` is the
  real column. `child_profile` is a query ALIAS in `lib/map/store.ts`,
  not a table, and writing SQL against it would 500 the way gh#333
  describes.)
- **Introduce the planner** (beat 8, a `0`). `open_planner` is live and
  the arc has never once mentioned it. Showing her a week with her own
  child's name in it is the difference between "an AI chat" and "a
  homeschool system."
  **SHIPPED 2026-07-29 and VERIFIED in walk 005**, into "One more
  thing". The beat carries two honest limits taken from the tool's own
  contract: do not narrate the week when a board is already showing it,
  and never promise a panel, because mobile drops planner parts
  entirely (issue #256) and the tool result is what says what opened.
  It took three walks to see, because the beat reorder below let the
  stop condition preempt it; see walk 004.
  **The premise was wrong, though.** Scoring a report does not build a
  month, and no tool can: `edit_plan` says it "cannot create a new
  month from nothing: when no plan exists, the parent builds one with
  one tap in the child's progress report". So in sitting one the board
  always reads "There's no month set up for Ellie yet", and "a week
  with her own child's name in it" is not achievable during onboarding
  as things stand. The beat now says to expect it empty and to make the
  moment an offer rather than a reveal.
- **Swap beats 8 and 9**, so a beat she participates in follows the
  reveal rather than a beat she watches.
  **SHIPPED 2026-07-29.** The rehearsal is now beat 8, "One more thing"
  is beat 9, and beat 5's forward reference was repointed to name the
  beat rather than its position. Not yet walked.

**Wave 2, uses live capability the arc ignores.**

- **A worksheet made while she watches** (beat 7 or 8).
  `start_first_making` is already wired into the skill; what is missing
  is it happening *during* the sitting rather than promising her binder.
  This is the single strongest "no brainer" moment available: a thing
  she can print, made from her own child's real answers, before she is
  asked for money.
- **A visible agent job** (beat 8). `start_agent_job` is live and
  unmentioned here. Watching Homa work is a capability demonstration
  that costs no extra model turn, because the job runs anyway.

**Wave 3, new construction. Do not start before waves 1 and 2 are
scored.**

- Deterministic welcome variants by entry point.
- A tutorial thread that names features as they appear.

## 7. What NOT to add, and why it keeps coming up

Three things this session tried and reverted. They are recorded here so
the loop does not rediscover them.

- **Word by word reveal of the welcome.** Shipped, hated on sight:
  "clunky and not premium." Token-by-token reveal is what a model does
  when it cannot show you the whole answer yet, so imitating it on a
  string constant is a costume. Replaced by one gesture, 460ms.
- **A receipt line on the next card.** A response to question one has no
  business being the header of question two, and the state field's hint
  already said the same thing in fewer words.
- **Carding the beats where Homa should decide.** Beats 5, 8 and 10 read
  like closed sets, but the arc deliberately has Homa choose rather than
  ask, and `ask_user_questions` says outright that a card "returns her
  question to her unanswered, so it is the wrong move whenever your own
  judgment could settle it." Enumerability makes a card possible; it
  does not make asking right.

The pattern under all three: a beat that feels flat is not automatically
a beat that needs more. Check what is already on screen before adding to
it.

## 8. Open founder decisions

- **D1. Partly answered by walk 001, see below.** The chain shipped: the
  child card is now app-drawn the moment the homeschool card saves, so
  Rachel can act in 108ms instead of 20.7s. Homa's turn itself is
  UNCHANGED at 22s. The open half of the question is whether 22s of
  Homa-silence, while she works, is acceptable, or whether that turn
  needs to get cheaper too.
- **D2.** How much of the twelve minutes may a made worksheet take, if
  it is watchable while it runs?
- **D3.** Does the planner get introduced in sitting one, or does that
  make the sitting too long?
- **D4.** The removed "correct me" beat had a real purpose, proving a
  wrong answer is not permanent. Fold into a standing rule instead?


## 9. Walk log

One entry per walk. Numbers are measured with a clock in the page, never
estimated. A walk with no numbers is an opinion.

### Walk 001, 2026-07-29, Rachel, first pass

Reached the interests step on the first child before the session ended.
Beats 1 to 4 observed; beats 5 onward not reached.

**Measured**

| Moment | Before | After |
|---|---|---|
| Welcome and first card on screen | instant | instant |
| State saved to homeschool card | n/a | 488ms |
| Skipping the optional question to anything asking her for something | **20,703ms** | **108ms** |
| Homa's reaction turn itself | 22s | **22s, unchanged** |

**Verdict: pass conditions 3 and 4 failed on the first walk.** Twenty
seconds with nothing to do, immediately after she skipped a question,
is the worst moment in the arc and it is not a bug in anything. It is a
model turn nobody covered.

**Shipped in response**

1. The child card is now app-drawn the instant the homeschool card
   saves, exactly like basics to homeschool and kid to kid. Her wait
   went from 20.7s to 108ms.
2. That immediately produced a second defect, caught only because the
   transcript was read rather than the timer: Homa's handover sentence
   ("Now let's talk about your kids") arrived 22 seconds AFTER the card
   had already asked for a name. The instruction had told her not to put
   up the card, and said nothing about announcing it. Fixed by moving
   the introduction onto the card as a deterministic intro ("Now your
   kids.") and telling Homa to react only.

**Two lessons, both worth more than the fix**

- **Overlapped is not fixed.** The turn is still 22 seconds. What
  changed is that she is busy during it. Both are worth having and they
  are not the same claim, and the first pass of this document recorded
  the second one as the first.
- **Measure what she experiences, not what you changed.** The probe
  timed the card appearing, because the card is what the code touched.
  She experiences "when does the answer arrive," and overlapping work is
  precisely the change that pulls those two apart.

**A law for every future beat the app takes over**

When the app takes a beat from Homa, it takes the WORDS with it, not
just the widget. Anything Homa says about a thing that is already on
screen is racing something that already happened, and it loses by
exactly one model turn. Every app-drawn card needs its own line naming
its own subject.

**Still unverified at session end**

The intro fix and the react-only instruction are typechecked and the
skill mirror is regenerated, but no walk has run since. Walk 002 starts
by confirming Homa no longer announces the kids and that "Now your
kids." reads correctly above the card.

### Walk 002, 2026-07-29, Rachel, verifying walk 001's two fixes

Ohio. Two children: Ellie, 7, horses and drawing; Sam, 4, trucks.
Reached beat 4 and stopped there, because beat 4 is where the walk
found something. Both of walk 001's fixes hold. The arc's binding
problem turned out not to be wording at all.

**The two fixes, both confirmed**

| Fix | Result |
|---|---|
| "Now your kids." leads the app-drawn child card | PASS. Reads correctly above "What is your child's first name?", and correctly absent on the second child's card. |
| Homa reacts to the setup only | PASS. Her whole turn was "Good to meet you, Rachel. Ohio it is." Nothing about kids. |

**Measured, from her click, with a clock in the page**

| Moment | Walk 001 | Walk 002 |
|---|---|---|
| Skipping the optional question to the next thing asking her for something | 108ms | **4,518ms** |
| Skipping the optional question to Homa's answer arriving | 22s | **45.5s** (first turn, cold server) |
| Roster finished to Homa's answer arriving | not reached | **215.6s** |

The 4,518ms corrects walk 001's 108ms rather than contradicting it.
Both timed the same beat: 108ms was the card mounting after its own
save had already resolved, and she experiences the whole chain from her
click, which includes the homeschool card's POST. The chaining fix is
still right and still the difference between 4.5s and 20.7s. The claim
was one step too generous, which is the same measurement error walk 001
wrote its own lesson about.

**Verdict: FAIL, conditions 3 and 4, by a wide margin, and not on wording.**

215.6 seconds between "That's everyone" and Homa's reply, with the card
chain finished and nothing on screen to read or do. Rachel has about
twelve minutes; this single wait is a third of them. The spinner copy
escalates honestly through four stages ("thinking", "working on it",
"still working", "this one is taking a while") and a completed turn
prints "Worked for 42 seconds". That is the right behaviour and it does
not make a 3.5 minute silence survivable.

Two contributors, both visible in the dev server log, neither yet
separated from local-machine cost:

- Every onboarding turn pays an extra `load_skill` round trip, because
  the skill preload is deliberately rolled back (PR #313). That cost is
  accepted on purpose and `onboarding-mode.ts` estimates it at four
  seconds. This walk measured 45.5s and 215.6s.
- The turn opens an eve sandbox (`opening sandbox session "root" on
  backend "just-bash"`) and sits there. **Whether production pays this
  too is the single most valuable unknown in this document.** A local
  sandbox boot is not evidence about prod, and prod latency for these
  two turns has not been measured. Measure it before optimising
  anything.

Tracked as gh#404, deliberately filed as an investigation rather than a
bug: these are local numbers, and the first deliverable is the
production measurement, not a fix. The walk also left a React hydration
mismatch on every `/onboarding` load, which regenerates the chat
transcript tree on the client, filed as gh#405.

**A third instance of the app-takes-the-words law, found live**

Homa's reply to the finished roster was:

> Ellie and Sam, lovely to meet them both. Horses and drawing for Ellie,
> trucks for Sam already tells me a lot about where to start.
> **Any other kids I should know about, or is that your whole crew?**

She asked for more children immediately after the app had asked and
Rachel had clicked "That's everyone". The cause was exactly the law
walk 001 wrote down, one beat further on: beat 2's addendum said the
app owns the roster and forbids the question, while beat 4 still opened
"Turn to her kids in ONE sentence, THEN the facts card" and still
carried the worked example "Any other kids I should know about?". Homa
followed the more specific instruction and quoted it verbatim.

FIXED this session: beat 4 is now "Meet the family", it reacts to the
whole roster at once, it forbids asking for more and cites this walk,
and it keeps the two rules that were genuinely still its own (call
add_child when she types several kids into the composer, and never
imply a number when pointing at one child).

The general lesson, now three for three: **when a beat moves from Homa
to the app, grep the whole skill for the beat, not just the paragraph
that introduced it.** Every one of these three bugs was a second copy
of the instruction living somewhere the fix did not look.

**Two things this harness cannot answer**

Recorded so a future walk does not spend time rediscovering them.

- **Autofocus.** The browser pane reports `visibilityState: hidden` and
  `document.hasFocus() === false` permanently, which is precisely the
  condition under which browsers skip the autofocus algorithm. Typing
  without an explicit focus call goes nowhere and `activeElement` stays
  BODY. The `autoFocus` prop IS present on both the text input and the
  state select (detail-card.tsx). So the implementation is there and
  this harness cannot observe it. Settle it in a real focused tab.
- **Enter to advance.** `computer{action:"key"}` delivers no keydown at
  all to the page here (a listener on the focused input recorded zero
  events), while `type` works. The handler exists and is correct
  (`onKeyDown`, `event.key === "Enter"`, `advance()`). Not testable
  here; not evidence of a defect.

**Environment hazards, both cost real time this session**

- **`eve build` kills a running dev server on the same worktree.** It
  rewrites `.eve/`, and the live server holds a pinned path into
  `.eve/dev-runtime/snapshots/<id>/`, which is then gone. Every
  subsequent turn 500s with `[UNLOADABLE_DEPENDENCY] Could not load
  .eve/dev-runtime/snapshots/.../compiled-artifacts-bootstrap.mjs`, and
  the UI shows "Not sent. Retry", which looks exactly like the Supabase
  pooler hazard already recorded in §5 and is not it. Restart the dev
  server after any `eve build`. This is also what a server inherited
  from an earlier session was already suffering from at the start of
  this one.
- **A misleading log line, now fixed.** Every onboarding turn printed
  "the inlined onboarding skill body is empty ... Run pnpm
  build:onboarding-skill and redeploy". The generated file was a
  correct 28KB; the preload was off because the rollback constant says
  so. The diagnostic could report two causes and named the one that was
  not firing. It now fires only for the real build mistake.

**Beat scores, 1 to 4**

| # | Beat | Feels | Who acts | Need |
|---|---|---|---|---|
| 1 | Open | +1 | robot | need |
| 2 | Setup cards | +1 | human | need |
| 3 | React once | 0 | robot | nice |
| 4 | Meet the family | **-1** | robot | need |

Beat 2 moves up from 0: two cards, no model turn anywhere in the run,
and the interests step means she has already said something warm about
her child before Homa has said anything at all. Beat 4 is a -1 on this
walk for the 215.6s wait and the redundant question, both now addressed;
it needs a re-walk to re-score, and the wait is the half that is not
proven fixed.

### Walk 003, 2026-07-29, Rachel, re-walking wave 1

Ohio, one child: Ellie, 7, horses and drawing. Same path as 001 and 002
(the optional approach question skipped) so the timings compare.
Reached the reveal.

**What this walk was for, and what it found instead**

Both things it set out to verify passed. It then failed at the beat the
baseline scores `+1`, for a reason neither earlier walk could have seen.

| Checked | Result |
|---|---|
| Beat 4 no longer asks for more children | **PASS.** "Ellie sounds like a joy, horses and drawing are a great combo to build on. Now let's get a real picture of where Ellie is." |
| Her child's interests head the checklist, docked in chat | **PASS.** "Ellie horses, drawing" above the first question, verified on screen in the compact chat dock, not just the full-page flow. |

**Latency: walk 002's 215.6s was an outlier, and partly self-inflicted**

| Turn | Walk 002 | Walk 003 |
|---|---|---|
| Reaction to the setup | 42s (cold) | **28s** |
| Reaction to the roster | **215.6s** | **22s** |
| The reveal | not reached | **13s** |

The dev log explains most of the gap and it is a local artifact:
`[eve:dev] change detected (change agent/skills/onboarding/SKILL.md),
rebuilding authored artifacts` followed by `eve: initializing 1 sandbox
template ... (0 reused, 1 built)`. eve hot-reloads the skill on every
save, each reload rebuilds the sandbox template, and a turn in flight
waits on it. Editing the skill during a walk stretched one turn from
47s to past 107s in this session, watched live.

So: **do not edit anything under `apps/web/agent/` while a walk is in
flight**, and treat any local turn measured just after a skill edit as
uninformative. gh#404 has been updated with these numbers. The
production question it was filed to answer is unchanged and still
unanswered, but it is a smaller question than walk 002 made it look.

The good news inside that: eve picks up a SKILL.md edit without an
`eve build` and without a server restart, so skill iteration during a
walk is cheap as long as it happens between turns.

**The finding: this skill's example sentences are being said to parents**

Rachel answered five questions about her seven year old: "getting
there" on math, on phonics, and on writing, "easily" on explaining
something step by step, and **"not yet" on reading a book aloud and
telling you about it**. Reading is why she pulled Ellie out of school.

The reveal said:

> From what you've told me so far, Ellie is doing great in math,
> phonics, and writing. Those five answers already paint a strong early
> picture.
>
> There's still a lot of ground to cover. **The reading and science
> questions are still waiting**, and answering a few more will sharpen
> this picture even further.

Three failures stacked in one beat, worst last:

1. Three taps of "getting there" came back as "doing great". The card's
   "strongest subjects right now" is a ranking among what she answered,
   not a verdict, and the model promoted it into one.
2. Her single worry is never mentioned. Beat 7 already says to "name
   the worry she actually has and answer it plainly"; the reveal named
   three strengths and skipped it.
3. **"The reading and science questions are still waiting" is beat 7's
   own worked example, copied out whole**, naming two subjects the file
   cannot know anything about. One of them was the question she DID
   answer, with the only negative answer she gave, about the thing she
   is most afraid of.

**The correction turn, which proves the data was never wrong**

Rachel pushed back in character: "Wait, I did answer the reading one.
She can't read a book on her own yet, that's the whole reason we pulled
her out." Homa's reply was the best writing in the walk:

> You're right, that's on me. Ellie's reading answer already came
> through, and it's shown up in her report as literacy. Right now her
> growing edge there is reading a short book on her own and telling you
> about it afterward. [...] Math, phonics, and writing are the strong
> spots your other answers showed. Science is still an open question if
> you want to keep going.

Owns it in four words, no grovelling, names the specific item, and
corrects "reading and science" to just science, which is now true.

The important part is what it reveals: **the answer was captured
correctly all along**, binned as literacy. Nothing was wrong with the
scorer, the ledger or the report. Only the sentence was wrong, and the
sentence was wrong because it was copied. That is what makes this a
skill fix rather than a data fix, and it is why the fix is worth
trusting.

One small thing to file separately if it recurs: the subject is
"literacy" in the report and "Phonics" and "Reading" in the questions
she just answered. She now has three words for roughly one thing.

**The root cause, now three for three**

Every walk so far has caught a quoted example from this file arriving
in a real conversation with its stand-in content intact:

| Walk | Sentence emitted verbatim | Why it was false |
|---|---|---|
| 001 | "Now let's talk about your kids" | landed 22s after the card it introduced |
| 002 | "Any other kids I should know about?" | she had just clicked "That's everyone" |
| 003 | "the reading and science questions are still waiting" | reading was the one question she answered |

Each was a correct instruction delivered to a situation that was not
hers. The two earlier fixes treated their sentence as the bug. It was
not: the bug is that **a quoted example in this file is read as copy,
not as a shape.**

Fixed this session, in three places: beat 7's anchor no longer carries a
quotable subject list and now says to read her real answers first; beat
7 gains the "strongest subjects" trap and says naming her worry is the
half most easily lost; and "What not to do" gains the general law with
all three scars cited.

**The rule this leaves for anyone editing this skill**

An example that names content a parent could check (a subject, a count,
a child, a date) will eventually be said to a parent for whom it is
false. Write examples as shapes with obvious stand-ins, the way beat 6
does with "something with the shape of ...", and never as a sentence
that would read correctly if pasted straight into chat. Beat 6's form
survived three walks intact: Homa substituted the real child's name into
it every time.

**Not reached**

Beats 8 (the rehearsal, newly moved after the reveal) and 9 (the
planner, newly introduced) are shipped and NOT walked. Both were added
this session and neither has been seen on screen. That is the first
thing walk 004 should do, and it needs only one reply past the reveal to
get there.

**Beat scores, 1 to 7**

| # | Beat | Feels | Who acts | Need |
|---|---|---|---|---|
| 1 | Open | +1 | robot | need |
| 2 | Setup cards | +1 | human | need |
| 3 | React once | 0 | robot | nice |
| 4 | Meet the family | +1 | robot | need |
| 5 | Go deep with one | skipped | robot | need |
| 6 | The questions | **0** | human | need |
| 7 | The reveal | **-1** | robot | need |

Beat 4 recovers to +1: the redundant question is gone and the turn was
22s. Beat 6 moves from -1 to 0 on the interests header, which is a real
improvement and not yet a +1, because the header is warmth around a beat
whose substance is still a list of things her child cannot do. Beat 7
drops from +1 to -1: it is the payoff beat, and on this walk it told a
frightened mother that everything was great and that the question she
had answered was still waiting.

Beat 5 did not happen at all. With one child whose interests the card
already collected, Homa went straight from the roster to the questions.
Worth deciding rather than discovering: beat 5 is where
`start_first_making` gets its theme, so skipping it means no making is
underway when she reaches the reveal, and "One more thing" becomes the
only chance at something she can keep.

### Walk 004, 2026-07-29, Rachel, the first walk to the end of the arc

Ohio, one child: Ellie, 7, horses and drawing. Same skip path, and
deliberately the SAME five checklist answers as walk 003 ("getting
there" on math, phonics and writing, "not yet" on reading aloud,
"easily" on explaining) so the reveal could be compared word for word
before and after the fix. First walk to reach beat 10.

**The beat 7 fix, verified against a controlled repeat**

Identical answers, one walk apart:

| | Walk 003 | Walk 004 |
|---|---|---|
| The strengths | "Ellie is doing great in math, phonics, and writing" | "her math really stands out ... her phonics and writing look **right on track for her age**" |
| Her worry | never mentioned | "The place she's actively growing is putting it all together: **reading a whole short book on her own and telling you about it after**. That's her real edge right now." |
| The anchor | "the **reading** and science questions are still waiting" | "there are more waiting whenever you want to fill in the rest of her map, no rush at all" |

All three failures gone. The copied example did not reappear, the
middle answers are described as on track rather than as mastery, and
the one question she answered "not yet" is now the sentence the reveal
is built around. Beat 7 goes from `-1` back to `+1`.

One residual, smaller and worth watching rather than fixing yet: "she's
already adding and subtracting small numbers in her head, like 7 plus 2,
**without needing to count on fingers**". The fingers are an
embellishment; the question does not mention them and she answered
"getting there". Same traceability rule, much milder breach.

**Beat 8, the swap, verified and good**

The rehearsal now follows the reveal in the same turn, and it is the
best stretch of the whole arc. It logged "math, 60 min" and then
"reading, 20 min" as two receipt chips, reacted specifically ("math in
the morning, a whole afternoon of horse drawings, and Charlotte's Web
together in the evening"), asked the wind-down question, and closed the
loop on the hour she gave: "Since you usually wrap up around 3, want me
to check in with you around then each day?" Accepted, and confirmed as
weekdays around 3.

That is the beat the free period rests on, and it now sits where a busy
parent is still present.

**Beat 9 never happened, and the swap is why**

Homa went from the rehearsal straight to "That's a good place to leave
it for today". `open_planner` was never called. The planner that was
added to "One more thing" this session has still never been seen.

The cause is in this file, not in the model. "When to stop" says:

> She has a scored report and one rehearsed loop. That is a complete
> first sitting; anything after it is a bonus, not a requirement.

Before the swap the rehearsal was the LAST beat, so that condition only
came true at the end of the arc and "One more thing" always ran ahead
of it. After the swap the condition comes true one beat earlier, and it
explicitly labels everything past it optional. The reorder moved the
finish line without moving the rule.

Fixed: the stop condition now requires the report, the rehearsed loop
AND the single follow-on beat, and carries this walk as its reason plus
an instruction to re-check it if these beats are ever reordered again.
Not yet re-walked, so the planner remains **shipped and unseen**, now
for the second walk running.

The general shape, which is the same one this document keeps finding:
a change that is right on its own terms broke a rule somewhere else
that depended on the old order. Wave 1 item 3 was a good change and it
silently disabled wave 1 item 2.

**A new failure, and the worst-looking one yet**

Homa's entire reply to the setup cards was:

> React briefly and hand it straight to her kids since the app is
> already handling the child card.

That is her instruction to herself, delivered to Rachel as the message,
on the first screen after payment. It names "the app" and "the child
card", and calls Rachel's children "her kids" in the third person, all
of which the voice rules forbid outright.

What is known: the sentence is not in the codebase (grepped), so the
model generated it rather than a hidden directive leaking through. The
same beat produced correct warm lines in walks 002 and 003 ("Good to
meet you, Rachel. Ohio it is." and "Good to meet you, Rachel! Ohio
noted."), so this is intermittent, n=1, and NOT reproduced.

What is not known: whether the beat 4 rewrite shipped earlier this
session raised the odds. That rewrite added several "the APP already
did X" sentences next to this beat, and the leaked line is a paraphrase
of exactly that material. Plausible and unproven.

Filed as gh#415. It belongs to the same family as the silent-turn
failure documented in `onboarding-mode.ts`, whose stated repair is a
deterministic guard plus an eval driving the exact sequence, not more
prose.

**Beat 5 fired this time, and still no making**

With the same single child, Homa asked a real question about horses
("Does she get to ride at all, or is it mostly drawing them and pretend
play with horses right now?") and got a rich answer back: rides weekly,
draws constantly, stacks of paper everywhere. She called `remember` and
then `start_checklist`.

She did NOT call `start_first_making`, though beat 5 says that answer
"is your cue" and to start it "at this boundary, before the questions
begin". So the sitting ended with a report and no object. Pass
condition 5 is met by the report alone, but the strongest available
version of it, a page made from her own words, has now not fired in any
walk. Two beats in a row that name a live tool and do not reach it.

Tracked as gh#416, which also names the thing to rule out first: a
dynamic tool that resolves on `turn.started` vanishes on a cold isolate
(see the `dynamic-tools-must-use-step-started` scar), and a tool that is
absent from the turn looks exactly like a model declining to call one.
Check presence before rewriting any prose about it.

**Pass conditions, first full-arc scoring**

| # | Condition | Result |
|---|---|---|
| 1 | No beat scores -1 | **FAIL**, the setup reply leaked an instruction |
| 2 | No two consecutive 0 beats | pass |
| 3 | No stretch over 90s without her acting | pass, longest turn 28s |
| 4 | No single wait over 8s with nothing to do | **FAIL**, several 17 to 28s turns with an empty screen after the cards end |
| 5 | Something she can keep before the paywall | pass, the scored report |
| 6 | One capability she was not told about | **FAIL**, the planner never opened and no making started |
| 7 | Last beat names something specific | pass, "around 3 on weekdays", "more of Ellie's questions" |

**Beat scores, the whole arc**

| # | Beat | Feels | Who acts | Need |
|---|---|---|---|---|
| 1 | Open | +1 | robot | need |
| 2 | Setup cards | +1 | human | need |
| 3 | React once | **-1** | robot | nice |
| 4 | Meet the family | +1 | robot | need |
| 5 | Go deep with one | +1 | human | need |
| 6 | The questions | 0 | human | need |
| 7 | The reveal | +1 | robot | need |
| 8 | The rehearsal | +1 | human | need |
| 9 | One more thing | did not run | robot | nice |
| 10 | A place to stop | +1 | robot | nice |

Net +5 with one beat missing entirely. The arc is in much better shape
than walk 002 suggested: the two beats that were broken are fixed and
the two beats that were 0 are now +1. What is left is not wording. It
is that two live capabilities, the planner and the first making, are
named in the skill and still never reached.

### Walk 005, 2026-07-29, Rachel, does the planner finally open

Same setup, run immediately after the stop-condition fix, for one
question: does beat 9 run now. It does.

**The stop-condition fix works**

> Done, I'll check in with you around 3 each day. **Let me show you
> what's on Ellie's plan for this week.**

`open_planner` fired and the board opened beside the conversation.
Beat 10 followed in the same turn with real specifics. So wave 1 item 2
is finally verified end to end, three walks after it shipped, and the
diagnosis in walk 004 was correct: the reorder had moved the finish
line, nothing else was wrong.

**And it immediately falsified the beat I wrote**

The board says, in large type: **"There's no month set up for Ellie
yet."**

The beat 9 text written earlier today claimed "the report just gave
this child a real four-week plan, so there is something true on the
board to look at rather than an empty grid." That is false, and
`edit_plan`'s own description says so outright:

> This tool cannot create a new month from nothing: when no plan
> exists, the parent builds one with one tap in the child's progress
> report.

There is no tool in `apps/web/agent/tools/` that can build a month. So
in sitting one the planner is ALWAYS empty, and the founder's framing
for this moment, "showing her a week with her own child's name in it",
is not currently achievable during onboarding at all.

The moment survived only because Homa read the empty board and said so:
"There's no month plan started for Ellie yet. When you're on her
progress report, there's a one-tap button to build one." Honest, useful,
and entirely down to the tool-honesty rules rather than to this beat.

Beat 9 is rewritten to tell the truth: expect it empty, do not oversell
it, and treat the beat as an offer (name what a month is, point at the
one tap that builds it) rather than a reveal. Not re-walked.

Whether that is the right answer is a founder call, filed as gh#426
with the three options: leave it as an offer, give Homa a way to build
the month (which moves a deliberate "the parent chooses" boundary), or
move the planner out of sitting one and give the beat back to the first
making.

**What this says about the wow question, which is the point of the doc**

The eval doc opened by finding that every capability the founder wanted
already ships, so the gap was routing. Two walks have now qualified
that. `open_planner` ships and routes fine once the stop rule lets it,
but the thing worth showing does not exist yet for a new family.
`start_first_making` ships and has not fired in five walks. So the
honest version of §1 is:

**The capability shipping is not the same as the capability having
anything to show on day one.** Before advertising a tool in the arc,
walk it against a family that is twelve minutes old and look at what it
actually renders for them.

**Reveal quality is now inconsistent rather than wrong**

Same five answers as walks 003 and 004. The reveal was honest and
carried no invented subjects ("her brightest spots right now", "the
other twelve are just sitting there"), which is the fix holding. But it
never named the reading answer, where walk 004 built the whole reveal
around it. So the "name the worry she actually has" half is landing
about half the time. Worth an eval rather than more prose.

**Latency, warm, third data point**

25s, 37s, 20s, 27s per turn. Consistent with walk 003 and nothing like
walk 002's 215s. gh#404 stands as written.

### Walk 006, 2026-07-29, Rachel, the worry now arrives as data

Same five answers again, fourth time, so the reveal is comparable
across the whole series.

**The 50/50 beat was a missing tool field, not a wording problem**

score_child_report returned `strengths` and nothing else about her
answers. So the half of beat 7 that lists what is going well arrived as
data, and the half that must name her worry had to be remembered out of
the conversation. The remembered half landed about half the time, which
is exactly what an unaided recall of one item among five looks like.

Fixed at the layer the house rule points at: the model judges how to
say it, code supplies which item it is. `ChecklistState` now carries
`growingEdges`, the things she answered "not yet", each with the
personalized statement she actually read, ordered by the bank's own
subject order and capped at three. score_child_report returns them and
its result note requires naming exactly one, framed as where the child
is growing. Only "not yet" qualifies: "getting there" is a middle
answer and dressing it as a concern is the behind-framing this house
does not do, "not sure" is an unknown rather than a worry, and a skip
is not an answer. Empty is a real state and the note then forbids
inventing one. Seven unit tests in `checklist-state.test.ts`, wired
into `check:onboarding`.

**The result, same answers as walks 003 to 005**

> Ellie's math, phonics, and writing all look solid for her age. **She's
> working on reading a short book out loud and telling you about it
> after**, which is such a natural next step from where she is. There's
> a lot of ground still open, since we've only touched 5 of the areas
> the map covers.

The named edge is `growingEdges[0].statement` word for word, so the
claim is traceable to the tap she remembers making. Strengths are
hedged ("look solid for her age") rather than promoted to mastery, and
the anchor counts areas instead of naming subjects it cannot know.

One walk is not a reliability claim, and this is recorded as a
mechanism change rather than a proven rate: the beat went from
depending on recall to depending on a field. Worth an eval before
calling it settled.

| Reveal, same five answers | Named her worry |
|---|---|
| Walk 003 | no |
| Walk 004 | yes |
| Walk 005 | no |
| Walk 006, after the fix | yes |
| Walk 007, after the fix | yes |

### Walk 007, 2026-07-29, Rachel, the week is real

Same setup and the same five answers, run to verify the month now builds
at scoring. Spec: `2026-07-29-onboarding-week-fills.md`. Founder ruling:
`onboarding-lesson-per-subject`.

**Beat 9 has something on it now**

> I also went ahead and built Ellie's first month plan from her answers.
> It's open beside our chat, four weeks of small daily pieces in reading,
> math, and phonics, and **week two even leans on her love of horses for
> the math and reading practice.**

The panel showed a dated, checkable week: "THIS WEEK · JUL 27 TO 31",
"Ellie's week", "week 1 of 4", Monday literacy, Wednesday math marked
TODAY, Friday phonics, free days in between, and a line explaining that
check-offs feed the next report. Walk 005 saw "There's no month set up
for Ellie yet" in the same slot.

The activities are built from her real answers: Monday's literacy piece
aims at "reading a short book out loud", which is the exact question she
answered "not yet".

**And the wow screen was ungrammatical**

Wednesday read: "Ten minutes a day of **adding and subtracts** small
numbers in their head."

The activity templates splice a bank statement in after "ten minutes a
day of...", and the conjugator converted only the first word. Ten of the
bank's 224 statements open with a verb series and every one of them was
broken, plus "opens" shipped as "openning".

Fixed, with nine tests in `packages/core/src/map/plan-grammar.test.ts`
generating the real activities across every subject, age band and
interest context, wired into `check:map`. Five statements are left in a
shape no pattern can safely read, filed as gh#440 for rewording, and
held in the test as a named allowlist so a new one fails loudly.

**A correction worth keeping**

The first probe of this bug used a hand-copied simplification of
`gerundize` rather than the real one, and it reported five defects that
do not exist ("uses" to "useing", "sees" to "seing", and others the real
function already handles). Re-running against the actual implementation
gave a different and much smaller list.

Mirroring a function to test it tests the mirror. Probe through the
public API, or export the real thing.

**Beat scores, updated**

| # | Beat | Feels | Who acts | Need |
|---|---|---|---|---|
| 9 | One more thing | **+1** | robot | nice |

Beat 9 moves from "did not run" to +1. It is the first beat in the arc
that shows her the product is a system holding her year rather than a
conversation, and it now does that with a real, dated, personalized
week rather than an empty grid.
