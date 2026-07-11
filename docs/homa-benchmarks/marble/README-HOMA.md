# Marble skill taxonomy · provenance and license home

This is Homa's current usage and provenance note for the vendored Marble
snapshot. The data used by code lives only in `packages/taxonomy/data/`.
This folder preserves upstream licensing and provenance documents plus this
Homa-authored note.

- **Upstream:** https://github.com/withmarbleapp/os-taxonomy
- **Snapshot:** v1, pulled 2026-07-10 from upstream commit
  `96a7933754af672e1bfdbf7ecb05c325860c6e0d`; upstream `media/` was not copied
- **Data manifest:** `packages/taxonomy/data/manifest.json`
- **Integrity:** `pnpm check:taxonomy` checks the vendored checksums,
  referential integrity, complete Homa mappings, stable ids, and graph laws

The frozen upstream Markdown retains links to its original `data/`, `schema/`,
and `media/` layout. Those relative links describe the upstream repository and
do not identify local files in this folder. Use the upstream URL above for
that navigation.

## What it is

The upstream manifest records 1,590 micro-topics across 8 subjects and 54
topic-bearing domains, 3,221 prerequisite edges, 3,261 standards across 7
curricula, and 183 cluster summaries. The current Homa assembly maps that
source into a 102-domain registry: 55 Marble-derived domain records, including
one cluster-only domain, plus 47 Homa-authored domains. These two domain counts
describe different layers and are not interchangeable.

Shape: subject → domain → micro-topic, with per-topic `evidence[]`,
`assessmentPrompt` ({{name}} placeholder), `type`
(conceptual/procedural/representational/language/meta), age range, and
computed graph `centrality`.

## How Homa uses it

Marble supplies source material for the taxonomy build: domain names, the
level-3 topic corpus for ages 4 and up, prerequisite edges, clusters, and the
evidence and probe shapes. Homa owns its scoring anchors, its under-4
extension, and coverage outside Marble. The current implementation is in
`packages/taxonomy/src/`; the dated implementation plan is
`docs/homa-planning/plans/2026-07-10-skill-graph-taxonomy.md`.

Every imported topic gets a Homa id following the existing bank convention
(`<subject>.<slug>`, e.g. `math.comparing-groups`); Marble's `mt_` keys never
become Homa identifiers (founder ruling 2026-07-10). Lineage for re-syncs
lives in each topic's namespaced `refs` array (`marble:mt__h7hvT4tEb`), the
same shape as standards refs (`ccss-math:K.CC.6`).

`node packages/taxonomy/scripts/sync-upstream.mjs` is a mutating refresh
command. It clones the current upstream default branch and can rewrite the
vendored JSON. Review the upstream revision and data diff, regenerate the
frozen slug map when topics change, and run `pnpm check:taxonomy` before
accepting a refresh. The command is not a passive freshness check and does not
pin the snapshot commit for you.

## License posture (founder ruling 2026-07-10)

The repository records a 2026-07-10 founder decision to continue the private
internal import while preserving upstream notices. That decision is product
history, not legal advice. Before public use or redistribution of a derived
taxonomy, obtain a current license review. The exact current attribution and
third-party curriculum notices live in `packages/taxonomy/NOTICE.md`.

The preserved attribution line is:

> Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble) ·
> https://withmarble.com · ODbL 1.0 (database), CC BY-SA 4.0 (content).
