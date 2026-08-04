# Planner learning log implementation notes

## 2026-08-02

**Founder direction**

Planner is the family's record of both what is going to happen and what did
happen. Logging is the first-class path because it covers families who plan
ahead and families who follow a curriculum rhythm, then record the day.

**Felt difficulty**

The unified Planner can display scheduled generated-plan activities, family
events, and Hours. It cannot represent an independent piece of completed
learning such as "Horizons lesson 42 with AD" unless that work was already in
a generated four-week plan. The Planner skill also says Homa never marks work
done, so conversation cannot close the loop the founder transcript describes.

**Rival models considered**

1. Store completed learning as `family_events`. This reuses dates and child
   audiences, but it turns learning evidence into an appointment and leaves
   completion, subject, source, and linked time implicit.
2. Force every report into `child_plans`. This preserves one checklist, but
   invents a generated-plan parent for ad hoc work and inherits positional
   identity risks from array indices.
3. Add a stable Planner learning record and project it beside generated plan
   activities. This preserves existing plan machinery, represents log-first
   work honestly, and gives later Library and material links a durable id.

The third model is the smallest truthful substrate.

**Contract**

- One stable row represents one independent planned or completed activity.
- A many-child audience represents one shared activity without duplicate
  visible rows. An empty audience means the whole family.
- Subject uses the existing Hours vocabulary. Duration is optional and only
  means the completed time the parent reported in that source message. Hours
  is the editable compliance record; the Planner value remains provenance.
- A supplied duration creates or reuses one Hours row per participating child
  inside the same transaction. A genuinely whole-family record gets one
  family-level Hours row. Missing duration never blocks the Planner record.
- Conversation writes store a verified verbatim source span and a trusted
  message or turn idempotency key. The model proposes meaning; code verifies
  provenance, family children, dates, enums, and uniqueness.
- Independent learning does not change scored Progress. If the message also
  contains an observable capability claim, the existing Progress evidence
  path handles that separately.
- Existing generated-plan work is completed only after `open_planner` returns
  its plan revision, indices, and text. The completion write rechecks all of
  them under the plan lock.

**Implemented surfaces**

- Web and native Day, Week, and Month views project stable planned and
  completed learning beside scheduled generated-plan work and family events.
- Homa can record independent work or complete one exact existing item from a
  parent recap. The Planner skill owns the judgment and the bounded tools own
  authenticated, tenant-scoped writes.
- Web and native generated-plan check-offs use `set_plan_activity_check_v2`,
  which verifies revision, text, and position under the plan lock.
- Completed work with supplied time creates linked Hours rows atomically.
  Marking that activity not finished asks for confirmation, then removes only
  its linked Hours rows and restores planned status in one stale-safe
  transaction.
- Voice writes arm durable receipts before mutation. Exact undo can delete a
  recorded activity, restore a stable planned activity, or restore a generated
  check-off only while every stored after-state still matches.
- Content-free `planner.learning_recorded` and
  `planner.learning_completed` events measure real successful mutations.

**Corroboration**

The PostgreSQL fixture records one shared sibling activity, completes it with
two exact Hours rows, and restores it with Voice undo. It also proves a manual
not-finished correction removes linked Hours atomically, records and deletes
completed PE work, completes and restores generated-plan work, rejects stale
identity, and applies all 157 migrations in a disposable database.

Behavioral evals prove the language boundary in both directions. A parent
recap loads Planner and records the named lessons without entering Progress.
Ambiguous child, date, or activity recaps ask and write nothing. Future
scheduling loads Planner, a non-learning appointment stays a family event,
and plain lesson-plan authoring stays with materials-studio. A capability-only
statement does not manufacture dated history. Focused web and native rendering
tests, the production isolation audit, event and deadline guards, the
Vercel-mode Eve build, and the full production build all pass.

Tracking: gh#758. Related prerequisites and boundaries: gh#259, gh#267,
gh#712, gh#757.
