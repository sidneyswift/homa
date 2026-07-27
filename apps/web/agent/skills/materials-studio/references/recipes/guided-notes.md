# Guided notes

Two-column Cornell-style notes page: main-ideas/questions column on
left, notes/examples column on right. Progressive scaffolding from
review to new concept. Standalone version of the notes page from the
notes-and-practice bundle.

Great for: ages 8-14, math concepts, science vocabulary, history
timelines, any subject requiring structured note-taking. Pairs well
with a parent-led lesson or video.

Always html path. Text precision and table alignment are critical.

Design patterns (all binding for guided-notes):

- **Two-column layout**: left column (~30% width) for terms/questions,
  right column (~70%) for definitions/notes with fill-in blanks.
  `display: grid; grid-template-columns: 30% 70%;`
- **Fill-in blanks**: inline underscores in the right column
  (`border-bottom: 1.5px solid #6b6259; min-width: 80px;
  display: inline-block;`) within otherwise complete sentences.
- **Summary section**: at bottom of page with 3-4 blank lines and
  the prompt "Summary: In your own words..."
- **Name/date/topic header**: top of page with fields for all three.
- **Section dividers**: thin horizontal rules between concept groups
  (`border-top: 1px solid #e0dcd6; margin: 12px 0;`).
- **Progressive scaffolding**: top rows review prerequisites (more
  fill-in provided), middle rows introduce new concept (fewer blanks),
  bottom rows extend (mostly blank).
