import type { WallDoor } from "@homa/core";

/**
 * Fire-and-forget wall analytics from the browser to
 * /api/billing/beacon, which validates, re-scopes, and emits the
 * registry events server-side (the public events policy stays
 * waitlist-only on purpose). keepalive lets a beacon survive the
 * navigation it usually precedes (a door tap is often a link tap).
 */

export type WallBeacon =
  | { kind: "door_tap"; door: WallDoor; childId?: string }
  | { kind: "wall_viewed"; door: WallDoor }
  | { kind: "wall_dismissed"; door: WallDoor }
  | { kind: "checkout_started"; door: WallDoor; plan: "monthly" | "annual" };

export function sendWallBeacon(beacon: WallBeacon): void {
  try {
    void fetch("/api/billing/beacon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(beacon),
      keepalive: true,
    }).catch(() => {
      // Best-effort by law: analytics never break the feature emitting them.
    });
  } catch {
    // Same law, synchronous failures included.
  }
}
