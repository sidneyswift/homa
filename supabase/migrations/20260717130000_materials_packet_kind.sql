-- Migration: materials gains the 'packet' kind (multi-page packets,
-- 2026-07-17; the Llanes incident follow-through). A packet is one
-- material whose PDF carries several pages: weekly lesson bundles,
-- curriculum volumes, anything a parent wants as one file to print
-- once. Widening the check constraint is additive: every existing row
-- and the previous deploy's writes stay valid, so this may lead the
-- code deploy per the additive-migrations rule.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

alter table public.materials
  drop constraint if exists materials_kind_check;

alter table public.materials
  add constraint materials_kind_check
  check (kind in ('worksheet','coloring','flashcards','reader','poster','infographic','game','packet','other'));
