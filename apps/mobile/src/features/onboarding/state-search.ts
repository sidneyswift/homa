import { US_STATES } from "@homa/core";

type UsState = (typeof US_STATES)[number];

/**
 * The state sheet's search (2026-11-03 walk, gh#1236): fifty-one rows is
 * a long scroll for "Wyoming". A name matches when any word in it starts
 * with what she typed ("york" finds New York), and a two-letter entry
 * also matches the postal code ("TX"). Blank shows every state.
 */
export function searchStates(query: string): UsState[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...US_STATES];
  return US_STATES.filter((state) => {
    if (needle.length === 2 && state.code.toLowerCase() === needle) return true;
    const name = state.name.toLowerCase();
    return name.startsWith(needle) || name.split(/\s+/u).some((word) => word.startsWith(needle));
  });
}
