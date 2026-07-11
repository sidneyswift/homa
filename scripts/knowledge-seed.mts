/**
 * Seeds the knowledge bank from the methods glossary (HT-2; education
 * plan Layer 1 -> Layer 2). Content is hand-distilled from
 * docs/homa-planning/icp-research/10-homeschool-methods-glossary.md
 * (FACT/INFERENCE/CAUTION labeling and citations carried over) and runs
 * through the SAME gate as agent research: citations must resolve, text
 * is sanitized, rows land content-hashed. Re-running is safe: identical
 * content refreshes the freshness clock instead of duplicating.
 *
 * Usage: pnpm tsx scripts/knowledge-seed.mts
 * Env: apps/web/.env.local (SUPABASE_DB_PASSWORD).
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { assertConfirmedProdWrite } from "./prod-write-guard.mts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI or when env arrives from the shell.
}

assertConfirmedProdWrite({
  scriptName: "knowledge-seed",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

// Env must load before the db module reads it (usage-report.mts pattern).
const { mergeKnowledgeRow } = await import("../apps/web/lib/knowledge/gate");
const { mapDb } = await import("../apps/web/lib/map/db");

const ACCESSED = "2026-07-10";

interface SeedRow {
  topicType: "method_philosophy" | "method_format";
  topicKey: string;
  title: string;
  summary: string;
  content: string;
  citations: Array<{ url: string; accessedAt: string; claim: string }>;
  confidence: "high" | "medium" | "low";
  sourceTier: number;
}

const ROWS: SeedRow[] = [
  {
    topicType: "method_philosophy",
    topicKey: "eclectic",
    title: "Eclectic homeschooling: the plurality identity",
    summary:
      "Eclectic is a mode, not a philosophy: families assemble boxed curriculum, homemade materials, and per-child picks per subject. FACT: 68% self-identify eclectic, the plurality in every measurement that exists. Drift-to-eclectic within 1 to 2 years is one of the most consistent findings in homeschool research.",
    content:
      "FACT: 68% of surveyed homeschool parents self-identify as eclectic (NHERI-hosted parent-perspectives study), the plurality in every dataset that exists.\nFACT: the scholarly literature (Kunzman & Gaither's comprehensive survey) calls drift-to-eclectic 'one of the most consistent findings': new families start structured, then relax toward eclectic within 1 to 2 years to avoid burnout.\nApplication: per-child, per-subject flexibility is native to this family. Give permission to change mid-year; never force one method's vocabulary onto them; expect a mix (a boxed math spine beside homemade unit studies is normal, not inconsistency).",
    citations: [
      {
        url: "https://nheri.org/home-school-researcher-parent-perspectives-curriculum-and-homeschooling-approaches/",
        accessedAt: ACCESSED,
        claim: "68% of homeschool parents self-identify as eclectic.",
      },
      {
        url: "https://www.icher.org/files/Kunzman_and_Gaither_An%20Updated_Comprehensive_Survey.pdf",
        accessedAt: ACCESSED,
        claim: "Drift from structured to eclectic within 1 to 2 years is a consistent research finding.",
      },
    ],
    confidence: "high",
    sourceTier: 2,
  },
  {
    topicType: "method_philosophy",
    topicKey: "classical",
    title: "Classical education: trivium stages and a measured institutional surge",
    summary:
      "The trivium: grammar-stage memorization (K-6), logic-stage analysis, rhetoric-stage articulation, often with Latin. FACT: 14% self-ID; 1,551 classical schools enrolled about 677,500 students in 2023-24 (39% home-based), projected 1.4M by 2035. Anchors: Memoria Press, The Well-Trained Mind, Classical Conversations.",
    content:
      "FACT: 14% of homeschool parents self-identify classical (NHERI-hosted study). CAUTION: a Tier-4 site's '21%, 2026 NHERI update' claim is unverified.\nFACT: institutional spillover is real: 1,551 classical schools enrolled about 677,500 students in 2023-24, 39% home-based, projected to 1.4M students by 2035 (Discovery Institute/Arcadia analysis). Classical Conversations self-reports 45,000 to 50,000+ families.\nAnchor curricula: Memoria Press, The Well-Trained Mind, Classical Conversations.\nApplication: mastery and sequence language is her native register, never 'play-based progress'. Memory work (chants, timelines, Latin roots) reads as a feature, not a chore. Never appear to do the child's own thinking for them; materials support recitation and analysis, not shortcuts.",
    citations: [
      {
        url: "https://www.discovery.org/education/2024/03/06/the-surging-growth-of-k-12-classical-education/",
        accessedAt: ACCESSED,
        claim: "1,551 classical schools, ~677,500 students in 2023-24, 39% home-based, 1.4M projected by 2035.",
      },
      {
        url: "https://classicalconversations.com/community-search/",
        accessedAt: ACCESSED,
        claim: "Classical Conversations self-reports 45,000 to 50,000+ families.",
      },
    ],
    confidence: "high",
    sourceTier: 2,
  },
  {
    topicType: "method_philosophy",
    topicKey: "charlotte_mason",
    title: "Charlotte Mason: living books, narration, and the 'twaddle' landmine",
    summary:
      "Living books over textbooks, short lessons, narration instead of tests, nature study. No standalone population share exists; its footprint shows in the market instead (Wild + Free grew to 177,000+ community members; The Good and the Beautiful is called one of the fastest-growing curricula). 'Twaddle' (dumbed-down content) is a real landmine word.",
    content:
      "FACT: no standalone population share exists in any dataset; the method is typically practiced inside eclectic mixes.\nFACT: market footprint instead: Wild + Free grew from a 2014 Instagram account to 177,000+ community members by about 2020 with conferences and $19/mo bundles (Homeschool Compass interview); The Good and the Beautiful is repeatedly called one of the fastest-growing homeschool curricula.\nThe signature idea: 'twaddle' means dumbed-down content, not worksheets per se, and it is a landmine word in this community.\nApplication: habit and narration growth, observed, is the register. Book suggestions and nature-study prompts come before worksheets. Short lessons (10 to 20 minutes) are the norm; never percentile or drill language.",
    citations: [
      {
        url: "https://homeschoolcompass.com/the-call-of-the-wild-free-an-interview-with-ainsley-arment/",
        accessedAt: ACCESSED,
        claim: "Wild + Free grew from a 2014 Instagram account to a 177,000+ community.",
      },
      {
        url: "https://numaschool.com/learn/methods/foundations",
        accessedAt: ACCESSED,
        claim: "Charlotte Mason is typically practiced inside eclectic mixes.",
      },
    ],
    confidence: "medium",
    sourceTier: 3,
  },
  {
    topicType: "method_philosophy",
    topicKey: "unschooling",
    title: "Unschooling vs delight-directed: related but genuinely distinct",
    summary:
      "Unschooling (John Holt): no curriculum, no assignments, learning as a by-product of ordinary experience; 13% self-ID, a federal proxy gives about 5%. Delight-directed/interest-led is NOT the same: it keeps parent-set structure and core subjects and channels interests inside them. Do not collapse the two.",
    content:
      "FACT: 13% self-identify unschooling (NHERI-hosted study); a federal proxy for 'always informal, never formal curriculum' gives about 5% (NHES:2019 codebook, recomputed within homeschoolers). CAUTION: '7%' and '10-20%' figures circulate with no traceable source.\nFACT: delight-directed / interest-led learning keeps a parent-set structure and core subjects ('most delight-directed families do use some curriculum, especially for the 3Rs', Ben and Me); unschooling proper rejects curriculum entirely.\nApplication: opt-in evidence only, never uninvited grade-level language. Compliance automation is welcomed even by strict unschoolers ('I thought that was a genius tool', The 74). Delight-directed families accept more structure than pure unschoolers; never treat the labels as interchangeable.",
    citations: [
      {
        url: "https://nces.ed.gov/nhes/data/2019/pfi/cbook_pfi_pu.pdf",
        accessedAt: ACCESSED,
        claim: "A federal proxy puts always-informal homeschooling at about 5%.",
      },
      {
        url: "https://www.benandme.com/delight-directed-learning-is-this-the-same-as-unschooling-or-child-led/",
        accessedAt: ACCESSED,
        claim: "Delight-directed families typically keep some curriculum, unlike unschoolers.",
      },
      {
        url: "https://www.the74million.org/article/homeschoolers-embrace-ai-even-as-many-educators-keep-it-at-arms-length/",
        accessedAt: ACCESSED,
        claim: "Even strict unschoolers welcomed compliance automation.",
      },
    ],
    confidence: "medium",
    sourceTier: 2,
  },
  {
    topicType: "method_philosophy",
    topicKey: "traditional",
    title: "Traditional school-at-home: everyone's starting point, few stay",
    summary:
      "Pre-packaged curriculum run at home like a school day. FACT: only 5% keep it as a standing identity, yet it is the common starting point; families drift eclectic within 1 to 2 years, with burnout commonly cited around November and February. Anchors: Abeka, BJU Press, Time4Learning.",
    content:
      "FACT: 5% self-identify traditional/school-at-home as their standing identity (NHERI-hosted study), the LEAST common, despite being the default starting point for newcomers.\nFACT: the newcomer-to-eclectic drift within 1 to 2 years is repeatedly documented, with 'November and February' cited as the classic burnout points (Simple Homeschool citing Susan Wise Bauer).\nAnchor curricula: Abeka, BJU Press, Time4Learning, Miacademy, Power Homeschool.\nApplication: grade-level language is her native tongue at first and is fine. The product's job matches what eclectic drift does naturally: help her relax the school-at-home model over time rather than cement it. Expect rigid schedules early; offer flexibility gently, never as a correction.",
    citations: [
      {
        url: "https://nheri.org/home-school-researcher-parent-perspectives-curriculum-and-homeschooling-approaches/",
        accessedAt: ACCESSED,
        claim: "5% of homeschool parents self-identify traditional/school-at-home.",
      },
      {
        url: "https://simplehomeschool.net/everyone-wants-to-quit/",
        accessedAt: ACCESSED,
        claim: "November and February are commonly cited homeschool burnout points.",
      },
    ],
    confidence: "high",
    sourceTier: 2,
  },
  {
    topicType: "method_philosophy",
    topicKey: "montessori",
    title: "Montessori at home: 'Montessori-inspired' is the modal reality",
    summary:
      "Child-led work cycles, hands-on sensorial materials, a prepared environment, the parent observing more than instructing. FACT: the 2022 Global Montessori Census counted 15,763 schools worldwide with the US the largest concentration, and states plainly that no comprehensive accounting exists for homeschool adoption. Most home practitioners run 'Montessori-inspired', not the full method.",
    content:
      "FACT: the 2022 Global Montessori Census (Journal of Montessori Research) counted 15,763 Montessori schools worldwide, about 9% government-funded, the US the single largest national concentration; the census itself states no comprehensive accounting exists for Montessori-at-home.\nFACT: pure classroom Montessori was designed for 20 to 30 mixed-age children with a trained guide, so most home practitioners land on 'Montessori-inspired': materials and prepared shelves in the morning, eclectic or workbook work later. Authentic materials are expensive; many families DIY or buy used.\nApplication: independence and self-selected 'work', not 'worksheets'. Readiness-based introduction beats age/grade pacing. Never assume a full three-hour uninterrupted work cycle happens at home; design for the inspired-not-purist reality.",
    citations: [
      {
        url: "https://doi.org/10.17161/jomr.v8i2.18675",
        accessedAt: ACCESSED,
        claim: "The 2022 Global Montessori Census counted 15,763 schools; no homeschool accounting exists.",
      },
      {
        url: "https://homeschoolmoment.com/homeschool-methods/montessori",
        accessedAt: ACCESSED,
        claim: "Montessori is most rigorous ages 0-6 and extended at home via accredited programs.",
      },
    ],
    confidence: "high",
    sourceTier: 1,
  },
  {
    topicType: "method_philosophy",
    topicKey: "reggio",
    title: "Reggio Emilia at home: project-based, no curriculum by design",
    summary:
      "Treats the child as inherently capable, the environment as 'the third teacher', and organizes learning around emergent child-led projects. FACT, from advocates themselves: there is no prescribed curriculum, no materials list, no accrediting body. 'Project-based homeschooling' (Lori Pickert) is the home-adapted name. No census data exists.",
    content:
      "FACT: Reggio Emilia originated in post-WWII Italy under Loris Malaguzzi; emergent curriculum is the core mechanism (NAEYC).\nFACT, stated plainly by advocates: 'It is less a method than an approach or philosophy. There's no prescribed curriculum, or materials, or developmental expectations... there is no accrediting body' (fearlesshomeschool.com). 'Project-based homeschooling' is the home adaptation, popularized by Lori Pickert, a former Reggio school director.\nFACT: no census or survey data exists at all; the consistent qualitative signal is 'increasingly popular'. Traditionally early-childhood/elementary; less commonly extended through the teen years.\nApplication: follow the child's current project, not a subject-and-grade grid. A request from this family usually means 'help me build on what she's already curious about', not 'give me a grade 3 science worksheet'. Documentation of the child's thinking (photos, quotes, displays) is a first-class artifact.",
    citations: [
      {
        url: "https://www.naeyc.org/resources/pubs/yc/nov2015/emergent-curriculum",
        accessedAt: ACCESSED,
        claim: "Emergent curriculum is the Reggio-derived core mechanism.",
      },
      {
        url: "https://fearlesshomeschool.com/project-based-homeschooling/",
        accessedAt: ACCESSED,
        claim: "Reggio has no prescribed curriculum, materials, or accrediting body; project-based homeschooling is the home adaptation.",
      },
    ],
    confidence: "medium",
    sourceTier: 3,
  },
  {
    topicType: "method_philosophy",
    topicKey: "waldorf",
    title: "Waldorf at home: rhythm first, screens late, translation is tricky",
    summary:
      "Steiner's three developmental stages with delayed formal academics, storytelling and imaginative play before drilled skills, artistic main lesson books. FACT: 1,092+ Waldorf schools in 64 countries, one of the largest independent school movements; designed for trained classroom teachers, so home translation is explicitly called tricky. Genuine Waldorf families may avoid screens entirely under seven.",
    content:
      "FACT: 1,092+ Waldorf schools in 64 countries and 1,857 kindergartens worldwide (movement's own count via Numa). No homeschool-population survey data exists.\nFACT: Waldorf was designed for a trained classroom teacher running 20+ mixed-age children over 8 years; translating it to one family at home is explicitly called 'tricky', and the traditional Waldorf-school community is often skeptical of homeschooling.\nCurriculum ecosystem, purist to accessible: Live Education! and Christopherus (highest parent effort), Starpath Learning, Waldorf Essentials and Lavender's Blue (secular, plug-and-play), Earthschooling and Enki (affordable), Oak Meadow (the widely-cited accredited option, most structure).\nApplication: rhythm (daily, weekly, seasonal) matters more than content coverage. Lean toward story, art, and nature over worksheets; never push early reading against the family's own timeline. CAUTION: a genuine Waldorf family may avoid screens for children under seven, which directly shapes what an AI assistant should offer (printed and hands-on over on-screen).",
    citations: [
      {
        url: "https://numaschool.com/learn/methods/waldorf",
        accessedAt: ACCESSED,
        claim: "1,092+ Waldorf schools in 64 countries; 1,857 kindergartens worldwide.",
      },
      {
        url: "https://www.starpathlearning.com/library/waldorf-homeschool-curriculum-comparison-2026",
        accessedAt: ACCESSED,
        claim: "The Waldorf homeschool curriculum ecosystem ranked purist to accessible.",
      },
    ],
    confidence: "medium",
    sourceTier: 3,
  },
  {
    topicType: "method_philosophy",
    topicKey: "unit_studies",
    title: "Unit studies: theme-first, multi-age, with math and phonics apart",
    summary:
      "Learning organized around one theme for 2 to 8 weeks, integrating history, science, geography, art, and writing; math and phonics almost always run as a separate sequential track. The big structural win is multi-age teaching. CAUTION: the circulating 'retain 45% more' claim traces to advocacy sites with no primary study.",
    content:
      "Structure: one theme (Ancient Egypt, ocean life) carries 2 to 8 weeks of integrated content; math and phonics stay a separate sequential track because they do not integrate naturally.\nFACT: the biggest advantage is multi-age teaching: one parent runs one topic at multiple depths, 'saves over half of your teaching and preparing time' (TheHomeSchoolMom).\nCAUTION: the widely-repeated 'children retain 45% more information' claim traces to unit-study advocacy sites with no primary study cited; treat as unverifiable.\nAnchor curricula: KONOS, Five in a Row (ages 4-8), Gather 'Round, Moving Beyond the Page; Sonlight and My Father's World function like long-running unit studies.\nApplication: theme-first materials read as native (a printable framed around the current topic across subjects, not a generic drill sheet). Expect math/phonics handled separately; do not force them into the theme.",
    citations: [
      {
        url: "https://www.thehomeschoolmom.com/unit-study-approach/",
        accessedAt: ACCESSED,
        claim: "Multi-age unit-study teaching saves over half of teaching and preparation time.",
      },
      {
        url: "https://numaschool.com/learn/glossary/unit-study-method",
        accessedAt: ACCESSED,
        claim: "Unit studies integrate subjects around a theme for 2 to 8 weeks.",
      },
    ],
    confidence: "medium",
    sourceTier: 3,
  },
  {
    topicType: "method_format",
    topicKey: "online_charter",
    title: "Online/virtual charter: public school at home, not legally homeschool",
    summary:
      "Full-time enrollment in a state-funded virtual public school: curriculum, teachers, grading, transcripts all provided. Legally public-school enrollment, but many parents still say 'homeschool'. FACT: Stride/K12 served 240,000+ students in FY2025; Connections Academy states 100K+.",
    content:
      "FACT: Stride, Inc. (K12) reported serving more than 240,000 students and families in FY2025 (Q4 2025 earnings call). FACT: Connections Academy (Pearson) states '100K+' on its homepage; individual state schools run 5,000 to 6,400+ students each. INFERENCE: combined virtual-charter enrollment plausibly exceeds 500,000 to 1M nationally; no consolidated count exists, treat the combined figure as unverifiable.\nApplication: a mom in this category often is not legally a homeschooler; she has an assigned public-school teacher and curriculum. Homa's value is supplementing and filling gaps BESIDE an existing program, not replacing a curriculum decision she did not make. CAUTION: state homeschool compliance and paperwork do NOT apply to her; virtual charter enrollment carries its own public-school reporting.",
    citations: [
      {
        url: "https://www.connectionsacademy.com/",
        accessedAt: ACCESSED,
        claim: "Connections Academy states 100K+ students on its homepage.",
      },
      {
        url: "https://www.aol.com/articles/stride-lrn-q4-2025-earnings-181950908.html",
        accessedAt: ACCESSED,
        claim: "Stride reported serving more than 240,000 students and families in FY2025.",
      },
    ],
    confidence: "medium",
    sourceTier: 2,
  },
  {
    topicType: "method_format",
    topicKey: "microschool_hybrid",
    title: "Microschools and pods: home 2 to 4 days a week is the real pattern",
    summary:
      "A delivery format, not a philosophy: small multi-age learning environments (median 20 to 36 students) running any pedagogy. FACT: RAND's range is 750,000 to 2.1M students nationally; 53% of microschools serve families following state homeschool requirements. The family's real pain is one coherent record across settings.",
    content:
      "FACT: RAND's oft-cited range is 750,000 to 2.1 million students using microschools as their main schooling provider (National Microschooling Center 2025 sector analysis). FACT: 53% of microschools report serving families following state homeschool requirements, vs 30% as private schools and 5% as public charter programs (same source). INFERENCE: applying 53% to the RAND range implies roughly 400,000 to 1.1M homeschool-classified students inside microschools.\nFACT: growth is durable, not a pandemic blip: only 16% of surveyed microschools opened in the last year; 45% have run 3 to 5 years (The 74, 2026).\nApplication: this family may homeschool 2 to 4 days a week and attend a pod the rest. Keeping a coherent record across both settings is her real pain. Never assume she is the sole instructor every day; plans and hours need to fit around pod days.",
    citations: [
      {
        url: "https://microschoolingcenter.org/hubfs/American%20Microschools%202025.pdf",
        accessedAt: ACCESSED,
        claim: "RAND range 750,000 to 2.1M students; 53% of microschools serve homeschool-requirement families.",
      },
      {
        url: "https://www.the74million.org/article/exclusive-7-things-to-know-about-microschools-in-2026/",
        accessedAt: ACCESSED,
        claim: "Microschool growth is durable: only 16% opened in the last year.",
      },
    ],
    confidence: "high",
    sourceTier: 2,
  },
  {
    topicType: "method_format",
    topicKey: "forest_school",
    title: "Forest school: usually a one-day-a-week supplement, growing fast",
    summary:
      "The outdoors as the primary classroom, with academics taught through nature observation. FACT: about 800 US nature preschools, a 200%+ increase since 2017; Barefoot University grew to 3,000+ homeschool students across six states. Usually a supplement to an existing homeschool, not the whole program.",
    content:
      "FACT: about 800 nature preschools operated in the US as of the last measured school year, a 200%+ increase since 2017 (Natural Start Alliance survey via LA Times). FACT: Barefoot University, a homeschool-specific forest-school network founded in Dallas in 2019, grew to 3,000+ students across six states by 2022-23 (Fox News). FACT: 42% of nature schools are unlicensed, which skews access toward families who can pay out of pocket.\nINFERENCE: real and fast-growing, but still small in absolute terms next to eclectic, classical, or unschooling; the dominant model is one day a week outdoors while the family keeps its home curriculum the other days.\nApplication: treat it as a supplement, not the whole program. Nature-study logging and outdoor-observation prompts fit here better than seated worksheets; the overlap with Charlotte Mason's nature-study tradition is heavy and worth leaning on.",
    citations: [
      {
        url: "https://www.latimes.com/environment/story/2024-09-09/children-are-glued-to-screens-and-stuck-inside-can-forest-schools-offer-an-antidote/",
        accessedAt: ACCESSED,
        claim: "About 800 US nature preschools, a 200%+ increase since 2017; 42% unlicensed.",
      },
      {
        url: "https://www.foxnews.com/us/homeschool-forest-group-enrollment-soars-parents-escape-one-size-fits-all-public-schools-founders-say",
        accessedAt: ACCESSED,
        claim: "Barefoot University grew to 3,000+ homeschool students across six states.",
      },
    ],
    confidence: "medium",
    sourceTier: 3,
  },
];

let merged = 0;
let refreshed = 0;
let flagged = 0;
for (const row of ROWS) {
  const result = await mergeKnowledgeRow(
    {
      topicType: row.topicType,
      topicKey: row.topicKey,
      title: row.title,
      summary: row.summary,
      content: row.content,
      citations: row.citations,
      confidence: row.confidence,
      sourceTier: row.sourceTier,
      freshnessTtlDays: 180,
    },
    { contributedBy: "seed" },
  );
  if (result.merged && result.refreshed) {
    refreshed += 1;
    console.log(`REFRESH  ${row.topicKey}`);
  } else if (result.merged) {
    merged += 1;
    console.log(`MERGED   ${row.topicKey}`);
  } else {
    flagged += 1;
    console.log(`FLAGGED  ${row.topicKey}  (${result.note})`);
  }
}

console.log(
  `\nSeed complete: ${merged} merged, ${refreshed} refreshed, ${flagged} flagged of ${ROWS.length}.`,
);
const sql = mapDb();
await sql.end();
process.exit(flagged > 0 ? 1 : 0);
