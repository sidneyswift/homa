/**
 * The dense abilities explorer stays dark until the taxonomy projection and
 * the responsive Progress surface have been verified together.
 */
export function abilitiesExplorerEnabled(): boolean {
  return process.env.HOMA_ABILITIES_EXPLORER_ENABLED === "true";
}
