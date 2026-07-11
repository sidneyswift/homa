# Benchmark corpus synthesis

> Historical research snapshot, 2026-07-06. This file preserves the evidence and analysis captured on that date. It is not current product, legal, provider, standards, or production guidance. Re-verify volatile facts and source freshness before porting any claim into Homa.

**Date:** 2026-07-06
**What this is:** the reading guide for the ages 2 to 16 national benchmark corpus: what the lanes captured, how it maps onto the product's 16 map domains, where it corrects the shipped bank, and what a follow-up pass should chase. First written after the original 10 lanes returned; wave 2 (lanes 11 to 16) and the porting status are folded in below. Per-claim sources live in the lane files, not here.

---

## 1. Coverage: what the corpus now contains

About 5,100 lines across 10 lane files, every factual claim linked with an access date, FACT vs INFERENCE labeled, unverifiable numbers logged in per-lane "dry wells" instead of estimated.

| Lane | Spine frameworks (edition) | Heaviest verified tables | Porting candidates |
|---|---|---|---|
| 01 early childhood | CDC milestones (2022, 75th percentile), ELOF (2015), ASHA, Clements and Sarama, AASM (2016) | Full CDC checklists 24 to 60 months (72 rows), 38 math-trajectory levels, Hustad intelligibility, Crowe and McLeod consonants | 112 items across 12 domains |
| 02 math | CCSS-M (2010), NAEP 2024, Appendix A pathways | ~115 per-grade capability statements, required-fluencies ladder K to 8, CBM fact-rate disagreement | 23 |
| 03 reading | CCSS RF, Hasbrouck and Tindal 2017, DIBELS 8 (2020), NAEP 2024 | Full 30-row ORF norms, 22 rows DIBELS goals, 11-grade Lexile/F and P/DRA/ATOS crosswalk | 22 |
| 04 writing and language | CCSS W and L, Gentry, Words Their Way, Graham 1998, SUGAR norms | Conventions ladder by grade, handwriting speed norms, CBM writing norms, MLU ages 3 to 10 | 22 |
| 05 science | NGSS (2013), NAEP science, ELOF, World Book | All 202 NGSS performance expectations cataloged (72 elementary, 59 MS, 71 HS), practices by band | 20 |
| 06 social studies | C3 (2013), Core Knowledge, CEE 2010/2021, NAEP civics and US history 2022 | C3 indicator progressions, map-skills ladder with state citations, financial literacy benchmarks | 20 |
| 07 arts, PE, health | NCAS (2014), SHAPE PE and NHES (2024), FitnessGram, Lowenfeld | Visual arts and music per-grade ladders, Seefeldt motor proficiency, FitnessGram HFZ ages 5 to 16, AASM sleep | 22 |
| 08 SEL, EF, life skills | CASEL (2020), Illinois SEL grid, Harvard EF, Dawson and Guare | 100-cell Illinois SEL grid, 11 executive skills by band, independence ages, home-alone statutes | 17 |
| 09 languages, CS, digital | ACTFL (2024), CSTA (2017, revision imminent), Common Sense, UNESCO AI (2024) | ACTFL sublevels and outcome research, 33-row CSTA table, 9-step Spanish exposure ladder | 18 (8 spanish, 7 CS, 3 other) |
| 10 assessment norms | NAEP, NWEA MAP (2025 norms), Lexile/Quantile, state statutes | MAP RIT means and growth K to 11, stretch vs typical Lexile bands, homeschool test market, GE misuse rules | 10 reference rows (reporting layer) |

Roughly 275 candidate anchor items now sit in the lanes' "Product porting notes" sections, each with a suggested typicalMonths and source. None auto-flow; porting is hand-done per item with a MAP_BANK_VERSION bump and `pnpm check:map` green, wording rewritten to pass the content laws (parent-observable, banned words, citations).

## 2. Crosswalk to the 16 map domains

Which lanes feed each shipped domain (primary lane bold):

| Domain | Lanes | Notes |
|---|---|---|
| math | 01, **02** | Trajectory levels under 6, CCSS spine 6 to 16; K counting tension noted below |
| literacy | 01, **03** | ORF medians and text ladders are internal calibration, never pass-fail lines |
| phonics | 01, **03** | Phonological awareness (01) hands off to UFLI-anchored phonics scope (03) at about 72mo |
| writing | 01, **04** | Composition and conventions; typing quotas are the only quantified CCSS outputs |
| language | **01**, 03, **04** | ASHA public milestones stop at 5; SUGAR journal norms carry ages 5 to 10 |
| science | 01, **05** | ELOF bridge to 60mo, NGSS K to 5 fixed by grade, bands after that |
| social_studies | **06** | Skills progressions only; topic placement is curriculum-dependent, never nudge on it |
| art | 01, **07** | Lowenfeld stages plus NCAS per-grade, the finest-grained national arts ladder |
| music | **07** | 01 found almost nothing preschool; 07's notation ladder (rhythm gr 1 to full notation gr 5) is the spine |
| gross_motor | 01, **07** | Watch the potential-vs-observed gap: mature form possible by 5 to 6, observed mastery much later |
| fine_motor | **01**, 04 | Grasp and shape-copying to 72mo, then handwriting speed and cursive (04) |
| social_emotional | 01, 06, **08** | Theory-of-mind anchor (57mo) is the biggest missing item; Illinois grid carries 5 to 16 |
| self_care | 01, **07**, **08**, 09 | Sleep and activity (07), chores and cooking ramp (08), digital privacy habits (09) |
| executive_function | 01, 02, **08**, 09 | The focus-minutes correction below is this domain's headline |
| spanish | **09** | Exposure ladder confirmed as the right design; 9 steps drafted, never months-ahead |
| computer_science | **09** | Shipped 2026-07-06 (16th domain): exposure-based like spanish, CSTA 2017 band anchors as ladder rungs; re-verify vs CSTA 2026 when it publishes |

Computer science began as this corpus's candidate NEW domain (09): CSTA bands give ready-made anchors at 96, 132, 168, 192 months, and no shipped domain covered it. SHIPPED 2026-07-06 by founder call as `computer_science`, exposure-based (see porting status below). Latin remains an audience-specific stretch candidate, not proposed.

## 3. Corrections and tensions vs the shipped bank (v2026.07.1)

Ranked by how much they matter:

1. **Attention minutes are folklore (08).** `executive_function.focus-5` (30mo) and `focus-15` (66mo) assert minute counts; the "2 to 3 minutes per year of age" rule behind such numbers has no traceable peer-reviewed source. Reframe toward task persistence on self-chosen activities, or re-anchor against a normed dataset (NIH Toolbox) before trusting minutes. Highest-priority bank edit this corpus surfaces.
2. **Intelligibility is later than the classic rule (01).** Objective data (Hustad 2021): median 50% multiword intelligibility to strangers at 34 months, 75% at 46, 90% at 62. `language.short-sentences` (38mo, "strangers mostly understand") sits between the 50% and 75% points: defensible vs CDC's 36-month placement, but "mostly" reads closer to the 46-month mark. Review wording or anchor at next bank bump.
3. **K counting to 100 is ambitious (02).** CCSS puts it at end of K (72mo); Clements and Sarama put typical mastery nearer 84mo. The bank's math ladder should not treat 72 as the typical age without the trajectory caveat.
4. **Months-ahead has instrument limits (03, 10).** ORF stops discriminating near 146 WCPM after grade 5, F and P plateaus at Z, and typical MAP growth falls from 12 RIT per year (grade 1) to 1 to 2 (grades 7 to 10). Two product consequences: literacy months-ahead cannot lean on fluency past about 132mo, and any "a year of growth" language must scale by age band or it is statistically wrong. Flat middle-school reading scores are typical and must never read as a problem (display law 4 already forbids it).
5. **No national grade placement exists for MS/HS science or any social studies content (05, 06).** NGSS fixes grades only K to 5; C3 works in bands by design. Skills progressions are safe anchors; topic placement (state history in grade 4, ancients in grade 6) is convention with huge legitimate variation, especially among homeschoolers. Items anchored on topic placement should be avoided entirely.
6. **CDC 2022 anchors are 75th percentile "by" ages (01).** They run conservative relative to average-age norms. That is the safe direction for the bank, but mixing CDC anchors with median-based anchors (Clements and Sarama, Hustad) in one ladder mixes percentile framings; note the framing per item when porting.
7. **Spelling-stage age bands describe untutored development (04).** Gentry's own instructional expectations run 1 to 2 years earlier than the classic bands. Anchor spelling items to instructed expectations (CCSS L.x.2 placements), not the stage-theory ages.
8. **No numeric fact-fluency rate is defensible (02).** Published CBM criteria disagree by 2x or more. The bank's existing qualitative "knows from memory" wording is correct; never port a per-minute cut.
9. **2024 framework editions moved to bands (07).** SHAPE PE and NHES now span grades; the 2014 arts standards are the finest-grained ladder left in that lane. Motor items should respect the observed-mastery data (only 26.7% of 12-year-olds show a mature overhand throw), not the theoretical potential ages.
10. **Norms-edition hygiene (10).** NWEA's 2025 re-norm shifted percentiles; the budget CAT still uses 1986 norms. Any ingested score needs its norming edition recorded, or percentile talk is meaningless.

### Porting status (updated 2026-07-06, bank v2026.07.2)

The first porting pass landed the same day as the corpus. In `packages/core/src/map/content.ts`, bank version 2026.07.1 to 2026.07.2 (188 to 212 items, 7 new sources: hustad, crowe-mcleod, wellman, lowenfeld, ufli, cee, hoff-core):

- Correction 1 applied: `focus-5` and `focus-15` reworded to task-persistence framing, no minute claims anywhere in the bank.
- Correction 2 applied: `language.short-sentences` reworded to familiar-listener framing at 38mo; new `language.stranger-clear` at 46mo carries the stranger-intelligibility anchor (Hustad 75% multiword), and `language.clear-sounds` at 62mo carries consonant acquisition (Crowe and McLeod).
- Correction 3 applied: `math.counts-to-100` moved 72 to 78 (dual-cited CCSS + trajectories); new `math.makes-10` keeps a K-anchor at 72.
- Evidence-based anchor move: `gross_motor.rides-bike` 108 to 84 (AAP 4-to-7 window).
- 24 new ladder items across 13 domains, all from lane porting notes, including the theory-of-mind anchor (`social_emotional.false-belief`, 56mo), the Lowenfeld drawing anchors, the Tabors-based spanish exposure rungs, and gap-filling rungs in math, phonics, science, social studies, music, EF, and self-care.
- Deliberately NOT ported, per section 3: any per-minute fluency rate, any topic-placement item, legal-age items, FitnessGram zones.
- Founder call (same morning): the computer science domain SHIPPED as the 16th domain, `computer_science`, exposure-based like spanish (tracks what the family does, never months-ahead), 8 items on CSTA 2017 band anchors used as ladder rungs. Re-verify wording against CSTA 2026 when it publishes this month; an AI-literacy rung (UNESCO 2024 / AI4K12) is queued for that same pass. Bank is 220 items across 16 domains.

## 4. Reporting-layer calibration (lane 10 distilled)

- Months-ahead ruler: adjacent MAP grade means are roughly one year apart (for example 13 RIT between grades 3 and 4 fall math), so "about a year ahead" should correspond to about one grade-mean gap at that age, shrinking with age.
- Growth praise scales by band: 6 RIT is a real year for a 4th grader in reading; 2 RIT is a real year for an 8th grader.
- Grade-equivalent scores never become placement language (a GE of 6.2 for a 4th grader is performance on 4th-grade material, per the publishers themselves).
- State thresholds that carry legal weight (ND 30th/50th percentile, OR 15th, VA/WV 4th stanine): known to the reporting layer, always "not legal advice, product re-verifies before display."
- National distribution context: NAEP 2024 below-Basic shares are at record highs (reading grade 4: 40%, grade 8: 33%), and NAEP Proficient is explicitly not "grade level." Useful internally for honest calibration; none of this vocabulary reaches parents.

## 5. Consolidated follow-up queue

Status update, wave 2 (same day): lanes 11 to 16 executed most of this queue. Remaining and new items below; strikethrough-style DONE markers kept so the history reads.

1. DONE (partially): CSTA 2026 publishes July 13 to 15 at the New Orleans conference (lane 15). Draft 3.0 structure is captured (five renamed concepts, only Data and Analysis survives; six specialty areas). Re-verify the computer_science items against the FINAL text the week of July 13.
2. DONE (partially): NAEP 2024 grade 4 math average is 237; NAEP civics grade 8 cuts are Basic 134 / Proficient 178 / Advanced 213 (lane 15). NAEP 2026 results land early 2027 (math/reading) and summer 2027 (civics/history): calendar item.
3. OPEN: grades 7 to 8 ORF rows (Read Naturally 2023 compiled norms) still untranscribed; lane 11 added the spread math for grades 1 to 6.
4. DONE: NWEA 2025 percentile-to-RIT tables captured for reading and math, grades K to 11, spring (lane 11). Fall/winter rows and growth percentiles remain cheap follow-ups.
5. DONE (path found): NIH Toolbox is the right instrument family; public norming papers captured (lane 11), but per-age mean/SD tables sit in paywalled manuals: founder budget item.
6. OPEN (founder): paywalled instruments unchanged (ASQ-3, CDI percentile manuals or the wordbankr R extraction, Beery, Star, Graham 1998 primary, Dawson and Guare primary, Gesell, TGMD-3 and PDMS-2 manuals, FitnessGram admin manual).
7. DONE: WHO guideline verified, music stages (Gordon, Rutkowski) captured with their authors' approximation caveats, Washington SEL standards captured as the modern graded comparison, World Book missing grades fetched, Ohio hours table recovered (Novice High at about 270 to 300 hours), ELOF by-60-months indicators completed for all domains, tooth brushing (independent at 7 to 8, AAP + AAPD), monkey bars (CPSC), and the 50-state sweep is lane 16. All in lane 15 except the states (16).
8. OPEN: cross-lane dedupe before porting (dressing/feeding in 01/07/08, money in 02/08, keyboarding in 04/09). Pick one owner per item at port time.
9. NEW: supersession, lane 16 corrects lane 10: Florida's statute contains NO percentile line (the unverified "35th" does not exist in F.S. 1002.41), and Ohio abolished its homeschool assessment regime entirely in October 2023. Lane 16 is now the canonical state table.
10. NEW: the AAP replaced its 2016 media policy in February 2026 ("Digital Ecosystems, Children, and Adolescents": displacement model, no hour caps). Any future screen-related product copy tracks the new statement (lane 15).
11. NEW: upgrade candidates from the crosswalks: Teaching Textbooks mid-ladder placement PDFs, per-level scope transcriptions for AAR/AAS and Singapore, Horizons' own ahead-positioning statement, Abeka primary scope pages (lanes 13, 14 dry wells).

## 6. Wave 2 coverage (lanes 11 to 16, 2026-07-06)

| Lane | What it adds | Headline |
|---|---|---|
| 11 distributions | Percentile curves: CDI vocabulary, ORF spread, NWEA percentile-to-RIT (K to 11), Lexile/Quantile rows, Hustad curves, NIH Toolbox path, tolerance-band method with 13 bank-item windows | A 25th-percentile 6th grader sits 29 months of median growth from the median and is fully typical: single-anchor displays understate normal spread |
| 12 ND and 2e | Trajectory evidence per condition, 16-domain tolerance table, copy guidance | "Caught up" is always skill-specific (Torgesen); Barkley's 30% EF lag is his own rounding, the peer-reviewed anchor is Shaw's ~3-year cortical delay |
| 13 math crosswalk | 10 curricula, 82 level rows mapped to bank items | Saxon's own guide reads 5/4 as grade 4 default; Math-U-See diverges in ORDER, not just pace: map by items, never by grade |
| 14 ELA crosswalk | 12 curricula, 52 level rows mapped to bank items | AAR 4, ETC 8, and LOE Essentials all end at the same two bank rungs (112/130mo): "finished phonics" means the same map position across brands |
| 15 refresh sweep | 14 of 14 queue items resolved | AAP media policy replaced Feb 2026; CSTA final text lands July 13 to 15 |
| 16 state assessments | All 51 jurisdictions, 8 threshold states quoted from statute | About 26 of 51 jurisdictions have some compulsory assessment artifact; Florida has no percentile line; Ohio abolished testing in 2023 |

Tooling shipped the same day (see build log): per-item `standards` codes in the bank (89 of 220 items), `pnpm check:sources` (source liveness + verified-date manifest + revision watchlist; already caught the CDC and ELOF host moves), and `pnpm report:norms` (the Homa-native re-norm loop over our own stored answers, aggregate-only). Runbooks: `docs/homa-planning/runbooks/benchmark-freshness.md`, `docs/homa-planning/runbooks/map-renorm.md`.

## 7. Maintenance

Every lane records the edition and year of every framework it cites. Re-verify a lane before porting anchors from it; prefer refreshing this corpus alongside any MAP_BANK_VERSION bump. `pnpm check:sources` automates the liveness and staleness half of this. Standards known to be mid-revision as of today: CSTA (final text July 13 to 15, 2026), NCAS (review process underway), CEE economics (3rd edition 2025), AAP media guidance (replaced February 2026).
