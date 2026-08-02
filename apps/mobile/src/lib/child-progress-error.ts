export type ChildProgressReadFailureKind =
  | "authentication"
  | "scope"
  | "invalid"
  | "transient";

export class ChildProgressReadError extends Error {
  readonly kind: ChildProgressReadFailureKind;
  readonly status: number | null;
  readonly reason: string | null;

  constructor(
    kind: ChildProgressReadFailureKind,
    message: string,
    status: number | null = null,
    reason: string | null = null,
  ) {
    super(message);
    this.name = "ChildProgressReadError";
    this.kind = kind;
    this.status = status;
    this.reason = reason;
  }
}

export function classifyChildProgressReadFailure(
  status: number,
  reason: string | null,
): ChildProgressReadFailureKind {
  if (status === 401 || status === 403 || reason === "no-session") {
    return "authentication";
  }
  if (
    status === 400 ||
    status === 404 ||
    reason === "invalid-child" ||
    reason === "unknown-child" ||
    reason === "disabled"
  ) {
    return "scope";
  }
  if (reason === "invalid-projection") return "invalid";
  if (status === 429 || status >= 500) return "transient";
  return "invalid";
}

export function shouldRetainStaleChildProgress(cause: unknown): boolean {
  return (
    !(cause instanceof ChildProgressReadError) || cause.kind === "transient"
  );
}

export function progressReadMessage(
  kind: ChildProgressReadFailureKind,
): string {
  switch (kind) {
    case "authentication":
      return "Your session needs to be refreshed.";
    case "scope":
      return "Progress is not available for this child.";
    case "invalid":
      return "Progress could not be verified.";
    case "transient":
      return "We couldn’t check for newer progress.";
  }
}
