"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Users } from "lucide-react";

import { ageLabel } from "@homa/core";

import { setViewContextAction } from "../../app/app/view-context-actions";
import { kidSwitchTargetPath, VIEW_CONTEXT_FAMILY } from "../../lib/view-context";
import { avatarTone, type SidebarKid } from "./sidebar";

/**
 * The family / per-child context switcher (founder direction 2026-07-10,
 * merged design ruled same day): one selection that answers "who am I
 * looking at right now", with two hosts sharing one behavior:
 *
 *   ContextSwitcher · the avatar button on the phone top bar's right
 *     edge; its menu drops in place, so switching never needs the drawer.
 *   ViewingRows · the sidebar section that REPLACED the old "My kids"
 *     link list (founder ruling: two kid lists in one rail was one too
 *     many). A "Whole family" row, then the kid rows, active highlighted.
 *
 * Picking anyone keeps the parent on her current surface: kid-scoped
 * pages (a report, a kid page) swap to the sibling's same page, and
 * everything else re-reads the selection in place (the planner narrows,
 * chat refocuses). "Whole family" always stays put. Families with one
 * kid see no switcher anywhere; the sidebar keeps a plain "My kids" link
 * to the kid's page instead.
 *
 * Menu behavior matches the house menus (AccountMenu, MobileNav): closes
 * on Escape, an outside tap, or a pick; entrance is opacity + transform
 * only, ease-out. The outside tap uses a document listener instead of a
 * fixed scrim because the phone bar's backdrop-blur makes it the
 * containing block for fixed descendants (see mobile-nav.tsx). Rows and
 * menu items carry data-drawer-close so the phone drawer dismisses on a
 * pick, same as its links.
 */

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

/**
 * useViewContextPick(selected): { current, pick }
 * The one behavior both hosts share: optimistic selection, the cookie
 * write (server action re-validates the id), and the stay-on-surface
 * navigation rule via kidSwitchTargetPath.
 */
function useViewContextPick(selected: string) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);

  const current = isPending && picked !== null ? picked : selected;

  function pick(target: string) {
    if (target === current) return;
    setPicked(target);
    const destination =
      target === VIEW_CONTEXT_FAMILY ? null : kidSwitchTargetPath(pathname, target);
    startTransition(async () => {
      await setViewContextAction(target);
      if (destination) router.push(destination);
    });
  }

  return { current, pick };
}

/** The phone top bar's avatar button + drop menu. Multi-kid only. */
export function ContextSwitcher({
  kids,
  selected,
}: {
  kids: SidebarKid[];
  /** "family" or one of the kids' ids (the layout validated it). */
  selected: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { current, pick } = useViewContextPick(selected);

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

  const currentKidIndex = kids.findIndex((kid) => kid.id === current);
  const currentKid = currentKidIndex === -1 ? null : kids[currentKidIndex];

  function pickAndClose(target: string) {
    setOpen(false);
    pick(target);
  }

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

      {open ? (
        <div
          id="context-switcher-menu"
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-md border border-border-subtle bg-card p-1.5 shadow-lg transition-[opacity,translate,scale] duration-(--dur-base) ease-out starting:-translate-y-1 starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={current === VIEW_CONTEXT_FAMILY ? "true" : "false"}
            data-drawer-close=""
            onClick={() => pickAndClose(VIEW_CONTEXT_FAMILY)}
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
              data-drawer-close=""
              onClick={() => pickAndClose(kid.id)}
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
      ) : null}
    </div>
  );
}

/**
 * The sidebar's one kid list. Multi-kid families get the switcher rows
 * ("Viewing": Whole family + each kid, active highlighted, tap to
 * rescope in place). A single-kid family keeps the old "My kids" link
 * to the kid's page: with nothing to switch, a switcher would be noise.
 */
export function ViewingRows({
  kids,
  selected,
}: {
  kids: SidebarKid[];
  selected: string;
}) {
  const { current, pick } = useViewContextPick(selected);

  if (kids.length === 0) return null;

  if (kids.length === 1) {
    const kid = kids[0];
    return (
      <div className="mt-6 px-1">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-subtle">
          My kids
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          <li>
            <Link
              href={`/app/kids/${kid.id}`}
              className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-page"
            >
              <KidAvatar kid={kid} index={0} size={30} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-body">
                  {kid.name}
                </span>
                <span className="block text-[0.72rem] text-subtle">
                  {ageLabel(kid.ageMonths)}
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  const rowClass = (active: boolean) =>
    active
      ? "flex w-full cursor-pointer items-center gap-2.5 rounded-md bg-brand-soft px-1.5 py-1.5 text-left"
      : "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors duration-(--dur-fast) ease-out hover:bg-page";

  return (
    <div className="mt-6 px-1" role="group" aria-label="Who you're viewing">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-subtle">
        Viewing
      </p>
      <div className="mt-2 flex flex-col gap-1">
        <button
          type="button"
          aria-pressed={current === VIEW_CONTEXT_FAMILY ? "true" : "false"}
          data-drawer-close=""
          onClick={() => pick(VIEW_CONTEXT_FAMILY)}
          className={rowClass(current === VIEW_CONTEXT_FAMILY)}
        >
          <FamilyAvatar size={30} />
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              current === VIEW_CONTEXT_FAMILY
                ? "font-bold text-[var(--clay-700)]"
                : "font-semibold text-body"
            }`}
          >
            Whole family
          </span>
          {current === VIEW_CONTEXT_FAMILY ? (
            <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />
          ) : null}
        </button>

        {kids.map((kid, index) => {
          const active = current === kid.id;
          return (
            <button
              key={kid.id}
              type="button"
              aria-pressed={active ? "true" : "false"}
              data-drawer-close=""
              onClick={() => pick(kid.id)}
              className={rowClass(active)}
            >
              <KidAvatar kid={kid} index={index} size={30} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm ${
                    active ? "font-bold text-[var(--clay-700)]" : "font-semibold text-body"
                  }`}
                >
                  {kid.name}
                </span>
                <span className="block text-[0.72rem] text-subtle">
                  {ageLabel(kid.ageMonths)}
                </span>
              </span>
              {active ? (
                <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
