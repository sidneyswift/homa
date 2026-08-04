---
name: marketing-article-writer
description: Use when drafting or substantially revising a sourced Homa blog pillar that must satisfy a real parent search, hold attention, remain easy for answer engines to quote, and emit the exact MDX contract the live blog consumes. Invoked by marketing-demand-engine. Not for choosing the signal or deriving other formats (marketing-demand-engine) and not for images (marketing-illustrator).
---

# Marketing article writer

The article lane's pillar. It should make the reader feel recognized, answer
her search early, give her something useful, and leave her with more agency
than she had when she arrived. Search structure serves that experience.

## Output bar

A finished article does five things at once:

1. Answers one real query without stretching into a second thesis.
2. Moves through a coherent reader journey instead of presenting an SEO
   outline with paragraphs attached.
3. Makes every factual and product claim easy to verify and safe to quote.
4. Gives the reader a practical next step without turning the article into a
   disguised product pitch.
5. Renders correctly on the live blog, with current links and one honest CTA.

## Procedure

### 1. Establish evidence and current product truth

Read the assigned signal fully, including its `source.ref` at the `locator`.
Read `.agents/skills/homa-copy-writer/SKILL.md` and
`marketing/voice/house-style.md`.

- Trace every claim to the signal, a primary source, or a current citable
  planning fact. Do not turn a relevant source into permission for unrelated
  claims.
- For rules, laws, prices, availability, or other changing facts, use the
  current primary source and retain its URL and checked date.
- Verify every Homa capability against current repository and production
  evidence before mentioning it. Link the relevant live feature page when one
  exists.
- Verify the CTA route from the current product. `/onboarding` is the current
  default. Never inherit a destination or product state from an older article,
  draft, persona, or skill example.

Stop if the query cannot be answered from real evidence or the product claim
cannot be confirmed. A plausible sentence is not a substitute for truth.

### 2. Write the search-and-reader brief

Before drafting prose, write these items in scratch space:

- the exact primary query in the parent's words
- the intent: learn, solve, compare, or choose
- the real moment that caused her to search, including what feels hard
- the two-to-four-sentence direct answer
- the article's one thesis
- the evidence that supports it
- the next three questions she is likely to ask
- Homa's relevant capability, honest limitation, and current CTA

Do not paste this brief into the article. It is a thinking tool that prevents
keyword-shaped prose and disconnected sections.

### 3. Design the reader movement

Choose a movement that fits the query. A useful default is:

1. Recognition: open inside a specific moment she knows.
2. Relief: answer the query plainly within the first 100 words.
3. Agency: give her a small framework, decision, or action she can use.
4. Nuance: separate the main workflow from legal, state, or edge-case rules.
5. Proof: use a concrete example, comparison, or source-backed explanation.
6. Choice: explain what to look for and where Homa honestly fits.
7. Confidence: close on the life she can recognize after using the idea.

This is a reader journey, not a mandatory heading template. Every section has
one job, answers the question raised by the previous section, and creates the
reason to keep reading.

### 4. Draft the article

Draft `article.mdx` into the bundle directory.

- Write 800 to 1400 words, one idea deep.
- Earn reassurance through a specific observation. Generic comfort before the
  reader sees herself feels manufactured.
- Put a self-contained direct answer near the top. It should still make sense
  if a search or answer engine quotes it without the surrounding paragraph.
- Use natural-language H2s for the reader's real follow-up questions. Use a
  table, list, or definition only when it makes the answer easier to understand.
- Keep short paragraphs and one main idea per sentence. Name the noun again
  when a pronoun or abstraction could make the sentence ambiguous.
- Separate what the parent can record or decide from what an official rule or
  Homa can decide. Never hide an important boundary in a late disclaimer.
- Use a concrete example when the advice could otherwise stay abstract. Never
  invent a real family; mark composite examples as hypothetical.
- Introduce Homa only after the article has delivered independent value. State
  the current capability and limitation plainly, with a relevant internal link.
- End with one warm CTA to a current Homa path. Do not mention or link to a
  waitlist.

Claims rules from house style apply throughout: no unsupported statistics,
outcome guarantees, clinical framing, or causal efficacy claims.

### 5. Build for search and answer engines

- Put the primary query naturally in the title and make the description an
  answer under 160 characters.
- Use the primary phrase only where a reader would expect it. Repetition that
  sounds optimized weakens trust and readability.
- Make important passages modular: direct answer, definition, comparison,
  steps, boundary, and product fact should each stand on their own.
- Attribute changing or high-stakes facts to the primary source in the prose.
  Explicit attribution is easier for a person and an answer engine to trust.
- Link to the relevant Homa feature and to closely related internal guidance.
- Add information gain: a useful distinction, example, checklist, or decision
  rule that a generic summary would not give the reader.
- Do not add FAQs, headings, tables, or keywords only to manufacture SEO shape.

### 6. Run the cold self-edit

Read the draft once as a first-time visitor, then once aloud. Fix the draft if
any answer is no:

- Can the article's movement be described in one sentence?
- Does each section answer the question the previous section created?
- Is every sentence clear on the first read, with an explicit subject and
  logical relationship between its parts?
- Did any search phrase force wording a person would not naturally use?
- Does the reader move from recognition to relief to agency, rather than from
  heading to heading?
- Are product and compliance boundaries visible exactly where they matter?
- Would the article remain useful if every Homa paragraph were removed?

### 7. Emit the exact frontmatter contract

The blog build fails on violations, which is the point:

```yaml
---
title: "How many hours a day should homeschool actually take?"
description: "Under 160 characters, written like an answer, it becomes the meta description."
date: 2026-07-08
tags: [hours, getting-started]
hero: /blog/how-many-hours-homeschool/hero.png
---
```

The filename and slug are the kebab-case core question. The hero path follows
`/blog/<slug>/hero.png`; `marketing-illustrator` renders it later.

## Gate contract

The orchestrator owns dispatch, but an article is not gated merely because two
agents ran:

1. A fresh blog-reader reacts once in reading order.
2. The main agent rewrites every accepted comprehension finding.
3. A fresh editor reviews the rewritten article and every must-fix is resolved.
4. A second fresh blog-reader cold-reads the post-editor article. If attention
   dies or meaning becomes unclear, revise and rerun the editor on changed copy.

The article exits with no unresolved reader confusion or attention loss and
zero editor must-fixes. Record the completed sequence in `meta.yml`.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish (the article stages in the bundle; the distributor moves it
to `apps/web` only after human approval). No source, no claim. No family data.
Voice per `marketing/voice/house-style.md`.
