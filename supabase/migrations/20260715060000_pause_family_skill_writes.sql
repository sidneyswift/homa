-- Filesystem-first fleet skills
-- (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md
-- §6 Phase B step 8). Deployed AFTER the code cutover that removed
-- save_skill, forget_skill, and the dynamic resolver
-- (agent/skills/skill-library.ts): no runtime code writes family_skills
-- anymore, so revoking the write policies only closes the RLS gap where an
-- authenticated member could otherwise write the table directly, bypassing
-- the retired app-side injection scan and count cap.
--
-- "members read their skills" stays: existing rows (dormant historical
-- data, currently zero after a family/account deletion cascade, see
-- build-log.md 2026-07-15) remain visible during the Phase C dormant
-- window per the plan. Nothing here touches skill_bank, which never had
-- member write policies (founder-curation-only since migration #16), or
-- drops any table or row. Additive-but-behavior-restricting; rollback is a
-- compensating migration that restores these three policies verbatim.

drop policy if exists "members add skills" on public.family_skills;
drop policy if exists "members update their skills" on public.family_skills;
drop policy if exists "members delete their skills" on public.family_skills;
