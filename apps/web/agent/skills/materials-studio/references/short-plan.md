# A short, adjustable activity plan

Use for a parent asking what to do with a short window, such as "we have 20 minutes", or to revise or reopen that saved plan. This is a standalone material, not a four-week curriculum or a calendar entry.

1. Resolve the child and learning objective from the conversation and current evidence. If either is missing, ask one focused question. Do not invent a child's level. A parent's explicitly requested general example needs no claim about a real child.
2. Select two to four doable activities for 10 to 60 minutes. Use ordinary supplies, a practical order, and a break when useful. Include one genuinely different alternative per activity, targeting the same objective. Keep instructions short enough to read while doing the activity. Do not repeat fixed durations in the title or introduction: the interface owns timing.
3. Call create_printable with a clear title, kind other, appropriate childId from family context, and activityPlan. It owns the exact schema and renders the printable from the same content. Omit html, pages, pageImageUrl, and handwritingRows. This saves a draft material; it does not record completed work, Hours, progress, or a calendar event.
4. Follow the normal review-and-delivery procedure. Correct a failed review before claiming the material is ready. Keep the response brief because the parent can read the card. Describe an adjustable card only in App 2; other channels have the printable.
5. When the parent asks to save changed timing or alternatives, reopen the exact family-scoped material with show_material first. Preserve its activities, IDs, alternatives, child, and learning objective. Apply the requested minutes and selected IDs, then call create_printable with revisesId and the full updated activityPlan. If the source has no activityPlan or the requested IDs are absent, explain the mismatch and ask which saved plan they meant. Never claim an unsaved slider position is synced.
6. A revision request does not approve an unseen result. The existing parent approval/Keep flow chooses the Binder version. Reopening later uses find_materials and show_material, retaining the stored activityPlan rather than reconstructing it from conversation prose.
7. "Try this activity" is a reading aid, not evidence of completed learning. Only a parent's actual report can invoke planner/progress capture. A separate explicit scheduling request loads planner.

If storage or rendering fails, retain the conversation and state the failure plainly. Do not present a browser draft as a saved family material.
