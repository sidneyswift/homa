import type { Cluster, ClustersFile } from "./types.js";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const clustersData = require("../data/clusters.json") as ClustersFile;

// Reverse mapping from Homa domain to Marble subject+domain pairs
const HOMA_TO_MARBLE_PAIRS: Record<string, { subject: string; domains: string[] }> = {
  math: { subject: "Mathematics", domains: ["Addition & Subtraction", "Algebra", "Counting & Cardinality", "Data & Statistics", "Fractions", "Geometry", "Mathematical Thinking", "Measurement", "Multiplication & Division", "Number Representation & Place Value", "Probability", "Ratio & Proportion"] },
  literacy: { subject: "English", domains: ["Reading Comprehension"] },
  phonics: { subject: "English", domains: ["Phonics & Word Reading"] },
  writing: { subject: "English", domains: ["Writing Composition", "Handwriting & Transcription"] },
  language: { subject: "English", domains: ["Grammar & Punctuation", "Speaking & Listening", "Vocabulary", "Spelling & Word Study", "English Thinking"] },
  science: { subject: "Science", domains: ["Animals of the World", "Dinosaurs & Paleontology", "Earth's Systems", "Ecosystems & Habitats", "Energy", "Forces & Motion", "Insects & Minibeasts", "Matter & Materials", "Ocean Life", "Organisms & Life Processes", "Polar Regions", "Rainforests", "Scientific Inquiry", "Space Exploration", "Space Systems & Earth's History", "The Human Body", "Volcanoes & Earthquakes", "Waves, Light & Sound", "Weather & Climate"] },
  social_studies: { subject: "History", domains: ["Ancient Egypt", "Ancient Greece & Rome", "Historical Thinking", "Medieval Times"] },
  social_emotional: { subject: "Personal & Social Development", domains: ["Emotional Literacy", "Empathy & Social Awareness", "Friendship & Cooperation", "Responsible Decision-Making", "Self-Awareness", "Self-Regulation & Resilience"] },
  self_care: { subject: "Life Skills", domains: ["Entrepreneurship", "Money & Finance"] },
  executive_function: { subject: "Learning to Learn", domains: ["Learning to Learn"] },
  computer_science: { subject: "Computing", domains: ["Artificial Intelligence"] },
};

/**
 * Returns a cluster summary for a Homa domain at a given age (in years).
 * Finds the first matching cluster from any of the mapped Marble domains.
 */
export function clusterSummary(
  homaDomainId: string,
  ageYears: number
): string | null {
  const mapping = HOMA_TO_MARBLE_PAIRS[homaDomainId];
  if (!mapping) return null;

  for (const domain of mapping.domains) {
    const cluster = clustersData.clusters.find(
      (c) =>
        c.subject === mapping.subject &&
        c.domain === domain &&
        c.ageRangeStart === ageYears
    );
    if (cluster) return cluster.summary;
  }
  return null;
}

/**
 * Returns all clusters that map to a given Homa domain.
 */
export function allClustersForDomain(homaDomainId: string): Cluster[] {
  const mapping = HOMA_TO_MARBLE_PAIRS[homaDomainId];
  if (!mapping) return [];

  return clustersData.clusters.filter(
    (c) =>
      c.subject === mapping.subject && mapping.domains.includes(c.domain)
  );
}
