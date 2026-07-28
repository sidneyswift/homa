/**
 * Shared result shape for the Google and Apple sign-in flows, so the
 * sign-in screen handles every provider the same way.
 */
export type SignInFlowResult =
  /** Session established. SessionProvider takes it from here. */
  | { status: "signed-in" }
  /** The parent backed out (closed the sheet, tapped cancel). */
  | { status: "dismissed" }
  /** Something actually broke. `reason` is for logs, never for parents. */
  | { status: "failed"; reason: string };
