# Supabase migrations

This directory is Homa's local migration history. A local filename does not prove that the corresponding version or schema is present in production.

The latest time-bounded local and remote name comparison lives in `docs/homa-planning/reconciliation/evidence/production-baseline.md` § Migration name history. That comparison is intentionally not described as current parity after later local migrations appeared.

## Current storage model

Current application data uses family, member, child, report, message, task, material, and related product tables. Historical migration files still contain retired `lead_*` names because applied history is not rewritten.

RLS is deny-by-default for family data. Browser access uses the caller's Supabase JWT. Server-originated channel code must derive a family from an authenticated mapping and call family-pinned libraries; ticket M1-02 owns the remaining non-service-role plus transaction-local `SET LOCAL` hardening.

## Verification

Run `pnpm check:isolation` before any schema or query change. For deployment order, follow `AGENTS.md` § Deploys and migrations.
