# 01 · US homeschool market size, growth, and demographics

> Supersession note (2026-07-06, build-log): $29 and $29 to $49 plan prices
> below are the retired placeholder. Pricing v1 is Homa $19/mo or $99/yr and
> Homa Pro $49/mo, live in Stripe both environments. Competitor prices quoted
> in this doc are facts and stand. Allotments still derive at day 60 (T2).

- **Date:** 2026-07-06
- **Author:** ICP research agent (market size and demographics lane)
- **Method:** web research; primary sources preferred (NCES/NHES, Census Household Pulse, Johns Hopkins Homeschool Hub, state DOE registration data), advocacy sources flagged
- **Key findings:**
  - Market size is a range, not a number: 1.77M homeschooled students (NCES strict definition, 2022-23) to 3.4M (NHERI adjusted, 2024-25), with Census Pulse at roughly 5.9-6.5 percent of K-12 (about 3.2M). Household count scaffolds to roughly 1.1M-2.8M homeschool households.
  - Growth is durable, not a COVID hangover: registered homeschooling grew about 4.9 percent on average in 2024-25, nearly triple the pre-pandemic rate, and 10 reporting states hit all-time highs above their pandemic peaks.
  - The market tilts elementary: the homeschool rate is highest at grades K-2 (4.0 percent in NHES 2023), and roughly 60 percent of homeschooled students are under 13. Homa's proven 2-7 core is the strongest entry wedge in the data.
  - Working homeschool mothers are a large slice: about a third of homeschool households have no stay-at-home parent, and about a third have two or more full-time-employed adults (WaPo-Schar 2023). P5 is validated on size; "growing" is not yet provable.
  - Incomes are middle-class (roughly two thirds at $50k+, about 30 percent at $100k+), but observed spend is low: 44 percent of homeschool families reported spending under $500 per year per child on everything. Homa at $348-588 per year must respect that anchor (ESA dollars are the offset where available).

---

## 1. How many homeschoolers: estimates and why they disagree

Confidence: High (the disagreement itself is well documented; each estimate is well sourced).

FACT. The three main national estimates, plus two journalistic/advocacy syntheses:

| Source | Vintage | Estimate | Definition and method |
| --- | --- | --- | --- |
| [NCES NHES:2023 (PFI survey)](https://nces.ed.gov/pubs2024/2024113.pdf) (accessed 2026-07-06) | Fielded Jan-Aug 2023 about school year 2022-23 | 3.4% of K-12, about 1,765,000 students | Parent survey (n=19,562 students, weighted to ~53M). Strict definition: schooled at home instead of public/private school, enrolled no more than 24-25 hrs/week, not temporary illness. Excludes most full-time virtual enrollees |
| [Census Household Pulse Survey, JHU analysis](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/household-pulse-survey/) (accessed 2026-07-06) | 2022-23: 5.82%; 2023-24: 5.92% (documented May 2025) | About 3.1-3.2M students if applied to ~54M school-age children | Online household survey. Broad self-identification: "homeschooled, that is not enrolled in public or private school." Sweeps in many hybrid, co-op, microschool, and virtual arrangements |
| [NHERI (Ray, Hoelzle, Pietersma, Feb 27, 2026)](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/) (accessed 2026-07-06) | School year 2024-25 | 3.408M (range 3.067-3.749M), 6.262% of 54.42M school-age children | Averages two adjusted figures: 23-state registered weighted mean (4.18%, adjusted +20% for assumed undercount, to 5.016%) and Census Pulse Aug-Sep 2024 (6.53%, adjusted +15%, to 7.509%). Homeschool advocacy organization; the underrepresentation adjustments are assumptions, not measured |
| [Washington Post data project](https://www.washingtonpost.com/education/interactive/2023/homeschooling-growth-data-by-district/) (accessed 2026-07-06) | Published Oct 31, 2023, data through 2022-23 | "between 1.9 million and 2.7 million" | Hand-collected registration counts from 6,738 districts in 32 states + DC (61% of US school-age population), projected forward from the NCES 2019 baseline of 1.5M. [Data on GitHub](https://github.com/washingtonpost/data_home_schooling/blob/main/README.md) (accessed 2026-07-06) |
| HSLDA | Ongoing | No independent annual census. Its research director argued the pandemic surge held ([Duvall, Apr 2022](https://hslda.org/post/homeschool-surge-still-going-strong), accessed 2026-07-06); a Dec 2025 congressional release HSLDA endorsed cites "nearly 3 million" ([markharris.house.gov](http://markharris.house.gov/media/press-releases/rep-mark-harris-targets-colleges-discriminating-against-homeschoolers), accessed 2026-07-06) | Advocacy organization; relies on state data and others' estimates |

FACT. Why NHES and Pulse disagree by nearly 2x: the Pulse "uses a broader definition of homeschooling than the NHES," whose estimate "can be viewed as a more restrictive definition ... providing a more conservative estimate of this population" ([Education Next, summarizing Bjorklund-Young and Watson](https://www.educationnext.org/what-state-policymakers-should-know-about-homeschoolers-misconceptions-who-chooses-home-education/), accessed 2026-07-06). NHES 2023 also counts a further 1.8 percent of students as full-time virtual enrolled in public/private school plus 0.7 percent full-time virtual homeschoolers; "instruction at home" totals 5.2 percent, up from 3.7 percent in 2018-19 ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06). Much of the NHES-vs-Pulse gap is families in virtual/hybrid arrangements who call themselves homeschoolers.

FACT. State registration counts are floors, not totals: 21 states do not report at all, registration usually starts at compulsory age (roughly 11 percent of the 13 K-12 school-age years are non-compulsory), and compliance is partial (West Virginia officials reported about 60 percent assessment-submission compliance) ([NHERI methods discussion](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/), accessed 2026-07-06; [JHU Homeschool Hub on who is counted](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/homeschool-growth-2024-2025/), accessed 2026-07-06).

INFERENCE. For planning, treat the student population as a band: 1.8M (strict, conservative, best for like-for-like trend math) to 3.4M (broad, includes the hybrid/virtual fringe where Homa may or may not win). The Pulse ~3.0-3.2M mid-band is the most defensible single working figure for "families who call themselves homeschoolers," which is the identity Homa sells into.

## 2. Growth trajectory: baseline, spike, retention, current trend

Confidence: High for direction, Medium for magnitudes (sources use different definitions).

FACT, pre-pandemic baseline. NHES series (per-student rate): 1.7% (1999), 2.2% (2003), 3.0% (2007), 3.4% (2012), 3.3% (2016), 2.8% (2019) ([NCES Digest table 206.10, prepared Dec 2021](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06). Pre-pandemic registered-count growth was around 2 percent per year ([JHU Homeschool Hub](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/homeschool-growth-2024-2025/), accessed 2026-07-06).

FACT, the spike. Census Pulse: 5.4% of households with school-age children homeschooling in spring 2020, 11.1% by fall 2020 ([Census Bureau, Mar 2021](https://www.census.gov/library/stories/2021/03/homeschooling-on-the-rise-during-covid-19-pandemic.html), accessed 2026-07-06). Black households went from 3.3% to 16.1% (5x), Hispanic 6.2% to 12.1%, white 5.7% to 9.7%, Asian 4.9% to 8.8% ([AP, Mar 2021](https://apnews.com/article/coronavirus-pandemic-census-2020-6ca21124cca741b9e6ec1c8256e1c921), accessed 2026-07-06).

FACT, retention. In 18 states sharing data, homeschool numbers rose 63% in 2020-21 and then fell only 17% in 2021-22 ([AP, 2022](https://apnews.com/article/covid-business-health-buffalo-education-d37f4f1d12e57b72e5ddf67d4f897d9a), accessed 2026-07-06). The Washington Post found registration "increased 51 percent over the past six school years" (2017-18 to 2022-23) in comparable states, versus +7% private and -4% public enrollment, and that growth "has largely sustained itself through the 2022-23 academic year"; in 697 districts it kept increasing after the peak ([Washington Post](https://www.washingtonpost.com/education/interactive/2023/homeschooling-growth-data-by-district/), accessed 2026-07-06). NHES confirms a durable step up on the strict definition: 2.8% (2019) to 3.4% (2022-23) ([NCES](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06).

FACT, 2023-2026 trend: growing. In 2023-24, 19 of 21 reporting states increased (90 percent), with rebounds after post-pandemic dips ([JHU Homeschool Hub, 2023-24](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/homeschool-growth-2023-2024/), accessed 2026-07-06). In 2024-25, homeschooling grew "at an average rate of 4.9%," nearly triple the pre-pandemic rate; 80 percent of 28 reporting states increased; 10 states (36 percent of reporters) hit all-time highs, above pandemic peaks: GA, MN, NE, OH, PA, WY, plus continuous-growth LA, ND, SD, SC ([JHU Homeschool Hub, 2024-25, by Angela Watson, Nov 2025, updated Jan 2026](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/homeschool-growth-2024-2025/), accessed 2026-07-06).

FACT, 2024-25 state growth leaders (registered counts, same source, accessed 2026-07-06): South Carolina +21.5%, Vermont +17%, Ohio +15%, New Hampshire +14.5%. Six states declined: DE, DC, FL, HI, NM, TN. The Florida decline (-1.7%) is partly an accounting artifact: universal-ESA students "who take the ESA are no longer counted as homeschooled."

Exact quote for reuse (Angela Watson, JHU, same page, accessed 2026-07-06): "We're seeing something remarkable here. Homeschooling growth is nearly triple the pre-pandemic rate and shows no signs of slowing down. This isn't a pandemic hangover; it's a fundamental shift in how American families are thinking about education."

INFERENCE. The 2026 planning assumption "growing market" is safe. Expect churn within it: JHU notes "homeschooled students frequently move in and out of the sector" (same page), which matters for Homa retention modeling more than for TAM.

## 3. Household shape: children per family, ages, grades

Confidence: Medium-High (multiple sources triangulate, but no single current national household census).

### 3a. Children per homeschool household

- FACT. Registered students per registering family: Florida 152,109 students / 104,961 families = 1.45 (2021-22) ([FLDOE fast facts, Sept 2022](https://www.fldoe.org/core/fileparse.php/5606/urlt/HomeEd-Sept-2022.pdf), accessed 2026-07-06); Florida 152,871 students / 114,370 families = 1.34 (2024-25, per FLDOE's 2024-25 annual report listed on the [FLDOE Facts and Figures page](https://www.fldoe.org/schools/school-choice/facts-figures.stml), accessed 2026-07-06). North Carolina 165,243 estimated students / 101,880 home schools = 1.62 (2024-25) ([NC DNPE statistical history](https://www.doa.nc.gov/dnpe-home-school-statistical-history-pdf/open), accessed 2026-07-06).
- FACT. Homeschooled children per homeschool household (children 5-20 homeschooled this fall): one 65%, two 22%, three 7%, four 3%, five+ 2% ([Washington Post-Schar School poll topline, Aug 2023, Q3](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06). Implied mean about 1.5 homeschooled kids per household.
- FACT. Total children (not just homeschooled ones): homeschooled children have on average 1.5 siblings versus 1.0 for non-homeschooled children, and mean homeschool household size is 4.62 people versus 4.05 (pooled NHES 2012/2016/2019) ([Cheng et al., U. Arkansas working paper EDRE 2024-04](https://edre.uark.edu/_resources/pdf/edre-wp-2024-04.pdf), accessed 2026-07-06). Per-student NHES 2019: 19% of homeschooled students live in one-child households, 33% in two-child, 48% in three-or-more-child households ([NCES Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06).
- INFERENCE. The typical homeschool family has 2-3 children total (mean about 2.5 by the sibling data), but typically only 1-2 of them are being homeschooled at once. Registration ratios (1.3-1.6) and the WaPo-Schar 65-percent-one-child figure agree. For Homa this means the buyer usually manages fewer simultaneous homeschooled kids than the "3 kids, 3 curricula" stereotype, but sector mixing (see 5b) keeps the other siblings in the picture.

### 3b. Age and grade distribution

FACT. NHES 2019, share of the 1.457M homeschooled students by grade equivalent ([NCES Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06):

| Band | Students (thousands) | Share |
| --- | --- | --- |
| Kindergarten | 115 | 7.9% |
| Grades 1-3 | 322 | 22.1% |
| Grades 4-5 | 267 | 18.3% |
| Grades 6-8 | 429 | 29.4% |
| Grades 9-12 | 325 | 22.3% |

(K-5 = 48.2%; K-8 = 77.7%. NHES publishes no preK data; the survey starts at age 5.)

FACT. NHES 2023 homeschool rate by grade band (2022-23): K-2nd 4.0%, 3rd-5th 3.6%, 6th-8th 3.0%, 9th-12th 3.1% ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06). The youngest band has the highest rate.

FACT. North Carolina 2024-25 registered enrollment by age ([NC DNPE statistical summary](https://www.doa.nc.gov/media/18151/open), accessed 2026-07-06): ages 6-7 = 28,818 (17.4% of 165,243); ages 8-12 = 67,961 (41.1%); ages 6-12 = 96,779 (58.6%); ages 13-17 = 68,464 (41.4%). Age 7 (2nd grade) is the single largest cohort (15,746). No age-5 row exists because "most homeschools with only students below the age of 7 do not officially open a school (because the law does not require it)" ([North Carolinians for Home Education](https://nche.com/stats/), accessed 2026-07-06).

INFERENCE. Roughly 60 percent of homeschooled students are under 13 (NHES 2019 grade bands imply about 60-65 percent; NC ages 6-12 give 58.6 percent with kindergarteners uncounted). Share of households with at least one child under 8: no reliable household-level figure found (tried NCES web tables, JHU Hub disaggregations, state reports; none publish household-level age mixes). Student-level proxies: about 30 percent of NHES 2019 homeschooled students were in K-3 (ages roughly 5-9); NC ages 6-7 are 17 percent of registered students with age 5-6 structurally undercounted. Because households average about 1.4-1.6 registered kids, the share of households containing a young child is higher than the student share, and preschool siblings (Homa's age-2-4 wedge) are invisible in every official count.

## 4. Demographics and trends

Confidence: Medium-High (three independent 2023-2024 sources agree on direction; levels differ by survey).

### 4a. Income

- FACT. Pulse 2023-24, household income of respondents with homeschooled students: under $25k 10%, $25-35k 8%, $35-50k 10%, $50-75k 13%, $75-100k 12%, $100-150k 13%, $150-200k 5%, $200k+ 5%, did not report 24% ([JHU Pulse analysis](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/household-pulse-survey/), accessed 2026-07-06). Among the 76 percent who reported: 63% at $50k+, 46% at $75k+, 30% at $100k+.
- FACT. NHES 2019 (per student): 69.7% of homeschooled students lived in households above $50k, 48.9% above $75k, 33.6% above $100k ([NCES Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06).
- FACT. NHES 2023 homeschool rate peaks in middle incomes: $50-75k households homeschool at 5.0%, $75-100k at 4.2%, $100k+ at 3.1%, $20-50k at 2.6%, under $20k at 2.4% ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06). Homeschooling incomes are "modestly lower, on average, than those of respondents with children in public schools" ([Education Next / JHU](https://www.educationnext.org/new-u-s-census-bureau-data-confirm-growth-in-homeschooling-amid-pandemic/), accessed 2026-07-06).
- FACT, spend anchor. Annual homeschool spend per child (all-in, materials plus tuition): under $500 44%, $500-1,999 33%, $2,000-4,999 15%, $5,000-7,499 5%, $7,500+ 2% ([WaPo-Schar topline, Q17](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06).
- INFERENCE. Homa's $29-49/mo ($348-588/yr) sits above the median family's entire current per-child spend. Income is not the binding constraint for most of the market; spending habits are. ESA states change this: Florida's PEP ESA alone funded 59,925 home-education students at $7,700-8,500 each in 2024-25 ([Step Up For Students fact sheet](https://go.stepupforstudents.org/hubfs/Website/Research%20and%20Reports/PEP%20Fact%20Sheet.pdf), accessed 2026-07-06). Cross-reference lane file 06 (ESA landscape) and 09 (buying psychology).

### 4b. Parent education

FACT. Pulse 2023-24 homeschool respondents: 29% bachelor's or higher, 33% some college/associate's, 29% HS/GED, 9% less than HS ([JHU Pulse analysis](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/household-pulse-survey/), accessed 2026-07-06). NHES 2019 (per student, highest parent education) skews higher: 52% bachelor's or above ([NCES Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06). The two surveys disagree on level (different populations and respondent definitions); both show homeschool parents roughly tracking the general parent population.

### 4c. Race and ethnicity: diversification is real but survey-dependent

- FACT. NHES 25-year series: Black share of homeschoolers was about 10% (1998-99), 4% (2006-07), 8% (2011-12 and 2015-16), 6% (2018-19 and 2022-23); Hispanic share rose from 9% (1998-99) to 26% (2015-16), then 17% (2018-19) and 14% (2022-23); white share fell 4 points over the period ([Bjorklund-Young and Watson, Journal of School Choice 2024](https://doi.org/10.1080/15582159.2024.2422743), accessed 2026-07-06).
- FACT. Pulse paints a more diverse picture: 2022-23 homeschool households were 60% white, 19% Hispanic, 12% Black, 2% Asian, 7% two-or-more/other, i.e. "roughly 40% of all current homeschool students are students of color," versus 29% in NHES ([JHU Hub race and ethnicity page](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/race-and-ethnicity/), accessed 2026-07-06). 2023-24 Pulse: 63% white, 18% Hispanic, 10% Black, 2% Asian ([JHU Pulse analysis](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/household-pulse-survey/), accessed 2026-07-06).
- FACT. EdChoice/Morning Consult (fielded spring 2024): 15% of households homeschooling any child are Hispanic, 10% Black, 5% Asian ([Watson and Lee, "Who Homeschools, Really?", EdChoice WP 2025-17](https://edchoice.org/wp-content/uploads/2025/07/07-25-Who-Homeschools-Really.pdf), accessed 2026-07-06).
- FACT. NHES 2023 rate by race: white non-Hispanic 5.1%, Black non-Hispanic 1.7%, Hispanic 1.8%. Note Black families' total instruction-at-home rate is 5.1% because full-time virtual enrollment adds 3.4 points, the highest virtual share of any group ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06).

### 4d. Locale

FACT. NHES 2023 homeschool rate: city 2.1%, suburban 3.1%, town 5.1%, rural 5.2% ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06). NHES 2019 composition: city 27%, suburban 37%, town 7%, rural 29% ([Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06). EdChoice 2024: "more likely to be practiced in Rural settings and less likely to be practiced in Urban settings," similar in suburban and small-town ([Watson and Lee](https://edchoice.org/wp-content/uploads/2025/07/07-25-Who-Homeschools-Really.pdf), accessed 2026-07-06). But urban growth is real where measured: some NYC districts grew 200-300 percent over six years ([Washington Post](https://www.washingtonpost.com/education/interactive/2023/homeschooling-growth-data-by-district/), accessed 2026-07-06).

### 4e. Family structure and work status (persona P5)

- FACT. Two-parent households: 80 percent of homeschooled children lived in two-parent homes (NHES 2016); 83 percent of homeschooled children had married parents in 2019 versus 70 percent of non-homeschooled ([U. Arkansas WP 2024-04](https://edre.uark.edu/_resources/pdf/edre-wp-2024-04.pdf), accessed 2026-07-06). NHES 2023 rate: two-parent households homeschool at 3.9%, one-parent at 1.6% ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06).
- FACT. Labor force composition (per student, NHES 2019): two parents both in labor force 27.4%, two parents one in labor force 57.6%, single parent in labor force 8.7%, no parent in labor force 6.4% ([Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06). The both-working share was flat pre-pandemic: 27% (2012), 27% (2016), 29% (2019) ([U. Arkansas WP 2024-04, table 1](https://edre.uark.edu/_resources/pdf/edre-wp-2024-04.pdf), accessed 2026-07-06).
- FACT. Household level, 2023: among homeschool households, adults employed full-time for pay: zero 10%, one 56%, two 29%, three+ 5%; stay-at-home parents: zero 31%, one 58%, two 8%, three+ 3% ([WaPo-Schar topline, Q30](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06). So about a third of homeschool households (34%) have 2+ full-time earners and about a third (31%) have no stay-at-home parent.
- FACT. NHES 2023 homeschool rate by parents' work arrangement (two-parent families): one full-time + one not-in-labor-force 8.8%, one full-time + one part-time 4.5%, both full-time 1.1%; single parents: part-time 2.9%, full-time 1.2% ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06).
- FACT. Mothers do the work: mothers are the primary instructor in about three quarters of homeschool families (0.77 in 2012, 0.70 in 2016, 0.76 in 2019) ([U. Arkansas WP 2024-04](https://edre.uark.edu/_resources/pdf/edre-wp-2024-04.pdf), accessed 2026-07-06); 79 percent of homeschooled kids get instruction from their mother (2023) ([WaPo-Schar topline, Q7](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06).
- INFERENCE. The one-full-time-one-part-time household (homeschool rate 4.5 percent, four times the both-full-time rate) is exactly persona P5's shape, and it is a mainstream configuration, not an edge case. But no time series shows the working share rising; the 2012-2019 dual-earner share was flat, and no post-2019 composition series exists yet.

## 5. Motivations over time, and the category blur

Confidence: High on motivations (repeated federal series), Medium on hybrid/microschool sizing.

### 5a. Motivation mix

FACT. NHES 2023 (2022-23), percent of homeschooled students whose parents rated each reason important, and (in parens) percent naming it the single most important ([NCES First Look, table A-7](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06): concern about environment of other schools (safety, drugs, negative peer pressure) 83 (28); moral instruction 75; family life together 72; dissatisfaction with academic instruction 72 (17); religious instruction 53 (11); nontraditional approach 50; child has other special needs 21 (7); physical or mental health problem 15 (5).

FACT. The religious motivation is receding, though not monotonically in NHES: "important" 51% (2015-16, [NCES table](https://nces.ed.gov/nhes/tables/homeschool_reason.asp), accessed 2026-07-06), 58.9% (2019, [Digest 206.15](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.15.asp), accessed 2026-07-06), 53% (2022-23); "most important" fell 13.0% (2019) to 11% (2022-23). WaPo-Schar 2023 asked the NHES question and got 34% yes versus 56% in NHES 2019 ([topline, Q10c](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06); press summaries frame this as 63% (2012) to 34% (2023) ([WyoFile citing the poll](https://wyofile.com/from-microschools-to-basements-to-boats-wyomingites-embrace-school-choice-with-or-without-state-money/), accessed 2026-07-06). The Post's conclusion: homeschooling is now "more racially and ideologically diverse," motivated by "fear of school shootings, anxiety over bullying and anger with the perceived encroachment of politics" rather than religion ([WaPo, Sept 26, 2023](https://www.washingtonpost.com/education/2023/09/26/home-schooling-vs-public-school-poll/), accessed 2026-07-06). Even in North Carolina's registration data, 47.4% of home schools now register as independent versus 52.6% religious ([NC DNPE 2024-25](https://www.doa.nc.gov/media/18151/open), accessed 2026-07-06). EdChoice 2024: 44% of homeschool parents attend religious services weekly, but 31% never attend ([Watson and Lee](https://edchoice.org/wp-content/uploads/2025/07/07-25-Who-Homeschools-Really.pdf), accessed 2026-07-06).

FACT. Special needs and mental health are rising motivators: WaPo-Schar 2023 versus NHES 2019 on identical questions: child has physical/mental health problem 27% vs 17%; other special needs school cannot meet 32% vs 24%; and homeschooled kids index higher on anxiety/depression (31% vs 24%), ADHD (29% vs 16%), and autism (13% vs 7%) than non-homeschooled ([topline, Q10, Q13](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06). Safety/violence was the top open-ended reason net (20%) ahead of academics (19%) and special needs (14%) (same topline, Q9).

### 5b. The category is blurring (hybrid, co-op, microschool)

- FACT. Among homeschool students, 71% are homeschooled full-time; 29% homeschool via co-op (18%), hybrid school (8%), or something else (3%); and 44% of households with a homeschooled child also use another sector for another child (35% traditional public, 13% private, 9% charter) ([Watson and Lee, EdChoice, spring 2024 data](https://edchoice.org/wp-content/uploads/2025/07/07-25-Who-Homeschools-Really.pdf), accessed 2026-07-06).
- FACT. 37% of homeschooled kids were also enrolled part-time in a public or private school in 2023, versus 10% on the comparable NHES 2019 measure; 57% use online live classes; 19% use a co-op; 9% use a microschool or pod ([WaPo-Schar topline, Q5, Q8](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06).
- FACT. Microschool sizing is soft: "between 750,000 and 2.1 million students" (RAND 2024, quoted in [National Microschooling Center 2025 sector analysis](https://microschoolingcenter.org/hubfs/American%20Microschools%202025.pdf), accessed 2026-07-06); the Center itself estimates about 2 percent of US students, roughly 750,000 ([The 74, 2025](https://www.the74million.org/article/exclusive-report-as-movement-grows-microschools-arent-so-micro-anymore/), accessed 2026-07-06). 53% of microschools "report serving as learning centers for homeschooling children" ([Forbes summary of the 2025 report](https://www.forbes.com/sites/brunomanno/2025/06/02/microschools-go-macro-and-provide-more-learning-choices-for-families/), accessed 2026-07-06). State counts "frequently include students attending microschools, hybrid schools, and learning cooperatives" ([JHU Hub](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/homeschool-growth-2024-2025/), accessed 2026-07-06), so microschoolers partially overlap every homeschool count.
- INFERENCE. Homa's buyer definition ("the mother is the educator of record at home") covers the 71 percent full-time core cleanly and much of the co-op slice; hybrid-school families (8 percent and growing) partially outsource the exact jobs (planning, records) Homa sells. Treat hybrids as adjacent, not core.

## 6. Geographic concentration

Confidence: Medium-High (registered counts are exact but incomplete; survey rates cover all states with sampling noise).

FACT. Top registered-state rates, 2024-25 (registered students as percent of state school-age population; floors, not totals) ([NHERI table 1, from state data](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/), accessed 2026-07-06): NC 9.47%, SD 7.02%, AR 6.79%, ME 6.31%, MS 4.94%, GA 4.71%, SC 4.65%, NE 4.57%, FL 4.54%, VA 4.48%, MT 4.35%. Lowest reporters: MA 1.21%, RI 2.03%, PA 2.28%, WA 2.46%.

FACT. Survey-based rates covering all 50 states (Pulse): 2023-24 highest are Alaska 16.15%, Tennessee 10.75%, Montana 9.03%; lowest are Connecticut 3.01%, DC 3.04%, Massachusetts 3.39%. 2022-23 highest: Alaska 12.56%, Tennessee 9.02%, West Virginia 8.89% ([JHU Pulse analysis](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/household-pulse-survey/), accessed 2026-07-06).

FACT plus INFERENCE. Top states by absolute count (mix of registration facts and Pulse-based estimates):

| State | Basis | Count |
| --- | --- | --- |
| Texas | INFERENCE: Pulse rate 6.28% (2023-24) x roughly 5.5M school-age ([JHU Texas page](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/states/texas/), accessed 2026-07-06) | roughly 340k (no registration exists) |
| California | INFERENCE: Pulse 4.42-4.89% (2022-24) x roughly 5.8M ([JHU California page](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/states/california/), accessed 2026-07-06); only about 60k visible in PSA filings (2021-22) | roughly 260-280k |
| North Carolina | FACT: registered estimate ([NC DNPE](https://www.doa.nc.gov/dnpe-home-school-statistical-history-pdf/open), accessed 2026-07-06) | 165,243 (2024-25) |
| Florida | FACT: registered ([FLDOE via NHERI](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/), accessed 2026-07-06); 155,532 in 2023-24 per [WUFT citing FLDOE](https://www.wuft.org/business-news/2025-12-05/homeschooling-on-the-rise-across-florida-families-seeking-flexibility) (accessed 2026-07-06) | 152,871 (2024-25, ESA reclassification depresses this) |
| Georgia | FACT: registered, record high ([NHERI table](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/), accessed 2026-07-06) | 89,510 (2024-25) |
| Virginia | FACT: 56,008 home instruction + 6,755 religious exemptions ([VDOE via WRIC](https://www.wric.com/news/virginia-news/homeschooling-religious-exemptions-increase-in-via/), accessed 2026-07-06) | 62,763 (2024-25) |
| Ohio | FACT: registered, record high, +15% ([NHERI table](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/); [JHU 2024-25](https://education.jhu.edu/edpolicy/policy-research-initiatives/homeschool-hub/homeschool-growth-2024-2025/), both accessed 2026-07-06) | 53,051 (2024-25) |
| Washington | FACT: registered ([NHERI table](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/), accessed 2026-07-06); WA requires filing only from age 8 | 30,387 (2024-25) |

INFERENCE. Homa's launch geography logically weights the South and Sunbelt (NC, FL, GA, TX, TN, SC: high counts, high rates, ESA tailwinds) plus compliance-heavy states (NY, PA, WA, VA) where the hours-log/report pain P2/P4 personas feel is sharpest. Cross-reference lane file 06 for the regulatory tiers.

## 7. TAM/SAM scaffold (sourced inputs only)

Confidence: Medium (every input sourced; the two filters are the weak links and are flagged).

Inputs, all defined above with links: I1 students (1.765M NHES strict / about 3.2M Pulse / 3.408M NHERI); I2 students per registering family (1.34 FL to 1.62 NC); I3 under-13 student share (about 58.6-65 percent; household share unknown but higher); I4 income mix (63-70 percent at $50k+, 46-49 percent at $75k+, 30-34 percent at $100k+ across Pulse 2023-24 and NHES 2019).

Step 1, households. Students divided by students-per-family:

| Basis | Math | Households |
| --- | --- | --- |
| Low (NHES strict) | 1.765M / 1.62 | 1.09M |
| Central (Pulse 2023-24) | 3.22M / 1.45 | 2.22M |
| High (NHERI upper) | 3.749M / 1.34 | 2.80M |

Flag: the divisor comes from two states' registration ratios; unregistered kids (non-compulsory ages, non-compliance) bias it in unknown directions. Working band: roughly 1.1M-2.8M US homeschool households, central call about 2M.

Step 2, filter to households with a child under 13. Student-level share is about 0.6 (FACT-backed proxy, section 3b); the household-level share is strictly higher because multi-child households span ages, but no source measures it, so 0.6 is used as a conservative floor and 0.75 as a flagged inference ceiling. Result: 0.65M (1.09M x 0.6) to 2.1M (2.8M x 0.75). Central: about 1.3-1.7M. Flag: this is the scaffold's weakest joint; a single Pulse microdata pull could pin it down.

Step 3, filter to income bands that plausibly support $29-49/mo. Using the sourced income mixes, not an affordability model:

| Income floor | Share (sourced range) | Applied to step-2 band | Result |
| --- | --- | --- | --- |
| $50k+ | 0.63-0.70 | 0.65M-2.1M | about 0.4M-1.5M households |
| $75k+ | 0.46-0.49 | 0.65M-2.1M | about 0.3M-1.0M households |

Central read: on the Pulse-central path (2.22M households x 0.6-0.75 under-13 x 0.63-0.70 at $50k+), the serviceable pool is roughly 0.85M-1.15M households; on the stricter $75k+ floor, roughly 0.6M-0.8M.

Not modeled, per instructions: reachability, conversion, willingness-to-pay. Two sourced cautions belong next to any revenue math built on this scaffold: (a) 44 percent of homeschool families reported under $500/yr total per-child spend ([WaPo-Schar topline, Q17](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06), so the $50k+ income filter does not imply $348-588/yr software budgets; (b) ESA programs (for example Florida PEP, about 60k funded home-education students at $7,700-8,500 each, [Step Up For Students](https://go.stepupforstudents.org/hubfs/Website/Research%20and%20Reports/PEP%20Fact%20Sheet.pdf), accessed 2026-07-06) create pockets where the subscription is effectively state-funded.

## 8. Assumption verdicts

### 8a. Council claim: "median family 2-3 kids ages 5-12"

Verdict: MIXED (family size supported; the age band and the implied all-kids-homeschooled shape are not).

- Size SUPPORTS: homeschooled children average 1.5 siblings (so about 2.5 kids per family, median plausibly 2-3) ([U. Arkansas WP 2024-04](https://edre.uark.edu/_resources/pdf/edre-wp-2024-04.pdf), accessed 2026-07-06); 48 percent of homeschooled students live in 3+ child households ([Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06).
- Age band CONTRA in part: 22-31 percent of homeschooled students are grades 9-12 across NHES 2012-2019 (22.3 percent in 2019) ([Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06), and in NC 41 percent of registered students are 13-17. A family whose kids are all 5-12 is common but not the median; the median family's age span reaches into teens as kids age.
- Shape caveat: 65 percent of homeschool households homeschool exactly one child at a time ([WaPo-Schar topline, Q3](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06), and 44 percent of homeschool households have another child in a different sector ([EdChoice](https://edchoice.org/wp-content/uploads/2025/07/07-25-Who-Homeschools-Really.pdf), accessed 2026-07-06). The "manage all 3 kids in Homa" picture overstates the median; "2-3 kids, 1-2 actively homeschooled, others mixed-sector" is what the data shows.

### 8b. P5 claim: "working homeschoolers are a large and growing slice"

Verdict: MIXED (large: SUPPORTS; growing: NO-EVIDENCE yet).

- Large SUPPORTS: 34 percent of homeschool households have 2+ adults employed full-time and 31 percent have no stay-at-home parent ([WaPo-Schar topline, Q30](https://www.washingtonpost.com/documents/6fbcc249-940f-4a01-aee8-b48c82a5a242.pdf), accessed 2026-07-06); 27-29 percent of homeschooled students had both parents in the labor force across 2012-2019 ([U. Arkansas WP 2024-04](https://edre.uark.edu/_resources/pdf/edre-wp-2024-04.pdf), accessed 2026-07-06); part-time-plus-full-time two-parent households homeschool at 4.5 percent, well above the 3.4 percent average ([NCES First Look, table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06).
- Growing NO-EVIDENCE: the dual-earner share was flat 2012-2019, and no post-2019 time series on homeschool-parent employment exists. Indirect signals point up (37 percent part-time school enrollment versus 10 percent in 2019, growth of co-ops/microschools that provide childcare hours), but that is inference, not measurement.

### 8c. A6 context: share of homeschool households with an 8-12 year old

Verdict: NO-EVIDENCE at household level (no published figure; tried NCES web tables, JHU Hub state disaggregations, Pulse public tables, state DOE reports). Student-level FACTS: ages 8-12 are 41.1 percent of NC registered homeschoolers (2024-25) ([NC DNPE](https://www.doa.nc.gov/media/18151/open), accessed 2026-07-06); grades 4-8 are 47.8 percent of NHES 2019 homeschooled students ([Digest 206.10](https://nces.ed.gov/programs/digest/d22/tables/dt22_206.10.asp), accessed 2026-07-06).

INFERENCE for the decision: since households average about 1.4-1.6 registered kids spanning ages, the share of homeschool households containing at least one 8-12 year old is necessarily above the roughly 41 percent student share, plausibly half or more. Partial age coverage (2-7 only) therefore excludes or half-serves a majority-adjacent share of households at any moment, and every retained 2-7 family ages into 8-12 within a subscription lifetime. The A6 concern is real: 8-12 coverage decides whether the median multi-kid sale stays whole. Offsetting fact: the 2-7 wedge is where homeschool rates are highest (K-2 at 4.0 percent) and where new entrants arrive (NC's biggest single cohort is age 7), so entering young and expanding upward follows the market's own grain.

## 9. Data gaps and what was tried

- Household-level age-mix and "at least one child under 8 / 8-12" shares: no reliable figure found (searched NCES PFI web tables, JHU Hub downloadable state data descriptions, Census Pulse education tables, FL/NC/VA/WA reports). Fixable with Pulse or NHES microdata analysis.
- NHES 2023 demographic composition tables (income/children-per-household distributions of homeschoolers, 2022-23): NCES has published rates by subgroup ([First Look table A-6](https://nces.ed.gov/pubs2024/2024113.pdf), accessed 2026-07-06) but the Digest-style 206.10 distribution update stops at 2019; composition figures here therefore mix 2019 (NHES) and 2023-24 (Pulse) vintages.
- Homeschooling mothers' employment hours (part-time versus full-time, mother-specific): only household-level adult counts exist (WaPo-Schar Q30) plus NHES arrangement rates; no mother-specific national series. P5 sizing rests on those two.
- Ages 2-4 (Homa's preschool wedge): structurally absent from every official count (NHES starts at age 5; states register at compulsory age, 6-8). Any preschool TAM claim would be fabrication; do not make one.
- 2025-26 school year data: only partial (Pulse cycles and early state reports); first consolidated reads land late 2026.
