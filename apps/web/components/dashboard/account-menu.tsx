"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, Settings } from "lucide-react";

import { signOutAction } from "../../app/signin/actions";

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
    <div className="relative mt-auto border-t border-border-subtle pt-1.5">
      {open ? (
        <>
          {/* Tap-catch layer: any tap outside the menu closes it. */}
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
          <div
            id="sidebar-account-menu"
            className="absolute inset-x-0 bottom-full z-50 mb-1.5 origin-bottom rounded-md border border-border-subtle bg-card p-1.5 shadow-lg transition-[opacity,translate,scale] duration-(--dur-base) ease-out starting:translate-y-1 starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none"
          >
            <Link
              href="/app/settings"
              onClick={close}
              className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-medium text-body transition-colors duration-(--dur-fast) ease-out hover:bg-page"
            >
              <Settings size={16} className="text-subtle" aria-hidden="true" />
              Settings
            </Link>
            <div className="mx-2 my-1 h-px bg-border-subtle" aria-hidden="true" />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm font-medium text-body transition-colors duration-(--dur-fast) ease-out hover:bg-page"
              >
                <LogOut size={16} className="text-subtle" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}

      <button
        type="button"
        aria-expanded={open ? "true" : "false"}
        aria-controls="sidebar-account-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors duration-(--dur-fast) ease-out hover:bg-page"
      >
        {avatarUrl ? (
          // Plain <img>: a remote Supabase storage URL; next/image would
          // need remotePatterns config for a tiny avatar.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-[34px] w-[34px] rounded-full border border-border-subtle object-cover"
          />
        ) : (
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--sage-500)] font-bold text-white">
            {parentName.charAt(0)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.85rem] font-semibold text-body">{parentName}</span>
          <span className="block truncate text-[0.72rem] text-subtle">{familyName}</span>
        </span>
      </button>
    </div>
  );
}
