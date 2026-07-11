import type { TaxonomyDomain } from "./types";
import { MARBLE_DOMAIN_MAP } from "./mapping";

/**
 * The level-2 domain registry: every skill line in the product, both
 * imported (origin "marble", derived from MARBLE_DOMAIN_MAP) and authored
 * (origin "homa", below). Authored domains cover what Marble does not:
 * the six subjects it lacks entirely (gross motor, fine motor, self-care,
 * music, art, second language), plus early-years and US-specific strands
 * inside shared subjects. Naming follows the Mac Mini's proven subdomain
 * vocabulary (homa-macmini story-profile.json, 78 strands for one child).
 *
 * Domain ids are globally unique kebab slugs and are STABLE: they appear
 * in stored data and future URLs. Rename displayName freely; never ids.
 */

const AUTHORED_DOMAINS: readonly TaxonomyDomain[] = [
  // literacy (joins Marble's reading-comprehension, vocabulary)
  { id: "early-book-skills", subject: "literacy", displayName: "Early book skills", kind: "assessment", origin: "homa" },
  { id: "letter-knowledge", subject: "literacy", displayName: "Letter knowledge", kind: "assessment", origin: "homa" },
  { id: "reading-independence", subject: "literacy", displayName: "Reading independence", kind: "assessment", origin: "homa" },

  // phonics (joins Marble's phonics-word-reading)
  { id: "phonological-awareness", subject: "phonics", displayName: "Phonological awareness", kind: "assessment", origin: "homa" },

  // language (joins Marble's speaking-listening, english-thinking)
  { id: "early-talk", subject: "language", displayName: "Early talk", kind: "assessment", origin: "homa" },
  { id: "speech-clarity", subject: "language", displayName: "Speech clarity", kind: "assessment", origin: "homa" },
  { id: "oral-storytelling", subject: "language", displayName: "Oral storytelling", kind: "assessment", origin: "homa" },

  // social_studies (joins Marble's historical-thinking + history content)
  { id: "family-community", subject: "social_studies", displayName: "Family & community", kind: "assessment", origin: "homa" },
  { id: "geography-maps", subject: "social_studies", displayName: "Geography & maps", kind: "assessment", origin: "homa" },
  { id: "civics-government", subject: "social_studies", displayName: "Civics & government", kind: "assessment", origin: "homa" },
  { id: "economics-money", subject: "social_studies", displayName: "Economics & money", kind: "assessment", origin: "homa" },

  // executive_function (joins Marble's learning-to-learn)
  { id: "attention-focus", subject: "executive_function", displayName: "Attention & focus", kind: "assessment", origin: "homa" },
  { id: "working-memory-directions", subject: "executive_function", displayName: "Working memory & directions", kind: "assessment", origin: "homa" },
  { id: "self-control-flexibility", subject: "executive_function", displayName: "Self-control & flexibility", kind: "assessment", origin: "homa" },
  { id: "planning-follow-through", subject: "executive_function", displayName: "Planning & follow-through", kind: "assessment", origin: "homa" },

  // computer_science (joins Marble's artificial-intelligence)
  { id: "computational-thinking", subject: "computer_science", displayName: "Computational thinking", kind: "assessment", origin: "homa" },
  { id: "programming-projects", subject: "computer_science", displayName: "Programming & projects", kind: "assessment", origin: "homa" },

  // art (fully authored; Marble has no art subject)
  { id: "art-exploration", subject: "art", displayName: "Making & exploring", kind: "assessment", origin: "homa" },
  { id: "drawing-representation", subject: "art", displayName: "Drawing & representation", kind: "assessment", origin: "homa" },
  { id: "technique-observation", subject: "art", displayName: "Technique & observation", kind: "assessment", origin: "homa" },
  { id: "artistic-voice", subject: "art", displayName: "Artistic voice", kind: "assessment", origin: "homa" },

  // music (fully authored)
  { id: "rhythm-beat", subject: "music", displayName: "Rhythm & beat", kind: "assessment", origin: "homa" },
  { id: "singing", subject: "music", displayName: "Singing", kind: "assessment", origin: "homa" },
  { id: "listening-awareness", subject: "music", displayName: "Listening & awareness", kind: "assessment", origin: "homa" },
  { id: "instrument-notation", subject: "music", displayName: "Instrument & notation", kind: "assessment", origin: "homa" },
  { id: "ensemble-performance", subject: "music", displayName: "Playing together", kind: "assessment", origin: "homa" },

  // gross_motor (fully authored)
  { id: "locomotion", subject: "gross_motor", displayName: "Running & moving", kind: "assessment", origin: "homa" },
  { id: "balance-coordination", subject: "gross_motor", displayName: "Balance & coordination", kind: "assessment", origin: "homa" },
  { id: "ball-skills", subject: "gross_motor", displayName: "Ball skills", kind: "assessment", origin: "homa" },
  { id: "wheels-riding", subject: "gross_motor", displayName: "Wheels & riding", kind: "assessment", origin: "homa" },
  { id: "water-swimming", subject: "gross_motor", displayName: "Water & swimming", kind: "assessment", origin: "homa" },
  { id: "fitness-sport", subject: "gross_motor", displayName: "Fitness & sport", kind: "assessment", origin: "homa" },

  // fine_motor (fully authored)
  { id: "hand-control", subject: "fine_motor", displayName: "Hand control", kind: "assessment", origin: "homa" },
  { id: "cutting-scissors", subject: "fine_motor", displayName: "Cutting & scissors", kind: "assessment", origin: "homa" },
  { id: "building-construction", subject: "fine_motor", displayName: "Building & construction", kind: "assessment", origin: "homa" },
  { id: "practical-tools", subject: "fine_motor", displayName: "Practical tools", kind: "assessment", origin: "homa" },
  { id: "precision-craft", subject: "fine_motor", displayName: "Precision craft", kind: "assessment", origin: "homa" },

  // self_care (fully authored)
  { id: "feeding-mealtimes", subject: "self_care", displayName: "Feeding & mealtimes", kind: "assessment", origin: "homa" },
  { id: "dressing", subject: "self_care", displayName: "Dressing", kind: "assessment", origin: "homa" },
  { id: "hygiene-toileting", subject: "self_care", displayName: "Hygiene", kind: "assessment", origin: "homa" },
  { id: "routines-independence", subject: "self_care", displayName: "Routines & independence", kind: "assessment", origin: "homa" },
  { id: "kitchen-cooking", subject: "self_care", displayName: "Kitchen & cooking", kind: "assessment", origin: "homa" },
  { id: "real-world-responsibility", subject: "self_care", displayName: "Real-world responsibility", kind: "assessment", origin: "homa" },

  // spanish / second language (fully authored)
  { id: "l2-listening-comprehension", subject: "spanish", displayName: "Understanding the language", kind: "assessment", origin: "homa" },
  { id: "l2-speaking-production", subject: "spanish", displayName: "Speaking the language", kind: "assessment", origin: "homa" },
  { id: "l2-conversation-use", subject: "spanish", displayName: "Using it in conversation", kind: "assessment", origin: "homa" },
] as const;

function marbleDomains(): TaxonomyDomain[] {
  const seen = new Map<string, TaxonomyDomain>();
  for (const target of Object.values(MARBLE_DOMAIN_MAP)) {
    if (!seen.has(target.domainId)) {
      seen.set(target.domainId, {
        id: target.domainId,
        subject: target.subject,
        displayName: target.displayName,
        kind: target.kind,
        origin: "marble",
      });
    }
  }
  return [...seen.values()];
}

export const TAXONOMY_DOMAINS: readonly TaxonomyDomain[] = [
  ...marbleDomains(),
  ...AUTHORED_DOMAINS,
];

const domainIndex = new Map(TAXONOMY_DOMAINS.map((domain) => [domain.id, domain]));

export function getTaxonomyDomain(domainId: string): TaxonomyDomain | undefined {
  return domainIndex.get(domainId);
}

export function domainsForSubject(subject: string): TaxonomyDomain[] {
  return TAXONOMY_DOMAINS.filter((domain) => domain.subject === subject);
}
