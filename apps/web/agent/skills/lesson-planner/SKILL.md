---
description: Use when a parent asks for a weekly plan, a lesson planner, "plan my week," "what should we do this week," a daily schedule, or when curriculum-studio finishes building a week and needs the orchestration layer generated. This skill produces the three artifacts that turn a stack of worksheets into a curriculum SYSTEM — the weekly planner, daily instruction guides, and cross-curricular center cards. It is the connective tissue between curriculum-studio (what to teach over many weeks) and materials-studio (individual printable pages).
metadata:
  homa-related-skills: curriculum-studio, materials-studio
---

# Lesson Planner

You are building the part of Homa that homeschool parents need most and
have never had from a digital tool: the orchestration layer. Not more
worksheets — the PLAN that tells them what to do each day, in what order,
with what materials, and why.

Published curricula like Harcourt Trophies, Abeka, and The Good and the
Beautiful all ship with this layer. Homeschool parents who piece together
their own curriculum don't have it. They spend Sunday night planning
Monday's lessons. Homa eliminates that.

## What this skill produces

Three printable artifacts per week:

### 1. Weekly Lesson Planner (the "week-at-a-glance")

A single printable page (landscape, html path) showing the entire week in
one view:

- 5 day columns (Mon through Fri), color-coded
- Skill strand rows: every subject the child is working on this week
- Each cell: activity name + brief description (1-2 lines)
- Top header: unit topic or anchor text/story for the week, focus skills
- Footer: consolidated materials list for the entire week
- Tested-skill markers: bold T on any activity tied to an assessment

Design pattern: the Trophies "Suggested Lesson Planner" spread. The parent
tapes this to the fridge or clips it into her planner binder. One glance
answers "what do we do today?"

**Critical layout rules (learned from comparing with Trophies originals):**

- **Vertical day columns, not a compact grid.** Each day is a TALL column
  running the full page height. Do NOT compress into tiny grid cells.
  Each activity gets 4-6 lines of space — enough for the activity name,
  specific details (story titles, word lists, prompts), and page/resource
  references.
- **Hierarchical skill strand sidebar.** The left sidebar groups strands
  under parent categories with colored badge bars: ORAL LANGUAGE, WORD
  WORK (containing Phonics, Spelling, Vocabulary, High-Frequency Words),
  READING (containing Comprehension, Fluency), Daily Routines, LANGUAGE
  ARTS (containing Writing, Grammar). These are hierarchical, not flat.
- **Horizontal rules, not cell borders.** Thin horizontal lines separate
  skill strands within each day column. No box borders on individual
  cells. The day columns are separated by color-coded top headers but
  the interior is clean white space with rules. This is what makes it
  scannable — borders create visual noise, rules create flow.
- **"Focus of the Week" callout box** at the top — a separate box showing
  the week's focus skill, phonics target, high-frequency words, and
  writing focus. Not buried in a header.
- **Actual content in cells, not summaries.** Show the REAL writing prompt
  ("Have children write about their favorite topics to read about"), the
  REAL vocabulary words ("dull, exciting, handsome, hardly, sideways,
  sparkling, spotted"), the REAL Daily Language Practice sentences with
  both the error version and the corrected version. Specificity = the
  parent doesn't have to think.
- **Bold T markers for tested skills** — visually prominent, not tiny.
  Every skill that leads to the end-of-week assessment gets a T.
- **2-page spread for 5 days.** Days 1-2 on the left page, Days 3-5 on
  the right page (or all 5 in a landscape orientation with enough room).
  The key insight: the Trophies planner uses TWO full pages. Our single
  landscape page was too compressed. When generating, prefer either a
  2-page portrait spread or a generously-spaced landscape page.

The arc across the week must be intentional, not random:
- **Day 1:** Introduce — new concepts, pre-assessments, read-alouds, hook
- **Day 2:** Practice — guided practice, first contact with new skills
- **Day 3:** Deepen — generalize patterns, connect to other knowledge
- **Day 4:** Apply — independent practice, cross-curricular projects
- **Day 5:** Assess + Celebrate — post-tests, self-selected work, review

This arc is the default. Mastery-paced curricula (phonics programs that
can't skip ahead) may compress or extend. Charlotte Mason families may
rotate subjects across days instead of doing all subjects daily. Adapt the
arc to the family's method, but always have an arc — never random daily
activities.

### 2. Daily Instruction Guides (optional, parent can request)

One page per day (portrait, html path) with:

- Day number and color header (matching the planner column color)
- Ordered skill blocks: what to teach first, second, third
- Per block: 2-3 teaching steps in parent-friendly language (not teacher
  jargon — "Read the story aloud, then ask: what was the chameleon's
  problem?" not "Facilitate a guided reading session targeting main idea")
- Differentiation sidebar: if the child breezes through → what to do next;
  if the child struggles → what to simplify
- Materials callout: what to have ready for this day specifically
- Estimated times per block (parents need to know if this is a 15-min or
  45-min activity)

Design pattern: the Trophies daily detail pages, but translated from
teacher-speak into parent-speak. No page number references to textbooks the
family doesn't own. Everything self-contained.

### 2b. Alternative Teaching Strategies (in every daily guide)

Every skill block in a daily instruction guide MUST include an "If this
doesn't click" sidebar with 1-2 alternative modality approaches for the
same skill. This is the single most valuable differentiation Homa can
offer: not just easier/harder, but a fundamentally different WAY to
learn the same thing.

The four modalities and what they look like in practice:

| Modality | What it looks like |
|---|---|
| Visual | Charts, diagrams, color-coding, posters, demonstrations, illustrated worksheets |
| Auditory | Read-alouds, songs, rhymes, verbal explanation, discussion, oral repetition |
| Kinesthetic | Hands-on manipulatives, cut-and-paste, tracing, building, movement, games |
| Reading-writing | Lists, notes, labels, copy-work, journaling, structured outlines |

How to build the sidebar:

1. Identify the MAIN approach for each skill block. If the child has
   modality tendencies in their profile, the main approach should match
   their strongest modality for that subject.
2. Pick 1-2 DIFFERENT modalities for the alternative. If the main is
   kinesthetic, alternatives should be visual or auditory, not a
   different kinesthetic activity.
3. Write the alternative as a concrete, doable activity the parent can
   pivot to in the moment. Not "try a visual approach" but "print the
   number line poster and have her hop a counter along it."
4. Tag any alternative that materials-studio can build with its format
   slug: `[counting-mat]`, `[flash-cards]`, etc.

When the child has been working on a skill for multiple sessions and
it's not clicking (evidence from progress data or parent feedback),
the main approach should SWITCH to a different modality, and the
alternative sidebar should offer a third.

Example daily guide skill block with alternatives:

```
MATH: Skip counting by 5s (about 20 min)

Main approach (kinesthetic):
1. Line up 25 beans in groups of 5 on the table
2. Touch each group and count together: 5, 10, 15, 20, 25
3. Scramble and try again. Can she do it without help?

🔄 If this doesn't click:

  Visual: [counting-mat] Print a skip-counting-by-5 mat with
  dinosaur groups. She circles each group and writes the running
  total. The pattern on the page makes the skip visible.

  Auditory: Skip-count song! Clap on every 5: "5, 10, 15, 20,
  25!" Make it silly, speed it up, slow it down. Repeat until
  she can do it without the claps.
```

### 3. Cross-Curricular Center Cards (optional, parent can request)

Full-width horizontal bands (one per center, hybrid path) stacked
vertically on one or two portrait pages, themed around the week's anchor
topic:

**Critical layout rules (learned from Trophies originals):**

- **Horizontal bands, NOT a card grid.** Each center is a full-width
  horizontal band spanning the page. Stack them vertically. Do NOT lay
  them out as a 2×3 card grid — that was our first mistake. The Trophies
  original uses full-width bands because each center needs room for a
  description paragraph + an illustration + a materials sidebar.
- **Each center MUST have an illustration.** A photo or drawing of what
  the finished activity looks like. The Science center shows the diorama.
  The Social Studies center shows a hand-drawn zoo map. The Drama center
  shows a kid with a party blowout. Visual examples set expectations and
  make the activity feel doable. Generate these via image-direct or find
  relevant images.
- **Materials sidebar on the RIGHT.** A rounded-corner callout box
  positioned to the right of the description text, containing a bulleted
  materials list. Not at the bottom of a card — to the side.
- **Clock icon for time** in the top-right corner of each band — small,
  circular badge showing the minutes.
- **Subject icon strip** at the top of the page — 5 circular icons
  (matching each center's subject) running horizontally. Visual
  wayfinding showing which centers exist this week.
- **Color-coded header bars** — each center has a solid-color header band
  (different color per subject). The subject name is in the header.
- **School-Home Connection box** at the bottom of the page (if room) —
  the vocabulary words for the week and a parent bonding activity.

Design pattern: the Trophies Cross-Curricular Centers pages. One story
or theme powers 4-6 different subject centers. The parent can set up
centers around the house and let the child rotate through them, or do one
per day alongside the main lesson.

## When to use this skill

| Trigger | What to do |
|---|---|
| Parent says "plan my week" or "what should we do this week" | Build from child's map: identify working edge across subjects, pick an anchor theme, generate all 3 artifacts |
| Parent says "plan a week around [topic/story]" | Use the named topic as anchor, build planner + centers around it |
| curriculum-studio finishes building a week | Automatically generate the planner for that week's content |
| Parent says "I need a daily schedule" or "daily plan" | Generate the weekly planner + daily instruction guides |
| Parent asks for "centers" or "center activities" | Generate cross-curricular center cards themed to current topic |

## How to build it

### Step 1: Determine the anchor

Every good week has an anchor — the thing everything connects to. In order
of preference:

1. **A reading selection / book** — if the family is reading a book this
   week, that's the anchor. All activities connect to it. (Story-as-hub
   pattern from Trophies.)
2. **A unit study topic** — if the family is doing a thematic unit (ocean
   life, ancient Egypt, butterflies), that's the anchor. (Charlotte Mason /
   eclectic pattern from Carolyng's unit study drops.)
3. **The child's current interest** — if no book or unit, use whatever the
   child is obsessed with this week. A chameleon-obsessed kid gets
   chameleon-themed everything.
4. **The working edge** — if nothing else, anchor on the skill the child
   needs to work on most. Less thematic, more functional.

### Step 2: Map skill strands to the child

Pull from the child's map (explore_child_map) to determine:
- What subjects this child is actively working on
- Their working edge in each subject
- What they've mastered (don't include mastered skills in the planner)

Only include subjects that are relevant to this child. A 4-year-old doesn't
need a grammar row. An 8-year-old doesn't need a letter-tracing row.

### Step 3: Build the 5-day arc

For each skill strand, plan the introduce → practice → deepen → apply →
assess progression across the 5 days. Not every strand needs all 5 days —
some subjects only appear 3x/week. That's fine. The point is intentional
sequencing, not filling every cell.

Rules:
- Heavy new-concept days (Day 1-2) should have lighter total load
- Assessment day (Day 5) should feel celebratory, not punishing
- Cross-curricular centers appear 1 per day, each a different subject
- Independent reading / free choice appears every day (even 10 minutes)
- Daily routines (morning message, calendar, read-aloud) frame the day

### Step 4: Generate the planner via materials-studio

The weekly planner is an html-path printable. Call create_printable with:
- Format: landscape, letter size
- Template: 5-column grid with skill strand rows
- Color coding: each day gets a warm distinct color
- Content: activity descriptions from Step 3
- Footer: consolidated materials list (all materials needed across all days
  and centers, deduplicated)

### Step 5: Generate center cards (if requested or if theme is strong)

For each center, generate a hybrid-path card:
- Choose 4-6 subjects that connect to the anchor theme
- Each center is a 15-30 minute hands-on activity
- Materials should use things families already have (construction paper,
  crayons, glue, scissors, shoe boxes) plus the week's reading material
- Drama and art centers don't need worksheets — they need props and prompts

### Step 6: Generate daily guides (if requested)

For each day, generate an html-path instruction page:
- Use the planner as the source (this day's column becomes this page)
- Expand each cell into 2-3 teaching steps
- Add differentiation notes (easier / harder options)
- Add time estimates

### Step 7: Connect to materials-studio

For every activity in the planner that needs a printable (worksheet, flash
card, tracing page, etc.), note the materials-studio format slug:

> `[cut-and-paste] Short A CVC word work`
> `[themed-worksheet] Chameleon counting — groups of 5`

The parent can tap any tagged activity to have materials-studio generate
it. The planner is the navigation layer; materials-studio is the production
layer.

## Voice and framing

This is a parent tool, not a teacher manual. Write like you're talking to
a smart, busy mom:

- "Start your morning with a read-aloud" not "Facilitate shared reading"
- "If she breezes through this, try..." not "For advanced learners, provide
  enrichment via..."
- "You'll need: construction paper, scissors, glue, the book" not
  "Materials: see page 14M of the Teacher Edition"
- "About 15 minutes" not "Approximate instructional time: 15 minutes"

Never reference page numbers from textbooks the family doesn't own. Never
use teacher-certification jargon. Every instruction should be something a
non-teacher parent can do at home with what she has.

## What this skill does NOT do

- Generate the actual worksheets (that's materials-studio)
- Build a multi-week curriculum (that's curriculum-studio)
- Replace the parent's judgment on what her child needs (the planner is a
  suggestion, not a mandate)
- Generate lesson plans for classroom teachers with 25 students (this is
  1-on-1 or small-group homeschool)

## The product insight

Today, Homa can generate worksheets (materials-studio) and plan multi-week
curricula (curriculum-studio). But the parent still has to figure out:
- What order to do things each day
- How each day builds on the last
- What materials to gather for the week
- How to extend the core lesson into other subjects
- How to differentiate if the child is ahead or behind

This skill fills that gap. It's the difference between handing someone a
stack of recipes and handing them a meal plan with a grocery list.

Combined with the existing skills, Homa now offers:

```
curriculum-studio → lesson-planner → materials-studio
   (what to teach)    (when and how)    (the printables)
```

The three-layer system that makes published curricula feel "complete" —
and that no digital homeschool tool currently generates dynamically for
each family.

## Anti-patterns

- Generating a planner with no arc (random activities shuffled across days)
- Using teacher jargon instead of parent language
- Including subjects the child isn't working on just to fill rows
- Generating 5 days of content when the family only homeschools 4 days
- Making every day identical (same structure, same timing, no variety)
- Generating centers that require expensive or hard-to-find materials
- Producing the planner without a materials list (the parent needs to prep)
- Referencing specific textbook pages or products the family may not own
