import React, { useState } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { WorkspaceShell, useWorkspaceShell } from "../../app/app2/workspace-shell";
import { createRoot } from "react-dom/client";

import { ConversationControlsPreview } from "../../app/app2/conversation-controls-preview";
import styles from "../../app/app2/voice-workspace-preview.module.css";

const familyId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch: async () => {} };

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
  return <AppRouterContext.Provider value={router}>
    <button style={{ position: "fixed", left: 0, bottom: 0, zIndex: 100 }} onClick={() => {
      window.dispatchEvent(new CustomEvent("fixture-auth", { detail: null }));
    }}>Fixture sign out</button>
    <WorkspaceShell userId={userId}><FixtureConversation /></WorkspaceShell>
  </AppRouterContext.Provider>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
