# Portfolio review session · insights, tickets, attack plan

> Status: PLAN (2026-07-12). Source: the 2026-07-11 evening family
> session transcript (Sidney; Alessa, spelled "Alyssa" by the
> transcriber; Carolyn), supplied by the founder with the ask: extract
> insights and tickets, align with how Homa currently operates, and
> plan the attack from simplest to most complex. Ticket IDs are
> plan-local (FS-n, family session), the same convention as T-n and
> RT-n; promotion into 03-backlog.md is a founder step. Nothing here
> supersedes a founder ruling; open calls are listed at the bottom.

## Context the plan is built against (verified in repo, 2026-07-12)

- The Binder shipped the morning after this session as a Direction 1 +
  Direction 2 merge (build-log 2026-07-12): finalized materials only,
  kind chips, search, a "Ready now" cover of the 3 newest, family/child
  scope from the app-wide view context. No folders, no subject
  browsing, no plans section; the `materials.tags` column is unused;
  300-item stopgap cap.
- Materials studio v2 is live: `create_printable` (html, image,
  hybrid), `generate_image` with family-Blob reference images,
  `find_materials`, `mark_material_final`, vision self-review, a
  calibration harness, metadata (kind, free-text subject, free-text
  curriculum, theme, characters, skill), draft/final/superseded
  lineage. Caps: images stay at 30 per family per day; the
  20-materials-per-day cap was removed by founder ruling while this
  plan was under review (2026-07-12, "no 20 a day cap").
- The Planner shows Homa's four-week plans spread Mon-Fri; check-offs
  sync to `child_plans.progress`; day-level scheduling is M2-10;
  parents cannot add their own blocks. The Tasks tab holds
  parent-created scheduled agent tasks.
- `hours_log` + the `log_hours` tool exist (subject, minutes, date,
  note; compliance posture). There is no daily "what we did" activity
  log, no attendance, no portfolio export. T9 (day log / portfolio
  accretion) is open and unscoped; M3-06 (state report v1) and MJ-33
  (evidence locker) are the registry homes.
- `families.context.curriculums` (free-text tags from onboarding) feeds
  fleet research demand and the plan/report writers but is not injected
  into chat or materials context (a gap the education knowledge
  architecture plan already notes). `knowledge_bank`, nightly fleet
  research, and the per-family morning brief are live machinery.
- ChildProgress is live in production (2026-07-12): a skill-evidence
  ledger, not a diary.
- Policy fences binding these tickets: chat is the front door; subject
  → domain → topic taxonomy; never position Homa as a curriculum
  (house style); D4 photo floor; minors' media privacy is an unresolved
  founder decision; no red or "behind" framing, never compare siblings;
  copy gates for parent-visible words.

## Insights from the session

Numbered so tickets can cite them. Each ends with where the repo
stands today.

### Binder and organization

- I1 · First-glance appeal and navigability diverge. Carolyn's eye went
  to the file-cabinet look ("it looks like my computer"), but the
  direction she could actually click through won the discussion. The
  shipped 1 + 2 merge matches the session's conclusion; this insight is
  closed evidence for that decision.
- I2 · Recency first: "I would really love it if the recent things that
  I have made come up first." Shipped as the cover (3 newest finals).
  The session's framing is "this week"; the cover says "Ready now"; a
  small label and count alignment remains.
- I3 · Scale anxiety is immediate: "by the time I've made like a
  hundred things, am I just going to keep scrolling through 100
  things?" Today: flat grid, search, kind chips, 300 cap. Folders (I5),
  subject views (I7), and archive (I4) are the pressure valves.
- I4 · Two-tier mental model, named by the moms themselves: the living
  binder ("what you would have on your kitchen table") versus the file
  cabinet ("at the end of the school year, Homa says: I'm compiling
  your portfolio for the year. Are we now safe to archive?"). No
  archive concept exists anywhere; maps to T9 / M3-06 / MJ-33.
- I5 · Parent-named folders, agent-managed: "Homa, can you create a
  folder for Paw Patrol letter tracing, and anytime you make me a
  worksheet, put it in that folder", surfaced in the binder as "one of
  those little open flat folders ... A to Z Paw Patrol." No collection
  model exists; revision chains are the only grouping.
- I6 · Ask once, get the series: "right now you have to ask Homa every
  day for a different letter. Ideally you asked her one time. Homa
  realizes she's going to need every letter eventually, generates all
  of them, saves them in this folder, and that's where Homa pulls them
  from." Nothing series-shaped exists. The 20-materials-per-day cap
  that would have blocked a 26-letter set was removed by founder
  ruling (2026-07-12); the remaining constraint is the 30-images-a-day
  cap when a series leans on the image path, plus per-call latency.
- I7 · Subject organization lowers cognitive load: "I would personally
  love to have stuff broken down by subject ... the easier locating
  what I need is, the better for me." Subject is stored free-text and
  searchable but not browsable; hours has its own subject enum;
  progress has the subject → domain → topic ruling (FD-6).
- I8 · Plans belong where materials live: the binder should show what
  she made this week, saved materials, and "the plans she's created"
  (four-week plans, curricula). This is the design doc's release
  ladder step 2, deliberately not in v1; `child_plans` and
  `child_curricula` exist to link.
- I9 · The moms handed over a plan-size vocabulary: curriculum = the
  year (36 weeks); term = a quarter or season; unit study = about four
  weeks on one topic (butterflies, Jupiter); lesson = a one-off
  teaching moment; practice = the repeatable work after a lesson.
  Promotion is real: "if that one lesson really engaged them, build me
  a full curriculum for the next 12 weeks." Only "four-week plan" and
  a free-form curriculum exist today.
- I10 · One item, many views: nothing should live in two places;
  subject views and plan views should be filters over one store. The
  metadata model already agrees; keep it that way as views multiply.

### Curriculum strategy

- I11 · Trust ladder, not replacement: "until Homa fully proves
  herself, to rely solely on Homa for a curriculum is what I'd
  struggle with. For my core subjects." And: "her strong point is that
  she helps fill in the gaps of what we have." Their predicted adoption
  path: cute ideas → worksheets → a week of lessons → unit study →
  term → year, pulled by proof ("case studies that say Homa improved
  my kid by X"). This matches the house-style law (Homa works with
  your curriculum, never is one) and M3-13's post-revenue placement.
- I12 · Learn the curriculums' shapes: "she needs to do a deep, deep
  dive of the top 50 curriculums and learn how they're making their
  books, what their books look like, the verbiage." Carolyn's
  precision: Homa does not need full curriculums, she needs (a) what
  kids must know by grade, (b) each curriculum's table of contents and
  scope and sequence, (c) enough samples to match the feel, "so that
  somebody that does Singapore math is going to be like: oh yeah, that
  fits perfectly." Plus TPT as the reference for what a functional
  worksheet looks like. Today: curriculum tags feed fleet research
  demand; `knowledge_bank` exists; math and ELA crosswalks exist in
  docs/homa-benchmarks; the education knowledge architecture plan
  (2026-07-10) is the registered home; none of it reaches the studio.
- I13 · The internal spine (Sidney's frame): curate the best of all
  curriculums into a backend "Homa curriculum" that personalizes per
  kid (the Alpha Schools analogy: that experience for $100 a month
  instead of $60k a year), using the research-once,
  customize-per-family pattern fleet research already proves. "Nobody
  needs to know what the HOMA curriculum is on the back end." Alessa's
  fence: do not fight the curriculum world openly. Carolyn's fence:
  ground it in standards; a named curriculum is a style skin, not the
  target. No registry ticket exists; post-revenue horizon; the
  quiet-backend framing is mandatory under the positioning law.

### Materials quality

- I14 · Replication fidelity fails today: the Handwriting Without Tears
  letter-O boxes came out wrong, and "even the formatting of her
  worksheets is weird ... six little letters and then an image off to
  the side", no cohesiveness. Reference images and self-review shipped
  07-10 and a calibration harness exists; tracing-box and dense-layout
  briefs belong in the calibration set, and the skill's layout
  discipline needs the curriculum-sample diet (I12, FS-13).
- I15 · Manipulatives are invisible to Homa: "get your 10 frame out, or
  create a template, here's a printout of a 10 frame, use beans: she's
  not thinking that way yet." Nothing in the materials skill mentions
  manipulatives; a printable 10-frame is exactly the html path's
  strength.
- I16 · The moms will feed her: "send you links to all of the most
  popular curriculums", "I have hundreds of things I've scraped
  together", whole digital bundles. Alessa also raised the copyright
  worry ("sounds like a lawsuit"). There is no ingestion path for
  parent-supplied reference files; `generate_image` already accepts
  family-Blob references, so storage is the missing half (FD-5).

### Planner, logging, portfolio

- I17 · The planner replacement is a logging loop, not a calendar
  widget. Alessa already dropped her paper planner: "I speak to her and
  she literally says: great, logged it." Carolyn's ask: input the
  weekly subject schedule once, log per kid by voice ("log this for
  Alma, log this for Ara"), let Homa's materials land on the calendar,
  check things off, including things Homa did not make. Today:
  `hours_log` captures minutes and subject only; no activity diary, no
  parent schedule, no unified check-off. T9 is the open registry home.
- I18 · The record is the portfolio: "then I would have a running
  record of what we did in homeschool ... one less thing for me to do",
  feeding the end-of-year compile (I4) and state compliance (hours,
  time, coverage). M3-06 and MJ-33 are the registry homes; the input
  stream (I17) is the missing substrate.
- I19 · The Sunday-night call is competitive intel for exactly this:
  "their big selling feature is that they log hours and stuff. I'm
  wondering how they have it structured." Sequence FS-7's design after
  that call.
- I20 · Homa should know what comes next. Today the curriculum answers
  that ("we finished lesson 12, so tomorrow is lesson 13"); the moms
  expect Homa to eventually place reinforcement weeks and next steps.
  Needs I12's scope-and-sequence knowledge plus the plan taxonomy
  (I9); the far end is I13.

### Personalization, onboarding, other capabilities

- I21 · Unlimited question appetite when it serves the kid: "I honestly
  cannot think of anything that I love more than answering questions
  about them"; "before I can help your child learn, I have to learn
  you." The onboarding depth fork (mom decides, instrumented) is
  already ruled and planned; this is confirming evidence, not a new
  ticket.
- I22 · Personalization data should be offered, never demanded: family
  names, nicknames, and "would you like to submit a picture, or do you
  want to tell me what they look like?" D4's photo floor is law; child
  likeness work stays with M2-05. Design guidance, not a new ticket.
- I23 · Spanish is a differentiator: good Spanish materials barely
  exist ("putting it through something to translate doesn't work"),
  and Homa's Spanglish already delights. No language awareness exists
  in materials metadata or the skill; cheap to add.
- I24 · The writing feedback loop is a wanted capability: photograph
  the kid's writing, get an impartial read against the standard, gap
  patterns, next steps, "keep her voice authentic to her ... I need
  something to help me zoom out." Photos already flow through chat and
  SMS; nothing structured catches them as work review; ChildProgress
  could take the evidence.
- I25 · Start empty, show the shape. At signup: "nothing pre-made ...
  then she starts cataloging things", but also "it would be really
  nice when people first sign up and see how it would be organized."
  The binder empty state is one sentence today.
- I26 · Socials (the founder's own priority in the session: "what's
  more important is socials and onboarding"): Instagram first, 15 to
  30 second screen-capture demos ("she just made me this ... in 10
  seconds"), text on screen, product before founder intros; Sidney
  owes a viral-styles list; the moms film this weekend; posting logins
  and Homa's email login are human setup. The marketing demand engine
  and gates exist; DM7 (waitlist consent) is open; handle registration
  is an open human todo.

## Tickets

Sizes: S (hours), M (about a day), L (multi-day), XL (founder-scoped
program). Each cites its insights and existing registry homes.

### Wave 0 · polish, zero schema (safe around the conference)

- **FS-1 (S · I2, I7) Binder subject browsing.** SHIPPED 2026-07-12
  evening (build-log same date). A subject chip row built from the
  subjects actually present (case-normalized for grouping, display
  capped), alongside a labeled kind row; the cover shows the trailing
  week's keepers under "This week" and falls back honestly to
  "Newest". Pure additions to `lib/materials/binder.ts` + tests +
  `binder-view.tsx`. No schema.
- **FS-2 (S · I14, I15) Manipulatives and tracing discipline in the
  studio.** SHIPPED 2026-07-12 evening. `materials-studio` SKILL.md
  gained a manipulatives section (printable ten-frame recipe,
  household stand-ins, offer never lecture) and a letter-box recipe
  for box-based handwriting curricula; the calibration brief set
  gained ten-frame and letter-box briefs.
- **FS-3 (S · I12) Curriculum context reaches the studio.** Inject
  `families.context.curriculums` + homeschool styles into the agent's
  family context block (bounded to a line or two) so "make it feel
  like Dimensions Math" works without the parent restating it.
  Code-only; watch the context budget. Deliberately held past the
  conference: it changes what the model sees on every turn.
- **FS-4 (S · I25) Binder empty state previews the organization.**
  SHIPPED 2026-07-12 evening. The empty state names the keep gesture,
  previews the kind vocabulary as faint pills, and ends in an Ask
  HOMA button to chat. Copy passed both gates (reader, then editor).

### Wave 1 · the organization and logging spine (additive schema)

- **FS-5 (M · I5, I3) Collections v1.** `material_collections`
  (family-scoped, name, optional child) + a nullable
  `materials.collection_id`; agent tools to create a collection and
  file materials (including at create/finalize time); binder folder
  cards ("A to Z Paw Patrol", item count) + a folder view; isolation
  guard coverage + typed events. Recommendation: a real table; leave
  `tags` free for later cross-cutting labels.
- **FS-6 (M · I6, needs FS-5) Series behavior.** Skill discipline:
  recognize set-shaped asks ("a letter A worksheet" implies A to Z),
  offer the set once, create the collection, then generate the set
  into it. FD-3 is ruled: no materials cap, so the set may build in
  bulk; batches should still land a few at a time (turn latency,
  review quality, the 30-a-day image cap on image-path pages), with
  the existing dispatch machinery as the overnight fallback for long
  sets.
- **FS-7 (M · I17, I19) Daily activity log.** An `activity_log` table
  (family, optional child, date, summary, optional subjects and
  minutes) + a `log_activity` tool with `log_hours`'s dedupe posture;
  pairs with an hours row when a duration is stated; recall can read
  it. Design lands after the Sunday-night call (I19). FD-4 decides the
  table shape.
- **FS-8 (M · I17, I18, needs FS-7) "What did we do last week."** A
  recap the parent can ask for in chat: activities + hours + materials
  made + progress notes, per kid or family, portfolio-toned (no
  comparisons, no "behind" framing). Skill + read paths, no schema.
- **FS-9 (M · I23) Language-aware materials.** An additive `language`
  column (or a documented convention on `tags`), skill guidance for
  Spanish and dual-language output, and a binder chip that appears
  only when more than one language exists.
- **FS-10 (M · I24) Work-sample review capability.** A skill for
  "here's a photo of her writing": impartial strengths,
  standard-anchored gaps, next steps, a voice-preservation rule
  (improve the writing, never rewrite the child); offers (never
  auto-writes) ChildProgress evidence through `manage_child_progress`
  when confident.

### Wave 2 · the knowledge and planning programs

- **FS-11 (L · I17; relates M2-10, M3-08, F5, MJ-19) Parent week
  schedule + calendar planner.** Parent-defined weekly subject blocks
  (chat-first entry per the front-door law); the planner merges parent
  blocks, Homa plan activities, and materials; one check-off model.
  This is the "replace my homeschool planner" core; MJ-19's printable
  week rides on it later.
- **FS-12 (L · I12, I20; home: education knowledge architecture plan)
  Curriculum knowledge program.** Extend fleet research demand with
  curriculum-style topics (style descriptors, scope and sequence,
  grade standards) seeded by the benchmarks crosswalks; gate the
  results into the studio and the plan writers. Style learning from
  public samples only; no page reproduction (FD-5).
- **FS-13 (L · I16, I14; the lighter slice of M2-12) Family reference
  ingestion.** Parent-uploaded curriculum pages and bundles become
  family-private reference items (Blob + reference records) that
  `find_materials` can surface and `generate_image` can consume as
  references. Guardrails: family-private, style matching, no
  redistribution; FD-5's posture first.
- **FS-14 (L · I8, I9, I10) Plans in the binder + plan-size
  vocabulary.** Formalize lesson / unit (about 4 weeks) / term / year
  shapes over `child_plans` + `child_curricula`; a binder Plans
  section links live plans (release ladder step 2); a promotion flow
  ("that lesson landed, build the 12-week version") as agent behavior.

### Wave 3 · the long arcs (founder-scoped)

- **FS-15 (XL · I4, I18; homes: T9, M3-06, MJ-33) Archive +
  end-of-year portfolio.** An archive status and a year-end compile
  ritual ("safe to archive?"), a portfolio document built from the
  activity log + hours + materials + progress, and compliance exports.
  Child work photos wait on the unresolved minors' media decision.
- **FS-16 (XL · I13, I11, I20; post-revenue) The internal spine.** A
  curated per-subject year scope grounded in standards plus FS-12's
  knowledge, personalizing plans per kid, surfacing only through plans
  and materials. Never marketed as a curriculum (house-style law).

### Marketing lane (parallel, small)

- **FS-17 (S · I26)** Extract this transcript's marketing signals into
  `marketing/raw` + `marketing/signals` through the signal-extraction
  skill (the 10-second demo format, the Paw Patrol patterns story, the
  Alpha Schools cost anchor, the TPT habit).
- **FS-18 (S · I26)** The promised viral-styles list: a short research
  doc of current short-form formats that fit house style
  (screen-capture plus text-on-screen product demos), for the moms'
  weekend filming. DONE 2026-07-12: the founder delivered the list to
  the moms directly.
- **FS-19 (human · I26)** Social account logins, posting setup, and
  Homa's email login for sends. Founder and mom task; DM7 stays open
  before any nurture email.

## Attack order, simplest to most complex

1. FS-2 · studio manipulatives + calibration briefs (markdown, safest)
2. FS-1 · binder subject browsing + cover label
3. FS-4 · binder empty-state organization preview (copy gates)
4. FS-3 · curriculum tags into agent context
5. FS-18 · viral-styles list for the weekend filming
6. FS-17 · marketing signal extraction from this transcript
7. FS-9 · language-aware materials (first additive migration)
8. FS-5 · collections v1 (folders)
9. FS-6 · series behavior on top of folders
10. FS-7 · daily activity log (design after the Sunday-night call)
11. FS-8 · "what did we do last week" recap
12. FS-10 · work-sample review capability
13. FS-13 · family reference ingestion
14. FS-12 · curriculum knowledge program
15. FS-11 · parent week schedule + calendar planner
16. FS-14 · plans in the binder + plan taxonomy
17. FS-15 · archive + end-of-year portfolio
18. FS-16 · the internal spine

Timing fences:

- Today (Sunday): the conference is tomorrow, so production stays
  boring. If anything ships today it is Wave 0 only, deployed and
  probed early, frozen by evening. Shipping nothing today and starting
  Tuesday is a legitimate call.
- Tonight, 11pm: the logging-structure call; capture how they model
  hours and day logs before FS-7 is designed.
- Monday: conference; no deploys during demo hours.
- Tuesday onward: Wave 1 in order, then Wave 2. Wave 3 waits for
  founder scoping and post-revenue sequencing.

## Standing constraints on every ticket

- Additive migrations only, code first (the 2026-07-10 outage law);
  `pnpm check:isolation` before schema work; new tables need guard
  coverage; typed events per the MJ-08 law; run `eve build` locally
  before pushing agent changes.
- Chat is the front door: new capabilities are agent behaviors first,
  UI second.
- Copy gates for parent-visible words; sentence case; no em dash;
  never compare siblings; no red or "behind" framing.
- Never position Homa as a curriculum on any parent-visible or
  marketing surface.

## Open founder decisions (FD)

- FD-1 · Subject browsing as chips now (recommended) vs planner-style
  tabs later; revisit when folders land.
- FD-2 · Folders agent-managed only at v1 (recommended) vs binder-side
  create/rename/drag UI.
- FD-3 · RULED (founder, 2026-07-12): "no 20 a day cap." The daily
  materials cap is removed from `create_printable`; series generate in
  bulk. The 30-a-day image cap was not part of the ruling and stands
  until the founder says otherwise; usage visibility continues through
  the model_usage ledger per the MS-6 posture.
- FD-4 · Activity log as a new table (recommended) vs widening
  `hours_log`; revisit after the Sunday-night call.
- FD-5 · Copyright posture for curriculum learning: public samples for
  style descriptors plus family-private uploads for personal use
  (recommended); full ingestion waits for counsel.
- FD-6 · Subject vocabulary alignment across materials (free text),
  hours (enum), and the progress taxonomy: recommend surfacing the
  progress subjects as suggestions while keeping free text.
