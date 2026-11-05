"use client";

import { Icon } from "../../components/design/Icon";
import { useRouter } from "next/navigation";
import { useMemo, useTransition, type ReactNode } from "react";
import { WorkspaceSurfaceContext, useWorkspaceSurface } from "../../components/workspace/surface-context";
import { workspaceHref, type WorkspaceLocation } from "./workspace-location";
import styles from "./workspace-shell.module.css";

export function WorkspacePageError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className={styles.state} role="alert"><p>This page couldn’t load. Your saved work hasn’t changed.</p><button disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Trying again…" : "Try again"}</button></div>;
}

export function WorkspacePageFrame({ kind, childId, kids, children }: {
  kind: WorkspaceLocation["kind"]; childId: string | null;
  kids: { id: string; name: string }[]; children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const workspace = useWorkspaceSurface();
  const surface = useMemo(() => workspace ? { ...workspace, childName: (id: string) => kids.find(child => child.id === id)?.name } : null, [workspace, kids]);
  return <div className={`${styles.planner} ${styles.page}`} data-workspace-page={kind} aria-busy={pending}>
    <div className={styles.toolbar}>
      <label><span className="sr-only">{kind === "binder" ? "Whose materials" : "Whose progress"}</span>
        <select value={childId ?? ""} disabled={pending} onChange={event => {
          const next = event.target.value || null;
          startTransition(() => router.push(workspaceHref(window.location.href, { kind, childId: next }), { scroll: false }));
        }}>
          {kind === "binder" && <option value="">Whole family</option>}
          {kids.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </label>
      <button disabled={pending} aria-label={pending ? "Refreshing…" : "Refresh"} onClick={() => startTransition(() => router.refresh())}>{kind === "binder" ? <Icon name="refresh" size={20} /> : pending ? "Refreshing…" : "Refresh"}</button>
    </div>
    <WorkspaceSurfaceContext.Provider value={surface}><div key={childId ?? "family"} data-workspace-page-content>{children}</div></WorkspaceSurfaceContext.Provider>
  </div>;
}
