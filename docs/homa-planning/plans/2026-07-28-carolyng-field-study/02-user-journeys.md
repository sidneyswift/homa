# User journeys: current state vs target state

Every journey below is traced from Carolyng's actual two weeks, not invented.
"Current" is what the prod record shows happening. "Target" is the smallest
version that makes the journey succeed. Journeys reference features in
[04-features.md](04-features.md) and bugs in [05-bugs.md](05-bugs.md).

## J1. Handing Homa the family's world (ingestion)

The parent owns curricula, hundreds of books, six years of files, and a Yoto card
collection. She wants Homa to know all of it.

**Current.** She dictates her curriculum stack on a phone call: it evaporates
(B1). She photographs 10 book covers: acknowledged, logged as one reading session,
titles never stored. She asks "can I take pictures of all the books I have": Homa
says yes with no durable destination. Her six-year archive has no intake at all.

**Target.** Any channel accepts an asset drop (photo, PDF, link, dictation).
Homa runs the librarian pass the meeting describes: preserve the original, read
the words, extract the facts (type, subject, age band, difficulty, teaching
style, answers included), extract the entities (Christopher Columbus, the
Mayflower, bunnies), extract the layout lessons, and record the parent's taste
note. The asset lands in a family library the parent can browse and Homa can
query. Bulk intake (a folder, a shelf, a whole curriculum) is a job with progress,
not a chat message. (F1; fleet plane stays gh#328.)

**Success moment.** "What do we own about insects for a 3-year-old?" returns her
actual shelf, and a lesson request silently uses it.

## J2. Curriculum to calendar (the year that plans itself)

**Current.** Her curricula specify week-by-week content ("week two the sun, week
eight Mars"). Homa cannot ingest that structure, cannot write a month plan into
the planner without a per-child UI tap, and SMS cannot see the planner at all
(B4). She keeps open-and-go books next to a product that should be that.

**Target.** Ingest a curriculum (photos or PDF) and Homa proposes the week-by-week
schedule onto the planner per child; the parent approves; every planner cell knows
its topic. "I need a supplemental worksheet for science" on week 8 resolves to
Mars without re-explaining. The four-week generation cap applies to what Homa
authors, not to ingested curricula (F2, F9).

**Success moment.** Week 8, one sentence, correct supplemental worksheet on the
calendar, zero context re-entry.

## J3. Request to print in two rounds (materials)

**Current.** Median simple themed worksheet: 1-3 rounds (good). Multi-page packet
for a 3-year-old: dozens of rounds over days, layout regressions each round, QC
claiming success while pages stay broken, drafts stranding unfinalized, versions
invisible, "where is it?" navigation dead-ends (B2, B3).

**Target.** First render passes a print-parity QC that measures what she measures
(fill, cut-off, per-age element sizing, tracing-line geometry). Revisions edit one
page, not the packet. Every version stays visible in a history rail. Draft vs
final is a visible state with one-tap finalize, and anything Homa delivers is
findable from the binder without scrollback (F5, F6, and the #197/#241/#175
cluster).

**Success moment.** The transcript's own bar: "get it from you having to talk to
her 20 times to talking to her once. Twice maybe."

## J4. One brain across phone, text, and web

**Current.** A call logs hours; web denies they exist three hours later. A call
promises an email; no channel ever sends it. She tests Homa's memory across
channels like a skeptical spouse, and Homa fails the test (B5, B6).

**Target.** A call is visible to every channel within a minute of hangup. Any
promise made on any channel lands in a fulfillment ledger with a deadline and a
delivery receipt, and the morning-brief recovery engine covers in-call promises
too (#278, #281, F10).

**Success moment.** Her own test: "calling her back to see if the phone woman
knows what the chat woman said." It passes.

## J5. The daily loop (calendar-first mornings)

**Current.** The chat is the front door for everything, so every day starts with
typing. Materials arrive attached to conversations, not days. Nothing is waiting
in the morning unless she asks the night before.

**Target.** The planner is the front door. Tomorrow's lesson exists tonight,
pre-approved materials attached, printed in one tap in the morning. Check-off,
photo capture, and time logging happen on the calendar cell, and hours accrue to
the per-child totals she can actually see (F7, CG-02 read-side, #259 write
parity).

**Success moment.** "You just print. Like, that's where we want to get to."

## J6. Interest-powered, not interest-drowned (theming)

**Current.** Theming is binary and sticky: whatever theme she names is applied
maximally. Older kids clock low-fidelity character art (the Astro Bot that "wasn't
the real one", the "Ps5 astrobot" correction). Nobody governs saturation.

**Target.** Theming has explicit levels (none, decorative, immersive) chosen per
material by age and subject; real literature and assessment pages stay untheme'd;
Homa tracks interest freshness and rotates or offers instead of blanketing
("I can make this Vikings if Kirby's getting stale"). Fidelity scales with age:
a 9-year-old gets canon-accurate; a 3-year-old gets vibes (F4).

**Success moment.** A week's plan ships with mixed theming she never had to
specify, and the kid still gets excited on Friday.
