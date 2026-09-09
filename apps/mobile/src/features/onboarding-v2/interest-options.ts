import { MAP_INTERESTS_CAP } from "@homa/core";

export const INTEREST_NAME_MAX_LENGTH = 40;

export const INTEREST_OPTIONS = [
  "Animals", "Music", "Dancing", "Books", "Building blocks", "Vehicles",
  "Water play", "Outdoor play", "Drawing", "Pretend play", "Puzzles",
  "Dinosaurs", "Space", "Superheroes", "Fairy tales", "Crafts", "Nature",
  "Bugs", "Ocean life", "Trains", "Sports", "Board games", "Cooking & baking",
  "Science experiments", "Video games", "Coding", "Robotics", "History",
  "Geography", "Photography", "Creative writing", "Gardening", "Comics",
  "Engineering", "Filmmaking", "Fashion", "Starting a business", "Hiking",
  "Theater", "Woodworking",
  "Toy Story", "PAW Patrol", "Pokémon", "Roblox", "Bluey", "Peppa Pig",
  "Sesame Street", "Mickey Mouse", "Frozen", "Cars", "Disney Princesses",
  "Minecraft", "Super Mario", "Sonic the Hedgehog", "LEGO", "Harry Potter",
  "Star Wars", "Marvel", "Animal Crossing", "The Legend of Zelda", "Percy Jackson",
] as const;

type InterestOption = typeof INTEREST_OPTIONS[number];

// Editorial starting points, not developmental requirements. Every interest
// remains available through search and "See all interests", at every age.
const STARTER_INTERESTS: readonly { beforeMonths: number; names: readonly InterestOption[] }[] = [
  { beforeMonths: 36, names: ["Animals", "Bluey", "Sesame Street", "Music", "Peppa Pig", "Building blocks", "Mickey Mouse", "Books", "Vehicles", "Water play", "Dancing", "Outdoor play"] },
  { beforeMonths: 72, names: ["PAW Patrol", "Bluey", "Dinosaurs", "Toy Story", "Frozen", "Animals", "Cars", "Disney Princesses", "Pretend play", "Drawing", "Building blocks", "Books"] },
  { beforeMonths: 108, names: ["Pokémon", "Minecraft", "Super Mario", "LEGO", "Dinosaurs", "Sonic the Hedgehog", "Animals", "Space", "Superheroes", "Crafts", "Sports", "Books"] },
  { beforeMonths: 156, names: ["Roblox", "Minecraft", "Pokémon", "Harry Potter", "Marvel", "Sports", "Animal Crossing", "Coding", "Drawing", "Music", "Robotics", "Books"] },
  { beforeMonths: Infinity, names: ["Roblox", "Minecraft", "Music", "Star Wars", "Sports", "The Legend of Zelda", "Percy Jackson", "Photography", "Coding", "Creative writing", "Drawing", "Filmmaking"] },
];

const GENERAL_INTERESTS: readonly InterestOption[] = ["Animals", "Music", "Books", "Drawing", "Sports", "Nature", "Space", "Puzzles", "Crafts", "Cooking & baking", "Board games", "Dancing"];

export function suggestedInterests(ageMonths: number | null): readonly string[] {
  if (ageMonths === null || !Number.isFinite(ageMonths) || ageMonths < 0) return GENERAL_INTERESTS;
  return STARTER_INTERESTS.find(({ beforeMonths }) => ageMonths < beforeMonths)!.names;
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function nameKey(value: string): string {
  return cleanName(value).normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US");
}

export function canonicalInterestName(value: string): string {
  return INTEREST_OPTIONS.find((name) => nameKey(name) === nameKey(value)) ?? cleanName(value);
}

export function normalizeInterests(values: readonly string[]): string[] {
  const names: string[] = [];
  for (const value of values) {
    const name = canonicalInterestName(value);
    if (!name || name.length > INTEREST_NAME_MAX_LENGTH || names.some((existing) => nameKey(existing) === nameKey(name))) continue;
    names.push(name);
    if (names.length === MAP_INTERESTS_CAP) break;
  }
  return names;
}

export function toggleInterest(selected: readonly string[], value: string): string[] {
  const names = normalizeInterests(selected);
  const key = nameKey(value);
  return names.some((name) => nameKey(name) === key)
    ? names.filter((name) => nameKey(name) !== key)
    : normalizeInterests([...names, value]);
}

export function customInterestName(query: string, selected: readonly string[]): string | null {
  const name = cleanName(query);
  if (!name || name.length > INTEREST_NAME_MAX_LENGTH) return null;
  if ([...INTEREST_OPTIONS, ...selected].some((existing) => nameKey(existing) === nameKey(name))) return null;
  return name;
}

export function searchInterests(query: string, ageMonths: number | null, selected: readonly string[], showAll = false): string[] {
  const key = nameKey(query);
  const suggestions = suggestedInterests(ageMonths);
  const available = key || showAll ? [...selected, ...suggestions, ...INTEREST_OPTIONS] : [...selected, ...suggestions];
  return Array.from(new Set(available)).filter((name) => nameKey(name).includes(key));
}

/** Update one local child without changing another child's answers. */
export function withChildInterests<T extends { id: string; interests?: string[] }>(kids: T[], childId: string, interests: readonly string[]): T[] {
  if (!kids.some((kid) => kid.id === childId)) return kids;
  return kids.map((kid) => kid.id === childId ? { ...kid, interests: normalizeInterests(interests) } : kid);
}
