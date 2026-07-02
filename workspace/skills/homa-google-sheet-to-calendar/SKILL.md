---
name: homa-google-sheet-to-calendar
description: Turn a schedule laid out in a Google Sheet (or any row/column plan) into Google Calendar events on the parent's calendar, one event per row, via gog as {{PARENT_EMAIL}}. Use when planning a homeschool term, co-op block, Spanish class series, or field-trip schedule and you want it on the calendar without hand-entering each event. Ported from the googleworkspace/cli "create events from sheet" recipe, adapted to gog.
---

# Schedule sheet → Calendar (via gog)

When the parent plans a stretch of weeks — a curriculum unit, a co-op block, a recurring Spanish class — it's easier to draft the schedule as a sheet (or table) and then have Homa create the calendar events in one pass.

All commands take `-a {{PARENT_EMAIL}}`.

## The flow

1. **Read the schedule.** Expect columns like `Date | Title | Start | End | Location` (or similar — adapt to what's there).

   ```bash
   gog sheets get "$SID" "A2:E" -a {{PARENT_EMAIL}} -p
   ```

2. **Create one event per row.** Calendar wants RFC3339 timestamps (`2026-09-08T09:00:00`). Combine the date + time columns.

   ```bash
   gog calendar create primary \
     --summary "Co-op — Week 1" \
     --from "2026-09-08T09:00:00" \
     --to   "2026-09-08T11:00:00" \
     --location "Community Center" \
     -a {{PARENT_EMAIL}}
   ```

   - All-day (no time, just a date): `--all-day --from 2026-09-08 --to 2026-09-09`.
   - Add `--description "..."` for notes (materials to bring, prep, etc.).

3. **Confirm, don't spam.** Before bulk-creating, show the parent the list of events you're about to add and how many. Creating 12 calendar events she didn't expect is worse than asking once.

## Notes

- Events land on the parent's primary calendar (she's the authenticated account), so they show on her phone immediately.
- For a *recurring* class (same slot every week), it's usually cleaner to create one recurring event in Calendar than 12 rows in a sheet — ask which she wants.
- Verify the first event looks right in the read-back before looping the rest.
- This is one-directional (sheet → calendar). It does not keep them in sync; re-running creates duplicates.
