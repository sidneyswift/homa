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
  this yet" with the warmest thing she said. Needs a three file data
  plumb: the store query, `OnboardingChatProps.kids`, the takeover
  header.
- **Introduce the planner** (beat 8, a `0`). `open_planner` is live and
  the arc has never once mentioned it. Showing her a week with her own
  child's name in it is the difference between "an AI chat" and "a
  homeschool system."
- **Swap beats 8 and 9**, so a beat she participates in follows the
  reveal rather than a beat she watches.

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
