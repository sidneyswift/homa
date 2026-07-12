export type ProgressRoutePolicyInput =
  | {
      surface:
        | "progress_index"
        | "report_index"
        | "token_report";
    }
  | {
      surface: "child_progress" | "child_report";
      childId: string;
    };

export type ProgressRoutePolicyDecision =
  | { kind: "continue" }
  | { kind: "redirect"; href: string };

export function progressRoutePolicy(
  route: ProgressRoutePolicyInput,
  liveProgressEnabled: boolean,
): ProgressRoutePolicyDecision {
  switch (route.surface) {
    case "progress_index":
      return liveProgressEnabled
        ? { kind: "continue" }
        : { kind: "redirect", href: "/app/report" };
    case "child_progress":
      return liveProgressEnabled
        ? { kind: "continue" }
        : {
            kind: "redirect",
            href:
              `/app/${encodeURIComponent(route.childId)}/report`,
          };
    case "report_index":
      return liveProgressEnabled
        ? { kind: "redirect", href: "/app/progress" }
        : { kind: "continue" };
    case "child_report":
      return liveProgressEnabled
        ? {
            kind: "redirect",
            href:
              `/app/${encodeURIComponent(route.childId)}/progress`,
          }
        : { kind: "continue" };
    case "token_report":
      return { kind: "continue" };
    default: {
      const exhaustiveRoute: never = route;
      return exhaustiveRoute;
    }
  }
}
