export type GeneratedWebRouteBoundary =
  | "public"
  | "family"
  | "operator"
  | "developer"
  | "intercept-unresolved";

const routeFileNames = new Set([
  "apple-icon.tsx",
  "error.tsx",
  "global-error.tsx",
  "layout.tsx",
  "loading.tsx",
  "not-found.tsx",
  "opengraph-image.tsx",
  "page.tsx",
  "twitter-image.tsx",
]);

const isInterceptingSegment = (segment: string): boolean =>
  /^(?:\(\.\)|\(\.\.\)|\(\.\.\.\))/.test(segment);

const isUrlNeutralSegment = (segment: string): boolean =>
  (segment.startsWith("(") && segment.endsWith(")"))
  || segment.startsWith("@");

export function classifyGeneratedWebRouteBoundary(path: string): GeneratedWebRouteBoundary | null {
  const prefix = "apps/web/app/";
  if (!path.startsWith(prefix)) return null;
  const parts = path.slice(prefix.length).split("/");
  const file = parts.pop();
  if (!file || !routeFileNames.has(file)) return null;
  if (parts.some(isInterceptingSegment)) return "intercept-unresolved";

  const first = parts.filter((segment) => !isUrlNeutralSegment(segment))[0] ?? "";
  if (first === "app") return "family";
  if (first === "admin") return "operator";
  if (first === "dev") return "developer";
  return "public";
}

export function assertNoUnresolvedInterceptingRoutes(paths: readonly string[]): void {
  const unresolved = paths.filter((path) => classifyGeneratedWebRouteBoundary(path) === "intercept-unresolved");
  if (unresolved.length > 0) {
    throw new Error([
      "Intercepting web route source requires an explicit reviewed runtime boundary:",
      ...unresolved.sort().map((path) => `- ${path}`),
    ].join("\n"));
  }
}
