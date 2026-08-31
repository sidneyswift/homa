# Mobbin cross-check: kids/education apps + paywall sequence patterns

Source: Mobbin MCP (independent second source from the Appllama pull covering
language-learning/fitness/health/plant/AI/photo categories). Four queries run:
(1) "onboarding with personalization quiz leading to paywall", (2) "kids
education app onboarding for parents", (3) "subscription paywall with pain
point questions and stats before pricing", (4) screen search for "paywall
screen with three pricing tiers and free trial". Roughly 15 flows (150+
screens, sampled) and 15 additional standalone paywall screens were examined
via inline images.

Citation note: Mobbin's `search_flows` tool only returns one clickable
`mobbin_url` per flow (not per screen), so flow-sourced screens below are
cited as "[App flow](flow url), screen N of M" and described by what's
visible in that position. Screens found via `search_screens` (the pricing-tier
section) each have their own `mobbin_url` and are cited directly.

## Kids / education / parenting apps found

**GoHenry** (parent-managed debit card + money app for kids): 24-screen
flow: [GoHenry onboarding](https://mobbin.com/flows/24719932-c82c-4512-a140-d4421b8b7d78).
Opens with a feature-forward hero ("Money skills unlocked," app screenshots,
screen 1) and a direct "Parent sign up / Log in" choice, no quiz. Then
straight into account creation: create a password (screen 2), display name
(screen 3), child's date of birth (screen 4), then a "let's verify your
identity" KYC screen (screen 5, explicitly labeled "not a credit check"). This
resembles Homa's own current flow: account-first, functional/data-collection
screens, no persuasion theater. No pain-point or stats screens appeared in
the sampled frames.

**Greenlight** (debit card + financial literacy app for kids): 23-screen
flow: [Greenlight onboarding](https://mobbin.com/flows/5720c3bb-2534-4830-9917-e51bd2bdb417).
Teal splash, then straight to functional setup: an SMS confirmation-code
screen that embeds a single testimonial quote ("I love Greenlight... as a mom
of 4 kids...") directly inside a functional verification step rather than as
its own dedicated social-proof screen, then child account setup, "confirm
your information," and a "wait while we secure your information" loading
screen. Same pattern as GoHenry: account-first, functional, no
quiz/persuasion sequence. The one social-proof element is folded into a
functional screen rather than treated as its own beat.

**Spotify Kids**: about as minimal as onboarding gets: [Spotify Kids
onboarding](https://mobbin.com/flows/1a3f9a8c-6ca2-45cd-aae7-7124088623ec).
Splash → "Do you have a Family account with Spotify?" Yes/No → log in to the
family account → "Required: Set a PIN" (parental gate) → "Let's set up a Kids
account" (name + birthday). Zero persuasion, zero quiz, no paywall screen in
this flow at all (the kids product rides on the parent's existing Spotify
subscription).

**Kit** (built by Commonwealth Bank: banking app for kids), [Kit
onboarding](https://mobbin.com/flows/cee1ecf7-1751-41bf-ac81-887efb909f3b).
Splash → email/password account creation with a live password-strength
checklist → mobile OTP verification → "Let's add your kid to Kit" (name,
last name, age). Banking-grade, fully functional/account-first, no
persuasion sequence at all.

**Duolingo ABC** (Duolingo's kids reading app): [Duolingo ABC
onboarding](https://mobbin.com/flows/63b774b7-a199-4a57-8bee-54ec27c551a4),
the one kids app in the sample that leans toward lightweight personalization:
colorful mascot splash → role split "Who's learning to read?" (My kids vs.
My students) → "How old is [name]?" → an avatar/character picker for the
child → straight into the game map. This is a real personalization step
(role + age + avatar), but it is short (3 personalization screens, no pain
points, no stats, no visible paywall in the 16 sampled screens) and clearly
aimed at being fun for the child, not persuasive for the parent.

**Acorns Early** (investing-for-kids add-on inside Acorns, not standalone
onboarding), [Early invest tour](https://mobbin.com/flows/ef70ab0e-70df-4b29-af96-ffa2b78baa72)
and [smart money app for kids](https://mobbin.com/flows/efa88629-34b3-43a7-9c6f-c34a8c57319f).
This is an in-app upsell shown to existing Acorns subscribers, not fresh-user
onboarding: "Invest Early for their future" → "Enjoy easy, flexible
investing" → a genuine stats/social-proof screen, "More than 350,000 kids!"
Notable because it's the one place in the kids-app sample that uses a stat
screen right before a paywall-adjacent upgrade CTA, but it's an upsell flow
bolted onto an already-paying adult, not new-user acquisition onboarding.

**Tubi Kids**: [adding a kids account](https://mobbin.com/flows/1bdb8ffe-567d-4035-ad49-88ea16ebdedf)
to an existing Tubi account: "Add a Kids Account" → content-rating selector →
kid's home screen. Purely functional, free product, no paywall.

**Verdict on this section:** every genuine kids/parenting app found (GoHenry,
Greenlight, Spotify Kids, Kit, Tubi Kids) matches Homa's own current
pattern, account-first, functional/data-collection screens, no persuasion
theater, not the article's model. Duolingo ABC is the partial exception,
with light personalization (role, age, avatar) but still no persuasion
sequence, pain points, or stats. None of the kids apps ran the full
identity→desire→pain→proof→paywall sequence the article describes.

## Paywall sequence pattern check

Across everything searched (four queries, ~15 flows, ~150 sampled screens,
plus 15 standalone paywall screens), nothing came close to the article's
full, exact sequence (identity → context → desire → investment → trust →
permission → 4 distinct pain-point angles → personalizing loader → 2 stats
screens → paywall). The closest partial matches:

- **Life Reset** (self-improvement): [Life Reset onboarding](https://mobbin.com/flows/e91bc9a4-db92-449a-8de2-2d5e81381f6b).
  A confidence slider on a felt pain point ("How confident are you that you
  can stick with a daily routine for 7 days?") is followed by a
  testimonial/story screen showing a real user's day-by-day journal, then a
  personalized-insight reveal screen: **"You're carrying more mental weight
  than you let on - and you've been managing it mostly on your own,"**
  explicitly framed "Based on your answers." This is the single best analog
  to the article's pain-amplification + "we heard you" beats we found
  anywhere in the Mobbin pass, but it's one composite insight screen, not
  four distinct pain-point angles, and we didn't see dedicated stats screens
  before its paywall in the sampled frames.
- **Calm Sleep**: [Calm Sleep quiz-to-paywall flow](https://mobbin.com/flows/6057bb13-1765-48cc-8cfa-09b0ef8e7107).
  Quiz screens ("How does your bedroom feel when you sleep?") lead straight
  into a multi-tier paywall, and only *after* the paywall does it ask "How
  did you hear about Calm?" - the reverse of the article's claim that
  attribution/referral belongs early in the sequence.
- **Uxcel Go**: [Uxcel Go onboarding](https://mobbin.com/flows/61fe3178-f6cc-4817-b596-9648f808aac4).
  Name/role/referral → use-case selection → a reminder-time "investment"
  screen → straight to a tiered paywall with a "Most popular" badge. No
  pain-point screens, no stats screens, no personalizing loader, roughly a
  4-screen compressed version of the article's first half, with none of its
  back half.
- **Skillshare**: [Skillshare onboarding](https://mobbin.com/flows/74cad4ce-4680-4706-a02e-4f49fad5db0b).
  Hero → topic multi-select → straight to a simple two-tier paywall, then an
  app tour, then home. No pain points, no stats, no trust screen.
- **Life Reset** and **Calm** (the main app, not Calm Sleep) both also show
  fake-progress-adjacent moments (a "take a deep breath" transition screen
  for Calm at [this flow](https://mobbin.com/flows/38549b00-2fe8-4fd1-914b-13c4905db245))
  but neither stacks it with pain points and stats in the article's order.
- Standalone paywall screens examined via `search_screens`: [The
  Outsiders](https://mobbin.com/screens/65112b07-4e73-4a48-a3f5-0a83e895108e),
  [Buddy](https://mobbin.com/screens/d81d0d25-b0c2-4138-a32e-759950886662),
  [Liven](https://mobbin.com/screens/a612cffd-939d-471f-9b89-bf734058ab1a),
  [DailyArt](https://mobbin.com/screens/9ab25919-5957-45e3-b2d7-bfcf713bbb79),
  [Me+](https://mobbin.com/screens/133916b2-f8bd-439d-b7a4-cb8b07193a64),
  [Rocket Money](https://mobbin.com/screens/50401be4-6845-434a-989c-153bf925170f),
  [5 Minute Journal](https://mobbin.com/screens/2494e11b-8fbf-480c-8e33-4bb736f176c3),
  [Tide Guide](https://mobbin.com/screens/0a7fe4f5-58f1-46f5-a498-af07baa409fe),
  [Babbel](https://mobbin.com/screens/be51c800-b274-43d6-afd5-28e434cda0cf),
  [MacroFactor](https://mobbin.com/screens/906ecfd5-57e8-4e88-bdf3-a5af93147455),
  [TradingView](https://mobbin.com/screens/d9cb4cf0-ba48-4ac1-b356-e55ebff81d52),
  [Moonlitt](https://mobbin.com/screens/3788e900-4f9e-4808-a44b-cb5f493ab2fc),
  [Ahead](https://mobbin.com/screens/ab9b14ae-3190-4b25-88a7-dde132a40572),
  [Calm](https://mobbin.com/screens/4c9d15dc-9785-4a9b-8c1f-64a17d5c1e27), and
  [ABY Journal](https://mobbin.com/screens/65f1ef09-8067-43b6-a2d0-2210febda055), 
  show plenty of individual persuasion *elements* the article describes in
  isolation (star ratings, "Loved by" tags, trial timelines, feature
  checklists, "pay what you think is fair" pricing), but every flow we could
  see the lead-up for compresses to somewhere between 2 and 9 screens before
  the offer, not the article's roughly 13 pre-paywall screens.

**This absence is itself a finding**: across two independent research passes
(Appllama's top-revenue apps and Mobbin's differently-curated library), we
found zero real shipped apps that run the article's exact full sequence.
Individual elements of it (a felt-pain quiz question, a personalized insight
reveal, a stats-and-social-proof screen, a fake-progress loader) each show up
somewhere, but no single app stacks all of them in the specified order at the
length the article describes.

## Verdict for our spec

- Mobbin surfaced real kids/parenting comparators that Appllama's top-grossing
  single-app-per-category pull could not, because those apps are rarely the
  #1 revenue app in a broad category: GoHenry, Greenlight, Spotify Kids, Kit,
  and Tubi Kids. Sidney should look at **GoHenry and Greenlight specifically**
, both are parent-facing, financial/trust-sensitive, multi-child-account
  products, structurally the closest thing to Homa's actual product shape
  (parent onboards, then manages child profiles) of anything found in either
  research pass.
- The strongest signal from this whole cross-check: every real kids/parenting
  app onboarding we found is account-first and functional, which directly
  matches Homa's current approach rather than the article's persuasion-first
  model. That's real evidence the article's sequence is a category norm for
  consumer-habit/self-improvement subscription apps (fitness, meditation,
  language, nutrition), not something kids/parenting apps have converged on.
- Duolingo ABC is the one kids app with any onboarding personalization (role,
  age, avatar), and it's still lightweight, kid-facing, and paywall-free in
  what we could see, worth a closer look if Homa wants a "just enough
  personalization to feel tailored" middle ground, without adopting the
  article's pain-amplification apparatus.
- Acorns Early's "More than 350,000 kids!" stat screen is the one place in
  either research pass where a stats/social-proof screen sits directly next
  to a kids-context upgrade CTA, but it's an upsell to an already-paying
  adult, not new-user acquisition, so it doesn't validate the article's use
  of stats screens on cold traffic.
- Against the article's claim that this is "not specific to one app or one
  niche" and "works for any subscription app": the evidence argues against
  that being a general law. We could not find one single shipped app, in
  either the Appllama pass or this Mobbin pass, that implements the complete
  sequence at the length and order described. The individual persuasion
  techniques are real and common; the specific 17-screen assembly appears to
  be this one app's A/B-tested result, not an industry-standard playbook, 
  and it has essentially zero precedent among kids/parenting apps
  specifically.
