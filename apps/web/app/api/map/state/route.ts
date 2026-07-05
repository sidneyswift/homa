import { requireLead } from "../../../../lib/map/session";
import { getLeadState } from "../../../../lib/map/store";

/**
 * GET /api/map/state
 * Resume: the full saved snapshot for the caller's lead (children, answers,
 * report tokens), so the client can restore the flow exactly where it
 * stopped, on any device holding the cookie. Question plans are computed
 * client-side from the same bank (pure data, same package). Returns
 * ok:false (not 401) for cookieless visitors: a fresh start is a normal
 * state, not an error.
 */
export async function GET(): Promise<Response> {
  const lead = await requireLead();
  if (!lead) return Response.json({ ok: false });

  try {
    const state = await getLeadState(lead);
    return Response.json({
      ok: true,
      firstName: state.lead.first_name,
      // The caller's own email (cookie-authenticated), for the
      // "send this link to my other device" button.
      email: state.lead.email,
      children: state.children.map((child) => ({
        id: child.id,
        name: child.name,
        birthMonth: child.birth_month,
        interests: child.interests,
        helpWith: child.help_with,
        ageMonths: child.age_months,
        inRange: child.in_range,
        answered: child.answered,
        reportToken: child.report_token,
        answers: state.answers[child.id] ?? [],
      })),
    });
  } catch (error) {
    console.error("map/state failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
