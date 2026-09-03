# Coloring page: landing note

Build-session checklist for landing `coloring-page.md` and
`coloring-page.variants.md`. Not a runtime reference: nothing here loads
into Homa's context.

## Before landing

- Register the anchor: `anchor-sources/coloring-page.jpg`, a REGISTRY
  entry in `apps/web/lib/materials/anchors.ts`, rerun
  build-material-anchors, add the id to `anchors.test.ts`, so
  `pnpm check:fleet-skills` resolves the `anchorIds` mention.
- Keep the slug `coloring-page.variants` in the SKILL.md row below, or the
  same check fails with an orphan-reference error.
- Point the `coloring-page` entry in `apps/web/agent/activity-formats.md`
  at this recipe. Keep its slug and image-direct line in sync, and set its
  Ages line to: "2-10 by default (object page at 2-3, scene page at 4-10);
  pattern-fill page for 11+, or 8-10 when the parent explicitly asks for
  intricate detail." That entry is the format registry; the recipe is the
  procedure, and the recipe now carries a band the old "2-10" line did not.
- Routing fixtures: positive "a beach scene with a big B in the sand";
  adversarial-negative "a giant B and b to paint and glue cereal on"
  (giant-letter-art-page).
- Sibling pointer to fix in the same change: the staged
  `giant-letter-art-page.md` (line 60) cites "the coloring-page Hybrid
  shell rule" for its white-background strip rule. This recipe has no
  hybrid shell and bans one; giant-letter-art-page must own that rule
  itself or point at image-call-strategy.

## Format library row (SKILL.md)

| Coloring page | give one line-art picture to color and nothing else to do: no count, code, question, or task on the page; image-direct only, name line and caption composed into the art; not a letter or digit to decorate (giant-letter-art-page), not an illustration beside reading text (illustrated-teaching-page); variant rules in coloring-page.variants | coloring-page |
