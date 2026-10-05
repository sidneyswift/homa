"use client";

import { useCallback, useEffect, useState } from "react";

import { parsePlanBoardResponse, type PlanBoardPayload } from "../../lib/plan-board";
import { PlannerView } from "../app/planner/planner-view";
import styles from "./workspace-shell.module.css";

type BoardState = { phase: "loading" } | { phase: "ready"; board: PlanBoardPayload; refreshing: boolean } |
  { phase: "error"; message: string; signIn: boolean };

/** Reuses the family-scoped board and atomic check operations owned by app1. */
export function WorkspacePlanner({ childId, revision, onChildChange, onAskHoma }: {
  onAskHoma(): void; childId: string | null; revision: number; onChildChange(childId: string | null): void;
}) {
  const [state, setState] = useState<BoardState>({ phase: "loading" });
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    async function load() {
      setState(current => current.phase === "ready" ? { ...current, refreshing: true } : { phase: "loading" });
      try {
        const response = await fetch("/api/map/plan/board", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (disposed) return;
        if (response.status === 401 || response.status === 403) {
          setState({ phase: "error", message: "Your planner is unavailable. Sign in again to check your access.", signIn: true });
          return;
        }
        if (!response.ok) throw new Error("Board unavailable");
        const board = parsePlanBoardResponse(await response.json());
        if (!board) throw new Error("Invalid board");
        if (!disposed) setState({ phase: "ready", board, refreshing: false });
      } catch {
        if (!disposed) setState({ phase: "error", message: "Your week couldn’t load. Your plans haven’t changed.", signIn: false });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [refresh, revision]);

  useEffect(() => {
    const resume = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => { window.removeEventListener("focus", resume); window.removeEventListener("online", resume); };
  }, [reload]);

  if (state.phase === "loading") return <p className={styles.state} role="status">Loading your week…</p>;
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
      <label><span className="sr-only">Whose week</span>
        <select aria-label="Whose week" value={childId ?? ""} onChange={event => onChildChange(event.target.value || null)}>
          <option value="">Everyone</option>
          {board.kids.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={reload} disabled={state.refreshing}>{state.refreshing ? "Refreshing…" : "Refresh"}</button>
    </div>
    <div aria-busy={state.refreshing} inert={state.refreshing}>
    {!board.plans.some(plan => !childId || plan.childId === childId) ? <div className={styles.empty}>
      <h3>No learning activities planned yet</h3>
      <p>Tell Homa what you’d like to work on this week.</p>
      <button type="button" onClick={onAskHoma}>Plan with Homa</button>
    </div> : <PlannerView kids={board.kids.map(child => ({ id: child.id, name: child.name, birth_month: child.birthMonth, avatar_url: child.avatarUrl }))}
      reports={new Map(board.kids.map(child => [child.id, { token: child.reportToken }]))} plans={board.plans}
      timeZone={board.timeZone} now={new Date()} focusChildId={childId} surface="workspace" onPlannerRefresh={reload} />}
    </div>
    <p className={styles.scopeNote}>Learning activities for this week. <a href="/app/planner" target="_blank" rel="noreferrer">Calendar and events open in a new tab.</a></p>
  </div>;
}
