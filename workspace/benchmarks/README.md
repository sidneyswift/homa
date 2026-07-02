# Benchmarks Library

> 🤖 MAINTAINED BY HOMA — refreshed by the nightly research cron (see the `homa-track-story-coach` skill).

Each domain file is a citation-backed, **PreK–12** developmental reference Homa uses to score a child's
current position and set targets. Sources rotate by domain (CDC/Head Start + Common Core, NGSS, NCSS C3,
National Core Arts, SHAPE America, CASEL, ACTFL, ASHA, etc. — see each file). The template ships these
pre-seeded; the nightly cron keeps them current per install.

## Files

- `math.md` — number sense → operations, fractions, ratios, algebra, functions, geometry, statistics
- `literacy.md` — pre-reading, phonics, fluency, vocabulary, comprehension, literary/informational analysis, research
- `phonics.md` — phonemic awareness, decoding, syllables, morphology, etymology
- `writing-fine-motor.md` — handwriting & keyboarding, plus composition (grammar → genres → research writing)
- `spanish.md` — world/second-language proficiency (ACTFL 5 C's, interpretive/interpersonal/presentational)
- `science.md` — physical, life, earth/space, engineering, practices & crosscutting concepts (NGSS)
- `social-studies.md` — history, geography, civics, economics & personal finance (C3)
- `art-creative.md` — creating, presenting, responding, connecting (National Core Arts)
- `gross-motor.md` — fundamental movement → sport skills → fitness & lifelong activity
- `fine-motor-general.md` — manipulation & tool use → handwriting/keyboarding → specialized tools
- `social-emotional.md` — the five CASEL competencies across all bands
- `self-care-independence.md` — self-care → life skills → adolescent independence
- `executive-function.md` — core EFs → planning, organization, study skills, metacognition
- `language-oral-english.md` — vocabulary, grammar, narrative → discussion, presentation, argumentation
- `music.md` — creating, performing, responding, connecting (National Core Arts / NAfME)

## Conventions

Each file has these sections:
1. **Frameworks used** — which standards/research the benchmarks draw from
2. **Age-band milestones** — banded PreK (3–5), Lower Elementary (K–2), Upper Elementary (3–5), Middle (6–8), High (9–12)
3. **Child-specific notes** — per-child scoring, written once a child is onboarded (blank in the template)
4. **Recent research** — links to anything Homa learned this pass
5. **Sources** — cited references
6. **Last researched** — date the cron last touched this file

When the cron updates a file, it logs the change in `research-journal.md`.

## Targets

Targets are set per child through the `homa-track-story-coach` skill against the age-band a child falls
into — the parent chooses the philosophy (at-age, or a stretch target) during onboarding. Invest across
all 15 domains rather than over-specializing.
