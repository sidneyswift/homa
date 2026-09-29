import { createRoot } from "react-dom/client";
import { ProgramsView } from "../../app/app/planner/programs/programs-view";
createRoot(document.getElementById("root")!).render(
  <main style={{ padding: 20 }}>
    <ProgramsView
      childrenList={[
        { id: "a0000000-0000-4000-8000-000000000001", name: "Alex" },
        { id: "a0000000-0000-4000-8000-000000000002", name: "Sam" },
      ]}
    />
  </main>,
);
