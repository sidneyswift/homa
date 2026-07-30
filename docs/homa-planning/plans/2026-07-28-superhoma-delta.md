# Superhoma delta: what the Mac mini Homa has that the product does not

> **Reading order.** Part 0 below is the plain-English version: what we do, what
> we do not, and what to do about it. Parts 1 and 2 are the detailed version
> with the file paths and the evidence. If you only read one thing, read Part 0.
>
> **Tracked as gh#403** (the arc). This doc is the spec and evidence layer;
> status, priority, and ownership live on the issues.

| Issue | Item | Gate |
|---|---|---|
| gh#391 | Use what works for a child when designing their pages | none |
| gh#395 | Seed the working space, use it beyond one skill | none |
| gh#393 | Thumbs up and down | none |
| gh#392 | Daily scored health read of production | none |
| gh#396 | Ladder item 10: durable per-family folder | none |
| gh#394 | Nightly pass that files issues from real signal | none |
| gh#399 | Why has nobody used recurring help? | none |
| gh#397 | Let Homa write and run small programs | founder ruling |
| gh#398 | Let Homa keep a generator and reuse it | founder ruling |
| gh#400 | A `voice` memory kind | founder ruling |
| gh#401 | A weekly check-in instead of waiting | founder ruling |
| gh#402 | Read-only access to the family's real calendar | founder ruling |

The voice ruling itself (P6 and P12 below) is deliberately unfiled: the founder
is writing that tiebreak line personally.

---

# Part 0: the plain version

## Do we already do these things? Honest answer

Every row checked against the actual code on 2026-07-28, not from memory.

| Can Homa do this? | Today |
|---|---|
| Use what we know about how a child learns when making their pages | **No.** We store those notes and load them into her head every turn, but nothing tells her to look at them when she designs |
| Notice when the live site is broken | **No.** We check the code carefully. Nothing checks the running site |
| Find out whether a parent liked an answer | **No.** There is no thumbs up or down anywhere |
| Notice what keeps going wrong and decide what to build next | **Only when a person sits down and does it by hand** |
| Have scratch space to work in | **Built and switched on, but completely empty** |
| Read reference files while she works | **Yes**, and only one of the six skills uses it |
| Write and run her own code | **No.** Deliberately switched off on 2026-07-09 |
| Keep something she built and reuse it next time | **No.** She rebuilds every page from scratch, every time |
| Work in the background on something long | **Yes, and it works.** Used for two things |
| Let a parent set up recurring help on a schedule | **Yes, fully built and parent-controllable.** Barely used |
| Run things on a timer overnight | **Yes.** Currently researches three topics a night and nothing else |
| Remember what a family likes | **Yes.** Two kinds of notes: facts, and what works for a child |
| Remember how a parent likes to be *talked to* | **No** |
| Ask a parent for a quick weekly check on a child | **No.** We wait for her to volunteer it |
| Know about the family's real calendar | **No.** Only events she typed into Homa |

So: no, we do not do most of it. The surprising part is **why**. It is almost
never because we lack the ability. It is because the ability exists, switched
on, and nothing was ever pointed at it.

## The one sentence

The Mac mini Homa is better at three things: she remembers what works and uses
it, she can build her own tools and keep them, and she is allowed to sound like
a person. We have the parts for the first two sitting unused, and the third is a
decision, not a build.

## What to do, plainest version

### The quick ones (days, no big decisions)

**1. Tell her to check what works before she designs.**
When a parent says "dinosaurs double his focus" or "she shuts down on timed
pages", we save it and we load it into Homa's head every single turn. But the
instructions that tell her how to design a worksheet never mention it. She has
the note and is never told to read it.

The Mac mini version calls this the single most important fix it ever made,
after the parents said her suggestions were "the most obvious" and did not fit
the child. The fix was not new data. It was telling her to look at what she
already had.

We know this works. We fixed the identical problem with picture styles a few
days ago and went from getting it right 3 times out of 6 to 18 out of 18.

*Half a day. No decisions needed. Biggest quality jump on this list.*

**2. Put something in her scratch space.**
Homa has a private working folder that is switched on and safe and totally
empty. Only one part of her uses it, to look up worksheet layouts.

We could put real things in there: our fonts, our colors, finished examples of
good pages, the state homeschool rules. Then every part of her can look things
up instead of guessing, and it costs nothing while she is not looking.

*A day or two. No decisions needed.*

**3. Add a thumbs up and thumbs down.**
We have no way of knowing whether a parent liked anything Homa made. Every
judgment we make about quality today comes from a person reading conversations
by hand.

One warning from the Mac mini: it built the thumbs and forgot to connect the
other end, so the file sat empty for three months while the most important part
of the system tried to read from it. Build both ends, and add a check that
shouts if it goes quiet.

*A few days. No decisions needed.*

### The medium ones (a couple of weeks)

**4. Give ourselves a daily health check on the real site.**
Our automatic checks are thorough and they check the *code*. Nothing checks the
*running site*. That is how the sign-up page could be broken for four months
while every check stayed green.

Nearly every problem we have had this month is the same shape and would be
caught by one daily read of the live system: pages returning errors, offers a
parent accepted that never got made, worksheets stuck half-finished, a switch
we flipped that never actually turned on, families who have been here a week
and received nothing.

Give it a score out of 100 and a short list of what is wrong. It fixes nothing.
It just tells the truth every morning.

*Two weeks. No decisions needed. Everything else gets easier once it exists.*

**5. Give Homa a folder of her own per family.**
Right now every conversation starts from nothing. Anything she makes during a
conversation is gone when it ends. She keeps rebuilding the same things.

This was already agreed. On 2026-07-09 we wrote down ten things to build in
order. Nine are built. This is number ten, and it is the only one nobody
started.

*Two to three weeks. Already approved, just never begun.*

**6. Have her look at what is going wrong every night and write it down.**
The Mac mini does this nightly. It reads what actually happened, finds what is
repeatedly broken or missing, and writes a ranked list with the specific
example that proves it.

It then goes and builds the top item on its own. **We should not do that part.**
Ours should stop at writing the ticket, with the evidence attached. A person
decides what gets built.

*Two weeks. Needs a decision on how far it goes, and my strong advice is: write
tickets, never write product code.*

### The ones that need your call

**7. Let her write and run small programs.**
This is the biggest single difference and it needs explaining, because the
common version of it is wrong.

She already writes code. Every worksheet is a small program she writes and we
run. What she cannot do is write a program of *any other shape*. Reorganize a
list, make a chart from six weeks of records, combine twelve photos into one
page, work out a schedule against real dates: she has no way to do any of it,
and each is about twenty lines of ordinary code.

The Mac mini has written itself **87 of these**, and you can see it learning in
the filenames: one attempt, a fix, a second fix, a third fix. It writes
something, runs it, sees what broke, fixes it. That loop is most of what "she
is smarter" actually means.

We turned this off on 2026-07-09, and the written reason matters: not that it
was dangerous, but that **the workspace was empty and there was nothing useful
to point it at**. That reason expires the moment suggestion 2 and suggestion 5
are done.

There is a clean precedent. Web page reading was switched off by the same
decision on the same day, and switched back on four days later, not by flipping
the old switch back but by building our own careful version of it. That is the
model here. Not "turn the dangerous thing back on". Build a narrow version that
can only reach that one family's own files, cannot reach the internet, has a
time limit, and hands its work to permanent storage before the conversation
ends.

One honest caveat: there is a safety piece we planned and never built, about
checking text that came from outside before acting on it. A first version can
avoid that entirely by only letting her work on the family's own records.

*Three to four weeks. Needs your decision.*

**8. Let her keep something she built.**
This is the half that actually matters. Right now she rebuilds every page from
nothing, every time, and gets no better at it.

If a way of making something works, she should be able to keep it in that
family's folder and use it again next month. Not shared with other families and
not changing how Homa behaves for anyone else. Just: this worked, keep it.

That is the difference between someone who is good at their job and someone who
gets better at it.

*Two weeks, after 5 and 7. Needs your decision.*

**9. Let her learn how each parent likes to be talked to.**
We already remember two kinds of things about a family: facts, and what works
for a child. We remember nothing about the parent's own preferences.

Some parents want the answer first and the warmth second. Some read on a phone
between two other things. Some enjoy a joke and some do not. The Mac mini's
instructions literally tell it to figure this out and adapt. Ours cannot,
because there is nowhere to put the answer.

Adding a third kind of note is small, and it means the way Homa talks can fit
each family without us changing anything for everyone.

*Two days. Needs a small decision on what she is allowed to adapt.*

**10. Let her be funnier, on purpose.**
This is the personality gap, and it is smaller and more fixable than it looks.

Our rules about how Homa talks are almost all limits: at most one comparison,
at most one emoji, at most one suggestion, never this, never that. Each one is
sensible. Stacked together they describe everything she must not do, and never
once describe someone you would enjoy talking to.

The problem with a limit like "at most one comparison per reply" is that it
cannot tell a good one from a bad one. So the safe move is to use none. The Mac
mini instead says: be funny when it is genuinely funny, never forced. That is a
standard, and she can actually aim at a standard.

There is also a fight going on in our instructions that nobody has settled.
One section tells her to have real opinions and say the unwelcome thing. The
next section, marked as the binding one, tells her to reassure first, never
command, and make at most one gentle suggestion. Run an opinion through those
and it comes out as mush. The binding section wins because it says it is
binding.

The Mac mini settles it in six words: charm over cruelty, but do not sugarcoat.
We need our own version of that sentence, and it should be yours, not mine.

*A day of writing. Needs your decision, and it touches four files, so it should
be done once and properly.*

**11. Ask the parent for a quick check-in each week.**
The Mac mini does not sit and wait for information. Once a week it asks for five
minutes of quick observations and updates what it knows about the child.

We wait. Our own review found that the equivalent moment fired eight times
across all families, ever. Same problem, and they solved it with a regular
appointment rather than better wording.

We already have every part of this built. It is assembly, not invention. But it
means Homa contacting parents on a schedule, so it needs your call on how often
and how it sits alongside the trial.

*A week, after your decision.*

**12. Let her see the family's real calendar.**
The planner only knows about things a parent typed into Homa. It does not know
about co-op on Thursday or the appointment on Tuesday. Read-only access to their
actual calendar would make every plan fit their real week.

*Two to three weeks. Needs a decision, because it means asking parents to
connect an account.*

## If we only did three

1. **Tell her to check what works before she designs.** Half a day, and it fixes
   the complaint that her suggestions are generic.
2. **Daily health check on the live site.** Two weeks, and it ends the pattern
   of things quietly being broken for months.
3. **Thumbs up and down.** A few days, and it is the only way we will ever know
   whether any of this is working.

None of those three needs a decision from you. They can start today.

## The honest summary

We are not missing the ability. We are missing the wiring.

Homa has a working space and we left it empty. She can read files and only one
part of her does. She can work in the background and two things use it. Parents
can give her a standing job and almost nobody has. We can run things overnight
and we run three.

The Mac mini is not better because it was built better. It is better because
every one of those things got pointed at something, and then the results piled
up. Ours have never been pointed at anything.

---

Date: 2026-07-28
Status: analysis plus ranked proposals. No founder ruling yet.
Sources read: `homa-macmini/.openclaw/workspace/` SOUL.md, AGENTS.md, TOOLS.md,
HEARTBEAT.md, IDENTITY.md, the `homa-system-reflect`, `homa-system-doctor` and
`homa-track-story-coach` skills, `operations/health.md`, `operations/roadmap.md`,
`operations/improvements.md`. Compared against `apps/web/agent/instructions.md`,
the six fleet skills in `apps/web/agent/skills/`, the 60 tools in
`apps/web/agent/tools/`, the four schedules in `apps/web/agent/schedules/`, and
the CI guard roster.

Alessa's read is that the Mac mini Homa has more personality, is generally
smarter, and can do more. All three are true. This document separates which
parts are a prompt difference, which are an architecture difference, and which
are a difference we should not close.

---

## 1. The two systems are different shapes

| | Superhoma (Mac mini) | Homa (product) |
|---|---|---|
| Tenancy | One family. One trusted user. | Every family. Strangers. |
| Durable state | The filesystem it owns, plus one JSON profile | Postgres, Blob, RLS |
| When it thinks | Continuously: heartbeat every ~30 min, crons at fixed times, nightly research at 3:33am | Only inside a turn, plus four scheduled jobs |
| Tool surface | Shell, python, Obsidian, full Google Workspace read and write as Less, fal, SerpAPI, Whisper, ElevenLabs | 60 bounded, tenant-scoped, deadline-tiered tools |
| Self-modification | Ships its own new skills and crons nightly, without approval | Coding agents in sessions, gated by CI and PR |
| Failure blast radius | One family, reversible, a human notices same day | Every family, live, silent |

Almost everything that reads as "smarter" comes from three properties in the
left column that the right column does not have by construction:

1. **It has time between turns.** It thinks when nobody is talking to it.
2. **It owns a filesystem.** Knowledge compiles into durable artifacts.
3. **It has a self-improvement organ.** A nightly loop that mines real usage
   and builds the thing it finds missing.

Personality is a fourth, separate axis, and it is the cheapest to close.

---

## 2. Scoreboard

### Already at parity (no action)

- **Character core.** Our "Have opinions" section is nearly a direct port of
  SOUL.md's, including the same worked example about a curriculum written for
  five-year-olds. The "never open with Great question" rule is verbatim shared.
- **Aim at the working edge from evidence.** Superhoma reads `story-profile.json`
  before recommending. We read the map snapshot, and `materials-studio` makes it
  binding. Ours is more rigorous: a deterministic scorer, a DAG-validated
  taxonomy, chart reads in months.
- **Compile, do not just log.** Superhoma's vault regeneration rule exists
  because the brain got smarter while Less's view went stale. Our report page,
  planner, and binder read live from Postgres, so the class of bug the rule
  prevents cannot occur here.
- **Lesson recording as the richest signal.** They ship `homa-capture-lesson`.
  We shipped lesson listen fleet-wide 2026-07-21 (PR #70). Ours is shakier, not
  absent.
- **Memory discipline.** Both save durable facts the turn they are learned.
  Ours is stricter and tenant-safe.

### Real deltas, ranked by what they explain

| # | Delta | What they have | What we have | Explains |
|---|---|---|---|---|
| D1 | What-works read side | `what-works.md` per child, and the read wired into all eight make-skills plus research | `what_works` memories load into context, but no skill consults them at the design moment | "Her suggestions are the most obvious" |
| D2 | Runtime health surface | `doctor.py`, read-only, scores the live system 0 to 100 with a punch list | A large CI roster that checks the code, nothing that checks the running fleet | Bugs living for months |
| D3 | Self-improvement organ | `homa-system-reflect` nightly, two lenses, autonomous builds, a priority formula | Manual investigations by coding agents | "It keeps getting better on its own" |
| D4 | Feedback loop | 👍 / 👎 capture as training signal, one follow-up on 👎, never nag | Nothing. No reaction capture anywhere | No signal about whether output landed |
| D5 | Weekly measurement protocol | Proactively asks for 5 to 10 quick observations weekly, updates the model | Wait for the parent to volunteer signal | A model that goes stale |
| D6 | Voice permission | Wit, conviction, swearing, "the assistant you'd want to talk to at 2am" | ~15 voice constraints, nearly all negative, zero positive permission for humor | "More personality" |
| D7 | Between-turn presence | Heartbeat rotation with a persisted state cursor | Four schedules, no rotation or cursor law | "It notices things" |
| D8 | Real-world tool reach | Google Calendar, Gmail, Drive, Docs, Sheets, Forms | Our own event table only | "It can do more" |

### Reverse deltas: where the product is ahead

Worth stating plainly, because "superhoma is smarter" is not the whole picture.
We have tenant isolation, a deterministic scorer, bounded tools with deadline
tiers, the models-judge-code-verifies law, an eval harness with sandbox
isolation, a CI roster, four channels including phone and SMS, the state pack,
and the planner. Superhoma has none of that, because with one family on one
machine it does not need any of it.

And by its own instrumentation it is not healthy: 81/100, with its heartbeat
running blind for four days and `feedback.jsonl` empty since 2026-04-25. Its
keystone what-works loop reads a model that nothing has fed in three months.

---

## 3. Proposals, ranked

Using superhoma's own formula, which is good and I am borrowing it:
`priority = leverage × groundedness ÷ (effort + risk)`, tie-broken by signal
recency. Its north star is also right and worth adopting: not capability count,
but **how much of the parent's actual load Homa carries**. A capability nobody
uses scores zero.

### P1. Wire the what-works read side into the decision moment (D1)

**Leverage: highest. Effort: hours. Risk: near zero.**

Superhoma's roadmap calls this THE keystone, citing a transcript where Sidney
and Less say Homa's suggestions are "the most obvious" and do not fit Story,
because there is no model of what engages him. The fix was not new data. It was
wiring the read side into all eight make-skills.

We have the same data and the same gap. `family-context.ts:82` loads
`what_works` memories into every turn. `materials-studio/SKILL.md` has a binding
"set the difficulty from evidence" checklist that names the map snapshot and the
child's interests, and never mentions `what_works` once in 585 lines. The
teaching signal rides along in context and no skill is told to use it.

We already proved this exact mechanism works. The anchor-selection fix
(2026-07-25) went from 3/6 to 18/18 first-call carriage by moving an ignored
rule onto the checklist the model executes at the decision moment. Same disease,
same cure, different rule.

Do:
- Add `what_works` memories as a named input to the binding evidence checklist
  in `materials-studio`, alongside the map snapshot.
- Same in `planner` and `curriculum-studio`.
- Add an eval fixture: the Walker family holds a `what_works` memory, and the
  produced material has to reflect it.

### P2. A production doctor (D2)

**Leverage: high. Effort: days. Risk: low, read-only.**

Our checks verify the code. Superhoma's doctor verifies the running system.
That distinction is the whole point, and we have the proof: `/onboarding`
returned 500 for four months on a column that does not exist, and the entire CI
roster passed on the broken version the whole time.

Nearly every incident in the last month is the same shape. Accepted offers
dropped silently. Materials stranded in draft. A flag that sat dark for two days
because an env var was never created. Journaling that fired eight times ever
fleet-wide. All of these are invisible to a build-time check and obvious to a
scored read of production.

Do: `scripts/fleet-doctor.mts`, read-only against prod, emitting a 0 to 100
score and a severity-ranked punch list to an `/admin` page. Candidate checks,
each drawn from a real incident:

- Routes returning 5xx in the last 24h
- Tool refusal rate by tool, with a ratchet
- Scheduled tasks whose last run is older than their cadence
- Materials stuck in `draft` past a threshold
- Active families with zero delivered materials
- Offers accepted with no fulfillment
- Agent jobs with no terminal state
- Journal ops per active family per week
- Flags whose env var does not exist

The doctor fixes nothing. It is the surface everything else gates on. That
separation is theirs and it is correct.

### P3. Fleet reflect, filing issues rather than shipping code (D3)

**Leverage: high. Effort: days. Risk: medium, needs scoping.**

Their Lens A finds recurring machinery friction. Lens B mines what the parent is
actually doing for gaps, unused power, and anticipated needs. Both cite a
specific instance. Neither is allowed to propose generic best practice.

Their autonomy setting ("build the top item nightly without approval") is right
for one family and wrong for ours. Dial it to analysis only: the loop reads
production signal, ranks by the formula, and **files a GitHub issue with its
citation and score**. It never writes product code. That fits the founder's
2026-07-25 directive exactly, since Issues is already the single live tracker.

Signal we already have and do not systematically mine: `agent_tool_calls`, tool
refusals, conversation transcripts where the parent corrected Homa, Vercel
runtime errors, dropped offers, and (once P4 lands) thumbs.

Two of their hard-won rules to copy verbatim:
- **A skill is for work that recurs.** For a one-shot task, execute it and fix
  the loop that should have caught it. They minted a whole skill for a
  once-a-year syllabus instead of fixing the email path, and Sidney flagged it.
- **A missed catch is machinery friction.** Fix the catcher, do not paper over
  it with a new capability.

### P4. The thumbs loop (D4)

**Leverage: high. Effort: small. Risk: low.**

We have no reaction capture anywhere. Every quality judgment we make about
Homa's output is currently a human reading transcripts.

Superhoma's design is good and its failure is instructive: they wired the
outbound reaction and never the inbound event, so the file sat empty for three
months while the keystone read from it. Nobody noticed until the doctor grew a
check for it. So build both halves, and ship the doctor check in the same PR:
capture is not done until the table is non-empty in production.

Their behavioral rule is also right: exactly one short follow-up on a 👎, and
never nag.

### P5. The weekly measurement protocol (D5)

**Leverage: high. Effort: medium. Risk: medium, it is outbound contact.**

Superhoma does not wait for signal. Weekly it recomputes the child's exact age,
rescores every subdomain, and hands the parent 5 to 10 quick observations that
take about five minutes. The model updates from the answers.

We wait. Our own audit found conversational journaling fired eight times ever
across the whole fleet before PR #79. Same disease, and they cured it with a
scheduled beat rather than a better prompt.

We already own every part: the check-in card, `create_task`, `score_child_report`,
and a scheduler. This is assembly, not invention. It needs a founder ruling on
cadence and on how it interacts with the wall and the kill test, so it should
not ship silently.

Their Forms insight is worth stealing too: a form where she taps once per
question beats asking her to type. Our check-in card is already that shape.

### P6. Give the voice permission, not only constraints (D6)

**Leverage: medium to high. Effort: hours. Risk: needs a founder ruling.**

This is the personality delta Alessa is reacting to, and it is smaller than it
looks. Our "Have opinions" section already carries the conviction. What it does
not carry is any permission to be funny.

Counting the Voice section: roughly fifteen rules, nearly all negative. One
idea per sentence. At most one metaphor, usually none. At most one emoji,
usually none. At most one gentle suggestion. Sentence case. No em dash. Never
say behind. Offers never commands. Reassure before you inform.

Every one of those is defensible on its own. Stacked, they describe what Homa
must not do and never once describe a Homa somebody would enjoy talking to.
SOUL.md spends its last two paragraphs on exactly that: wit that comes from
actually being smart about your work, and "be the assistant you'd actually want
to talk to at 2am. Not a corporate drone. Not a sycophant."

The 2026-07-08 ruling (clarity beats personality) is binding and I am not
proposing to reopen it. But that ruling was aimed at metaphor stacks and
meta-commentary, and its own text says fewer words is not the goal. There is
real space between "no metaphor stacks" and "no wit at all", and we are
currently sitting at the far end of it.

Proposed, for a founder ruling:
- Add one positive line permitting dry humor when it is genuinely funny, never
  at the parent's or a child's expense, and never as a bit.
- Keep every existing constraint.
- Swearing stays out. Superhoma is talking to its founders. Ours meets
  strangers.

Note the blast radius: the Voice section is hand-mirrored into
`report-writer.md` and `curriculum-writer.md`, and the phone persona is split
out of this file by `scripts/telnyx-provision.mts`. Change one, change all
three, and bump `REPORT_PROMPT_VERSION`.

### P7. Heartbeat discipline for the schedules we already run (D7)

**Leverage: medium. Effort: hours. Risk: low.**

Two rules from HEARTBEAT.md are portable as-is, and both were written after a
real miss:

- **Persist what you checked, or the next run goes blind and falsely concludes
  nothing is new.** This is exactly our dropped-offer failure: acceptance and
  fulfillment were decoupled and nothing held a cursor between them.
- **Check completion state before acting on a deadline.** Their heartbeat once
  nearly redid a syllabus Less had already filled in. Any proactive nudge we add
  needs the same guard, or Homa tells a parent to do a finished thing.

### P8. Real-world calendar reach (D8)

**Leverage: medium. Effort: medium. Risk: medium, it is a new OAuth surface.**

The planner shipped 2026-07-27 and only knows events the parent typed into Homa.
Superhoma reads Less's actual Google Calendar, so its weekly plan knows about
co-op, Spanish class, and the appointment on Tuesday.

Read-only calendar (OAuth or an ICS subscription) is the highest-value single
item on their tool surface that we lack. Full Workspace write access as the
parent is not something we should want.

---

## 4. What not to port

- **Autonomous code shipping.** Correct for one family with a founder watching.
  Not for a fleet.
- **Swearing.** Right audience there, wrong audience here.
- **The filesystem as source of truth.** Postgres plus RLS is the reason we can
  serve more than one family.
- **The Obsidian vault.** Their compiled-wiki pattern is good and we already
  have its equivalent in the report page, planner, and binder.
- **A skill per one-shot task.** Their own reflect skill warns against this
  after doing it once.

---

## 5. One security note

`homa-macmini/.openclaw/workspace/TOOLS.md` carries a live SerpAPI key in
plaintext, at line 108, in a file that is loaded into the agent's context every
session and is inside a git repository (`.openclaw/workspace/.git` exists). It
should move to `.env` alongside the second copy of the same key that TOOLS.md
already references correctly at line 210. I have not touched the file.

---

## 6. Suggested sequence

1. P1 what-works read side. Hours, no ruling needed, biggest quality jump.
2. P4 thumbs, with its doctor check in the same PR. Small, and P3 wants it.
3. P2 production doctor. Everything else gates on it.
4. P3 fleet reflect, analysis only, filing issues.
5. P6 voice ruling, since it is a founder call and can run in parallel.
6. P5 weekly protocol and P8 calendar, after a founder ruling on outbound
   cadence.

---
---

# Part 2: the three axes, read properly

Part 1 catalogued differences. This part goes after the mechanism behind the
three that Alessa is actually reacting to, and separates each into the piece
that is structural, the piece that was ruled out on purpose, and the piece we
already own and are not using.

The headline: **we hold every structural component of superhoma's compounding
loop except one, we disabled that one on 2026-07-09 for a reason that has since
expired, and nothing we hold is wired to anything else we hold.**

---

## 7. Axis one: the always-on filesystem

### What its filesystem actually does

`15-agentic-architecture.md` §1 already names this better than I can: the Mac
mini filesystem did **three jobs at once**. System of record. Working memory.
Tool surface. Cloud split those across Postgres, dynamic instructions, and
bounded tools, and that split was ruled correct. It is correct.

But the split dropped a fourth job nobody assigned to a new home: **the
filesystem was also where a piece of work became a permanent capability.**

The evidence is in `homa-macmini/.openclaw/workspace/scripts/`. **87 files, 78
of them python.** Not seeded by a human. Written by Homa, one at a time, each
because a task needed it. `build-weekly-plan.py`. `doctor.py`.
`regenerate_vault.py`. `build_measurement_form.py`. `deploy_dashboard.py`.

Look closer and the loop is visible in the fossils: `download-art-images.py`,
then `download-art-fix.py`, `download-art-fix2.py`, `download-art-fix3.py`.
Then `build-art-pdf.py` and `build-art-pdf-v2.py`. That is write, run, read the
error, write again. The mess is the proof that the loop is real.

Every one of those files is a capability that cost effort once and is free
forever after. Its skills then reference them: `homa-make-flash-cards`
"includes build script template", `homa-track-syllabus` emits through
`scripts/build-syllabus-pdf.py`. That is the ratchet.

### What we have

More than expected, and it is worth being precise, because "we have no
filesystem" is wrong.

- The sandbox is **deployed and real**: Vercel Sandbox with `networkPolicy:
  "deny-all"` on every backend (`agent/sandbox.ts`).
- `read_file`, `glob`, and `grep` are **enabled**, not disabled.
- Packaged skills' sibling files **already auto-seed into `/workspace/skills/`**.
  `materials-studio` uses this today: `read_file
  /workspace/skills/materials-studio/references/recipes/<name>.md` is how it
  loads a format recipe without paying for it in the router.

So Homa already has a read-only filesystem in production, and we use it for
exactly one thing.

- `apps/web/agent/sandbox/` **does not exist**. The documented seeding path
  (`agent/sandbox/workspace/**`) has never been used.
- Blob holds durable artifacts.
- Agent jobs (live in prod since 2026-07-18) are finite background work that
  outlives a turn.
- Schedules run four jobs, one of which researches three topics a night.

### The thing that is designed, approved, and never built

Ladder item **10**, `15-agentic-architecture.md` §5:

> | 10 | Durable family workspace projection | proposed Blob-backed projection
> seeded into sandbox | **Not built**; Blob artifact storage exists, but this
> projection does not | proposed surface |

The founder direction on 2026-07-09 was "all ten, in order." Items 1 through 9
are built. Item 10 is the only one that was never started, and item 10 is
precisely the missing fourth job: a durable per-family workspace that projects
into the sandbox so work can compound instead of evaporating.

**Gap:** the sandbox is a scratchpad that is wiped between turns and empty when
it arrives. Law #2 is right that sandbox files are not load-bearing state. Item
10 does not violate it: Blob is the durable substrate and the sandbox is a
projection of it. That is the same shape as dynamic instructions projecting
Postgres.

---

## 8. Axis two: writing and executing code

### We are not at zero, and the distinction matters

`create_printable` renders model-authored HTML and CSS through Chromium
(ladder item 9). Every worksheet Homa makes **is a program she wrote**, executed
by our infrastructure, on our clock. So the axis is not can-or-cannot. It is
three narrower gaps.

**(a) One language, one target.** HTML to a PDF. When the task is not a
printable page (transform a CSV of the parent's records, chart six weeks of
hours, batch-resize twelve photos into a collage, compute a schedule against
real dates, produce an audio file), Homa has no move at all. Superhoma writes
twenty lines of python.

**(b) No persistence of the code.** Ours regenerates every page from scratch,
every time. `find_materials` reuses the *output* (pass the previewUrl to
generate_image as a reference). The *recipes* under
`skills/materials-studio/references/recipes/` are human-written markdown that
ships with a deploy. Nothing anywhere lets Homa keep a generator she wrote.
There is no ratchet.

**(c) No execute-inspect-fix loop.** `create_printable` has a genuine review
loop (QC issues, fix, call again with `revisesId`), but it reviews the
**output**. Superhoma reads a stack trace and edits the code. Those are
different feedback loops and the second one is how you get to a thing that
worked when nobody predicted it would.

### Why it is off, and why that reason expired

`bash` and `write_file` are disabled by three-line sentinel files, founder
direction 2026-07-09, after a live probe. The ruling's own words are the
important part:

> The surface is real, ungoverned (no injection scanning on fetched content, no
> cost tags, no instruction guidance), and **mostly useless to the product
> today (the workspace is empty)**.

It was not turned off because code execution is dangerous in itself. It was
turned off because **there was nothing in the workspace and no pipeline to make
the ability worth its risk.** The doc says so directly, and adds that
re-enabling "is deleting a three-line file, which happens deliberately with
M0-03/M2-05 (the sandbox worksheet factory)."

Three of those four objections have since been answered or accepted:

- Deny-all egress: **configured**, on every backend.
- Cost tags: bounded tools with deadline tiers are now a CI-guarded law.
- Instruction guidance: we have six fat skills that did not exist then.
- Injection scanning (M2-14): still not built. This is the one live objection.

And there is a precedent for exactly this reversal. `web_fetch` was disabled by
the **same ruling on the same day**, and re-enabled four days later
(2026-07-13, `web-fetch-firecrawl`) with the founder explicitly accepting the
injection risk ahead of M2-14. Note *how* it came back: not by deleting the
sentinel and restoring the raw framework built-in, but as an **authored, bounded,
provider-backed tool** with a deadline tier and an https-only size cap.

That is the template. The recommendation is not `rm bash.ts`.

### Proposal P9: `run_script`, an authored bounded execution tool

Not the framework built-in. A tool we own, shaped by the web_fetch precedent
and the S8 council conditions that were written for exactly this:

- `defineBoundedTool` with its own deadline tier, per our law.
- Deny-all egress (already configured). No credentials in the sandbox;
  credential brokering by proxy per S8, so a key never enters.
- Workspace seeded per turn from the family's Blob projection (item 10), and
  scoped to that family only, so there is nothing cross-tenant to exfiltrate.
- Artifacts upload to Blob before the turn ends. Nothing in the sandbox is
  load-bearing, so law #2 holds.
- Output flattened and sanitized before it reaches a parent (S8: no remote
  resources, no JS, no metadata).
- The tool result is the only claim about what ran, per the tool-honesty law.

M2-14 stays the honest blocker for one specific path: script input derived from
untrusted content (a textbook photo, a fetched page). A first slice can carve
that out by sourcing script inputs only from the family's own structured
records, which is where most of the value is anyway.

### Proposal P10: let a proven generator become a durable artifact

This is the ratchet, and it is the higher-leverage half of P9.

Superhoma's `homa-system-skillify` exists to turn proven work into a reusable
skill. Our filesystem-first ruling (2026-07-15) correctly closed the runtime
skill-growing loop, and I am not proposing to reopen it: that ruling is about
**instructions**, which are fleet-wide and must ship with a deploy.

A generator script is not an instruction. It is an **artifact**, and artifacts
already have a durable home (Blob) and a per-family scope. So a script Homa
writes for the Walker family that works can persist in the Walker family's
workspace projection and be reused next month, without ever touching the fleet
prompt or another family.

That gives us the compounding property with none of the multi-tenant hazard the
2026-07-15 ruling was protecting against. Fleet-wide promotion of a generator
stays a human decision through a PR, which is exactly right.

---

## 9. Axis three: personality, mechanically

Part 1 counted the constraints. Here is why they land the way they do.

### Our rules are quotas; theirs are quality bars

"At most one metaphor per reply, usually none." "At most one emoji per reply,
usually none." "At most one gentle suggestion per reply."

A quota cannot tell a good instance from a bad one, so the safest play is to
spend nothing. Compare SOUL.md: *"Funny when it's natural, not forced bits,
just the wit that comes from actually being smart about what you do."* That is
a **criterion**. A model can act on a criterion. It can only ration a quota.

This is the same lesson as the anchor-selection fix, pointed at voice instead
of difficulty: a rule the model cannot execute at the decision moment is a rule
that produces defensive behavior.

### The wrapper defeats the content

"Have opinions" has real teeth, including the curriculum-for-five-year-olds
line. Then Voice, marked **binding**, says: reassure before you inform, offers
never commands, at most one gentle suggestion per reply.

Apply those three to an opinion and it comes out a hedge. The two sections
disagree, and the one marked binding wins. Superhoma resolves this explicitly
with a tiebreak: *"Charm over cruelty, but don't sugarcoat."* We have no
tiebreak, so the constraint always wins.

### Personality is specificity, and theirs has an audience

SOUL.md names Less, Sidney, and Story, and cites dated corrections ("Sidney
flagged this directly 2026-04-10", "you hallucinated Sunday on a Monday
2026-05-11"). Ours addresses an abstract homeschooling mother, because it must.

Some of this delta is the honest price of multi-tenancy. Not all of it.

### The architecture actively suppresses voice evolution

The Voice section is hand-mirrored into `report-writer.md` and
`curriculum-writer.md`, and `scripts/telnyx-provision.mts` splits the phone
persona out of `instructions.md` on a **literal string match** against one
heading. Changing voice means three synchronized file edits, a
`REPORT_PROMPT_VERSION` bump, and a provisioning push, with a comment at the
top of the file warning you not to repeat a phrase anywhere above the heading.

High friction means it does not get tuned. Superhoma edits SOUL.md in place,
and its own AGENTS.md instructs it to: *"When you learn a lesson, update
AGENTS.md, TOOLS.md, or the relevant skill."* **Its personality file is
writable by the agent.** Ours is frozen at deploy and expensive to thaw.

### Proposal P11: a `voice` memory kind

The multi-tenant-safe version of a self-editing SOUL.md, and it is cheap.

We already store per-family memory with kinds `fact` and `what_works`, injected
into every turn by `family-context.ts`. We have nothing for **how this parent
likes to be talked to**. Yet SOUL.md's operating instruction is exactly that:
*"Learn how she works. Figure out Less's communication style and adapt to it.
Don't force her into a system, build the system around her."*

Add a third kind, `voice`, holding facts like "she wants the bottom line first",
"she likes it blunt and short", "humor lands with her", "she reads on a phone
between things". Homa saves one when the parent shows or says it. The register
adapts per family without a deploy and without touching the fleet prompt.

Cost: one enum value, one line in the memory guidance, one line in Voice saying
a saved `voice` memory modulates register but never overrides the honesty,
safety, or growth-framing laws. It also creates the first real signal about
which voice settings correlate with retention, which no amount of arguing about
the copy rulebook can produce.

### Proposal P12: replace two quotas with criteria

Narrow, and it needs the same founder ruling as P6.

- Metaphor: replace the quota with "use one when it makes the idea land faster
  than the plain sentence would; otherwise use the plain sentence."
- Humor: add the permission that does not currently exist, as a criterion.
  Never at the parent's or a child's expense, never a bit, never when she is
  struggling.
- Add the missing tiebreak between Voice and Have opinions, in SOUL.md's shape:
  warmth never becomes vagueness, and when the honest answer is unwelcome, say
  it kindly rather than softening it into nothing.

Keep every other constraint. Swearing stays out.

---

## 10. What we could do today with zero new primitives

Separating this out, because it is the part that needs no ruling and no build.

| Have | Doing | Not doing |
|---|---|---|
| Sandbox with deny-all egress, deployed | Nothing. `agent/sandbox/` does not exist | Seeding fonts, the design tokens, worked HTML examples, golden anchors, state-requirement data, print templates |
| `read_file` / `glob` / `grep`, enabled | One thing: materials-studio recipe loading | Every other skill could carry heavy references at zero router cost |
| Agent jobs, live since 2026-07-18 | Curriculum studio, materials lab | Any self-directed work: a weekly rescore, a nightly per-family sweep, a fulfillment retry |
| `create_task` plus `/app/tasks` with on/off and run history | Morning brief, evening check-in | The parent-visible, parent-controllable home for every proactive beat we would otherwise argue about |
| Schedules (Vercel Cron) | Three research topics a night, job sweeping, memory compaction | The doctor, the reflect pass, the weekly protocol |
| Blob | Material artifacts | The durable family workspace (item 10), and durable generators (P10) |
| Per-family memory kinds | `fact`, `what_works` | `voice` (P11) |

Read down the "not doing" column: that is superhoma's entire loop, assembled
from parts already in production. The missing piece is not a primitive. It is
that **nothing composes them**, because no loop was ever wired to run.

---

## 11. Revised sequence

Cheap and no ruling needed:

1. **P1** what-works read side.
2. **Seed the sandbox.** `agent/sandbox/workspace/**` with fonts, tokens, worked
   examples, anchors. Turns an empty read-only filesystem into a useful one and
   costs nothing at runtime.
3. **P4** thumbs plus its doctor check.

Needs a build, no new ruling:

4. **P2** production doctor.
5. **Item 10**, the durable family workspace projection. Already approved
   2026-07-09 as part of "all ten, in order", and the only one never started.
6. **P3** fleet reflect, analysis only, filing issues.

Needs a founder ruling:

7. **P9** `run_script` as an authored bounded tool, with the M2-14 carve-out.
   The web_fetch reversal is the precedent and the template.
8. **P10** durable per-family generators, once item 10 and P9 exist.
9. **P11 / P12 / P6** the voice package. Independent of everything above and can
   run in parallel.
10. **P5** weekly protocol, **P8** calendar.

The ordering claim: 2 and 5 are what make 7 worth having, which is the exact
argument the 2026-07-09 ruling made when it turned execution off. Build the
workspace first, and the ability to write into it stops being ungoverned power
with nothing to point at.
