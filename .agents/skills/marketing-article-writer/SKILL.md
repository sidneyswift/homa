---
name: marketing-article-writer
description: Draft the SEO pillar article for a bundle from one signal, search-intent-first, 800 to 1400 words, emitting the exact MDX frontmatter contract the blog routes consume (title, description, date, tags, hero). Invoked by marketing-demand-engine. NOT for picking the signal or deriving social/email formats (marketing-demand-engine orchestrates both) and NOT for images (marketing-illustrator).
---

# Marketing article writer

The article lane's pillar. Written once, deep, from one signal; everything
else in the bundle derives from it after it survives the gates.

## Procedure

1. Read the assigned signal file fully, including its `source.ref` at the
   `locator` (the verbatim evidence). Read `marketing/voice/house-style.md`.
2. Name the search. Write down, literally, the query a mom types that this
   article answers ("how many hours a day should homeschool take"). The title
   answers that query in her words; the first paragraph confirms she is in the
   right place and that she is doing fine (reassure before inform).
3. Draft `article.mdx` into the bundle directory:
   - 800 to 1400 words, one idea deep, no second thesis.
   - Headers she can skim; short paragraphs; a place to breathe every screen.
   - Every claim traces to the signal's source or to a citable planning-doc
     fact. No statistics that lack a source. No invented anecdotes about real
     families; composite examples are marked as such in the prose ("a mom of
     three might...").
   - Claims rules from house-style apply hard here: temporal never causal on
     efficacy, no outcome guarantees, no clinical words.
   - End with the waitlist CTA: one warm offer pointing at /waitlist.
4. Frontmatter, exactly this contract (the blog build fails on violations,
   which is the point):

```yaml
---
title: "How many hours a day should homeschool actually take?"
description: "Under 160 characters, written like an answer, it becomes the meta description."
date: 2026-07-08
tags: [hours, getting-started]
hero: /blog/how-many-hours-homeschool/hero.png
---
```

   The filename (and slug) is the kebab-case of the title's core question. The
   hero path follows `/blog/<slug>/hero.png`; `marketing-illustrator` renders
   it later.

## What happens after

The orchestrator runs the gates (blog-reader persona, then editor), and the
main agent rewrites from the notes. Expect the hook and the first 100 words to
change; that is the gates working.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish (the article stages in the bundle; the distributor moves it
to `apps/web` only after human approval). No source, no claim. No family data.
Voice per `marketing/voice/house-style.md`.
