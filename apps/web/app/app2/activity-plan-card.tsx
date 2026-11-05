"use client";

import { useState, type ReactNode } from "react";
import { activityPlanRevisionRequest, selectedPlanActivities, type ActivityPlan } from "../../lib/materials/activity-plan";

export function ActivityPlanCard({ id, title, plan, askHoma, context }: { id: string; title: string; plan: ActivityPlan; askHoma: (text: string) => void; context?: ReactNode }) {
  const [draft, setDraft] = useState(plan);
  const [active, setActive] = useState<string | null>(null);
  const changed = draft.minutes !== plan.minutes || JSON.stringify([...draft.swapped].sort()) !== JSON.stringify([...plan.swapped].sort());
  const activities = selectedPlanActivities(draft);
  const current = activities.find(item => item.id === active);
  return <section className="app2-activity-plan" aria-label={`${title} activity plan`}>
    <h3>{title}</h3>{context}<p>{plan.introduction}</p>
    <label className="app2-activity-time">Time available <strong>{draft.minutes} minutes</strong><input aria-label={`Time for ${title}`} type="range" min="10" max="60" step="1" value={draft.minutes} onChange={event => setDraft(value => ({ ...value, minutes: Number(event.target.value) }))} /></label>
    <ol className="app2-activity-activities">{activities.map(item => <li key={item.id}><div className="app2-activity-heading"><strong>{item.title}</strong><span>{item.minutes} min</span></div><p>{item.instructions}</p>{item.materials.length > 0 && <p className="app2-activity-supplies">Gather: {item.materials.join(", ")}</p>}<div className="app2-activity-actions"><button type="button" aria-pressed={draft.swapped.includes(item.id)} onClick={() => setDraft(value => ({ ...value, swapped: value.swapped.includes(item.id) ? value.swapped.filter(id => id !== item.id) : [...value.swapped, item.id] }))}>{draft.swapped.includes(item.id) ? "Use original" : "Try another idea"}</button><button type="button" aria-expanded={active === item.id} onClick={() => setActive(active === item.id ? null : item.id)}>Try this activity</button></div>{active === item.id && current && <div className="app2-activity-tryIt"><p><strong>Ready to try it?</strong></p><button type="button" onClick={() => askHoma(`Help us try "${current.title}" from saved material ${id}. ${current.instructions} Give one small first step. This is a request for help, not a report of completed learning.`)}>Help us get started</button><button type="button" onClick={() => setActive(null)}>Back to the plan</button></div>}</li>)}</ol>
    <div className="app2-activity-actions">{changed && <><button type="button" onClick={() => askHoma(activityPlanRevisionRequest(id, draft))}>Ask Homa to save changes</button><button type="button" onClick={() => { setDraft(plan); setActive(null); }}>Reset changes</button></>}<a href={`/api/materials/${encodeURIComponent(id)}/pdf`} target="_blank" rel="noreferrer">Print saved version</a><button type="button" onClick={() => askHoma(`Reopen saved activity plan ${id} and help me make it simpler using my current choices: ${draft.minutes} minutes; selected alternatives: ${draft.swapped.join(", ") || "none"}. Preserve the learning objective and ask what feels difficult if that is unclear.`)}>Make it simpler</button></div>
    <p className="app2-activity-status" role="status">{changed ? "These changes are not saved yet. Send the request to ask Homa to save a new version." : "This version is stored with your materials. Trying an activity does not log learning or time."}</p>
  </section>;
}
