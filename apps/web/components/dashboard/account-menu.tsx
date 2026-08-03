"use client";

import { useEffect, useState } from "react";
import { LogOut, Settings } from "lucide-react";

import { signOutAction } from "../../app/signin/actions";
import { QuietAction } from "../design/QuietAction";

/**
 * The sidebar's account footer. The avatar + name row is a single button;
 * clicking it opens a small menu above the row carrying Settings and Sign
 * out, the account-row pattern chat apps set (founder ask 2026-07-09: the
 * old bare sign-out glyph read as a mystery icon, so both icon buttons
 * retired into this menu). Client-side for the open state; closes on an
 * outside tap, Escape, or picking an item. Entrance per the
 * emil-design-eng rules: opacity + transform only, ease-out, origin at
 * the trigger edge (bottom), and React unmounts it instantly on close,
 * same as the marketing nav's phone menu.
 */
export function AccountMenu({
  parentName,
  familyName,
  avatarUrl,
}: {
  parentName: string;
  familyName: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="quiet-shell__account">
      {open ? (
        <>
          {/* Tap-catch layer: any tap outside the menu closes it. */}
          <div className="quiet-shell__scrim" onClick={close} aria-hidden="true" />
          <div
            id="sidebar-account-menu"
            className="quiet-shell__menu quiet-shell__menu--account"
          >
            <QuietAction
              href="/app/settings"
              onClick={close}
              kind="quiet"
              className="quiet-shell__menu-action"
              icon={<Settings size={18} aria-hidden="true" />}
            >
              Settings
            </QuietAction>
            <div className="quiet-shell__menu-separator" aria-hidden="true" />
            <form action={signOutAction}>
              <QuietAction
                type="submit"
                kind="quiet"
                className="quiet-shell__menu-action"
                icon={<LogOut size={18} aria-hidden="true" />}
              >
                Sign out
              </QuietAction>
            </form>
          </div>
        </>
      ) : null}

      <button
        type="button"
        aria-expanded={open ? "true" : "false"}
        aria-controls="sidebar-account-menu"
        onClick={() => setOpen((value) => !value)}
        className="quiet-shell__account-trigger"
      >
        {avatarUrl ? (
          // Plain <img>: a remote Supabase storage URL; next/image would
          // need remotePatterns config for a tiny avatar.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="quiet-shell__account-avatar object-cover"
          />
        ) : (
          <span className="quiet-shell__account-avatar">
            {parentName.charAt(0)}
          </span>
        )}
        <span className="quiet-shell__account-copy">
          <span className="quiet-shell__account-name">{parentName}</span>
          <span className="quiet-shell__account-family">{familyName}</span>
        </span>
      </button>
    </div>
  );
}
