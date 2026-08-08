"use client";

import { useEffect, useRef } from "react";

import type { WallDoor } from "@homa/core";

import type { WallCheckout } from "../../lib/billing/wall-types";
import { sendWallBeacon } from "./wall-beacon";
import { WALL_DISMISS, wallHeadline } from "./wall-copy";
import { WallOffer } from "./wall-offer";

/**
 * The wall as a dialog, opened by a door tap (month button, call line,
 * chat composer). Same scrim-and-card recipe as the signup popup
 * (.wall-overlay / .wall-card in globals.css), same escape hatches:
 * "Not now", Escape, tap outside. Dismissing is a first-class path by
 * law (offers never commands); the report and everything already built
 * stay open behind it.
 */
export function WallModal({
  door,
  childName,
  checkout,
  open,
  onClose,
}: {
  door: WallDoor;
  childName?: string | null;
  checkout: WallCheckout;
  open: boolean;
  onClose: () => void;
}) {
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    sendWallBeacon({ kind: "wall_viewed", door });
  }, [open, door]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dismissRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        sendWallBeacon({ kind: "wall_dismissed", door });
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, door, onClose]);

  if (!open) return null;

  function dismiss() {
    sendWallBeacon({ kind: "wall_dismissed", door });
    onClose();
  }

  return (
    <div className="quiet-paywall-surface wall-overlay" data-brand-surface="wall-modal" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={wallHeadline(door)}
        className="quiet-paywall__modal wall-card wall-card--pricing"
        data-brand-layer="wall-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <WallOffer door={door} childName={childName} checkout={checkout} />
        <button
          ref={dismissRef}
          type="button"
          onClick={dismiss}
          className="quiet-paywall__dismiss"
        >
          {WALL_DISMISS}
        </button>
      </div>
    </div>
  );
}
