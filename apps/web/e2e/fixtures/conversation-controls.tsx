import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import { ConversationControlsPreview } from "../../app/app2/conversation-controls-preview";
import styles from "../../app/app2/voice-workspace-preview.module.css";

const familyId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

function Fixture() {
  const [engaged, setEngaged] = useState(false);
  return <>
    <button style={{ position: "fixed", right: 0, top: 0, zIndex: 100 }} onClick={() => {
      window.dispatchEvent(new CustomEvent("fixture-auth", { detail: null }));
    }}>Fixture sign out</button>
    <div className={styles.preview} data-engaged={engaged}>
      <main className={styles.screen} aria-hidden="true"><div style={{ height: 96 }} /></main>
      <ConversationControlsPreview family={{ id: familyId, timeZone: "America/New_York", children: [] }}
        userId={userId} history={null} durableConversation workspaceEngaged={engaged} onEngagedChange={setEngaged} />
    </div>
  </>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
