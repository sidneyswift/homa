/**
 * A new OAuth account has a valid session but no family yet. It must land on
 * onboarding so the existing bootstrap can create and link its family.
 * Returning accounts keep the safe destination the caller requested.
 */
export function authCallbackDestination({
  next,
  hasLinkedFamily,
}: {
  next: string;
  hasLinkedFamily: boolean;
}): string {
  return hasLinkedFamily ? next : "/onboarding";
}
