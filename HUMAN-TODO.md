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

## Domain & handles — WAIT for the naming memo

An agent is researching gethoma.com vs heyhoma.com vs alternatives (availability,
social handles, Homa Games collision) right now. When the memo lands at
`homa-planning/journeys/11-naming-domain-memo.md`:

- [ ] Read the memo's recommendation (~2 min)
- [ ] **Buy the primary domain** + the 1–2 defensive redirects it lists *(5 min, ~$15–40)*
- [ ] **Register the social handles** it lists: Instagram, TikTok, Pinterest, Facebook page, X — even if empty for now (squatting protection) *(10 min)*
- [ ] Point the domain's nameservers at **Vercel DNS** (registrar → nameservers → ns1.vercel-dns.com / ns2.vercel-dns.com) *(3 min)*

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
