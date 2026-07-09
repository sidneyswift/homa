import type { Topic } from "./types.js";
import { getAllTopics } from "./topics.js";

// Maps Marble subject + domain pairs to Homa domain IDs.
// Key format: "Subject > Domain"
const MARBLE_TO_HOMA: Record<string, string> = {
  // Mathematics (all domains)
  "Mathematics > Addition & Subtraction": "math",
  "Mathematics > Algebra": "math",
  "Mathematics > Counting & Cardinality": "math",
  "Mathematics > Data & Statistics": "math",
  "Mathematics > Fractions": "math",
  "Mathematics > Geometry": "math",
  "Mathematics > Mathematical Thinking": "math",
  "Mathematics > Measurement": "math",
  "Mathematics > Multiplication & Division": "math",
  "Mathematics > Number Representation & Place Value": "math",
  "Mathematics > Probability": "math",
  "Mathematics > Ratio & Proportion": "math",

  // English > Reading Comprehension
  "English > Reading Comprehension": "literacy",

  // English > Phonics & Word Reading
  "English > Phonics & Word Reading": "phonics",

  // English > Writing
  "English > Writing Composition": "writing",
  "English > Handwriting & Transcription": "writing",

  // English > Language
  "English > Grammar & Punctuation": "language",
  "English > Speaking & Listening": "language",
  "English > Vocabulary": "language",
  "English > Spelling & Word Study": "language",
  "English > English Thinking": "language",

  // Science (all domains)
  "Science > Animals of the World": "science",
  "Science > Dinosaurs & Paleontology": "science",
  "Science > Earth's Systems": "science",
  "Science > Ecosystems & Habitats": "science",
  "Science > Energy": "science",
  "Science > Forces & Motion": "science",
  "Science > Insects & Minibeasts": "science",
  "Science > Matter & Materials": "science",
  "Science > Ocean Life": "science",
  "Science > Organisms & Life Processes": "science",
  "Science > Polar Regions": "science",
  "Science > Rainforests": "science",
  "Science > Scientific Inquiry": "science",
  "Science > Space Exploration": "science",
  "Science > Space Systems & Earth's History": "science",
  "Science > The Human Body": "science",
  "Science > Volcanoes & Earthquakes": "science",
  "Science > Waves, Light & Sound": "science",
  "Science > Weather & Climate": "science",

  // History (all domains)
  "History > Ancient Egypt": "social_studies",
  "History > Ancient Greece & Rome": "social_studies",
  "History > Historical Thinking": "social_studies",
  "History > Medieval Times": "social_studies",

  // Personal & Social Development (all domains)
  "Personal & Social Development > Emotional Literacy": "social_emotional",
  "Personal & Social Development > Empathy & Social Awareness": "social_emotional",
  "Personal & Social Development > Friendship & Cooperation": "social_emotional",
  "Personal & Social Development > Responsible Decision-Making": "social_emotional",
  "Personal & Social Development > Self-Awareness": "social_emotional",
  "Personal & Social Development > Self-Regulation & Resilience": "social_emotional",

  // Life Skills (all domains)
  "Life Skills > Entrepreneurship": "self_care",
  "Life Skills > Money & Finance": "self_care",

  // Learning to Learn (all domains)
  "Learning to Learn > Learning to Learn": "executive_function",

  // Computing (all domains)
  "Computing > Artificial Intelligence": "computer_science",
};

export const MAPPED_HOMA_DOMAINS: readonly string[] = [
  "math",
  "literacy",
  "phonics",
  "writing",
  "language",
  "science",
  "social_studies",
  "social_emotional",
  "self_care",
  "executive_function",
  "computer_science",
] as const;

export const UNMAPPED_HOMA_DOMAINS: readonly string[] = [
  "art",
  "music",
  "gross_motor",
  "fine_motor",
  "spanish",
] as const;

/**
 * Returns the Homa domain ID for a given Marble topic, or null if unmapped.
 */
export function homaDomainForTopic(topic: Topic): string | null {
  const key = `${topic.subject} > ${topic.domain}`;
  return MARBLE_TO_HOMA[key] ?? null;
}

/**
 * Returns all topics that map to the given Homa domain ID.
 */
export function topicsForHomaDomain(domainId: string): Topic[] {
  return getAllTopics().filter((t) => homaDomainForTopic(t) === domainId);
}
