# Atlas backlog

What the atlas does not cover yet, in rough priority order, plus the
longer-term acquisition and ingestion roadmap. "Every curriculum ever" is
the north star; this file is the honest distance meter.

## Wave 2 candidates (categories not yet profiled)

- High school and upper grades: VideoText, Shormann Math, Fascinating
  Education, Apologia advanced sciences, Notgrass high school, dual
  enrollment patterns, Sonlight high school levels. (Mr. D Math and
  Outschool, originally listed here, landed in wave 1 under
  `curricula/online-digital/`.)
- Catholic publishers: Seton Home Study, Catholic Heritage Curricula,
  Mother of Divine Grace, Homeschool Connections.
- Special needs and intervention: Barton Reading and Spelling, LiPS,
  Equipping Minds, learning-ally style audiobook ecosystems, and how
  Orton-Gillingham programs position for dyslexia.
- Preschool: Playing Preschool (Busy Toddler), The Peaceful Press early
  years, Before Five in a Row, Blossom and Root Early Years, Lovevery
  (adjacent), tot-school culture.
- Foreign language: Getting Started with Spanish/Latin/French, Song School
  Latin and Spanish, Duolingo in homeschool practice, Rosetta Stone
  homeschool, Cherrydale Press.
- Electives: typing (Typing.com, TypingClub, Nitro Type), coding (CodaKid,
  Scratch culture, CodeCombat), art (Artistic Pursuits, Meet the Masters,
  Chalk Pastels), music (Hoffman Academy, SQUILT), logic (The Fallacy
  Detective, Critical Thinking Co.).
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
   `docs/homa-benchmarks/13-curriculum-crosswalk-math.md`. SEEDED
   2026-07-13: `sequences/dimensions-math.yaml` (grade 2 at lesson level,
   6-8 at chapter level, remaining levels linked as pending); schema and
   protocol in `sequences/README.md`.
3. Skill-graph crosswalk: map extracted sequences onto `packages/taxonomy/`
   nodes so "we finished Dimensions Math 2A" resolves to skill states in
   Homa's map.
4. Materials pattern library: distill worksheet and lesson anatomy patterns
   (bar model progression, decodable ramp design, narration prompts,
   copywork formats) into guidance for Homa's materials studio, as original
   patterns, not clones.
5. Front matter index script: parse atlas front matter into JSON for
   product use (onboarding autocomplete, "tell me about your curriculum"
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
