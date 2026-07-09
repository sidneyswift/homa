import type { Topic } from "./types.js";
import type { TopicsFile } from "./types.js";
import { homaDomainForTopic } from "./mapping.js";

// Use createRequire for JSON imports to avoid needing --resolveJsonModule in bundler mode
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const topicsData = require("../data/topics.json") as TopicsFile;

let topicMap: Map<string, Topic> | null = null;

function getTopicMap(): Map<string, Topic> {
  if (!topicMap) {
    topicMap = new Map();
    for (const t of topicsData.topics) {
      topicMap.set(t.id, t);
    }
  }
  return topicMap;
}

export function getTopicById(id: string): Topic | undefined {
  return getTopicMap().get(id);
}

export function getAllTopics(): Topic[] {
  return topicsData.topics;
}

/**
 * Returns topics whose age range (in years) contains the given ageMonths.
 * Marble uses years; Homa uses months. A topic matches when:
 *   ageMonths >= ageRangeStart * 12 AND ageMonths < ageRangeEnd * 12
 */
export function topicsByAge(ageMonths: number): Topic[] {
  return topicsData.topics.filter(
    (t) => ageMonths >= t.ageRangeStart * 12 && ageMonths < t.ageRangeEnd * 12
  );
}

export function topicsBySubjectDomain(subject: string, domain: string): Topic[] {
  return topicsData.topics.filter(
    (t) => t.subject === subject && t.domain === domain
  );
}

// Interest-to-domain mapping. Generous with aliases.
const INTEREST_MAP: Record<string, string[]> = {
  dinosaurs: ["Dinosaurs & Paleontology"],
  fossils: ["Dinosaurs & Paleontology"],
  paleontology: ["Dinosaurs & Paleontology"],
  space: ["Space Exploration", "Space Systems & Earth's History"],
  planets: ["Space Exploration", "Space Systems & Earth's History"],
  stars: ["Space Exploration", "Space Systems & Earth's History"],
  astronomy: ["Space Exploration", "Space Systems & Earth's History"],
  rockets: ["Space Exploration"],
  ocean: ["Ocean Life"],
  sea: ["Ocean Life"],
  marine: ["Ocean Life"],
  fish: ["Ocean Life"],
  whales: ["Ocean Life"],
  sharks: ["Ocean Life"],
  animals: ["Animals of the World"],
  pets: ["Animals of the World"],
  wildlife: ["Animals of the World"],
  zoo: ["Animals of the World"],
  weather: ["Weather & Climate"],
  storms: ["Weather & Climate"],
  climate: ["Weather & Climate"],
  volcanoes: ["Volcanoes & Earthquakes"],
  earthquakes: ["Volcanoes & Earthquakes"],
  geology: ["Volcanoes & Earthquakes", "Earth's Systems"],
  bugs: ["Insects & Minibeasts"],
  insects: ["Insects & Minibeasts"],
  spiders: ["Insects & Minibeasts"],
  butterflies: ["Insects & Minibeasts"],
  rainforest: ["Rainforests"],
  jungle: ["Rainforests"],
  arctic: ["Polar Regions"],
  antarctic: ["Polar Regions"],
  polar: ["Polar Regions"],
  penguins: ["Polar Regions"],
  robots: ["Artificial Intelligence"],
  ai: ["Artificial Intelligence"],
  coding: ["Artificial Intelligence"],
  programming: ["Artificial Intelligence"],
  computers: ["Artificial Intelligence"],
  cooking: ["Entrepreneurship"],
  baking: ["Entrepreneurship"],
  money: ["Money & Finance"],
  business: ["Entrepreneurship", "Money & Finance"],
  math: ["Addition & Subtraction", "Multiplication & Division", "Fractions", "Geometry"],
  numbers: ["Counting & Cardinality", "Number Representation & Place Value"],
  reading: ["Reading Comprehension"],
  writing: ["Writing Composition"],
  stories: ["Reading Comprehension", "Writing Composition"],
  history: ["Ancient Egypt", "Ancient Greece & Rome", "Medieval Times", "Historical Thinking"],
  egypt: ["Ancient Egypt"],
  pharaohs: ["Ancient Egypt"],
  pyramids: ["Ancient Egypt"],
  greece: ["Ancient Greece & Rome"],
  rome: ["Ancient Greece & Rome"],
  romans: ["Ancient Greece & Rome"],
  knights: ["Medieval Times"],
  castles: ["Medieval Times"],
  medieval: ["Medieval Times"],
  body: ["The Human Body"],
  health: ["The Human Body"],
  muscles: ["The Human Body"],
  bones: ["The Human Body"],
  plants: ["Organisms & Life Processes"],
  nature: ["Ecosystems & Habitats", "Organisms & Life Processes"],
  habitats: ["Ecosystems & Habitats"],
  ecosystems: ["Ecosystems & Habitats"],
  energy: ["Energy"],
  electricity: ["Energy"],
  magnets: ["Forces & Motion"],
  forces: ["Forces & Motion"],
  machines: ["Forces & Motion"],
  light: ["Waves, Light & Sound"],
  sound: ["Waves, Light & Sound"],
  music: ["Waves, Light & Sound"],
  earth: ["Earth's Systems"],
  rocks: ["Earth's Systems"],
  materials: ["Matter & Materials"],
  chemistry: ["Matter & Materials"],
  feelings: ["Emotional Literacy", "Self-Awareness"],
  emotions: ["Emotional Literacy"],
  friendship: ["Friendship & Cooperation"],
  friends: ["Friendship & Cooperation"],
  kindness: ["Empathy & Social Awareness"],
  empathy: ["Empathy & Social Awareness"],
  learning: ["Learning to Learn"],
  studying: ["Learning to Learn"],
  data: ["Data & Statistics"],
  graphs: ["Data & Statistics"],
  statistics: ["Data & Statistics"],
  shapes: ["Geometry"],
  measurement: ["Measurement"],
  fractions: ["Fractions"],
  algebra: ["Algebra"],
  probability: ["Probability"],
  spelling: ["Spelling & Word Study"],
  grammar: ["Grammar & Punctuation"],
  phonics: ["Phonics & Word Reading"],
  vocabulary: ["Vocabulary"],
  speaking: ["Speaking & Listening"],
  listening: ["Speaking & Listening"],
};

/**
 * Maps a child's interest keyword to relevant topics, filtered by age.
 */
export function topicsByInterest(interest: string, ageMonths: number): Topic[] {
  const domains = INTEREST_MAP[interest.toLowerCase()];
  if (!domains) return [];
  return topicsData.topics.filter(
    (t) =>
      domains.includes(t.domain) &&
      ageMonths >= t.ageRangeStart * 12 &&
      ageMonths < t.ageRangeEnd * 12
  );
}

/**
 * Returns assessment prompts for topics in a Homa domain, filtered by age.
 */
export function assessmentPromptsForDomain(
  homaDomainId: string,
  ageMonths: number
): { topic: Topic; prompt: string }[] {
  return topicsByAge(ageMonths)
    .filter((t) => homaDomainForTopic(t) === homaDomainId)
    .filter((t) => t.assessmentPrompt)
    .map((t) => ({ topic: t, prompt: t.assessmentPrompt }));
}
