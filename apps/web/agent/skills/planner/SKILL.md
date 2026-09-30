---
description: Use to log completed learning, finish planned work, read or change plans, schedule existing lessons, or manage family calendar events and reusable co-op or program schedules. Creating new materials belongs to materials-studio; reading recorded hours to hours-records; ability reports to progress-capture.
metadata:
  homa-tools: read_learning_programs, save_learning_program, schedule_learning_program, find_attachments, log_hours, open_planner, record_planner_activity, complete_planner_activity, edit_plan, schedule_plan_activity, add_family_event, list_family_events, update_family_event, remove_family_event, find_materials, preview_month_plan, approve_month_plan, find_family_assets, get_family_asset
  homa-related-skills: curriculum-studio, curriculum-mapping, materials-studio, family-librarian
---

# The Planner

Planner holds real planned and completed learning and family events. Day,
Week, and Month show the same persisted facts at different horizons. Hours
holds the recorded school time. Logging work is useful even without a plan.

Choose the parent's job, read its reference, and perform the supported
change. Do not ask the parent to enter data that the tools can save for her.

## Choose the workflow

Read paths below with `read_file /workspace/skills/planner/<path>`.

| Request | Reference |
| --- | --- |
| Import, review or reuse a co-op/program schedule | `references/programs.md` |
| Log what happened or mark existing work finished | `references/capture-work.md`, `references/hours-identity.md` |
| Read or edit existing plans, or change the first-week handoff | `references/edit-existing.md` |
| Put activities on dates or manage family events | `references/dates-and-events.md` |
| Draft replacement activities inside a plan | `references/write-activities.md` |
| Reshuffle work around real life | `references/reshuffle.md` |
| Preview, approve or resume a whole family month | `references/month-plan.md` |

## Shared boundaries

- Before drafting or reshaping learning, use this child's map snapshot,
  interests, current progress and saved `[what works · Child]` memories. Current parent
  instructions and fixed calendar commitments win. Never apply a sibling's
  level or ask for a fact the context already provides.
- Read before editing, scheduling, or completing an existing item. Use exact
  ids, indices, text and revisions from open_planner or the last successful
  tool result. Never invent a plan, date, activity, or completion.
- A generated plan has four weeks. Pass childId to open_planner when the
  job needs the child's full plan; unfocused reads summarize other weeks.
  Unscheduled activities still exist, but appear on the calendar only after
  receiving a real date. Independent learning can exist outside these plans.
- For newly reported learning, read capture-work before acting. Save the
  dated activity even if duration is unknown. Supplied time updates Hours
  through that same write; do not log it again separately.
- Work happening is not mastery. Route a separate observable ability claim
  through progress-capture, without manufacturing one from completion.
- A whole-month change uses the preview and approval workflow. Every valid
  preview is saved as unfinished Binder work; resume the exact existing
  preview when the parent returns to it.
- A requested new lesson or printable is authored by materials-studio.
  Scheduling it is a separate requested effect, never an automatic addition.
- Read the returned receipt. Confirm the actual result briefly, without
  reciting a visible board or promising a panel on channels that lack one.
