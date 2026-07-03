# HUMAN-TODO — tonight, before the build starts

Atomic actions only YOU can do (browser logins, 2FA, payments). Check them off.
Everything not on this list, agents handle. Est. total: ~45–60 minutes.

## Accounts & infrastructure

- [ ] **GitHub**: make `sidneyswift/homa` **private** → repo Settings → General → Danger Zone → Change visibility *(1 min — do this FIRST; it becomes the product monorepo. Agents will then: secret-scan history, tag the template as `template-archive`, and start a fresh orphan `main`. No org needed tonight)*
- [ ] **Vercel**: create team → vercel.com/new-team → name: `homa` → choose **Pro** ($20/mo, card required) *(3 min)*
- [ ] **Vercel**: same team → AI Gateway tab → buy **$20 AI Gateway credits** *(2 min)*
- [ ] **Vercel**: contact support/your Vercel contact → request **"Agent Runs" observability enablement** for team `homa` (it's gated; ask now, it can lag) *(3 min)*
- [ ] **Supabase**: create org → supabase.com/dashboard → New organization → name: `Homa` (Free plan is fine tonight; agent creates the projects via MCP tomorrow) *(2 min)*
- [ ] **Stripe**: dashboard → top-left account switcher → **Create new account** → name: `Homa` (do NOT reuse GPTWrapper/Recoup) *(3 min)*
- [ ] **fal.ai**: create a **new API key** for Homa (separate from the Mac Mini's) → fal.ai/dashboard/keys → label it `homa-cloud` → paste it somewhere safe (1Password), NOT into any repo file *(2 min)*
- [ ] **Resend**: create account → resend.com → sign up with the hello@ email plan in mind (domain verification happens AFTER domain purchase below) *(2 min)*

## Domain & handles — memo is in: `homa-planning/journeys/11-naming-domain-memo.md`

Headline: **gethoma.com and heyhoma.com are both TAKEN** (registered May 2026 and
Jan 2026 — someone is sweeping the homa-* namespace, so move tonight).
Recommendation: **homahelps.com** (+ @homahelps everywhere). Read the memo before
buying if you want the reasoning; the buy list:

- [ ] Skim the memo (~2 min) — especially the tryhoma.com trademark flag
- [ ] **Buy homahelps.com** + defensive redirects **homaandme.com** and **homa.school** *(5 min, ~$35–55/yr total)*
- [ ] **Register @homahelps** on: Instagram, TikTok, Pinterest, Facebook page, X *(10 min — do the memo's 2-min phone check for Pinterest/Facebook first, CLI checks were inconclusive there)*
- [ ] Point homahelps.com nameservers at **Vercel DNS** (registrar → nameservers → ns1.vercel-dns.com / ns2.vercel-dns.com) *(3 min)*
- [ ] If @homahelps is taken anywhere or the name doesn't sit right: the memo's runner-up is hihoma.com — decide, don't stall; the namespace is being swept

## Business

- [ ] **Entity**: pick the state (DC where you live, or WY/DE — 10 min of gut check, don't overthink; an LLC can be redomesticated later) and **start the online LLC filing** tonight (e.g., state portal or a service like Northwest ~$39+state fee). Needed for: Stripe live activation + SMS 10DLC later. *(15 min)*
- [ ] **Stripe**: once the LLC application number exists, start account activation on the new Homa account (can finish later — trial billing needs it before invite #1, not before build) *(5 min, can defer)*

## Cursor / MCP (so agents can drive services during the build)

- [ ] Cursor Settings → MCP: **fix/re-enable the GitHub MCP** (currently errored) *(2 min)*
- [ ] Cursor Settings → MCP: **fix the fal MCP** (currently errored) *(1 min)*
- [ ] Tell the agent "auth Vercel MCP" in chat — it triggers the flow, you complete the browser login *(1 min)*
- [ ] Optional: rescope the Supabase MCP token to the new `Homa` org once it exists (Settings → MCP → supabase) so agents can never touch the Recoupable prod DB *(3 min)*

## Family

- [ ] **Ask Alessa**: is the phonics curriculum "Hegg" = **Heggerty**? (last open decision, D10) *(30 sec)*
- [ ] **Show Alessa** the conference field kit → `homa-planning/journeys/09-discovery-research-plan.md` §2 — she should read it before July 13, not the night before *(send link)*

## Explicitly NOT tonight

- Supabase projects (agent, via MCP, after org exists)
- GitHub repo creation/push (agent, after org exists)
- Any code, schema, or deploy (agents)
- Google Workspace inbox (after domain; ~$7/mo, 10 min, this weekend is fine)
- Twilio/10DLC (needs the LLC — background task later)
