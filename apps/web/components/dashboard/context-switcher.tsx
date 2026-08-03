"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ageLabel } from "@homa/core";

import { setViewContextAction } from "../../app/app/view-context-actions";
import {
  kidSwitchTargetPath,
  pageShowsContextSwitcher,
  VIEW_CONTEXT_FAMILY,
} from "../../lib/view-context";
import { Icon } from "../design/Icon";
import { QuietStatus } from "../design/QuietStatus";
import { KidAvatar } from "./kid-avatar";
import { type SidebarKid } from "./sidebar";

/**
 * The family / per-child context switcher (founder direction 2026-07-10,
 * merged design ruled same day): one selection that answers "who am I
 * looking at right now", with three hosts sharing one behavior:
 *
 *   ContextSwitcher · the avatar button on the phone top bar's right
 *     edge; its menu drops in place, so switching never needs the drawer.
 *   DesktopContextSwitcher · the same avatar at the viewport's top right
 *     on desktop (founder ruling 2026-07-12: the kid switcher belongs at
 *     the app's top right like the phone bar, not in the rail), shown
 *     only on pages the selection affects (pageShowsContextSwitcher).
 *   ViewingRows · the phone DRAWER's kid link. Multi-kid families switch
 *     from the top-right avatar (ContextSwitcher), so the drawer no longer
 *     repeats the switcher rows (2026-07-18: they duplicated that avatar);
 *     the desktop rail dropped them earlier (2026-07-12). Single-kid
 *     families, which have no top-right avatar, keep a plain "My kids"
 *     link here.
 *
 * Picking anyone keeps the parent on her current surface: kid-scoped
 * pages (a report, a kid page) swap to the sibling's same page, and
 * everything else re-reads the selection in place (the planner narrows,
 * chat refocuses). "Whole family" always stays put. Families with one
 * kid see no switcher anywhere; the phone drawer keeps a plain "My kids"
 * link to the kid's page instead.
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
      className="quiet-shell__family-avatar"
      style={{ width: size, height: size }}
    >
      <Icon name="people" size={20} />
    </span>
  );
}

function SwitcherKidAvatar({ kid, index, size }: { kid: SidebarKid; index: number; size: number }) {
  return <KidAvatar name={kid.name} index={index} avatarUrl={kid.avatarUrl} size={size} />;
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
      if (destination) {
        router.push(destination);
      } else {
        router.refresh();
      }
    });
  }

  return { current, pick };
}

/**
 * The avatar button + drop menu, the shared guts of the phone bar's and
 * the desktop corner's switcher. Multi-kid only; the hosts differ only
 * in where they sit and how the button is dressed. The menu id comes
 * from useId because both hosts stay mounted (CSS swaps them at lg), so
 * a hardcoded id would collide.
 */
function SwitcherMenu({
  kids,
  selected,
  buttonClassName,
}: {
  kids: SidebarKid[];
  /** "family" or one of the kids' ids (the layout validated it). */
  selected: string;
  buttonClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
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
    <div ref={rootRef} className="quiet-shell__context">
      <button
        type="button"
        aria-expanded={open ? "true" : "false"}
        aria-controls={menuId}
        aria-label={
          currentKid
            ? `Viewing ${currentKid.name}. Change who you're viewing`
            : "Viewing the whole family. Change who you're viewing"
        }
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName}
      >
        {currentKid ? (
          <SwitcherKidAvatar kid={currentKid} index={currentKidIndex} size={32} />
        ) : (
          <FamilyAvatar size={32} />
        )}
      </button>

      {open ? (
        <>
          <div className="quiet-shell__context-live" aria-live="polite">
            <QuietStatus tone="info">
              Viewing {currentKid ? currentKid.name : "the whole family"}
            </QuietStatus>
          </div>
          <div
            id={menuId}
            role="menu"
            className="quiet-shell__menu quiet-shell__context-menu"
          >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={current === VIEW_CONTEXT_FAMILY ? "true" : "false"}
            data-drawer-close=""
            onClick={() => pickAndClose(VIEW_CONTEXT_FAMILY)}
            className="quiet-shell__menu-action"
          >
            <FamilyAvatar size={26} />
            <span className="min-w-0 flex-1 truncate">Whole family</span>
            {current === VIEW_CONTEXT_FAMILY ? (
              <Icon name="check" size={16} />
            ) : null}
          </button>
          <div className="quiet-shell__menu-separator" aria-hidden="true" />
          {kids.map((kid, index) => (
            <button
              key={kid.id}
              type="button"
              role="menuitemradio"
              aria-checked={current === kid.id ? "true" : "false"}
              data-drawer-close=""
              onClick={() => pickAndClose(kid.id)}
              className="quiet-shell__menu-action"
            >
              <SwitcherKidAvatar kid={kid} index={index} size={26} />
              <span className="min-w-0 flex-1 truncate">{kid.name}</span>
              {current === kid.id ? (
                <Icon name="check" size={16} />
              ) : null}
            </button>
          ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** The phone top bar's avatar button + drop menu. Multi-kid only. */
export function ContextSwitcher({
  kids,
  selected,
}: {
  kids: SidebarKid[];
  selected: string;
}) {
  return (
    <SwitcherMenu
      kids={kids}
      selected={selected}
      buttonClassName="quiet-shell__context-trigger"
    />
  );
}

/**
 * Desktop's kid switcher (founder ruling 2026-07-12): the same avatar,
 * floating at the viewport's top right where the phone bar keeps its
 * own, dressed as a small white card so it reads over any page. Multi-kid
 * only, and only on pages the selection affects; Tasks and Settings
 * ignore it, so there it steps away. Fixed to the viewport like the
 * rail, hidden below lg where the phone bar takes over.
 */
export function DesktopContextSwitcher({
  kids,
  selected,
}: {
  kids: SidebarKid[];
  selected: string;
}) {
  const pathname = usePathname();
  if (kids.length < 2 || !pageShowsContextSwitcher(pathname)) return null;

  return (
    <div className="quiet-shell__context-desktop print:hidden">
      <SwitcherMenu
        kids={kids}
        selected={selected}
        buttonClassName="quiet-shell__context-trigger quiet-shell__context-trigger--desktop"
      />
    </div>
  );
}

/**
 * The phone drawer's single-kid link (the drawer renders the whole
 * sidebar). The switcher rows retired here (2026-07-18): a multi-kid
 * family already switches from the top-right avatar (ContextSwitcher),
 * so repeating "Viewing: Whole family + each kid" in the drawer was one
 * selector too many. A single-kid family has no top-right avatar, so the
 * drawer keeps the plain "My kids" link to the kid's page as its one door
 * there; with nothing to switch, a switcher would be noise.
 */
export function ViewingRows({ kids }: { kids: SidebarKid[] }) {
  if (kids.length !== 1) return null;

  const kid = kids[0];
  return (
    <div className="quiet-shell__viewing">
      <p className="quiet-shell__viewing-label">
        My kids
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        <li>
          <Link
            href={`/app/kids/${kid.id}`}
            className="quiet-shell__viewing-link"
          >
            <SwitcherKidAvatar kid={kid} index={0} size={30} />
            <span className="min-w-0">
              <span className="quiet-shell__viewing-name">
                {kid.name}
              </span>
              <span className="quiet-shell__viewing-age">
                {ageLabel(kid.ageMonths)}
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
