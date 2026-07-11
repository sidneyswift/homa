/**
 * spreadAcrossWeekdays(count: number): number[]
 * Deterministic day slots (0 = Mon .. 4 = Fri) for a kid's `count`
 * activities this week. A few activities spread out evenly (1 lands
 * Monday; 2 land Mon/Fri; 3 land Mon/Wed/Fri; 4 skip the midweek dip),
 * and more than five round-robin so every day stays light. Presentation
 * only: checks stay keyed by plan ("week.activityIndex"), never by day,
 * because real day scheduling is the M2-10 milestone, not this board.
 */
export function spreadAcrossWeekdays(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count <= 5) {
    return Array.from({ length: count }, (_, index) =>
      Math.round((index * 4) / (count - 1)),
    );
  }
  return Array.from({ length: count }, (_, index) => index % 5);
}
