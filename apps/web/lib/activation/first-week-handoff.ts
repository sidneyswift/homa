/**
 * The report-to-week handoff can name a child in a URL, but it may never
 * carry parent-facing prose there. The authenticated app resolves the child
 * and produces the composer text itself, keeping the deep link useful
 * without turning it into an instruction-injection surface.
 */
export const FIRST_WEEK_ADJUSTMENT_DRAFT = "first-week-adjustment";

export function firstWeekAdjustmentHref(childId: string): string {
  const params = new URLSearchParams({
    draft: FIRST_WEEK_ADJUSTMENT_DRAFT,
    child: childId,
  });
  return `/app?${params.toString()}`;
}

export function firstWeekAdjustmentDraft(input: {
  draft: string | undefined;
  childId: string | undefined;
  children: readonly { id: string; name: string }[];
}): string | undefined {
  if (input.draft !== FIRST_WEEK_ADJUSTMENT_DRAFT) return undefined;
  const child = input.children.find((candidate) => candidate.id === input.childId);
  if (!child) return undefined;
  return `One part of ${child.name}'s first week does not fit: `;
}
