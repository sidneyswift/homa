/**
 * Device sync (mac-mini mailbox) rollout flag. Dark by default, exact
 * string "true" to enable, matching every other behavior gate in the
 * repo. Gates all three /api/sync routes and the applier.
 */
export function deviceSyncEnabled(): boolean {
  return process.env.HOMA_DEVICE_SYNC_ENABLED === "true";
}
