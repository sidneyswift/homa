import { createRoot } from "react-dom/client";

import { HoursRecordExport } from "../../app/app/hours/hours-record-export";

const kids = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "Avery" },
  { id: "a0000000-0000-4000-8000-000000000002", name: "Alexandria Clementine Montgomery-Swift" },
];
const query = new URLSearchParams(location.search);
if (query.get("duplicate") === "true") kids.forEach((kid) => { kid.name = "Same"; });
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-2xl p-4">
    <h1 className="mb-4 font-display text-2xl">Hours</h1>
    <HoursRecordExport kids={kids} focusChildId={query.get("child")} today="2026-09-06" schoolYearStartOn="2026-09-01" />
  </main>,
);
