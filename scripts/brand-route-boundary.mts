import type { BrandRouteHandlerRuntimeBoundary } from "../packages/design/src/surfaces.ts";

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
  // #1158: /app2 is server-gated to local development.
  if (first === "dev" || first === "app2") return "developer";
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
export type GeneratedWebRouteHandlerBoundary =
  | "public"
  | "family"
  | "family-device"
  | "operator"
  | "provider"
  | "developer"
  | "developer-family"
  | "internal-service"
  | "mixed-family-provider"
  | "unresolved";

// Exact by design. Route handlers own their authorization rather than inheriting
// the page proxy, so every new handler must receive an explicit reviewed policy.
export const reviewedWebRouteHandlerBoundaries = {
  "apps/web/app/admin/studio/anchor/[id]/route.ts": "operator",
  "apps/web/app/admin/studio/reference/[file]/route.ts": "operator",
  "apps/web/app/api/account-deletion/export/route.ts": "family",
  "apps/web/app/api/account-deletion/route.ts": "family",
  "apps/web/app/api/billing/apple/confirm/route.ts": "family",
  "apps/web/app/api/billing/apple/purchase-interlock/route.ts": "family",
  "apps/web/app/api/billing/apple/webhook/route.ts": "provider",
  "apps/web/app/api/billing/beacon/route.ts": "family",
  "apps/web/app/api/billing/checkout/route.ts": "family",
  "apps/web/app/api/billing/confirm/route.ts": "family",
  "apps/web/app/api/billing/gate/route.ts": "family",
  "apps/web/app/api/billing/portal/route.ts": "family",
  "apps/web/app/api/billing/webhook/route.ts": "provider",
  "apps/web/app/api/chat/attachments/route.ts": "family",
  "apps/web/app/api/chat/dictation/route.ts": "family",
  "apps/web/app/api/chat/history/route.ts": "family",
  "apps/web/app/api/chat/session-binding/route.ts": "family",
  "apps/web/app/api/chat/suggestions/route.ts": "family",
  "apps/web/app/api/chat/upload/route.ts": "family",
  "apps/web/app/api/compliance/filing/route.ts": "family",
  "apps/web/app/api/compliance/pack/route.ts": "family",
  "apps/web/app/api/compliance/summary/route.ts": "family",
  "apps/web/app/api/dev/oidc-status/route.ts": "developer",
  "apps/web/app/api/dev/reset-onboarding/route.ts": "developer-family",
  "apps/web/app/api/dev/test-session/route.ts": "developer",
  "apps/web/app/api/email/unsubscribe/route.ts": "public",
  "apps/web/app/api/email/webhook/route.ts": "provider",
  "apps/web/app/api/family-files/route.ts": "family",
  "apps/web/app/api/hours/export/route.ts": "family",
  "apps/web/app/api/learning-programs/route.ts": "family",
  "apps/web/app/api/learning/review/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/audio/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/finish/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/media/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/retry/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/segments/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/status/route.ts": "family",
  "apps/web/app/api/lessons/consent/route.ts": "family",
  "apps/web/app/api/lessons/route.ts": "family",
  "apps/web/app/api/lessons/upload/route.ts": "family",
  "apps/web/app/api/library/assets/[id]/download/route.ts": "family",
  "apps/web/app/api/library/assets/[id]/process/route.ts": "family",
  "apps/web/app/api/library/assets/route.ts": "family",
  "apps/web/app/api/library/events/route.ts": "family",
  "apps/web/app/api/library/upload/route.ts": "mixed-family-provider",
  "apps/web/app/api/library/uploads/route.ts": "family",
  "apps/web/app/api/link-phone/route.ts": "public",
  "apps/web/app/api/map/answer/route.ts": "family",
  "apps/web/app/api/map/children/route.ts": "family",
  "apps/web/app/api/map/claim/route.ts": "family",
  "apps/web/app/api/map/cron/route.ts": "internal-service",
  "apps/web/app/api/map/deep-dive-start/route.ts": "family",
  "apps/web/app/api/map/extras/route.ts": "family",
  "apps/web/app/api/map/family/route.ts": "family",
  "apps/web/app/api/map/narrative-status/route.ts": "family",
  "apps/web/app/api/map/plan/board/route.ts": "family",
  "apps/web/app/api/map/plan/check/route.ts": "family",
  "apps/web/app/api/map/plan/consent/route.ts": "family",
  "apps/web/app/api/map/plan/progress/route.ts": "family",
  "apps/web/app/api/map/report-rendered/route.ts": "family",
  "apps/web/app/api/map/report-viewed/route.ts": "family",
  "apps/web/app/api/map/report/correct/route.ts": "family",
  "apps/web/app/api/map/resume-link/route.ts": "public",
  "apps/web/app/api/map/resume/route.ts": "public",
  "apps/web/app/api/map/score/route.ts": "family",
  "apps/web/app/api/map/start/route.ts": "public",
  "apps/web/app/api/map/state/route.ts": "family",
  "apps/web/app/api/map/step/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/build/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/keep/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/retry/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/status/route.ts": "family",
  "apps/web/app/api/map/walk-fork/route.ts": "family",
  "apps/web/app/api/map/walk/route.ts": "family",
  "apps/web/app/api/materials/[id]/pdf/route.ts": "family",
  "apps/web/app/api/materials/[id]/print/route.ts": "family",
  "apps/web/app/api/materials/[id]/print/pdf/route.ts": "family",
  "apps/web/app/api/materials/[id]/share/route.ts": "family",
  "apps/web/app/api/mobile/bootstrap-event/route.ts": "public",
  "apps/web/app/api/mobile/event/route.ts": "family",
  "apps/web/app/api/mobile/onboarding/making/route.ts": "family",
  "apps/web/app/api/mobile/onboarding/react/route.ts": "family",
  "apps/web/app/api/mobile/onboarding/route.ts": "family",
  "apps/web/app/api/onboarding/basics/route.ts": "family",
  "apps/web/app/api/onboarding/homeschool-profile/route.ts": "family",
  "apps/web/app/api/onboarding/making-status/route.ts": "family",
  "apps/web/app/api/phone-claim/confirm/route.ts": "family",
  "apps/web/app/api/phone-claim/start/route.ts": "family",
  "apps/web/app/api/progress/[childId]/next-move/route.ts": "family",
  "apps/web/app/api/progress/[childId]/route.ts": "family",
  "apps/web/app/api/progress/abilities-explorer/route.ts": "family",
  "apps/web/app/api/progress/conflict/route.ts": "family",
  "apps/web/app/api/sync/cron/route.ts": "internal-service",
  "apps/web/app/api/sync/ingest/route.ts": "family-device",
  "apps/web/app/api/sync/pull/route.ts": "family-device",
  "apps/web/app/api/tasks/[taskId]/pause/route.ts": "family",
  "apps/web/app/api/tasks/[taskId]/route.ts": "family",
  "apps/web/app/api/tasks/[taskId]/run-now/route.ts": "family",
  "apps/web/app/api/tasks/[taskId]/schedule/route.ts": "family",
  "apps/web/app/api/tasks/feedback/route.ts": "family",
  "apps/web/app/api/tasks/route.ts": "family",
  "apps/web/app/api/video/describe/route.ts": "family",
  "apps/web/app/api/video/upload/route.ts": "family",
  "apps/web/app/api/voice/call-me/route.ts": "family",
  "apps/web/app/api/voice/context/route.ts": "provider",
  "apps/web/app/api/voice/curriculum/insights/route.ts": "provider",
  "apps/web/app/api/voice/curriculum/start/route.ts": "family",
  "apps/web/app/api/voice/insights/route.ts": "provider",
  "apps/web/app/api/voice/realtime/token/route.ts": "family",
  "apps/web/app/api/voice/live/session/route.ts": "family",
  "apps/web/app/api/voice/realtime/tool/route.ts": "family",
  "apps/web/app/api/voice/realtime/turn/route.ts": "family",
  "apps/web/app/api/voice/tools/log-hours/route.ts": "provider",
  "apps/web/app/api/voice/tools/remember/route.ts": "provider",
  "apps/web/app/api/voice/tools/send-email/route.ts": "provider",
  "apps/web/app/api/voice/tools/send-signup-link/route.ts": "provider",
  "apps/web/app/api/waitlist/route.ts": "public",
  "apps/web/app/auth/callback/route.ts": "public",
  "apps/web/app/auth/confirm/route.ts": "public",
  "apps/web/app/blog/rss.xml/route.ts": "public",
  "apps/web/app/homa.vcf/route.ts": "public",
} as const satisfies Readonly<Record<string, Exclude<GeneratedWebRouteHandlerBoundary, "unresolved">>>;

export const generatedWebRouteHandlerRuntimePolicies = {
  public: { exposure: "public", credential: "none-or-possession-token", invoker: "public-or-identity-provider" },
  family: { exposure: "authenticated", credential: "family-context", invoker: "family-client" },
  "family-device": { exposure: "authenticated", credential: "family-device-bearer", invoker: "family-device" },
  operator: { exposure: "authenticated", credential: "operator-session", invoker: "operator-client" },
  provider: { exposure: "authenticated", credential: "provider-signature-or-shared-secret", invoker: "external-provider" },
  developer: { exposure: "internal", credential: "development-gate", invoker: "developer" },
  "developer-family": { exposure: "internal", credential: "development-gate-and-family-session", invoker: "authenticated-developer-family" },
  "internal-service": { exposure: "internal", credential: "scheduler-secret", invoker: "provider:vercel" },
  "mixed-family-provider": { exposure: "authenticated", credential: "family-session-or-provider-signature", invoker: "family-or-provider:vercel-blob" },
} as const satisfies Readonly<Record<Exclude<GeneratedWebRouteHandlerBoundary, "unresolved">, BrandRouteHandlerRuntimeBoundary>>;

export function classifyGeneratedWebRouteHandlerBoundary(path: string): GeneratedWebRouteHandlerBoundary | null {
  if (!path.startsWith("apps/web/app/") || !path.endsWith("/route.ts")) return null;
  return reviewedWebRouteHandlerBoundaries[path as keyof typeof reviewedWebRouteHandlerBoundaries] ?? "unresolved";
}

export function generatedWebRouteHandlerRuntimePolicy(path: string): BrandRouteHandlerRuntimeBoundary | null {
  const boundary = classifyGeneratedWebRouteHandlerBoundary(path);
  if (boundary === null || boundary === "unresolved") return null;
  return { ...generatedWebRouteHandlerRuntimePolicies[boundary] };
}

export function assertNoUnresolvedRouteHandlers(paths: readonly string[]): void {
  const unresolved = paths.filter((path) => classifyGeneratedWebRouteHandlerBoundary(path) === "unresolved");
  if (unresolved.length > 0) {
    throw new Error([
      "Web route handler requires an explicit reviewed runtime boundary:",
      ...unresolved.sort().map((path) => `- ${path}`),
    ].join("\n"));
  }
}
