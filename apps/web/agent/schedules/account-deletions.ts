import { defineSchedule } from "eve/schedules";

/** Account deletion is paused under #878 until the complete release gate is
 * proven. Keep the schedule registered but prevent an old queued job from
 * advancing while the API and legacy database entry points are fenced. */
export default defineSchedule({
  cron: "*/5 * * * *",
  run() {},
});
