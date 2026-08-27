"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
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

const CONTEXT_SURFACE_EXIT_MS = 200;

/**
 * The family / per-child context switcher (founder direction 2026-07-10,
 * merged design ruled same day): one selection that answers "who am I
 * looking at right now", with three hosts sharing one behavior:
 *
 *   ContextSwitcher · the avatar button on the phone top bar's right
 *     edge; it opens a modal sheet with resting and expanded detents, so
 *     switching never needs the drawer.
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
 * Desktop menu behavior matches the house menus (AccountMenu, MobileNav):
 * closes on Escape, an outside tap, or a pick; entrance is opacity +
 * transform only, ease-out. The phone sheet adds a scrim, focus containment,
 * history Back support, safe-area padding, and pointer/keyboard detents. Rows
 * and menu items carry data-drawer-close so the phone drawer dismisses on a
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
type ViewContextPickHandler = (target: string) => void | Promise<void>;

function useViewContextPick(
  selected: string,
  onSelect?: ViewContextPickHandler,
) {
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
      if (onSelect) {
        await onSelect(target);
        return;
      }
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
  onSelect,
}: {
  kids: SidebarKid[];
  /** "family" or one of the kids' ids (the layout validated it). */
  selected: string;
  buttonClassName: string;
  /** Optional local projection for deterministic fixture routes. */
  onSelect?: ViewContextPickHandler;
}) {
  const [surfaceState, setSurfaceState] = useState<"closed" | "open" | "closing">("closed");
  const open = surfaceState !== "closed";
  const [detent, setDetent] = useState<"resting" | "expanded">("resting");
  const [isPhone, setIsPhone] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hadOpenSurfaceRef = useRef(false);
  const historyMarkerRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number } | null>(null);
  const previousPhoneRef = useRef<boolean | null>(null);
  const menuId = useId();
  const sheetId = useId();
  const sheetHeadingId = useId();
  const { current, pick } = useViewContextPick(selected, onSelect);

  const finishClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSurfaceState("closed");
    setDetent("resting");
  }, []);

  const close = useCallback((fromHistory = false) => {
    if (surfaceState !== "open") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(finishClose, 0);
    } else {
      closeTimerRef.current = window.setTimeout(finishClose, CONTEXT_SURFACE_EXIT_MS);
    }
    setSurfaceState("closing");
    setDetent("resting");
    if (
      !fromHistory &&
      historyMarkerRef.current &&
      window.history.state?.__homaContextSheet === true
    ) {
      historyMarkerRef.current = false;
      window.history.back();
    }
  }, [finishClose, surfaceState]);

  const openSurface = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDetent("resting");
    if (isPhone === true && !historyMarkerRef.current) {
      window.history.pushState(
        { ...window.history.state, __homaContextSheet: true },
        "",
      );
      historyMarkerRef.current = true;
    }
    setSurfaceState("open");
  }, [isPhone]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 63.999rem)");
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isPhone === null) return;
    const previousPhone = previousPhoneRef.current;
    previousPhoneRef.current = isPhone;
    if (previousPhone === null || previousPhone === isPhone) return;
    // A rotation across the shell breakpoint must not strand one surface
    // behind the other. The new host will be closed and re-openable.
    const resetTimer = window.setTimeout(finishClose, 0);
    return () => window.clearTimeout(resetTimer);
  }, [finishClose, isPhone]);

  useEffect(() => {
    if (surfaceState !== "open") return;
    const surface = isPhone ? sheetRef.current : menuRef.current;
    if (!surface) return;
    const activeSurface = surface;

    const focusableElements = () =>
      Array.from(
        activeSurface.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.tabIndex >= 0);

    window.requestAnimationFrame(() => {
      (focusableElements()[0] ?? activeSurface).focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        activeSurface.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !activeSurface.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!isPhone && !rootRef.current?.contains(event.target as Node)) close();
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, isPhone, surfaceState]);

  useEffect(() => {
    if (surfaceState === "closed") {
      if (hadOpenSurfaceRef.current) {
        hadOpenSurfaceRef.current = false;
        (previousFocusRef.current ?? triggerRef.current)?.focus({
          preventScroll: true,
        });
        previousFocusRef.current = null;
      }
      return;
    }
    hadOpenSurfaceRef.current = true;
  }, [surfaceState]);

  useEffect(() => {
    if (!open || !isPhone) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onPopState() {
      historyMarkerRef.current = false;
      close(true);
    }
    window.addEventListener("popstate", onPopState);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", onPopState);
    };
  }, [close, isPhone, open]);

  function pickAndClose(target: string) {
    close();
    pick(target);
  }

  function onDragPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDragPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientY - drag.startY;
    if (delta > 48) {
      close();
    } else if (delta < -48) {
      setDetent("expanded");
    }
  }

  function onDragPointerCancel() {
    dragRef.current = null;
  }

  if (kids.length < 2 || isPhone === null) return null;

  const currentKidIndex = kids.findIndex((kid) => kid.id === current);
  const currentKid = currentKidIndex === -1 ? null : kids[currentKidIndex];

  return (
    <div ref={rootRef} className="quiet-shell__context">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup={isPhone ? "dialog" : "menu"}
        aria-expanded={open ? "true" : "false"}
        aria-controls={isPhone ? sheetId : menuId}
        aria-label={
          currentKid
            ? `Viewing ${currentKid.name}. Change who you're viewing`
            : "Viewing the whole family. Change who you're viewing"
        }
        onClick={() => (open ? close() : openSurface())}
        className={buttonClassName}
      >
        {currentKid ? (
          <SwitcherKidAvatar kid={currentKid} index={currentKidIndex} size={32} />
        ) : (
          <FamilyAvatar size={32} />
        )}
      </button>

      {open && !isPhone ? (
        <>
          <div className="quiet-shell__context-live" aria-live="polite">
            <QuietStatus tone="info">
              Viewing {currentKid ? currentKid.name : "the whole family"}
            </QuietStatus>
          </div>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            tabIndex={-1}
            data-closing={surfaceState === "closing" ? "true" : undefined}
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

      {/* Portaled to document.body: quiet-shell__mobile-bar (this
          component's DOM ancestor) is position: sticky, which Chromium
          treats as a containing block for position: fixed descendants.
          Left inline, the scrim and sheet below resolved their fixed
          offsets against the ~55px sticky header instead of the
          viewport, rendering the sheet almost entirely above it
          (gh#1015 live-verification session, 2026-08-27). */}
      {open && isPhone ? createPortal(
        <>
          <div
            className="quiet-context-selection__scrim"
            onClick={() => close()}
            data-closing={surfaceState === "closing" ? "true" : undefined}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            id={sheetId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={sheetHeadingId}
            tabIndex={-1}
            data-context-selection="sheet"
            data-context-mode="sheet"
            data-detent={detent}
            data-closing={surfaceState === "closing" ? "true" : undefined}
            className="quiet-context-selection"
          >
            <button
              type="button"
              className="quiet-context-selection__grabber"
              aria-label={detent === "resting" ? "Expand people selector" : "Close people selector"}
              aria-expanded={detent === "expanded" ? "true" : "false"}
              onClick={() => (detent === "resting" ? setDetent("expanded") : close())}
              onPointerDown={onDragPointerDown}
              onPointerUp={onDragPointerUp}
              onPointerCancel={onDragPointerCancel}
            />
            <header className="quiet-context-selection__header">
              <div>
                <p className="quiet-context-selection__eyebrow">Your view</p>
                <h2 id={sheetHeadingId}>Who are you looking at?</h2>
              </div>
              <button
                type="button"
                className="quiet-shell__icon-action"
                aria-label="Close people selector"
                onClick={() => close()}
              >
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="quiet-context-selection__body" role="radiogroup" aria-labelledby={sheetHeadingId}>
              <button
                type="button"
                role="radio"
                aria-checked={current === VIEW_CONTEXT_FAMILY ? "true" : "false"}
                data-drawer-close=""
                onClick={() => pickAndClose(VIEW_CONTEXT_FAMILY)}
                className="quiet-context-selection__option"
              >
                <FamilyAvatar size={36} />
                <span className="min-w-0 flex-1">
                  <span className="quiet-context-selection__name">Whole family</span>
                  <span className="quiet-context-selection__description">Keep everyone in view</span>
                </span>
                {current === VIEW_CONTEXT_FAMILY ? <Icon name="check" size={20} /> : null}
              </button>
              {kids.map((kid, index) => (
                <button
                  key={kid.id}
                  type="button"
                  role="radio"
                  aria-checked={current === kid.id ? "true" : "false"}
                  data-drawer-close=""
                  onClick={() => pickAndClose(kid.id)}
                  className="quiet-context-selection__option"
                >
                  <SwitcherKidAvatar kid={kid} index={index} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="quiet-context-selection__name">{kid.name}</span>
                    <span className="quiet-context-selection__description">View {kid.name}&apos;s work</span>
                  </span>
                  {current === kid.id ? <Icon name="check" size={20} /> : null}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </div>
  );
}

/** The phone top bar's avatar button + drop menu. Multi-kid only. */
export function ContextSwitcher({
  kids,
  selected,
  onSelect,
}: {
  kids: SidebarKid[];
  selected: string;
  onSelect?: ViewContextPickHandler;
}) {
  return (
    <SwitcherMenu
      kids={kids}
      selected={selected}
      buttonClassName="quiet-shell__context-trigger"
      onSelect={onSelect}
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
  onSelect,
}: {
  kids: SidebarKid[];
  selected: string;
  onSelect?: ViewContextPickHandler;
}) {
  const pathname = usePathname();
  if (kids.length < 2 || !pageShowsContextSwitcher(pathname)) return null;

  return (
    <div className="quiet-shell__context-desktop print:hidden">
      <SwitcherMenu
        kids={kids}
        selected={selected}
        buttonClassName="quiet-shell__context-trigger quiet-shell__context-trigger--desktop"
        onSelect={onSelect}
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
