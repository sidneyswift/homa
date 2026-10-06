import React, { useState, useSyncExternalStore } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { WorkspacePageFrame } from "../../app/app2/workspace-page-frame";
import { BinderView } from "../../app/app/binder/binder-view";
import { ProgressMap } from "../../components/progress/progress-map";
import { PROGRESS_FIXTURE_VIEW } from "../../components/progress/progress-view.fixture";
import { AskHomaAboutChild } from "../../components/progress/ask-homa-about-child";
import { readWorkspaceLocation } from "../../app/app2/workspace-location";
import { WorkspaceShell, useWorkspaceShell } from "../../app/app2/workspace-shell";
import { createRoot } from "react-dom/client";

import { ConversationControlsPreview } from "../../app/app2/conversation-controls-preview";
import styles from "../../app/app2/voice-workspace-preview.module.css";

const familyId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push(href: string) { window.history.pushState(null, "", href); window.dispatchEvent(new Event("popstate")); }, replace(href: string) { window.history.replaceState(null, "", href); window.dispatchEvent(new Event("popstate")); }, prefetch: async () => {} };

function FixtureConversation() {
  const [engaged, setEngaged] = useState(false);
  const { openPlanner, workspaceOpen, conversationCovered, onPlanRevision } = useWorkspaceShell();
  return <div className={styles.preview} data-engaged={engaged || workspaceOpen}>
    <main className={styles.screen} aria-hidden="true"><div style={{ height: 96 }} /></main>
    <ConversationControlsPreview family={{ id: familyId, timeZone: "America/New_York", children: [] }}
      userId={userId} history={null} durableConversation workspaceEngaged={engaged || workspaceOpen} onEngagedChange={setEngaged}
      onOpenPlanner={openPlanner} conversationCovered={conversationCovered} onPlanRevision={onPlanRevision} />
  </div>;
}

function Fixture() {
  const search = useSyncExternalStore(callback => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); }, () => window.location.search);
  const selection = readWorkspaceLocation(search);
  const kids = [{ id: "11111111-1111-4111-8111-111111111111", name: "Maya" }, { id: "22222222-2222-4222-8222-222222222222", name: "Leo" }];
  const childId = selection?.childId ?? kids[0].id;
  const page = selection && selection.kind !== "planner" ? <WorkspacePageFrame kind={selection.kind} childId={selection.kind === "binder" ? selection.childId : childId} kids={kids}>
    {selection.kind === "binder" ? <BinderView scopeChildName={null} timeZone="America/New_York" now={new Date("2026-10-05")} materials={[{ id: "11111111-1111-4111-8111-111111111119", title: "Garden counting", kind: "worksheet", subject: "math", theme: null, skill: null, childId: kids[0].id, childName: "Maya", previewUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='260'%3E%3Crect width='200' height='260' fill='white'/%3E%3Ctext x='20' y='40'%3EGarden counting%3C/text%3E%3C/svg%3E", pdfUrl: "/fixture.pdf", createdAt: "2026-10-05T12:00:00Z", pageCount: 1, pagePreviewUrls: null, sources: [] }]} /> : <><h1>{kids.find(kid => kid.id === childId)?.name}’s progress</h1><ProgressMap childId={childId} subjects={PROGRESS_FIXTURE_VIEW.subjects} conflicts={[]} tiles={PROGRESS_FIXTURE_VIEW.subjects.map(subject => ({ subjectId: subject.subjectId, displayName: subject.displayName, badge: null, freshness: null, needsConfirm: false, deeperCheck: false }))} timeZone="America/New_York" deeperChecks />
    <AskHomaAboutChild childId={childId} childName={kids.find(kid => kid.id === childId)!.name} /></>}
  </WorkspacePageFrame> : null;
  return <AppRouterContext.Provider value={router}>
    <button style={{ position: "fixed", left: 0, bottom: 0, zIndex: 100 }} onClick={() => {
      window.dispatchEvent(new CustomEvent("fixture-auth", { detail: null }));
    }}>Fixture sign out</button>
    <WorkspaceShell userId={userId} workspacePage={page}><FixtureConversation /></WorkspaceShell>
  </AppRouterContext.Provider>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
