# Materials-studio decision scorecard, 2026-07-20

Decision-harness run: real model, real skill package, stubbed tools.
Grades the decisions (format, recipe reads, anchor, theme, thrash),
not rendered image quality; the admin bench owns that.

## activity-pack-space-theme

Request: "Can you make Leo one of those activity packs with a few different little activities on one page? He is completely obsessed with outer space right now."

- PASS  reads references/recipes/activity-pack.md: read before building
- PASS  rides anchor activity-pack: anchor passed to generate_image
- PASS  material includes "space": present in built material
- PASS  material avoids "bug": absent as required
- PASS  material avoids "insect": absent as required
- PASS  builds without thrash (1-2 creates): create_printable called 1 time(s)

Files read: references/recipes/activity-pack.md
Anchors: activity-pack
Builds: 1

<details><summary>Image prompts</summary>

> cartoon illustration style, thick clean outlines, flat bright colors, a single friendly cartoon rocket ship, red and white body with orange flame, no astronaut, no stars, no planets, no text or letters, centered, white background, simple children's illustration

</details>

<details><summary>Final reply to parent</summary>

> Built and passed quality check. I made Leo (age 5) a one-page, four-quadrant space activity pack: count-the-rockets (rows up to 13, since he counts to 15 comfortably, so it's a light stretch rather than a repeat of easy 1-10 work), an uppercase-to-lowercase letter match spelling ROCKET (a step past his "recognizes most uppercase letters" edge, since matching to lowercase is the harder skill), a free-draw "window view" creative prompt, and a read-aloud true/false space-facts quiz. I went hybrid: one reusable rocket image (single object, no text, repeated in HTML per the counting-quadrant rule) plus HTML for everything else, since the page needed exact quadrant geometry, a matching-line layout, and small write-in boxes that the image model can't render reliably. Difficulty was set from the m

</details>

---

Deterministic checks: 6 passed, 0 failed.
