# Marble OS Taxonomy: Opportunities for Homa

> Status: INVESTIGATION. Written 2026-07-09. Requested by Sid.
> Repo: https://github.com/withmarbleapp/os-taxonomy (ODbL 1.0 + CC BY-SA 4.0)
> License: commercial use OK; derivative databases must stay open (but produced works stay ours).

---

## What it is

An open, structured taxonomy of what children learn across the primary/elementary years:

- **1,590 micro-topics**, single teachable ideas, each with evidence criteria, assessment prompts, type classification, age ranges, centrality scores
- **3,221 prerequisite edges**, a directed acyclic graph of learning dependencies (hard/soft), 161 cross-subject
- **183 parent-friendly cluster summaries** per (subject, domain, age band)
- **818 topics aligned to formal curriculum standards** (CCSS Math, CCSS ELA, NGSS, UK National Curriculum)
- Ages 4 to 14, 8 subjects, ~55 sub-domains

The graph encodes *what must be learned before what*, with human-written reasons for every edge.

---

## 1. SUPERCHARGE THE MAP CHECKLIST

### What exists
Homa's map bank has ~225 items across 16 domains. Parent-observable statements, age-anchored, citation-backed. The scorer computes months-ahead from parent answers.

### What Marble adds
Marble has 1,590 micro-topics with *finer granularity* in the academic domains. Within Homa's scored range:

- **Math:** 503 topics across 10 sub-domains (Counting, Addition/Subtraction, Multiplication/Division, Fractions, Geometry, Measurement, Algebra, Data & Stats, Probability, Ratio). Homa's math domain has ~30ish items. Marble gives ~17x more resolution.
- **English (literacy + phonics + writing + language):** 286 topics across 9 sub-domains. Homa has ~60 combined. ~5x more resolution.
- **Science:** 547 topics across 15 fascinating sub-domains (Dinosaurs, Ocean Life, Space, Rainforests, Volcanoes, etc.). Homa has ~15 science items. ~36x more resolution.

### The opportunity
The map's four-rung-per-domain ladder (base + 2 rungs + ceiling) is honest about its resolution limits (`beyondScale` flag). Marble's depth means Homa could:

1. **Deep-dive with surgical precision.** The existing `nextDeepDiveItem` algorithm picks the next question by finding the midpoint between confirmed and not-yet anchors. With Marble's graph, the deep dive could follow the prerequisite DAG: "she got fractions, let's check if she got the specific prerequisite (equivalence? number lines?) that the next step requires." This replaces the linear age-ladder with a true *skill tree* traversal.

2. **Sharpen "growing" subjects.** When a domain shows "growing", Marble's prerequisite graph can identify the *specific missing link*. Not just "writing is growing" but "she has sentence structure but is missing paragraph organization, which depends on sentence connectors she already has." The `frontierStatement` field becomes richer.

3. **Expand the assessment vocabulary.** Every Marble topic has an `assessmentPrompt` written for parents: "If {{name}} sees a fossil of a fish in a rock on a hillside, can they explain that the area must have been underwater millions of years ago?" These are ready-made parent-observable probes that match Homa's voice.

### Implementation shape
- Import Marble topics into a `micro_topics` table or embed them directly in an expanded content bank
- Map Marble subjects/domains to Homa's 16 domain IDs
- The base checklist stays the same (fast, light, proven). Marble powers the *deep dive* and *plan targeting*
- `MAP_BANK_VERSION` bump with new items drawn from Marble, rewritten to pass content laws

### Effort: MEDIUM-HIGH. The mapping work is the bulk; the bank is extensible by design.

---

## 2. PREREQUISITE-AWARE CURRICULUM GENERATION

### What exists
- The four-week plan (`plans.ts`) is deterministic: picks 2 target skills from the scored map, generates practice patterns from templates
- The "Call Homa" curriculum (`curriculum-generate.ts`) is LLM-authored from report facts + call notes
- Both work at the domain level: "math is growing" → here are math activities

### What Marble adds
The 3,221-edge prerequisite DAG tells you *what order to teach in*. Each edge includes:
- `strength: "hard" | "soft"`, hard means "must know this first", soft means "helps"
- `reason`, human-written: "Must understand vibrations make sound before finding volume patterns"

### The opportunity

1. **Prerequisite-sequenced plans.** When the map shows a child is "growing" in fractions, Marble's DAG reveals the exact prerequisites: "Understanding fractions (age 9+)" requires "Comparing fractions" which requires "Fractions on a number line" which requires "Unit fractions" which requires "Equal sharing and halving." The four-week plan can walk *backwards* down the prerequisite chain to find the right starting line, then walk *forward* through the next 4 weeks of unlock nodes.

2. **Cross-subject connections.** Marble encodes 161 cross-subject prerequisites:
   - "Drawing Ray Diagrams (Science) requires Measuring angles (Math)", hard dependency
   - "Recommending Books (English) requires Reflecting After Learning (Learning to Learn)", soft
   - "Sorting into categories (Math) requires Asking Questions (English)", cross-subject
   
   Homa's curriculum generation could weave these: "Maya is working on fractions in math and data in science, here's a cooking/measuring project that hits both and connects them the way the concepts actually connect."

3. **Smarter "what next" after the four-week plan.** When a family finishes a four-week plan and the skill is confirmed, the DAG says exactly what unlocks next. Not a static ladder, but the actual set of topics that this mastery opens up. "Now that she has equal sharing, she's ready for: unit fractions, fractions on a number line, AND she'll find measurement easier."

### Implementation shape
- Load the dependency graph as a lookup (adjacency list or in Supabase)
- `buildFourWeekPlan` uses backward DAG traversal to find the teaching sequence
- Curriculum writer prompt gets prerequisite context: "teach X before Y because [reason]"
- The "unlocks" concept feeds the report narrative: "this work opens up [3 new areas]"

### Effort: MEDIUM. Graph traversal is pure functions; curriculum writer prompt enhancement.

---

## 3. INTEREST-AWARE TOPIC DISCOVERY

### What exists
- Child profile stores interests (e.g., "dinosaurs", "space", "cooking")
- Worksheet generation themes activities to interests
- The four-week plan uses interest-flavored practice templates

### What Marble adds
Marble's 55 sub-domains include topics organized by *theme*:
- Dinosaurs & Paleontology (29 topics)
- Ocean Life (27 topics)
- Space Exploration (26 topics)
- Rainforests (25 topics)
- Volcanoes & Earthquakes (28 topics)
- Polar Regions (25 topics)
- Animals of the World (27 topics)

Each topic has prerequisite chains that connect to foundational science concepts.

### The opportunity

1. **Interest-driven learning paths.** When a child is obsessed with dinosaurs, Marble maps exactly which science concepts connect: fossils as evidence → life changed over time → natural selection basics → adaptation. And crucially, what math/reading prerequisites make those science topics accessible. This is the "connector" vision from the product brief: not just "here's a dinosaur worksheet" but "your dinosaur-obsessed kid is ready for THIS specific paleontology concept, which also practices the classification skills she's building in science."

2. **Museum/activity connections with content depth.** The product brief's discovery engine ("Maya's learning about space this week, want tickets to the Air & Space Museum?") becomes richer when Homa knows the *specific micro-topics* the child is exploring. Not just "space" but "space systems and Earth's history, specifically the moon's phases" → the planetarium show is a better fit than the general exhibit.

3. **Parent-facing cluster summaries.** Marble's 183 clusters are parent-friendly summaries like "Your child is learning the building blocks of writing, how to make complete sentences, use capital letters and punctuation marks correctly, and understand basic word types like nouns and verbs." These are ready-made for the weekly note's subject-level framing.

### Implementation shape
- Tag Marble topics by interest affinity (many-to-many: "dinosaurs" → Paleontology topics + Fossils + Geology + etc.)
- Worksheet generator and curriculum writer receive topic context: "this child loves X, and here are the specific micro-topics in X that match her current level"
- Cluster summaries feed the weekly note and report narrative

### Effort: LOW-MEDIUM. Interest tagging is a one-time mapping; cluster summaries are copy-paste ready.

---

## 4. CURRICULUM STANDARD COMPLIANCE

### What exists
- Homa's benchmark corpus cites CCSS, NGSS, etc. by source key
- State requirements data covers all 50 states
- Map items have optional `standards` fields (e.g., "CCSS K.OA.A.4")
- The weekly note and report use evidence-based framing

### What Marble adds
818 of 1,590 topics are aligned to formal standard codes across 7 curricula. Marble's `curriculum-standards.json` maps each standard with its code, description, and curriculum source.

### The opportunity

1. **State compliance mapping.** When a family selects their state, Homa already tracks hours. Marble's standards alignment could tell the parent: "This week's work covers CCSS K.OA.2 (addition word problems) and NGSS 3-LS4-1 (fossils as evidence)." Not as a compliance burden, as proof. "Here's what standards organizations say your child should know by this age, and here's evidence she knows it." This is the "test for the mother" vision: **validating the homeschooling journey against real standards without standardized-testing the child.**

2. **Portfolio evidence generation.** Many states require portfolio reviews or narrative assessments. When Homa knows which standards each activity covers, it can auto-generate evidence statements: "On [date], [child] demonstrated understanding of [standard description] through [activity]. Evidence: [parent's observation]." This is the killer compliance feature.

3. **Curriculum crosswalk.** When a family uses Charlotte Mason or Classical, Marble's standards alignment shows how their chosen approach maps to state requirements. "Your Charlotte Mason nature study covers these 12 NGSS standards." The family extras schema already captures homeschool style, this closes the loop.

4. **The report becomes standards-backed.** Instead of just "Maya is 6 months ahead in math," the report could surface: "Maya has demonstrated skills aligned to end-of-first-grade standards (CCSS 1.OA, 1.NBT), which are typically expected 12 months from now." Standards citations make the "test for the mother" dramatically more credible.

### Implementation shape
- Import `curriculum-standards.json` → link to Homa's existing `standards` fields on bank items
- Build a per-state standards coverage view (which standards does this child's work cover?)
- Portfolio evidence generator: turns map answers + completed activities into standards-aligned evidence
- Report narrative receives standards context for framing

### Effort: MEDIUM. Standards import is straightforward; portfolio generation is the big feature.

---

## 5. SMARTER AGENT (EVE) WITH DOMAIN KNOWLEDGE

### What exists
- Eve has `instructions.md` + dynamic skills from `skill_bank`
- Post-turn learning review (M2-13) planned but not built
- Family context loaded per turn: children, memories, profile

### What Marble adds
Structured domain knowledge that the agent currently lacks entirely. Eve knows "this child is working on math" but doesn't know *what math means at this age* or *what comes after addition*.

### The opportunity

1. **Domain-aware conversation.** When a parent asks "what should we work on in math?", Eve currently relies on the map's coarse domain scores and generic instructions. With Marble's graph loaded as context, Eve can say: "She's solid on addition and subtraction, and the natural next step is multiplication, specifically, understanding that multiplication means equal groups. Here's what that looks like in practice: [Marble's assessment prompt]. Once she has that, it unlocks arrays, area, and eventually fractions." This is transformatively better than "her math is on track."

2. **Observational prompt generation.** Marble's assessment prompts are natural-language checks: "If {{name}} has 4 toy cars and a friend brings 3 more, do they understand that adding means combining both groups?" These are *exactly* the kind of prompts Homa's drip questionnaire asks. Marble gives 1,590 of them, professionally written, ready to inject into the profile-building flow.

3. **Skills bank enrichment.** The `skill_bank` table holds fleet-wide skills Eve can teach families. Marble's topics could auto-generate targeted skill bank entries: "Teaching Fractions on a Number Line" with specific activities, tied to prerequisites and evidence criteria. At scale, this turns Marble into a skill-generation engine.

4. **Smarter worksheet targeting.** `create_worksheet` currently takes a skill string and a theme. With Marble, the worksheet generator receives: the specific micro-topic, its evidence criteria (what the child should demonstrate), the prerequisite topics (what they already know), and the assessment prompt (how to check). Worksheets go from "math about dinosaurs" to "counting and grouping fossils by type, checking if she can sort into categories and count each group, the specific prerequisite for addition."

### Implementation shape
- Build a Marble context retriever: given a child's age + domain scores, retrieve relevant micro-topics as agent context
- Inject into `family-context.ts` per-turn loader (budget-controlled, like memories)
- Assessment prompts feed the drip questionnaire and deep-dive question selection
- Skill bank generation: script that converts Marble topics → skill bank rows

### Effort: MEDIUM-HIGH. Context injection is the core; skill generation is a separate pipeline.

---

## 6. THE LEARNING VELOCITY ENGINE

### What exists
- Map scoring computes months-ahead at a point in time
- Staleness detection (`staleness.ts`) knows when a child has grown past their last assessment
- Weekly notes show efficacy before/after ("reading is up since the letter-sounds set")

### What Marble adds
- **Centrality scores** (0.003 to 0.544), how central each topic is to the subject's dependency graph
- **Hard vs soft dependencies**, which prerequisites are gating vs helpful
- **The full topology**, which topics are "hub" nodes that unlock many others

### The opportunity

1. **Strategic learning prioritization.** Not all topics are equal. Marble's centrality scores identify "hub" topics that unlock the most downstream learning. "Building sentences" (centrality 0.257) unlocks 15 other topics. "Spaces between words" (0.003) unlocks almost nothing. When Homa picks what to work on next, it should prioritize high-centrality topics, they have the highest ROI.

2. **Growth attribution with structure.** The efficacy loop currently says "reading is up." With the prerequisite graph, it can say: "She mastered [topic], which was the bottleneck for [3 other topics]. Now these three are accessible, that's why her reading position moved." This makes the efficacy proof *mechanistic*, not just correlational.

3. **Velocity tracking over the graph.** Instead of just months-ahead (a single number), Homa could track *topics mastered per month*, how fast the child is traversing the prerequisite graph. A child who masters 8 topics/month in math is progressing differently than one who masters 2. Over time, this gives a much richer picture than a single position score.

4. **Bottleneck detection.** When a child is stuck, the prerequisite graph reveals why. If she can't do multi-digit addition, the graph shows which prerequisites she's missing. Maybe she has addition but not place value, and place value is the gating dependency. The four-week plan targets place value specifically, instead of "more math practice."

### Implementation shape
- Centrality-weighted topic selection in plan building and deep-dive ordering
- Graph-based progress tracking: topics confirmed → positions in the graph
- Bottleneck analysis: find the lowest unconfirmed hard prerequisite on the path to the target
- Velocity metrics: topics/month as a family-facing (or founder-facing) metric

### Effort: HIGH. This is a new analytical layer. Start with centrality-weighted selection (low effort), build toward velocity tracking.

---

## 7. PARENT COMMUNICATION UPGRADE

### What exists
- Weekly notes with one gentle next step
- Report narrative written by the model from computed facts
- Cluster-level summaries ("social-emotional is on track")

### What Marble adds
- 183 parent-friendly cluster summaries
- Human-written dependency reasons ("Must understand vibrations make sound before finding volume patterns")
- Evidence criteria that describe what mastery looks like in observable terms

### The opportunity

1. **Richer weekly notes.** Instead of "science is on track," the note could say: "She's exploring ecosystems this month, she already understands what living things need and can name different habitats. The natural next step is food chains: who eats whom. Here's a five-minute game..." All of this data exists in Marble: the current mastered topics, the next prerequisite, and the parent-friendly cluster summary.

2. **"Why this activity" explanations.** When Homa generates a worksheet or suggests an activity, it can explain *why*: "This worksheet practices equal sharing because it's the foundation for fractions, and she's ready for it now that she understands halving." The dependency reasons make every recommendation intelligible and trust-building.

3. **The keepsake letter enrichment.** The report's "memory box" letter to the child could reference specific things: "You figured out that fossils are really old animals turned to stone, and that blew your mind. Next you'll learn why some animals changed and others didn't." Marble's topic descriptions are child-legible.

### Implementation shape
- Cluster summaries → report narrative prompt context
- Dependency reasons → activity justification templates
- Evidence criteria → parent-facing "what to look for" tips

### Effort: LOW. This is prompt enrichment with ready-made content.

---

## 8. THE COMPETITIVE MOAT

### Strategic significance

Marble is the first open taxonomy of this quality. But the data is available to everyone under ODbL. The moat isn't having the data, it's *what you build on it*.

**What competitors could do:** Flat lookup of topics by age. "Your 7-year-old should know these things." Checklist.

**What Homa does that nobody else can:**
1. The *observational* assessment model (parent answers, not child tests) + the prerequisite graph = know exactly where the child is without testing them
2. The efficacy loop (activities → reassess → show movement) + the graph = show *why* the movement happened
3. The profile + the graph + interests = hyper-personalized learning paths that follow the actual structure of knowledge
4. The weekly note + the graph = communicate to the parent *in terms of their child's specific journey*, not generic advice

The prerequisite graph is the structural backbone that connects Homa's existing systems (map, scoring, plans, curriculum, agent, materials) into something no flat-taxonomy product can replicate.

**ODbL share-alike note:** Improvements to the taxonomy itself must be shared back. But everything Homa builds *on top of* the taxonomy (the scoring, the agent, the plans, the efficacy loop) stays proprietary. The taxonomy is infrastructure; the product is the produced work.

---

## Priority Ranking

| # | Opportunity | Impact | Effort | Sequence |
|---|---|---|---|---|
| 1 | Prerequisite-aware plans (#2) | HIGH, transforms the four-week plan from template to precision | MEDIUM | Can start now, no schema changes |
| 2 | Deep-dive precision (#1) | HIGH, makes the map dramatically more useful | MEDIUM-HIGH | After plans, same data |
| 3 | Parent communication (#7) | HIGH, immediate quality lift with minimal code | LOW | Can start now |
| 4 | Agent domain knowledge (#5) | HIGH, transformative for chat quality | MEDIUM-HIGH | M2-13 dependency |
| 5 | Interest-driven topics (#3) | MEDIUM, enriches existing personalization | LOW-MEDIUM | Anytime |
| 6 | Standards compliance (#4) | MEDIUM, big for portfolio families, future billing feature | MEDIUM | After core map work |
| 7 | Learning velocity (#6) | MEDIUM-HIGH, but complex; start with centrality weighting | HIGH | Later milestone |
| 8 | Competitive moat (#8) | STRATEGIC, not a feature, a framing | - | Ongoing |

---

## Immediate Next Steps (if greenlit)

1. Clone the taxonomy into the repo (or reference as a git submodule)
2. Build the Marble → Homa domain mapping table (which Marble subject+domain → which Homa domain ID)
3. Start with #7 (parent communication), lowest effort, immediate quality lift
4. Build the prerequisite graph loader for #2 (plans), this is the foundation for everything else
5. Decide: do Marble topics become first-class `map/content.ts` items, or do they live in a parallel `micro_topics` layer that the deep dive and plans query?
