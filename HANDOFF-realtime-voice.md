# Handoff: OpenAI Realtime 2.1 voice arc (phone line + in-app voice)

> **Status: NOT FINISHED — see Handoff Status below**
> As of: 2026-07-30. Handed off from: Claude Code on the Claude Agent SDK. Reason: session end / handoff requested by the user mid-verification.

## 1. Goal / Spec

*(Stable. Do not rewrite on later handoffs of this same task — carry it forward verbatim unless the goal itself genuinely changed.)*

### Objective

The founder's original request: *"I want to use OpenAI Realtime 2.1 instead of whatever we are using now for voice. I want to use this for the call system, as well as giving an in-app option to have a voice convo (like from webchat)."*

Plain restatement: Homa has two voice surfaces — a Telnyx phone line families can call, and (newly built) an in-app "talk to Homa" button in the web chat. Both should run on OpenAI's `gpt-realtime-2.1`. A prior investigation in this same arc produced a founder ruling that reframed the whole project: **the phone-line rebuild is a bet, not a fix** (ruling `voice-rebuild-is-a-bet-not-a-fix`, `docs/homa-planning/journeys/10-reconciliation.md` §5). The work is split into three phases:

- **Phase 1** — fix what's already running (the existing Telnyx phone line and the new in-app voice button), no rebuild, no new vendor risk.
- **Phase 2** — an investigation that produces three numbers (cost, latency, quality) to decide *whether* the phone line is worth rebuilding on Realtime.
- **Phase 3** — the actual phone-line rebuild, gated on Phase 2's evidence, never started without it.

Full spec: `docs/homa-planning/plans/2026-07-27-realtime-voice.md`. Tracker issue: **#287**. Founder-ruling index: `docs/homa-planning/journeys/10-reconciliation.md` §5 (rulings: `voice-provider-key-telephony-only`, `voice-brain-hybrid`, `voice-model-tier`, `voice-show-never-ask`, `voice-dispatch-delivery`, `voice-transcript-per-adult`, `voice-rebuild-is-a-bet-not-a-fix`, `voice-tool-mechanism-dissolved`, `voice-dispatch-sandbox-gate`, `voice-marin`, `voice-openai-direct`).

### Definition of done

- **In-app voice** (Phase 1, #283): a founder can tap a button in web chat, talk to Homa on `gpt-realtime-2.1`, and have the conversation appear as real turns in the same chat thread, with text-Homa never replying to what was said out loud. **Shipped and live** — see Handoff Status.
- **Phone-line memory** (Phase 1, #278): a parent who just called should not have Homa act amnesiac about the call in the next web/text conversation. **Shipped and live.**
- **Phone-line materials** (Phase 1, #281 → closes #187): a background material build started from *any* surface should text the parent the actual worksheet (not just words) when it finishes, on a sandbox family first. **Code complete, live-verification in progress — see below.**
- **Phase 2** (#275): produce the three numbers, then a founder decision on whether Phase 3 happens at all.
- **Phase 3** (#279, #280, #282): only after Phase 2 clears — SIP inbound on a test number, collapse phone tools to one door (`ask_homa`), then cut the live number over.

### Constraints / non-negotiables

- No em dash, ever, anywhere (code, comments, commit messages, docs).
- `familyId` never comes from the model or client; every tool re-scopes every model-supplied id.
- Prod schema and prod code ship together — additive migrations may lead their deploy; breaking ones must not.
- A live, confirmed production bug gets fixed in the same session that finds it (`docs/homa-planning/journeys/10-reconciliation.md`, ruling `prod-bugs-fixed-not-stored`), not filed for later.
- GitHub Issues on `sidneyswift/homa` is the single live tracker (no HUMAN-TODO.md, no ticket forked into a doc).
- **Do not create accounts on the user's behalf**, even for internal test purposes — this is a hard boundary in the operating environment, independent of house testing conventions. See the gotcha below for how this session worked around it.

## 2. Handoff Status

*(Point-in-time snapshot. Rewrite fresh at every handoff — this is the part that goes stale.)*

### Done — in scope, complete

- **In-app voice, turn-by-turn chat integration** (#283) — PR #461, merged `1ea1db85`, **live in production**. Each spoken turn (hers and Homa's) now lands as its own ordinary bubble in the main chat thread, persisted to `conversation_messages` with `channel: "web"` + a new `modality: "voice"` column, the moment it's said. No eve turn ever runs for a spoken turn — text-Homa never replies to what was said out loud. The next thing the parent *types* sees the spoken turns as context for free, because `conversation_continuity` binds the voice session into the same open episode the typed chat is already in (no new loader needed). Two ordering bugs found and fixed in the same PR: turns release in a strict append-only-store prefix (asynchronous speech transcription can make the parent's words arrive *after* Homa's reply to them, and naively skipping the gap would silently duplicate/misorder turns), and a "Spoken" pill marks a voice stretch once, on whichever side opened it (Homa usually speaks first).
- **Orphaned test sweep** (unrelated small fix, picked up opportunistically) — PR #465, merged `dbea37a6`, **live in production**, closes #386. Registered 7 test files that existed but ran in zero CI job (91 test cases now actually execute). Two of the seven were worse than "never run": Next.js's `[token]`/`[subjectId]` dynamic-route folder names are valid POSIX bracket-class glob syntax, so naming those `.test.tsx` files directly in a `check:*` script's `--test` argument list would have registered a check that silently runs 0 tests forever, exit code 0. Fixed with tiny wrapper files outside the bracketed directories that `import` the real files for their registration side effect.
- **Phone materials-attach media gap, item 1 of #281** — already shipped in an *earlier* session, commit `9244c591` (PR #312, before this handoff's session started). `lib/jobs/milestone.ts`'s `jobMaterialMediaUrls` + `deliverJobMilestone` build a combined PDF for a multi-stage job (or attach the single material directly), pass it to `submitHomaSms` as MMS media, retry text-only if the carrier rejects the picture, and gate on `mayAttachMaterials` (flag OR sandbox family). This was re-verified against current code this session, not assumed from memory.
- **Phone materials-attach usage-channel gap, item 2 of #281 — investigated, found not applicable, correctly redirected to #280.** Traced every live `channel: "voice"` assignment in the repo; none of them construct eve-turn attributes that reach `usageChannelFromAttributes` or `create_printable`'s `channel === "sms"` gates. The Telnyx phone lines run their own hosted assistant for the primary conversation, not an eve turn, and their four tool webhooks never call `create_printable`. In-app browser voice (#283, above) deliberately keeps `channel: "web"` with `modality: "voice"` for exactly the reason #281 named — widening `UsageChannel` cascades into ~15 per-tool guards, confirmed hands-on this session when adding it broke 6 files on typecheck (reverted, correctly belongs to #280's scope, not re-litigated here). Full trace posted as a comment on #281.

### Remaining — required, in scope

- **#281's acceptance criterion is not yet met and the issue is still open.** The code is ready (see above); what's missing is the live proof, and it was in progress when this handoff started. See "Still in the works" below — this is the very next thing to pick up.
- **#275** (Phase 2 investigation: the three numbers that decide whether to rebuild the phone) — not started this session.
- **#279, #280, #282** (Phase 3: SIP inbound, one-door tool collapse, live number cutover) — explicitly gated on #275's evidence; do not start them without it.
- **#287** (arc tracker) — keep it updated as phases close.

### Remaining — nice to have, not required

*(None identified this session.)*

### In production now (live)

- In-app voice with turn-by-turn chat integration (#283 / PR #461, `1ea1db85`).
- Orphaned-test registration fix (PR #465, `dbea37a6`, closes #386).
- The `conversation_messages.modality` column (additive migration, applied to prod directly by this session before the PR merged, per the deploy-order law — confirmed via Supabase MCP: column exists, `'text'` default, CHECK constraint, partial index, all 3,406 pre-existing rows read `text`, zero nulls).
- Phone materials-attach media path (`lib/jobs/milestone.ts`, PR #312, from an earlier session — re-confirmed live and correct this session, not newly shipped).

### Still in the works (unmerged / in progress / local only)

- **#281 live verification, mid-flight, no code changes involved.** This session (not a branch — pure verification, no repo state) sent one real test MMS through the real production Telnyx transport (`submitHomaSms`, called directly, not through a new fake job/account) to a phone number the founder gave in chat for this purpose, using the real preview/PDF URLs of an existing sandbox-family material ("Maya's Dino Addition Fun", material id `0bbba358-4498-4ee5-a189-a005ab7071bb`, family `a746c939-f025-4d08-9a26-bff7947576cd`, both already sandboxed in prod). Telnyx **accepted** the send: `{"status": "submitted", "messageId": "40319fb2-5252-473f-ae33-085d9d940baa"}`. **The founder had not yet confirmed actual receipt of the MMS when this handoff was requested.** The very next step for whoever picks this up: ask the founder "did you get the test text with the dinosaur worksheet?" — if yes, post that confirmation to #281 and close it; if no, something in the Telnyx→carrier→phone chain needs debugging (check Telnyx's dashboard for message id `40319fb2-5252-473f-ae33-085d9d940baa`'s final delivery status first). The verification script that sent it is in this session's scratchpad, not the repo — see the gotcha below for how to rebuild it if needed.
- No open branch, no open PR beyond what's already merged. `git status` on the current worktree branch (`claude/voice-materials-mms-attach`) is clean and sitting at `origin/main`.

### Known gotchas / landmines

- **This worktree has no `apps/web/.env.local` of its own.** It's gitignored per-checkout. The real one lives at `/Users/sidneyswift/Documents/Projects/Sidney/homa/apps/web/.env.local` (the main repo checkout, not this worktree). A script that does `loadEnvFile(path.join(repoRoot, "apps/web/.env.local"))` using *this worktree's* path will silently fail (ENOENT) if wrapped in a bare `try {} catch {}` with no logging — which is exactly what cost real time this session. Point env-loading scripts at the main checkout's `.env.local` explicitly, or don't swallow the exception.
- **`TELNYX_SMS_ENABLED=false` locally by design** (webhooks point at prod). To test the real transport from a local script, set `process.env.TELNYX_SMS_ENABLED = "true"` in code *after* `loadEnvFile` runs (loadEnvFile overwrites an already-exported shell value with the file's own, so a shell-level `TELNYX_SMS_ENABLED=true npx tsx ...` override gets clobbered — has to be set after the load, in code).
- **Branches in this repo keep getting cut from pre-squash local history rather than `origin/main`.** Hit twice this session (once on the voice PR, once on the orphaned-tests PR): the fix each time was `git fetch origin main` then `git rebase --onto origin/main <last-shared-commit>` to replay only the genuinely new commit. Always `git fetch origin main -q && git log origin/main..HEAD --oneline` before pushing a new branch to catch this early.
- **Node's `--test` CLI glob-matches positional file arguments, including real Next.js `[param]` route folder names.** `[token]` is valid bracket-class syntax there and matches zero files silently (exit 0, "0 tests"). Never name a bracketed-path `.test.tsx` file directly in a `check:*` script; use an import-wrapper file outside the bracketed directory instead (see `apps/web/app/onboarding/lesson-view.wrapper.test.ts` for the pattern).
- **Don't re-open the `UsageChannel` widening question inside #281.** It was tried this session, broke 6 files on typecheck, reverted, and correctly belongs to #280's scope (the "one door into Homa" tool-mechanism work), not a standalone item.
- **All 20 most-recently-created sandbox families in prod have `family_phones.phone_e164 = NULL`** (checked directly via Supabase MCP this session) — there was and is no deliverable phone number attached to any sandbox family before this session's one-off test send. That test send did not create any new database row anywhere; it called the transport function directly with a founder-provided number that exists only in this session's chat and an ephemeral scratchpad script, never persisted to the repo or the database.

## 3. Pointers

- Repo: `/Users/sidneyswift/Documents/Projects/Sidney/homa` (worktree used this session: `.claude/worktrees/openai-realtime-voice-spec-38f468`, branch `claude/voice-materials-mms-attach`, currently clean and unmerged-changes-free — safe to delete or reuse)
- Relevant PRs: [#461](https://github.com/sidneyswift/homa/pull/461) (voice turns in chat, merged), [#465](https://github.com/sidneyswift/homa/pull/465) (orphaned tests, merged), #312 (phone media-attach, merged in an earlier session)
- Relevant issues: **#281** (open, live-verification in progress — pick this up first), #287 (arc tracker), #275/#279/#280/#282 (Phase 2/3, not started), #386 (closed by #465)
- Key files touched this session: `apps/web/app/app/voice-mode.tsx`, `voice-transcript.ts`, `chat-client.tsx`, `chat-storage.ts`, `transcript-days.ts`, `lib/chat-history.ts`, `lib/chat-history-model.ts`, `lib/conversation-continuity/{ledger,postgres-repository,reply-policy}.ts`, `supabase/migrations/20260730093000_conversation_messages_modality.sql`, `apps/web/app/api/voice/realtime/turn/route.ts`, `package.json` (7 `check:*` script registrations), `apps/web/app/onboarding/{lesson-view,subject-lesson-button}.wrapper.test.ts`
- Founder-ruling index: `docs/homa-planning/journeys/10-reconciliation.md` §5
- Full arc spec: `docs/homa-planning/plans/2026-07-27-realtime-voice.md`
