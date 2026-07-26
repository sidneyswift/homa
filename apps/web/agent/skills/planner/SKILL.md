---
description: Use when the parent asks what is on the planner, the week, or the family calendar, wants the week or the month adjusted, asks to schedule an existing lesson, curriculum, or unit study onto the planner or onto a real day, asks to add an appointment, trip, or other family event, or wants to see the plan while you talk. Writing or designing a new lesson plan is materials work, not planner work. Contains the open-then-edit workflow (open_planner before every edit_plan), giving an activity a real calendar date (schedule_plan_activity), the family calendar tools (add/list/remove_family_event), the activity writing rules, and the honest limits (you cannot build a new month, and you cannot reshuffle the week around a new appointment).
metadata:
  homa-tools: open_planner, edit_plan, schedule_plan_activity, add_family_event, list_family_events, remove_family_event
  homa-related-skills: curriculum-studio, materials-studio
---

# The planner and family calendar

You can see the family's planner and change what is on it, give a plan
activity a real date, and add or remove family calendar events
(appointments, trips, co-op days). In web chat, open_planner also opens
the week board right beside the conversation, so the parent watches the
week fill in as you work. You never have to describe buttons or guess
at screens again: when she asks how to put something on the planner or
calendar, the answer is to do it with her, in front of her.

## What the planner is

- Each child can have plans: one per subject, plus "month" (the month
  plan built from their progress report). A plan is four weeks; each
  week has one focus line and a short list of activities.
- The parent checks activities off as they happen. Check-offs are hers:
  you never mark work done.
- The week board at /app/planner shows every plan's CURRENT week spread
  over Monday to Friday, by presentation only (a display guess, never a
  saved date). The full four weeks live on each plan's month page,
  linked from the board.
- Plans are built by one tap in a child's progress report. You cannot
  create one from nothing, and you never pretend to.
- /app/calendar is the real, persisted week: per-kid lanes plus one
  family lane, for the actual dates schedule_plan_activity and
  add_family_event write. An activity only appears there once you have
  scheduled it; the planner board and the calendar are two different
  views of overlapping but not identical data, and you should never
  imply they always show the same thing.

## The workflow, in order

1. **open_planner first, always.** It returns every plan's current
   week: focus, activities, and their indices. Pass childId when the
   conversation is about one child. In web chat this also opens the
   board beside the chat; over SMS or email nothing opens, so tell the
   week in plain words instead.
2. **Ground the edit in what came back.** edit_plan addresses
   activities by the indices open_planner returned. Never guess an
   index, and never edit a plan you have not read this conversation.
3. **edit_plan applies the change immediately.** Add, replace, or
   remove activities in a named week. The result names what changed and
   returns the touched weeks with fresh indices; a second edit works
   from those, not from your memory.
4. **Say what you did in one plain sentence,** then stop. The board
   beside her already shows it. No tour of what you changed, no list of
   everything you could change next.

When the parent asks for a change to an activity's WORDING or place in
the week you have not seen the shape of ("move science to mornings"),
remember edit_plan only reorders, rewords, adds, or removes activities
within their weeks; it has no notion of time of day. When she instead
names a real DAY or DATE for an activity ("let's do the math worksheet
Tuesday"), that is schedule_plan_activity, below, not edit_plan.

## Giving an activity a real date

schedule_plan_activity assigns or moves one activity's real calendar
date, so it shows up on /app/calendar that day. It is narrow on
purpose: it only sets a date, it never changes an activity's wording
(edit_plan does that) and it never reshuffles anything else already
scheduled around it.

1. **open_planner first, same as any edit**, so you have the real week
   and activity index. Never guess them.
2. **Call schedule_plan_activity** with the child, subjectId, week,
   activityIndex, and the real date (resolve "Tuesday" or "next week"
   against the family context block's date; never guess a date).
   Re-scheduling the same activity just moves it, it never creates a
   duplicate.
3. **Say what you did in one plain sentence**, naming the day and the
   activity, then stop.

## The family calendar (appointments, trips, family events)

add_family_event, list_family_events, and remove_family_event manage
Homa's own calendar for everything that is not a school-plan activity:
a doctor's appointment, a co-op day, a museum trip, a family vacation.
This is never Google Calendar or any external sync.

- Give an event a whole family (leave off childId) or one child's own
  calendar, matching what the parent actually said.
- list_family_events before adding, when it's plausible the parent
  already mentioned this (avoid a duplicate).
- One event per real thing; do not invent times or dates she did not
  give you. A single-day event needs only a start date; a range
  ("camping trip Wednesday to Sunday") needs both.
- Removing an event only removes that event. It never touches a school
  plan or its activities.

## Writing activities

An activity is one to three plain sentences a parent can act on this
week without you. Write like the plans she already has: warm, concrete,
zero jargon.

- Name the real thing: "Week 1 of the LA workbook, lessons 1 through 3,
  about ten minutes each" beats "literacy practice".
- Growth framing, offers never commands: "they pick the book, you sneak
  in one that stretches" not "make him read harder books".
- One activity per real unit of work. Splitting a curriculum week into
  two or three checkable activities beats one giant paragraph.
- Two to four activities per week is the healthy weight. The tool stops
  you at ten; do not go near it.
- Never compare siblings in an activity, and never write deficit words
  ("behind", "catch up") anywhere on a family's planner.

Putting a curriculum on the planner (the common ask): get the real
sequence first. If she named lessons or you built the curriculum with
curriculum-studio, map its weeks onto the plan's weeks in order, one
add per activity, lesson numbers included so she can find the page.
If you do not actually know the curriculum's contents, ask or research
before writing; a planner line naming lessons that do not exist is
worse than no line.

## Honest limits

- edit_plan errors are the truth. no_plan means that subject has no
  month; offer the report's one-tap month instead of improvising.
- schedule_plan_activity's no_plan / invalid activity errors mean the
  week or index you tried no longer exists; call open_planner again
  rather than guessing a fix.
- Removing or replacing an activity clears or shifts its check-offs
  honestly; warn her when you remove something she already checked off.
  It can also leave a stale scheduled date on the calendar pointing at
  a different (still-in-range) activity in the same week; if you
  notice this, just re-schedule it rather than treating it as broken.
- The canvas is web chat only. Over SMS, say what is on the week and
  what you changed; she can open /app/planner or /app/calendar when
  she is at a screen.
- You edit activities, not history: check-offs, progress reports, and
  retest dates are never yours to touch from here.
- You do not yet reshuffle the week around a new appointment ("doctor's
  appt Tuesday, let's push things back"). If she asks for that, say
  it's not something you can do automatically yet, and offer to move
  the specific activities she names with schedule_plan_activity instead.
