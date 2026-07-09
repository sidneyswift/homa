"use client";

import { useEffect } from "react";

import { autoFillTimeZoneAction } from "../../app/home/actions";

/**
 * Invisible one-shot: when the family row has no time zone yet, capture
 * the signed-in parent's own device zone so the greeting and planner
 * dates are exact without asking anything. The server fills only while
 * the column is null (an explicit settings choice always wins), so a
 * repeat render or a second device can never flap the value.
 */
export function TimeZoneSync() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) void autoFillTimeZoneAction(zone);
  }, []);
  return null;
}
