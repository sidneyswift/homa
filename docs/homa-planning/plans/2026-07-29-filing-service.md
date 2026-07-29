# The filing service: every family filed on time, with the paperwork already done

Date: 2026-07-29. Status: building. Founder rulings recorded below, given
in a question-and-answer session the same day.

Today's state pack explains a family's rules. This turns it into a
service: Homa knows when each family's paperwork is due, prepares it with
their details already filled in, and emails it to them before the
deadline with the steps to turn it in.

## What the founder ruled

1. **Due dates come from the family, once.** Only 14 of the 39 filing
   states name a calendar date in law (AR CA DE GA IA MN MS NE NY OH PA
   VA WA WI). The other 25 count from when that family started, so Homa
   asks each family once when their school year starts and calculates
   every deadline from it.
2. **Research before letters.** In 32 of 40 filing states the law asks
   only for a written notice, so Homa can generate the finished letter.
   But some states require their own form or portal. Confirm state by
   state which accept a mailed letter FIRST. Send a real ready-to-sign
   letter only where it is genuinely accepted; everywhere else send the
   filled-in sheet to copy from. Nothing Homa sends may get a family
   rejected.
3. **Ask for the missing details early and gently.** Parent full name,
   home address, child full name, and grade are not stored today. A drip
   starting a couple of days after signup asks for them, framed as "we
   need this to do your filing, it is not due until X", and nudges until
   the family fills it in. The approaching deadline triggers its own ask
   as well.
4. **Plus and Elite only, the whole feature.** Regular families see that
   it exists and are invited to upgrade.
5. **A missing answer never costs a deadline.** If the details are still
   missing two weeks out, Homa sends the filing anyway with the gaps
   clearly marked to hand-write. Missing a legal deadline is far worse
   for a family than writing in their own address.
6. **A lawyer reads it before it emails anyone.** Build the whole thing
   and prove it end to end, but the automatic emails stay switched off
   until counsel reviews the letter wording. This produces a document a
   family signs and sends to a government body, which is a materially
   bigger step than the explainer shipped on 2026-07-28.

## Build order

P0, in dependency order:

- **A. School-year start.** One question, asked in chat and in the drip,
  stored on the family. Without it, 25 states have no computable due
  date.
- **B. The deadline engine.** Turns the verified anchors plus the
  family's start date into real due dates. Pure, testable, no model.
- **C. State filing-method research.** Per state: does it accept a
  mailed letter, require its own form, or require a portal? Reviewed and
  committed as data, same human gate as the snapshot pipeline. Gates D.
- **D. The filing document.** A ready-to-sign letter where the state
  accepts one, the filled copy-from sheet everywhere else, gaps marked
  where data is missing.
- **E. The reminder job and email.** Two weeks ahead, generate and send,
  with the step-by-step for that state. Ships switched off (ruling 6)
  and gated to Plus and Elite (ruling 4).

P1:

- **F. The missing-details drip.** From a couple of days after signup,
  nudging until complete.

P2:

- **G. The conversational version of F**, where Homa collects the same
  details in chat rather than a form.

## What this does not do

No filing on a family's behalf, ever. Homa prepares the document; the
parent signs and sends it. Nothing here implies Homa filed anything, and
that boundary language stays on every artifact.
