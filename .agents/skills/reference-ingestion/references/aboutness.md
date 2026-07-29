# Aboutness extraction

Canonical contract for dimension F. `curriculum-ingestion` uses this same file; there is no second copy.

## Why this exists

Before 2026-07-28 the engine analyzed **form** and never recorded **content**. A biography of Christopher Columbus produced a full layout, difficulty, theming, and print analysis, and nothing anywhere said the book was about Christopher Columbus. The 165-chant anthology (`ref-2026-07-21-one-potato-two-potato`) kept a superb structural analysis and none of the 165 chants.

That makes four real questions unanswerable from the corpus:

- "What do we have about insects for a three-year-old?"
- "All the books about bunnies for age three."
- "Make a happy birthday book" (is there an ingested example to work from?)
- "Anna wants to read A Wrinkle in Time" (which ingested material already covers it, and at what age?)

Form tells Homa what good looks like. Aboutness tells her what she **has**. Both ship on every drop. Founder meeting 2026-07-28, tracked as gh#366.

## The first law: present is not the same as about

A span proves a thing is **there**. It says nothing about whether the item is **about** it, and those are different failure modes:

- **Fabrication**: claiming what is not there. The span check handles this.
- **Noise**: claiming everything that is there. The span check makes this *worse*, because anything visible is easy to quote.

The scar is the Fast Forward cover: a photograph of a swan taking flight. Provable, vivid, and completely wrong to tag. If "swan" enters this book's subjects, then "books about swans for a six-year-old" returns a phonics workbook, and the parent who asked stops trusting the answer. One bad hit costs more than ten missing ones, because a search that returns junk gets abandoned.

Recurrence is not the test either, and the same book proves it. "LEVEL E" appears on exactly one page and matters; the swan appears on exactly one page and does not. Ben and Nina appear on 21 and 15 pages and the book is still not about them; they are the cast the exercises are hung on.

The test is **what part the thing plays**. Every entity and subject carries a `role`:

| role | means | searchable as content |
|---|---|---|
| `teaches` | the skill or content the item exists to teach | yes |
| `about` | the topic the content is about | yes |
| `cast` | recurring characters or names carrying the content | no, only by character search |
| `identity` | what the item IS: series, level, publisher, edition | no, only by identity search |
| `decoration` | present, carries no content | never |

The swan is `decoration`. Record it: an image model may one day want to know that this publisher put wildlife photography on a reading-program cover, and information you keep costs nothing while information you drop is gone. It simply never answers a content question.

Ask yourself the parent's question before every claim: **if someone searched for this and got this book, would that be a good result?** If the honest answer is no, the claim is not `teaches` or `about`.

## The second law: every claim carries a verbatim span

A model proposes aboutness; code verifies it. Each claim carries a `quote` (or `evidence` for interpretive claims) copied character-exact from the source text, and `verify-ingestion.py` re-checks it against the text sidecar when one exists.

- **A claim whose quote does not appear in the source is dropped, never softened.** No hedged confidence, no "probably about". Drop it.
- **If you cannot find a supporting span, the claim does not exist.** A theme you cannot point at is a vibe.
- Quotes are short (roughly 4 to 20 words), enough to locate the claim on the page.
- Never invent a quote to satisfy the schema. `extractionQuality: "unavailable"` with a `reason` is the honest answer when the text cannot be read.

This is the same models-judge-code-verifies split the journal matcher and memory guardrail incidents produced (root `AGENTS.md`, `docs/homa-planning/models-judge-code-verifies.md`). Aboutness is a language-to-structured-data capability, so it inherits the whole ruling.

## Capture the text first

Aboutness cannot be verified against text that was never kept. During step 0 capture, write the extracted text of the drop to `.cosmo/text/<id>.txt`, one file per item, page breaks marked `\n\n--- page N ---\n\n`.

- The directory is **gitignored**. Extracted text of a copyrighted book is the copyrighted work (founder ruling `inspo-originals-offrepo`, 2026-07-20, applies to text as much as to the PDF).
- Record the path as `aboutness.textSidecar` and, once uploaded, `aboutness.textBlobUrl` (same `blob-upload.sh` path as the original).
- Born-digital PDFs with a text layer: extract it, do not re-read the pages by eye.
- Scans and photos: `book-intake.py` runs a **mixture** and you should let it. Tesseract reads every page, because it is free and genuinely good at dense body text; a vision model re-reads the pages OCR cannot do honestly. Never accept an OCR limitation as a fact about the page: the first real book rendered "METRO READING / Fast Forward! / STUDENT HANDBOOK" as "MET | Pacis | RO READING | HANDBOOK", and the fix is another reader, not a smaller claim.
- The escalation set is covers (first and last page, which carry identity and are usually display type over artwork) plus any page with ink but almost no text read, plus any page whose text is garbled past use. The model also returns what the page **shows**, which is theming and aboutness evidence no character-recognition pass can produce; it lands in the intake manifest as `visual`.
- If the vision pass cannot run (no `VERCEL_OIDC_TOKEN`, expired token, gateway failure) the intake says so loudly and keeps the OCR text. Fix the token and re-run with `--force` before analysing a book whose cover was never read; do not write the title as an unsupported claim.
- If the item has no text at all (a wordless picture book, a shape-sorting card set), set `extractionQuality: "unavailable"` with the reason, and take entity and subject claims from the illustrations, quoting the title or any printed label instead.

Never commit the sidecar. Never paste the full text into the ref JSON.

## Schema

Add to the ref or cur JSON under `aboutness`:

```json
"aboutness": {
  "extractionQuality": "full",
  "textSidecar": ".cosmo/text/ref-2026-07-28-columbus-biography.txt",
  "textBlobUrl": null,
  "subjects": [
    { "name": "christopher columbus", "role": "about", "quote": "The Life of Christopher Columbus" },
    { "name": "age of exploration", "role": "about", "quote": "the great age of exploration" }
  ],
  "entities": [
    { "name": "Christopher Columbus", "kind": "person", "role": "about", "quote": "Christopher Columbus was born in Genoa" },
    { "name": "Santa Maria", "kind": "object", "role": "about", "quote": "the Santa Maria ran aground" },
    { "name": "Hispaniola", "kind": "place", "role": "about", "quote": "they landed on Hispaniola" },
    { "name": "compass rose", "kind": "object", "role": "decoration", "quote": "compass rose" }
  ],
  "themes": [
    { "name": "exploration", "evidence": "sailed west across the unknown ocean" },
    { "name": "courage and risk", "evidence": "the crew begged him to turn back" }
  ],
  "keyTerms": [
    { "term": "Mayflower", "occurrences": 7, "quote": "the Mayflower carried 102 passengers" }
  ],
  "referencedWorks": [
    { "title": "A Wrinkle in Time", "author": "Madeleine L'Engle", "kind": "book",
      "quote": "Read A Wrinkle in Time, chapters 1 through 3" }
  ]
}
```

Field rules:

| Field | Rule |
|---|---|
| `extractionQuality` | `full` (whole item read), `partial` (sampled, say what in `notes`), `unavailable` (plus `reason`) |
| `subjects` | What the item is **about**, 1 to 5 entries, lowercase, 1 to 4 words. The answer to "what would a parent search for". |
| `role` | Required on every subject and entity: `teaches`, `about`, `cast`, `identity`, `decoration`. See the first law. |
| `entities.kind` | `person`, `character`, `place`, `organization`, `animal`, `event`, `object` |
| `themes` | Interpretive, 0 to 6 entries, lowercase. Each carries `evidence`. |
| `keyTerms` | Terms that recur and would make the item findable. `occurrences` is a real count, never an estimate. |
| `referencedWorks.kind` | `book`, `poem`, `song`, `film`, `artwork`, `game`, `website`, `curriculum` |

Age does **not** live here. It stays in `difficulty.ageBand` (refs) so there is one home for it; search joins the two.

## What to extract, by drop type

- **Single worksheet or activity page:** subjects and entities, usually 1 to 3 each. A counting mat with dinosaurs is about `counting` and `dinosaurs`, and `Tyrannosaurus` is an entity if the page names it.
- **Picture book or reader:** subjects, characters as entities, themes. Every named character counts; that is how "a book with a bear in it for his birthday" gets answered.
- **Non-fiction or biography:** the subject is the person or topic, entities are people, places, and events, key terms are the vocabulary the book teaches.
- **Flash card deck:** the deck's subject plus the card set's entities, not one entry per card.
- **Curriculum:** whole-curriculum aboutness here, then per-unit aboutness inside Layer 5 (`../../curriculum-ingestion/references/lesson-decomposition.md`). The referenced-works list is the highest-value field a curriculum carries.

## Quality bar

- Prefer specific over general: `christopher columbus` beats `history`, `monarch butterfly life cycle` beats `insects`. Add the general term only when the item genuinely covers it broadly.
- Do not restate the taxonomy. `skillTargeting` already carries subject, domain, and topic ids. Aboutness is the content those skills are taught **through**.
- Do not pad. Six weak themes are worse than two supported ones, because every unsupported claim is noise in a search a parent is trusting.
- Names keep their real capitalization (`Christopher Columbus`); subjects, themes, and key terms are lowercase unless they are proper nouns.

## Verification

`python3 .cosmo/scripts/verify-ingestion.py <id>` checks the shape, the enums, and every quote against the text sidecar when it exists on disk. It reports the number of quotes it could verify: a drop whose sidecar is missing passes the shape check and says plainly that the quotes are unverifiable, so the gap stays visible instead of reading as green.

Search the result:

```
python3 .cosmo/scripts/corpus-search.py insects --age 42
```
