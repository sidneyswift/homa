# 10. Homeschool methods and philosophies: a ranked, sourced glossary

**Date**: 2026-07-10 · **Analyst**: research pass (methods and philosophies domain)
**Method**: web research against primary sources (NHERI's published survey, publisher
and organization self-reports, sector-analysis nonprofits, journalism, community
content). Every claim carries an inline link and access date. FACT and INFERENCE are
separated, CAUTION flags unverifiable or self-interested numbers, and confidence is
rated per section. This file exists so Homa's product and agent can ground a
conversation in what a named method actually is and how big it actually is, instead of
relying only on the model's internal training data, which goes stale the day training
stopped. It is meant to be a living document: append new methods, refresh numbers, and
date-stamp changes (see §5).

**Purpose, read this first.** `08-segments-curricula.md` already covers the six
segments that matter most for product strategy (classical, Charlotte Mason,
unschooling, eclectic, religious, school-at-home) in depth, with buying behavior and
AI-framing cards. This file is the companion: it is the comprehensive glossary "what
is out there, from most popular to most obscure" that the founder asked for, covering
every named method turned up in research, including the ones §08 explicitly flagged as
data gaps (Montessori, Waldorf, unit studies) plus a dozen more that never made the
segment cut because they are small, but real, and a mom will sometimes name one by
name.

**Key findings**

- No probability-sample survey has ever asked homeschoolers to pick their named
  philosophy from a full menu. The single most-cited academic instrument (the
  1,171-parent NHERI-hosted study) offered exactly four options: traditional/boxed,
  unschooling, eclectic, classical. Charlotte Mason, Montessori, Waldorf, unit
  studies, and everything else were never offered as choices, so "0% Montessori" in
  any dataset means "not asked," not "not practiced."
- Beyond those four measured categories, popularity has to be triangulated from proxy
  signals: institutional footprint (how many schools/curricula/organizations exist),
  community size (Facebook groups, self-reported membership), and market scale
  (curriculum providers, price points). This file labels every ranking claim by which
  proxy it rests on.
- Two of the biggest "methods" moms will name are not pedagogies at all: online/virtual
  charter "school-at-home" (legally public-school enrollment, functionally
  indistinguishable from homeschooling to the family) and microschools/hybrid pods
  (a delivery format, not a philosophy). Both are missing from Homa's current
  `HOMESCHOOL_STYLES` enum entirely (see §6) and both are large and growing.
- Montessori is the single most institutionally established alternative pedagogy in
  the world by school count (15,763 schools worldwide, 2022 Global Montessori Census),
  yet has zero dedicated homeschool-population survey data, same as Charlotte Mason
  and Waldorf. Institutional scale and homeschool-adoption scale are different
  numbers and should never be conflated.
- The tail is long and real: Thomas Jefferson Education, the Principle Approach,
  Reggio-inspired project-based homeschooling, forest school, worldschooling,
  roadschooling, gameschooling, and the Sudbury model all have live, sourced
  communities behind them, just much smaller ones. A mom naming any of these is
  giving Homa a strong, specific signal, not noise.

---

## 1. The honest state of the ranking problem

FACT. The only methods with anything resembling survey data are the four options on
the [1,171-parent NHERI-hosted study](https://nheri.org/home-school-researcher-parent-perspectives-curriculum-and-homeschooling-approaches/)
(accessed 2026-07-10, unscientific self-selected sample, 2017 publication): eclectic
68% (798), classical 14% (160), unschooling 13% (153), traditional/boxed 5% (60). The
survey's own methods section admits the four-option menu was too narrow: one
respondent wrote "You need to add more choices other than boxed, classical, eclectic
and unschooling ... I would describe our education as child led, eclectic, relaxed,
literature based and high tech" (same source, accessed 2026-07-10). Charlotte Mason,
Montessori, Waldorf, and unit studies were never response options, so they are absent
from Table 1 by survey design, not by absence in the population.

CAUTION. SEO aggregator sites (numaschool.com, homeschoolpicks.com, worldmetrics.org)
circulate more specific-sounding numbers, e.g. "21% classical per 2026 NHERI survey
updates," "36% eclectic," "7% unschooling" ([homeschoolpicks](https://homeschoolpicks.com/homeschool-methods/homeschool-methods-comparison-chart/),
[worldmetrics](https://worldmetrics.org/homeschooling-statistics/), both accessed
2026-07-10). No underlying NHERI publication matching those figures exists as of this
writing; §08 flagged the same pattern with the same sites. These numbers are UNVERIFIABLE
and are used in this file only for relative ordering within the "no real data" tier,
never cited as fact.

INFERENCE. Given that, this file ranks methods on three converging, separately-labeled
signals: (a) self-ID survey share where it exists (four methods only), (b) institutional
footprint (school counts, organization membership, publisher scale), and (c) qualitative
consensus across independent sources about relative commonness ("increasingly popular,"
"one of the largest," "far smaller niche"). Where signals conflict or don't exist, the
entry says so plainly rather than inventing a number.

Confidence: High on the methodology gap itself; Medium on the resulting relative
ordering; Low on any specific percentage for a method beyond the big four.

## 2. The ranked list

Most-common to most-obscure, by best-available combined signal. "Standing share" =
what fraction of homeschoolers would answer that when named, if measured. "Signal"
names which proxy backs the ranking, since precise data mostly doesn't exist.

| # | Method | Standing share / footprint | Signal quality |
|---|---|---|---|
| 1 | [Eclectic](#eclectic) | ~55-68% self-ID (the modal answer whenever asked) | Survey (unscientific) + federal proxy |
| 2 | [Classical / Classical Christian](#classical--classical-christian) | ~14-21% self-ID; ~264K home-based students via classical charter spillover | Survey (unscientific) + sector analysis |
| 3 | [Charlotte Mason](#charlotte-mason) | No standalone share; folded into eclectic; large curriculum market (Wild + Free 177K+ community, TGTB "fastest-growing") | Market/community footprint only |
| 4 | [Unschooling / child-led / interest-led / delight-directed](#unschooling--child-led--interest-led--delight-directed) | ~5-20% depending on strictness of definition | Survey (unscientific) + federal proxy |
| 5 | [Traditional / school-at-home / boxed curriculum](#traditional--school-at-home--boxed-curriculum) | ~5% standing stock; much higher as the newcomer entry point (flow, not stock) | Survey (unscientific) |
| 6 | [Montessori](#montessori) | No homeschool-population data; 15,763 Montessori schools worldwide (institutional base) | Institutional footprint only |
| 7 | [Unit studies](#unit-studies) | No standalone share; ubiquitous as a component, rare as a sole method | Market/curriculum footprint only |
| 8 | [Online / virtual charter "school-at-home"](#online--virtual-charter-school-at-home) | 240K+ students (Stride alone), 100K+ (Connections Academy) | Public-company/school-enrollment data (legally not homeschooling) |
| 9 | [Microschools / hybrid / learning pods](#microschools--hybrid--learning-pods) | 750K-2.1M total enrolled nationally (RAND estimate); ~53% self-report serving homeschoolers | Sector-analysis survey |
| 10 | [Waldorf](#waldorf) | No homeschool-population data; 1,092+ Waldorf schools worldwide, 5-8 dedicated homeschool curricula | Institutional + curriculum-market footprint |
| 11 | [Reggio Emilia / project-based homeschooling](#reggio-emilia--project-based-homeschooling) | No data; "increasingly popular," no accrediting body, no census | Qualitative consensus only |
| 12 | [Forest school / nature-based homeschooling](#forest-school--nature-based-homeschooling) | Small absolute base, fast growth (one network: 3,000+ across 6-9 states; 800 nature preschools nationally, +200% since 2017) | Named-organization self-report |
| 13 | [Thomas Jefferson Education / Leadership Education](#thomas-jefferson-education--leadership-education-tjed) | Self-reported 25,000+ families worldwide, 200,000+ books sold | Organization self-report |
| 14 | [Worldschooling / roadschooling](#worldschooling--roadschooling) | No population data; a lifestyle label, not a pedagogy | Qualitative/social-media visibility only |
| 15 | [Gameschooling](#gameschooling) | No population data; a technique label used inside other methods | Qualitative/social-media visibility only |
| 16 | [Principle Approach / Noah Plan](#principle-approach--noah-plan) | No population data; publisher's own copy calls it "isn't quite as common" | Self-description |
| 17 | [ACE / School of Tomorrow](#ace--school-of-tomorrow) | Peak self-reported 80,000 homeschool families (1980s-90s); no current homeschool-specific count found | Historical organization self-report, likely declined |
| 18 | [Sudbury model / self-directed education (SDE)](#sudbury-model--self-directed-education-sde) | ~40 schools worldwide; almost never used as a homeschool label | Institutional footprint, near-zero homeschool overlap |
| — | [Deschooling](#deschooling-not-a-method) | Not a philosophy; a universally-recommended transition phase | N/A, included because parents use the word |

Confidence: Medium-High on rank order for entries 1-9 (multiple converging signals);
Low-Medium on precise rank order for entries 10-18 (single-signal or qualitative only,
order between adjacent entries is not load-bearing).

## 3. Method profiles

Each profile: what it is, where it came from, what a day looks like, the
curriculum/provider ecosystem, the best-available popularity evidence, and a framing
note for how Homa should talk about it if a mom names it. Classical, Charlotte Mason,
Unschooling, and Eclectic get shorter entries here because `08-segments-curricula.md`
§7 already has full "wants / rejects / where she shops" cards for them; this file
cross-links rather than duplicates.

### Eclectic

Not a philosophy but a mode: assembling boxed curriculum, homemade materials, and
individualized picks per child, per subject, rather than following one system.
[NHERI-hosted study](https://nheri.org/home-school-researcher-parent-perspectives-curriculum-and-homeschooling-approaches/)
(accessed 2026-07-10): 68% self-ID, the plurality in every measurement that exists.
Emerged as a named identity in the 1990s as curriculum options exploded
([numaschool](https://numaschool.com/learn/methods/eclectic), accessed 2026-07-10,
Tier 4 source, directional only). The scholarly literature calls drift-to-eclectic
"one of the most consistent findings" in homeschool research: new families start
structured, then relax toward eclectic within 1-2 years to avoid burnout ([Kunzman &
Gaither](https://www.icher.org/files/Kunzman_and_Gaither_An%20Updated_Comprehensive_Survey.pdf),
accessed 2026-07-10). Full detail: `08-segments-curricula.md` §2, §7 Card 4.

**Framing for Homa**: per-child, per-subject flexibility; permission to change
mid-year; never force her into one method's vocabulary.

### Classical / Classical Christian

The trivium: grammar-stage memorization (K-6), logic-stage analysis (6-9), rhetoric-
stage articulation (9-12), often with Latin. 14% self-ID ([NHERI-hosted
study](https://nheri.org/home-school-researcher-parent-perspectives-curriculum-and-homeschooling-approaches/),
accessed 2026-07-10); CAUTION, a Tier-4 site's "21%, 2026 NHERI update" claim is
unverified. Institutional spillover is real and measured: 1,551 classical schools
enrolled ~677,500 students in 2023-24 (39% home-based), projected to 1.4M students by
2035 ([Discovery Institute/Arcadia analysis](https://www.discovery.org/education/2024/03/06/the-surging-growth-of-k-12-classical-education/),
accessed 2026-07-10). Classical Conversations self-reports 45,000-50,000+ families
([CC](https://classicalconversations.com/community-search/), accessed 2026-07-10).
Anchor curricula: Memoria Press, The Well-Trained Mind, Classical Conversations. Full
detail: `08-segments-curricula.md` §2-4, §7 Card 1.

**Framing for Homa**: mastery and sequence language, never "play-based progress";
never appear to do the child's own thinking for them.

### Charlotte Mason

Living books over textbooks, short lessons, narration instead of tests, nature study,
"atmosphere, discipline, life." Named for the 19th-century British educator. No
standalone population share exists in any dataset; the method is "typically practiced
inside eclectic mixes" ([numaschool](https://numaschool.com/learn/methods/foundations),
accessed 2026-07-10, Tier 4). Its footprint shows up in the market instead: Wild +
Free grew from a 2014 Instagram account to a community of 177,000+ by ~2020 with
conferences, a retreat property, and $19/mo bundles ([Homeschool Compass
interview](https://homeschoolcompass.com/the-call-of-the-wild-free-an-interview-with-ainsley-arment/),
accessed 2026-07-10); The Good and the Beautiful is called "one of the fastest-growing
homeschool curricula in the US" ([Homeschool Fox](https://homeschoolfox.com/curriculum/the-good-and-the-beautiful),
accessed 2026-07-10, Tier 4). The signature idea, "twaddle" (dumbed-down content, not
worksheets per se), is a real landmine word in this community. Full detail:
`08-segments-curricula.md` §3-4, §7 Card 2.

**Framing for Homa**: habit and narration growth, observed; book suggestions and
nature-study prompts before worksheets; never percentile or drill language.

### Unschooling / child-led / interest-led / delight-directed

A cluster of closely related but genuinely distinct terms, worth separating because
parents use them differently:

- **Unschooling** (coined by John Holt): the strongest version, no curriculum, no
  assignments, learning as "a natural by-product of ordinary experience." 13%
  self-ID ([NHERI-hosted study](https://nheri.org/home-school-researcher-parent-perspectives-curriculum-and-homeschooling-approaches/),
  accessed 2026-07-10); a federal proxy for "always informal, never formal
  curriculum" gives ~5% ([NHES:2019 codebook](https://nces.ed.gov/nhes/data/2019/pfi/cbook_pfi_pu.pdf),
  accessed 2026-07-10, recomputed within homeschoolers). CAUTION, other sites quote 7%
  or "10-20%" with no traceable source ([worldmetrics](https://worldmetrics.org/homeschooling-statistics/),
  accessed 2026-07-10, Tier 4).
- **Delight-directed / interest-led** learning is explicitly *not* the same thing,
  despite overlapping vocabulary: it keeps a parent-set structure and core subjects,
  and channels the child's interests inside that structure. One educator's summary:
  "if Charlotte Mason and unschooling had a baby" ([Numa
  glossary](https://numaschool.com/learn/glossary/delight-directed-learning), accessed
  2026-07-10, Tier 4). A practicing parent's distinction: "most homeschoolers who
  follow a delight-directed path do use some curriculum, especially for the 3Rs...
  Unschooling is not really considered homeschooling at all" ([Ben and
  Me](https://www.benandme.com/delight-directed-learning-is-this-the-same-as-unschooling-or-child-led/),
  accessed 2026-07-10).
- **Self-directed education (SDE)** is the academic umbrella term for the whole
  family (unschooling, Sudbury, democratic free schools); see the [Sudbury
  entry](#sudbury-model--self-directed-education-sde) for why it is mostly a
  physical-school phenomenon, not a homeschool one.

Full segment detail for unschooling proper: `08-segments-curricula.md` §7 Card 3.

**Framing for Homa**: opt-in evidence, never uninvited grade-level language;
compliance automation is welcomed even by strict unschoolers, verbatim: "I thought
that was a genius tool" ([The 74](https://www.the74million.org/article/homeschoolers-embrace-ai-even-as-many-educators-keep-it-at-arms-length/),
accessed 2026-07-10, re-cited from §08). Delight-directed families will accept more
structure than pure unschoolers; do not collapse the two in copy.

### Traditional / school-at-home / boxed curriculum

A pre-packaged, ready-to-use curriculum system, run at home like a school day. The
"most common type" by definition in older literature, but empirically the *least*
common standing identity: 5% self-ID ([NHERI-hosted
study](https://nheri.org/home-school-researcher-parent-perspectives-curriculum-and-homeschooling-approaches/),
accessed 2026-07-10). The gap between "least common standing share" and "everyone's
starting point" is the key fact: newcomers default here, then drift toward eclectic
within 1-2 years, commonly cited as happening around "November and February" burnout
points ([Simple Homeschool citing Susan Wise Bauer](https://simplehomeschool.net/everyone-wants-to-quit/);
[Jess Connell](https://jessconnell.com/2016/02/03/did-you-know-february-is-homeschool-burnout-month/),
both accessed 2026-07-10). Anchor curricula: Abeka, BJU Press, Time4Learning,
Miacademy, Power Homeschool. Full detail: `08-segments-curricula.md` §4, §7 Card 6.

**Framing for Homa**: grade-level language is her native tongue and is fine at first;
the product's job is the same one eclectic drift does naturally, help her relax the
model over time rather than cement it.

### Montessori

Developed by Dr. Maria Montessori in early-1900s Rome: child-led work cycles (2-3
hours, ideally uninterrupted), hands-on sensorial materials, a "prepared environment"
where every shelf is placed for independent choice, mixed-age learning, the parent
observes more than instructs. Most rigorous ages 0-6, increasingly extended through
elementary and adolescence via accredited home programs ([Homeschool
Moment](https://homeschoolmoment.com/homeschool-methods/montessori), accessed
2026-07-10, Tier 4).

FACT (institutional scale, the strongest number in this whole file): the [2022 Global
Montessori Census](https://doi.org/10.17161/jomr.v8i2.18675) (accessed 2026-07-10)
counted 15,763 Montessori schools worldwide, ~9% government-funded, the US as the
single largest national concentration. No equivalent census exists for
Montessori-at-home; the census itself states "no such comprehensive accounting
exists" for homeschool adoption. FACT: pure classroom Montessori is hard to run for
one family because it was designed for 20-30 mixed-age children with a trained guide;
most home practitioners land on "Montessori-inspired" (materials and prepared shelves
in the morning, eclectic or workbook-based work later) rather than the full method
(same source). Authentic materials are expensive; many families DIY or buy used.

**Framing for Homa**: independence and self-selected "work," not "worksheets";
readiness-based introduction of new material rather than age/grade pacing; respect
that "Montessori-inspired" is the modal real-world practice, not the purist classroom
version, so materials should not assume a full three-hour uninterrupted work cycle is
happening at home.

### Unit studies

Organizes learning around a single theme (e.g. Ancient Egypt) for 2-8 weeks,
integrating history, science, geography, art, and writing into that theme; math and
phonics are almost always run as a separate, sequential track because they don't
integrate naturally ([Numa glossary](https://numaschool.com/learn/glossary/unit-study-method),
accessed 2026-07-10, Tier 4; [Homeschool Start
Guide](https://homeschoolstartguide.com/blog/homeschool-unit-studies), accessed
2026-07-10, Tier 4). Its single biggest structural advantage is multi-age teaching:
one parent runs one topic at multiple depths for children years apart, "saves over
half of your teaching and preparing time" ([TheHomeSchoolMom](https://www.thehomeschoolmom.com/unit-study-approach/),
accessed 2026-07-10). CAUTION: the widely-repeated "children retain 45% more
information" claim traces back to unit-study advocacy sites with no primary study
cited; treat as UNVERIFIABLE, not fact. Anchor curricula: KONOS (character-based,
ages 4-14), Five in a Row (ages 4-8), Gather 'Round Homeschool (explicitly multi-age),
Moving Beyond the Page; Sonlight and My Father's World function like long-running
unit studies even though they're branded as literature-based/Charlotte-Mason-adjacent.
No standalone population share exists; it shows up constantly as a component inside
eclectic and Charlotte-Mason-flavored homeschools, rarely as someone's sole identity.

**Framing for Homa**: theme-first materials read as native to this family (a
worksheet or printable framed around one topic across subjects, not a generic drill
sheet); expect math/phonics to be handled by a separate track and don't try to force
those into the theme.

### Online / virtual charter "school-at-home"

Not a pedagogy at all: full-time enrollment in a state-funded virtual public school
(curriculum, teachers, grading, transcripts, all provided by the school), delivered to
the child's home. Legally this is public-school enrollment, not homeschooling, but
day-to-day it is functionally identical to school-at-home for the family, and many
parents will describe it using the word "homeschool" regardless. FACT: Stride, Inc.
(the K12-branded network) reported serving more than 240,000 students and families in
FY2025 ([Stride Q4 2025 earnings call](https://www.aol.com/articles/stride-lrn-q4-2025-earnings-181950908.html),
accessed 2026-07-10). FACT: Connections Academy (operated by Pearson, a separate
network from Stride) states "100K+" on its own homepage ([Connections
Academy](https://www.connectionsacademy.com/), accessed 2026-07-10); individual state
schools run 5,000-6,400+ students each (South Carolina, Ohio school profiles, accessed
2026-07-10). INFERENCE: combined enrollment across all virtual charter operators
(Stride, Connections/Pearson, StrongMind, Pansophic, others) plausibly exceeds
500,000-1M nationally, though no single consolidated count was found; treat that
combined figure as UNVERIFIABLE.

**Framing for Homa**: a mom in this category is often not legally a "homeschooler" at
all and has an assigned public-school teacher and curriculum; Homa's value to her is
different, supplementing or filling gaps beside an existing school program, not
replacing a curriculum decision she didn't make. Do not assume state homeschool
compliance/paperwork applies to her; virtual charter enrollment carries its own public
school reporting, separate from homeschool law.

### Microschools / hybrid / learning pods

A delivery format, not a philosophy: small (median 20-36 students), multi-age,
often teacher-founded learning environments that can run any pedagogy inside them
(Montessori-inspired, Reggio-inspired, classical, or none in particular). FACT: RAND's
oft-cited range is 750,000 to 2.1 million students nationally using microschools as
their main schooling provider ([National Microschooling Center 2025 sector
analysis](https://microschoolingcenter.org/hubfs/American%20Microschools%202025.pdf),
accessed 2026-07-10, citing RAND). FACT: 53% of microschools report serving as
learning centers for families following state homeschool requirements, vs 30%
functioning as private schools and 5% as public charter programs (same source).
INFERENCE: applying that 53% to the RAND range implies roughly 400,000-1.1M
homeschool-classified students inside microschools specifically (my computation).
FACT: median annual cost per student is $8,239, well under the $45,189 average at
comparable small independent day schools ([National Microschooling Center via
LinkedIn](https://www.linkedin.com/posts/don-soifer-012125a1_the-cost-of-educating-children-in-microschools-activity-7468383306653257728-Whbd),
accessed 2026-07-10). Growth is durable, not a pandemic blip: only 16% of surveyed
microschools opened in the last year, 45% have run 3-5 years, 1 in 5 have run 6+ years
([The 74, "7 Things to Know About Microschools in 2026"](https://www.the74million.org/article/exclusive-7-things-to-know-about-microschools-in-2026/),
accessed 2026-07-10).

**Framing for Homa**: this family may be homeschooling 2-4 days a week and attending a
pod or microschool the rest; keeping a coherent record across both settings is her
real pain, echoing §08 §3's "homeschooler increasingly means home 2-4 days a week."
Never assume she's the sole instructor every day.

### Waldorf

Founded 1919 by Rudolf Steiner at a factory school in Stuttgart, Germany; three
developmental stages (roughly 0-7, 7-14, 14-21), each with its own pedagogy: delayed
formal academics, storytelling and imaginative play before drilled skills, artistic
"main lesson books" the child illustrates, beeswax and watercolor over worksheets,
"head, heart, and hands." FACT: 1,092+ Waldorf schools in 64 countries and 1,857
kindergartens worldwide, one of the largest independent school movements on Earth
([Numa](https://numaschool.com/learn/methods/waldorf), accessed 2026-07-10, Tier 4,
figure attributed to the movement's own count). No homeschool-population survey data
exists. FACT: Waldorf was designed for a trained classroom teacher running 20+ mixed-
age children over 8 years, so translating it to one family at home is explicitly
called "tricky," and the traditional Waldorf-school community is "often skeptical of
homeschooling" ([homeschoolpicks](https://homeschoolpicks.com/homeschool-methods/waldorf-homeschooling-guide/),
accessed 2026-07-10, Tier 4). Curriculum ecosystem, ranked purist-to-accessible:
Live Education! and Christopherus (most traditional, highest parent effort), Starpath
Learning (modern platform, teacher-led), Waldorf Essentials and Lavender's Blue
(secular, plug-and-play), Earthschooling and Enki (affordable, flexible), Oak Meadow
(the only widely-cited accredited option, lowest "Waldorf purity" but most structure)
([Starpath comparison](https://www.starpathlearning.com/library/waldorf-homeschool-curriculum-comparison-2026),
accessed 2026-07-10).

**Framing for Homa**: rhythm (daily, weekly, seasonal) matters more than content
coverage; materials should lean toward story, art, and nature over worksheets and
never push early reading against the family's own timeline; a genuine Waldorf family
may explicitly avoid screens for children under seven, which has direct implications
for any AI-delivered material aimed at that age.

### Reggio Emilia / project-based homeschooling

Originated in Reggio Emilia, Italy after WWII (city rebuilding its early-childhood
schools under psychologist Loris Malaguzzi); treats the child as inherently capable
and curious, uses the physical environment as "the third teacher," and organizes
learning around emergent, child-led projects rather than a fixed curriculum or
sequence ([NAEYC](https://www.naeyc.org/resources/pubs/yc/nov2015/emergent-curriculum),
accessed 2026-07-10). FACT, stated plainly by advocates themselves: "It is less a
method than an approach or philosophy. There's no prescribed curriculum, or materials,
or developmental expectations. You can't train specifically to be a Reggio teacher,
and anyone can use the term ... as there is no accrediting body"
([fearlesshomeschool.com](https://fearlesshomeschool.com/project-based-homeschooling/),
accessed 2026-07-10). "Project-based homeschooling" is the home-adapted name,
popularized by Lori Pickert, a former Reggio school director turned homeschooling mom
(same source). No census or survey data exists at all; the only consistent qualitative
signal is "increasingly popular" and "gained recognition" language across independent
sources. Traditionally an early-childhood/elementary approach; less commonly extended
through the teen years.

**Framing for Homa**: materials should follow the child's current project/interest
rather than a subject-and-grade grid; a request from this family is more likely to be
"help me build on what she's already curious about" than "give me a worksheet for
grade 3 science."

### Forest school / nature-based homeschooling

Originated in Scandinavia, arrived in the US in the 1960s; centers the outdoors as the
primary classroom, with academic content (when present) taught through nature
observation. FACT: as of the last measured school year, ~800 nature preschools
operated in the US, a 200%+ increase since 2017 ([Natural Start Alliance survey via
LA Times](https://www.latimes.com/environment/story/2024-09-09/children-are-glued-to-screens-and-stuck-inside-can-forest-schools-offer-an-antidote/),
accessed 2026-07-10). FACT: Barefoot University, a homeschool-specific forest-school
network founded in Dallas in 2019, grew to serve 3,000+ students across six states by
2022-23 and expected 9-11 states the following year ([Fox
News](https://www.foxnews.com/us/homeschool-forest-group-enrollment-soars-parents-escape-one-size-fits-all-public-schools-founders-say),
accessed 2026-07-10). FACT: 42% of nature schools nationally are unlicensed, which
means they can't access public funding and skew toward families who can pay tuition
out of pocket (same LA Times source). INFERENCE: this is a real and fast-growing
category but still small in absolute K-12 homeschool terms relative to eclectic,
classical, or unschooling; it is usually a one-day-a-week supplement to an existing
homeschool, not a full-time sole curriculum (Barefoot University model: "one day a
week... they keep with their home-school curriculum the other days," same Fox News
source).

**Framing for Homa**: often a supplement, not the whole program; nature-study logging
and outdoor-observation prompts fit here more than seated worksheets, overlapping
heavily with Charlotte Mason's nature-study tradition.

### Thomas Jefferson Education / Leadership Education (TJEd)

Also called "Leadership Education"; a family-centered philosophy built on "classics,
mentoring, and self-directed scholarship," organized into four developmental phases
(Core, Love of Learning, Scholar, Depth). Popularized from 1999 by Oliver and Rachel
DeMille's book *A Thomas Jefferson Education* ([Wikipedia](https://en.wikipedia.org/wiki/Thomas_Jefferson_Education),
accessed 2026-07-10). FACT (organization self-report): the current organization claims
200,000+ copies of the founding book sold, 25,000+ families worldwide, a 15,000+
member Facebook group ([leadershipeducation.org](https://leadershipeducation.org/),
accessed 2026-07-10). CAUTION: this is a self-reported figure from the organization
selling the philosophy, not an independent count; treat the specific numbers as
directional only. The method has a real, sourced controversy: Oliver DeMille's
associated institution (George Wythe University) published an account of "misdeeds"
by its founders, and long-running community critique calls the method's actual
implementation vague ("hardly anything practical in the philosophy") even from
sympathetic forum posters ([Well-Trained Mind forum](https://forums.welltrainedmind.com/topic/361490-thomas-jefferson-education/),
accessed 2026-07-10). A defender's counter-framing: "If you view TJEd not as a method
but rather a set of principles that can be applied to whatever curriculum ... you will
be on the road to understanding" (same forum thread).

**Framing for Homa**: this is a devoted niche with real internal disagreement about
what "doing TJEd" even means in practice; if a mom names it, ask what she means by it
rather than assuming a fixed curriculum exists, because for many practitioners there
isn't one.

### Worldschooling / roadschooling

Lifestyle-format labels describing *where* learning happens, not a pedagogy for *how*:
worldschooling means learning through international travel, roadschooling through
domestic travel (RV/road-trip families), both cutting across any underlying
philosophy (a worldschooling family might be classical, eclectic, or unschooling
underneath). Trend coverage frames both as gaining "mainstream traction" alongside
remote-work growth ([2026 homeschool trends
roundups](https://essentialsinwriting.com/top-10-homeschooling-trends-for-2026/),
accessed 2026-07-10, Tier 4, no population data provided). No census, survey, or
organization-membership number was found for either term; visibility is driven almost
entirely by social media and travel-blogger content, not measured population share.

**Framing for Homa**: irregular schedules, non-standard "school year" boundaries, and
location-based content (a specific country, region, or landmark) are the actual signal
to design around; don't assume a fixed daily rhythm or home base.

### Gameschooling

A technique, not a standalone philosophy: using board games, video games, and
tabletop play as the primary or supplementary teaching tool for specific skills (math
facts, strategy, reading), most often layered inside an eclectic or delight-directed
homeschool rather than practiced alone. Appears consistently in 2025-2026 homeschool
trend roundups as one of several rising techniques, with no independent population
data, organization, or census found anywhere in this research pass.

**Framing for Homa**: a request naming this is almost always "make this feel like a
game," not a request for a different curriculum scope or sequence; treat it as a
delivery-format preference layered on top of whatever her actual method is.

### Principle Approach / Noah Plan

A Christian method that grounds every subject in Biblical reasoning via the "4Rs":
Research, Reason, Relate, Record, built on primary-source study of Noah Webster's 1828
dictionary, the Bible, and American founding documents. Published and taught by the
Foundation for American Christian Education (FACE), whose curriculum is called the
Noah Plan ([face.net](https://face.net/the-principle-approach/), accessed 2026-07-10).
FACT (self-description from within the community itself): a Principle Approach
publisher's own explainer lists Charlotte Mason, Traditional, Classical, Christian
Classical, Hebraic Classical, Eclectic, and Free Range as the "many common
philosophies," then states plainly "the Principle Approach isn't quite as common
among homeschools" ([Principled Academy](https://principledacademy.com/what-is-a-principle-approach-homeschool/),
accessed 2026-07-10). No population data exists beyond that self-description. Distinct
from generic "Christian classical": the Principle Approach specifically requires the
4R notebook method and Webster's 1828 dictionary as a worldview lens, which a
generic classical Christian family would not necessarily use.

**Framing for Homa**: if a mom names this specifically (not just "classical Christian"
or "Bible-based"), she is signaling a smaller, more specific community with its own
vocabulary (4Rs, Notebook Method, Providential history); using generic classical-
Christian language here would read as not-quite-right to her.

### ACE / School of Tomorrow

A Bible-based, mastery-oriented, self-instructional K-12 curriculum founded in 1970 by
Donald and Esther Howard, historically one of the earliest homeschool-curriculum
pioneers ([MinistryWatch](https://ministrywatch.com/profile-of-early-pioneer-in-homeschooling-curriculum-accelerated-christian-education/),
accessed 2026-07-10). FACT: at its self-reported peak the company claimed 7,000-8,000
schools and 80,000 homeschooling families; more recent self-reported figures state
"over 6,000 schools in 145 countries" without separating school-based use from
homeschool use ([Wikipedia](https://en.wikipedia.org/?title=School_of_Tomorrow),
accessed 2026-07-10). No current, independently-verified homeschool-family count
exists; INFERENCE, given the declining figures across successive company disclosures
(8,000 schools in the 1980s down to 6,000 today, same source) and the near-total shift
of the homeschool curriculum market toward newer publishers since the 1990s (§08 §4),
this method's homeschool footprint has likely shrunk from its historical peak, though
no hard number confirms the current scale.

**Framing for Homa**: treat as a legacy/institutional brand more than an active growth
segment; a mom naming it is likely referencing either a long personal history with it
or a private-school-adjacent use, not necessarily today's mainstream homeschool
market.

### Sudbury model / self-directed education (SDE)

A form of democratic education, not homeschooling: students have complete
responsibility for their own education and the school itself is run by direct
democracy where students and staff vote as equals on rules, hiring, and policy, with
no curriculum, tests, or grades ([Wikipedia](https://en.wikipedia.org/wiki/Sudbury_school),
accessed 2026-07-10). Named for the founding Sudbury Valley School (Framingham,
Massachusetts, 1968), with roughly 40 affiliated schools worldwide since (same
source). FACT, stated forcefully by the founding school itself: "Sudbury Valley School
and 'Un-schooling' Have NOTHING in Common," because Sudbury is a self-governing
institutional community, not a family-led home practice ([Sudbury Valley
School](https://sudburyvalley.org/article/lets-be-clear-sudbury-valley-school-and-un-schooling-have-nothing-common),
accessed 2026-07-10). This is the rarest entry in this file as an actual homeschool
label: it is almost exclusively a physical-school model, and the community that
invented it explicitly disclaims the homeschooling comparison that outsiders
frequently draw.

**Framing for Homa**: if a mom uses the words "Sudbury" or "self-directed education,"
she is likely describing either an actual school her child attends part-time, or
borrowing SDE's philosophical language to describe her own unschooling-adjacent
practice; ask which, don't assume it means unschooling.

### Deschooling, not a method

Not a philosophy or method at all: a temporary transition period, typically recommended
at roughly one month of decompression per year the child spent in traditional school,
where families deliberately step back from schedules, worksheets, and grade-level
expectations before starting any homeschool method. Universally recommended across
homeschool-community advice regardless of which method the family ends up choosing;
included in this glossary specifically because parents (especially brand-new ones,
mid-year school pullouts, or crisis withdrawals) use the word as if it names a style,
when it names a phase.

**Framing for Homa**: a mom in an active deschooling window is telling Homa she does
not want grade-level materials, drills, or a "curriculum" framing right now, regardless
of what method she eventually lands on; the right response is patience and low-
pressure engagement, not a style question.

## 4. What this means for the six segment cards in §08

Cross-check against `08-segments-curricula.md` §7's AI-framing cards: every finding in
this file is additive, not contradictory. The one sharpening worth carrying back:
§08's "no share data, folded into eclectic" note for Montessori, Charlotte Mason, and
unit studies (§08 line 56, "known gaps") is CONFIRMED as still true as of 2026-07-10;
no new survey has closed that gap. The institutional-footprint numbers in this file
(15,763 Montessori schools, 1,092+ Waldorf schools) should never be read as
homeschool-population numbers when they get cited in product copy or agent
instructions; they measure something else (global school infrastructure), and
conflating the two would be a factual error Homa could make in front of a parent who
knows better.

## 5. How to keep this file alive

This is explicitly meant to be appended to, not treated as a one-time snapshot:

- **New methods surface constantly.** If a mom names something not in §2/§3 (a new
  curriculum-branded "method," a new lifestyle label, a new online-school-choice
  format), add it as a new subsection in §3 with the same FACT/INFERENCE/CAUTION
  discipline, then re-sort §2's ranked table if its footprint changes the order.
- **Numbers go stale, especially the fast movers.** Microschool enrollment, virtual
  charter enrollment, and forest-school growth are all measured annually by named
  organizations (National Microschooling Center, Stride's quarterly earnings, Natural
  Start Alliance); re-check those specific sources yearly rather than re-researching
  the whole file. Date-stamp every update the way this file's header is dated.
- **A survey closing the ranking gap in §1 would be the single most valuable update
  possible.** Watch for any future NHES PFI fielding or a probability-sample survey
  that offers a full named-philosophy menu (not just the four legacy categories); if
  one publishes, it should promote several "no data" entries in §2 to real percentages.
- **Log surprising corrections in `docs/homa-planning/build-log.md`** per repo
  convention, the same way §08's Heggerty correction and religious-framing correction
  were logged, if a future update meaningfully changes how Homa should talk to a
  segment.

## 6. Open question for product: how should Homa actually use this file at runtime

This file answers "what's out there and how big is it," which was the ask. It does not
yet answer "how does the live agent pull from it." Worth a deliberate founder call
before building anything, because there are real trade-offs: a static excerpt baked
into agent instructions (simple, but bloats the system prompt and goes stale silently),
a dedicated skill file the agent reads on demand when a style is mentioned (matches the
existing `agent/skills/worksheet-studio/SKILL.md` pattern, keeps the main prompt lean),
or a lookup keyed off the `styles` field already captured in the onboarding context bag
(`packages/core/src/map/schemas.ts`'s `HOMESCHOOL_STYLES`, currently: montessori,
charlotte_mason, classical, reggio, waldorf, unit_studies, unschooling, eclectic,
traditional). Note that enum is narrower than this glossary: it has no code for
online/virtual charter, microschool/hybrid, forest school, TJEd, Principle Approach,
ACE, worldschooling/roadschooling, gameschooling, or Sudbury/SDE, all of which real
moms will name. Closing that gap is a separate, scoped decision, not assumed by this
research file.

## Appendix: source quality tiers used in this file

Same discipline as `08-segments-curricula.md`'s appendix:

- Tier 1, cite as fact: primary organization data checked directly (NHERI-hosted
  study, the 2022 Global Montessori Census, Stride's SEC-filed earnings, Connections
  Academy school profiles, National Microschooling Center sector analyses, Natural
  Start Alliance survey, Wikipedia pages sourced to primary founding documents).
- Tier 2, cite with attribution: journalism with named sourcing (Fox News, LA Times,
  Forbes, The 74, Business Insider), sector-analysis nonprofits' own reports.
- Tier 3, directional only, flagged inline: self-reports by interested organizations
  (TJEd's 25,000-family claim, ACE's historical 80,000-family claim, Wild + Free's
  community-size claim, Classical Conversations' family count).
- Tier 4, used only for definitions, prices, and curriculum-provider names, never for
  market-share claims: SEO review/comparison sites (numaschool, homeschoolpicks,
  homeschoolmoment, homeschoolstartguide, howdoihomeschool, worldmetrics,
  starpathlearning) and personal blogs. Any specific percentage sourced only to one of
  these sites is marked UNVERIFIABLE in this file, never adopted as fact.
- Known gaps, stated rather than papered over: no probability-sample survey has ever
  offered a full named-philosophy menu; Montessori, Charlotte Mason, Waldorf, unit
  studies, Reggio/project-based, forest school, worldschooling, roadschooling, and
  gameschooling all lack any homeschool-specific population count as of 2026-07-10.
