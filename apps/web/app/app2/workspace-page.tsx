import { getAppData } from "../../lib/app-data";
import { BinderContent } from "../app/binder/binder-content";
import { ChildProgressContent } from "../app/[childId]/progress/progress-content";
import type { WorkspaceLocation } from "./workspace-location";
import { WorkspacePageFrame, WorkspacePageError } from "./workspace-page-frame";

/** Reuse authenticated server projections without shipping scoring data to the browser. */
export async function WorkspacePage({ selection }: { selection: WorkspaceLocation }) {
  let data;
  try { data = await getAppData(); } catch { return <WorkspacePageError />; }
  if (!data) return <p role="alert">Sign in again to open your workspace.</p>;
  const childId = selection.childId ?? (selection.kind === "progress" ? data.children[0]?.id ?? null : null);
  const kids = data.children.map(child => ({ id: child.id, name: child.name }));
  if (childId && !kids.some(child => child.id === childId)) return <p role="alert">That child is not available in your family.</p>;
  if (selection.kind === "progress" && !childId) return <p>Add a child to see their progress here.</p>;
  let content;
  try {
    content = selection.kind === "binder"
      ? await BinderContent({ searchParams: Promise.resolve({}), workspaceChildId: childId })
      : await ChildProgressContent({ workspace: true, params: Promise.resolve({ childId: childId! }), searchParams: Promise.resolve({}) });
  } catch {
    return <WorkspacePageError />;
  }
  return <WorkspacePageFrame kind={selection.kind} childId={childId} kids={kids}>{content}</WorkspacePageFrame>;
}
