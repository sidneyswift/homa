/** URL selection is a view preference, never an authorization boundary. */
export type WorkspaceLocation = { kind: "planner" | "binder" | "progress"; childId: string | null; view?: "day" | "week" | "month"; date?: string };

export function readWorkspaceLocation(search: string): WorkspaceLocation | null {
  const params = new URLSearchParams(search);
  const kind = params.get("workspace");
  if (kind !== "planner" && kind !== "binder" && kind !== "progress") return null;
  const view = params.get("workspaceView");
  return { kind, childId: params.get("child") || null,
    ...(view === "day" || view === "week" || view === "month" ? { view } : {}),
    ...(params.get("workspaceDate") ? { date: params.get("workspaceDate")! } : {}) };
}

export function workspaceHref(href: string, selection: WorkspaceLocation | null): string {
  const url = new URL(href);
  url.searchParams.delete("workspace");
  url.searchParams.delete("child");
  url.searchParams.delete("workspaceView");
  url.searchParams.delete("workspaceDate");
  if (selection) {
    url.searchParams.set("workspace", selection.kind);
    if (selection.view) url.searchParams.set("workspaceView", selection.view);
    if (selection.date) url.searchParams.set("workspaceDate", selection.date);
    if (selection.childId) url.searchParams.set("child", selection.childId);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function workspaceSelectionKey(selection: WorkspaceLocation | null): string {
  return selection ? `${selection.kind}:${selection.childId ?? ""}:${selection.view ?? ""}:${selection.date ?? ""}` : "";
}
