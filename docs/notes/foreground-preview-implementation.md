# Foreground chat preview, issue #1171

## 2026-09-14 21:23 UTC · Plan-confirmed

Bound this milestone to one working day, ending by 2026-09-15 05:20 UTC. At most two preview builds and eight paid functional sends. Keep Vercel and Astra medium. Prove a real existing read tool, durable streaming, reconnect, cancellation, duplicate-send protection, failure and explicit retry. No production cutover or broad latency sweep.

## 2026-09-14 21:23 UTC · Deviation

- Plan: build a working foreground preview following the exact-input replay.
- Discovery: Eve 0.19.0 does not export its internal runtime as an ordinary inline runner. Its tool contexts also carry runtime capabilities beyond authentication.
- Conservative choice: use the existing bounded get_children tool through an explicitly limited context adapter. Other context facilities throw if requested. The preview explicitly supports conversation and this read tool only; it does not claim all 94 tools or worksheet parity.
- Revisit: full capability support requires a reviewed adapter strategy, not deep imports into Eve internals or silent tool omission from a production rollout.

## 2026-09-14 21:23 UTC · Discovery

Canonical conversation persistence is a message projection, not an append-only event log. Use isolated, non-API-exposed Postgres preview tables for exact events and turn ownership; retain the shared canonical ledger for completed and interrupted message projections. The fixture setup creates only the task-owned private schema, not a public production migration. Remove this schema after evidence preservation.

## 2026-09-14 21:23 UTC · Plan-confirmed

A disconnected browser reconnects to the same saved turn. No automatic model rerun. A lost worker leaves saved partial text and becomes interrupted after its heartbeat expires; explicit retry creates a new turn and preserves the earlier attempt. All initially supported tools are read-only, so the milestone does not claim write-tool retry safety.
