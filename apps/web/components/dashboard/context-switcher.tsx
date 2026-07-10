"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";

import { setViewContextAction } from "../../app/app/view-context-actions";
import { VIEW_CONTEXT_FAMILY } from "../../lib/view-context";
import { avatarTone, type SidebarKid } from "./sidebar";

/**
 * The family / per-child context switcher (founder direction 2026-07-10):
 * one control that answers "who am I looking at right now". Two hosts,
 * one menu:
 *   bar  · the avatar button on the phone top bar's right edge; the
 *          menu drops from it, so switching kids never needs the drawer.
 *   rail · a labeled row at the top of the desktop sidebar.
 * Picking a kid on a kid-scoped page (their report, their kid page)
 * navigates to the sibling's same page; picking "Whole family" stays
 * put. Everywhere else only the selection changes: the report tab, the
 * planner, and chat all read it server-side from the cookie the action
 * sets. Families with one kid never see this control; there is nothing
 * to switch.
 *
 * Menu behavior matches the house menus (AccountMenu, MobileNav): closes
 * on Escape, an outside tap, or a pick; entrance is opacity + transform
 * only, ease-out. The outside tap uses a document listener instead of a
 * fixed scrim because the phone bar's backdrop-blur makes it the
 * containing block for fixed descendants (see mobile-nav.tsx).
 */

/** Kid-scoped routes: switching kids should land on the sibling's page. */
const REPORT_PAGE = /^\/app\/([^/]+)\/report$/;
const KIDS_PAGE = /^\/app\/kids\/([^/]+)$/;

function switchTargetPath(pathname: string, childId: string): string | null {
  if (REPORT_PAGE.test(pathname)) return `/app/${childId}/report`;
  if (KIDS_PAGE.test(pathname)) return `/app/kids/${childId}`;
  return null;
}

function FamilyAvatar({ size }: { size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--stone-100)",
        color: "var(--stone-600)",
      }}
    >
      <Users size={size * 0.55} aria-hidden="true" />
    </span>
  );
}

function KidAvatar({ kid, index, size }: { kid: SidebarKid; index: number; size: number }) {
  const [bg, ink] = avatarTone(index);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: bg,
        color: ink,
        fontSize: size * 0.45,
      }}
    >
      {kid.name.charAt(0)}
    </span>
  );
}

export function ContextSwitcher({
  kids,
  selected,
  variant,
}: {
  kids: SidebarKid[];
  /** "family" or one of the kids' ids (the layout validated it). */
  selected: string;
  variant: "bar" | "rail";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Optimistic selection: the avatar flips the moment she picks, while
  // the cookie write and refresh land in the background.
  const [picked, setPicked] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (kids.length < 2) return null;

  const current = isPending && picked !== null ? picked : selected;
  const currentKidIndex = kids.findIndex((kid) => kid.id === current);
  const currentKid = currentKidIndex === -1 ? null : kids[currentKidIndex];

  function pick(target: string) {
    setOpen(false);
    if (target === current) return;
    setPicked(target);
    const destination =
      target === VIEW_CONTEXT_FAMILY ? null : switchTargetPath(pathname, target);
    startTransition(async () => {
      await setViewContextAction(target);
      if (destination) router.push(destination);
    });
  }

  const options = (
    <div
      id="context-switcher-menu"
      role="menu"
      className={`absolute z-50 rounded-md border border-border-subtle bg-card p-1.5 shadow-lg transition-[opacity,translate,scale] duration-(--dur-base) ease-out starting:-translate-y-1 starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none ${
        variant === "bar" ? "right-0 top-full mt-2 w-60 origin-top-right" : "inset-x-0 top-full mt-1.5 origin-top"
      }`}
    >
      <button
        type="button"
        role="menuitemradio"
        aria-checked={current === VIEW_CONTEXT_FAMILY ? "true" : "false"}
        onClick={() => pick(VIEW_CONTEXT_FAMILY)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm font-medium text-body transition-colors duration-(--dur-fast) ease-out hover:bg-page"
      >
        <FamilyAvatar size={26} />
        <span className="min-w-0 flex-1 truncate">Whole family</span>
        {current === VIEW_CONTEXT_FAMILY ? (
          <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />
        ) : null}
      </button>
      <div className="mx-2 my-1 h-px bg-border-subtle" aria-hidden="true" />
      {kids.map((kid, index) => (
        <button
          key={kid.id}
          type="button"
          role="menuitemradio"
          aria-checked={current === kid.id ? "true" : "false"}
          onClick={() => pick(kid.id)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm font-medium text-body transition-colors duration-(--dur-fast) ease-out hover:bg-page"
        >
          <KidAvatar kid={kid} index={index} size={26} />
          <span className="min-w-0 flex-1 truncate">{kid.name}</span>
          {current === kid.id ? (
            <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />
          ) : null}
        </button>
      ))}
    </div>
  );

  if (variant === "bar") {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-expanded={open ? "true" : "false"}
          aria-controls="context-switcher-menu"
          aria-label={
            currentKid
              ? `Viewing ${currentKid.name}. Change who you're viewing`
              : "Viewing the whole family. Change who you're viewing"
          }
          onClick={() => setOpen((value) => !value)}
          className="flex cursor-pointer items-center rounded-full p-0.5 transition-colors duration-(--dur-fast) ease-out hover:bg-page active:bg-[var(--stone-100)]"
        >
          {currentKid ? (
            <KidAvatar kid={currentKid} index={currentKidIndex} size={32} />
          ) : (
            <FamilyAvatar size={32} />
          )}
        </button>
        {open ? options : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative mb-4">
      <p className="px-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-subtle">
        Viewing
      </p>
      <button
        type="button"
        aria-expanded={open ? "true" : "false"}
        aria-controls="context-switcher-menu"
        onClick={() => setOpen((value) => !value)}
        className="mt-1.5 flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-border-subtle bg-card px-2 py-1.5 text-left transition-colors duration-(--dur-fast) ease-out hover:border-brand"
      >
        {currentKid ? (
          <KidAvatar kid={currentKid} index={currentKidIndex} size={28} />
        ) : (
          <FamilyAvatar size={28} />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-body">
          {currentKid ? currentKid.name : "Whole family"}
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-subtle" aria-hidden="true" />
      </button>
      {open ? options : null}
    </div>
  );
}
