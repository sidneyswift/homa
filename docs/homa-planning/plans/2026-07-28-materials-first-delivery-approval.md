# Materials: first-delivery approval plan

**Date:** 2026-07-28
**Status:** PROPOSAL, awaiting founder priority ruling
**Goal:** raise the share of materials a parent approves on first delivery from the current 28% toward 60%+, and cut correction rounds per approved material.
**Evidence base:** every non-sandbox material session in prod from 2026-06-23 to 2026-07-28 (13 families, 102 sessions, 414 material rows, 437 `create_printable` calls; sandbox families and null-family eval-contamination rows excluded), read directly from prod Postgres; transcripts of the heaviest back-and-forth sessions; the revision-pair ledger (`materials.revises` chains with per-version `generation.input.requestSummary`). Counts are pinned at the 2026-07-28 evening audit snapshot and drift live; mid-study, a parallel session deleted 17 debug material rows from a real family's tenant (the F13 cleanup, recorded in gh#359), shrinking history retroactively, which is exactly why the S8 metric view must pin its population and exclusion rules.
**Verification:** all §1 and §4 numbers were independently re-derived by a second pass with its own SQL; numerators reproduced, three denominators were corrected, and the bucket taxonomy was tested against every previously unread session of the month.
**Relationship to existing work:** this plan sequences and extends the unshipped P1 block of `2026-07-24-materials-generation-ux-iteration.md`, and folds in gh#189 (FD rulings), gh#197 (approval gap), gh#241 (draft invisibility), gh#202 (web photo upload), gh#175 (Binder in-progress), gh#203 (long-turn streaming). It does not re-propose anything already shipped (P0.1-P0.9, pageIndex splice, anchors). **Same-day companion:** the Carolyng field-study arc (gh#359 umbrella; gh#345-#357, gh#368) landed in parallel from the other direction (one family, deep, trust and reliability). The agreed seam and merge map are in §5 and §7: that arc's build order 1-4 runs first, gh#349 is the shared bridge, and this plan keeps the pre-generation layer, the fleet metric, and the evals.

---

## 1. The month in numbers

| Measure | Value |
|---|---|
| Root materials created (real families, 35 days) | 164 |
| Revision materials | 251 (revisions outnumber originals) |
| Roots ever reaching `final` | 63 (38%) |
| Roots finaled with zero parent-driven revision rounds | 46-47 (**28% first-delivery approval**) |
| Drafts stranded (never approved, never superseded) | 173 |
| `create_printable` calls carrying `revisesId` | 240 of 437 (55%) |
| Revisions that were same-turn self-fixes (QC loop, parent never asked) | 166 of 251 (66%) |
| Revisions driven by parent feedback (cross-turn) | 85 of 251 (34%) |
| Hard tool failures | 4 of 437 printable calls; failure is judgment, not plumbing |
| Latency | `create_printable` p50 6s / p90 29s; `generate_image` p50 41s / p90 56s |

Transcript-derived observations the SQL view cannot reproduce (marked so the S8 ratchet never claims them): Homa asked a clarifying question before generating exactly once in the read transcripts (Busby session) despite the skill's one-calibrating-question rule; heavy packet turns ran 6-17 minutes; roughly 30 of the 07-23 calls were the already-resolved diagnostic storm (F13). Also: 63 of 90 web material sessions were single-shot (one user message, no feedback at all), so web silence dominates the stranded-draft number, and silence is not rejection, which is why §4 pairs approval with the consumption beacon. Tool-outage retries add a further round-multiplier the taxonomy deliberately excludes as reliability rather than material quality: one page-sizing correction consumed five parent rounds during a `create_printable` outage window, and the Knox session's worksheet never arrived at all (diagnosis and per-family tool-failure alerting are gh#345, which runs before everything here; measuring first-delivery quality on a flaky tool is measuring noise).

Two distinct loops burn the effort:

1. **The silent loop (66% of revisions).** Homa's own QC flags a draft, she rebuilds, sometimes several times, inside one turn. The parent never sees these versions; they pay out as latency, image spend, and occasionally total non-delivery.
2. **The correction loop (34% of revisions).** The parent tells Homa what missed. These 85 rounds are the direct back-and-forth this plan exists to eliminate, and they cluster: when a material needs one fix it usually needs several (12 chains ran 6+ versions).

## 2. Delta taxonomy: what parents had to correct

Buckets ordered by observed weight (share of the 40 most recent parent-driven revision pairs, plus transcript evidence from every heavy session of the month). A verification pass mapped every correction round in the previously unread sessions against these buckets; B1 alone took 9 of 14 rounds in the heaviest late-July session.

### B1. Page geometry: blank bottoms, cut-offs, element sizing (roughly half of all parent rounds)
The dominant bucket by far. "Fill the remaining blank space at the bottom of pages 3, 6, and 7, for the third time." A six-round loop of "make page 4's illustration bigger" / "larger still" / "even larger" with Homa nudging a CSS max-height blindly each time, until the parent escalated to a precise "15% bigger" spec, a signal that vague size adjustments were not converging. The mirror failure in the same sessions: "shrink the whole page so nothing is cut off at the bottom." Busby: "make the draw/cut-paste boxes bigger, leave out the instruction text inside the boxes."
**First delivery:** a page that is either 60% full or overflowing, boxes sized for aesthetics.
**End state:** a measured full page, or content split across two pages with the answer key on its own page.
**Knowable in advance:** entirely, by code. Nothing measures rendered content height against the page box (the F1 finding; `fillPct`/`clippedPx` still appear nowhere in the codebase). The model gets no numbers, so it oscillates.

### B2. Image fidelity: cropped subjects, character likeness, reference style (roughly a quarter of parent rounds)
An eight-round Statue of Liberty saga (full statue base-to-torch, not cropped, watercolor style matching a parent-shared postcard reference, skyline added, taxi added). "Swap the header robot for one closer to the actual PS5 Astro Bot look." "Artemis's face got cropped out of the banner." "Real illustrated pictures instead of emoji."
**First delivery:** a generic themed image, subject partially cropped, style unanchored.
**End state:** full subject visible, style matched to the family's reference, IP characters accurate.
**Knowable in advance:** partially. "Whole subject visible, nothing cropped" is a universal expectation and belongs in every image prompt and in QC. Reference style is knowable the moment the parent shares a photo: on SMS this already happens (the parent texted a watercolor reference mid-saga and convergence followed within two rounds), but the web upload path is broken (gh#202) and the skill has no ritual for extracting a layout and density spec from a reference image, so even a received reference only steers style, not structure.

### B3. Age and ability fit (fewer rounds, highest emotional cost)
The angriest quote of the month, child age 2: "wtf is this he is 2 he can't read. What am I supposed to do with this? You made a random game but provided me no instructions, or have not thought out how this will actually help Bruno. Do better." Same bucket: Spanish syllable words restricted to "letter sounds she already knows"; glue boxes physically too small for cut-out cards in small hands; a 9-year-old's packet dismissed as "very surface level" (the depth objection, which triggered a full rebuild); a parent pre-correcting level mid-request ("still working on multiple digit addition... if there is multiplication it's simple multiplication").
**First delivery:** text on a pre-reader's page, content at a generic level for the age.
**End state:** picture-only artifact plus a how-to-use script for the parent, content pinned to the child's actual knowledge state and motor ability.
**Knowable in advance:** almost entirely. `birth_month` and the progress map are in the database at generation time. QC has no age criteria (the review prompt checks spelling, names, theme, layout; never "can this child use this").

### B4. Artifact-structure guesses (steady tax on every multi-part request)
Busby: asked for "a checklist of monuments and National Parks", got one combined list, wanted two. Region ordering redone to the parent's own scheme. A packet accidentally duplicated to 11 pages ("correct the page order to the proper 9 pages"). A "game" request answered with a printable offer twice ("No not a printable page. A game of some sort please").
**Knowable in advance:** mostly, with either one question or a stated assumption the parent can redirect before the build.

### B5. Fan-out amplification (few sessions, enormous volume)
The catechism session: flash cards for four children, so "remove the tinted background" and "true baseball-card size" each re-ran four builds, and the physical size change forced page-count cascades Homa discovered by trial and error ("only 4 cards fit per page... fixing the cut-off page... label fix only"). 39 printable calls from 3 user messages.
**Knowable in advance:** the arithmetic (2.5in by 3.5in cards means 4 per page, 11 cards means 3 pages) is deterministic; the sequencing rule (perfect ONE child's master copy, then fan out) is free.

### B6. Approval, consumption, and visibility capture (the funnel's dark matter)
173 drafts stranded. Parents say "looks great", "these look fine", "perfect", and, twice in one session, the literal phrase "add to my binder" / "throw it in my binder", and materials still strand unless Homa maps that to finalize; other parents go silent because the thing was fine (or because they left; one parent replied "Sure" four days after delivery and nothing followed). The mirror failures, all live in late-July sessions: stranded drafts invisible in the Binder ("I don't see my packet non living living or the syllable counting worksheet in my binder"), shown-but-not-registered cards ("Where is it?" after an edit), and silent long-turn re-asks while a packet builds (the gh#170 silent-long-turn class). Tracked already as gh#197 and the PMF-102 Keep affordance; restated here because every metric in §4 depends on it. The deterministic tracking home for the visibility half (per-card emission logs, client render ack, parse-null fallback card) is gh#347.

### B7. Parent-usage instructions (small, cheap, brand-relevant)
"Provided me no instructions." Instructions belong in a parent-facing block, not watermarked inside the child's writing boxes (Busby had to ask to remove them). Applies beyond toddlers: any game or multi-step activity needs a how-to block a parent can act on.

### B8. Language and dialect fit (new, verified in the late-July sessions)
After finalizing an English packet the parent asked "Can you make this in spanish?", then refined to "Can you make a Spanish Latin American version", in a home whose session log shows ten bilingual read-alouds. Caveat from verification: the dialect refinement followed a failed first Spanish build, so it may be specification rather than correction of a wrongly chosen dialect, but the dimension itself (material language and variant) appears nowhere in the brief, the QC criteria, or the family constraints. FS-9 (language-aware materials, gh#205) named this months ago; this is its first prod evidence.

## 3. Root causes across buckets

1. **The model gets no measurements.** Layout convergence is blind: no fill/clip numbers on any render, QC reads at most 4 pages while parent complaints centered on pages 3, 6, 7 of 7-to-12-page packets.
2. **Knowable context is not loaded at the decision moment.** Age, known letters, working edge, sibling roster, home language, prior corrections: in the DB, absent from the generation brief. The anchor-selection fix proved the pattern that works: put the rule on the checklist the model executes at the decision moment, not in a paragraph it read 40 turns ago.
3. **Assumptions are invisible until the parent corrects them.** Homa almost never asks the skill-mandated calibrating question, and never states her assumptions before a long build, so every mismatch costs a full generate-review-deliver round instead of an early, specific redirect.
4. **Corrections do not persist.** "For the third time" inside one packet; the same density preference re-litigated across materials. Nothing replays a family's standing constraints into the next brief.
5. **QC grades against generic criteria, not the brief, and its accuracy is unmeasured.** It passes pages the parent then rejects (no age fit, no density-vs-reference, no "whole subject visible", no parent-instructions check), it cannot see most pages of a packet, and with 66% of all revisions QC-driven, an uncalibrated false-positive rate is a direct silent-loop cost. The field-study council independently verified two more false-pass mechanisms: a null review (timeout) reporting as passed, and the 600-char `requestSummary` truncation starving the reviewer of the brief (both fixed in gh#346).
6. **Approval is a phrase parents do not say**, so success is invisible and the library fills with drafts `find_materials` will not surface (gh#241 fixed the search default; the affordance gap remains).

## 4. The metric

**First-delivery approval rate** = roots whose chain reaches `final` with zero cross-turn revisions / all roots, weekly, non-sandbox, excluding `subject_lesson` channel builds.
Current: 46-47/164 = **28%**. Population and null rules are load-bearing and the S8 view codifies them explicitly: the non-sandbox filter is evaluated at view time and exclusions are pinned (history rewrites happen; the F13 debug-row cleanup deleted 17 rows from a real family mid-study), and 10 revision pairs carry null `turnId` on both sides, which the same-turn/cross-turn split treats as a match.

Companion metrics, same query family:
- **Correction rounds per approved material** (cross-turn revisions in final-reaching chains; currently 16 of 63 finals needed at least one, chains up to 6+). **This is the primary quality score for waves 1-2**, because S9 deliberately changes what finalize captures and would otherwise pollute the headline rate. The same series expressed as median and p90 rounds-to-final is gh#349's success metric (at or under 2 for packet-class materials) and gh#348's convergence baseline; the S8 view is the durable home for both framings.
- **Strand rate**: roots never reaching final AND never superseded (currently 101/164 = 62%), paired with the `materials.pdf_opened` event (in `events`, live since the P0 fixes on 2026-07-25: 40 opens from 2 families in its first three days) so silent-but-consumed materials stop counting as failures. Part of the strand rate measures a notification gap, not a quality gap; see the §6 deferral note.
- **Silent-loop cost**: same-turn revisions per delivered material (currently 166/251), plus p90 turn latency.
- **Shadow series for the S9 baseline break**: approved-or-consumed with zero corrections (final OR `pdf_opened`, zero cross-turn revisions), with an annotated break at S9's deploy date, so approval-capture improvements and first-delivery-quality improvements are never conflated.

All series are one SQL view over existing data (`materials.revises`, `status`, `generation->>'turnId'`, the `events` ledger). No new writes needed.

## 5. Solutions, ordered by wave, ranked inside each wave by expected UX lift

"Skill" means `apps/web/agent/skills/materials-studio/SKILL.md` plus eval fixtures; "tool" means deterministic code. Models judge, code verifies, throughout.

**Seam with the field-study arc (gh#359), agreed 2026-07-28:** that arc's build order 1-4 runs before this plan's waves (gh#345 outage diagnosis + alerting, gh#346 quick-fix bundle, the gh#197/gh#241/gh#175 draft-stranding cluster with gh#347 telemetry, gh#348 data pulls). Review coverage is owned there too: gh#346 ships changed-pages-first and gh#368 (founder ruling `materials-review-coverage`, 2026-07-28) tracks full first-build coverage, so this plan carries no review-coverage item of its own. gh#349 is the shared bridge: it owns page geometry and the complaint ledger, absorbing this plan's S6 and S7 as noted below.

### Wave 1: start now, no founder decision needed

**S8. Metric view plus admin tile.** (Effort: S. Impact: enabling; lands first, position zero.)
The §4 SQL view and a small card on the founder console overview, carrying both framings of the quality series: first-delivery approval (this plan) and rounds-to-final (gh#349's ratchet). It is the durable home for gh#348's convergence baseline, which otherwise lands in a folder; gh#348 keeps the parts the view does not carry (COGS, library-demand counts, stamp checks). Every subsequent merge is scored against the pinned 28% baseline.

**S6. Deterministic page measurement. MERGED into gh#349's geometry leg.**
`create_printable` measures rendered content per page in the existing render pass (overflow via scrollHeight, fill-ratio in pixel space) and the findings feed QC and the model's revision decision. This plan's contribution to gh#349, now recorded there: the findings must also include a **per-page activity/item count**, because fill alone Goodharts into padded, content-light pages (the 07-24 council's accepted objection). Kills the blind oscillation loop that is half of all parent rounds; the geometry half can start week one, the assertion-replay half follows gh#348's baseline.

**S1. Assumption brief before every first build.** (Effort: S. Impact: high. B3, B4, B7, B8.)
Skill change: before the first `create_printable` of any new material, Homa states a three-line brief in the reply: level and the evidence for it, format and page count, theme and characters, and, in a home with more than one language on record, which language and variant. One calibrating question ONLY when a load-bearing slot is empty (age unknown, subject ambiguous); otherwise build immediately after stating assumptions, so a mismatch costs one early, specific correction round instead of a full generate-review-deliver cycle. On SMS the heads-up makes true mid-build redirects possible; on web the build occupies the turn and the redirect lands after delivery, which is still one cheap round instead of several. This is the existing one-question rule moved onto the checklist at the decision moment, the pattern that took anchor carriage from 3/6 to 18/18.

**S2. Age, depth, and usage hard rules in the brief and the build.** (Effort: S. Impact: high. B3, B7.)
Skill change plus QC criteria: under 4 means picture-only artifacts; cut-and-glue pieces get minimum physical sizes by age band; content vocabulary pinned to recorded knowledge (known letter sounds, working edge) with the source named in the brief; a depth check keyed to the child's recorded working edge (the 9-year-old "very surface level" case that age rules alone miss); and any game or multi-step activity, at any age, ships a short parent-facing how-to block printed outside the child's work area. The density table already in the skill gains a motor-fit column. Answer-key mechanics (default-on, page-role enum) are owned by gh#356; this item asserts their presence in the brief, not their implementation.

**S3. Master-first fan-out rule.** (Effort: S. Impact: medium-high. B5.)
Skill change: multi-child or multi-variant requests build ONE master version, ask for the parent's yes, then fan out siblings. Silence fallback, because 63 of 90 web material sessions are single-shot and a hard yes-gate would strand siblings: if she has not replied by the end of the session, say the master is ready, fan out the siblings anyway, and note she can redirect any of them. Physical-dimension formats state the capacity arithmetic in the brief (card size means N per page, M cards means P pages) as model-stated assumptions the parent can veto, retired when S13's deterministic helper lands.

**S4. Whole-subject and reference rules for images.** (Effort: S. Impact: medium-high. B2.)
Skill plus QC: every image prompt names the full subject visible (feet-to-torch rule); when a parent has shared a reference, the brief must quote the extracted spec (style, density, layout) and `generate_image` must carry it as `referenceImageUrls`. The character-canon-fidelity half (the Astro Bot case) is MERGED into gh#357's theming dial, which carries the same fixture and an age-keyed canon rule. Web half blocked on S10; ship the SMS reference ritual first.

**S10. Fix web photo upload (existing issue gh#202, do not refile).** (Effort: M, bug. Impact: unlocks S4's web half. B2.)
Parents cannot currently hand Homa the reference image that half of bucket B2 converges toward. Its own text makes it a Wave 1 prerequisite, so it sits here, not in a later wave.

Wave 1 ships as one skill PR (S1-S4's skill halves plus eval fixtures) and one small code PR (the S8 view plus the QC-criteria halves of S2/S4), with S10 separable. Geometry code lands via gh#349.

### Wave 2: next, small code plus skill, no founder decision

**S5b. QC calibration run (T2 of the 07-24 review).** (Effort: M. Impact: silent-loop cost. Root cause 5.)
Precision/recall of the checker against this study's labeled parent complaints (stored preview JPEGs plus a human-labeled sample), before QC gains new criteria via S2/S4 and before gh#368's full first-build coverage is enabled fleet-wide, so an unmeasured false-positive rate is not compounded by more coverage. 66% of revisions are QC-driven; calibration is the difference between a quality gate and a random tax.

**S7. Standing family constraints. MERGED into gh#349 as its family-scoped ledger tier.**
gh#349's complaint ledger (structured assertions with code-verified quotes, replayed within the revision chain) is the substrate; this plan's contribution, now recorded there: assertions that recur across chains (density preference, style, answer-key placement, character canon, language and dialect variant) are promoted to durable family constraints and replayed into every new material brief. One constraint schema, two scopes; never two ledgers. Carve-out pending a ruling: a constraint contradicting a binding design law is captured but NOT replayed until FD-3 (gh#189) rules.

**S9a. Finalize cue broadening.** (Effort: S. Impact: high on funnel truth. B6.)
Broaden the skill's finalize cue list to plain praise and binder language ("looks great", "perfect", "add to my binder", "throw it in my binder") followed by a confirmation sentence rather than a nag. The binder phrases appeared verbatim in this month's transcripts; finalize fired in that session only because the model happened to interpret them. §4's shadow series absorbs the baseline break. Advances gh#197 alongside gh#346's mechanical finalize fixes (idempotent retry, chain-scoped lock); genuinely no ruling needed.

**S11a. Truthful QC relay. FOLDED into gh#346.**
gh#346 already carries the verified fixes ("Quality check passed." names what was checked; a null review never reports as passed). The remaining sliver, deterministic verdict relay on a second consecutive QC failure of the same page (07-27 solution 3), rides behind it; the two-strikes prose rule already ships in SKILL.md and the delta is enforcement.

**S12a. Fixture export plus deterministic quality checks.** (Effort: M. Impact: compounding. All buckets.)
Golden briefs from this study's real failure cases (the 2-year-old game, the four-child flash cards, the reference-density tracing page, the blank-bottom packet) run through the skill in `eval:sandbox`, scored by deterministic checks: fill, clip, item counts, age rules, answer-key presence. Ships alongside gh#349's geometry leg per the 07-24 council ruling that behavioral changes ship with their eval; coordinates fixtures with gh#349's regression case (the 07-23 Amalia packet). References the 07-24 doc's §5.2 harness table rather than restating it.

### Wave 3: founder-gated or larger builds

**S9b. One-tap Keep affordance on the material card.** (Gated on FD-2(a), gh#189. B6.)
PMF-102, gh#175 adjacent: the card calls the family-scoped finalize path directly. This study's 173 stranded drafts are the evidence packet for that ruling, not a pre-emption of it.

**S11b. Flagged-draft delivery with the objection named.** (Gated on FD-1, gh#189: the QC-authority-on-web law. Silent loop.)
After the two-strike stop, deliver the best version with the checker's objection in Homa's words and let the parent accept or redirect. 166 silent revisions and 6-17 minute turns are the strongest argument yet filed for FD-1; it goes to the founder with these numbers attached.

**S12b. Model-judge brief-adherence scorer.** (Effort: M. Impact: compounding.)
The latent half of the eval harness: does the artifact match the stated brief. Ratchet in CI once S12a's deterministic floor is green.

**S13. Physical-layout math helper.** (Effort: M. Impact: medium. B5, B1.)
A small deterministic helper that, given piece dimensions and counts, returns per-page capacity and page count, so dimension-bound formats are computed before generation, retiring S3's model-stated arithmetic. First slice of the Phase D `compute_practice_content` direction; answer-key arithmetic belongs to the same family (gh#356 owns the key mechanics).

**S14. Packet as ordered pages plus compile step.** (Effort: L. Impact: high for packets. B1, B5, latency.)
The data model the packet edit unit implies (solution 9 of the 07-27 packet doc): pages as individual materials, packet as an ordered collection with a compile step, so any page edit is one-page cost and big builds can move to the agent-jobs runner with streaming progress (gh#203). gh#356's page-role enum is the down payment on this model. Founder-visible architecture change; schedule after gh#349/S12 prove out.

## 6. Scope, gates, and deliberate deferrals

- No new god tool, no template system (standing ruling: design the capability, not the artifact; gh#358 Q5 owns the question of whether a template bench may test that ruling).
- No pattern-matching layer deciding what parents mean (models judge, code verifies).
- **Founder-gate map, stated honestly:** S11b is gated on FD-1 (flagged-draft law); S9b's Keep affordance is FD-2(a); S7's conflicting-preference replay is subject to FD-3. Everything in waves 1-2 outside those carve-outs needs no ruling. All three rulings live in gh#189 and this study's numbers travel with them. The field-study arc adds its own package (gh#358 Q1-Q7); Q4's review-cost posture was partly settled same-day by the `materials-review-coverage` ruling recorded on gh#368.
- No dynamic per-family skills; standing constraints ride gh#349's ledger and `remember`, the existing surfaces.
- No turn-completion nudge for long web builds in this plan; that is FD-6 territory plus gh#203's streaming half. Its absence means the strand-rate metric partly measures a notification gap, which the `pdf_opened` pairing in §4 and gh#347's render acks partially compensate for.
- Planner-integration asks ("how do I put these plans into the planner", three rounds in one Busby session) are real but out of scope here; they belong to the one-planner arc (gh#256-#265) and predate the planner write tools.

## 7. Tracking

Umbrella: gh#362 (this plan) with the seam to gh#359 defined in §5. **Reuse map, updated after the 2026-07-28 merge review:**
- gh#345 outage diagnosis + alerting: runs first, precondition for clean measurement.
- gh#346 quick-fix bundle: absorbs S11a; owns changed-pages-first review and truthful QC strings.
- gh#347 delivery telemetry: owns B6's visibility half.
- gh#348 data pulls: seeds the S8 view; keeps COGS, demand counts, stamp checks.
- gh#349 layout program: absorbs S6 (geometry, plus this plan's item-count guard) and S7 (family-scoped ledger tier).
- gh#356 material ladder remainder: owns answer-key mechanics and page roles (S2 asserts, S14 builds on).
- gh#357 theming dial: absorbs S4's canon-fidelity half; gh#178 (T6 art directions) closed into it as a duplicate.
- gh#368 full first-build review coverage: founder-ruled; replaces this plan's former S5.
- gh#202 (S10), gh#197 (S9a advances it), gh#175/gh#189 (S9b), gh#189 (S11b FD-1, S7 FD-3), gh#203 + 07-27 packet doc (S14), gh#205 FS-9 (B8).
New issues only for solutions without a tracked home: the Wave 1 skill PR (S1-S4 halves), the S8 view, S12a/b, S13. The metric view lands first so every subsequent merge is scored against the 28% baseline.

## 8. Session-quote appendix (verbatim, for the buckets)

- "Parent asked, for the third time, to fill the remaining blank space at the bottom of pages 3, 6, and 7." (B1)
- "Make page 4's coloring illustration bigger so it fills more of the empty space." then "larger still", "even larger", "even bigger, using the full page width", "raising its max-height cap further". (B1)
- "Keep the taller top banner image the same size, but shrink all the text sections below it so the whole page fits without the bottom getting cut off." (B1)
- "Swap the header robot image for one closer to the actual PS5 Astro Bot character look (white body, blue hands and feet, big blue eyes)." (B2)
- "Fix the banner image so the whole Statue of Liberty (base to torch and crown) is fully visible, not cropped, since the girls are especially excited about her." (B2)
- "wtf is this he is 2 he can't read. What am I supposed to do with this? You made a random game but provided me no instructions, or have not thought out how this will actually help Bruno. Do better." (B3, B7)
- "Ten real Spanish words built only from letter sounds she already knows." (B3)
- "Page 5's and page 11's glue boxes are still too small for the cut-out cards, and page 11's 16 cards need real illustrated pictures instead of emoji." (B3, B2)
- "Keep all of the national parks, take out the monuments and create a separate check list." (B4)
- "No not a printable page. A game of some sort please." (B4)
- "True baseball card size (2.5in by 3.5in) means only 4 cards fit per printed page, so this lesson now spans 3 pages." (B5, discovered by trial and error, four children deep)
- "Make the spaces where they can draw or cut and paste a little bigger and leave out the watermark instructions inside of the boxes." (B1, B7)
- "I don't see my packet non living living or the syllable counting worksheet in my binder." (B6)
- "Perfect add to my binder." and "Make the pages for all three and throw it in my binder." (B6)
- "Can you make this in spanish?" then "Can you make a Spanish Latin American version." (B8)
