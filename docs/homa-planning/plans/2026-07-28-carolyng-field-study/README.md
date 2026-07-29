# Carolyng field study: two weeks of real use, one meeting, one plan

Date: 2026-07-28. Author: senior PM session (Fable). Status: proposed, council-reviewed.
Family: Carolyng Gomes, `304f0003-6c55-4c31-807a-941aff214283` (real, non-sandbox, DC).
Kids: Amalia (3, Spanish-first phonics), Ara (6, space and Astro Bot), Alma (9, Kirby, Doctor Who, Percy Jackson).

## What this is

A co-founder dogfooding study built from two primary sources:

1. The 2026-07-28 in-person meeting transcript (ingestion engine, subject tagging,
   layout refinement, worksheet generation).
2. Every conversation her family had with Homa from 2026-07-14 to 2026-07-28 in prod:
   ~410 web/SMS messages, 6 phone calls, 166 material rows, hours log, memories,
   attachments, lesson recordings, and email sends, all pulled from Supabase and
   cross-checked against the code and the open issue roster.

Carolyng is the heaviest and most articulate real user Homa has. Her two weeks are
a preview of every serious homeschooler's first month.

## Reading order

| Doc | What it holds |
|---|---|
| [01-findings.md](01-findings.md) | Evidence-backed findings: what works, what fails, with prod receipts |
| [02-user-journeys.md](02-user-journeys.md) | The six journeys her usage traces, current vs target |
| [03-user-stories.md](03-user-stories.md) | User stories with acceptance criteria |
| [04-features.md](04-features.md) | Feature specs with placement rulings (skill vs tool vs schema) |
| [05-bugs.md](05-bugs.md) | Bug inventory with status per the prod-bugs ruling |
| [06-council.md](06-council.md) | Expert council review: challenges, suggestions, verdicts |
| [07-issues.md](07-issues.md) | The GitHub issue manifest and the executable arc |

## The one-paragraph thesis

Homa already wins the moment of delight (a Kirby math page a 9-year-old waits at
the printer for) and already earns life-level trust (a NYC itinerary, museum hours
logged from a phone call). What burns that trust is everything between request and
print: an average material took this family multiple sessions and dozens of
correction rounds, drafts silently vanish from the binder, promises made on one
channel evaporate on another, and the priceless context she keeps trying to hand
over (her curricula, her bookshelf, her week-by-week plans) has nowhere durable to
land. The fix is not one feature. It is a family knowledge plane (ingest, tag,
retrieve), a calendar that consumes it, a materials loop that converges in two
rounds instead of twenty, and one brain across channels. The fleet corpus plan
(gh#328) trains the writer; this plan gives every family a library the writer can
actually write from.
