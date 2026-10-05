"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorkspacePlannerData } from "../../lib/workspace-planner-data";
import type { PlannerViewMode } from "../../lib/unified-planner";
import { workspaceHref, type WorkspaceLocation } from "./workspace-location";
import { PlannerView } from "../app/planner/planner-view";
import { UnifiedPlannerView, type PlannerWorkspaceAdapter } from "../app/planner/unified-planner-view";
import styles from "./workspace-shell.module.css";

type BoardState = { phase: "loading" } | { phase: "ready"; board: WorkspacePlannerData; requestKey: string; refreshing: boolean } |
  { phase: "error"; message: string; signIn: boolean };

/** Reuses the family-scoped board and atomic check operations owned by app1. */
export function WorkspacePlanner({ selection, revision, onNavigate, onAskHoma }: {
  onAskHoma(text?: string): void; selection: WorkspaceLocation; revision: number; onNavigate(selection: WorkspaceLocation): void;
}) {
  const { childId, view = "day", date } = selection;
  const requestKey = `${view}:${date ?? "today"}`;
  const onChildChange = (childId: string | null) => onNavigate({ ...selection, childId });
  const [state, setState] = useState<BoardState>({ phase: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [plansOpen, setPlansOpen] = useState(false);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  const adapter = useMemo<PlannerWorkspaceAdapter>(() => ({
    href: (view, date, childId) => workspaceHref(window.location.href, { kind: "planner", view: view === "hours" ? "day" : view, date, childId }),
    navigate: (view: PlannerViewMode, date: string, childId: string | null) => onNavigate({ kind: "planner", view: view === "hours" ? "day" : view, date, childId }),
    refresh: reload, askHoma: onAskHoma,
  }), [onNavigate, reload, onAskHoma]);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    async function load() {
      setState(current => current.phase === "ready" ? { ...current, refreshing: true } : { phase: "loading" });
      try {
        const response = await fetch(`/api/workspace/planner?view=${view}${date ? `&date=${encodeURIComponent(date)}` : ""}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (disposed) return;
        if (response.status === 401 || response.status === 403) {
          setState({ phase: "error", message: "Your planner is unavailable. Sign in again to check your access.", signIn: true });
          return;
        }
        if (!response.ok) throw new Error("Board unavailable");
        const result = await response.json() as { ok: boolean; board: WorkspacePlannerData };
        if (!result.ok || !result.board?.kids || !result.board?.today) throw new Error("Invalid board");
        if (!disposed) setState({ phase: "ready", board: result.board, requestKey, refreshing: false });
      } catch {
        if (!disposed) setState({ phase: "error", message: "Your week couldn’t load. Your plans haven’t changed.", signIn: false });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [refresh, revision, requestKey, view, date]);

  useEffect(() => {
    const resume = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => { window.removeEventListener("focus", resume); window.removeEventListener("online", resume); };
  }, [reload]);

  if (state.phase === "loading" || (state.phase === "ready" && state.requestKey !== requestKey)) return <p className={styles.state} role="status">Loading your calendar…</p>;
  if (state.phase === "error") return <div className={styles.state} role="alert">
    <p>{state.message}</p>
    <button type="button" onClick={reload}>Try again</button>
    {state.signIn && <a href="/app" target="_blank" rel="noreferrer">Sign in in a new tab</a>}
  </div>;
  const { board } = state;
  if (childId && !board.kids.some(child => child.id === childId)) return <div className={styles.state} role="status">
    <p>This child’s planner is no longer available to this account.</p>
    <button type="button" onClick={() => onChildChange(null)}>Show your family’s week</button>
  </div>;
  return <div className={styles.planner}>
    <div className={styles.toolbar}>
      <label><span className="sr-only">Whose plan</span>
        <select aria-label="Whose plan" value={childId ?? ""} onChange={event => onChildChange(event.target.value || null)}>
          <option value="">Everyone</option>
          {board.kids.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={reload} disabled={state.refreshing}>{state.refreshing ? "Refreshing…" : "Refresh"}</button>
    </div>
    <div aria-busy={state.refreshing} inert={state.refreshing}>
      <UnifiedPlannerView key={`${requestKey}:${childId ?? "family"}`} {...board} now={new Date(board.now)} focusChildId={childId} workspace={adapter} />
    </div>
    {board.plans.length > 0 && <details className={styles.planCollection} open={plansOpen} onToggle={event => setPlansOpen(event.currentTarget.open)}>
      <summary>Learning plans</summary>
      {plansOpen && <PlannerView kids={board.kids} reports={new Map(board.kids.map(child => [child.id, { token: child.reportToken }]))}
        plans={board.plans} timeZone={board.timeZone} now={new Date(board.now)} focusChildId={childId} surface="workspace" onPlannerRefresh={reload} />}
    </details>}
    <p className={styles.scopeNote}><a href="/app/planner?view=hours" target="_blank" rel="noreferrer">School hours</a> · <a href="/app/planner/programs" target="_blank" rel="noreferrer">Programs and co-op</a> open in a new tab.</p>
  </div>;
}
