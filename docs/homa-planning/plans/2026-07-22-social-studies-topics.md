# Social studies assessment topics: sourcing for founder review

Date: 2026-07-22. Status: CONTENT FOR FOUNDER REVIEW, shipped as a
PR that stays open until reviewed (content is founder-gated, per the
material-anchors precedent). 60 topics fill the three empty assessment
domains: geography-maps (21), civics-government (18), economics-money
(21), authored against the C3 Framework, NCSS themes, Head Start ELOF,
and state standards (Virginia SOL, Texas TEKS) for age corroboration.

The standards columns below are REVIEW EVIDENCE ONLY: the shipped
records carry `standards: []` because these codes do not resolve in
curriculum-standards.json (the machine-checked registry), and an
unresolvable code fails check:taxonomy. The citation lives here so the
review can check every age band against its source.

A deliberate mechanism deviation, flagged: these topics route INTO the
reserved assessment ids (geography-maps, civics-government,
economics-money) via new MARBLE_DOMAIN_MAP entries, and the matching
AUTHORED_DOMAINS rows are removed in the same change so domain ids stay
unique. The 2026-07-21 inspo-flywheel precedent minted non-colliding
content-kind ids instead; populating the reserved assessment domains is
exactly what those ids were reserved FOR, but the deviation is named
here so it is a decision, not an accident. family-community stays
reserved until it has topics.

## Geography & Maps

| Topic | Ages | Standards cited |
|---|---|---|
| Position words for everyday things | 3-5 | Head Start ELOF Goal P-MATH 10; TEKS SS K.4.A |
| Knowing the places in their day | 3-5 | NCSS Theme 3: People, Places, and Environments |
| Pictures stand for real places | 3-5 | c3-social-studies:D2.Geo.1.K-2 |
| Drawing a first map of a familiar place | 4-7 | c3-social-studies:D2.Geo.1.K-2; TEKS SS 1.5.A |
| What maps and globes are | 5-7 | c3-social-studies:D2.Geo.3.K-2; TEKS SS K.4.C; VA SOL HSS K.4 (2015) |
| Reading map symbols and colors | 5-8 | c3-social-studies:D2.Geo.2.K-2; VA SOL HSS K.4 (2015); TEKS SS 2.5.A |
| Landform and water words | 6-9 | TEKS SS 1.6.A |
| North, south, east, and west on a map | 6-9 | VA SOL HSS 1.5 (2015); TEKS SS 2.5.A |
| Finding their state and the United States on a map | 5-8 | VA SOL HSS 1.5 (2015); TEKS SS 2.6.B |
| First look at continents and oceans | 6-9 | VA SOL HSS 1.5 (2015); TEKS SS 2.6.A |
| Giving directions to a familiar place | 6-9 | TEKS SS 2.5.B; NCSS Theme 3: People, Places, and Environments |
| Making a map with a title, key, and compass rose | 7-10 | c3-social-studies:D2.Geo.1.3-5; VA SOL HSS 1.5 (2015); TEKS SS 3.5.D |
| Drawing their neighborhood from memory | 7-10 | c3-social-studies:D2.Geo.1.3-5; NCSS Theme 3: People, Places, and Environments |
| Using a real map on an outing | 7-10 | c3-social-studies:D2.Geo.2.K-2; TEKS SS 2.5.A |
| Finding places with a letter and number grid | 7-10 | TEKS SS 3.5.C |
| In-between directions like northeast | 8-11 | TEKS SS 3.5.A |
| Using a map scale to judge distance | 8-11 | c3-social-studies:D2.Geo.3.3-5; TEKS SS 3.5.B |
| Finding the 50 states on a map | 8-11 | TEKS SS 5.6.C; NCSS Theme 3: People, Places, and Environments |
| Equator, poles, and hemispheres | 8-10 | VA SOL HSS 3.5 (2015); CA HSS 4.1.2 |
| Physical maps and political maps | 9-11 | c3-social-studies:D2.Geo.2.3-5; TEKS SS 5.6.B; TEKS SS 5.6.C |
| Latitude and longitude basics | 9-11 | CA HSS 4.1.1 |
## Civics & Government

| Topic | Ages | Standards cited |
|---|---|---|
| Following rules at home | 3-5 | Head Start ELOF Goal P-ATL 2 (preschool 3-5): follows classroom rules and routines |
| Why rules exist | 4-7 | c3-social-studies:D2.Civ.3.K-2; VA 2023 HSS SOL K.1c; TX TEKS 113.11(b)(7)(A) |
| Fair ways to decide | 4-7 | c3-social-studies:D2.Civ.8.K-2; c3-social-studies:D2.Civ.9.K-2 |
| Who is in charge and why | 4-7 | c3-social-studies:D2.Civ.1.K-2; TX TEKS 113.11(b)(8)(A); TX TEKS 113.11(b)(8)(B) |
| Voting to decide together | 5-8 | TX TEKS 113.11(b)(9)(C); VA 2023 HSS SOL 1.1f; c3-social-studies:D2.Civ.11.K-2 |
| Being a good neighbor | 5-8 | VA 2023 HSS SOL 1.1e; c3-social-studies:D2.Civ.7.K-2; NCSS Theme 10: Civic ideals and practices |
| Rules at home, laws in town | 6-8 | TX TEKS 113.12(b)(10)(A); TX TEKS 113.12(b)(10)(B); c3-social-studies:D2.Civ.3.K-2 |
| Solving problems together | 6-9 | c3-social-studies:D2.Civ.6.K-2; c3-social-studies:D2.Civ.11.K-2; c3-social-studies:D2.Civ.14.K-2 |
| What a government does | 7-9 | c3-social-studies:D2.Civ.5.K-2; TX TEKS 113.13(b)(8)(A); TX TEKS 113.13(b)(8)(B) |
| Mayor, governor, president | 7-9 | TX TEKS 113.13(b)(9)(A); TX TEKS 113.13(b)(9)(B); VA 2023 HSS SOL K.3d |
| Rights and responsibilities | 7-10 | VA 2023 HSS SOL 2.1; TX TEKS 113.12(b)(12)(A); c3-social-studies:D2.Civ.8.3-5 |
| Elections choose our leaders | 7-10 | TX TEKS 113.13(b)(9)(C); VA 2023 HSS SOL 1.1g; c3-social-studies:D2.Civ.2.3-5 |
| Town, state, and country governments | 8-10 | TX TEKS 113.14(b)(7)(A); TX TEKS 113.14(b)(7)(C); VA 2023 HSS SOL 3.9d |
| Groups of people make our laws | 8-11 | c3-social-studies:D2.Civ.4.3-5; c3-social-studies:D2.Civ.3.3-5; VA 2023 HSS SOL 3.9e |
| What good citizens do | 8-11 | TX TEKS 113.13(b)(10)(A); TX TEKS 113.13(b)(10)(C); VA 2023 HSS SOL 3.1 |
| Talking through rule disagreements | 8-11 | c3-social-studies:D2.Civ.9.3-5; c3-social-studies:D2.Civ.10.3-5 |
| The three branches of government | 9-11 | VA 2023 HSS SOL 3.9c; TX TEKS 113.16(b)(15)(A) |
| Changing unfair rules | 9-11 | c3-social-studies:D2.Civ.12.3-5; c3-social-studies:D2.Civ.14.3-5 |
## Economics & Money

| Topic | Ages | Standards cited |
|---|---|---|
| Money buys things | 3-5 | NCSS Theme 7: Production, Distribution, and Consumption |
| Sorting wants from needs | 4-7 | VA HSS SOL 2.13b (2023); VA HSS SOL 1.8e (2023) |
| Choosing when you can't have both | 5-7 | c3-social-studies:D2.Eco.1.K-2; VA HSS SOL K.8b (2023) |
| Naming the coins | 5-7 | TEKS Math K.4; VA Math SOL K.7 (2016) |
| How people earn money | 5-7 | c3-social-studies:D2.Eco.6.K-2; VA HSS SOL K.8a (2023); TEKS Math K.9A |
| What each coin is worth | 6-8 | TEKS Math 1.4A; VA Math SOL K.7 (2016, pennies-per-coin equivalences) |
| Goods and services | 6-8 | VA HSS SOL 1.8a (2023); c3-social-studies:D2.Eco.3.K-2; c3-social-studies:D2.Eco.4.K-2 |
| Counting coins that match | 6-8 | TEKS Math 1.4C; VA Math SOL 1.8 (2016, like coins to 100 cents) |
| Choosing to spend or save | 6-8 | TEKS Math 1.9C; c3-social-studies:D2.Eco.10.K-2 |
| Reading and comparing prices | 7-9 | c3-social-studies:D2.Eco.5.K-2; VA Math SOL 2.7 (2016, comparing money amounts) |
| Counting mixed coins | 7-9 | TEKS Math 2.5A; VA Math SOL 2.7 (2016); ccss-math:2.MD.8 |
| Barter, trading, and why money helps | 7-9 | VA HSS SOL 2.13c (2023); c3-social-studies:D2.Eco.5.3-5 |
| Producers and consumers | 6-9 | VA HSS SOL 1.8b (2023); TEKS Math 2.11F; c3-social-studies:D2.Eco.3.K-2 |
| Saving up for a small goal | 7-9 | c3-social-studies:D2.Eco.10.K-2; CEE/Jump$tart 2021 Saving 4-1, 4-2a; VA HSS SOL 1.8c (2023) |
| Making change | 8-10 | VA Math SOL 3.6 (2016, making change from $5.00 or less); ccss-math:2.MD.8 |
| What banks do | 8-10 | c3-social-studies:D2.Eco.9.3-5; TEKS Math 2.11C; CEE/Jump$tart 2021 Saving 4-4 |
| Trade-offs and what you give up | 8-10 | c3-social-studies:D2.Eco.1.3-5; VA HSS SOL 3.10d (2023); CEE/Jump$tart 2021 Spending 4-3 |
| Specializing and trading | 8-11 | c3-social-studies:D2.Eco.4.3-5; VA HSS SOL 3.10c (2023) |
| Comparison shopping | 9-11 | CEE/Jump$tart 2021 Spending 4-5 (4-5b, 4-5c) |
| Budgeting an allowance | 9-11 | TEKS Math 4.10D; TEKS Math 5.10F |
| Borrowing and paying back | 8-11 | TEKS Math 2.11D; CEE/Jump$tart 2021 Managing Credit 4-1 |

## Author sourcing notes

### Geography & maps

SOURCING. C3 Framework wording and codes verified against the official NCSS PDF (https://www.socialstudies.org/sites/default/files/c3/C3-Framework-for-Social-Studies.pdf) and the Smithsonian Learning Lab standards index (https://learninglab.si.edu/standards/view/2893): D2.Geo.1.K-2 construct maps of familiar places, D2.Geo.2.K-2 use maps and photographs to describe places, D2.Geo.3.K-2 use maps and globes to identify characteristics of places, D2.Geo.1.3-5 construct maps of familiar and unfamiliar places, D2.Geo.2.3-5 use maps and images to explain location relationships, D2.Geo.3.3-5 use maps of different scales. Virginia: VA SOL HSS 1.5 (2015) locate community, Richmond, Virginia, the United States, the continents and oceans on a map and globe, and construct a simple map with cardinal directions, scale, and symbols; VA 3.5 (2015) position continents and oceans and use the equator and prime meridian to identify the four hemispheres (https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/history-and-social-science/standards-of-learning, https://www.longwood.edu/staff/hardinds/VirginiaSOL_Geog.html, https://sites.google.com/a/lcps.k12.va.us/history/home/third-grade/3-5). Texas TEKS (19 TAC ch. 113, https://tea.texas.gov/about-tea/laws-and-rules/texas-administrative-code/19-tac-chapter-113): K.4.A relative-location terms, K.4.C maps and globes as location tools (https://www.twinkl.com/resources/social-studies-kindergarten-texas-essential-knowledge-and-skills-usa), 2.5.A basic map elements with orientation, 2.5.B create maps of places and routes, 2.6.A continents and oceans on maps and globes, 3.5.A cardinal and intermediate directions, 3.5.B scale for distance, 3.5.C compass rose, grid system, symbols, 3.5.D create maps with title, compass rose, legend, scale, grid (https://www.twinkl.com/resources/social-studies-grade-3-texas-essential-knowledge-and-skills-usa), 5.6.B/5.6.C locate important physical and political features including the 50 states (https://www.teacherspayteachers.com/Product/TEKS-56C-Political-Features-of-the-United-State-MapCapitals-5th-Grade-SS-7298691). California HSS 4.1.1 latitude and longitude coordinate grid and 4.1.2 poles, equator, prime meridian, tropics, hemispheres (https://www2.cde.ca.gov/cacs/history?c0=5%2C12, corroborated by grade-4 and grade-5 placement at https://www.internet4classrooms.com/grade_level_help/geography_latitude_longitude_fourth_4th_grade_social_studies.htm). Head Start ELOF Goal P-MATH 10, ages 3-5, directionality and position language (https://www.learnwithshelly.com/head-start-early-learning-outcomes/cognition/mathematics-development/geometry-and-spatial-sense).

AGE-BAND RATIONALE. Grade-to-age mapping used: K=5-6, G1=6-7, G2=7-8, G3=8-9, G4=9-10, G5=10-11, widened by about a year each way for homeschool spiral teaching. The three age-3 topics (position words, places in their day, pictures stand for real places) are pre-standards foundations so the founder's 3-year-old scavenger hunter has real rungs; ELOF is the only formal framework covering them. The 50-states topic starts at 8 rather than TEKS's grade 5 because states-and-capitals work commonly runs grades 3-5 in homeschool curricula and the founder's 9-year-old scenario needs it; the TEKS 5.6.C citation is the ceiling, not the floor.

MACHINE-RESOLVABLE VS CORROBORATION REFS. Only refs in the form c3-social-studies:D2.Geo.N.band resolve in packages/taxonomy/data/curriculum-standards.json (codes-only source; verified present). Topics.json standards arrays use the <curriculum-slug>:<code> format (818 existing topics follow it). VA SOL, TEKS, NCSS, ELOF, and CA HSS refs in my standards arrays are age-corroboration citations only: they DO NOT resolve and MUST be stripped before the record ships or check:taxonomy fails on unresolved standards. Eleven topics carry a resolvable C3 ref; the rest should ship standards: [] with the citations preserved in the PR description.

UNCERTAINTY FLAGS. (1) Virginia renumbered its HSS SOL in 2023 (continents and oceans now appears as 2.11 per a 2023-aligned listing); I cited the widely documented 2015 codes and labeled them (2015). (2) Texas began a grade 3 renumbering per the TEA 2024-25 crosswalk (https://tea.texas.gov/academics/subject-areas/social-studies/grade-3-2024-2025-crosswalk.pdf), so 3.5.A-D may carry new numbers in current TEA text; statements themselves are verified. (3) TEKS 5.6.B/5.6.C and CA 4.1.1/4.1.2 wording came from secondary sources (TPT, newpathworksheets, CDE search index), not a primary fetch of the statute text. (4) "Pictures stand for real places" has no direct standard code; it is grounded in symbolic-development research (DeLoache-style model-room tasks, around age 3) and cited to C3 D2.Geo.1.K-2 as the standard it feeds; flag for founder judgment.

OVERLAP DECISIONS VS BANK AND EXISTING TOPICS. Bank items pinned to geography-maps: place-words 60mo, maps-real 78mo, city-state 90mo, continents-oceans 108mo, maps-scale 130mo (packages/core/src/map/content.ts:437-445). My topics are deliberate finer rungs: position words (3-5) sits under place-words; what-maps-and-globes-are covers the map-vs-globe distinction the bank lacks but shares 'maps show real places' with maps-real; finding-their-state is finding-on-map under city-state's naming; first-look-at-continents is the earlier rung under continents-oceans; map-scale and 50-states topics unpack the two clauses of the composite maps-scale item, accepted overlap because the founder's scavenger-hunt scenario needs a dedicated states rung. The content-kind geography domain (History > Geography) already holds "Reading a Map: Map Key and Four Directions" (5-7) and "Nested Address: Neighborhood to World" (5-7); those are content topics, not scorable, but my "North, south, east, and west on a map" and "Reading map symbols and colors" cover adjacent ground in the assessment domain on purpose. The mechanism agent's fully worked example topic (Using a Compass Rose to Name Directions, 6-8) is superseded by my "North, south, east, and west on a map"; do not add both.

VOICE COMPLIANCE. The banned word for deficit framing is also a common spatial preposition; I scrubbed it everywhere and used "in back of" instead, at a small cost in naturalness; founder may relax this for literal spatial vocabulary. No em dashes anywhere. Names are sentence case and will kebab-case to non-colliding slugs distinct from all five bank item ids. Prerequisites listed are hard prerequisites only, all internal to this list, exact-name matched, and acyclic (every edge points from a later topic to an earlier one in the ladder).

### Civics & government

SOURCING. C3 indicators verified verbatim from the LACOE C3 instructional guides for K-2 and 3-5 (lacoe.edu/.../Grades%20K-2%20Guide.pdf and Grade%203-5%20Guide.pdf, text extracted locally with pdftotext). Virginia refs are the 2023 History and Social Science SOL as approved 4-20-2023 (official text mirrored at wischools.org/wp-content/uploads/History-and-SS-Standards.pdf); sub-letters like K.1c, 1.1e-g, 2.1, 3.1, 3.9a/c/d/e verified against that text. Texas refs are the adopted-2018 streamlined TEKS, Chapter 113 Subchapter A (tea.texas.gov/sites/default/files/113a_11-16-2018.pdf), cited with the 2018 renumbering: K purpose of rules is (b)(7), K authority figures (b)(8), K voting (b)(9)(C); Grade 1 rules and laws (b)(10), good citizenship (b)(12)(A); Grade 2 purpose of governments (b)(8), public officials (b)(9), good citizenship (b)(10); Grade 3 levels of government (b)(7); Grade 5 three branches (b)(15)(A). NCSS themes (Theme 6 Power, authority, and governance; Theme 10 Civic ideals and practices) from socialstudies.org's National Curriculum Standards executive summary. ELOF Goal P-ATL 2 (follows rules and routines, preschool 3-5) verified via a published ELOF alignment document; the bank already uses elof as a source label.

STANDARDS RESOLUTION WARNING (load-bearing for check:taxonomy). Only refs of the form c3-social-studies:CODE resolve via getStandard against packages/taxonomy/data/curriculum-standards.json (checked against the file: every c3 key I cite exists there; D2.Civ.4.K-2 and D2.Civ.13.K-2 correctly do not exist since C3 starts them in 3-5, and I never cite them). VA SOL, TX TEKS, NCSS, and ELOF refs are age-grounding documentation only: they MUST be dropped from the shipped topics.json record's standards array or check:taxonomy fails on unresolved refs (scripts/taxonomy-check.mts:190-192). "Following rules at home" has no resolvable ref at all; ship it with standards: [].

AGE-BAND RATIONALE. Grade-to-age mapping: C3 "by end of grade 2" means about age 8 and "by end of grade 5" about age 11; state grades map K 5-6, gr1 6-7, gr2 7-8, gr3 8-9, gr5 10-11. Ladder highlights: rules and fairness topics sit at the K-2 band; government structure topics (what a government does, leaders, layers) follow VA and TEKS grade 2-3 placement; lawmaking, branches, and changing laws sit in the 3-5 band. Judgment calls, flagged: the age-4 starts on "Why rules exist", "Fair ways to decide", and "Who is in charge and why" extend one year below the K standards on the strength of ELOF preschool practice, and the age-9 start for "The three branches of government" follows VA 3.9c (grade 3 teaches identify-level branches) even though Texas waits until grade 5.

BANK COMPLEMENT, DELIBERATE. "The three branches of government" is an identify-level rung below the bank capstone social_studies.government-branches (150mo, "Explains how laws get made and what the branches of government do"); it names and matches, the capstone explains. "Who is in charge and why" takes the authority-and-responsibility angle to stay clear of bank social_studies.helpers (54mo job knowledge). "Talking through rule disagreements" is a family-scale rung far below bank current-events (186mo). "Town, state, and country governments" naturally assumes the bank's city-state naming item (90mo), but the prerequisites field can only reference topics in this list, so that dependency is unstated. No symbols topic on purpose: symbols were not in the requested domain slice and the content-kind civic-life domain already carries "Symbols of the United States" (5-7).

OVERLAP FLAGS FOR THE FOUNDER. The content-kind civic-life domain (mapping.ts "History > Civic Life") already has "Voting to Choose Leaders" and "Community Laws and Local Leaders" at 5-7; my voting topics take the practice-and-mechanism angle (family voting, how elections work) rather than the content angle, but the founder may want to eyeball them side by side. "Talking through rule disagreements" is adjacent to the social_emotional topic "Seeing Someone Else's Point of View" (7-9, empathy-social-awareness domain); mine is civic-deliberation flavored per C3 D2.Civ.9/10.3-5, cut it if it reads as a duplicate. "Being a good neighbor" and "What good citizens do" intentionally split young helping habits from older civic-virtue understanding; they could merge if 17 topics feels heavy.

INTEGRATION NOTES. Names are sentence case per this task's instruction; upstream Marble records in topics.json use Title Case, and the frozen slug is unaffected by casing, so the integrator can adjust at append time. Wiring these into the reserved civics-government id requires a new MARBLE_DOMAIN_MAP pair (for example "History > Civics & Government", which collides with no existing key) plus deleting the AUTHORED_DOMAINS civics-government row, deviating from the 2026-07-21 reserved-id precedent recorded at packages/taxonomy/src/mapping.ts:99-112; per the mechanism recipe this deviation must be flagged in the PR. The prerequisite graph among these 18 topics is acyclic and every prerequisite's age band starts at or before its dependent's.

RESIDUAL UNCERTAINTY. Texas's bracketed strike-through revision format makes TEKS subsection renumbering error-prone; I cross-read the 2018 PDF carefully but recommend verifying any (b)(N) code against the live Texas Administrative Code before it appears in parent-facing copy. The Virginia 2023 SOLs are under review for revision (VDOE review page, 2025-2026), so VA codes may shift in a future adoption.

### Economics & money

SOURCING. C3 economics indicator text verified verbatim from the LACOE C3 instructional planning guides (K-2: https://www.lacoe.edu/content/dam/lacoeedu/documents/curriculum-instruction/hss/c3-framework/Grades%20K-2%20Guide.pdf; 3-5: https://www.lacoe.edu/content/dam/lacoeedu/documents/curriculum-instruction/hss/c3-framework/Grade%203-5%20Guide.pdf), which reproduce the official framework (https://www.socialstudies.org/sites/default/files/c3/C3-Framework-for-Social-Studies.pdf, 403s to direct fetch). NCSS Theme 7 (Production, Distribution, and Consumption) confirmed via socialstudies.org standards pages. Virginia 2023 History and Social Science SOL text read directly from the board-approved 4-20-23 document (mirror: https://interactive.wusa9.com/pdfs/Virginia-BOE-History-and-Social-Science-SOL-as-Approved-4-20-23.pdf): K.8a/b (earn and save to buy needs and wants; must make choices), 1.8a/b/c/e (goods vs services, consumers and producers, earn and save, prioritizing needs over wants), 2.13b/c/d (needs vs wants, barter vs money, scarcity requires choices), 3.10c/d (specialize and trade for the rest, economic choice and opportunity cost). Note this PDF is labeled a pre-final-publication draft; codes could shift in the edited publication. CEE/Jump$tart 2021 National Standards for Personal Financial Education read directly (https://www.councilforeconed.org/wp-content/uploads/2021/10/2021-National-Standards-for-Personal-Financial-Education.pdf): Spending 4-3 (opportunity cost), Spending 4-5b/c (price and advertising influence, comparing products), Saving 4-1/4-2 (spend now vs save, savings plan), Saving 4-4 (safe places for money), Managing Credit 4-1 (interest is the price a borrower pays). TEKS math verified via TEA-derived snapshots and Texas classroom sources: K.4 coins by name, K.9A ways to earn income, 1.4C skip counting like coins, 1.9C distinguish spending and saving, 2.5A value of coin collection to one dollar, 2.11C deposit vs withdrawal, 2.11D responsible vs irresponsible borrowing, 4.10D allocate weekly allowance among spending, saving, sharing, 5.10F balance a simple budget. Virginia 2016 math SOL: K.7 verified verbatim (coin attributes and pennies-per-coin); 1.8 (like coins to 100 cents) and 2.7 (count and compare to $2.00) via VDOE-aligned resources.

UNCERTAINTY FLAGS (founder-gated honesty). (1) VA Math SOL 3.6 (make change from $5.00 or less) comes from aligned teaching resources plus my prior knowledge, not the raw VDOE document; treat the code as probable but unconfirmed. (2) TEKS 1.4A (coin values and relationships) and 2.11F (producers/consumers) subsection letters are from secondary snapshots; the strand placement is certain, the letters slightly less so. (3) The VA 2023 HSS PDF is the pre-publication draft. (4) "Money buys things" (ages 3-5) has no graded standard anywhere; pre-K placement is developmental convention, cited only to the NCSS Theme 7 umbrella. (5) "Sorting wants from needs" starts at 4 although formal codes sit at grades 1-2 (VA 1.8e, 2.13b); pre-K programs commonly introduce it, so the band leads the codes by about a year. (6) "Borrowing and paying back": TEKS teaches borrowing at grade 2 (2.11D, age 7-8) while CEE places credit at the grade 4 band; the 8-11 band is a judgment call splitting that divergence.

REPO-RESOLVABILITY LAW. Only standards entries formatted as c3-social-studies:CODE or ccss-math:CODE resolve in packages/taxonomy/data/curriculum-standards.json via getStandard; all VA, TEKS, CEE/Jump$tart, and NCSS refs above are age corroboration for review and MUST be dropped from the topics.json standards array or check:taxonomy fails (taxonomy-check.mts:190-192). I verified every c3-social-studies:D2.Eco.* key I used exists in the repo file. One extraction gap found: the C3 framework has D2.Eco.9.K-2 (describe the role of banks in an economy) but the repo file only starts Eco 9 at 3-5, so "What banks do" cites D2.Eco.9.3-5. Also absent from the repo file: Eco 8.K-2 and 11.K-2, which the framework itself defers to 3-5, so only 9.K-2 is a true gap.

AGE-BAND RATIONALE. Grade-to-age mapping K=5-6 through grade 5=10-11, widened roughly a year for homeschool pacing variance. The coin-skills ladder (naming 5-7, values 6-8, like-coin counting 6-8, mixed coins 7-9, change 8-10) tracks TEKS/VA math grades K through 3 exactly. Conceptual economics tracks C3 bands: K-2 indicators land in 5-9 bands, 3-5 indicators in 8-11 bands, cross-checked against VA HSS grade placements.

COMPLEMENTARITY WITH BANK ITEMS. No topic restates social_studies.money-basics (100mo, integrated earn/spend/save explanation) or social_studies.savings-plan (122mo, formal plan mostly stuck to). "How people earn money" and "Choosing to spend or save" are deliberate finer rungs below money-basics; "Saving up for a small goal" (7-9, jar-and-short-wait) is the earlier rung below savings-plan; "Budgeting an allowance" is allocation across purposes, distinct from savings-plan's single-goal plan. Sensible topics.json prerequisite edges to bank-adjacent taxonomy are possible later, but all declared prerequisites here are within this list, per instructions.

MECHANISM NOTE FOR THE PARENT AGENT. Landing these inside economics-money requires the same two-step as the geography-maps recipe: add a MARBLE_DOMAIN_MAP entry (proposed key "History > Economics & Money", Marble subject must stay "History" to satisfy MARBLE_TO_HOMA in validate.mjs) AND delete the AUTHORED_DOMAINS economics-money row at packages/taxonomy/src/domains.ts:35 in the same change, or check:taxonomy fails on duplicate domain ids. This deviates from the 2026-07-21 reserved-id precedent at mapping.ts:99-112 and should be flagged in the PR. Names here are sentence case per Homa voice law; the topics.json Marble convention is Title Case, so convert at append time. Kebab slugs of these names collide with no bank item ids (checked money-basics, savings-plan, and the rest of MAP_SUBJECTS social_studies ids).

