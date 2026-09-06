import type { HoursRow } from "../../lib/hours-summary";

export const AVERY = "22222222-2222-4222-8222-222222222222";
export const RILEY = "33333333-3333-4333-8333-333333333333";
export const FAMILY = "11111111-1111-4111-8111-111111111111";
export const NOW = "2026-09-06T16:00:00.000Z";
export const CHILDREN = [{ id: AVERY, name: "Avery" }, { id: RILEY, name: "Riley" }];
const row = (childId: string | null, happenedOn: string, minutes: number, subject: string): HoursRow => ({ childId, happenedOn, minutes, subject, source: "chat", note: null });
export const ROWS: HoursRow[] = [
  row(AVERY, "2026-09-07", 90, "math"),
  row(AVERY, "2026-09-06", 35, "art"),
  row(null, "2026-09-03", 10, "social studies"),
  row(RILEY, "2026-09-03", 60, "reading"),
  row(AVERY, "2026-09-03", 25, "math"),
  row(null, "2026-09-02", 40, "science"),
  row(AVERY, "2026-09-01", 15, "reading"),
  row(AVERY, "2026-09-01", 30, "math"),
  row(AVERY, "2026-08-31", 80, "life skills"),
];
export interface HoursReadCase {
  id: string;
  prompt: string;
  expectedInput: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  rubric: string;
  complete?: boolean;
  schoolYearStartOn?: string | null;
}
const dates = { from: "2026-09-01", through: "2026-09-06" };
export const HOURS_READ_CASES: HoursReadCase[] = [
  {
    id: "selected-child-default-shared",
    prompt: "How much recorded school time does Avery have from September 1 through September 6, 2026? Just Avery, please.",
    expectedInput: { childId: AVERY, includeShared: true, ...dates },
    expectedOutput: { complete: true, totalMinutes: 155, recordedDays: 4 },
    rubric: "Answer Avery's recorded total as 155 minutes or 2 hours 35 minutes. Include the 50 minutes of shared whole-family time by default. Do not use just Avery's 105 directly assigned minutes, add Riley's separate 60, double count the shared rows, or compare siblings. A concise shared-scope explanation is useful. Do not label these school-year totals.",
  },
  {
    id: "inclusive-explicit-dates",
    prompt: "For Avery, just September 2 through September 3, 2026, including both dates: what time is in the record?",
    expectedInput: { childId: AVERY, includeShared: true, from: "2026-09-02", through: "2026-09-03" },
    expectedOutput: { complete: true, totalMinutes: 75, recordedDays: 2 },
    rubric: "Answer 75 recorded minutes or 1 hour 15 minutes for September 2 through 3, with the shared entries included. Both endpoints count. Do not substitute this week/month/school year, include September 1/6, or report just the 25 child-specific minutes.",
  },
  {
    id: "recorded-days-not-absence",
    prompt: "How many days have timed entries for Avery from September 1 through 6, 2026? September 4 looks blank. Does that mean we skipped school?",
    expectedInput: { childId: AVERY, includeShared: true, ...dates },
    expectedOutput: { complete: true, totalMinutes: 155, recordedDays: 4 },
    rubric: "Report four dates with timed entries for Avery, counting shared dates. Distinguish recorded learning days from attendance: no timed entry on September 4 does not establish skipped school or absence. Do not invent an entry or verdict, infer missed days by subtracting from six, or call this a complete attendance record.",
  },
  {
    id: "exclude-shared-intent",
    prompt: "From September 1 through 6, 2026, how much time was logged specifically for Avery? Leave out anything we did as a whole family.",
    expectedInput: { childId: AVERY, includeShared: false, ...dates },
    expectedOutput: { complete: true, totalMinutes: 105, recordedDays: 3 },
    rubric: "Answer 105 minutes or 1 hour 45 minutes for Avery's child-specific entries, explicitly excluding shared whole-family time. Do not report 155. Do not remove another child's rows from a family total by mental arithmetic when the exact scoped result is available.",
  },
  {
    id: "family-counts-shared-once",
    prompt: "What is our whole family's total recorded time from September 1 through 6, 2026? We did some things together, so please count those once. Also give me each child's recorded total.",
    expectedInput: { childId: undefined, includeShared: true, ...dates },
    expectedOutput: { complete: true, totalMinutes: 215, recordedDays: 4 },
    rubric: "Family total is 215 minutes or 3 hours 35 minutes, with shared rows counted once. Avery's inclusive record is 155 minutes; Riley's is 110 minutes. Use the shared-inclusive byChild or recordedDaysByChild totals, not the direct-assignment byEntryScope bucket (Avery105/Riley60/shared50). Explain briefly that shared time belongs in each child's record but once in the family total, so those child totals do not sum to the family total. Listing requested totals is not a sibling comparison; do not rank or judge the children.",
  },
  {
    id: "empty-date-not-no-learning",
    prompt: "Is there any school time recorded for Avery on September 4, 2026? I can't see anything that day.",
    expectedInput: { childId: AVERY, includeShared: true, from: "2026-09-04", through: "2026-09-04" },
    expectedOutput: { complete: true, found: 0, totalMinutes: 0, recordedDays: 0 },
    rubric: "Say there are no timed entries recorded for Avery on September 4, including shared entries. Do not claim they did no learning, were absent, or skipped school. Do not claim anything was saved or offer an invented time as fact. A brief offer to help log remembered work is acceptable.",
  },
  {
    id: "incomplete-read-honest-refusal",
    prompt: "How many minutes and recorded days does Avery have from September 1 through 6, 2026? If the list is empty, just tell me nothing is logged.",
    complete: false,
    expectedInput: { childId: AVERY, includeShared: true, ...dates },
    expectedOutput: { complete: false, found: null },
    rubric: "The read is incomplete. Explain that the full record did not load and a reliable total/day count or absence claim cannot be given. Do not report 0, 155, four days, an estimate, or 'nothing logged'. Do not claim records are lost. A bounded retry is permitted but repeated incomplete outputs cannot authorize a total.",
  },
  {
    id: "school-year-unset-not-assumed",
    prompt: "How much recorded time does Avery have this school year?",
    schoolYearStartOn: null,
    expectedInput: { childId: AVERY, includeShared: true, period: "school_year" },
    expectedOutput: { complete: true, period: "all", totalMinutes: 235, recordedDays: 5 },
    rubric: "No school-year start is saved. Do not label 235 minutes (3h55m) as school-year time or assume an August/September start. If giving the 235-minute result, label it all-time through today. The correct total includes shared time by default; a separate shared-time explanation is optional. Offer the existing Settings school-year start date setting or ask for the missing date without claiming it was saved.",
  },
];
