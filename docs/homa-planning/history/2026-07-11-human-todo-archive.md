# Historical founder setup checklist · archived 2026-07-11

> Historical snapshot only. Do not execute these steps without re-verifying the
> current provider, repository, migration, and production state. Completed and
> superseded entries are preserved as dated history. Private contact and family
> details are redacted. The action queue moved to GitHub Issues on
> 2026-07-25 (founder directive; `HUMAN-TODO.md` no longer exists). See
> `AGENTS.md` § Tickets and issue tracking.

Atomic actions only YOU can do (browser logins, 2FA, payments). Check them off.
Everything not on this list, agents handle. Est. total: ~45–60 minutes.

## Accounts & infrastructure

- [x] **GitHub**: make `sidneyswift/homa` **private** → repo Settings → General → Danger Zone → Change visibility *(verified private via gh CLI 2026-07-03)*
- [x] **Vercel**: create team → vercel.com/new-team → name: `homa` → choose **Pro** ($20/mo, card required) *(team `Homa` verified via MCP; plan tier not agent-verifiable)*
- [ ] **Vercel**: same team → AI Gateway tab → buy **$20 AI Gateway credits** *(2 min)*. **Now also funds worksheet illustrations (2026-07-10)**: the studio's `generate_image` tool bills GPT Image 2 through this same gateway, no separate provider or key.
- [ ] **Vercel**: contact support/your Vercel contact → request **"Agent Runs" observability enablement** for team `homa` (it's gated; ask now, it can lag) *(3 min)*
- [x] **Supabase**: create org → supabase.com/dashboard → New organization → name: `Homa` *(verified via MCP; `homa-prod` project already live, Postgres 17, us-east-1)*
- [x] **Stripe**: dashboard → top-left account switcher → **Create new account** → name: `Homa` (do NOT reuse GPTWrapper/Recoup) *(done 2026-07-06: account live, charges_enabled true; pricing v1 products + payment links exist in BOTH environments per build-log)*
- [x] ~~**fal.ai**: create a new API key~~ **superseded 2026-07-10**: the worksheet studio's illustrations moved off fal.ai onto GPT Image 2 through the AI Gateway (see the Gateway credits item above), so no fal.ai key is needed. The leftover `FAL_API_KEY` in `apps/web/.env.local` is now unused; safe to remove whenever.
- [x] **Resend**: account created, `mail.thankshoma.com` added and fully verified (DKIM, SPF, DMARC, click+open tracking all green), `RESEND_API_KEY` in `apps/web/.env.local` + Vercel production *(done 2026-07-04)*

## Telnyx voice + text (experiment, build-log 2026-07-07)

The historical entry recorded a private Homa phone number and Telnyx account state. The number is redacted here. The account claims were observations from 2026-07-07 and are not current evidence.

- [x] **Quick unblock so calling works from YOUR phone**: founder's cell verified via API 2026-07-07; calls from it now connect to Homa. Trial still prepends a "this is an automated call on the Telnyx platform" disclaimer and caps calls at 10 min; both go away on upgrade *(done)*
- [x] ~~Flip texting on~~ done 2026-07-07: `TELNYX_SMS_ENABLED=true` set in Vercel prod, channel deployed and live (webhook verified: forged posts get 401). Texting now waits ONLY on the steps below; no more code or deploys needed.
- [x] ~~Upgrade the account~~ done (founder-confirmed 2026-07-09, corroborated: $26.48 funded balance, 10DLC brand VERIFIED + campaign ACTIVE, both only possible past trial). Texting any US number is unblocked; the old error-40010 carrier block is history.
- [x] ~~Fill `TELNYX_SP_*` / verify the PIN~~ SUPERSEDED 2026-07-10: the account upgrade path delivered a VERIFIED brand and ACTIVE campaign without sole-prop registration; texting any US number works and has been live for a day. Nothing left here.

## Worksheet studio (added 2026-07-10, agent-built, fully wired)

- [x] ~~Vercel Blob store~~ done by agent 2026-07-10: `homa-artifacts`
  (public, iad1) created and linked; `BLOB_READ_WRITE_TOKEN` is in all
  three Vercel environments and `apps/web/.env.local`
- [x] ~~Illustration provider~~ done by agent 2026-07-10: switched from
  fal.ai to GPT Image 2 through the Vercel AI Gateway, so no new key or
  vendor account is needed; it rides the same Gateway credits as chat.
- [ ] **Try the loop on your phone** once texting is live: text Homa "make
  Story a letter O worksheet, Paw Patrol style", wait for the picture +
  PDF, then reply with a critique and watch the remake *(2 min, fun)*

## Agentic learning loops (added 2026-07-09, ladder build)

- [x] ~~Re-provision both voice assistants~~ done by agent 2026-07-09 afternoon (founder "do all of this"): both assistants synced twice, now carrying `send_email` + `remember` + `log_hours` with updated call instructions
- [x] ~~Vercel prod env check~~ verified 2026-07-09: `TELNYX_API_KEY` and `TELNYX_CURRICULUM_ASSISTANT_ID` both present in Production
- [ ] **THE LAST SWITCH · Journal prompt read-aloud**: everything else in the gateway is live and prod-verified (2026-07-10 evening). The evening prompt is COMPOSED BY THE AGENT per family and delivered by text (linked line) or the approved email shell; the fixed frame (subject "One thing from today?", preview, CTA, stop line in `apps/web/lib/map/email.ts` `sendJournalAgentEmail`) is what to read aloud. If it passes: `printf 'true' | vercel env add JOURNAL_PROMPT_ENABLED production` then redeploy (or tell an agent "flip the journal flag"). The hourly dispatcher cron is already mounted and seeds families automatically *(2 min)*
- [x] ~~Confirm hello@thankshoma.com alias~~ SUPERSEDED 2026-07-10: every Homa email's reply-to is now `homa@mail.thankshoma.com`, which routes into the agent (prod-verified). The Google Workspace alias is optional now, purely a human-contact nicety
- [ ] **Historical duplicate-family decision:** private addresses and family state are redacted. Re-verify privately before any destructive action.
- [ ] **Optional cost lever**: set `HOMA_EXTRACTION_MODEL` in Vercel prod to a cheaper gateway model id for the background memory loops, and `HOMA_EMBEDDING_MODEL` if you ever want something other than `openai/text-embedding-3-small` for semantic recall

## Homa's tasks + nightly research (added 2026-07-10 late night, agent-built, E2E-verified)

The task framework, fleet research, morning brief, and the Homa's tasks
tab are BUILT and live-E2E green (build-log 2026-07-10 boil-the-ocean
entry). The tab is visible now; the two proactive loops wait on your
switches, in this order:

- [x] ~~Deploy~~ done 2026-07-11 2:32am (founder "do both"): commit
  6116cb4 deployed, `vercel crons ls` shows the fleet cron (47 6 * * *)
  beside the hourly dispatcher
- [x] ~~Flip fleet research~~ done 2026-07-11 2:28am: flag live, and the
  first production run at 2:47am merged 3 cited rows (executive
  function, art, fine motor) picked by real family demand. Knob if
  wanted: `RESEARCH_TOPICS_PER_NIGHT` (default 3)
- [x] ~~The brief switch~~ done 2026-07-11 2:28am (founder flipped both
  without the dev read-aloud; the E2E briefs in the build session were
  the read). Founder follow-up "have the brief go out tomorrow": rows
  seeded at Saturday 9am ET as a one-time exception, then the Mon-Fri
  rhythm takes over on its own. First texts: Sat Jul 11, 9am. After the
  multi-parent fold (same night, other work stream) the household is
  ONE family with both parents and both phones, so the brief texts
  Sidney AND Alessa; Gomes gets it too. The old "Llanes skipped"
  eligibility note is obsolete: her account and the report now live in
  the same family

## Thank-you cards (added 2026-07-11; UPDATED 1am: key live, ONE switch left)

One real handwritten card (robot, actual pen) mails to each family 48h
after web onboarding, once ever per family
(plans/2026-07-11-thank-you-cards.md). Done tonight by founder + agent:
account + API key created, return address saved via the API, stationery
chosen (Kraft Thank You, card 186, font hwDavid "Casual David"; swap
anytime by changing the env vars), all five env vars set in Vercel
production (key encrypted). The sweep refuses to run unless
HANDWRYTTEN_TEST_MODE="false" AND the vendor account is in live mode,
so a test order can never burn a family's once-ever card. Left, in
order:

- [ ] **Billing check**: app.handwrytten.com → your name → payment
  methods → confirm a credit card is on file. The account shows a
  billing address but zero saved cards; without one, live orders fail
  (they park safely as 'failed' after 3 tries, no crash) *(1 min)*
- [ ] **Read the card aloud once**: the exact text is in
  `apps/web/lib/cards/message.ts` (both copy gates passed; you are the
  last gate). Signature reads "Warmly, Sidney, founder of Homa" *(1 min)*
- [ ] Optional dry run: flip the ACCOUNT to test mode (their
  Integrations page), tell an agent "run the Handwrytten smoke send",
  expect "order accepted", then flip the account back to live. Fine to
  skip: the first real batch is 3 known addresses, one of them yours,
  so you will literally receive the proof in the mail *(3 min)*
- [ ] **THE SWITCH** (after the July 13 conference deploy):
  `printf 'true' | vercel env add THANK_YOU_CARDS_ENABLED production`
  then redeploy. Within the hour the 3 already-eligible families queue
  and send for real (two DC, one FL; ~$14 total), then new families
  follow automatically 48h after onboarding, capped at 150/month.
  Cards land 4 to 7 days later *(2 min)*

## The wall (added 2026-07-11 pre-dawn; BUILT and DARK, do NOTHING before the July 13 conference)

The paywall is built and ships dark behind `HOMA_WALL_ENABLED`
(plans/2026-07-11-the-wall.md). Door-tap analytics are already live so
you collect baseline data this weekend with zero visible change. When
Phase D says go, in this order:

- [ ] **Stripe Payment Links (monthly $19 + annual $99)**: edit both
  links in the dashboard → add a **30-day free trial**, and set the
  after-completion redirect to
  `https://thankshoma.com/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`
  *(5 min)*
- [ ] **Stripe trial reminder emails**: Settings → Subscriptions and
  emails → turn on the "upcoming trial expiration" email. The wall copy
  promises "you get an email first"; this is that email *(2 min)*
- [ ] **Vercel env**: confirm `NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL`,
  `..._ANNUAL_URL`, and `STRIPE_LIVE_SECRET_KEY` are set in Production
  (keys went in 2026-07-06; the two link URLs may be missing) *(3 min)*
- [ ] **Apply migration 20260711200000** (additive, safe to lead): tell
  an agent "apply the family billing migration" or run it via MCP *(1 min)*
- [ ] **Pricing on the site, same deploy as the flip**: the FAQ promises
  "pricing gets published before anyone pays a cent." Tell an agent to
  build the pricing section/page before or with the flip, never after
  *(agent work, your read-aloud)*
- [ ] **Read the wall aloud once**: all wall words live in
  `apps/web/components/billing/wall-copy.ts` (both copy gates run; you
  are the last gate). One review flag stands: $99/yr is Homeschool
  Fox's exact annual sticker (T3 collision), decide if it becomes
  $119 to $149 before it goes public *(3 min)*
- [ ] **THE SWITCH** (Phase D, after PRD §7 gates):
  `printf 'true' | vercel env add HOMA_WALL_ENABLED production` then
  redeploy. Test end to end with a fresh family + Stripe TEST link
  first (set the TEST link envs on a preview) incl. cancel *(15 min)*
- [ ] **Comping a family** (you, Alessa, testers): set
  `billing_exempt = true` on their families row (tell an agent) *(30 sec)*

## Email-into-Homa (gateway GW-8, added 2026-07-09 late evening)

The inbound email adapter is BUILT and E2E-verified (a reply to a Homa
email becomes a real agent turn; "stop" opts the family out of evening
check-ins). It stays dark until these three land, in order:

- [x] ~~Resend inbound MX~~ done by agent 2026-07-09 9:21pm: `mail` MX → `inbound-smtp.us-east-1.amazonaws.com` priority 10 added via `vercel dns`, resolving publicly. Resend's Domains page should flip to verified on its next check (hit refresh there if it still says Not Started)
- [x] ~~Resend inbound webhook~~ founder pasted it 2026-07-09 ~9:23pm (`email.received` event only)
- [x] ~~Reply-to flip~~ deployed 2026-07-09 late: every Homa email's reply-to is `homa@mail.thankshoma.com`, so replies land in the agent. The whole email loop is LIVE end to end; test anytime by emailing that address from your registered family email

## Domain & handles · memo is in: `docs/homa-planning/journeys/11-naming-domain-memo.md`

**DECIDED 2026-07-04: bought thankshoma.com.** Domain is live on Vercel project
`homa` (team Homa) with nameservers already on Vercel DNS; www redirects to apex.
The site + waitlist are LIVE at **https://thankshoma.com** (+ /conference for the
QR code). Remaining handle work:

- [ ] **Google Search Console**: add a Domain property for `thankshoma.com` (DNS TXT record, Vercel DNS makes this 2 min) → then Sitemaps → submit `https://thankshoma.com/sitemap.xml`. This is the single biggest crawl/index accelerator only a human can do *(5 min)*
- [ ] **Bing Webmaster Tools**: import the site from Search Console (one click after GSC exists); covers Bing + Copilot + DuckDuckGo *(2 min)*
- [ ] **Register @thankshoma** on: Instagram, TikTok, Pinterest, Facebook page, X *(10 min, do the memo's 2-min phone check for Pinterest/Facebook first)*. When done, tell the agent to add the profile URLs to the Organization schema's `sameAs` (entity trust signal)
- A private phone number was recorded here for account verification. It is redacted and must stay off public surfaces.
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

## Mobile app (added 2026-07-07, all "whenever it blocks something")

- [ ] **Google sign-in on mobile**: Supabase dashboard → Auth → URL Configuration → add `homa://**` to Redirect URLs, then tell an agent to wire `expo-auth-session` *(2 min; email/password works without this)*
- [ ] **TestFlight/store, when that day comes**: Apple Developer Program ($99/yr) + Google Play ($25 once), then `npx eas init` login in `apps/mobile` *(agents handle EAS config after)*

## Family

- [ ] **Ask Alessa**: is the phonics curriculum "Hegg" = **Heggerty**? (last open decision, D10) *(30 sec)*
- [ ] **Show Alessa** the conference field kit → `docs/homa-planning/journeys/09-discovery-research-plan.md` §2, she should read it before July 13, not the night before. **Re-scoped 2026-07-04**: no booth, phone-based capture only, no Stripe preorder ask, commitment ladder stops at "get her email on the waitlist." *(send link)*
- [ ] **Tell Alessa the link**: say "thankshoma.com" out loud to moms, or text it; the free progress report at thankshoma.com/onboarding is the front door (old /waitlist links still redirect there) *(30 sec)*

## Explicitly NOT tonight

- Supabase projects (agent, via MCP, after org exists)
- GitHub repo creation/push (agent, after org exists)
- Any code, schema, or deploy (agents)
- Google Workspace inbox (after domain; ~$7/mo, 10 min, this weekend is fine)
- ~~Twilio/10DLC (needs the LLC, background task later)~~ superseded: Telnyx sole-prop 10DLC needs no LLC, see the Telnyx section above
