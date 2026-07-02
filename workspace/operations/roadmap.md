# Homa Capability Roadmap

last-groomed: <YYYY-MM-DD>

The backlog of **what Homa could do that it doesn't yet**. Built to *not go stale*, in two parts:

- **LIVE QUEUE** (top) — the re-ranked active list. `homa-system-reflect` **rewrites this every night**
  from current reality: re-validates each item against today's signal, drops what's no longer grounded,
  re-scores, re-ranks, dedups. Mutable; always reflects *now*.
- **STREAM** (bottom) — append-only history. Every idea ever, dated + cited. Never edited or deleted, so
  the memory (including why something was parked) survives after an item leaves the queue.

`last-groomed:` is bumped each grooming pass; the doctor flags the roadmap as stale if it falls behind
(which means reflect stopped running).

**Priority score:** `priority = leverage × groundedness ÷ (effort + risk)`, tie-break by signal recency.
The north star is **how much of the parent's actual homeschooling load Homa carries** — adoption beats
novelty.

## LIVE QUEUE  (reflect rewrites this nightly)

| pri | item | status | leverage / effort+risk | citation (date) | last-validated |
|----:|------|--------|------------------------|-----------------|----------------|
| | <capability> | idea | / | <what the parent did/asked/needs> | |

## STREAM  (append-only — every idea, never deleted)

- <YYYY-MM-DD> — <idea / decision / shipped item, dated + cited>
