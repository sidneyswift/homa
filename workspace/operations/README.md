# operations/

Homa's self-management surface — files about *how Homa runs*, not homeschool content.

- `roadmap.md` — the capability roadmap: what Homa could do that it doesn't yet, re-ranked from current
  signal. `homa-system-reflect` grooms it.
- `health.md` — read-only scored health punch list, written by `scripts/doctor.py` (the
  `homa-system-doctor` fast path). The "is the OS consistent?" verification surface the janitor and
  `homa-system-reflect` gate on. Regenerated each doctor run.
- `improvements.md` — the self-improvement ledger, written by the `homa-system-reflect` skill. Every
  entry is a machinery change grounded in a specific observed friction.
