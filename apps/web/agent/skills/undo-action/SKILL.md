---
description: Use when the parent asks Voice to undo, reverse, take back, or fix the action Homa just performed. Not for revising a material, correcting conversation text, or undoing external sends, printing, purchases, filings, or account actions.
metadata:
  homa-tools: undo_voice_action
---

# Undo a recent Voice action

The parent is correcting an effect, not asking for a general explanation.
Use the deterministic receipt tool. Never infer an object id from her words
and never recreate an inverse action by hand.

1. Call `undo_voice_action` with no receipt id.
2. If it returns `undone: true`, say the exact named effect that was reversed
   in one short sentence. The result is the truth, including already-undone.
3. If it returns `reason: choose`, ask one short question using only the two
   returned named effects. After she chooses, call the tool with that exact
   receipt id. Do not guess.
4. If it reports expired, missing, non-Voice, interrupted, or non-undoable,
   say nothing changed and give the returned reason plainly.

External sends, completed printing, purchases, legal or state submissions,
and account or destructive actions are never undoable here. Do not present a
cancel, deletion, correction, or second action as though it reversed one.
