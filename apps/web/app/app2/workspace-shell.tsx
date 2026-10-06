"use client";

import { createContext, useContext, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useOptimistic, useTransition, useMemo, type ReactNode } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceSurfaceContext } from "../../components/workspace/surface-context";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { Icon } from "../../components/design/Icon";
import type { PlannerOpenSignal } from "../app/planner-canvas";
import { readWorkspaceLocation, workspaceHref, type WorkspaceLocation } from "./workspace-location";
import { WorkspacePlanner } from "./workspace-planner";
import styles from "./workspace-shell.module.css";

function subscribeLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
  };
}
function subscribePhone(callback: () => void) {
  const media = window.matchMedia("(max-width: 960px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export interface WorkspaceConversationProps {
  openPlanner(signal: PlannerOpenSignal): void;
  workspaceOpen: boolean;
  conversationCovered: boolean;
  onPlanRevision(revision: number): void;
  draftRequest: { id: number; text: string } | null;
  acknowledgeDraft(): void;
}

const WorkspaceContext = createContext<WorkspaceConversationProps | null>(null);
export function useWorkspaceShell(): WorkspaceConversationProps {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("Conversation needs a workspace shell");
  return workspace;
}

/** Keep the conversation in the same React position for the lifetime of the adult session. */
export function WorkspaceShell({ children, userId, workspacePage }: { userId: string | null; children: ReactNode; workspacePage?: ReactNode }) {
  const router = useRouter();
  const [access, setAccess] = useState(Boolean(userId));
  const routeParams = useSearchParams();
  const nativeSearch = useSyncExternalStore(subscribeLocation, () => window.location.search, () => "");
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia("(max-width: 960px)").matches, () => false);
  const search = routeParams?.toString() ?? nativeSearch;
  const location = useMemo(() => access ? readWorkspaceLocation(search) : null, [access, search]);
  const [selection, setSelection] = useOptimistic(location, (_previous, next: WorkspaceLocation | null) => next);
  const [navigating, startNavigation] = useTransition();
  const navigate = useCallback((next: WorkspaceLocation | null) => {
    startNavigation(() => {
      setSelection(next);
      router.push(workspaceHref(window.location.href, next), { scroll: false });
    });
  }, [router, setSelection]);
  const title = selection?.kind === "binder" ? "Binder" : selection?.kind === "progress" ? "Progress" : "Planner";
  const open = selection !== null;
  const [planRevision, setPlanRevision] = useState(0);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [draftRequest, setDraftRequest] = useState<{ id: number; text: string } | null>(null);
  const acknowledgeDraft = useCallback(() => setDraftRequest(null), []);
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const previousTitle = useRef(title);
  const openPlanner = useCallback((signal: PlannerOpenSignal) => {
    if (!readWorkspaceLocation(window.location.search)) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setNavigationOpen(false);
    navigate({ kind: "planner", childId: signal.childId });
  }, [navigate]);
  const close = useCallback(() => navigate(null), [navigate]);
  const askHoma = useCallback((text?: string) => {
    if (text) setDraftRequest({ id: Date.now(), text });
    root.current?.querySelector<HTMLInputElement>("[data-workspace-composer] input:not([type=file])")?.focus();
  }, []);

  const surface = useMemo(() => ({ askHoma, openProgress: (childId: string) => navigate({ kind: "progress", childId }) }), [askHoma, navigate]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const allowed = Boolean(userId && session?.user.id === userId);
      setAccess(allowed);
      if (!allowed) setNavigationOpen(false);
      if (!allowed && readWorkspaceLocation(window.location.search)) navigate(null);
    });
    return () => subscription.unsubscribe();
  }, [userId, navigate]);

  useEffect(() => {
    if (!navigationOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !navigation.current?.contains(event.target)) setNavigationOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [navigationOpen]);

  useEffect(() => {
    if (open && (!wasOpen.current || previousTitle.current !== title || (phone && document.activeElement?.closest("[inert]")))) heading.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current) {
      const target = opener.current?.isConnected ? opener.current : launcher.current;
      target?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
    previousTitle.current = title;
  }, [open, phone, title]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      // A nested attachment menu or dialog gets the first chance to consume Escape.
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('dialog[open], [data-workspace-dialog], [data-workspace-add-menu], [data-workspace-navigation-open]')) return;
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
  }, [open, phone, title]);

  return <div className={styles.shell} data-workspace-open={open} ref={root}>
    <nav ref={navigation} className={styles.navigation} aria-label="Your workspace"
      data-workspace-navigation-open={navigationOpen || undefined}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setNavigationOpen(false); }}
      onKeyDown={event => {
        if (event.key === "Escape" && navigationOpen) {
          event.preventDefault(); event.stopPropagation(); setNavigationOpen(false); launcher.current?.focus();
        }
      }}>
      <button type="button" className={styles.navigationToggle} ref={launcher} disabled={!access}
        aria-label={navigationOpen ? "Close navigation" : "Open navigation"} aria-expanded={navigationOpen}
        aria-controls={navigationOpen ? "workspace-destinations" : undefined}
        onClick={() => setNavigationOpen(current => !current)}>
        <Icon name="menu" size={20} />
      </button>
      {navigationOpen && <div id="workspace-destinations" className={styles.navigationTray}>
        {(["planner", "binder", "progress"] as const).map(kind => <button key={kind} type="button" aria-current={selection?.kind === kind ? "page" : undefined} onClick={() => {
          setNavigationOpen(false);
          if (!open) opener.current = launcher.current;
          if (selection?.kind !== kind) navigate({ kind, childId: selection?.childId ?? null });
          else heading.current?.focus({ preventScroll: true });
        }}><Icon name={kind === "planner" ? "calendar" : kind === "binder" ? "book" : "progress"} size={20} /><span>{kind === "planner" ? "Planner" : kind === "binder" ? "Binder" : "Progress"}</span></button>)}
      </div>}
    </nav>
    <div className={styles.conversation}>
      <WorkspaceContext.Provider value={{ openPlanner, workspaceOpen: open, conversationCovered: open && phone, onPlanRevision: setPlanRevision, draftRequest, acknowledgeDraft }}>{children}</WorkspaceContext.Provider>
    </div>
    {selection && <aside id="family-workspace" className={styles.panel} aria-labelledby="workspace-title">
      <header className={styles.panelHeader}>
        <h2 id="workspace-title" tabIndex={-1} ref={heading}>{title}</h2>
        <button type="button" onClick={close} aria-label={`Close ${title.toLowerCase()}`}><Icon name="close" size={20} /></button>
      </header>
      <div className={styles.panelBody} data-workspace-scroll>
        {selection.kind === "planner" ? <WorkspacePlanner selection={selection} revision={planRevision} onAskHoma={askHoma} onNavigate={navigate} /> :
          <WorkspaceSurfaceContext.Provider value={surface}>
            {!navigating ? workspacePage : <p className={styles.state} role="status">Loading {title.toLowerCase()}…</p>}
          </WorkspaceSurfaceContext.Provider>}
      </div>
    </aside>}
  </div>;
}
