"use client";

import { createContext, useContext, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { Icon } from "../../components/design/Icon";
import type { PlannerOpenSignal } from "../app/planner-canvas";
import { readWorkspaceLocation, workspaceHref, type WorkspaceLocation } from "./workspace-location";
import { WorkspacePlanner } from "./workspace-planner";
import styles from "./workspace-shell.module.css";

const locationEvent = "homa-workspace-location";
function subscribeLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(locationEvent, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(locationEvent, callback);
  };
}
function subscribePhone(callback: () => void) {
  const media = window.matchMedia("(max-width: 960px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function navigate(selection: WorkspaceLocation | null) {
  const href = workspaceHref(window.location.href, selection);
  if (href === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  // Native history integrates with Next without navigating or remounting chat.
  window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(locationEvent));
}

export interface WorkspaceConversationProps {
  openPlanner(signal: PlannerOpenSignal): void;
  workspaceOpen: boolean;
  conversationCovered: boolean;
  onPlanRevision(revision: number): void;
}

const WorkspaceContext = createContext<WorkspaceConversationProps | null>(null);
export function useWorkspaceShell(): WorkspaceConversationProps {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("Conversation needs a workspace shell");
  return workspace;
}

/** Keep the conversation in the same React position for the lifetime of the adult session. */
export function WorkspaceShell({ children, userId }: { userId: string | null; children: ReactNode }) {
  const [access, setAccess] = useState(Boolean(userId));
  const search = useSyncExternalStore(subscribeLocation, () => window.location.search, () => "");
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia("(max-width: 960px)").matches, () => false);
  const selection = access ? readWorkspaceLocation(search) : null;
  const open = selection !== null;
  const [planRevision, setPlanRevision] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const openPlanner = useCallback((signal: PlannerOpenSignal) => {
    if (!readWorkspaceLocation(window.location.search)) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    navigate({ kind: "planner", childId: signal.childId });
  }, []);
  const close = useCallback(() => navigate(null), []);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const allowed = Boolean(userId && session?.user.id === userId);
      setAccess(allowed);
      if (!allowed && readWorkspaceLocation(window.location.search)) navigate(null);
    });
    return () => subscription.unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (open && (!wasOpen.current || (phone && document.activeElement?.closest("[inert]")))) heading.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current) {
      const target = opener.current?.isConnected ? opener.current : launcher.current;
      target?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, phone]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      // A nested attachment menu or dialog gets the first chance to consume Escape.
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      close();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !phone) return;
    const element = root.current;
    const composer = element?.querySelector<HTMLElement>("[data-workspace-composer]");
    if (!element || !composer) return;
    const measure = () => {
      const viewportBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
      const top = Math.min(composer.getBoundingClientRect().top, viewportBottom);
      element.style.setProperty("--workspace-sheet-bottom", `${Math.max(0, window.innerHeight - top) + 12}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(composer);
    observer.observe(element);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [open, phone]);

  return <div className={styles.shell} data-workspace-open={open} ref={root}>
    <div className={styles.conversation}>
      <nav className={styles.navigation} aria-label="Your workspace" inert={open && phone}>
        <button type="button" ref={launcher} disabled={!access} aria-expanded={open} aria-controls={open ? "family-workspace" : undefined}
          onClick={() => open ? close() : openPlanner({ childId: null })}>
          <Icon name="calendar" size={16} /><span>Your week</span>
        </button>
      </nav>
      <WorkspaceContext.Provider value={{ openPlanner, workspaceOpen: open, conversationCovered: open && phone, onPlanRevision: setPlanRevision }}>{children}</WorkspaceContext.Provider>
    </div>
    {selection && <aside id="family-workspace" className={styles.panel} aria-labelledby="workspace-title">
      <header className={styles.panelHeader}>
        <h2 id="workspace-title" tabIndex={-1} ref={heading}>Planner</h2>
        <button type="button" onClick={close} aria-label="Close planner"><Icon name="close" size={20} /></button>
      </header>
      <div className={styles.panelBody}>
        <WorkspacePlanner childId={selection.childId} revision={planRevision} onAskHoma={() => root.current?.querySelector<HTMLInputElement>("[data-workspace-composer] input:not([type=file])")?.focus()}
          onChildChange={childId => navigate({ kind: "planner", childId })} />
      </div>
    </aside>}
  </div>;
}
