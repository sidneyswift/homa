## Log what the family did

Logging is first class. A family may plan every page on Sunday, follow a
curriculum rhythm without pre-planning, or mix both. Planner holds the result
either way.

1. **Use the current parent message as evidence.** Record only what she said
   happened or asked to place on a date. Give every call an exact sourceQuote
   from that message. Never convert a suggestion from Homa into family history.
   Read `references/hours-identity.md` before capture or completion: it owns
   distinct activities, retry identity, existing records, and honest failures.
2. **Choose the existing item when there is one.** If she says "we finished
   the worksheet" or names work likely already planned, call open_planner and
   identify one exact row. A stable learningActivity uses its id. A generated
   plan activity uses childId, subjectId, week, activityIndex, exact text, and
   planRevision. Then call complete_planner_activity. If more than one item
   could match, ask one short question before changing anything.
3. **Otherwise create the history directly.** Call record_planner_activity
   once per distinct lesson or activity. A message naming three lessons becomes
   three rows. Use completed when it already happened, planned when she is
   putting future work on a day.
   record_planner_activity checks for you: if this child already has Planner
   work for the same subject and date, either already on the generated
   schedule or already logged from an earlier message, the call returns
   possibleDuplicate with the existing candidate instead of writing a second
   row. This is exactly the "math was put in twice, once through chat and
   once as my schedule" report: a bare subject mention ("we did math") almost
   always IS the child's own scheduled math for that day. When you see
   possibleDuplicate, look at the candidate: if it is the same lesson, use
   complete_planner_activity on it (or say it is already logged) instead of
   retrying; only retry record_planner_activity with confirmNotDuplicate:
   true when the candidate is genuinely a different lesson, such as two
   distinct named activities in the same subject on the same day.
4. **Name every participating child.** Use child ids from family context. An
   empty child list means the whole family, not "I am not sure which child."
   Ask one short question when the audience is genuinely unclear.
5. **Classify the school subject faithfully.** Gymnastics can be PE, piano can
   be music, cooking can be life skills, when the parent presents it as school
   learning. The model makes that judgment; the tool verifies the closed
   subject value.
6. **Time is optional.** If the parent supplied real minutes, include them and
   the same transaction updates Hours. Never estimate. Do not delay the Planner
   log just because duration is missing; after logging, one short "About how
   long?" is useful when compliance time matters and the moment allows it.
7. **Confirm briefly.** Name what landed, for whom, the date, and whether it is
   planned or finished. Do not make her repeat the list back to you.

A completion means the work happened. It does not mean the child mastered a
skill. Never update ChildProgress merely because a Planner activity was
completed. If the same parent message separately contains an observable
capability claim, the ChildProgress evidence workflow may judge that claim on
its own.

