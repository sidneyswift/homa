export const HOURS_ROUTING_CASES = [
  { id: "read-positive", prompt: "How much school time is recorded for Maya from September 1 through 6, 2026? Just Maya's record.", skill: "hours-records" },
  { id: "logging-negative", prompt: "Log 45 minutes of math that Maya did today.", skill: "planner" },
  { id: "state-packet-negative", prompt: "Please prepare my Ohio state attendance packet for filing.", skill: "state-records" },
  { id: "calendar-negative", prompt: "Move Maya's existing Tuesday reading lesson to Thursday.", skill: "planner" },
  { id: "worksheet-negative", prompt: "Make Maya a printable alphabet tracing worksheet.", skill: "materials-studio" },
] as const;
