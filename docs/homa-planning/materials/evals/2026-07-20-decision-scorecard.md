# Materials-studio decision scorecard, 2026-07-20

Decision-harness run: real model, real skill package, stubbed tools.
Grades the decisions (format, recipe reads, anchor, theme, thrash),
not rendered image quality; the admin bench owns that.

## activity-pack-space-theme

Request: "Can you make Leo one of those activity packs with a few different little activities on one page? He is completely obsessed with outer space right now."

- PASS  reads references/recipes/activity-pack.md: read before building
- FAIL  rides anchor activity-pack: anchors used: [none]
- PASS  material includes "space": present in built material
- PASS  material avoids "bug": absent as required
- PASS  material avoids "insect": absent as required
- FAIL  builds without thrash (1-2 creates): create_printable called 4 time(s)

Files read: references/recipes/activity-pack.md
Anchors: none
Builds: 4

<details><summary>Image prompts</summary>

> black and white coloring book line art, thick clean outlines, no shading, no gray fill, white background, a single simple five-pointed star, centered, no text or letters in the image
> black and white coloring book line art, thick clean outlines, no shading, no gray fill, white background, a single friendly cartoon rocket ship with a rounded nose cone and two small fins, pointed upward, centered, no text or letters in the image
> black and white coloring book line art, thick clean outlines, no shading, no gray fill, white background, a single large blank round planet with one simple ring around it, empty surface with no craters or texture so a child can draw on it, centered, no text or letters in the image

</details>

<details><summary>Final reply to parent</summary>

> The quality check passed clean, so this version stands (id 00000000-0000-4000-8000-000000000004).
> 
> What I built: a one-page, four-quadrant space activity pack for Leo, hybrid path (single generated line-art icon reused across quadrants for stars, a rocket, and a blank planet, per the "generate once, repeat yourself" rule, plus HTML for structure and text). The quadrants are: count-the-stars (rows of 6, 9, 12, since the map shows Leo comfortably counting to 15, so I pushed just past his usual 10-ish ceiling instead of the generic age-5 default), trace MOON/STAR in uppercase (matching that he already recognizes most uppercase letters), a yes/no space-facts quiz, and a blank planet for him to draw his own alien. I added a small answer key under the counting and yes/no quadrants per house rule

</details>

## pemdas-foldable-anchor

Request: "Maya keeps mixing up the order of operations. Could you make her one of those fold-up reference charts for PEMDAS?"

- PASS  reads references/recipes/foldable.md: read before building
- FAIL  rides anchor order-of-operations-chart: anchors used: [foldable]
- PASS  material includes "order of operations": present in built material
- PASS  builds without thrash (1-2 creates): create_printable called 1 time(s)

Files read: references/subjects/math-operations.md, references/recipes/foldable.md
Anchors: foldable
Builds: 1

<details><summary>Image prompts</summary>

> soft watercolor children's book illustration style but with a clean thick outline like a sticker, a single friendly brown and white pinto horse mascot rearing playfully with its mane flowing, small and cute, centered, plain white background, no text, no letters, no shading beyond simple accent color, meant as a small icon for a notebook page
> soft watercolor children's book illustration style with a clean thick outline like a sticker, a single friendly brown and white pinto horse mascot rearing playfully with its mane flowing, small and cute, centered, plain white background, no text, no letters, no shading beyond simple accent color, meant as a small icon for a notebook foldable page

</details>

<details><summary>Final reply to parent</summary>

> Built and passed quality check: a tri-fold PEMDAS foldable for Maya, sized as a fold-and-glue notebook insert with a cover panel (color-coded letters, mnemonic, a small horse mascot), a reference panel spelling out each step, and an embedded practice panel with six multi-step problems plus a horse-themed challenge problem and an upside-down answer key.
> 
> Difficulty: I aimed at multi-step expressions mixing two-digit multiplication with addition, subtraction, and division, since the map shows Maya multiplying two-digit numbers and just starting multi-step expressions, so PEMDAS itself is her working edge rather than something below it. Path: hybrid, per the recipe, since the foldable's fold lines, glue tab, and color-coded text need HTML precision while one small watercolor horse icon (match

</details>

## essay-outline-restrained

Request: "Jack has to write a five paragraph essay for co-op and he has no idea how to start. Can you make him something to plan it out on?"

- PASS  reads references/recipes/structured-outline.md: read before building
- PASS  reads references/subjects/essay-writing.md: read before building
- FAIL  rides anchor five-paragraph-essay-outline: anchors used: [none]
- PASS  builds without thrash (1-2 creates): create_printable called 1 time(s)

Files read: references/subjects/essay-writing.md, references/recipes/structured-outline.md
Anchors: none
Builds: 1

<details><summary>Image prompts</summary>


</details>

<details><summary>Final reply to parent</summary>

> Built Jack a five-paragraph essay planner as a clean, text-only structured outline: Introduction, three Body Paragraphs, and a Conclusion, each broken into labeled sub-fields (hook, thesis, topic sentence, two pieces of evidence, explanation, closing thought) with blank lines to fill in before drafting. It passed the quality check on the first pass.
> 
> Difficulty: since the map shows Jack already writes solid paragraphs but struggles organizing longer pieces, I skipped the basic 2-evidence-slot version and went with the more rigorous 3-evidence-slot variant per paragraph, since his gap is structural, not sentence-level; the whole page is really targeted at that organizing skill. Path: straight HTML per the structured-outline recipe, since precision, table alignment, and stark no-decoration s

</details>

## counting-dinosaurs-evidence

Request: "Finn loves counting dinosaurs, can you make him a worksheet for that?"

- PASS  reads references/subjects/counting.md: read before building
- PASS  material includes "dinosaur": present in built material
- FAIL  builds without thrash (1-2 creates): create_printable called 14 time(s)

Files read: references/subjects/counting.md
Anchors: none
Builds: 14

<details><summary>Image prompts</summary>

> soft colorful children's book illustration style, thick clean outlines, a single friendly cheerful green cartoon dinosaur (long-neck sauropod type) standing on all four legs, simple flat color, no shading gradients, centered, isolated on a plain white background, no text or letters, no ground line, no shadow

</details>

<details><summary>Final reply to parent</summary>

> 

</details>

## cut-and-paste-phonics

Request: "Nora's speech therapist wants her practicing short a words. Something hands on please, she cannot just fill in blanks."

- PASS  reads references/recipes/cut-and-paste-word-work.md: read before building
- PASS  reads references/subjects/cvc-phonics.md: read before building
- FAIL  rides anchor cut-and-paste-word-work: anchors used: [none]
- PASS  builds without thrash (1-2 creates): create_printable called 1 time(s)

Files read: references/subjects/cvc-phonics.md, references/recipes/cut-and-paste-word-work.md
Anchors: none
Builds: 1

<details><summary>Image prompts</summary>


</details>

<details><summary>Final reply to parent</summary>

> Built Nora a cut-and-paste short-a word work page: 8 words (cat, hat, map, cap, bat, mat, sad, tap), each with the model word, the short-a letter highlighted, a write-on line, then a matching cut-out tile strip at the bottom, plus a "try this together" sorting and storytelling extension tied to her cat interest. Quality check passed with no issues, so no revision was needed.
> 
> Difficulty: short a CVC words at a straightforward level, since the map shows Nora knows all letter sounds and is blending CVC words with support, i.e. she's ready for the words but still benefits from the model word staying visible while she writes rather than producing from memory. Creation path: html, per the cut-and-paste-word-work recipe, since the speech therapist's "hands-on, not fill-in-blank" request called f

</details>

## montessori-approach-read

Request: "We do Montessori at home. Can you make Josie a set of those three part cards for ocean animals?"

- PASS  reads references/recipes/nomenclature-cards.md: read before building
- PASS  reads references/approaches/montessori.md: read before building
- PASS  material includes "ocean": present in built material
- PASS  builds without thrash (1-2 creates): create_printable called 2 time(s)

Files read: references/recipes/nomenclature-cards.md, references/approaches/montessori.md
Anchors: none
Builds: 2

<details><summary>Image prompts</summary>

> Realistic detailed nature illustration style, soft natural colors, a bottlenose dolphin swimming shown in full side profile, centered alone on a plain white background, naturalistic proportions and shading, no text, no letters, no watermark
> Realistic detailed nature illustration style, soft natural colors, a green sea turtle swimming shown from above and slightly to the side, centered alone on a plain white background, naturalistic proportions and shading, no text, no letters, no watermark
> Realistic detailed nature illustration style, soft natural colors, an octopus with curling tentacles shown from above, centered alone on a plain white background, naturalistic proportions and shading, no text, no letters, no watermark
> Realistic detailed nature illustration style, soft natural colors, a five armed orange starfish shown from above, centered alone on a plain white background, naturalistic proportions and shading, no text, no letters, no watermark
> Realistic detailed nature illustration style, soft natural colors, a yellow and orange seahorse with a curled tail shown in side profile, centered alone on a plain white background, naturalistic proportions and shading, no text, no letters, no watermark

</details>

<details><summary>Final reply to parent</summary>

> The quality check passed with no issues. I built Josie a three-part Montessori nomenclature card set for five ocean animals (dolphin, sea turtle, octopus, starfish, seahorse): control cards with image and label (red dashed border), picture-only cards (blue dashed border), and label-only cards (blue dashed border), across a 3-page printable so all three grids stay separated for cutting.
> 
> Difficulty note: Josie is 4 and already matches picture cards independently, so plain matching would be below her; three-part cards (naming, recognition, and recall via the Three-Period Lesson) sit right at her working edge and match what she asked for directly. I used the hybrid path per the recipe: generate_image for realistic (non-cartoon) single-animal images on white backgrounds, reused across the cont

</details>

## no-evidence-asks-first

Request: "Can you make Theo a math worksheet?"

- FAIL  asks one calibrating question instead of building: built 1 time(s); text: Built Theo a one-page addition and subtraction practice worksheet (facts to 20), with an open-response answer box for each problem, a short 

Files read: none
Anchors: none
Builds: 1

<details><summary>Image prompts</summary>


</details>

<details><summary>Final reply to parent</summary>

> Built Theo a one-page addition and subtraction practice worksheet (facts to 20), with an open-response answer box for each problem, a short word problem, a challenge extension, a "try this together" counting activity, and an upside-down answer key at the bottom. It passed quality check with no issues.
> 
> Difficulty: no map evidence or interests were on file for Theo, so I assumed a mid-range 7-year-old level (addition and subtraction within 20, no regrouping) based on the age-7 density table rather than any specific data point; that's a guess, not a reading, and I'd adjust up or down fast on feedback. I built it on the html path since it's a text-dense, exact-number math page where clean layout and cheap surgical revisions matter more than illustrated art.

</details>

## theme-correction-follow-up

- ERROR  harness run failed: messages: text content blocks must be non-empty

---

Totals: 19 checks passed, 8 failed.
