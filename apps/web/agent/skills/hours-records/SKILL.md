---
name: hours-records
description: Use first, before reading or answering, when a parent asks to read or total recorded school time, find logged hours, understand a child's Hours record, count dates with timed entries, or create, reuse, rename, filter or subtotal Hours categories. Not for recording newly reported work or changing Planner activities; planner owns those. Not for state requirements, attendance packets, filing forms, or legal attendance judgments; state-records owns that paperwork.
metadata:
  homa-tools: find_hours, manage_hours_categories
---

# Read the Hours record

Help the parent understand the time already recorded. The tool retrieves and
counts; you decide the requested scope and explain what those facts mean.

## Choose the record she asked for

1. Use the child ID from the authenticated family context when she names one
   child. Selecting a child does not exclude shared time: that child's record
   normally includes both their own entries and whole-family entries. Keep
   `includeShared: true` when she asks for one child's total or says she only
   wants that child's record. Set it false only when she explicitly wants
   shared or whole-family entries left out. If she does not name a child, read
   the whole family unless the surrounding request already selects one.
2. Honor explicit dates with inclusive `from` and `through` values. A single
   date uses the same value for both. Use the period for an ordinary week,
   month, school-year, or all-time request; do not invent a school-year start.
3. Call `find_hours` before answering what is recorded or missing. Tool totals
   cover the returned scope. The recent `entries` list can be shorter than
   that scope; do not add that list to produce a total.

## Read the receipt before answering

- `complete: false` means the full record was not verified. Say it could not
  be read reliably. Do not give a total, a day count, or a claim that nothing
  matches, even if the parent invites a guess or part of the data is visible.
- On a complete read, `totalMinutes` is the total for the requested scope.
  `byChild` gives each child's total with shared time included when requested.
  `byEntryScope` instead shows which rows were assigned directly to a child
  or to the whole family; its child buckets are not shared-inclusive totals.
- Shared rows count once in the family total and toward each child's record
  when included. Do not sum the inclusive child totals into a family total.
  If she requests both, explain that difference briefly, without ranking the
  children or making a verdict about them.
- `recordedDays` and `recordedDaysByChild` count dates with timed entries.
  Several entries on one date still make one recorded day. Those dates do
  not certify attendance. A blank date says nothing was timed in that record,
  not that the child was absent or did no learning. Do not fill a blank from
  a plan or infer missing school days by subtracting from a calendar.
- Trust the returned period and label. If a school-year request falls back to
  all time because the start date is unset, label that total as all time
  through the returned date and offer the existing school-year setting.

## Finish with the answer she needs

Give the requested total or dates, name any shared-time exclusion, and keep
any limitation next to the number it qualifies. A complete empty result is
"No timed entries are recorded for that date," not a claim about what the
family did. If she describes work to add or asks for a correction, follow the
existing Planner workflow for that separate action. Reading a time record
alone does not call for a state packet, a legal verdict, or a write.

## Categories keep the parent subject

- Hours display names are Language arts (`reading`), History and social studies (`social studies`), and Foreign language (`spanish`). These are bookkeeping subjects, not a skill judgment or progress score.
- For a named category, use its exact subtotal from a complete `find_hours` receipt in the requested child/date scope when available. Otherwise list `manage_hours_categories`, select its exact returned id and parent subject, then pass `categoryId` to `find_hours` with that same scope. If the same name belongs to several subjects and context does not decide which, ask one clarification. Never invent a category id or decide the subject by a keyword rule.
- For category subtotals under a subject, read that subject with `find_hours` and use `byCategory`. Null category means uncategorized time. These exact subtotals sum to the parent subject total; recent entries are a sample and must not be summed instead. Use `uncategorizedOnly: true` only for an explicit uncategorized request.
- Create an unused category only when requested. Use the parent's name and chosen parent subject with `manage_hours_categories` action `create`. If the parent subject is unclear, ask. An existing exact name under that subject is reused. Saving a category creates no Hours entry.
- To rename, list first and send the owned category id, subject, current `expectedName`, and requested name. This renames the category on all existing entries under that subject. Confirm only a `saved` receipt. A duplicate name refuses rather than silently merging categories; a conflict requires a fresh read.
- When the parent reports new timed work under a category, pass the catalog's current name as `customLabel` in the existing Planner/log_hours workflow. Preserve the stable parent subject. The database keeps new category names available even after their last entry is deleted.

Use the parent-facing subject names in your answer. Canonical ids such as `reading` and `spanish` are tool inputs only; do not explain those internal names to the parent. For example, a saved Literature category under `reading` is "Literature is ready under Language arts, with no time logged yet."
