/** URL selection is a view preference, never an authorization boundary. */
export type WorkspaceLocation = { kind: "planner"; childId: string | null };

export function readWorkspaceLocation(search: string): WorkspaceLocation | null {
  const params = new URLSearchParams(search);
  if (params.get("workspace") !== "planner") return null;
  return { kind: "planner", childId: params.get("child") || null };
}

export function workspaceHref(href: string, selection: WorkspaceLocation | null): string {
  const url = new URL(href);
  url.searchParams.delete("workspace");
  url.searchParams.delete("child");
  if (selection) {
    url.searchParams.set("workspace", selection.kind);
    if (selection.childId) url.searchParams.set("child", selection.childId);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
