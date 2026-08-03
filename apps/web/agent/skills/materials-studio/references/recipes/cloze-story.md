# Cloze story

A short story or paragraph with key words blanked out and a word bank to
choose from. The child reads the context, picks the word that fits, and
writes it in the blank. The illustrated variant (picture-label cloze)
puts a scene at the top and sentence frames below that describe it.

Great for: ages 5-10, vocabulary in context, sight words, grammar
(choosing the verb form that fits), reading comprehension, early writing
confidence. Reading and writing in one activity without blank-page
intimidation.

Always html path: blank widths, word-bank layout, and line spacing need
text precision.

Design patterns (all binding for cloze-story):

- **Word bank first**: bordered box at top (`border: 1.5px solid
  var(--homa-control-boundary); border-radius: 6px;`), words separated by generous space,
  each word used exactly once at the base level.
- **Blanks sized to the answer**: underline blanks
  (`border-bottom: 2px solid var(--homa-ink);`) wide enough for the longest
  bank word, so blank width never gives the answer away.
- **Story about the child's world**: their name, their pets, their
  interests seed the story. A cloze about their own dog beats a generic
  one.
- **6-10 blanks maximum**, one per sentence, never two blanks in one
  sentence at the base level.
- **Picture-label variant**: illustrated scene on the top half (hybrid
  path), 4-6 sentence frames below, each frame describing something
  visible in the scene so the picture is the context clue.
- **Level up**: remove the word bank, or add distractor words that fit
  grammatically but not semantically. Name the level in metadata.
