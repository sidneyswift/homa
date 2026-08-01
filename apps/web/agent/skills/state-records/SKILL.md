---
name: state-records
description: Use when a parent asks about state homeschool paperwork, requirements, attendance packets, state packets, notice letters, filing forms, or wants to find, make, refresh, print, or share those records. Not for logging today's school time; the hours tools own that. Not for ordinary worksheets; materials-studio owns those.
metadata:
  homa-tools: open_state_records, save_school_year_start, ask_user_questions
---

# State records

Help the parent reach the reviewed state pack and filing document without
turning Homa into a lawyer or a filing service.

## First decide what she means

- "My state packet," "attendance packet," "homeschool packet," or "what does
  my state need?" means `open_state_records` with `generate_pack` when she asks
  to make or refresh it, and `view` when she asks to see or inspect it.
- "Notice," "letter," "filing," "form," or "paperwork I send" means
  `generate_filing` when she asks to make or refresh it.
- "Print it" or "share it" means open the state records first if no current
  state pack or filing document is already on screen. The native view hands the selected
  document to the normal material print and share surfaces.

Parents will not say internal names. Treat "Can you get my paperwork ready?"
as state records when the surrounding conversation is about reporting to the
state. If the target is genuinely ambiguous, ask one short question: "Do you
mean the pack for your records, or the document you send?"

## Workflow

1. Call `open_state_records` with the intended action.
2. Trust the tool result. If it says `no_state`, ask which state she homeschools
   in and direct her to save it in Settings. Never infer a state from location,
   timezone, or an old conversation.
3. If a generation says `needs_school_year_start`, ask exactly one question:
   "What date does your school year start?" When she answers, translate her
   explicit answer to `YYYY-MM-DD`, call `save_school_year_start`, then call
   `open_state_records` again with the original action. If validation refuses
   the date, explain why and ask again. Never infer a start date from a state
   deadline or typical school calendar. A `view` may still open with the date
   named as missing.
4. Let the native view show the current document, earlier immutable copies,
   included templates, real logged-time coverage, missing information,
   sources, and last-verified date. Do not recite all of it unless she asks.
5. After generation, say only what the tool and app confirmed. "Ready to
   review" is accurate. "Filed," "approved," "complete," or "compliant" is
   not.

## The legal and records boundary

- The requirements pack uses Homa's reviewed state snapshot. Do not answer
  from model memory when the reviewed record is missing.
- Logged school-time coverage is shown beside the pack. Do not claim those
  entries were compiled into the PDF unless a later tool result explicitly
  says they were.
- Missing family details print as blanks. Never fill a blank with a guess.
- Homa never submits state paperwork. The parent reviews every page, fills any
  blanks, signs when needed, and files it herself.
- Earlier packs and filings are receipts. Regeneration creates a new current
  copy and preserves the older ones.

## Voice response examples

After opening:

> I pulled up your Ohio state records. Your current pack, sources, and any
> blanks are on screen, and we can keep talking while you look.

After generation:

> Your pack is ready to review. I showed the school time you have logged so far.
> Those totals stay beside the pack because its record pages are blank.

For a notice Homa can prepare:

> Your notice is ready to review. Please fill any blanks and sign it. You file it
> yourself. I did not send it.

For a state form or portal:

> Your copy-from sheet is ready. Use it to fill in your state's form or portal.
> This sheet is not the filing, and I did not send anything.
