# Limiting Factor Log Schema

Canonical file: `.context/pmf-focus/limiting-factor-log.yaml`

Bootstrap from: `assets/limiting-factor-log.template.yaml`

## Top-level fields

| Field | Meaning |
|---|---|
| `product` | Product name (e.g. Homa) |
| `pmf_definition` | One paragraph: what "PMF" means here in observable terms |
| `updated_at` | ISO timestamp of last write |
| `current` | The only active factor object, or `null` when choosing the next |
| `history` | Completed (and abandoned) factors, newest first |
| `research_notes` | Cross-cutting research across the product surface |
| `say_no_queue` | Work that was declined because it was not the factor |

## `current` / history factor object

| Field | Meaning |
|---|---|
| `id` | Stable slug, e.g. `lf-2026-07-16-activation` |
| `title` | Short name of the bottleneck |
| `statement` | One sentence limiting-factor statement |
| `status` | `identified` \| `in_progress` \| `blocked` \| `complete` \| `abandoned` |
| `why_bottleneck` | Value-chain reasoning |
| `success_criteria` | List of observable outcomes |
| `verification_plan` | How we will know it is gone |
| `evidence` | List of `{ claim, source, checked_at, result, kind }` where `kind` is `verified` or `hypothesis` |
| `not_doing` | List of parked items with reasons |
| `blocker` | Required when `blocked`: what/who is blocking |
| `started_at` | ISO timestamp |
| `completed_at` | ISO timestamp when `complete` or `abandoned` |
| `completion_evidence` | What was observed that justified completion |

## Status transitions

```
null → identified → in_progress → complete → (moved to history)
                      ↓
                   blocked → in_progress (when unblocked)
                      ↓
                   abandoned (only with written reason; rare)
```

Rules:

- Never two non-null `current` factors.
- Never set `complete` without `completion_evidence`.
- `abandoned` requires a falsification note: what evidence killed it.
- Moving to history: append the object to `history`, set `current` to `null`, then run WTF again before filling `current`.

## `research_notes` entries

```yaml
- at: "2026-07-16T12:00:00-04:00"
  surface: "onboarding | chat | progress | billing | sms | admin | landing"
  finding: "..."
  source: "..."
  implication_for_pmf: "..."
```

Use these for durable learning that is not yet (or not only) the current factor. Do not dump chat transcripts. Summarize.

## `say_no_queue` entries

```yaml
- at: "..."
  proposal: "..."
  said_no_because: "not the current limiting factor (lf-...)"
```

## Write discipline

- Update `updated_at` on every write.
- Prefer append-only history; do not rewrite completed factors except to fix factual errors.
- Keep the file readable. Short strings beat essays.
- For Homa family counts, use the denominator labels in `reality-checks.md` ("signup-screen abandon", "signed-up family", "family setup done"). Never write "real families" for `sandbox = false` alone.
