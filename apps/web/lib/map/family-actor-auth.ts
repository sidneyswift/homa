export type FamilyActorAuthLookup =
  | { status: "authenticated"; userId: string }
  | { status: "anonymous" }
  | { status: "failure"; message: string };

export function classifyFamilyActorAuthLookup(input: {
  userId: string | null;
  error: {
    name?: string;
    message?: string;
  } | null;
}): FamilyActorAuthLookup {
  if (input.userId) {
    return { status: "authenticated", userId: input.userId };
  }
  if (
    input.error === null ||
    input.error.name === "AuthSessionMissingError"
  ) {
    return { status: "anonymous" };
  }
  return {
    status: "failure",
    message:
      input.error.message?.trim() || "Authentication lookup failed",
  };
}
