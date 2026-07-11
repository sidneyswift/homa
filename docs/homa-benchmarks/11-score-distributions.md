# Score distributions and tolerance bands

> Historical research snapshot, 2026-07-06. This file preserves the evidence and analysis captured on that date. It is not current product, legal, provider, standards, or production guidance. Re-verify volatile facts and source freshness before porting any claim into Homa.

**Date:** 2026-07-06
**Lane:** Distributions 11, part of the ages 2 to 16 national benchmark corpus (see README.md in this folder)
**Method:** Web search plus direct fetches of primary norm sources (Wordbank and Frank et al. 2017, Hasbrouck and Tindal 2017 as already held in lane 03, the NWEA 2025 MAP Growth Norms Technical Manual, hub.lexile.com, the CDC growth chart methodology page, the NIH Toolbox validation monograph and scoring manual, Hustad et al. 2021), capturing percentile curves and spreads rather than point anchors. Every derived number shows its derivation; nothing is from memory.

**Key findings:**

- Spread is the story, not the point. At every reading grade the 25th to 75th percentile fluency band is wide, and because median growth slows with age, that same middle-50% band represents about 7 months of median growth in grade 1 but about 29 months by grade 6 (derivation in section 2). A child at the 25th percentile is squarely inside the normal range, not "a few weeks behind".
- The MacArthur-Bates CDI shows enormous, stable early-vocabulary variability: for American English 24-month-olds the mean productive vocabulary is 319 words with a standard deviation of 175 (coefficient of variation 0.55), and the mean absolute deviation from the median runs close to the median itself through most of the second year (Wordbank, Frank et al. 2017).
- Hustad et al. 2021 publishes true percentile curves (5th, 10th, 50th, 90th, 95th) for speech intelligibility by age; the 75% multiword threshold is reached at 46 months by the median child but not until 61 months by the 5th percentile child, a 15-month typical-to-low window.
- NWEA (2025 norms), Lexile, and Quantile all publish percentile-to-score tables that Homa can invert into month-width tolerance bands; the spreads are large and widen with grade, and NWEA's own reading percentile spacing collapses after about grade 8 (the same discrimination ceiling lane 03 found in oral fluency).
- The replacement path for the debunked "minutes per year" attention rule (corpus lane 08 section 5) is the NIH Toolbox: it reports Flanker and DCCS as age-corrected standard scores (mean 100, standard deviation 15) against a national norming sample, not minutes. Public single-year mean and SD tables were not located in free form (logged as a gap), but the framework itself is the honest anchor.
- Pediatric growth charts (CDC and WHO, LMS method) are the percentile-display precedent parents already read fluently, and the Denver II item bar (25th, 50th, 75th, 90th percentile attainment ages per skill) is the classic developmental-distribution precedent Homa's ladder already resembles.
- A defensible tolerance rule falls straight out of these tables: use the age at which the 75th percentile child attains a skill as the earliest a nudge may fire, and treat the 25th to 75th attainment window as "typical" (section 9), which for every worked example here is much wider than the single anchor month suggests.

---

## 1. Vocabulary distributions (MacArthur-Bates CDI via Wordbank)

**Sources:** Frank, Braginsky, Yurovsky, and Marchman, ["Wordbank: an open repository for developmental vocabulary data"](https://mikabr.io/files/papers/wordbank.pdf), Journal of Child Language 2017 (accessed 2026-07-06); the open [Wordbank Book, chapter 5 "Vocabulary Size"](https://langcog.github.io/wordbank-book/vocabulary.html) (accessed 2026-07-06); [wordbank.stanford.edu](http://wordbank.stanford.edu/) (accessed 2026-07-06). The CDI comes in two forms: Words and Gestures (8 to 18 months) and Words and Sentences (16 to 30 months); productive vocabulary is the count of words a parent reports the child says.

**Confidence: High** for the variability statistics and the milestone-age spread table (read directly from the paper and book); the per-month fitted percentile curve values (10/25/50/75/90) are generated inside Wordbank's interactive tool and were not transcribable from the fetched text (logged in dry wells).

### 1a. How the Wordbank norms are built (FACT)

Wordbank fits percentile curves (default 10th, 25th, 50th, 75th, 90th) to raw production scores using quantile regression with monotonic polynomial splines (the `gcrq` function of the `quantregGrowth` R package). The authors stress these are descriptive research norms, not clinically validated cutoffs, and explicitly caution against clinical use of ad-hoc percentiles ([Frank et al. 2017](https://mikabr.io/files/papers/wordbank.pdf), accessed 2026-07-06).

### 1b. Central tendency (FACT)

In every language in the database, the median child produces about 50 words between 16 and 20 months on Words and Sentences ([Wordbank Book ch. 5](https://langcog.github.io/wordbank-book/vocabulary.html), accessed 2026-07-06). Curves then appear to level off between 24 and 30 months, which the authors attribute to the instrument's ceiling (the form lists a fixed word set), not to a true slowdown in learning.

### 1c. Variability (FACT, American English production, Words and Sentences)

| Statistic | Value | What it means |
|---|---|---|
| Mean productive vocabulary at 24 months | 319 words | On a 680-word form |
| Standard deviation at 24 months | 175 words | Coefficient of variation 0.55 |
| Shape of the 24-month distribution | Far from normal; many children near the floor, almost as many near the ceiling | A single "typical 2-year-old vocabulary" badly misdescribes the group |
| MADM (median absolute deviation from the median, divided by the median), second year | Close to 1.0 | The typical distance from the median is about as large as the median itself |

Source: [Wordbank Book ch. 5](https://langcog.github.io/wordbank-book/vocabulary.html) (accessed 2026-07-06). The authors' own illustration: a group of three children producing 30, 100, and 170 words has a MADM of 0.99, versus 0.44 for a tighter 70, 100, 130 group; early vocabulary looks like the former.

### 1d. Milestone-age spreads (FACT, but Norwegian CDI plus a Norwegian walking survey)

Table 5.1 of the Wordbank Book contrasts the spread of language milestones against motor onset. These specific rows come from Norwegian data (production and comprehension milestones and a 47,515-respondent Norwegian walking survey, Storvold et al. 2013), so they are labeled as such; the shape of the finding (language milestones spread far wider than walking) is presented as cross-linguistically general.

| Milestone | 25th percentile age (mo) | 75th percentile age (mo) | Width (mo) | Width as proportion of age |
|---|---|---|---|---|
| Walks independently | 12 | 14 | 2 | 0.15 |
| Produces 10 words | 13 | 16 | 3 | 0.21 |
| Understands 50 words | 10 | 15 | 5 | 0.42 |
| Produces 50 words | 17 | 20 | 3 | 0.17 |
| Produces 100 words | 18 | 23 | 5 | 0.25 |
| Produces 200 words | 20 | 26 | 6 | 0.26 |

Source: [Wordbank Book ch. 5, Table 5.1](https://langcog.github.io/wordbank-book/vocabulary.html) (accessed 2026-07-06). INFERENCE for Homa: motor milestones like walking have tight windows (a nudge that fires a month late is defensible), but vocabulary milestones have windows two to three times wider even as a proportion of age, so any language-count anchor needs a much more generous tolerance band before it means anything.

## 2. Oral reading fluency spread (derived from Hasbrouck and Tindal 2017)

Corpus lane 03 section 3 already holds the full 30-row Hasbrouck and Tindal 2017 table (grades 1 to 6, five percentiles, three seasons), verified there against the [BRT technical report](https://www.brtprojects.org/wp-content/uploads/2017/10/TechRpt_1702ORFNorms_Fini.pdf) and the [Read Naturally reproduction](https://www.readnaturally.com/article/hasbrouck-tindal-oral-reading-fluency-data-2017) (both accessed 2026-07-06). This section does not re-transcribe it; it derives the spread picture the point anchors hide.

**Confidence: High** (arithmetic on already-verified numbers; derivation shown).

### 2a. The middle-50% spring band and how many months of median growth it spans (INFERENCE, derived)

Derivation: IQR width = (75th percentile spring WCPM) minus (25th percentile spring WCPM). Median monthly growth rate = (spring 50th minus fall 50th) divided by 8 instructional months, except grade 1 which uses (spring minus winter) over 4 months, matching the source's own growth convention. "Months of median growth the band spans" = IQR width divided by that monthly rate.

| Grade | End-of-grade anchor (mo) | 25th pct spring WCPM | 75th pct spring WCPM | IQR width (WCPM) | Median growth (WCPM/mo) | IQR width in months of median growth |
|---|---|---|---|---|---|---|
| 1 | 84 | 34 | 91 | 57 | 7.8 | 7.4 |
| 2 | 96 | 72 | 124 | 52 | 6.2 | 8.3 |
| 3 | 108 | 91 | 139 | 48 | 3.6 | 13.2 |
| 4 | 120 | 105 | 160 | 55 | 4.9 | 11.3 |
| 5 | 132 | 119 | 169 | 50 | 3.1 | 16.0 |
| 6 | 144 | 122 | 173 | 51 | 1.8 | 29.1 |

Reading of the derivation (FACT about the arithmetic, INFERENCE about the product meaning): the raw IQR width stays roughly flat (48 to 57 WCPM) across grades, but because median growth decelerates from about 7.8 WCPM/month in grade 1 to about 1.8 in grade 6, that same band represents an ever-larger slice of "a year of growth". By grade 6 the middle 50% of readers span more than two years of median progress. A grade-6 child at the 25th percentile is not meaningfully distinguishable from typical on this instrument.

### 2b. How far below or above the median the quartiles sit, in months (INFERENCE, derived)

Same monthly rates as 2a. Months below median = (50th minus 25th) / rate; months above = (75th minus 50th) / rate.

| Grade | Anchor (mo) | 25th pct sits this many months of growth below median | 75th pct sits this many months above median |
|---|---|---|---|
| 1 | 84 | 3.3 | 4.0 |
| 2 | 96 | 4.5 | 3.9 |
| 3 | 108 | 5.8 | 7.5 |
| 4 | 120 | 5.7 | 5.5 |
| 5 | 132 | 8.7 | 7.4 |
| 6 | 144 | 13.3 | 15.0 |

INFERENCE for Homa: if a fluency-anchored literacy item uses the 50th percentile spring WCPM as its typicalMonths anchor, the low edge of the normal range is roughly 3 months of growth away in grade 1 but about 13 months away by grade 6. A single fixed "grace period" in months is wrong; the grace period should widen with age, and past about grade 5 (132mo) fluency should not drive months-behind at all.

### 2c. DIBELS 8 cut points as risk thresholds, next to the percentile picture (FACT)

Corpus lane 03 section 4 holds the full DIBELS 8 (2020 goals, University of Oregon) ORF benchmark table, verified from the [official PDF](https://dibels.uoregon.edu/sites/default/files/2024-01/dibels8_benchmark_goals.pdf) (accessed 2026-07-06). DIBELS goals are criterion-referenced risk cuts, not percentiles: the "minimum for core support" (green) lower bound, and the blue (negligible risk) threshold. Spring ORF, minimum-core / blue, next to the Hasbrouck and Tindal spring percentiles for the same grade:

| Grade | DIBELS 8 spring min-core / blue | H and T spring 25th pct | H and T spring 50th pct | Reading of the gap |
|---|---|---|---|---|
| 1 | 39 / 76+ | 34 | 60 | Min-core sits between the 25th and 50th percentile |
| 2 | 94 / 128+ | 72 | 100 | Min-core is just below the median |
| 3 | 114 / 136+ | 91 | 112 | Min-core sits right at the median |
| 4 | 125 / 159+ | 105 | 133 | Min-core between 25th and 50th |
| 5 | 137 / 157+ | 119 | 146 | Min-core between 25th and 50th |
| 6 | 141 / 160+ | 122 | 146 | Min-core near the median |

FACT plus INFERENCE: DIBELS's "minimum for adequate progress" generally lands between the 25th and 50th Hasbrouck and Tindal percentiles, confirming lane 03's point that the two tables answer different questions. "At or above the DIBELS green line" is a low bar (roughly 25th to 50th percentile), so being below the 50th percentile is emphatically not the same as being at risk. Homa should keep the risk framing (a floor) and the peer framing (a distribution) separate, and surface neither as pass or fail to parents.

## 3. NWEA MAP achievement percentiles

**Source:** NWEA (HMH Education Company), [2025 MAP Growth Norms Technical Manual, version 2025.1.0](https://www.nwea.org/resource-center/white-paper/88182/MAP-Growth-Norms_NWEA_Technical-Manual.pdf/), Appendix B student achievement percentile tables (downloaded and text-extracted 2026-07-06). Norms derived from about 116 million scores of 13.8 million students, fall 2022 through spring 2024. This complements lane 10, which held the RIT means and growth norms but only the means (not the percentile-to-RIT tables). RIT is an equal-interval scale, so RIT differences are legitimate to subtract.

**Confidence: High** (every cell parsed directly from the manual PDF text). Edition: 2025 norms. Fall assumes 4 instructional weeks, winter 20, spring 32.

### 3a. Spring student achievement percentiles, Reading (RIT)

Grade to anchor-month convention: K=72, 1=84, 2=96, 3=108, 4=120, 5=132, 6=144, 7=156, 8=168, 9=180, 10=192, 11=204.

| Pct | K | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 136 | 148 | 159 | 171 | 179 | 186 | 191 | 193 | 196 | 194 | 195 | 194 |
| 25 | 143 | 157 | 170 | 182 | 190 | 197 | 201 | 203 | 206 | 205 | 206 | 205 |
| 50 | 152 | 168 | 182 | 194 | 202 | 208 | 212 | 215 | 218 | 217 | 218 | 218 |
| 75 | 161 | 178 | 193 | 206 | 214 | 220 | 223 | 226 | 229 | 230 | 231 | 230 |
| 90 | 168 | 188 | 204 | 217 | 225 | 230 | 233 | 237 | 240 | 241 | 242 | 242 |

### 3b. Spring student achievement percentiles, Mathematics (RIT)

| Pct | K | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 141 | 157 | 167 | 177 | 187 | 192 | 197 | 199 | 203 | 202 | 203 | 203 |
| 25 | 149 | 165 | 177 | 188 | 198 | 204 | 208 | 211 | 215 | 215 | 216 | 217 |
| 50 | 158 | 175 | 187 | 199 | 210 | 216 | 220 | 224 | 229 | 229 | 231 | 233 |
| 75 | 167 | 185 | 198 | 211 | 222 | 228 | 233 | 237 | 242 | 243 | 246 | 249 |
| 90 | 174 | 193 | 208 | 221 | 233 | 240 | 244 | 249 | 255 | 256 | 260 | 263 |

### 3c. Reading of the tables (INFERENCE, derived)

- The 10th-to-90th spread in reading is about 32 RIT in kindergarten (136 to 168) and about 40 in grade 2 (159 to 204), then compresses to about 46 to 48 in the middle grades before the medians themselves flatten: the median barely moves from grade 8 (218) to grade 11 (218). This is the same discrimination ceiling lane 03 found in oral fluency, now visible in the untimed adaptive test.
- Math keeps separating longer: the median climbs from 229 (grade 8) to 233 (grade 11) and the 90th percentile from 255 to 263, so math has more headroom to detect "ahead" at the top of the range than reading does.
- Months-ahead ruler (extends lane 10): one grade of median reading growth in the early grades is about 12 to 14 RIT (K to 1: 152 to 168), but only about 1 RIT per grade after grade 8. A fixed "RIT per year of growth" is wrong; scale it by band. The 25th-to-75th percentile RIT band at a given grade (for example grade 4 reading, 190 to 214, a 24-point spread) is roughly two grade-levels of median growth wide in the early grades, so being at the 25th percentile is well inside typical.

## 4. Lexile and Quantile distributions

**Source:** [hub.lexile.com Lexile grade level charts](https://hub.lexile.com/lexile-grade-level-charts/) and [Quantile grade level charts](https://hub.lexile.com/quantile-grade-level-charts/) (both accessed 2026-07-06). National student norms from over 3 million US students tested 2010 to 2019. "BR" (Beginning Reader) codes are below 0L: BR200L means 200 units below 0L, so a smaller number after BR is stronger. "EM" (Emerging Mathematician) codes work the same way below 0Q. Lane 10 spot-checked a few of these medians; this section captures the full 10th to 90th percentile spring rows.

**Confidence: High** (transcribed from the vendor hub tables); **Medium** on currency (the underlying reader norms study is 2010 to 2019 and MetaMetrics refreshes the interactive charts).

### 4a. Lexile reader measures, spring, by grade (percentiles)

| Grade | Anchor (mo) | 10th | 25th | 50th | 75th | 90th |
|---|---|---|---|---|---|---|
| K | 72 | BR400L | BR310L | BR160L | BR5L | 145L |
| 1 | 84 | BR235L | BR35L | 165L | 365L | 565L |
| 2 | 96 | 60L | 245L | 425L | 605L | 790L |
| 3 | 108 | 310L | 480L | 645L | 810L | 980L |
| 4 | 120 | 550L | 700L | 850L | 1005L | 1155L |
| 5 | 132 | 645L | 795L | 950L | 1100L | 1255L |
| 6 | 144 | 720L | 875L | 1030L | 1180L | 1335L |
| 7 | 156 | 790L | 940L | 1095L | 1250L | 1405L |
| 8 | 168 | 845L | 1000L | 1155L | 1310L | 1465L |
| 9 | 180 | 895L | 1050L | 1205L | 1360L | 1515L |
| 10 | 192 | 940L | 1095L | 1250L | 1410L | 1565L |

FACT: the 10th-to-90th spread is roughly 545L wide in kindergarten and stays about 550L to 720L wide every grade through grade 10, while the median climbs about 150L per grade in the early grades and about 100L per grade later. INFERENCE: a single grade's worth of median Lexile growth is smaller than the within-grade 25th-to-75th spread at every grade, so a child one "grade" below the median band is still inside the normal range for their own grade.

### 4b. Quantile measures, spring, by grade (percentiles)

| Grade | Anchor (mo) | 10th | 25th | 50th | 75th | 90th |
|---|---|---|---|---|---|---|
| K | 72 | EM400Q | EM265Q | EM115Q | 35Q | 190Q |
| 1 | 84 | EM140Q | EM10Q | 120Q | 255Q | 390Q |
| 2 | 96 | 55Q | 180Q | 310Q | 435Q | 565Q |
| 3 | 108 | 225Q | 350Q | 470Q | 595Q | 725Q |
| 4 | 120 | 370Q | 490Q | 615Q | 740Q | 865Q |
| 5 | 132 | 475Q | 595Q | 715Q | 835Q | 960Q |
| 6 | 144 | 580Q | 700Q | 820Q | 945Q | 1070Q |
| 7 | 156 | 665Q | 785Q | 910Q | 1030Q | 1155Q |
| 8 | 168 | 740Q | 865Q | 985Q | 1110Q | 1235Q |
| 9 | 180 | 810Q | 930Q | 1055Q | 1175Q | 1305Q |
| 10 | 192 | 870Q | 990Q | 1115Q | 1240Q | 1365Q |

FACT: the Quantile 10th-to-90th spread is about 590Q wide at kindergarten and holds around 500Q to 590Q every grade, with the median rising about 120Q to 145Q per grade. The math scale, like NWEA math, keeps separating across the whole range rather than plateauing.

## 5. The growth-chart mental model (design precedent)

**Source:** [CDC growth charts, WHO data files and LMS methodology](https://www.cdc.gov/growthcharts/who-data-files.htm) (accessed 2026-07-06). Confidence: High.

FACT: pediatric growth charts are the percentile display US parents already read. CDC uses the WHO charts for ages 0 to 24 months and the CDC charts for ages 2 to 20 years. Each chart plots smoothed percentile curves at the 3rd, 5th, 10th, 25th, 50th, 75th, 85th (for BMI and weight-for-stature), 90th, 95th, and 97th percentiles by sex and single month of age. The curves are generated from three parameters per age, the LMS values: L (the Box-Cox power that handles skew), M (the median), and S (the generalized coefficient of variation). Any measurement converts to an exact percentile or z-score:

- To get a value X at percentile z: X = M(1 + LSZ)^(1/L) when L is not 0, or X = M exp(SZ) when L is 0.
- To get a child's z-score from a measurement X: Z = ((X/M)^L minus 1) / (LS) when L is not 0.

The z-scores that map to the standard percentile lines: 1.645 is the 95th, 1.282 the 90th, 0.674 the 75th, 0 the 50th, and their negatives the 25th, 10th, 5th.

INFERENCE for Homa (design precedent, not a data source): the growth chart teaches three things Homa's map can borrow. First, parents already accept that a child can sit at, say, the 25th percentile and be perfectly healthy; the curve normalizes spread. Second, position on a curve is shown without a pass or fail line (there is no "failing" the growth chart), which matches Homa's anti-guilt display law. Third, the shape of the curve (steep early, flattening later) makes it visually obvious that the same raw gain means different things at different ages, exactly the point sections 2 and 3 make numerically. Homa should not compute BMI or health percentiles; the value here is purely the display metaphor.

## 6. Attention and executive function norms (NIH Toolbox)

**Sources:** Zelazo et al., ["NIH Toolbox Cognition Battery (CB): Measuring Executive Function and Attention"](https://www.srcd.org/sites/default/files/file-attachments/zelazo_bauer_pre-published.pdf), Monographs of the Society for Research in Child Development 2013 (accessed 2026-07-06); [NIH Toolbox Scoring and Interpretation Manual](https://www.epicrehab.com/epic/documents/crc/crc-201307-nih-toolbox-scoring-and-interpretation-manual%209-27-12.pdf) (accessed 2026-07-06); [NIH TOOLBOX CB introduction and pediatric data, PMC3954750](https://pmc.ncbi.nlm.nih.gov/articles/PMC3954750/) (accessed 2026-07-06).

This is the replacement path flagged in corpus lane 08 section 5: the "2 to 3 minutes per year of age" attention rule is unsourced folklore, and the honest anchor for inhibitory control and cognitive flexibility is a normed instrument.

**Confidence: High** on the scoring framework and developmental sensitivity; **Low** on any public single-year mean and SD table (not located in free form, logged in dry wells). No minutes-by-age table exists here or anywhere defensible.

### 6a. The two executive-function measures (FACT)

| Measure | What it taps | Age range | Score anatomy |
|---|---|---|---|
| Flanker Inhibitory Control and Attention Test | Inhibitory control within selective visual attention | 3 to 85 years | Accuracy vector 0 to 5 and reaction-time vector 0 to 5, combined into a computed score 0 to 10; if accuracy is at or below 80%, only accuracy counts |
| Dimensional Change Card Sort (DCCS) | Cognitive flexibility (task switching) | 3 to 85 years | Same accuracy-plus-reaction-time computed score, 0 to 10 |

### 6b. How the norms are reported (FACT)

The NIH Toolbox converts the computed score to age-corrected standard scores against a nationally representative norming sample: a mean of 100 and a standard deviation of 15, where 100 is the national average for the test-taker's own age (3-year-olds compared only to other 3-year-olds). A score of 115 is one SD above the age mean (about the 84th percentile). This is the crucial contrast with the folklore: attention and inhibition are normed as standard scores against same-age peers, never as an absolute number of minutes.

### 6c. Developmental sensitivity (FACT)

Across ages 3 to 15, both measures correlate strongly with age, and a cubic model fit best (R-squared about 0.76 for DCCS and 0.77 for Flanker). Correlations with age are higher for younger children (3 to 6) than older (8 to 15), meaning these skills change fastest in the preschool window and then differentiate. Qualitative anchor from the same literature: most 3-year-olds perseverate on the DCCS post-switch (keep sorting by the old rule), whereas most 5-year-olds switch flexibly.

INFERENCE for Homa: this justifies corpus lane 08's correction. The bank's `executive_function.focus-5` (30mo) and `focus-15` (66mo) items were already reworded to task-persistence framing with no minute claims; the NIH Toolbox confirms that the defensible signal is behavioral (can the child hold a rule, switch tasks, inhibit a response) reported against age, not a stopwatch. If Homa ever wants a quantified anchor, the Toolbox standard-score framework (mean 100, SD 15, age-corrected) is the model to imitate, not minutes.

## 7. Motor distributions (TGMD-3, Denver II)

**Sources:** [TGMD-3 product and norming description, PRO-ED](https://proedinc.com/products-14805.html) and [WPS](https://www.wpspublish.com/tgmd-3-test-of-gross-motor-development-third-edition) (accessed 2026-07-06); the TGMD comparison study [PMC11978908](https://pmc.ncbi.nlm.nih.gov/articles/PMC11978908/) (accessed 2026-07-06); Frankenburg et al. 1992, the Denver II, via [disabilitymeasures.org DENVER II overview](http://disabilitymeasures.org/denverii/) and a [DDST-II standardization paper](https://doi.org/10.1111/j.1365-2214.2011.01332.x) (both accessed 2026-07-06).

**Confidence: High** on test structure, sample sizes, and threshold conventions; the actual per-age norm score tables sit in the paywalled examiner's manuals and were not obtained (logged in dry wells).

### 7a. TGMD-3 (FACT)

| Property | Value |
|---|---|
| Author and edition | Dale A. Ulrich, third edition, norms collected 2014 to 2017 |
| Age range | 3 years 0 months to 10 years 11 months |
| Normative sample | 862 US children, 24 states, stratified to the 2017 US Census |
| Structure | 13 fundamental motor skills in two subtests (6 Locomotor, 7 Ball Skills), combined into a Gross Motor composite |
| Reported scores | Scaled scores, percentile ranks, age equivalents, Gross Motor Index |
| Common classification thresholds | At or below the 25th percentile = below average; at or below the 5th percentile = developmental delay; 6th to 25th = at risk (thresholds vary by study) |

FACT with product relevance: the comparison study found that among 3-to-5-year-olds, 84.5% scored below the 25th percentile on the older TGMD-2 and 63.3% on the TGMD-3, and children score about 7% higher on the TGMD-3 than the TGMD-2 for the same raw skill, evidence of a generational decline in young children's motor scores between the 2000 and 2019 norming samples. INFERENCE: this is the same norms-edition hygiene warning as NWEA (lane 10); a motor percentile is meaningless without its edition, and the observed-mastery reality (corpus lane 07: only about 27% of 12-year-olds show a mature overhand throw) should govern motor anchors, not theoretical potential ages.

### 7b. Denver II (FACT, the classic developmental-distribution precedent)

The Denver II (Frankenburg et al. 1992, restandardized on over 2,000 children) represents each of its 125 items as a horizontal bar marking the ages at which 25%, 50%, 75%, and 90% of the standardization sample passed that item, across four domains (personal-social, fine motor-adaptive, language, gross motor). The worked example from the manual, the item "walks well":

| Percentile | Age the sample reached it |
|---|---|
| 25% | just above 11 months |
| 50% | 12 to 13 months |
| 75% | about 13.5 months |
| 90% | just before 15 months |

Interpretation rules from the instrument (FACT): an item is a "caution" when the child's age line falls between the 75th and 90th percentile and the child fails it, and a "delay" only when the child fails an item that falls entirely to the left of their age line (that is, past the 90th percentile age). INFERENCE for Homa: this is precisely the tolerance-band logic proposed in section 9, already validated in a 50-year-old pediatric instrument. The 90th percentile attainment age, not the 50th, is where "worth a closer look" begins; everything up to the 75th to 90th band is explicitly normal. Homa's per-item ladder is a Denver bar with one point marked; this lane argues for marking the band.

## 8. Speech intelligibility percentile spread (Hustad et al. 2021)

**Source:** Hustad, Mahr, Natzke, and Rathouz, ["Speech Development Between 30 and 119 Months in Typical Children I"](https://pubs.asha.org/doi/full/10.1044/2021_JSLHR-21-00142), JSLHR 2021 (accessed 2026-07-06). 538 typically developing children; 1,076 naive adult listeners transcribed their speech; intelligibility is the percentage of words transcribed correctly. Corpus lane 01 holds the median thresholds; this section captures the full percentile curves (Table 3) and the threshold-attainment ages (Table 5).

**Confidence: High** (Table 3 and Table 5 transcribed directly, cross-checked against the search-rendered table).

### 8a. Model-estimated intelligibility by percentile and age (FACT, Table 3)

Values are percent intelligible. Single-word and multiword percentiles side by side. The paper publishes the 5th, 10th, 50th, 90th, and 95th percentiles (not 25th/75th).

| Age band (mo) | SW 5th | SW 10th | SW 50th | SW 90th | SW 95th | MW 5th | MW 10th | MW 50th | MW 90th | MW 95th |
|---|---|---|---|---|---|---|---|---|---|---|
| 30 to 35 | 24.0 | 28.7 | 47.5 | 66.9 | 71.8 | 12.3 | 17.0 | 40.9 | 68.4 | 75.1 |
| 36 to 41 | 33.8 | 38.8 | 57.7 | 75.1 | 79.3 | 25.7 | 31.7 | 55.9 | 78.2 | 83.2 |
| 42 to 47 | 43.5 | 48.7 | 66.8 | 82.0 | 85.4 | 40.9 | 47.1 | 68.9 | 86.0 | 89.5 |
| 48 to 53 | 52.1 | 57.2 | 74.0 | 87.1 | 89.9 | 54.7 | 60.4 | 78.6 | 91.2 | 93.6 |
| 54 to 59 | 58.9 | 63.8 | 79.3 | 90.5 | 92.8 | 65.5 | 70.4 | 85.0 | 94.4 | 96.0 |
| 60 to 65 | 64.0 | 68.7 | 83.1 | 92.8 | 94.7 | 73.5 | 77.5 | 89.2 | 96.2 | 97.3 |
| 66 to 71 | 67.8 | 72.3 | 85.7 | 94.4 | 95.9 | 79.2 | 82.6 | 91.9 | 97.3 | 98.1 |
| 72 to 77 | 70.7 | 75.0 | 87.7 | 95.5 | 96.8 | 83.5 | 86.2 | 93.7 | 97.9 | 98.6 |
| 78 to 83 | 72.9 | 77.0 | 89.1 | 96.2 | 97.4 | 86.7 | 89.0 | 95.0 | 98.4 | 98.9 |
| 84 to 89 | 74.5 | 78.6 | 90.2 | 96.8 | 97.9 | 89.1 | 91.0 | 96.0 | 98.7 | 99.1 |
| 90 to 95 | 75.7 | 79.7 | 91.0 | 97.2 | 98.2 | 91.0 | 92.6 | 96.7 | 98.9 | 99.3 |
| 96 to 101 | 76.6 | 80.6 | 91.6 | 97.6 | 98.4 | 92.5 | 93.8 | 97.2 | 99.1 | 99.4 |
| 102 to 107 | 77.3 | 81.2 | 92.1 | 97.8 | 98.6 | 93.7 | 94.7 | 97.6 | 99.2 | 99.4 |
| 108 to 113 | 77.7 | 81.7 | 92.5 | 98.0 | 98.8 | 94.6 | 95.5 | 97.9 | 99.3 | 99.5 |
| 114 to 119 | 78.1 | 82.1 | 92.8 | 98.2 | 98.9 | 95.4 | 96.2 | 98.2 | 99.3 | 99.5 |

SW = single word, MW = multiword. FACT from the paper: variability is wide until about 60 months, then the range narrows; single-word intelligibility keeps a roughly 20-point gap between the 5th and 95th percentiles even after 84 months, while multiword intelligibility becomes nearly homogeneous after 84 months.

### 8b. Age (months) at which children reach each threshold (FACT, Table 5)

| Production type | Threshold | 50th percentile child | 5th percentile child |
|---|---|---|---|
| Single word | 50% intelligible | 31 | 46 |
| Single word | 75% | 49 | 87 |
| Single word | 90% | 83 | 120 or later |
| Multiword | 50% | 34 | 46 |
| Multiword | 75% | 46 | 61 |
| Multiword | 90% | 62 | 87 |

FACT (paper's own conclusion): children should be at least 50% intelligible by 48 months; for median and lower-percentile children, intelligibility keeps growing through 9 years. INFERENCE for Homa: these two columns are a ready-made tolerance window. For multiword 75% intelligibility, the median child is there at 46 months but the 5th percentile child not until 61 months, so a 46-month anchor has a typical-to-low tail of 15 months. A nudge tied to "strangers understand them" should not fire before roughly 61 months.

## 9. From distributions to tolerance bands (method proposal)

This section is INFERENCE throughout, clearly labeled, proposing how Homa could turn the tables above into per-item tolerance windows. Every example is grounded in a table in this file. None of this is a founder decision or shipped policy; it is a design proposal for the reporting layer.

### 9a. The core rule (INFERENCE)

Homa's bank anchors each item at a single `typicalMonths`. A distribution lets us replace that point with a window:

1. Define the typical window as the age at which the 25th percentile child attains the skill (lower edge) to the age at which the 75th percentile child attains it (upper edge). Inside this window, the child is unambiguously typical.
2. Set the nudge threshold at the 90th percentile attainment age (the age by which about 90% of children have the skill), matching the Denver II's own "delay" rule (section 7b). A nudge or "worth practicing" prompt should not fire before that age.
3. Where a source publishes only 50th and 5th percentile attainment ages (Hustad, section 8b), use the 5th percentile age as a conservative nudge threshold, since it is later than the 25th percentile age and therefore safer against false alarms.

This is deliberately asymmetric: it is cheap to under-nudge (wait longer) and expensive to over-nudge (imply a healthy child is behind), which matches BUILD.md law 4 (anti-guilt display) and the corpus rule that medians are never pass or fail lines.

### 9b. Worked examples (INFERENCE, each grounded in a table above)

| Bank-relevant skill | Anchor now (mo) | Proposed typical window | Proposed earliest nudge | Grounded in |
|---|---|---|---|---|
| Multiword speech strangers understand (75% intelligible) | 46 | 46 (50th) to 61 (5th) | 61 mo | Section 8b |
| Multiword speech mostly clear (50% intelligible) | 38 | 34 (50th) to 46 (5th) | 46 mo | Section 8b |
| Nearly all speech sounds clear (90% multiword) | 62 | 62 (50th) to 87 (5th) | 87 mo | Section 8b |
| Produces about 200 words | (no bank item) | 20 to 26 (25th to 75th, Norwegian CDI) | past 26 mo | Section 1d |
| Reads about 60 WCPM (grade 1 spring) | 84 | about 3 months of growth below to 4 above the median (34 to 91 WCPM band) | fluency should not drive a nudge before roughly grade 1 end plus 3 months | Section 2a, 2b |
| Reads about 112 WCPM (grade 3 spring) | 108 | about 6 months below to 7 above (91 to 139 WCPM band) | do not nudge on fluency alone here | Section 2a, 2b |

### 9c. Why the window matters more with age (INFERENCE)

Sections 2, 3, and 4 all show the same pattern: the raw percentile spread stays roughly constant while median growth decelerates, so a fixed anchor becomes less and less discriminating with age. The practical consequence for the tolerance rule is that the month-width of the typical window should grow with age. In fluency terms, the middle-50% band is worth about 7 months of growth in grade 1 but about 29 by grade 6 (section 2a); the tolerance window must widen to match, or Homa will over-flag older children who are entirely typical. Past roughly 132 months, reading fluency and reading percentile spacing both flatten, so months-behind on reading should not be computed there at all (consistent with corpus correction 4).

## Product porting notes

Homa's map bank (`packages/core/src/map/content.ts`, v2026.07.2) anchors each item at a single `typicalMonths`. The distributions in this file can attach a verified tolerance window to the items below. Windows are the defensible "typical to low" range from the cited table; none of this auto-flows, and any ported window must still pass the content laws (no banned words, parent-observable, cited) and be applied only in the reporting layer, never as a pass or fail line. Windows are labeled with the exact source.

| Bank item (anchor) | Proposed tolerance window | Distribution source (section) |
|---|---|---|
| `language.short-sentences` (38mo) | 34 to 46 mo (multiword 50% intelligible, 50th to 5th percentile) | Hustad 2021, section 8b |
| `language.stranger-clear` (46mo) | 46 to 61 mo (multiword 75% intelligible, 50th to 5th) | Hustad 2021, section 8b |
| `language.clear-sounds` (62mo) | 62 to 87 mo (multiword 90% intelligible, 50th to 5th) | Hustad 2021, section 8b |
| `language.two-words` (26mo) | roughly 20 to 26 mo (produces 200 words, 25th to 75th, Norwegian CDI proxy for word-combination stage) | Wordbank Table 5.1, section 1d (label as proxy) |
| `literacy.reads-short-book` (84mo) | 34 to 91 WCPM band; low edge about 3 months of growth below median | Hasbrouck and Tindal 2017 grade 1 spring, section 2a to 2b |
| `literacy.chapter-books` (96mo) | 72 to 124 WCPM band; low edge about 4.5 months below median | Hasbrouck and Tindal 2017 grade 2 spring, section 2a to 2b |
| `literacy` fluency around grade 3 (anchor 108mo region) | 91 to 139 WCPM band; low edge about 6 months below median | Hasbrouck and Tindal 2017 grade 3 spring, section 2a to 2b |
| `literacy.novels` and later reading (110mo and up) | do not attach a fluency window; ORF and reading percentiles stop discriminating after about 132mo | Sections 2a, 3c |
| `math` domain months-ahead ruler (all grades) | use grade-banded RIT or Quantile spread, not a fixed per-year gain; 25th to 75th RIT band is about two grade-levels wide in early grades | NWEA math (section 3b to 3c), Quantile (section 4b) |
| `literacy` domain months-ahead ruler (all grades) | same, and cap it after grade 8 where the median flattens (reading median 218 at grades 8 and 11) | NWEA reading (section 3a to 3c), Lexile (section 4a) |
| `gross_motor` items (all) | no numeric month window available (TGMD-3 tables paywalled); use observed-mastery caution and Denver II band logic (90th percentile attainment = earliest nudge) | Sections 7a, 7b |
| Any early-vocabulary or single-milestone item | apply a window at least two to three times wider (as a proportion of age) than a motor milestone like walking, per the CDI-versus-walking spread contrast | Wordbank Table 5.1, section 1d |
| Whole-report display treatment | adopt the growth-chart metaphor: show position on a curve with no pass or fail line, steep-early flattening-later shape | CDC growth charts, section 5 |

## Dry wells and method notes

**Method:** every number was read from a fetched primary source or derived by shown arithmetic from an already-verified corpus table (Hasbrouck and Tindal 2017, held in lane 03). No number is from memory. FACT and INFERENCE are labeled per section; confidence grades are per section. Editions captured: Wordbank/Frank et al. 2017 (norms study data 2005 to 2015 era), Hustad et al. 2021, NWEA 2025 MAP Growth norms (Technical Manual v2025.1.0, data fall 2022 to spring 2024), Lexile and Quantile hub charts (norms study 2010 to 2019), CDC growth charts (WHO 0 to 24 months, CDC 2 to 20 years, page reviewed 2024), NIH Toolbox validation monograph 2013 and scoring manual, TGMD-3 (norms 2014 to 2017), Denver II (Frankenburg et al. 1992).

**Dry wells (verified as gaps, logged rather than guessed):**

- **Wordbank per-month fitted percentile curves.** The interactive Vocabulary Norms tool fits and displays 10th/25th/50th/75th/90th percentile production curves for American English Words and Sentences by month, and offers a "Download Table" button, but the fitted monthly values are not present in the fetched paper or book text. Captured instead: the variability statistics (24-month mean 319, SD 175, MADM near 1) and the Norwegian milestone-age spread table. A follow-up could pull the exact monthly percentile values via the `wordbankr` R package or the tool's table download. Words and Gestures percentile curves were not pursued once the time box tightened.
- **NIH Toolbox single-year mean and SD tables.** The validation monograph reports correlations with age and the standard-score framework (mean 100, SD 15, age-corrected) but not a public table of raw computed-score means and SDs by single year of age; those live in the commercial normed database. Captured instead: the scoring framework, the cubic developmental fit (R-squared about 0.76 to 0.77), and the qualitative DCCS milestone. This is enough to establish the replacement path for the attention-minutes folklore, but not a numeric per-age curve.
- **TGMD-3 and Denver II per-age norm tables.** Both instruments' actual normative score tables sit in paywalled examiner's manuals. Captured instead: sample sizes, age ranges, structure, classification thresholds (5th, 25th percentile), the generational-decline finding, and the Denver II percentile-bar precedent with one worked item ("walks well"). No per-item month values for the specific TGMD-3 skills were obtained.
- **NWEA fall and winter percentile tables and school norms.** Only the spring student achievement percentile tables (reading and math) were transcribed here to keep the section tight; the manual also publishes fall, winter, and school-level tables (Appendix B.7 to B.12 and the math equivalents) plus language usage and science. Growth-norm percentile distributions (conditional on starting RIT) were not transcribed; lane 10 holds the growth means.
- **Lexile and Quantile fall and winter rows.** Only the spring percentile rows were transcribed; the hub publishes fall and winter 10th/25th/50th/75th/90th rows for K to 12 as well. Grades 11 and 12 duplicate in the vendor table (same values), captured through grade 10 to match the scored range.
- **Hustad 25th and 75th percentiles.** The paper publishes 5th, 10th, 50th, 90th, and 95th percentile curves, not 25th and 75th, so the intelligibility "typical window" here uses the 50th-to-5th framing (conservative) rather than the interquartile framing used for fluency and vocabulary. Table 4 (observed means and SDs by age band) is available in the source if a mean-and-SD framing is preferred later.
