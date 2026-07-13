# Atlas methodology

How curriculum profiles in this folder are researched, written, and kept
honest. Every profile follows this document. Deviations get noted inline in
the profile itself.

## Purpose and audience

The atlas serves two readers:

1. The founder and product agents, deciding what Homa builds, how materials
   should look, and how Homa talks about a curriculum a family already uses.
2. Future ingestion tooling, which will parse profile front matter into
   product data (curriculum metadata for onboarding, comparison, and
   materials generation).

Write for both: prose a person can read, front matter a script can parse.

## Research protocol

Source hierarchy, strongest first:

1. Publisher primary sources: official site, scope and sequence documents,
   placement tests, sample PDFs, pricing pages, FAQ pages.
2. Established independent reviewers: Cathy Duffy Reviews above all (the
   de facto industry reviewer), then well-known homeschool review sites.
3. Award records: Practical Homeschooling Reader Awards, Old Schoolhouse
   awards, homeschool.com awards, i-Learn awards.
4. Community sentiment: Reddit (r/homeschool, r/secularhomeschool,
   r/HomeschoolRecovery for the critical view), Facebook group themes as
   reported by secondary sources, long-form blog reviews from real users.
5. SEO roundup sites: prices and feature lists only, never market claims.

Rules:

- Every profile lists its sources with URLs. Claims that come from a single
  weak source get labeled as such in the text.
- Prices are dated: write "about $X as of Jul 2026" and link the price page.
  Prices drift; the link is the truth.
- Do not fabricate. If a fact cannot be verified (for example, a company's
  revenue or exact user count), either omit it or state that it is
  unverified. No invented quotes, no invented statistics.
- Community sentiment is paraphrased and attributed to its venue ("a common
  complaint in Reddit threads is...") rather than quoted at length.
- Where the repo already researched something (see the README's link list),
  reference it instead of re-deriving it.

## Copyright policy

This is load-bearing. The atlas describes curricula; it does not reproduce
them.

- Never copy worksheet content, lesson scripts, passages, or exercises into
  this repo. Not even "just one worksheet as an example."
- Topic lists and scope-and-sequence outlines (chapter titles, skill lists)
  are facts and may be summarized.
- Short attributed quotes (under 25 words) from marketing copy or reviews
  are fine.
- The way to capture "what the materials actually look like" is careful
  description plus links to the publisher's own free samples: sample PDFs,
  look-inside pages, placement tests, demo videos. Every profile has an
  "Official samples and links" section for exactly this.
- Do not commit downloaded sample PDFs or scanned pages to the repo. Link
  them.
- Building Homa's own curriculum later: pedagogy, sequencing ideas, and
  methods (bar models, three-period lessons, narration) are not owned by
  anyone. Specific expression (text, art, exercises, scripts) is. The atlas
  captures the former and points to the latter.
- Acquiring real copies (print or licensed PDF) for internal study is a
  founder purchasing decision tracked in `backlog.md`. Purchased materials
  live outside this repo.

## Style laws (repo-wide, restated because they get violated)

- No em dash, ever. Use a comma, period, colon, or parentheses.
- Sentence case headings.
- Plain names for things; one idea per sentence; no metaphor stacks.
- Dates in ISO or "Jul 2026" form.

## Front matter schema

Every profile starts with this YAML block. Enum values are defined in
`taxonomy.md`. Keep keys in this order.

```yaml
---
id: dimensions-math            # kebab-case, stable, unique across the atlas
name: Dimensions Math
publisher: Singapore Math Inc.
category: math                 # math | language-arts | science | history-geography | all-in-one | online-digital
subjects: [math]               # see taxonomy.md subject list
grade_range: "PK-8"
approach_tags: [mastery, conceptual, teacher-led]   # see taxonomy.md
religious_orientation: secular # secular | neutral | faith-based-christian | faith-based-other
religious_notes: ""            # optional free text, e.g. denomination or worldview intensity
format: [print, video]         # print | pdf | online-course | video | app | live-class | kit | audio
parent_involvement: high       # high | medium | low
mastery_or_spiral: mastery     # mastery | spiral | mixed | n/a
price_band: "$$"               # free | $ | $$ | $$$ | $$$$ (defined below)
price_notes: "about $130-190 per grade for a full set, as of Jul 2026"
homa_tier: flagship            # flagship | deep | standard | stub
status: active                 # active | legacy | discontinued
last_reviewed: 2026-07-13
official_site: https://www.singaporemath.com
sources:
  - https://example.com/source-one
  - https://example.com/source-two
---
```

Price bands, per student per year for the named scope (a subject curriculum
is banded per subject; an all-in-one is banded for the full package):

- `free`: genuinely free core (PDFs or online), paid extras allowed
- `$`: under 75 dollars
- `$$`: 75 to 200 dollars
- `$$$`: 200 to 500 dollars
- `$$$$`: over 500 dollars

## Profile sections

Defined in `profile-template.md`. Headings are fixed so profiles stay
comparable and parseable:

Snapshot, Reputation and rankings, Pedagogy and method, Structure and scope,
A lesson up close, Materials and visual design, Pricing, Why families choose
it, Why families leave it, Competitive notes for Homa, Official samples and
links, Sources.

Depth tiers set how much goes in each section (see README). A stub may stop
after Snapshot, Reputation, and links.

## Update workflow

- A profile is a dated snapshot: `last_reviewed` in front matter is the
  contract. Anyone updating a profile re-verifies volatile claims (pricing,
  product lineup, editions) and bumps the date.
- New curricula get a stub first (so the atlas knows they exist), then get
  promoted through the tiers.
- After adding or editing profiles, run `pnpm check:atlas` (validates this
  schema mechanically) and `pnpm atlas:index` (regenerates `catalog.json`,
  a generated file that is never hand-edited).
- Structured scope-and-sequence extraction follows the protocol in
  `sequences/README.md`.
- Wave planning lives in `backlog.md`.
