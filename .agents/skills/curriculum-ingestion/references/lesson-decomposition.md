# Layer 5: lesson decomposition

Canonical contract for breaking a curriculum into its units. Read `../../reference-ingestion/references/aboutness.md` first; the verbatim-quote law and the text-sidecar rule are the same here and are not restated.

## Why this exists

Layers 1 through 4 capture the curriculum's philosophy, its topic mappings, its weekly cadence, and its activity **types**, then stop at the door of the actual lessons. Everything inside is glossed: the book lists, the comprehension questions, the themes to explore, and which week teaches which topic.

The founder meeting on 2026-07-28 named the cost precisely. A language-arts curriculum today leaves Homa knowing only "there is a language-arts curriculum for that age". What she needs when a parent says "Anna wants to read A Wrinkle in Time" is: which ingested unit covers it, at what age, with which questions and themes, so she can scale it up or down. Same for "week 8 we are learning about Mars": the week-to-topic map is printed in the curriculum and thrown away at ingestion.

The founder's framing, adopted verbatim as the procedure: **ingest the whole curriculum, then go into each lesson and run the same process on it.** Tracked as gh#367. Do it now, before the six-year archive lands, because backfilling is worse than doing it once.

## The unit is the row

A "unit" is whatever the curriculum's own smallest planned teaching block is: a week, a lesson, a day, a chapter. Use the curriculum's own word for it and its own numbering. Never invent a structure the document does not have; if it truly has none, set `decompositionQuality: "unavailable"` with the reason.

Field names match the family-side library (`family_assets.parent_asset_id` + `ordinal` + `unit_label`, gh#352) on purpose, so the fleet corpus and a family's own uploaded curriculum decompose into the same shape and never drift.

## Schema

```json
"layer5_lessons": {
  "decompositionQuality": "full",
  "unitKind": "week",
  "unitsFound": 36,
  "unitsDecomposed": 36,
  "units": [
    {
      "ordinal": 8,
      "unitLabel": "Week 8",
      "topic": { "name": "mars", "quote": "Week 8: The Red Planet, Mars" },
      "referencedWorks": [
        { "title": "The Planets", "author": "Gail Gibbons", "kind": "book",
          "quote": "Read The Planets by Gail Gibbons, pages 12 to 19" }
      ],
      "questions": [
        { "text": "Why is Mars called the red planet?", "quote": "Why is Mars called the red planet?" }
      ],
      "themes": [
        { "name": "scale of the solar system", "evidence": "compare Mars to the size of Earth" }
      ],
      "activities": [
        { "description": "Build a scale model of Mars from clay",
          "quote": "Using clay, build a scale model of Mars" }
      ],
      "materials": [
        { "name": "modeling clay", "quote": "You will need: modeling clay, a ruler" }
      ],
      "homaTopicIds": ["mt_XXXXXXXXXX"],
      "ageRangeMonths": [96, 132]
    }
  ]
}
```

Field rules:

| Field | Rule |
|---|---|
| `decompositionQuality` | `full` (every unit decomposed), `partial` (a sample; say which in `notes` and set the counts honestly), `unavailable` (plus `reason`) |
| `unitKind` | The curriculum's own word: `week`, `lesson`, `day`, `chapter`, `unit` |
| `ordinal` | The curriculum's own number. Not your index. If it numbers weeks 1 to 36, `ordinal` is 8 for week 8. |
| `unitLabel` | Verbatim label from the document ("Week 8", "Lesson 12: Fractions") |
| `topic` | One short lowercase phrase plus its quote. What this unit teaches. |
| `referencedWorks` | Every book, poem, song, film, or site the unit tells the parent to use. Highest-value field in the whole layer. |
| `questions` | Comprehension or discussion questions, quoted; the quote is usually the question itself |
| `homaTopicIds` | Only ids that exist in `topics.json` at analysis time. An unmapped unit gets `[]` and a Layer 2 gap row, never a guessed id. |
| `ageRangeMonths` | Only when the unit states or clearly implies its own age. Otherwise omit and let the curriculum-level range stand. |

`unitsFound` and `unitsDecomposed` must be real counts and may differ; a partial pass that says so is honest, a `full` claim over a sample is a lie the index cannot detect later.

## Procedure

1. Find the structure: the scope and sequence, the table of contents, or the week headers. That gives `unitKind`, `unitsFound`, and the ordinal range.
2. For each unit, read its pages and fill the row. Quote every claim from those pages, not from the introduction.
3. Roll referenced works up: a title that appears in twelve units is twelve rows, and that is correct, because the query is "which unit uses this book".
4. Map to taxonomy where a real topic exists; otherwise leave `homaTopicIds` empty and record the gap in Layer 2 as usual. Never mint an id here.
5. Whole-curriculum `aboutness` (dimension F) still applies at the top level, alongside the layers.

## Budget and honesty

A 36-week curriculum is 36 rows and that is a long analysis. Two rules keep it truthful:

- **Never fabricate a unit to complete a range.** If the PDF capture stops at week 20, decompose 20, set `unitsFound` to what the document declares and `unitsDecomposed` to 20, and say so.
- **Partial is a legitimate result.** A curriculum wave of ten books does not have to be fully decomposed in one session. `partial` with real counts leaves an explicit backlog; a padded `full` leaves a corpus nobody can trust.

## Verification

`python3 .cosmo/scripts/verify-ingestion.py <cur-id>` checks the shape, the counts, the enums, and every quote against the text sidecar when it exists.

The acceptance query for this layer:

```
python3 .cosmo/scripts/corpus-search.py "wrinkle in time"
```

It should return the unit that teaches it, its questions, and its themes.
