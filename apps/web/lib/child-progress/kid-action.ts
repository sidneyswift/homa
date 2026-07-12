import { liveProgressEnabled } from "./flag";

export interface KidProgressAction {
  href: string;
  label: "See all progress" | "Open the full report";
}

export function kidProgressAction(
  childId: string,
  reportToken: string | null | undefined,
): KidProgressAction | null {
  const childPathId = encodeURIComponent(childId);
  if (liveProgressEnabled()) {
    return {
      href: `/app/${childPathId}/progress`,
      label: "See all progress",
    };
  }
  return reportToken
    ? {
        href: `/app/${childPathId}/report`,
        label: "Open the full report",
      }
    : null;
}
