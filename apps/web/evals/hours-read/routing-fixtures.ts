export const HOURS_ROUTING_CASES = [
  { id: "category-create-positive", prompt: "Create a Literature category under Language arts for our school-hours record.", skill: "hours-records" },
  { id: "category-rename-positive", prompt: "Rename the Portuguese category in Hours to Brazilian Portuguese, preserving the time.", skill: "hours-records" },
  { id: "category-mastery-negative", prompt: "Show me Maya's latest progress report and explain her reading answers. Do not change her school-hours record.", skill: "progress-reading" },
  { id: "read-positive", prompt: "How much school time is recorded for Maya from September 1 through 6, 2026? Just Maya's record.", skill: "hours-records" },
  { id: "logging-negative", prompt: "Log 45 minutes of math that Maya did today.", skill: "planner" },
  { id: "state-packet-negative", prompt: "Please prepare my Ohio state attendance packet for filing.", skill: "state-records" },
  { id: "calendar-negative", prompt: "Move Maya's existing Tuesday reading lesson to Thursday.", skill: "planner" },
  { id: "worksheet-negative", prompt: "Make Maya a printable alphabet tracing worksheet.", skill: "materials-studio" },
] as const;
