# Sequence-to-taxonomy crosswalks

The join between publisher curriculum structure (`../<id>.yaml`) and
Homa's skill graph (`packages/taxonomy/`, the subject-domain-topic
graph). This is wave 3 item 3 in `../../backlog.md`: once a curriculum's
chapters map to taxonomy topic ids, a family's "we finished 2A" resolves
to skill states on Homa's own map, and generated materials can target
the exact topics a chapter teaches.

## Schema

One YAML file per curriculum and grade band, named
`<profile-id>-<band>.yaml`:

```yaml
id: dimensions-math
band: grade2
taxonomy_snapshot: packages/taxonomy/data/topics.json, 1590 topics, read 2026-07-13
method: manual seed, chapter to topic, confidence labeled
status: seed        # seed | reviewed | verified
mappings:
  - level: "2A"
    chapter: 1
    chapter_title: Numbers to 1,000
    topics:
      - id: mt_98c2qwEF7Q
        name: Place Value to 1000     # copied from taxonomy for human review
        confidence: high              # high | medium
notes: ...
```

Rules:

- Topic `name` is denormalized from the taxonomy purely so a human can
  review the file without a lookup; the `id` is the contract. If names
  drift from ids, the id wins and the file needs a refresh.
- `confidence: high` means the chapter's lessons squarely teach the
  topic; `medium` means partial overlap or an age-band mismatch worth a
  reviewer's eye. Nothing lower gets written; if it is a guess, leave
  it out and note the gap.
- A crosswalk at `status: seed` is agent-proposed and NOT product-ready.
  Promotion to `reviewed` requires a human pass; `verified` requires
  checking against the actual materials. Nothing in the product consumes
  seeds.
- These files live in docs and do not touch `packages/taxonomy/`;
  `pnpm check:taxonomy` is unaffected.

## Coverage

| File | Status |
|---|---|
| `dimensions-math-grade2.yaml` | seed (both semesters, 15 chapters, 43 topic mappings, ids and names machine-verified against the taxonomy snapshot) |

## Observed method notes

Age-band mismatches are findings, not errors: Dimensions Math grade 2
teaches weight and capacity units that the taxonomy places at ages 8-9,
which matches the atlas's documented ahead-lean for the program. Record
these as `confidence: medium` with a note rather than forcing or
dropping them.
