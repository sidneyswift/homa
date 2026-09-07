# September 6 prepared materials and map release

Source: [meeting review](2026-09-05-cofounder-feedback-review.md), F12 and F17-F20. Tracking: #1094, #1098, #1101 and #1102. This document distinguishes integrated code from a completed production or model journey. Sidney directed shipping after the existing testing; no additional optional model or hosted journey is implied.

## September 7 completion notes

- 2026-09-07, discovery, #1098: a real populated 320/390px production journey found the visible editable question correct but the selected-ability cookie unreadable. `encodeAbilityContext` applied URI encoding before Next's actual `Set-Cookie` serializer encoded it again. The request reader decoded once and returned null. This is a live handoff failure, not a changed feature request.
- 2026-09-07, plan-confirmed: leave transport encoding to Next and test the actual `NextResponse` serializer through the request-header reader. Preserve short expiry, HttpOnly/Secure/SameSite settings and both authenticated child/catalog checks. Repeat the hosted handoff after the fix is deployed.

## Resulting behavior

The abilities map explains direct, inferred, unknown, stale and conflicting evidence, shows its source dates and graph dependencies, and carries a selected child/ability question into a visible chat draft. Opening a node never records progress. Expired or mismatched handoffs fail explicitly.

Targeted curriculum requests use the actual owned edition, physical PDF page locations and available page text. The fleet skills distinguish a single lesson or next-five packet from whole-book decomposition, preserve spiral review and parent guidance, and stop honestly on unread pages. Optional thematic lookup includes shared family resources, stays small, and requires relevant evidence. Urgent requests skip optional enrichment while retaining source requirements and rendering checks. There is no new speed promise, universal mode picker, automatic calendar placement or mastery claim.

Material provenance can retain exact Ready curriculum page or recorded-unit quotes, source content hashes and extraction versions. Deterministic verification checks ownership and quote presence; it does not certify pedagogy. Ordinary revisions inherit source evidence; an explicit source change is verified anew.

Supported handwriting rows use measured glyph outlines and guide geometry. Revisions preserve case and predecessor dimensions through exact typed provenance; supported legacy profiles can be recovered, and unknown legacy fonts are refused. Protected lesson revisions stay scoped to the current family, child, lesson and attempt. The tracing style uses dotted outlines, not a centerline font. Existing print selection, Binder lookup and page-size floors remain intact.

## Evidence already obtained

Map work passed 21 focused checks, typecheck/lint and six hydrated states. Handwriting preparation measured six physical pages, 138 glyphs and guide/baseline alignment, and the protected revision integration passed 15 disposable PostgreSQL groups plus focused render/RLS checks. Source-evidence and owned-lesson fixtures passed their deterministic and independent reviews. These checks ran on the frozen component packages before final assembly; required CI checks the integrated release.

The exact reported D page remains unidentified. No physical printing is claimed. The prepared curriculum and handwriting model evals were not run after the user's instruction to stop additional testing. The new ability explanation has not been usability-tested with the co-founders. These limits remain on the individual issues rather than being converted into passing evidence.

## Integration and release

The reviewed 60-path composition began at cc9c0e54 and was applied after the contextual-progress merge 68667444. Current package commands were preserved, including the new progress checks. The two earlier source overlaps preserve both the literal Binder title matcher and protected lesson reader, and both the Binder routing boundary and optional owned-resource procedure. No new migration or dependency is introduced.

Pre-push fleet-skill, tool-deadline and Eve deployment checks are required. PR checks, exact production READY and a deployment probe will be recorded on the issues. The dated audit below each meeting item remains historical cause evidence, not a claim that its old pipeline is still active.

## Production receipt, September 6

[PR #1133](https://github.com/sidneyswift/homa/pull/1133) merged as `080efd6c9306ad82b84baa791a255685f8c06d29`. Exact-head required CI `34069563048` and Vercel passed. Production deployment `dpl_CQ2ZgwkwDEPKcSe8eQ2QPdrQM96m` reached READY and was verified on `thankshoma.com`; root/sign-in returned HTTP 200 and the protected app returned its expected sign-in redirect. The original CI color-token failure was corrected to the existing information token and the required checks reran successfully. These are release and basic availability receipts; the model, owned-lesson, physical printing and parent-usability limits above remain explicit on the linked issues.

## September 7 guided handwriting render and delivery verification

### 2026-09-07, plan-confirmed

Fix the reproduced fractional self-clipping failure and evaluate the draft actually delivered in chat. Scope is the handwriting renderer, its focused tests, and the guided-name-rows evaluator. Existing material generation, review, family scope, and approval rules remain authoritative.

### 2026-09-07, discovery

The isolated synthetic eval made 13 create attempts. Its four-row input with cap height 92 rendered at the correct 178.25 CSS pixels, but Chrome's integer `clientHeight` was 178. The image's own default `overflow: clip` made the verifier report a nonexistent 0.25-pixel crop. Real print screenshots show all rows within the printable area. The final persisted four-row draft passed authentic server receipt validation.

The evaluator selected the first `created: true` result, a review-failed scratch draft hidden by the product. The web chat already owns revision and review selection in `selectParentVisibleMaterialMessageParts`. Use that production selector and require exactly one visible draft; never choose an arbitrary last success.

### 2026-09-07, plan-confirmed

Skip only the image's redundant self-overflow comparison after its exact dimensions and unaltered image framing have been checked. Keep paint, transforms, rounded clipping, every real ancestor's clipping, and the printable content bounds. Regress both fractional row heights and an actual 0.25-pixel ancestor crop through the real print renderer.

### 2026-09-07, verification

The actual Chromium/PDF renderer passed all 20 focused tests, including fractional 178.25px and 151.125px rows, a rejected real 0.25px ancestor crop, and all prior hostile framing cases. Five tool-contract tests passed, including visibility through hidden drafts and revision chains, rejection of multiple independent visible drafts, and preservation of parent approval. Focused web ESLint passed.

The captured original four-row input and the final saved HTML were rendered again with authentic receipts. Both produce a verified one-page US letter PDF with no overflow. The new delivery selector resolves the saved final draft, not any hidden scratch record. Both PDF-raster previews were visually inspected. Local proof: `/tmp/homa-feedback-implementation/guided-name-diagnosis/repaired/receipt.json`, alongside the two PDFs and JPEGs; original traces remain unchanged. These checks do not claim a new model run or production deployment.

The original run's unrelated scratch drafts were all hidden by failed review. The fresh isolated guided-name-rows run passed all five gates in 52.2 seconds: two create attempts, one saved passing draft, and zero hidden scratch drafts. The first attempt correctly refused an external stylesheet; the second produced all four requested rows at cap height 96, with no overflow and 96% page fill. Scratch-lineage failure did not recur after the geometry repair. This is one observed model turn, not a claim that all future generations will take two attempts.

The exact delivered PDF and JPEG, saved HTML/receipts, tool trace, and counts were copied before sandbox cleanup to `/tmp/homa-feedback-implementation/guided-name-diagnosis/fresh-model/`. The PDF's SHA-256 matches its stored verified handwriting render receipt: `00199796f04437432973e9e9f12d81b4039c5a775405de3b888e67c96a429854`. Its actual PDF-raster preview was visually inspected. Independent review passed the bounded renderer and evaluator changes. The run and its disposable cluster exited successfully; deployment remains a separate release gate.

### Next attempt

- Compare fractional rendered geometry with the correct box; integer client dimensions can misrepresent a replaced element's own clipping edge.
- Use the product's visible-card selection when grading delivery, including revision lineage and review failures.
- Keep original synthetic traces before the disposable eval database is removed, so harness failures can be separated from product failures.
