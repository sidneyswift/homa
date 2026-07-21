import type { PrerequisiteStrength, TopicKind } from "./types";

/**
 * The Marble import mapping, straight from the plan's table
 * (docs/homa-planning/plans/2026-07-10-skill-graph-taxonomy.md § Subject
 * mapping for the import):
 *
 * - Mathematics lands whole in math; Science whole in science; History
 *   becomes social_studies domains; PSD becomes social_emotional domains;
 *   Learning to Learn joins executive_function; Computing joins
 *   computer_science.
 * - English splits four ways BY DOMAIN: phonics & word reading → phonics;
 *   handwriting → writing; composition/grammar/spelling → writing;
 *   comprehension/vocabulary → literacy; speaking & listening/thinking →
 *   language.
 * - Life Skills is PARKED as its own subject (founder decision pending).
 * - Five interest-led science domains import as kind "content" (materials
 *   hooks), never assessment.
 *
 * Every Marble "Subject > Domain" pair MUST appear here; the taxonomy
 * check fails on an unmapped pair, so an upstream sync that adds a domain
 * breaks loudly instead of silently dropping topics.
 */

export interface MarbleDomainTarget {
  /** Homa subject id (bank vocabulary: math, literacy, ... or life_skills). */
  subject: string;
  /** Homa TaxonomyDomain id (globally unique kebab slug). */
  domainId: string;
  displayName: string;
  kind: "assessment" | "content";
}

export const MARBLE_DOMAIN_MAP: Record<string, MarbleDomainTarget> = {
  // Mathematics (12 domains) → math
  "Mathematics > Counting & Cardinality": { subject: "math", domainId: "counting-cardinality", displayName: "Counting & cardinality", kind: "assessment" },
  "Mathematics > Number Representation & Place Value": { subject: "math", domainId: "number-place-value", displayName: "Number & place value", kind: "assessment" },
  "Mathematics > Addition & Subtraction": { subject: "math", domainId: "addition-subtraction", displayName: "Addition & subtraction", kind: "assessment" },
  "Mathematics > Multiplication & Division": { subject: "math", domainId: "multiplication-division", displayName: "Multiplication & division", kind: "assessment" },
  "Mathematics > Fractions": { subject: "math", domainId: "fractions", displayName: "Fractions", kind: "assessment" },
  "Mathematics > Geometry": { subject: "math", domainId: "geometry", displayName: "Geometry & shapes", kind: "assessment" },
  "Mathematics > Measurement": { subject: "math", domainId: "measurement", displayName: "Measurement", kind: "assessment" },
  "Mathematics > Data & Statistics": { subject: "math", domainId: "data-statistics", displayName: "Data & statistics", kind: "assessment" },
  "Mathematics > Probability": { subject: "math", domainId: "probability", displayName: "Probability", kind: "assessment" },
  "Mathematics > Ratio & Proportion": { subject: "math", domainId: "ratio-proportion", displayName: "Ratio & proportion", kind: "assessment" },
  "Mathematics > Algebra": { subject: "math", domainId: "algebra-patterns", displayName: "Algebra & patterns", kind: "assessment" },
  "Mathematics > Mathematical Thinking": { subject: "math", domainId: "mathematical-thinking", displayName: "Mathematical thinking", kind: "assessment" },

  // English (9 domains) → phonics / writing / literacy / language
  "English > Phonics & Word Reading": { subject: "phonics", domainId: "phonics-word-reading", displayName: "Phonics & word reading", kind: "assessment" },
  "English > Handwriting & Transcription": { subject: "writing", domainId: "handwriting-transcription", displayName: "Handwriting & transcription", kind: "assessment" },
  "English > Writing Composition": { subject: "writing", domainId: "writing-composition", displayName: "Writing composition", kind: "assessment" },
  "English > Grammar & Punctuation": { subject: "writing", domainId: "grammar-punctuation", displayName: "Grammar & punctuation", kind: "assessment" },
  "English > Spelling & Word Study": { subject: "writing", domainId: "spelling-word-study", displayName: "Spelling & word study", kind: "assessment" },
  "English > Reading Comprehension": { subject: "literacy", domainId: "reading-comprehension", displayName: "Reading comprehension", kind: "assessment" },
  "English > Vocabulary": { subject: "literacy", domainId: "vocabulary", displayName: "Vocabulary", kind: "assessment" },
  "English > Speaking & Listening": { subject: "language", domainId: "speaking-listening", displayName: "Speaking & listening", kind: "assessment" },
  "English > English Thinking": { subject: "language", domainId: "english-thinking", displayName: "Thinking about language", kind: "assessment" },
  // Inspo-flywheel addition (2026-07-19): literature appreciation from
  // Charlotte Mason-leaning drops; materials hook, not an assessment.
  "English > Literature": { subject: "literacy", domainId: "literature", displayName: "Literature", kind: "content" },

  // Science (19 domains) → science; five interest-led ones are content
  "Science > Scientific Inquiry": { subject: "science", domainId: "scientific-inquiry", displayName: "Scientific inquiry", kind: "assessment" },
  "Science > Organisms & Life Processes": { subject: "science", domainId: "organisms-life-processes", displayName: "Organisms & life processes", kind: "assessment" },
  "Science > Ecosystems & Habitats": { subject: "science", domainId: "ecosystems-habitats", displayName: "Ecosystems & habitats", kind: "assessment" },
  "Science > The Human Body": { subject: "science", domainId: "the-human-body", displayName: "The human body", kind: "assessment" },
  "Science > Animals of the World": { subject: "science", domainId: "animals-of-the-world", displayName: "Animals of the world", kind: "assessment" },
  "Science > Insects & Minibeasts": { subject: "science", domainId: "insects-minibeasts", displayName: "Insects & minibeasts", kind: "assessment" },
  "Science > Matter & Materials": { subject: "science", domainId: "matter-materials", displayName: "Matter & materials", kind: "assessment" },
  "Science > Energy": { subject: "science", domainId: "energy", displayName: "Energy", kind: "assessment" },
  "Science > Forces & Motion": { subject: "science", domainId: "forces-motion", displayName: "Forces & motion", kind: "assessment" },
  "Science > Waves, Light & Sound": { subject: "science", domainId: "waves-light-sound", displayName: "Waves, light & sound", kind: "assessment" },
  "Science > Earth's Systems": { subject: "science", domainId: "earths-systems", displayName: "Earth's systems", kind: "assessment" },
  "Science > Weather & Climate": { subject: "science", domainId: "weather-climate", displayName: "Weather & climate", kind: "assessment" },
  "Science > Space Systems & Earth's History": { subject: "science", domainId: "space-systems", displayName: "Space systems & Earth's history", kind: "assessment" },
  // Cluster-only in Marble v1 (no topics yet, summaries exist): mapped so
  // the parent-facing cluster lines land, and future upstream topics too.
  "Science > Earth & Human Activity": { subject: "science", domainId: "earth-human-activity", displayName: "Earth & human activity", kind: "assessment" },
  "Science > Heredity & Evolution": { subject: "science", domainId: "heredity-evolution", displayName: "Heredity & evolution", kind: "assessment" },
  "Science > Space Exploration": { subject: "science", domainId: "space-exploration", displayName: "Space exploration", kind: "content" },
  "Science > Dinosaurs & Paleontology": { subject: "science", domainId: "dinosaurs-paleontology", displayName: "Dinosaurs & paleontology", kind: "content" },
  "Science > Ocean Life": { subject: "science", domainId: "ocean-life", displayName: "Ocean life", kind: "content" },
  "Science > Rainforests": { subject: "science", domainId: "rainforests", displayName: "Rainforests", kind: "content" },
  "Science > Polar Regions": { subject: "science", domainId: "polar-regions", displayName: "Polar regions", kind: "content" },
  "Science > Volcanoes & Earthquakes": { subject: "science", domainId: "volcanoes-earthquakes", displayName: "Volcanoes & earthquakes", kind: "content" },

  // History (4 domains) → social_studies
  "History > Historical Thinking": { subject: "social_studies", domainId: "historical-thinking", displayName: "Historical thinking", kind: "assessment" },
  "History > Ancient Egypt": { subject: "social_studies", domainId: "ancient-egypt", displayName: "Ancient Egypt", kind: "content" },
  "History > Ancient Greece & Rome": { subject: "social_studies", domainId: "ancient-greece-rome", displayName: "Ancient Greece & Rome", kind: "content" },
  "History > Medieval Times": { subject: "social_studies", domainId: "medieval-times", displayName: "Medieval times", kind: "content" },
  // Inspo-flywheel additions (2026-07-19, normalizing the 2026-07-15
  // graduation batch): unit-study drops introduced these genuinely new
  // domains; everything else in that batch normalized onto existing
  // Marble domains instead of widening the vocabulary.
  "History > Geography": { subject: "social_studies", domainId: "geography", displayName: "Geography", kind: "content" },
  "History > Cultural Studies": { subject: "social_studies", domainId: "cultural-studies", displayName: "Cultural studies", kind: "content" },

  // Personal & Social Development (6 domains) → social_emotional
  "Personal & Social Development > Emotional Literacy": { subject: "social_emotional", domainId: "emotional-literacy", displayName: "Emotional literacy", kind: "assessment" },
  "Personal & Social Development > Self-Awareness": { subject: "social_emotional", domainId: "self-awareness", displayName: "Self-awareness", kind: "assessment" },
  "Personal & Social Development > Self-Regulation & Resilience": { subject: "social_emotional", domainId: "self-regulation-resilience", displayName: "Self-regulation & resilience", kind: "assessment" },
  "Personal & Social Development > Empathy & Social Awareness": { subject: "social_emotional", domainId: "empathy-social-awareness", displayName: "Empathy & social awareness", kind: "assessment" },
  "Personal & Social Development > Friendship & Cooperation": { subject: "social_emotional", domainId: "friendship-cooperation", displayName: "Friendship & cooperation", kind: "assessment" },
  "Personal & Social Development > Responsible Decision-Making": { subject: "social_emotional", domainId: "responsible-decision-making", displayName: "Responsible decision-making", kind: "assessment" },

  // Learning to Learn → executive_function
  "Learning to Learn > Learning to Learn": { subject: "executive_function", domainId: "learning-to-learn", displayName: "Learning to learn", kind: "assessment" },

  // Computing → computer_science
  "Computing > Artificial Intelligence": { subject: "computer_science", domainId: "artificial-intelligence", displayName: "Artificial intelligence", kind: "assessment" },

  // Life Skills → parked subject (founder decision pending; see plan)
  "Life Skills > Money & Finance": { subject: "life_skills", domainId: "money-finance", displayName: "Money & finance", kind: "assessment" },
  "Life Skills > Entrepreneurship": { subject: "life_skills", domainId: "entrepreneurship", displayName: "Entrepreneurship", kind: "assessment" },
  // Inspo-flywheel addition (2026-07-19): daily-living skills from the
  // preschool curriculum drops (routines, time, weather, self-care,
  // chores); joins the parked subject with its siblings.
  "Life Skills > Daily Living": { subject: "life_skills", domainId: "daily-living", displayName: "Daily living", kind: "assessment" },

  // Inspo-flywheel addition (2026-07-20): Blossom & Root Level 0 (a
  // Charlotte Mason-inspired kindergarten curriculum) introduced weekly
  // picture study and composer study, and Marble has no Art or Music
  // subject to receive them. Homa already has fully authored "art" and
  // "music" bank subjects (packages/core/src/map/content.ts) with their
  // own assessment domains (see domains.ts AUTHORED_DOMAINS); these two
  // entries add NEW content-kind domains under those same subjects for
  // Marble-style enrichment topics, deliberately using domain ids that do
  // not collide with the existing authored ones.
  "Art > Picture Study & Art Appreciation": { subject: "art", domainId: "picture-study-appreciation", displayName: "Picture study & art appreciation", kind: "content" },
  "Music > Composer Study & Music Appreciation": { subject: "music", domainId: "composer-study-appreciation", displayName: "Composer study & music appreciation", kind: "content" },
};

/** Marble's SCREAMING enum → Homa's lowercase TopicKind. */
export function topicKindFromMarble(type: string): TopicKind {
  switch (type) {
    case "CONCEPTUAL":
      return "conceptual";
    case "PROCEDURAL":
      return "procedural";
    case "REPRESENTATIONAL":
      return "representational";
    case "LANGUAGE":
      return "language";
    case "META":
      return "meta";
    default:
      throw new Error(`Unknown Marble topic type: ${type}`);
  }
}

export function assertPrerequisiteStrength(value: string): PrerequisiteStrength {
  if (value === "hard" || value === "soft") return value;
  throw new Error(`Unknown prerequisite strength: ${value}`);
}

/** Lookup key for MARBLE_DOMAIN_MAP. */
export function marbleDomainKey(subject: string, domain: string): string {
  return `${subject} > ${domain}`;
}
