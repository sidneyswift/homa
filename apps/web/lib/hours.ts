import { formatMinutes, type HoursSubject } from "./hours-model";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * The signed-in family's school-time record for the current week, read
 * under their OWN RLS (the members-read policy is the wall). Feeds the
 * /home hours card; the full per-state compliance report is M3-06's job.
 */

export interface WeekHours {
  totalMinutes: number;
  totalLabel: string;
  bySubject: { subject: HoursSubject; minutes: number; label: string }[];
}

function startOfWeekIso(now = new Date()): string {
  // Weeks start Monday, matching the planner's framing.
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

export async function getWeekHours(familyId: string): Promise<WeekHours> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hours_log")
    .select("subject, minutes")
    .eq("family_id", familyId)
    .gte("happened_on", startOfWeekIso());
  if (error) {
    console.error(`hours_log read failed: ${error.message}`);
    return { totalMinutes: 0, totalLabel: "0m", bySubject: [] };
  }

  const totals = new Map<HoursSubject, number>();
  let totalMinutes = 0;
  for (const row of data ?? []) {
    const subject = row.subject as HoursSubject;
    totals.set(subject, (totals.get(subject) ?? 0) + row.minutes);
    totalMinutes += row.minutes;
  }
  const bySubject = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([subject, minutes]) => ({ subject, minutes, label: formatMinutes(minutes) }));

  return { totalMinutes, totalLabel: formatMinutes(totalMinutes), bySubject };
}
