# Journeys 02 — Acquisition & Activation (discover → land → sign up → wow → week one)

> Workstream 2 of 5. Replaces and deepens J1 in `02-user-journeys.md`. Built on the
> council's **onboarding inversion** (09 §strong-consensus #1): the 3-minute wow comes
> first, the 15-minute questionnaire becomes the week-one drip. Personas by code per
> `journeys/00-pm-kickoff.md`. Methods: journey-map, aha-moment, onboarding-redesign,
> friction-reduce (pm-os).
>
> Conventions: phone-first always (she is standing in a kitchen holding a 4-year-old).
> All example copy obeys brand law: sentence case, no em dashes, reassure before inform,
> name the child, offer never command, ≤1 emoji, contractions. Tags: [M-R] invite-gated
> revenue cohort, [GA] public launch, [POST-GA].
>
> **Design-system consistency note.** These journeys build on `docs/homa-design/` (M1-17)
> and explicitly improve three things in the existing kits: (1) `Onboarding.jsx` collects
> grade via select; we collect birth month + year instead because age bands drive
> benchmarks and grade is ambiguous for homeschoolers. (2) `Onboarding.jsx` has a
> "map to my state's standards" toggle; we remove it — standards mapping is the product,
> defaulted on, revealed at the benchmark moment, never a checkbox decision at minute 1.
> (3) `LandingPage.jsx` shows $9/$19/$39 pricing, a "Start free for 14 days" CTA, and
> "Loved by 12,000+ homeschooling families" — all three conflict with the brief
> ($29/$49), the invite gate [M-R], and honesty (we have ~1 family). Flagged in ❓ and
> ticket mapping. Everything else (card-on-cream layout, dots progress, `Callout` "a
> note from HOMA", `Skeleton` wait pattern, check-off celebration) is adopted as spec.

---

## Part 1 — Discovery → signup, one journey per channel

Four acquisition journeys share one destination (the activation flow in Part 2) but
differ in what she saw, what she fears, and what the landing page must prove in 30
seconds. The invite gate [M-R] is the same mechanism everywhere: a code embedded in the
URL, never typed by hand on the happy path; no code ⇒ waitlist, not a dead end.

### Journey A1 — Conference QR / waitlist [M-R]

**Frame.**
- Persona: P2 primary (the conference-mom ask was hours tracking), P4 secondary.
- Trigger: she stopped at the booth, watched Alessa's 90-second demo (M0-07 kit), or
  grabbed a flyer from a friend's tote bag on the drive home.
- Job story: *When I see a live demo of a worksheet made for a specific kid at a
  conference, I want to lock in access before the weekend blurs together, so I can try
  it on my own kids when I'm home.*
- Entry channel: QR code on booth banner/flyer → `homa.app/i/{CONF_CODE}` with the
  invite pre-applied in the URL.

**What she saw:** a real printed worksheet with a child's name and favorite animal on
it, a dashboard on a phone, a mom (Alessa) saying "it runs my homeschool." Physical
proof, human vouching. Highest-trust channel we have.

**What she fears:**
- Another $15/mo subscription she'll forget to cancel (she already pays for two).
- "AI + my kid's data" without a plain answer on where the data goes.
- That the demo kid was a setup and it won't work for *her* kids.
- Conference-buy remorse: she has bought curriculum at a booth before and regretted it.

**What the landing page must prove in 30 seconds:**
1. This is the thing from the booth (visual continuity: same worksheet sample, same
   promise line "You've got this. HOMA's got the rest.").
2. A real artifact, not stock: an actual generated worksheet image with a child's name
   visible, plus one before/after metric line ("counting: up 2 levels since March").
3. The child never uses it: "the checklist is for you, never a test for your kid."
4. Privacy in one sentence: "your family's data is never used to train AI models, and
   you can export or delete everything anytime."
5. Price honesty up front: "$29 a month when you're ready. Free to start, no card."
6. Who built it: "built by a homeschool family" with a real photo, not an avatar pile.

**Invite-code flow [M-R]:** QR URL carries the code. Landing shows a slim banner:
"you're invited · conference cohort · 23 spots left" (real number, or omit the count).
CTA is "Claim your invite". If the cohort is full or the code expired: the same page
becomes a waitlist form (email + state + kids' ages) with honest copy: "we're letting
families in a few at a time so every family gets real attention. You're on the list."
Waitlist data feeds cohort prioritization (state coverage, age fit).

**Stage table.**

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional state | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| Booth moment | Demo, flyer, banner QR | Watches demo, scans QR or pockets flyer | (Offline) M0-07 kit: demo script, printed samples | 2–5 min | Curious, slightly skeptical | QR doesn't scan in hall lighting; flyer forgotten | Printed sample worksheet she can keep, with the QR on it |
| Scan → landing | Phone camera → `homa.app/i/CONF26` | Skims hero, scrolls once | Conference-variant hero, invite banner, code pre-applied | 20–60 s | "Is this the booth thing? Oh, it is" | Page slow on hall wifi; generic hero breaks continuity | "You found us at {conference}" line; the same sample from the booth |
| Decide | CTA, pricing line, privacy line | Taps "Claim your invite" or bails to "save for later" | Nothing clever; one CTA, one secondary "email me this link" | 10–30 s | Hopeful, guarding her wallet | Fear of hidden card requirement | "Free to start, no card" directly under the CTA |
| Deferred return | Email-me-this-link, flyer at home | Opens link Sunday night at home | Link keeps invite attached for 14 days | 0–3 days | Tired, lower intent | Invite context lost; she forgets entirely | Saved-link email subject: "your Homa invite from {conference} (kept your spot)" |
| → signup | Auth screen | Continues to Part 2 flow | — | — | — | — | — |

**The moment that decides:** the *hall-wifi skim*. She gives the page one scroll while
standing up. If the page doesn't visually match the booth and answer "card?" and "my
kid's data?" in that scroll, the flyer goes in the conference bag graveyard. The
"email me this link" escape hatch is load-bearing: conference intent is real but
deferred, and we'd rather own the reminder than trust her memory.

**Instrumentation:** see Part 6. Journey metric: **scan → account created ≥ 40%**
(warm channel, pre-applied invite; below that the landing is failing a warm audience).
Counter-metric: waitlist joins that never convert after invite (invite emails opened
but <20% claimed ⇒ the page overpromised or the invite email underdelivers).

**Edge/failure branches:**
1. QR scanned but cohort full → waitlist page, invite banner swaps to "you're next in
   line from {conference}"; she keeps priority ordering.
2. Flyer typed by hand (`homa.app`) without the code path → landing detects no code,
   shows waitlist + "have an invite from the conference? Enter it here" field.
3. Link opened on the booth iPad / someone else's phone → "email me this link" is the
   primary CTA in that context; never force signup on a shared device.
4. She scans, starts signup, hall wifi drops mid-auth → resume by reopening the link;
   auth state is server-side, invite stays attached (M1-04 durable session).
5. Two moms share one flyer → invite codes are cohort codes, not single-use on this
   channel; abuse cap per code with soft overflow to waitlist.

**Ticket mapping:** M0-07 (kit) [M-R], M-R wk6 "landing page w/ waitlist" (conference
variant is in-scope, see NT-1/NT-7 in Part 7), M4-07 (full marketing site) [GA].

---

### Journey A2 — Friend referral / co-op word of mouth

**Frame.**
- Persona: P2 and P3 primary (co-op networks), P1 as the *referrer* archetype
  (Alessa's friend saying "I want one" is the founding story).
- Trigger: at co-op drop-off, a friend shows her phone: "look what it made for Ella."
  Or a text with a photo of a worksheet and "you need this."
- Job story: *When my friend shows me a worksheet made for her kid, I want the same
  thing for mine, so I can stop cobbling printables from six Pinterest tabs.*
- Entry channel: shared link `homa.app/i/{FRIEND_CODE}` (each subscriber gets a
  personal invite link to share [M-R]) or just the app name typed later.

**What she saw:** her friend's actual artifact and her friend's actual enthusiasm.
This channel arrives pre-trusted; the product's job is to not fumble it.

**What she fears:**
- Price (co-op families skew single-income; $29 is real money).
- "It works for her kid, but mine are different" (three kids, wide ages for P2).
- Awkwardness if she tries it and hates it after a friend vouched.

**What the landing page must prove in 30 seconds:**
1. "{Friend} invited you" at the top: continuity with the conversation.
2. It personalizes per child, plural: show two different kids' worksheets side by side
   (different names, different interests) so "mine are different" is answered visually.
3. Price + the anchor: "$29 a month. Most families spend $300 to $800 a year on
   curriculum that isn't matched to their kid" (per M4-07 anchoring).
4. No card to start.

**Invite-code flow [M-R]:** friend's link carries her code. Attribution recorded on
account creation (`invited_by`). No referral rewards in M-R (the cohort is small and
hand-tended); [POST-GA] a referral program can sit on this same attribution rail.

**Stage table.**

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional state | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| The show-and-tell | Friend's phone, a text with a photo | Looks, asks "how much?", asks "is it hard to set up?" | (Nothing; the artifact does the talking) | 1–3 min | Curious, a little envious | Friend can't find her share link fast | One-tap "share Homa" in settings that sends link + a worksheet photo |
| Link open | Text/DM → landing | Skims with the friend's claim in mind | "{Friend} invited you" banner, two-kid proof section | 30–60 s | Pre-trusting, checking price | Price shock without the anchor | The two-worksheet, two-kids visual |
| Decide | CTA | Taps "Claim your invite", or asks the friend more questions first | — | 10 s–2 days | Willing | She waits to "ask her husband"; link gets buried in texts | Link stays valid; day-3 nudge is sent by the *friend* flow, not by us (we never email non-signups except waitlist) |
| → signup | Auth screen | Continues to Part 2 | — | — | — | — | — |

**The moment that decides:** the *"mine are different" objection*. If the landing shows
one perfect preschooler use case, P2 (kids 4, 7, 10) self-disqualifies. The two-kid
proof section plus an honest age-range line ("materials are richest for ages 2 to 7
today; hours and records work for every age" — pending ❓ Sidney call #3) decides it.

**Instrumentation:** journey metric: **referral link → account ≥ 50%** (highest-trust
channel; it should beat conference). Counter-metric: referrer regret — referred
families that churn in month 1 damage the friendship channel; track
`churned_within_30d` by `invited_by` presence.

**Edge/failure branches:**
1. Friend describes it but never sends a link → she googles "homa homeschool" → SEO/GA
   brand page must exist even in M-R (a one-pager with waitlist; see NT-6).
2. Referred family's kids all out of the 2–7 range → honest handling at kid entry
   (Part 2, stage 4); landing already softened it, so it's not an ambush.
3. Friend's own subscription lapsed → her link still lands but banner drops her name
   if she's no longer active (never display "invited by" for a churned account without
   consent; awkwardness protection).
4. She opens the link on desktop at night → flow works desktop-fine but all layouts
   are phone-first; QR handoff to phone offered post-signup for the voice moment.
5. Same household signs up twice from one invite (mom and dad) → dedupe on family
   creation: prompt "join {family name} instead?" (Marcus/S1 secondary-user path is
   workstream 4 scope; here we just avoid the split-family accident).

**Ticket mapping:** NT-1 (invite/waitlist service incl. personal share links),
M4-07 [GA]. Share-from-settings is NT-2 adjacent (Part 7).

---

### Journey A3 — Facebook group / social mention

**Frame.**
- Persona: P3 primary (newcomers live in the state homeschool Facebook groups asking
  "where do I even start"), P2 secondary.
- Trigger: a thread: "what are you all using to track hours?" and a member reply
  mentions Homa with a screenshot. Or [POST-GA] our own social templates
  (`docs/homa-design/social/`) circulating.
- Job story: *When a mom in my group posts a before/after of an app that says her kid
  is on track, I want to check whether it's legit, so I don't waste money or hand my
  kid's data to something sketchy.*
- Entry channel: link in a comment → landing, arriving *skeptical*.

**What she saw:** a stranger's screenshot and a comment thread that probably includes
one skeptic ("it's just ChatGPT with a subscription") and one privacy worrier. She has
read both before clicking.

**What she fears (this channel is fear-forward):**
- AI slop: generic worksheets with six-fingered clip art.
- Data: "they train on your kids" is a live accusation in these groups.
- Screen time: assumes the product is an app *for the child*.
- Community judgment: buying a tool can read as "she can't hack it herself."

**What the landing page must prove in 30 seconds:**
1. Quality: a zoomable real worksheet (typography, art, answer key) that visibly isn't
   slop. The design system's printable template is the proof asset.
2. The child never uses it, first fold, verbatim: "Homa is for you. Your child never
   talks to an AI. The checklist is a conversation with you, never a test for them."
3. Data promise with teeth: no training, export anytime, delete propagates
   (M4-04/M4-05/M4-12 give this substance; the landing states it plainly).
4. The "test for the mother" mechanic named explicitly: this is the category-defining
   difference (00 §value stack) and the thing a skeptical thread can't say about any
   competitor.

**Invite-code flow [M-R]:** social mentions won't carry codes. This channel lands on
the waitlist by design in M-R. Waitlist copy must convert skepticism into scarcity
patience: "we're onboarding a small group of founding families first. Join the list
and we'll invite you with real attention, not a drip campaign."

**Stage table.**

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional state | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| Thread read | FB group post + comments | Reads claim AND the skeptic reply | (Nothing yet) | 2–10 min | Intrigued, defended | Skeptic comment unanswered anywhere | [POST-GA] a public FAQ page that answers the exact group objections, linkable by defenders |
| Click → landing | Comment link | Hunts for the catch: price, data, "is it for kids" | Skeptic-ready fold order: proof → child-never-uses-it → data promise | 30–90 s | Testing us | Any marketing-speak triggers the slop detector | The zoomable worksheet; the privacy sentence written like a person wrote it |
| Waitlist decision [M-R] | Waitlist form | Gives email + state + kids' ages, or leaves | Confirms honestly, sets expectation ("small groups, real attention") | 20–40 s | Cautiously in | Form asks too much; "why do you need my kids' ages" | One-line why: "so we invite families we're ready to serve well" |
| Invite arrives | Email | Opens days/weeks later, colder | Invite email re-proves value (worksheet sample inline), code link | 1–30 days | Re-warming | Cold invite reads like spam | Subject: "your Homa invite is ready (you asked in {month})" + the sample |
| → signup | Auth | Continues to Part 2 | — | — | — | — | — |

**The moment that decides:** the *skeptic's objection resolved on the page*. She
arrives carrying someone else's doubt. The page either answers "child never uses it +
no training on your data + look at the actual quality" in one scroll, or she returns
to the thread and writes nothing, and the channel stays cold.

**Instrumentation:** journey metric: **landing → waitlist ≥ 25%** [M-R] /
**landing → account ≥ 10%** [GA]. Counter-metric: waitlist emails marked spam or
invite-open <40% (the re-warm email is failing).

**Edge/failure branches:**
1. A hostile thread ("AI is ruining homeschooling") links us → same page must not
   escalate; no counter-marketing; the FAQ answers calmly. Support inbox (M-R wk6)
   watches for spikes.
2. She joins the waitlist twice with two emails → dedupe by email; merge on signup.
3. A group admin deletes the mention (many groups ban product links) → nothing we
   control; [POST-GA] provide members a shareable *artifact* (sample worksheet PDF)
   rather than a link, which admins tolerate.
4. Screenshot circulating shows an old UI or wrong price → landing is the source of
   truth; never let stale pricing screenshots contradict the page (price shown on
   page, not only in checkout).
5. She's in a compliance-heavy state (P4) and the group thread is about IHIPs → the
   landing's hours/records line must not overclaim state-report depth in M-R
   ("state reports: ask Homa and we'll compile it from your log" is the honest v1 per
   M-R wk6 concierge).

**Ticket mapping:** NT-1 (waitlist), M4-07 [GA] incl. FAQ, M4-08 (support inbox
watch). Social templates exist in `docs/homa-design/social/` [POST-GA activation].

---

### Journey A4 — SEO [GA]

**Frame.**
- Persona: P2/P4 for compliance queries, P1/P3 for materials queries.
- Trigger: a Google search at 9:40pm: "homeschool hours tracker pennsylvania" or
  "worksheets for 4 year old letters".
- Job story: *When I search for my exact problem late at night, I want the result to
  already know my state or my kid's age, so I don't have to translate a generic tool
  into my situation.*
- Entry channel: programmatic landing pages (NT-6): `/states/{state}/hours-tracking`
  and `/materials/{age}/{topic}` families.

**What she saw:** ten blue links, mostly SEO-farm listicles and two competitor
trackers ($5–15/mo, per brief). She has low trust and high task-specificity.

**What she fears:**
- Generic tool that doesn't actually know Pennsylvania's 900-hour rule.
- Printable-farm bait (email-gated PDFs of clip-art junk).
- Yet another tool that tracks but doesn't *do* anything.

**What the landing page must prove in 30 seconds:**
1. State pages: her state's actual requirement, cited, with "last verified" date
   (M3-05 ruleset + statute links render here too; the data does double duty).
2. Materials pages: a real, downloadable-quality sample for that age/topic visible
   without an email gate. The sample IS the ad.
3. The step beyond the query: "tracking is automatic here: you talk, Homa logs" (for
   hours queries) / "these adapt to your kid, not a grade level" (for materials).
4. Price + no-card-start (same honesty block sitewide).

**Invite-code flow:** none; this channel is [GA] by definition. If shipped
pre-GA, these pages carry the waitlist form. (SEO lead time argues for shipping the
state pages during M-R as waitlist collectors: they take months to rank. See NT-6.)

**Stage table.**

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional state | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| Search | Google SERP | Scans titles for her state/age | Title/meta name the state or age exactly | 10–20 s | Task-focused, low trust | Generic title loses to competitor's exact-match | "Pennsylvania homeschool hours: the 2026 requirements, tracked automatically" |
| Land | State/age page | Checks: is the requirement right? | Requirement stated + cited + last-verified date; sample artifact | 30–90 s | Verifying | One wrong legal fact = P4 gone forever (kickoff: "will churn instantly over a wrong legal claim") | The citation link; the verified date; no email gate on the sample |
| Bridge | Page CTA | Realizes it's a product, not a blog | One CTA: "see what Homa would make for your kid" or "track hours automatically" | 10–30 s | Deciding whether to invest 3 min | CTA feels like a bait-and-switch from content to product | CTA sets the time cost honestly: "about 3 minutes to your first page" |
| → signup [GA] | Auth | Continues to Part 2 | — | — | — | — | — |

**The moment that decides:** *the fact check*. On state pages she knows her state's
rule better than most lawyers; if our number matches and carries a citation, we've
passed the only credibility test that matters on this channel. On materials pages,
it's the un-gated sample quality.

**Instrumentation:** journey metric: **SEO landing → account ≥ 5%** (cold channel,
GA). Counter-metric: bounce <10s on state pages (ranking for a query the page doesn't
actually answer).

**Edge/failure branches:**
1. State law changes and the page lags → M3-05's "last verified" date is displayed;
   verification job flags stale pages; better stale-and-labeled than wrong.
2. Query is for an out-of-range age ("worksheets for 10 year old") → do not run ads
   or build pages against it until ❓ call #3 resolves; if a page exists, honest copy.
3. She wants the free printable and leaves → fine by design; the sample carries the
   brand and the URL (footer credit on every sample PDF).
4. Competitor bids on "homa homeschool" [GA] → own the brand SERP with the one-pager
   early (see A2 edge #1).
5. Whole-site penalty risk from thin programmatic pages → each state page must carry
   genuinely unique content (the actual ruleset data), not templated filler; cap the
   materials pages to topics with real samples behind them.

**Ticket mapping:** NT-6 (programmatic SEO pages), M3-05 (ruleset data source),
M4-07 [GA]. ❓ call #3 gates the materials-page age range.

---

## Part 2 — The activation masterpiece: signup → first wow [M-R]

This is the make-or-break journey. Design law from the council inversion: **wow before
work, always**. Target: **account → personalized worksheet on her screen in under 3
minutes of her time** (M2-03 split ii), and under 10 minutes wall-clock from landing
tap even with interruptions.

**Frame.**
- Persona: written for P3 (highest anxiety = the hardest test); variants noted.
- Trigger: any Part 1 journey's CTA tap.
- Job story: *When I decide to try Homa, I want proof it knows MY child before I've
  invested anything, so I can believe the subscription would be worth it.*
- Entry: `homa.app` signup with invite attached [M-R].
- Device assumption: iPhone Safari or Android Chrome, one hand, possibly a child on
  the hip. Every screen: one job, thumb-reachable primary action, 44px+ targets.

### The transformation (onboarding-redesign method)

- **Before:** a mom with a browser tab, a pile of doubts, and the quiet fear
  "am I doing enough?"
- **After (3 minutes later):** a mom holding a page that could only have been made for
  her kid, thinking "it already sees her."
- **Smallest step that delivers the feeling:** one artifact that fuses two things she
  told us (the child's current obsession + the skill she wants help with) with one
  thing we brought (age-band-appropriate design). Personalization must be *visible in
  the artifact itself*: name in the title, the obsession in the art, the skill in the
  exercise.

### Minute-by-minute

**0:00 — CTA tap → auth screen.**

One screen. Logo, one line of context, three buttons, one reassurance line. No
password rules essay, no name field (we ask what to call her later, warmer), no email
verification gate (verify async, never block the flow — friction strategy 8).

> **Screen: create account**
> Heading: "Let's set up your family's Homa"
> Sub: "Free to start. No card. About 3 minutes to your first page."
> [Continue with Apple] [Continue with Google] [Use my email instead]
> Footer: "Your family's data stays yours. Never used to train AI models."

Email path: email + password, one field each, show-password toggle, password managers
not blocked. Supabase Auth (M1-01, decided). Invite code [M-R] is already attached
from the URL; if she arrived codeless, one field appears above the buttons:
"Invite code" with "on the waitlist instead?" link. Time: 15–30s (Apple/Google),
45–60s (email).

**0:30 — the boring form intake (M2-03 split i).** One screen, not a conversation
(council: forms for facts, conversation for feelings).

> **Screen: your family**
> Heading: "First, the basics"
> Field: "What should Homa call you?" (first name)
> Field: "Your state" (searchable select; drives compliance rules silently)
> Sub under state: "This helps me know your state's homeschool rules. Nothing is
> shared."

Then kids, on the same scroll (adopting `Onboarding.jsx`'s add-kid list pattern,
improved):

> Heading: "Who are we teaching?"
> Sub: "Add each of your kids, I'll keep their plans and progress separate."
> Per kid: Name + Birth month/year (two pickers, no day: an age band doesn't need it
> and a full DOB is data we don't need to hold)
> Empty-state (from the kit, kept verbatim): "No pressure, you can always add more
> later."

**Out-of-range branch (P2's 10-year-old), inline and honest.** The moment a birth
year puts a child outside the v1 band (pending ❓ call #3, assume 2–7):

> **Inline card (sage tone, not warning tone):**
> "I can track hours, keep records, and save journal moments for Jacob right away.
> His custom worksheets and benchmarks are still on the way for his age, I'll tell
> you the moment they're ready. Add him now so nothing gets lost."
> [Add Jacob] [Skip for now]

Never a rejection, never a grayed-out row, never "unsupported." Time: 40–70s for one
kid, +15s per additional kid.

**1:15 — 4 questions per child (M2-03 split ii).** One question per screen (friction
strategy 10: one input per mobile screen), chips over typing wherever possible, dots
progress (kit pattern), every question skippable. Copy below for "Maya, 4":

> **Q1 of 4** · "What's Maya loving right now?"
> Sub: "Pick any, or type your own. This shows up in her pages."
> Chips: dinosaurs · horses · space · princesses · trucks · bugs · ocean · drawing
> [+ type something else]

> **Q2 of 4** · "What would you love help with first?"
> Sub: "Just one to start. We'll get to the rest."
> Chips (keyed to age band): letters · counting · writing her name · scissors ·
> colors and shapes · reading readiness

> **Q3 of 4** · (calibration, keyed to the Q2 pick; counting example)
> "Where's her counting these days?"
> Chips: "just starting" · "counts to 10ish" · "counts past 20" · "honestly not sure"
> Sub: "Not sure is a real answer. I'll figure it out with you as we go."

> **Q4 of 4** · "Anything else you want me to know about Maya?"
> Sub: "Totally optional. A sentence is plenty."
> [text field] [skip]

Q3's "not sure" chip is a design law: the confidence system was built for sparse,
uncertain profiles (council inversion note), and letting her say "not sure" without
penalty is the first taste of no-guilt mechanics. Time: 45–75s per child.

**Multi-child rule:** after child 1's questions, do NOT run child 2's before the wow.
Generate child 1's page first (the wow can't wait), then offer:

> "Want Eli's page too? Four quick questions while Maya's prints."

This parallelizes his generation with her question-answering and keeps time-to-first-
wow constant regardless of family size.

**2:00 — generation wait (M0-03 path: sandbox worksheet gen inside a chat turn).**
Latency budget 45–90s. The wait is a *stage*, not a spinner. Kit's `Skeleton` pattern
extended with live status lines (NT-8):

> **Screen: making it**
> Heading: "Making Maya's page…"
> Status lines appearing in sequence (real, tied to actual pipeline steps):
> "Picking a dinosaur theme ✓"
> "Drawing her counting page…"
> "Checking the tracing lines…"
> Handwritten accent (one per surface, kit law): "worth the wait ✎"

If generation exceeds 120s: "This one's taking a little longer than usual. It's still
coming, you don't need to do anything." If it fails outright: see edge branches.

**3:00 — WOW DELIVERED.** The screen the whole funnel exists for.

> **Screen: her first page**
> Artifact card: full-bleed preview of the worksheet. Maya's name in the title.
> Dinosaurs in the art. Counting 1 to 10 exercises.
> Callout (kit `Callout`, "A note from HOMA," sage):
> "I made this for Maya: dinosaur counting to 10, since she loves dinosaurs and
> you said counting is where you'd like a hand. When she does it, tell me how it
> went and her next page gets smarter."
> Buttons: [Print] [Save PDF] [Share]
> Below, quiet: "made in 2m 41s, just for her"

Print = system print dialog (J3 pattern: PDFs flawless on Letter, no printer
integration v1). Share exists deliberately: this artifact is the word-of-mouth unit
(journey A2's supply side).

**3:30 — the rhythm screen + add-to-home-screen.** One screen that sets the contract
for week one, then the PWA ask, in that order (value restated before the ask):

> **Screen: how this works**
> "Here's the rhythm:"
> "· Ask me for anything, anytime. Pages, ideas, a plan for a rainy Tuesday."
> "· Each evening I'll ask you one small question about the day."
> "· Saturday you'll get a note about what moved this week."
> [Sounds good]

Then:

> **Screen: keep me close**
> "Homa works best one tap away, right on your home screen."
> iOS: illustrated 2-step (share icon → add to home screen), device-detected.
> Android: native install prompt via `beforeinstallprompt`.
> [Show me how] [Maybe later]

"Maybe later" is honored: re-offered once, on the day-3 return visit, never again
(nag-free law). Placement rationale: highest motivation is the minute after value
delivery; asking before the wow taxes an unproven product, asking days later misses
the peak.

**The voice-note permission moment.** NOT during onboarding. The mic button is
*visible* in the chat composer from the first screen (it advertises itself), but the
OS permission is requested only on her first mic tap, which for most families is the
evening-1 journal reply. Pre-permission screen before the OS dialog (you get one shot
at the iOS prompt; never waste it on a cold tap):

> **Sheet: before your phone asks**
> "Talking is faster than typing. You talk, I'll write it down and file it in the
> right place. Your phone will ask to use the microphone, that's all it's used for."
> [Let's try it] [I'll type instead]

If the OS prompt is denied:

> "No problem, typing works just as well. The mic will be right here if you change
> your mind (you can turn it on anytime in your phone's settings)."

No re-prompting, no red badge on the mic. Mobile Safari failure (recording starts but
upload/transcription fails, per M0-04/M1-05): "That didn't record cleanly, your words
aren't lost if you saw them appear. Want to try again, or type it?" plus the audio-
file-upload fallback shipped simultaneously (M1-05 law: voice failure is a moat
failure).

### Stage table (the whole activation flow)

| Stage | Touchpoints | What she does | What Homa does | Time | Emotional state | Friction risks | Delight opportunities |
|---|---|---|---|---|---|---|---|
| Auth | Signup screen | One tap (Apple/Google) or email+pw | Creates family, attaches invite, no email-verify gate | 15–60 s | Committed, wary of forms | Email path friction; password rules | "About 3 minutes to your first page" promise |
| Family intake | One form screen | Name-to-call-her, state, kids + birth month/yr | Silently loads state ruleset; age-band check per kid | 40–90 s | Cooperative | Out-of-range kid ambush; state select scroll | The honest out-of-range card that still says yes |
| 4 questions | 4 chip screens per child | Taps chips, maybe types one line | Builds sparse seed profile; picks generation recipe | 45–75 s/child | "These are easy" | Free-text keyboard on Q4; question fatigue | "Not sure is a real answer" |
| Generation wait | Status screen | Watches, or switches apps | Sandbox run: theme, fal.ai art, layout, PDF | 45–120 s | Anticipation (fragile) | >120s wait; app-switch and never return | Real status lines; push/email delivers the PDF if she leaves |
| **Wow** | Artifact card | Zooms, prints, maybe shares | Presents artifact + why-this note + feedback hooks | 30–90 s | "It sees her" | Artifact misses (wrong vibe, art fail) | Name + obsession + skill visibly fused; "made in 2m 41s, just for her" |
| Rhythm + PWA | 2 screens | Reads contract, maybe installs | Sets week-one expectations; A2HS ask | 20–40 s | Calm, oriented | iOS A2HS is manual and fiddly | The 3-line rhythm contract, no feature tour |
| (Deferred) voice permission | First mic tap | Grants or denies | Pre-permission sheet, graceful denial | 10 s | Trusting or cautious | Wasted iOS prompt; Safari failures | "You talk, I'll write it down" |

### The moment that decides

**The wow inspection.** She holds the phone up and judges the artifact for about five
seconds. Pass = the three-way fusion is *visible without explanation* (Maya + dinosaurs
+ counting). Fail = generic worksheet with a name slapped on, or art that reads as AI
slop. Everything upstream of this moment is logistics. This is why M2-05 adopts the
design system's printable template (quality floor) and why the "why this page" Callout
exists (makes the personalization legible even if she'd miss it).

### Instrumentation

Metric: **`onboarding.wow_delivered` within 10 minutes of `auth.account_created` for
≥70% of new accounts** [M-R cohort]. Counter-metric: wow delivered but never printed/
saved/shared AND no day-2 return (the artifact technically arrived but didn't land;
watch `onboarding.wow_engaged` = print|save|share|zoom>3s). Full schema in Part 6.

### Edge/failure branches

1. **Generation fails or exceeds 3 min** → never a dead spinner. At 120s: reassurance
   copy. At fail: "I'm having trouble drawing right now. Your answers are safe, and
   Maya's page will be in your inbox within the hour, I promise." Fallback: retry
   queue + email delivery + [M-R] Sidney alerted (concierge safety net). The promise
   must be kept by machinery, not hope: retry job with escalation (NT-8).
2. **She abandons mid-questions** (kid melts down at Q2) → everything auto-saved per
   answer (durable session, M1-04). Return via any link resumes exactly at Q3:
   "Picking up where we left off with Maya." If she never returns within 24h, one
   email: "Maya's page is 2 questions away" [single send, never a sequence].
3. **All kids out of range** (P2 worst case) → wow can't be a worksheet. Pivot the wow
   to the hours/records value: "While their custom pages are on the way, here's what I
   can do today: track your hours automatically. Tell me about your school day
   yesterday and watch." First hours auto-tally becomes the activation artifact
   (candidate aha #4, Part 4). Honest, and it serves P4 too.
4. **She answers "not sure" to everything** → fine by design (confidence system).
   Generation uses age-band defaults + interests; the note adapts: "I kept this one
   broad while we get to know Maya. Your answers this week will sharpen it."
5. **Duplicate/ambiguous kid names** (two kids, both "M") → disambiguation etiquette
   ported later (M2-11); at intake just allow identical names, display with birth year
   internally.
6. **Invite code invalid/expired at auth submit** → never eat her form input; "That
   invite has expired, but you're first in line. Want me to hold your answers for when
   your spot opens?" (waitlist + saved state).
7. **She signs up twice** (Apple ID and email) → Supabase identity linking on same
   email; if distinct emails, day-1 doctor query flags doppelganger families for
   Sidney [M-R concierge].
8. **PWA installed but notifications denied** → drip falls back to email deep links
   (M1-08); never treat push as required (M1-09 is deferred in M-R anyway; see ❓).

### Ticket mapping (detail in Part 7)

M2-03 (all three splits), M1-01, M1-04, M1-05, M0-03/M2-05, M1-17, M2-01 (voice rules
in copy), NT-1 (invite), NT-2 (PWA), NT-8 (generation status + retry/escalation).

---

## Part 3 — Week-one drip journey (day 1–7)

The 15-minute questionnaire, re-scoped as the day-1→7 engagement mechanic
(M2-03 split iii): **3 questions a day**, each answerable in under 20 seconds, each
visibly making the product smarter. The drip is also the activation metric's engine
(Part 4): every answer is an observation event.

**Frame.**
- Persona: P3 baseline, variants below.
- Job story: *When I've just started something new for my kid, I want small daily
  proof I made a good call, so I can quiet the second-guessing voice by Friday.*
- Channels [M-R]: in-app chat + email deep links (M1-08). Push [POST-M-R] when M1-09
  ships. SMS [POST-GA, M5-01].

### The emotional arc, designed

The arc must land day 7 on **validation, not audit**. Shape: day 1 relief ("that was
easy") → day 2–3 curiosity ("it's actually using what I say") → day 4–5 first
evidence ("it knows her") → day 6–7 validation ("I'm doing this, and it's working").
The dangerous day is the benchmark reveal (day 4–5): position data can read as
judgment. Two laws govern it: never reveal before confidence threshold (≥8
observations on the domain, roughly day 3+), and strengths-first framing with the
next step attached (presentation law, 00 §reconciliation).

### Day-by-day

**Day 1 (signup day), evening ~8pm local.** First journal prompt (M2-07), referencing
the wow artifact, one question only:

> Email subject: "How did Maya's dinosaur page go?"
> In chat: "Evening, Sarah. Did Maya get to her dinosaur page today? One line is
> plenty, or hold the mic and just tell me."

Any reply gets the logged-confirmation, the second candidate aha (Part 4):

> "Logged. 'Counted all ten dinosaurs but wrote 3 backwards' is exactly the kind of
> detail that makes her next page better. It's saved to her journal too."

If no reply: silence. Skip-if-unanswered rule (J2, ported from Mac Mini). The prompt
does not repeat or guilt.

**Day 2, morning (or her active window, see P5).** First drip set:

> "Morning ☀️ Three quick ones about Maya while the coffee's hot. Takes under a
> minute."
> Q: "Does Maya recognize her own name in print?" [yes] [sometimes] [not yet] [not sure]
> (then 2 more, chip-answerable, same pattern)
> After the third: "That's 3 more things I know about her. 12 percent of the way to
> her full picture."

Question order is engineered, not random: **days 2–3 pull from domains where she's
likely to answer "yes"** (calibrated by age band + intake answers), because early
"not yet" streaks read as failure. "Not yet" is the only allowed negative phrasing
(kit: "not yet, that's just what's next"). "Not sure" always present, never penalized.

**Day 2, evening.** Journal prompt #2. If she replied day 1, reference it ("did the
backwards 3 come up again, or was that a one-off?" — continuity is the point). If she
didn't, fresh and light: "What's one thing Maya did today that made you smile?"

**Day 3.** Drip set 2 (3 questions). After answering, the first **profile-visible
moment**: the drip confirmation now shows movement, not just count:

> "That's her counting picture getting clearer. Tomorrow's page will use it."

And tomorrow's page must actually use it: day-3/4 auto-offers a second worksheet
generated from updated profile ("Want tomorrow's page? It leans into what you told
me."). The second artifact proves the loop, not just the generator.

**Day 4–5. The benchmark reveal** (gated on confidence, not calendar). Delivered as a
note in chat + a new dashboard tile (M2-08 minimal dashboard), never as a push-alarm:

> "A first look at where Maya is. Strong spots so far: shapes and colors, and she's
> ahead of her age band on letter recognition. Counting is right in the band, and
> it's what we're working on anyway. Want to see the full picture as it fills in?"
> [See Maya's picture]

Dashboard tile framing (M1-17 law: no red, no "behind," growth framing only): each
domain shows position as "in the band / ahead / one of our focus spots." Focus spots
always carry an attached material offer. The word "behind" does not exist in the
product's vocabulary.

**Day 6 (Saturday). Concierge scoring** [M-R]: Sidney runs the Saturday scoring
script; note reviewed by hand (fail-closed human review, 09 §V3). She sees nothing
today unless day 6 IS Saturday (see scheduling rule below).

**Day 7 (or the first Saturday after ≥3 observation days). The first weekly note**
(M3-02, concierge-written in M-R with the hand-written efficacy before/after from
week one per M-R wk6). Structure is law: what SHE did → what Homa learned → one
strength → one next step with material attached → permission line. Max one nudge.

> Subject: "Maya's week 1, the picture so far"
> "Sarah, week one is done, and you showed up for it: 9 moments logged, 14 questions
> answered, 2 pages done together.
> Here's what I've learned: Maya's letter recognition is ahead of her age band, and
> her counting moved this week, she's consistently past 10 now (that was 'to 10ish'
> on Monday).
> The dinosaur pages get the credit, and so do you.
> Next week, one small thing: numbers 11 to 20 with a page I've already made. It's
> in her library when you want it.
> A lighter week would've been fine too. See you Monday."

**Scheduling rule:** if signup lands Wed–Fri, the first weekly note waits for the
*following* Saturday (a 2-day "week in review" reads as thin and audit-y). The drip
continues through the gap; day 7 still gets a milestone message ("one week with Homa
today, Maya's picture is 40 percent filled in").

### Persona variants

**P1 (Alessa archetype, ahead-seeking).** She answers fast and wants more. Adaptive
rule: if she answers all 3 drip questions within an hour for 2 straight days, offer
the power path: "You're quick. Want to keep going? I'm happy to ask a few more
whenever you're in the mood." (Turns the drip into pull, capping at 10/day; the drip
never *sends* more than 3.) The benchmark reveal for P1 leads with the gold "ahead"
states honestly (design system: gold = ahead, it exists for her) and offers the deep
standards view (BenchmarksView) early. Her week-one note includes the before/after
metric explicitly: she's the persona the efficacy loop was articulated by.

**P3 (Danielle, anxious newcomer).** Extra reassurance branches:
- Intake state-selection triggers a same-day "you're allowed" card: "Ohio lets you
  homeschool with a simple notice. I'll walk you through it this week, it's about 10
  minutes of paperwork total. You're not behind on anything." (Data: M3-05 ruleset;
  copy reviewed per state.)
- Her drip questions carry softer framings and *never* two "not yet"-likely questions
  in the same day's set.
- Benchmark reveal is delayed to the later end of the gate (more observations, higher
  confidence) and leads with the strongest domain plus an explicit normalizer: "For a
  first month of homeschooling, this is a strong picture."
- Mid-year-pull-out empathy in the week-one note: "Switching mid-year takes guts.
  Week one is done, and Ella's picture says the switch is working."
- Any 2-day silence in week one gets ONE gentle check-in, not a sequence: "No
  pressure at all. Ella's page is here whenever you want it. A settling-in week is
  still a school week."

**P2 (Rachel, three kids incl. one out-of-range).** The honest handling:
- The drip stays **3 questions per day total, not per child**: rotating focus days
  (Mon = Ava 4, Tue = Ben 7, Wed = Ava…), named in the message ("three about Ben
  today"). Two in-range kids reach reveal-confidence in ~10 days instead of 5; the
  weekly note covers whoever has data and says so ("Ava's picture is filling in
  first, Ben's is a few days behind, that's just the rotation").
- Jacob (10) appears in the hours tally and journal from day one. The week-one note
  includes him honestly: "Jacob's hours are logging (4h 30m this week). His custom
  materials are still on the way for his age, I'll tell you the moment that changes."
  He is never invisible and never faked.
- Her wow-day pivot (Part 2, edge #3) means her candidate aha may be the hours
  auto-tally, so her week-one note leads with hours-vs-state-target: the conference
  ask, answered.

**P5 (Jess, evenings-only, voice-first).** Timing adapts:
- Drip send time = her observed active window (default: signup hour band). If she
  signed up at 9pm, drips arrive 8pm, not 8am. Journal prompt merges INTO the drip
  message for her (one evening touch, not two: time-starved law).
- Every drip question voice-answerable: "or just tell me about the day and I'll pull
  the answers out myself" — a voice ramble auto-answers matching drip questions
  (routing per M2-07 + M2-13). This is her power feature: one 40-second voice note =
  3 drip answers + journal entry + hours.
- Weekly note arrives Saturday morning but expects Sunday reading; no time-sensitive
  content in it, ever.

### The moment that decides

**The benchmark reveal.** It's the product's thesis in one screen: standards
positioning as validation, not judgment. Get it right and week two is pulled, not
pushed; get it wrong (too early, thin data, any deficit smell) and she quietly stops
answering the drip: the exact silent churn J2's re-engagement can't fix. The gate
(confidence threshold + strengths-first + material attached) is not polish, it's the
mechanism.

### Instrumentation

Metric: **≥3 captured observations (drip answer, journal reply, or voice note) on ≥3
distinct days in week one** for ≥60% of activated families [M-R]. Counter-metric:
drip answer rate high but journal replies zero (she's clicking chips out of
politeness, not integrating Homa into the day; chips are cheap, sentences are real).
Secondary counter: benchmark reveal opened but dashboard never revisited in 72h.

### Edge/failure branches

1. **She goes silent day 2–4** → skip-if-unanswered; day 4 single check-in (P3 copy
   above); day 7 milestone message regardless; then hand to workstream 3's
   re-engagement policy (M3-07). Never more than one unanswered prompt outstanding.
2. **She answers "not sure" to most drip questions** → confidence rises slowly;
   benchmark reveal auto-delays; replace it with a process-validation note day 5:
   "Still getting to know Maya, and that's the honest way to do it. The picture
   fills in from real moments, not guesses."
3. **A drip question lands wrong** ("does she cut with scissors" to a mom whose kid
   has a motor delay) → every drip message footer: "skip any question, or tell me
   why it doesn't fit and I'll adjust." A "doesn't fit" reply routes to profile
   (what-works/sensitivities) and suppresses the subdomain's phrasing family (M2-13).
4. **Two kids, ambiguous journal reply** ("she counted to 30!") → disambiguation
   etiquette (M2-11): "Ava or the big counting news from Ben? Just checking I file
   it right."
5. **Saturday scoring fails / Sidney unavailable** [M-R] → the note delays to Sunday
   with no apology needed; if >48h late, the system sends nothing and the next note
   covers two weeks ("the fortnight picture"). Never send an unreviewed note
   (fail-closed law, 09 §V3).
6. **She asks a compliance question the concierge report can't answer yet** → honest
   deferral in voice: "I track your hours and keep every record you need. For the
   official form itself, I'll put together your report when you ask, it takes me a
   day right now." [M-R]
7. **Email deep links break** (corporate spam filter, Gmail clipping) → every email's
   content is also in the in-app chat thread; the email is a doorbell, not the house.

### Ticket mapping (detail in Part 7)

M2-03 split iii (drip), M2-07 (journal prompt + routing), M3-02 (weekly note,
concierge in M-R), M2-08 (dashboard tile + reveal), M2-04 (confidence gating), M3-05
subset (hours in week one), NT-4 (drip scheduler mechanics), M1-08 (email).

---

## Part 4 — Aha-moment hypothesis analysis

Per the aha-moment method: qualitative candidates first, then leading indicators and
the metric bet. **Honesty note:** we have no cohort data (planning stage; n=1
production family). Quantitative claims below are hypotheses with instrumentation
attached, calibrated against Alessa's usage pattern (voice-notes-from-pocket, prints
daily, reads weekly notes) and the founding demand signals ("I want one" came from
seeing an artifact; conference moms asked for hours).

### Candidate ahas

**Candidate 1 — first personalized worksheet (<3 min).**
The activation wow. *For:* it's the artifact that sold the friend (A2's founding
story); it's visual, immediate, shareable. *Against:* it's a one-shot; "AI made a
worksheet" is increasingly table stakes, and a wow that doesn't recur predicts
nothing by itself. Verdict: **necessary but not sufficient**: it's the *hook*, the
thing that earns week one, not the thing that creates a subscriber.

**Candidate 2 — first "logged, that moved her counting up."**
The moment her spoken words visibly update the child's picture. *For:* this is the
"it learns" realization: the moat made felt; it's repeatable (every log can deliver
it); it's Alessa's actual daily habit (voice → log → smarter). *Against:* subtle;
easy to miss if the confirmation copy is weak; requires her to log at all. Verdict:
**the strongest habit-former hypothesis**. The wow gets her in the door; this is what
makes day 3 different from day 1.

**Candidate 3 — first weekly note.**
The validation artifact ("am I doing enough?", answered with evidence). *For:* it's
the emotional core per the value stack; it's the renewal argument in miniature; the
efficacy before/after lives here from week one (hand-written, M-R). *Against:* it
arrives on day 6–9, after most abandonment risk has already resolved; it may be a
*retention* aha more than an *activation* aha. Verdict: **the week-two engine**; it
converts an activated family into a believing one. Owned jointly with workstream 3.

**Candidate 4 — first hours auto-tally.**
"You talked, I logged 1h 45m toward your 900." *For:* the only externally validated
demand (conference ask); the whole aha for P4 and often P2; zero effort demanded.
*Against:* irrelevant to P1 and low-regulation states; unemotional for the
enrichment-driven segment. Verdict: **segment-specific aha**: primary for
P2/P4-in-heavy-states, supporting elsewhere. The funnel must detect state + persona
signals and let this lead where it should (Part 2, edge #3 already does).

### Leading indicators to instrument (per candidate)

| Candidate | Leading indicators (week one) | Kill signal |
|---|---|---|
| 1. Wow worksheet | `wow_delivered` latency; `wow_engaged` (print/save/share/zoom); second worksheet requested by day 4 | Wow delivered, never engaged, no day-2 return |
| 2. Logged-and-moved | first `observation.captured` source (voice vs chip vs text); `profile.update_shown` views; time from first log to second log | Logs happen but confirmation views ~0 (copy invisible) |
| 3. Weekly note | note open rate; dashboard visit within 24h of note; reply to note | Opens without dashboard follow-through |
| 4. Hours tally | `hours.autologged` count; hours tile views; state-report question asked | Hours accrue, tile never viewed (value invisible) |

### The activation metric bet

**Bet:** *activated* = **wow delivered within 10 minutes of account creation** AND
**≥3 captured observations on ≥3 distinct days in week one** AND **≥1 return session
after the first weekly note**.

Rationale: the wow (candidate 1) gates entry; distinct-day observations (candidate 2's
behavior) prove the habit loop opened, and 3 days is the smallest number that isn't
noise; the post-note return (candidate 3) proves the validation landed. Candidate 4
substitutes for the wow clause for all-out-of-range families (their wow IS the tally).
Prediction to falsify against retention data by cohort 2: families meeting all three
clauses retain to month 2 at >3× the rate of families meeting only the first.
Counter-metric for the whole definition: gaming-by-design: if we chip-ify everything
to inflate observation counts, journal *sentence* replies collapse; watch the
chip-to-freeform ratio.

---

## Part 5 — Friction audit (every tap, field, and wait, ranked)

Funnel: QR/link → landing → auth → intake → questions → wait → wow → rhythm/PWA →
day 1 evening prompt. Risk = estimated drop-off severity × reach. Every row has a
cheaper alternative (the "if we must cut scope" column), per the friction-reduce
method. Steps kept despite friction are marked KEEP with the safeguard reason.

| # | Step | Cost to her | Risk | Why it's risky | Cheaper alternative |
|---|---|---|---|---|---|
| 1 | Landing comprehension | 1 scroll, ~30s | **HIGH** | Wrong fold order loses the skeptic (A3) and the hall-skimmer (A1) | One landing with channel-swapped hero band only; don't build 4 pages [M-R] |
| 2 | Invite code entry (codeless arrivals) | 1 field + hunting for the code | **HIGH** for that segment | Any typed code is a wall | Codes always in URLs; typed entry is the fallback, waitlist is the default. Never gate the *page*, only the signup |
| 3 | Auth method choice | 1 tap (or 2 fields email path) | MED | Email path doubles time; verification gates kill | Apple/Google first-positioned; email verify async (KEEP async verify: account recovery needs a real email eventually, but not at minute 0) |
| 4 | "What should Homa call you" | 1 field | LOW | Feels warm, cheap | Could derive from auth provider name; keep the field, it's the first voice moment (KEEP: relationship-setting) |
| 5 | State select | 1 picker, ~10s | LOW-MED | 50-item scroll on phone | Searchable select; geolocation pre-fill rejected (creepy at minute 1, see ❓) (KEEP: drives compliance + P3's "you're allowed" card) |
| 6 | Kid name + birth month/yr | 3 inputs per kid | MED | Multi-kid families triple it; DOB pickers are fiddly | Month+year only (already cut day); "add more later" honored for kids 3+ |
| 7 | Out-of-range moment | 0 taps, emotional cost | **HIGH** (P2 reach) | Ambush = walkout; the kickoff calls for honesty | Inline sage card (built); cheaper still: age question moved BEFORE name so expectations set earlier: rejected, colder |
| 8 | 4 questions/child | 4 screens, ~60s | MED | Question 4's keyboard; second child doubles | All skippable; Q4 optional+voice; child 2 deferred until after wow (built into design) |
| 9 | **Generation wait** | 45–120s idle | **HIGH** | The longest unmitigated wait in the funnel; app-switch = maybe never return | Status lines + deliver-by-email on abandon (built). Cheaper: pre-generate during Q3/Q4 from partial answers, swap in final art (NT-8 stretch: cuts perceived wait ~40s) |
| 10 | Wow inspection | ~5s judgment | **CRITICAL** | Quality miss here invalidates everything | Not a friction problem; a quality floor problem (M2-05 template + M0-03 latency). No cheaper alternative: this is the product |
| 11 | Print flow | 2–3 taps, printer lottery | MED | Home printers fail; no printer at signup moment | Save-PDF equal prominence; "print later from her library" copy; worksheet usable on-screen for some formats |
| 12 | Rhythm screen | 1 tap | LOW | Skippable reading | Keep to 3 lines (KEEP: the contract prevents week-one surprise, which is churn) |
| 13 | A2HS (iOS) | 3+ manual taps in share sheet | **HIGH** (iOS share-sheet UX is bad) | Most drop; it's Apple's flow, not ours | Illustrated overlay (built); accept low install rate, email is the fallback rail; re-offer once day 3 |
| 14 | Voice permission | 1 OS dialog | MED | Denial is sticky on iOS | Deferred to first mic tap + pre-permission sheet (built); text path always equal (KEEP deferral: onboarding permission asks are where trust dies) |
| 15 | Day-1 evening prompt | 1 reply | MED | First async re-engagement; email may land in Promotions | Deep link resumes chat; reply-to-email as input channel [POST-GA]; keep it ONE question (KEEP: it's candidate-aha 2's trigger) |
| 16 | Drip answer (daily) | 3 chips, <60s | LOW-MED | Fatigue by day 5 | Chips + voice-ramble auto-answer (P5 design); "skip any question" footer; drip pauses when ignored 2 days |

**Top three risks and their single mitigations:** (9) generation wait → real status
lines + email-on-abandon; (13) iOS A2HS → treat email as the primary rail and A2HS as
a bonus; (7) out-of-range ambush → the sage card plus landing-page honesty upstream.

---

## Part 6 — Instrumentation: event schema + the funnel dashboard

Naming: `area.event_name`, snake_case, past tense. Common properties on every event:
`family_id`, `session_id`, `ts`, `platform` (ios-safari | android-chrome | desktop),
`pwa_installed` (bool), `cohort` (m-r | ga), `channel` (conference | referral |
social | seo | direct). Events land in the `events` table (M1-02); emission +
dashboard is NT-3.

### Acquisition

| Event | Properties | Emitted when |
|---|---|---|
| `acquisition.landing_viewed` | `channel`, `variant`, `invite_code_present`, `utm_*`, `referrer_code` | Landing render |
| `acquisition.cta_tapped` | `cta` (claim_invite \| waitlist \| email_me_link) | CTA tap |
| `acquisition.waitlist_joined` | `state`, `kids_age_bands[]`, `channel` | Waitlist submit |
| `acquisition.invite_email_sent` / `_opened` / `_claimed` | `waitlist_age_days` | Invite lifecycle |
| `acquisition.link_saved_for_later` | — | Email-me-this-link |

### Activation funnel

| Event | Properties | Emitted when |
|---|---|---|
| `auth.account_created` | `method` (apple \| google \| email), `invite_code`, `invited_by`, `seconds_from_landing` | Auth success |
| `onboarding.intake_completed` | `kids_count`, `out_of_range_count`, `state`, `duration_ms` | Family form done |
| `onboarding.out_of_range_shown` | `choice` (added \| skipped) | Sage card interaction |
| `onboarding.child_questions_completed` | `child_index`, `duration_ms`, `skips`, `not_sure_count`, `voice_used` | Q4 done/skipped |
| `onboarding.questions_abandoned` | `child_index`, `question_index` | Session death mid-questions |
| `onboarding.wow_generation_started` | `child_index`, `recipe` (interest, focus) | Sandbox job start |
| `onboarding.wow_delivered` | `latency_ms`, `minutes_since_signup`, `artifact_type`, `retry_count` | Artifact rendered on her screen |
| `onboarding.wow_engaged` | `action` (print \| save \| share \| zoom) | First engagement action |
| `onboarding.wow_failed` | `stage`, `fallback` (email_promise) | Generation failure |
| `onboarding.rhythm_acknowledged` | — | Rhythm screen continue |
| `pwa.install_prompted` / `_completed` / `_dismissed` | `occasion` (post_wow \| day3) | A2HS lifecycle |
| `permissions.voice_prompted` / `_granted` / `_denied` | `occasion` (journal_reply \| chat \| q4) | Mic permission lifecycle |

### Week one

| Event | Properties | Emitted when |
|---|---|---|
| `drip.questions_sent` | `day_index`, `child_id`, `channel` (chat \| email), `send_hour_local` | Daily drip out |
| `drip.question_answered` | `day_index`, `question_id`, `answer_type` (chip \| text \| voice \| not_sure \| skip), `latency_from_send_min` | Each answer |
| `drip.doesnt_fit_reported` | `question_id` | Footer feedback |
| `journal.prompt_sent` / `_replied` | `day_index`, `reply_mode` (voice \| text), `reply_length_class` | Evening loop |
| `observation.captured` | `source` (drip \| journal \| voice \| chat), `child_id`, `domain` | Any profile-feeding capture |
| `profile.update_shown` | `child_id`, `domain`, `movement` | "That moved her…" confirmation rendered |
| `hours.autologged` | `child_id`, `minutes`, `source` | Ambient hour capture |
| `benchmark.position_revealed` | `child_id`, `domains_shown`, `observations_count`, `day_index`, `framing` (ahead \| in_band \| focus) | The reveal |
| `dashboard.viewed` | `day_index`, `entry` (note_link \| direct \| reveal) | Dashboard open |
| `weekly_note.sent` / `_opened` / `_replied` | `note_index`, `concierge` (bool) | Saturday loop |
| `activation.achieved` | `wow_minutes`, `observation_days`, `post_note_return` (bool) | All three clauses true (computed nightly) |

### The one funnel dashboard

One screen, four bands, split-by `channel` and `cohort`, weekly grain [M-R can read
it per-family, n<50]:

1. **Reach → account:** landing_viewed → cta_tapped → account_created (+ waitlist
   sub-funnel: joined → invited → claimed). Headline: channel conversion %.
2. **Account → wow:** account → intake → questions (per-child) → generation →
   `wow_delivered` ≤10min % (THE number) → `wow_engaged` %. Annotate median
   `latency_ms` and abandonment step distribution.
3. **Week one:** distinct observation days histogram (0–7), drip answer rate by day
   index (the fatigue curve), reveal delivered % + day, note opened %.
4. **Activation:** `activation.achieved` % by cohort + channel, with the two
   counter-metrics beside it (wow-but-never-engaged %, chips-to-freeform ratio).

Alert thresholds [M-R]: wow p90 latency >150s; wow-delivered-in-10min <60% on any
day with ≥3 signups; drip answer rate day-over-day drop >30%.

---

## Part 7 — Ticket mapping + NEW-TICKET flags

### Coverage against 03-backlog.md

| Journey element | Ticket(s) | Fit |
|---|---|---|
| Auth screen, minimal fields, async verify | M1-01 (Supabase Auth, decided) | Covered. Add acceptance criteria: no email-verification gate pre-wow; identity linking for duplicate signups (Part 2 edge #7) |
| Boring form intake (name/state/kids) | **M2-03 split (i)** | Covered by the split. This doc is the screen spec: birth month+year (not grade, not full DOB), searchable state select, out-of-range sage card |
| 4-questions-per-child + in-chat wow | **M2-03 splits (ii)** | Covered. Spec here: chips-first, one-question screens, "not sure" law, multi-child deferral rule, the why-this-page Callout |
| Week-one drip (3/day) | **M2-03 split (iii)** | Covered in intent; mechanics need NT-4 (scheduler rows, skip/catch-up, per-persona timing, rotation for multi-child) |
| Generation inside a chat turn, latency | M0-03 → M2-05 | Covered. M2-05 already adopts the DS worksheet template. Add: status-line streaming + retry/escalation = NT-8 |
| Design system as build spec | **M1-17** | Covered and load-bearing: the reassurance-first data law in code is what makes the benchmark reveal safe. This doc adds three explicit improvements over `Onboarding.jsx`/`LandingPage.jsx` (header note) that M1-17 should adopt |
| Voice notes + graceful denial/fallback | M0-04, M1-05 | Covered (fallback-shipped-simultaneously law). This doc adds the deferred-permission pattern + pre-permission sheet copy |
| Evening journal prompt, day 1 | M2-07 | Covered. Add: prompt references the wow artifact on day 1; P5's merged single evening touch |
| Logged-confirmation ("that moved her…") | M2-04 + M2-13 | Covered mechanically; the *confirmation UI moment* (`profile.update_shown`) should be named in M2-13's "surfaced in UI with undo" acceptance criteria |
| Benchmark reveal gating | M2-04 (confidence) + M2-08 (dashboard) | Covered. Add acceptance criteria: reveal blocked below observation threshold; strengths-first ordering enforced (M1-17 law) |
| First weekly note, concierge, efficacy before/after | M3-02 + M-R wk6 concierge + M3-11 (manual) | Covered by the M-R plan explicitly |
| Hours in week one | M3-05 subset (pulled forward, M-R wk5) | Covered; the all-out-of-range wow pivot (Part 2 edge #3) depends on it |
| Email rail | M1-08 | Covered. Note: M1-08 is NOT in the M-R week list; the drip + journal + weekly note all need it by M-R wk5. Flag: pull M1-08 (trimmed: 4 templates) into M-R (see ❓7) |
| Conference kit | M0-07 [M-R wk1] | Covered |
| Landing + waitlist | M-R wk6 line item | Under-specified: see NT-1 |
| Marketing site full | M4-07 [GA] | Covered for GA; this doc's channel proofs are input to it |
| Abuse on signup | M4-06 [GA] | M-R relies on the invite gate as the abuse control (acceptable at n≤50) |

### NEW-TICKET flags

- **NT-1 — Invite + waitlist service [M-R, blocking wk6].** Code redemption at
  signup (URL-carried + typed fallback), cohort codes with caps + soft overflow,
  personal share links per subscriber with `invited_by` attribution, waitlist table
  (email, state, kids' age bands, channel), invite-email send with saved-state
  resume, expiry. The M-R plan says "invite codes" and "landing page w/ waitlist"
  but no ticket exists. Size: M.
- **NT-2 — PWA shell + add-to-home-screen flow [M-R].** Manifest, icons (DS app-icon
  spec exists in `brand-logo-lockup`), iOS illustrated A2HS overlay, Android
  `beforeinstallprompt` handling, `pwa.*` events, re-offer-once rule. Size: S–M.
- **NT-3 — Product analytics emission + funnel dashboard [M-R].** The `events` table
  exists (M1-02) but nothing ticketed emits the Part 6 schema or renders the funnel
  dashboard. Concierge-scale version can be a nightly SQL + one internal page.
  Size: M.
- **NT-4 — Drip scheduler mechanics [M-R].** Dispatcher rows for the 3/day
  questionnaire: per-family send-hour (P5 timing), multi-child rotation, skip/pause
  rules (2 ignored days ⇒ pause), question-order engineering (early-yes bias, P3
  softening), voice-ramble auto-answer routing hook. Builds on M3-10 patterns but is
  needed before M3-10 ships; keep it minimal. Size: M.
- **NT-5 — Out-of-range child handling [M-R, blocked on ❓ Sidney call #3].** The sage
  card, hours/journal-only child mode, "materials on the way" states, the all-kids-
  out-of-range wow pivot, and the "tell you the moment it changes" promise mechanism
  (a flag flip when M5-06 ships). Size: S–M once the call resolves.
- **NT-6 — Programmatic SEO pages [GA build, M-R start].** `/states/{state}/…` pages
  fed by the M3-05 ruleset (statute + last-verified rendered), `/materials/{age}/
  {topic}` with un-gated samples, brand one-pager (`homa homeschool` SERP defense,
  needed in M-R per A2 edge #1). SEO lead time justifies early skeleton. Size: L.
- **NT-7 — Channel-variant landing bands [M-R].** One landing, four hero/proof
  variants (conference continuity, "{friend} invited you", skeptic-ordered fold,
  state/age SEO bridge), `variant` in analytics. A slice of the M-R wk6 landing
  line item, made explicit so it's scoped. Size: S.
- **NT-8 — Generation status streaming + retry/escalation [M-R].** Real pipeline
  status lines to the waiting screen, >120s reassurance state, failure → retry queue
  → email delivery → Sidney alert (the "within the hour, I promise" machinery).
  Stretch: pre-generation from partial answers during Q3/Q4. Attach to M1-04/M2-05
  acceptance criteria or stand alone. Size: M.

---

## ❓ Open questions for Sidney

1. **Landing pricing truth.** `LandingPage.jsx` shows $9/$19/$39 three-tier; the brief
   says $29/$49; M-R week 6 says a single $29 Payment Link. Assumed here: **one $29
   plan on the M-R landing**, tiering deferred to GA. Confirm, and update the kit.
2. **Trial mechanics for the invite cohort.** Council V1 sets trial = promotional
   credits, no card; M-R wk6 says Payment Link $29. Assumed here: invite families
   start free (no card), and the payment moment (personal Payment Link, concierge
   conversion after week-one value) belongs to workstream 3. Confirm the sequencing
   so the landing's "free to start, no card" claim is safe.
3. **Age-range ICP (your call #3 in 09).** Blocks NT-5 copy, the A2/A4 landing
   age-honesty lines, and the SEO materials-page range. This doc assumes option (a):
   own preK–2, handle out-of-range gracefully. P2's journey is written to that
   assumption.
4. **Voice/likeness posture (your call #4).** Assumed option (a) per kickoff: the
   pre-permission sheet says "you talk," and nothing invites recording the child.
   If (b), the permission copy and journal prompts need a consent layer.
5. **Wordmark casing in running copy.** The DS readme says all-caps HOMA is reserved
   for the wordmark, but kit copy uses "HOMA" mid-sentence ("HOMA's got the rest").
   This doc uses "Homa" in sentences and HOMA only as the wordmark/promise line.
   Bless one rule; it touches every string in M2-01.
6. **Social proof honesty.** The kit's "Loved by 12,000+ homeschooling families" and
   the avatar pile cannot ship. Proposed M-R replacement: Alessa's real testimony +
   real artifact photos + "built by a homeschool family." OK to name/photo her?
7. **Email in M-R.** M1-08 isn't in the M-R week list, but the day-1 journal prompt,
   drip fallback, weekly note, and invite emails all need transactional email by wk5.
   Pull a trimmed M1-08 (4 templates: welcome/invite, journal prompt, drip digest,
   weekly note) into M-R wk4–5?
8. **Geolocation state pre-fill.** Rejected here as creepy-at-minute-1 (a location
   permission dialog before any trust). Agree, or is a coarse IP-based *suggestion*
   (no permission dialog) acceptable?
9. **Conference cohort code mechanics.** One shared code per conference (assumed;
   simple, leak-tolerant with caps) vs per-flyer unique codes (attribution-perfect,
   print-expensive). Affects M0-07 print run.
10. **The 10-minute wow SLA vs model reality.** Part 2 budgets 45–120s generation.
    If M0-03 measures worse on the full art pipeline, the fallback order is: simpler
    art model for the FIRST page only → pre-generation from partials (NT-8 stretch)
    → text-first worksheet with art arriving by email. Pre-agree the order so a
    latency surprise in M0 week doesn't stall M2-03.
