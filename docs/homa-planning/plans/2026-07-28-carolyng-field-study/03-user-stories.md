# User stories with acceptance criteria

Persona throughout: a multi-child homeschooling parent (Carolyng-class: 3 kids,
3 ages, bilingual household, phone-first, state compliance obligations). Stories
are grouped by journey. Sizing: S (day), M (days), L (week+), XL (arc).

## Library and ingestion (J1)

**US-1 (L).** As a parent, I can send Homa photos of my bookshelf, a worksheet I
love, a full curriculum, or a link, and it becomes a permanent, tagged item in my
family library.
- AC: the original file is preserved unmodified and privately stored.
- AC: the item carries type, subject(s), age band, language, entities/topics, and
  my one-line taste note when I gave one.
- AC: I can see the library, search it, and delete an item.
- AC: works from web, SMS/MMS, and (via post-call fulfillment) phone.

**US-2 (M).** As a parent, when I mention a book or curriculum by name in any
conversation, Homa records it durably instead of losing it at session end.
- AC: the 07-23 call transcript replayed through the pipeline yields the full
  curriculum stack as library/context entries, model-proposed and code-verified
  against the transcript quote (models judge, code verifies).

**US-3 (L).** As a parent, I can ingest a curriculum and have Homa decompose it:
the curriculum, its per-week topics, its per-lesson content, its book lists and
activities, each retrievable on its own.
- AC: "what does week 8 of Ara's science cover" answers correctly.
- AC: the curriculum's referenced book titles appear as library entries flagged
  "referenced, not owned" unless matched to owned items.

**US-4 (M).** As a parent, I can ask "what do we have about insects for a
3-year-old" and get an answer drawn from my library plus my materials history.
- AC: retrieval is tenant-scoped, ranked, and cites which asset each hit came
  from; zero hits answers honestly.

**US-5 (S).** As Homa, when I build a lesson or worksheet, I check the family
library first and prefer owned assets ("here's an example of a happy birthday
book, let me use that") before inventing or recommending purchases.
- AC: materials-studio's brief includes library hits when relevant; the skill
  cites which library items informed the material.

## Curriculum to calendar (J2)

**US-6 (L).** As a parent, I can approve an ingested curriculum's week-by-week
schedule onto each child's planner.
- AC: each planner cell knows (child, subject, week topic, source curriculum).
- AC: cells are Homa-written through the plan-edits path, parent-approved before
  landing, never silently placed (offers-never-auto-place law, #255).

**US-7 (M).** As a parent, when I ask for supplemental material, Homa resolves
"what we're doing this week" from the planner and curriculum without me
re-explaining.
- AC: a week-8 request generates Mars material, not generic space.

**US-8 (S).** As a parent, I cannot ask Homa to author more than four weeks of
curriculum at once, and the refusal explains why kindly.
- AC: copy per the meeting: your child changes; four weeks of data makes the next
  four weeks better. Ingested external curricula are exempt.
- AC: recorded as a founder ruling before enforcement (F9 requires ratification).

## Materials loop (J3)

**US-9 (L).** As a parent, my first render usually survives my own checklist:
pages are full, nothing is cut off, elements are sized for the child's age
(scissors, crayons, tracing hands).
- AC: print-parity QC measures rendered PDF pages (not screen DOM): fill ratio,
  overflow, min tap/cut/trace dimensions by age band, before claiming "passed".
- AC: "it passed" may only be said when the checks that failed last round now
  pass; regression on a previously-fixed page is a QC hard fail.

**US-10 (M).** As a parent, I can see every prior version of a material and roll
back to one.
- AC: the binder card exposes the `revises` chain as a version rail with
  thumbnails; "go back to the one before" works in chat too.

**US-11 (M).** As a parent, drafts are visible, resumable, and finalizable in one
tap, and Homa proactively finalizes when I say things like "perfect, thanks".
- AC: the #197/#241/#175 cluster closed; a finalize timeout retries and reports
  truthfully (07-28 case); no material invisible in both binder and chat.

**US-12 (M).** As a parent, I can hand Homa a reference layout ("like this
Tristan name-tracing sheet") and get that layout with my child's content.
- AC: the reference image is retrievable for the whole session and stored to the
  library; the produced page is compared against the reference's structure in QC.

**US-13 (S).** As a parent, anything with answers ships with an answer key on its
own page by default.
- AC: worksheet/lesson kinds with gradeable items include a separate key page;
  keys never print readable on the student page.

## Cross-channel (J4)

**US-14 (M).** As a parent, promises Homa makes on a call become tracked
deliverables that actually arrive.
- AC: post-call pipeline extracts commitments (model proposes, code verifies
  against transcript), writes fulfillment rows, executes or escalates within a
  deadline, and the morning brief surfaces any still-unfulfilled promise.
- AC: the 07-23 "curriculum list + Yoto email" case replayed produces a delivered
  email or an honest failure message to her, never silence.

**US-15 (S).** As a parent, every channel knows a call happened within a minute
of hangup (#278 acceptance stands; this study re-confirms demand).

## Daily loop (J5)

**US-16 (L).** As a parent, tomorrow's planner cells carry their materials
tonight, and the morning flow is print, teach, check off, photograph, log.
- AC: a planner cell links its material(s); check-off writes progress; a photo
  attaches to the cell; time logs against child and subject from the cell.

**US-17 (M).** As a parent, I can see per-child hours: today, week, month, school
year, filterable by subject, editable (CG-02; the read side her 07-25 "where can
I see the school hours" question demands).

## Theming (J6)

**US-18 (M).** As a parent, I control theme intensity per material (none,
decorative, immersive), and Homa chooses sensible defaults by age and subject.
- AC: assessment pages and real-literature reading default to none; a 9-year-old's
  immersive theme uses canon-accurate content; a 3-year-old's uses simple motifs.

**US-19 (S).** As Homa, when I blanket-generate a week, I generate unthemed and
offer per-item theming rather than saturating ("want this one Vikings?").
- AC: offers are capped (no 20-question interrogation); one offer per batch.

## Recording and attribution (new from this study)

**US-20 (M).** As a parent, I can move a lesson recording (and its downstream
review/evidence) to the correct child, and Homa can see my recordings when I ask.
- AC: agent tool lists recordings with child, date, duration, status.
- AC: reattribution moves recording, review, and evidence rows atomically;
  tenant-scoped; the 07-27 Alma-to-Amalia case resolves in one message.
