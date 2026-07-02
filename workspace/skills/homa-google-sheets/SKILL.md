---
name: homa-google-sheets
description: Create and maintain Google Sheets trackers (reading logs, math practice, the story-coach scoreboard, household/curriculum budgets) via the gog CLI as {{PARENT_EMAIL}}. Use whenever the parent or the partner wants something tracked in rows/columns over time, a shared sheet the parent can open on her phone, or when a sheet needs reading, updating, backing up, or rolling over to a new month. Ported from the googleworkspace/cli recipes, adapted to gog (the CLI Homa actually has).
---

# Google Sheets (via gog)

Sheets is the right tool when data accumulates in rows over time and the parent wants to glance at it on her phone. Reading logs, math-fact practice counts, the homa-track-story-coach weekly scoreboard, a co-op supply budget — anything that's "a row per day/entry."

All commands take `-a {{PARENT_EMAIL}}`. Verified working 2026-06-26 (Drive + Sheets APIs enabled in the GCP project).

## The two gotchas that bite (learned the hard way)

1. **There is NO `gog sheets create`.** You create a spreadsheet by uploading a CSV and converting it (see below).
2. **Use BARE ranges (`A1`, `A1:C10`), never `Sheet1!A1`.** When you create via CSV-convert, the first tab is named after the file, so `Sheet1!…` throws `400 Unable to parse range`. To target a tab by name, quote it: `"'Reading Log'!A1"`. Get tab names with `gog sheets metadata <id>`.
3. **Values: `|` = cells, `,` = rows.** One row of two cells is `"Alex|10"`. Two rows at once: `"Alex|8,Mom|9"`. Passing `"Alex" "10"` as separate args is wrong.

## Create a tracker

```bash
# Seed the headers (and any starting rows) in a local CSV, then convert on upload.
printf "Date,Book,Minutes\n" > /tmp/seed.csv
gog drive upload /tmp/seed.csv --convert-to sheet --name "Reading Log" -a {{PARENT_EMAIL}} -j
# → returns file.id — THAT is the spreadsheetId. Save it.
```

The returned `file.webViewLink` is the URL to give the parent. To let her edit from her phone she already owns it (it's her account), so it's in her Drive automatically.

## Read / write

```bash
SID=<spreadsheetId>
# Read a range
gog sheets get   "$SID" "A1:C20"        -a {{PARENT_EMAIL}} -p   # -p = clean TSV
# Append a row (today's entry)
gog sheets append "$SID" "A1" "2026-06-26|Frog and Toad|15" -a {{PARENT_EMAIL}}
# Overwrite a specific cell / range
gog sheets update "$SID" "C2" "20"      -a {{PARENT_EMAIL}}
# Clear a range (e.g. reset a scratch area)
gog sheets clear  "$SID" "A2:C99"       -a {{PARENT_EMAIL}}
# Tab names + structure
gog sheets metadata "$SID" -a {{PARENT_EMAIL}} -j
```

## Back up a sheet (before a big edit, or for the Obsidian vault)

```bash
gog drive download "$SID" --format csv -a {{PARENT_EMAIL}}   # exports the sheet to CSV locally
```

## Roll a tracker over to a new month

gog has no per-tab copy. Easiest is to copy the whole spreadsheet:

```bash
gog drive copy "$SID" "Reading Log — July 2026" -a {{PARENT_EMAIL}}
```

(Or keep one sheet and just keep appending dated rows — usually better for a continuous log so trends stay in one place.)

## Good uses for this family

- **Child reading log** — Date | Book | Minutes | Notes. Append a row each night from the journal capture.
- **story-coach scoreboard** — a shared sheet version of the weekly scoring so the parent can see progress anytime (see `homa-track-story-coach` skill).
- **Math / sight-word practice counts** — one row per session.
- **Co-op / curriculum budget** — Date | Category | Item | Amount.

Don't reach for Sheets when a single number or a Slack message will do. It earns its place when the *history* matters.
