/** This deliberately small, browser-safe module keeps the exact phrase shared
 * by the UI and the server without pulling billing or database code into a
 * client bundle. */
export function deletionConfirmationFor(familyName: string): string {
  return `Delete ${familyName}`;
}

export function hasExactDeletionConfirmation(
  familyName: string,
  confirmation: unknown,
): boolean {
  return typeof confirmation === "string" && confirmation === deletionConfirmationFor(familyName);
}
