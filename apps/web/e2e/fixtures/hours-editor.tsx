import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import { UnifiedPlannerView } from "../../app/app/planner/unified-planner-view";
import { scopedToViewContext } from "../../lib/hours-view";
import { fixture, firstChild, kids } from "./hours-editor-runtime";

function App() {
  useSyncExternalStore(fixture.subscribe, fixture.snapshot);
  const query = new URLSearchParams(location.search);
  const view = query.get("view") === "week" ? "week" : query.get("view") === "hours" ? "hours" : "day";
  const focusChildId = query.get("child") ?? firstChild;
  const hoursEntries = view === "hours" ? scopedToViewContext(fixture.entries(), { kind: "child", childId: focusChildId }) : fixture.entries();
  return <main style={{ padding: 20 }}><UnifiedPlannerView kids={kids} plans={[]} familyEvents={[]} scheduledActivities={[]}
    learningActivities={view === "hours" ? [] : fixture.activities()} hoursEntriesComplete={true} hoursEntries={hoursEntries} timeZone="America/New_York"
    now={new Date("2026-09-06T16:00:00Z")} today="2026-09-06" activeDate="2026-09-06" view={view}
    focusChildId={focusChildId} /></main>;
}
createRoot(document.getElementById("root")!).render(<App />);
