# Materials-studio decision scorecard, 2026-07-21

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
- FAIL  builds without thrash (1-2 creates): create_printable called 4 time(s)

Files read: references/recipes/activity-pack.md
Anchors: activity-pack, activity-pack
Builds: 4

<details><summary>Image prompts</summary>

> flat cheerful children's book illustration style, bright bold colors, thick clean outlines, a single smiling yellow star character with tiny arms and a happy face, plain white background, centered, no text or letters, no shading or gradients, simple flat vector coloring
> flat cheerful children's book illustration style, bright bold colors, thick clean outlines, four separate space objects evenly spaced in a horizontal row on a plain white background: a red and white rocket ship on the left, next a gray crescent moon with craters, next a yellow five point star, and on the right a red planet with a ring around it, each object simple and iconic and the same size, no text or letters anywhere, no overlapping objects

</details>

<details><summary>Final reply to parent</summary>

> Built Leo's Outer Space Activity Pack as a hybrid page (html structure + two generated illustrations: a repeatable star icon and a row of four space objects for the matching activity), following the activity-pack recipe with four quadrants: count-the-stars (pushed to 7 and 12, just under his comfortable ceiling of 15), match-the-word (uppercase space words to pictures, since he already knows most uppercase letters and this stretches him into word-picture matching), design-a-new-planet (open creative draw), and a yes/no space-facts quadrant. Difficulty is aimed just past his working edge from the map (counting to 15, uppercase letters) rather than generic age-5 defaults, and I chose hybrid over pure image-direct because the page mixes precise counting/matching layouts with organic space art

</details>

## pemdas-foldable-anchor

Request: "Maya keeps mixing up the order of operations. Could you make her one of those fold-up reference charts for PEMDAS?"

- PASS  reads references/recipes/foldable.md: read before building
- PASS  rides anchor order-of-operations-chart: anchor passed to generate_image
- FAIL  material includes "order of operations": missing from html and image prompts
- PASS  builds without thrash (1-2 creates): create_printable called 1 time(s)

Files read: references/recipes/foldable.md, references/subjects/math-operations.md
Anchors: order-of-operations-chart
Builds: 1

<details><summary>Image prompts</summary>

> soft watercolor children's book illustration, warm palette, a friendly brown-and-white horse mascot character, chibi-style, flowing mane, cheerful expression, standing pose, small simple icon design, no text or letters, no numbers, plain white background, centered

</details>

<details><summary>Final reply to parent</summary>

> Built and it passed quality check on the first try, no revision needed.
> 
> What I made: a three-panel fold-and-glue PEMDAS reference card for Maya, cover panel with color-coded PEMDAS letters and a small horse mascot (her interest), a reference panel explaining each step with M/D and A/S grouped as tied-priority "teams," and a practice panel with four embedded problems (including a horse-themed word problem) plus a Challenge problem and a small rotated answer key in the corner.
> 
> Difficulty: her map shows she's multiplying two-digit numbers and just starting multi-step expressions, so I aimed the practice at full expressions with parentheses, one simple exponent, and all four operations, which is the working edge rather than a review of basics. I used the html path (foldable recipe) since exa

</details>

## essay-outline-restrained

Request: "Jack has to write a five paragraph essay for co-op and he has no idea how to start. Can you make him something to plan it out on?"

- PASS  reads references/recipes/structured-outline.md: read before building
- PASS  reads references/subjects/essay-writing.md: read before building
- FAIL  rides anchor five-paragraph-essay-outline: anchors used: [none]
- PASS  builds without thrash (1-2 creates): create_printable called 2 time(s)

Files read: references/subjects/essay-writing.md, references/recipes/structured-outline.md
Anchors: none
Builds: 2

<details><summary>Image prompts</summary>


</details>

<details><summary>Final reply to parent</summary>

> Quality check passed clean, no issues. Built: a one-page, five-section essay planner (Intro, three Body Paragraphs, Conclusion) with the two-column instruction-left, blank-lines-right pattern, plus a small "read it out loud" tip aimed directly at transitions.
> 
> Why this shape: Jack's map evidence shows he already "writes solid paragraphs" but "struggles organizing longer pieces," so the gap isn't sentence-level writing help, it's structure across paragraphs, which is exactly what a fill-in outline scaffolds. I kept evidence slots at the more rigorous end (paired supporting details per paragraph, an explicit "prove your thesis" step, transition prompts between paragraphs) rather than the simpler two-slot version, since he's 12 and already strong within a paragraph. Went straight to the html 

</details>

## counting-dinosaurs-evidence

Request: "Finn loves counting dinosaurs, can you make him a worksheet for that?"

Judge: would need a round trip · score 1/5 · customization absent
- Went wrong: No worksheet HTML was ever produced or delivered to the parent, only a single generic dinosaur image prompt exists.
- Skill fix: Add a build-completion check in the counting recipe/router that blocks finishing until homaBuiltHtml contains the actual worksheet, with counting quantities calibrated to the child's evidence (push past 8-10) and multiple dinosaur images matching those quantities.

- PASS  reads references/subjects/counting.md: read before building
- PASS  material includes "dinosaur": present in built material
- FAIL  builds without thrash (1-2 creates): create_printable called 14 time(s)

Files read: references/subjects/counting.md
Anchors: none
Builds: 14

<details><summary>Image prompts</summary>

> cute cartoon illustration style, thick clean black outlines, flat cheerful colors, a single friendly green triceratops dinosaur standing in a simple happy pose, centered on a plain white background, no shading, no gradient, no text or letters, no other objects, no ground line

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

> Built a cut-and-paste short-a word work page for Nora: six CVC words (cat, hat, map, nap, bat, van), each with the model word, a trace/write line, and a dashed paste box, plus a shuffled tile strip at the bottom so she has to say and match each word rather than just paste in order. It passed the quality check clean, no revision needed.
> 
> Difficulty: set at simple, unmixed short-a CVC words because the map shows Nora knows all letter sounds and is blending CVC with support, so short-a alone (not mixed vowels) sits right at her working edge without overloading her. Creation path: html, per the skill's binding rule for this format, since the cut-and-paste structure needs exact dashed cut lines, grid alignment, and writing-line precision that an image model can't reliably hold, and it directly 

</details>

## montessori-approach-read

Request: "We do Montessori at home. Can you make Josie a set of those three part cards for ocean animals?"

Judge: would need a round trip · score 1/5 · customization absent
- Went wrong: Homa drafted image prompts but never produced the actual three-part card HTML build or any reply to the parent, so no deliverable exists.
- Skill fix: In the nomenclature-cards recipe, make the build-and-reply step mandatory immediately after image prompts so a run can't end with prompts drafted but zero HTML output or parent-facing message.

- PASS  reads references/recipes/nomenclature-cards.md: read before building
- PASS  reads references/approaches/montessori.md: read before building
- PASS  material includes "ocean": present in built material
- FAIL  builds without thrash (1-2 creates): create_printable called 0 time(s)

Files read: references/approaches/montessori.md, references/recipes/nomenclature-cards.md
Anchors: none
Builds: 0

<details><summary>Image prompts</summary>

> photorealistic, detailed nature illustration style, a bottlenose dolphin swimming, full body visible, centered, plain white background, no text or letters, no shadow, natural ocean-gray coloring
> photorealistic, detailed nature illustration style, a common octopus with visible suckers on its arms, full body visible, centered, plain white background, no text or letters, no shadow, natural reddish-brown mottled coloring
> photorealistic, detailed nature illustration style, a green sea turtle swimming with flippers extended, full body visible, centered, plain white background, no text or letters, no shadow, natural olive-green shell coloring
> photorealistic, detailed nature illustration style, a yellow seahorse with its tail curled around a small piece of coral, full body visible, centered, plain white background, no text or letters, no shadow
> photorealistic, detailed nature illustration style, an orange starfish with five arms and textured bumpy skin, viewed from above, centered, plain white background, no text or letters, no shadow

</details>

<details><summary>Final reply to parent</summary>

> 

</details>

## no-evidence-asks-first

Request: "Can you make Theo a math worksheet?"

- FAIL  asks one calibrating question instead of building: built 1 time(s); text: Built a one-page HTML math worksheet for Theo: eight vertical addition/subtraction problems (mix of single-digit and two-digit, no regroupin

Files read: references/subjects/math-operations.md
Anchors: none
Builds: 1

<details><summary>Image prompts</summary>


</details>

<details><summary>Final reply to parent</summary>

> Built a one-page HTML math worksheet for Theo: eight vertical addition/subtraction problems (mix of single-digit and two-digit, no regrouping), an open-response format with answer boxes, a Challenge word problem, a "try this together" family extension, and an answer key set upside-down at the bottom per the math practice rules. The quality check passed with no issues.
> 
> Difficulty: no map evidence or parent input on Theo's current skill existed, so I used the age-7 default band ("simple sums," ages 6-7) rather than guessing higher or lower, landing on low double-digit addition/subtraction as a reasonable working level with a slightly harder multi-step Challenge to probe past it. I chose the HTML path (not image-direct) because this is exactly the case the skill flags for html: precise probl

</details>

## theme-correction-follow-up

- ERROR  harness run failed: Failed after 2 attempts. Last error: GatewayTimeoutError: Gateway request timed out: Cannot connect to API: Connect Timeout Error (attempted address: ai-gateway.vercel.sh:443, timeout: 10000ms)

    This is a client-side timeout. To resolve this, increase your timeout configuration: https://vercel.com/docs/ai-gateway/capabilities/video-generation#extending-timeouts-for-node.js

---

Deterministic checks: 19 passed, 8 failed.
Judge: 0/2 keepers on the first try.

## Skill fixes to iterate on

- counting-dinosaurs-evidence: Add a build-completion check in the counting recipe/router that blocks finishing until homaBuiltHtml contains the actual worksheet, with counting quantities calibrated to the child's evidence (push past 8-10) and multiple dinosaur images matching those quantities.
- montessori-approach-read: In the nomenclature-cards recipe, make the build-and-reply step mandatory immediately after image prompts so a run can't end with prompts drafted but zero HTML output or parent-facing message.
