# Materials spacing diagnosis: the half-empty Pokemon page (2026-07-29)

**Status: LIVE PRODUCTION QUALITY FAILURE, escalated to the founder in the
session that diagnosed it (2026-07-29). Fixes in flight the same day: the
gh#349 geometry slice and the image-refusal classification were both started
as founder-launched sessions off this diagnosis. This doc is the evidence
layer; status lives on the issues (gh#349, gh#357, gh#189).**

## The complaint

Carolyng (family `304f0003`, child Alma, ~9-10) texted the founder a
screenshot of "Alma's Pokemon Division Trainer" (material `a07d0ffe`,
finalized 12:34 EDT on the newest deployed code) with two complaints:
"too much space" and "that is not pokemon". Page 1's content ends less
than halfway down the sheet; the mascot is a generic round yellow
creature.

## Production ground truth (prod DB, pulled 2026-07-29)

- The material is a 3-page packet (problems / word problems + challenge /
  answer key). Page 1's authored HTML measures ~420px of content in the
  912px (9.5in) content box: **46% fill**. Body text is 11 to 13px
  (8 to 10pt in print), instructions 11px italic, section margins 8 to
  9px. The renderer was faithful: previews are rasterized from the
  shipped PDF bytes, so what she saw is what printed.
- QC (`reviewArtifact`, gpt-5.4-mini vision) reviewed **all 3 pages** and
  passed with zero issues (`reviewedPages [1,2,3]`, `pass true`). Homa
  told her it "passed clean".
- Same session, same hour, on the sibling material "Rosalina's Galaxy
  Decimal Quest" (12+ revisions), she fought underfill five times in
  writing: "Fill up the Rosalina page" (12:34), "the page needs to be
  filled with questions. Only half the page has problems to solve."
  (12:38), "Space still on bottom of 2nd page" (12:44), "There is still
  1/4 of the page open on bottom of page 1 and 2. Fill it up please"
  (12:45), "I just want the pages to be filled" (12:49). Homa's fill
  attempt then **overflowed** (the checker caught page 1 "pushed past
  the printable edge") and she trimmed back. Every half-empty
  intermediate "passed clean". Her last word before printing the Pokemon
  page as-is and complaining out of band: **"I don't love it but I am
  tired of correcting it."**
- At 13:02, on a new decimal material, she preemptively demanded "The
  page needs to be full of problems" and Homa built a genuinely full page
  first try. The model can fill; its default is half-full.
- Image trail: all three Pikachu-faithful `generate_image` prompts
  **failed at the provider** (gpt-image-2 refuses trademark likeness).
  The failure note is the generic "Image generation failed this time.
  Try a reworded prompt.", so Homa watered the prompt down until "cute
  round yellow creature" succeeded, and that off-brand survivor shipped.
  Post-complaint she diagnosed the block correctly, told the parent
  plainly, and they landed on a poke balls header.

## Root causes, most likely to least likely

Established by a six-lane parallel code investigation plus a five-seat
expert council (print production, LLM systems, QA/verification, product,
regression skeptic). All seats converged on the same #1.

1. **Blind composition with no measured geometry feedback (root cause;
   recurrence of F1).** The composer writes HTML into an exact 7.3x9.5in
   `overflow: hidden` box (`page-shell.ts`) and never learns how tall its
   output rendered; the only feedback is a boolean plus short prose.
   Sign-only feedback with unknown gain produces the observed bang-bang
   oscillation: underfill, overcorrect into overflow, trim, ship
   mid-swing. No `fillPct`/`scrollHeight` measurement exists anywhere in
   the pipeline (grep-verified); Chromium holds the numbers on every
   render and discards them. The print-production seat sharpened the
   mechanism: the model authors screen-scale type onto a paper contract
   (11 to 13px body), so even 13 problems fill half a sheet. The
   2026-07-25 canvas-truth fix (12e421f6) already proved prompt
   corrections fix bias, not variance.
2. **QC cannot see underfill, then testifies against the parent.** The
   rubric says "a usable page passes", "do not nitpick... things the
   brief never asked for", and its only blank rule fires at "a mostly
   blank page" (`review-artifact.ts`). The brief carries zero fullness
   information and nothing tells the reviewer the JPEGs are letter-size
   sheets, so it cannot judge type scale or coverage. This is compliant
   behavior, not a weak model: a bigger model reading the same rubric
   passes the same pages. Five "passed clean" verdicts landed against
   pages the parent was calling half-empty as she looked at them.
3. **Skill guidance is one-sided about vertical space.** Binding law
   "Big type, generous whitespace... spacious reads as play"
   (SKILL.md), the age table caps 8-10 year olds at 5-8 items, the html
   contract warns only that overflow is cut, and there is no fullness
   floor, no type-size floor, no rows-per-page heuristic, and no
   cross-page distribution rule anywhere in the skill tree. Every worked
   example is a 2-problem fragment. A parent's density preference has no
   override channel (FD-3, unruled, gh#189), so the model re-defaults to
   sparse on every new material.
4. **The answer-key law (844c8d60, live 00:06 that morning) as
   aggravator, not cause.** Correct craft (ruled from gh#346), but it
   vacated the bottom band the upside-down key used to occupy on math
   pages and forces an extra short key page, and it shipped with no
   rebalance guidance and no eval. Identical complaints predate it
   (seven "blank space at the bottom" complaints from the same family on
   2026-07-23), so it cannot be the root. Do not roll it back; ship the
   missing rebalance line beside it.
5. **Constraint amnesia and the retry budget (contributing).** Her fill
   preference persists into neither the next brief nor the QC brief
   (standing-constraints ledger S7 unshipped), and the two-strike stop
   rule freezes the oscillation mid-swing.

**Excluded with evidence:** renderer defects (the shell mechanically
cannot insert space; render waits for fonts and images; preview equals
PDF), the offer-reservation fix (total-failure mode, not layout), the
step.started fix (availability), the personality commit (chat prose),
the version-rail commits (read-side).

## "That is not pokemon"

Separate mechanism, not a regression: the provider refuses trademark
likeness, `generate-image.ts` collapses every provider error into one
generic "try a reworded prompt" note, so retries decay to off-brand.
Gaps: no refusal classification in the tool result, no
expectation-setting guidance in the skill, no founder ruling on the
family-facing franchise-character posture. Canon-fidelity home: gh#357.

## Fix routing

- gh#349 smallest slice (started 2026-07-29): per-page content height,
  fill percent, overflow inches measured in `render-page.ts`, returned
  as structured fields in `create_printable`'s result and appended to
  the QC brief, expressed as an age-conditional band paired with item
  counts (a bare fill target Goodharts into padded, content-light
  pages). Plus the rebalance line beside the answer-key law and
  typographic floors for child-facing pages.
- Image-refusal classification plus franchise expectation-setting
  (started 2026-07-29), routed with gh#357.
- Founder rulings still owed: FD-3 density override (gh#189) and the
  family-facing franchise-character IP posture.

## The pattern lesson (product seat, worth keeping)

F1 was named the highest-leverage materials defect on 07-24, its fix was
specced twice and council-adopted, and it was still sequenced behind an
evidence gate while five night-shippable periphery fixes went out, one
of which perturbed the defective surface unverified. "A defect you have
diagnosed, specced, and council-adopted is no longer an engineering
question, it is a scheduling decision." And "I am tired of correcting
it" is the feedback loop dying: per the skill's own law the parent's
critique is the real review, so her resignation is the quality system
losing its only working sensor.
