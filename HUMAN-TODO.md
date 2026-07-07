# HUMAN-TODO · tonight, before the build starts

Atomic actions only YOU can do (browser logins, 2FA, payments). Check them off.
Everything not on this list, agents handle. Est. total: ~45–60 minutes.

## Accounts & infrastructure

- [x] **GitHub**: make `sidneyswift/homa` **private** → repo Settings → General → Danger Zone → Change visibility *(verified private via gh CLI 2026-07-03)*
- [x] **Vercel**: create team → vercel.com/new-team → name: `homa` → choose **Pro** ($20/mo, card required) *(team `Homa` verified via MCP; plan tier not agent-verifiable)*
- [ ] **Vercel**: same team → AI Gateway tab → buy **$20 AI Gateway credits** *(2 min)*
- [ ] **Vercel**: contact support/your Vercel contact → request **"Agent Runs" observability enablement** for team `homa` (it's gated; ask now, it can lag) *(3 min)*
- [x] **Supabase**: create org → supabase.com/dashboard → New organization → name: `Homa` *(verified via MCP; `homa-prod` project already live, Postgres 17, us-east-1)*
- [x] **Stripe**: dashboard → top-left account switcher → **Create new account** → name: `Homa` (do NOT reuse GPTWrapper/Recoup) *(done 2026-07-06: account live, charges_enabled true; pricing v1 products + payment links exist in BOTH environments per build-log)*
- [ ] **fal.ai**: create a **new API key** for Homa (separate from the Mac Mini's) → fal.ai/dashboard/keys → label it `homa-cloud` → paste it somewhere safe (1Password), NOT into any repo file *(2 min)*
- [x] **Resend**: account created, `mail.thankshoma.com` added and fully verified (DKIM, SPF, DMARC, click+open tracking all green), `RESEND_API_KEY` in `apps/web/.env.local` + Vercel production *(done 2026-07-04)*

## Domain & handles · memo is in: `docs/homa-planning/journeys/11-naming-domain-memo.md`

**DECIDED 2026-07-04: bought thankshoma.com.** Domain is live on Vercel project
`homa` (team Homa) with nameservers already on Vercel DNS; www redirects to apex.
The site + waitlist are LIVE at **https://thankshoma.com** (+ /conference for the
QR code). Remaining handle work:

- [ ] **Register @thankshoma** on: Instagram, TikTok, Pinterest, Facebook page, X *(10 min, do the memo's 2-min phone check for Pinterest/Facebook first)*
- [ ] Optional defensive redirects if still available: homaandme.com, homa.school *(memo's list; cheap insurance)*

## Marketing demand engine · spec: `docs/homa-planning/14-marketing-demand-engine.md`

- [ ] **Postiz**: run `postiz auth:login` in a terminal (browser flow) so agents can stage/schedule social posts *(1 min)*
- [ ] **Postiz**: after registering the @thankshoma handles (above), connect each account inside Postiz: TikTok, Instagram, Pinterest, Facebook page, YouTube, X *(10 min)*
- [ ] **YouTube**: create the @thankshoma channel (needed for Shorts; not in the original handle list) *(5 min)*
- [ ] **Ruling DM7**: waitlist form promises "email only used to send your invite". Pick: (a) pipeline emails stay invite/launch-scoped, or (b) update form copy to ask ongoing-content consent going forward. Until ruled, emails are staged, never sent *(2 min gut check)*

## Business

- [ ] **Entity**: pick the state (DC where you live, or WY/DE, 10 min of gut check, don't overthink; an LLC can be redomesticated later) and **start the online LLC filing** (e.g., state portal or a service like Northwest ~$39+state fee). Needed for: Stripe live activation + SMS 10DLC later. **Deferred, not tonight** (2026-07-04 grilling decision): file it when it actually blocks something (Stripe activation, ahead of invite #1), not before. *(15 min, whenever)*
- [ ] **Stripe**: once the LLC application number exists, finish full activation paperwork on the Homa account (charges_enabled went true 2026-07-06; the LLC-backed activation is what remains, trial billing needs it before invite #1, not before build) *(5 min, can defer)*

## Cursor / MCP (so agents can drive services during the build)

- [x] ~~Cursor Settings → MCP: fix/re-enable the GitHub MCP~~ **Not needed**, agent uses `gh` CLI instead (admin/push access verified 2026-07-03)
- [ ] Cursor Settings → MCP: **fix the fal MCP** (currently errored) *(1 min)*
- [x] Tell the agent "auth Vercel MCP" in chat, it triggers the flow, you complete the browser login *(verified: MCP lists Homa team + projects)*
- [x] Optional: rescope the Supabase MCP token to the new `Homa` org once it exists (Settings → MCP → supabase) so agents can never touch the Recoupable prod DB *(verified: token now sees ONLY the Homa org)*

## Family

- [ ] **Ask Alessa**: is the phonics curriculum "Hegg" = **Heggerty**? (last open decision, D10) *(30 sec)*
- [ ] **Show Alessa** the conference field kit → `docs/homa-planning/journeys/09-discovery-research-plan.md` §2, she should read it before July 13, not the night before. **Re-scoped 2026-07-04**: no booth, phone-based capture only, no Stripe preorder ask, commitment ladder stops at "get her email on the waitlist." *(send link)*
- [ ] **Tell Alessa the link**: say "thankshoma.com" out loud to moms, or text it; the free progress report at thankshoma.com/onboarding is the front door (old /waitlist links still redirect there) *(30 sec)*

## Explicitly NOT tonight

- Supabase projects (agent, via MCP, after org exists)
- GitHub repo creation/push (agent, after org exists)
- Any code, schema, or deploy (agents)
- Google Workspace inbox (after domain; ~$7/mo, 10 min, this weekend is fine)
- Twilio/10DLC (needs the LLC, background task later)
