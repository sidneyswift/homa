# Atlas backlog

What the atlas does not cover yet, in rough priority order, plus the
longer-term acquisition and ingestion roadmap. "Every curriculum ever" is
the north star; this file is the honest distance meter.

## Wave 2 (completed 2026-07-13, five parallel agents)

DONE: high school and upper grades, Catholic publishers, special needs
and intervention, preschool, and languages and electives: 42 new
profiles and 5 comparison docs, validated by `pnpm check:atlas`.

## Wave 2b (completed 2026-07-13, four parallel agents)

DONE: online academies and unit studies, international providers
(including Twinkl and Wolsey Hall), coding and accessibility ecosystems
(closing the two bullets wave 2 left open), and the Etsy and printable
marketplace lane: 26 new profiles and 5 comparison docs (atlas total
155 profiles, 18 comparisons). Canada was covered inside
`comparisons/international.md` by design (no single dominant product;
funding flows through provincial schools). Same-day sequence wave:
10 more curricula extracted into `sequences/` (see its coverage table).
- Unit study systems: Konos, Amanda Bennett, Gather Round deep dive if
  wave 1 left it standard.
- Writing-specific deep dives: WriteShop, Essentials in Writing, Night
  Zookeeper writing claims, The Write Foundation.
- Online academies and live-class providers: Veritas Scholars Academy,
  Memoria Academy, The Potter's School, Wilson Hill, Excelsior Classes,
  Outschool deep-dive by category.
- Charter/ESA vendor ecosystems: which curricula are purchasable with
  charter funds and ESA wallets, vendor approval dynamics, and what that
  does to market share (link `06-regulatory-esa-landscape.md`).
- International: UK (national curriculum-aligned home ed materials),
  Australia (Euka, My Homeschool), Canada, and the missionary-family
  market that Sonlight historically served.
- Print-and-teach marketplaces: TPT is profiled
  (`marketplaces/teachers-pay-teachers.md`, 2026-07-13). Still open: the
  Etsy printables economy, and per-category studies of what homeschool
  moms actually assemble from marketplaces.
- TPT study library: founder purchase of a handful of top-selling bundles
  from dominant stores (Moffatt Girls, Miss Giraffe, One Stop Teacher
  Shop, a top SOR decodables line) for internal study of what wins;
  files stay outside the repo per methodology.

## Wave 3: from atlas to asset

The step that turns descriptions into a usable baseline.

1. Acquisition: founder purchases core sets for internal study (top 10 by
   mindshare first: TGTB, Dimensions Math, Saxon, Math-U-See, All About
   Reading, Apologia, Story of the World, Abeka samples, Teaching
   Textbooks trial, Beast Academy trial). Purchased materials stay outside
   this repo. Study notes and structural analyses come back into the atlas
   as descriptions, never reproductions.
2. Scope and sequence extraction: for each flagship and deep profile,
   extract the full topic list per level into structured data (topic lists
   are facts), following the pattern proven in
   `docs/homa-benchmarks/13-curriculum-crosswalk-math.md`. FLAGSHIP
   COMPLETE 2026-07-13: `sequences/dimensions-math.yaml` covers all 20
   levels PK-8 at lesson level (152 chapters, 971 lessons, publisher
   pacing). Schema and protocol in `sequences/README.md`; next targets
   listed there (Saxon, Math with Confidence, All About Reading, Story
   of the World, TGTB LA).
3. Skill-graph crosswalk: map extracted sequences onto `packages/taxonomy/`
   nodes so "we finished Dimensions Math 2A" resolves to skill states in
   Homa's map. SEEDED 2026-07-13:
   `sequences/crosswalks/dimensions-math-grade2.yaml` (15 chapters to 43
   taxonomy topic ids, machine-verified against the taxonomy snapshot,
   status seed pending human review; schema and promotion rules in
   `sequences/crosswalks/README.md`). Remaining: review the seed, extend
   to other grades and curricula, then design product consumption.
4. Materials pattern library: DONE 2026-07-13, `materials-patterns.md`
   (16 patterns across format, pedagogy, and trust, each with atlas
   evidence and a Homa spec). Remaining: wire the priority patterns into
   the materials studio's generation contracts and calibration checks.
5. Front matter index script: DONE 2026-07-13.
   `scripts/curriculum-atlas-index.mts` validates the atlas
   (`pnpm check:atlas`) and generates `catalog.json`
   (`pnpm atlas:index`). Remaining: wire catalog consumption into the
   product (onboarding autocomplete, "tell me about your curriculum"
   grounding).

## Known gaps in wave 1 (review pass, 2026-07-13)

No profile came back thinner than its target tier. Facts the research
agents flagged in-profile as unverified or fragile, kept here so a later
pass can resolve them:

- Classical Conversations pricing is triangulated ranges (communities set
  their own tuition); no publisher price page exists.
- Ambleside Online has no usage statistics at all; mindshare is evidenced
  qualitatively.
- BJU Academy of Home Education exact annual fee: third-party figures
  conflicted; profile points at the AHE pages.
- Master Books "42,000 families" is self-reported.
- TGTB "award-winning language arts" is a publisher claim with no
  independent award record found.
- Time4Learning annual pricing is an estimate ("save 30% annually" is the
  only published figure).
- Mr. D Math third-party reviews carry stale prices; profile uses the
  official 2026-27 store figures.
- Generation Genius home pricing is inconsistent across its own channels;
  recorded as a range.
- BookShark levels beyond A/B are banded, not itemized.
- Global Village School tuition comes from third-party profiles.
- Story of the World's award record is only citable as a publisher claim.
- Curiosity Chronicles author's first name conflicts across sources
  (majority reading used).

Wave 2 additions (2026-07-13, flagged in-profile):

- Kolbe tuition tables render via JavaScript (tier ranges verified, not
  per-grade figures), and its high school course-designation system is
  mid-revision.
- TAN Academy "enrollment" has no verifiable description or price.
- Seton's founding year conflicts in its own materials (1980 vs 1982).
- The 400-500k Catholic homeschooler estimate is paywalled at source.
- Fascinating Education pricing is mid-migration between storefronts.
- Thinkwell's corporate history is unverifiable from current sources.
- No homeschool-specific dual-enrollment participation statistic exists;
  the high-school comparison uses system-wide numbers.
- Simply Classical set prices are retailer-triangulated (publisher's
  builder renders dynamically).
- Nessy's acquisition (ILT Education, 2024) rests on one secondary
  source; island counts and award list are publisher claims.
- TouchMath Blended pricing is quote-only.
- Barton's level-swap goodwill policy is documented only in parent
  reviews.
- Equipping Minds' evidence base is first-party.
- Elective usage-scale numbers (Hoffman 2M+, YAaA 21k families, Artistic
  Pursuits 100k) are all self-reported.
- Promo-volatile prices recorded as ranges: Rosetta Stone lifetime,
  Hoffman lifetime, Typing.com ad-free, SQUILT bundle.
