"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { WallDoor } from "@homa/core";

import { sendWallBeacon } from "./wall-beacon";

/**
 * A plain link that also counts as a door tap (report.action_tapped).
 * Used where a wall door is a navigation, like the report's "Build the
 * 4-week plan" button: the beacon's keepalive survives the navigation,
 * and the destination page owns the wall decision server-side.
 */
export function DoorLink({
  href,
  door,
  childId,
  className,
  children,
}: {
  href: string;
  door: WallDoor;
  childId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => sendWallBeacon({ kind: "door_tap", door, childId })}
    >
      {children}
    </Link>
  );
}
