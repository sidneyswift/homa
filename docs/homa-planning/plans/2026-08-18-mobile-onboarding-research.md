# Mobile sign-in and onboarding: field research and requirements

Date: 2026-08-18. Status: research complete, awaiting founder direction on
archetype (D1 below) before design work begins.

Source: Mobbin MCP sweep across education, health and wellness, AI
assistants, productivity, and family apps, plus a read of the current
mobile auth code. Every referenced flow links to its Mobbin page.

## 1. Where Homa mobile stands today

The app has no onboarding. It has a sign-in wall.

- Cold open: splash, font and session bootstrap, then straight to
  `apps/mobile/src/app/(auth)/signin.tsx`.
- One screen: logo, one tagline line, Apple button, Google button, an
  "or" divider, email and password, reset link, sign in.
- No native account creation. "New to Homa?" opens Safari at
  `/onboarding` (`apps/mobile/src/lib/web-links.ts`), the parent
  finishes on the web, then returns and signs in manually.
- After sign-in: straight into the tabs. No welcome, no first-run
  moment, no personalization, no motion.

The screen itself is competent (guideline 4.8 Apple-first ordering,
accessibility announcements, honest failure copy). The gap is
architectural: the app treats the first five minutes as someone else's
job. Every app studied below treats those minutes as the product.

## 2. What the best apps do: flow anatomy by app

### Duolingo (education, the canonical value-first flow)

[Onboarding flow](https://mobbin.com/flows/ac9d2f58-868d-4fd3-a79c-9655ce6b1522) ·
[profile creation flow](https://mobbin.com/flows/4511e153-c7d5-4b70-b37e-09cc798e49d9)

- Full-bleed brand splash (green field, owl blink) into the quiz, no
  auth gate at all.
- Personalization quiz first: what to learn, current level, daily goal,
  where to start. One question per screen, mascot speech bubbles, a
  progress bar that visibly fills.
- Commitment device: the daily-goal CTA is "I'M COMMITTED", not
  "Continue". Goal options carry identity labels (Casual, Regular,
  Serious, Intense).
- First lesson happens before any account exists. The account ask
  arrives only after the user has progress to lose: "Don't lose your
  progress! Let's create a profile", with a visible "LATER" escape.
- Signup is one field per screen (name, then email personalized as
  "What is your email address, Sam?", then password), social options
  quietly below.

### Headspace (wellness, account-first but warm)

[Onboarding flow](https://mobbin.com/flows/31b21791-dec6-448a-8253-648f5ebbba3e)

- Splash into a live breathing exercise ("Breathe in" with a rising
  orange orb): the product demonstrates itself before a single word of
  pitch.
- Welcome carousel with claims that carry numbers ("Just 10 days of
  Headspace can increase happiness by 16%").
- Account creation up front (form plus SSO and socials), then the quiz.
- The quiz is framed as a reveal, not a survey: "What's your
  mindfulness style? Answer a few questions, and we'll reveal which
  course will lead you toward a healthier mind."
- The recommendation screen shows its work: "For Calm Explorers like
  you", "89K people started", and a "Why this recommendation" row
  citing the user's own answers.
- Trial transparency timeline (Today, In 12 days, In 14 days) before
  any charge.

### Fabulous (wellness, narrative maximalism)

[Onboarding flow](https://mobbin.com/flows/060e3fc0-5785-4ef6-9dc2-dd257a652797) (33 screens)

- Cinematic dark starscapes, a mountain, the user's name written into
  the story ("Mobbin's First Step").
- A letter from the user's future self ("It's me, future Mobbin. I'm
  calling from 2022 because today is an important day for you, for
  us.").
- Science as authority ("A Duke University study states...").
- Behavioral anchors gathered as setup: wake-up time picker feeds the
  first ritual.
- Coaching honesty: "Start Small. Too much change, too fast, can be
  overwhelming."
- Escape hatch on the heaviest screens: "Let me explore first."

### ChatGPT (AI assistant, the anti-onboarding)

[Onboarding flow](https://mobbin.com/flows/08700781-e6b9-4428-8d09-8aff48749c8a)

- Bold color field, four buttons (Apple, Google, email, log in), zero
  pitch. Value prop assumed known.
- Auth hands off to a web view (auth0.openai.com), which reads as a
  seam even in the most-downloaded app in the world: a lesson in what
  to avoid.
- Onboarding is the empty state: suggestion chips ("Create a painting
  in Renaissance-style") teach by invitation, not tour.

### Notion (productivity, setup that becomes content)

[Onboarding flow](https://mobbin.com/flows/5ed77200-e4f1-4053-b071-aa716a704569)

- Sign-in gate carries the brand thesis in five words ("Think it. Make
  it.") over a single illustration.
- Passwordless: email plus a verification code, passkey offered. No
  password is ever created.
- The interest picker ("What are some areas of interest?") seeds the
  actual workspace: pick Habit tracking and a Habit Tracker page exists
  when you land. Setup work becomes owned content.
- Tips carousel uses real device mockups, three screens, skippable.

### The payoff pattern (across quiz-driven apps)

[Life Reset "Building your program..."](https://mobbin.com/screens/96ac6812-b174-4dc5-8a8f-e23364e36989) ·
[Breathwrk "Your custom plan is ready"](https://mobbin.com/screens/2b9e622e-809b-4462-9ac5-4a6b2f696de6) ·
[Oura advisor setup](https://mobbin.com/screens/9d6331d4-76ae-4dc3-9c1a-746e798f6fb1) ·
[Superpower protocol stack](https://mobbin.com/screens/9142fb51-ace4-4fa2-8f43-b606e95d62dc)

Quiz answers are converted into a visible artifact. The formula:
animated progress ("Building your program..." with step checkmarks and
social-proof laurels), then a reveal screen that names what was built
and echoes the user's own goals back as chips. Oura is notable for
life-context options ("I have small kids", "I live a hectic life"): the
quiz asks about the person's life, not the product's settings.

### Sign-in gates worth stealing from

[Sesame](https://mobbin.com/screens/359eeff7-962b-49df-bda6-f3e68e6c094f) ·
[Wispr Flow](https://mobbin.com/screens/b13d07d8-9c54-4900-b67e-82b33b7fb1cd) ·
[Wabi](https://mobbin.com/screens/6e4a0cfe-327c-4be1-b3d8-a83461e18039) ·
[Life Reset](https://mobbin.com/screens/2b9a4e36-5ec0-43be-b0fc-3e4dad73bd26) ·
[Breathwrk](https://mobbin.com/screens/bf5e71ec-4285-4790-a51c-9b737c4b75d8)

- Sesame: a cream field, four words ("Where curiosity strikes"), two
  buttons. The quietest gate studied, and the most confident.
- Wispr Flow: the value claim is the headline ("Start typing 4x faster
  with your voice"), one accent word in color.
- Life Reset: "Sign in later" and "Restore Progress" links under the
  socials; even the auth wall has an escape hatch.
- Breathwrk: one-line credibility ("Backed by neuroscience, used by
  millions") over a breathing animation, socials reduced to two round
  glyphs.

### Family apps (the open lane)

[SHEIN kid profile](https://mobbin.com/flows/e801caa2-03f5-4549-ba0d-4850d7bcc985) ·
[YouTube Kids profile](https://mobbin.com/flows/1d207d54-f174-40e3-9eaa-e14262000c47) ·
[Plex managed users](https://mobbin.com/flows/968e628b-5b80-4154-911c-d3119a53d8c0)

Every "add your child" flow studied is administrative: form fields,
gender radio buttons, date pickers, children's-privacy legalese, the
emotional temperature of a settings page. Not one treats "tell me about
your kids" as the emotional center of the product. For a homeschool
assistant, that moment IS the product. This is Homa's clearest
opportunity to do something nobody in the corpus does.

## 3. Commonalities: the 2026 consumer onboarding grammar

1. Social auth first. Apple and Google buttons dominate; email is
   demoted to a third option or a "More options" link. Passwords are
   disappearing (Notion: verification codes and passkeys).
2. The gate carries the pitch. One headline, one visual, two buttons.
   Terms live in a quiet footnote, agreed by continuing.
3. One question per screen. Big tap targets, generous whitespace, a
   progress bar that visibly moves, back arrow always present.
4. Personalization quiz as the spine, 4 to 8 questions, each answer
   phrased in the user's language, not the product's.
5. The payoff moment. Answers become a visible artifact via a crafted
   "building" interstitial and a reveal.
6. Social proof and science woven in, never a dedicated screen: badge
   laurels, "89K people started", one-line study citations.
7. Warmth in the first three seconds: a character, a breathing orb, a
   full-bleed brand moment. Motion is the brand's first word.
8. Escape hatches everywhere: Skip, Later, "Let me explore first".
   Commitment is invited, never demanded.
9. Notifications and contacts asked in context with a pre-permission
   explainer, never bare at launch.
10. Value before paywall. The trial screen, when it comes, uses the
    Headspace transparency timeline.

## 4. Differences: the three archetypes

| Archetype | Exemplars | Auth position | Spine | Risk |
|---|---|---|---|---|
| Value-first | Duolingo, Life Reset | Last, after progress exists | Quiz then a real first win, account saves it | Anonymous-state plumbing, deferred tenancy |
| Guided-setup | Headspace, Fabulous, Notion | First or early | Quiz builds a personal plan or workspace | Feels like a survey if the payoff is weak |
| Instant-tool | ChatGPT, Sesame | Immediate gate | Empty state teaches by invitation | Zero warmth, assumes fame |

## 5. What this means for Homa specifically

- Homa already has a chat-first onboarding brain on the web (PR #139,
  live in prod). The mobile rebuild should feed that same brain, not
  invent a parallel questionnaire. The native shell owns feel (motion,
  keyboards, progress, auth); the agent owns judgment.
- Homa's voice laws are an unfair advantage here. "She decides and Homa
  suggests", reassure before inform, no verdicts on a child: this maps
  directly onto the warm family-setup moment nobody else builds.
- Quiet authority design contract rules out Fabulous maximalism. The
  target register is Sesame's confidence with Headspace's warmth:
  calm surface, one earned delight per phase, motion with restraint.
- The eject-to-Safari signup is the single worst moment in the current
  flow and the ChatGPT web-view seam confirms even giants pay for it.
  Native account creation (or at minimum an in-app browser that returns
  a session) is table stakes for the rebuild.
- Family setup is the differentiator. "Tell me about your kids" should
  feel like introducing your children to a person who is glad to meet
  them, with each child's card materializing as a kept artifact, not a
  form row.
- The payoff moment writes itself: Homa builds the family's first week
  (or first material) from the conversation, with an honest "building"
  interstitial and a reveal that echoes the parent's own words.

## 6. Requirements for the rebuild

R1. The gate carries the promise: one headline in Homa's voice, one
    warm brand moment, Apple then Google then email, terms as footnote.
R2. No password creation on the happy path: social auth or email code.
R3. Native onboarding end to end: no Safari eject anywhere.
R4. One question per screen, visible progress, back always available,
    skip on everything that is not load-bearing.
R5. Conversation over survey: the chat-first onboarding brain drives;
    native components render its questions as tappable cards where the
    answer set is closed.
R6. Children are introduced, not entered: per-child warm capture, each
    child materializes as an artifact the parent keeps.
R7. A payoff moment: a crafted building interstitial then a reveal of
    something real (first week, first material) that quotes the
    parent's answers back.
R8. Escape hatches: later and skip options; nothing but auth is
    mandatory.
R9. Permissions asked in context with pre-permission explainers, never
    at launch.
R10. Paywall, if present in-flow, comes after the payoff and uses a
    transparency timeline. (Apple IAP rules and the credit-lockout
    ruling in #238 apply; needs its own decision.)
R11. Motion is the brand's first word: a crafted open (logo settle,
    content rise), per-screen transitions, and one earned moment of
    delight at the payoff. Restraint per the design contract.
R12. Returning users never see onboarding: the gate detects an
    existing session and gets out of the way.

## 7. Founder decisions needed before design

D1. Archetype: value-first (taste of Homa before the account),
    guided-setup (account early, conversation builds the family), or a
    hybrid (one free-taste exchange, then auth, then setup).
D2. Native account creation scope: full native signup on mobile, or
    session-returning in-app web auth as an interim.
D3. Whether mobile onboarding creates the family (currently web-owned)
    or captures context and defers family creation to first sign-in.
D4. Paywall position on mobile given App Store IAP rules and the
    web-Stripe wall (needs alignment with #238 credit-lockout ruling).
D5. How much of the web onboarding brain is reused verbatim versus a
    mobile-specific onboarding skill variant.

## 8. Direction settled 2026-08-18 (founder session)

- Archetype: guided-setup with one tap of intent pre-auth. Voice is
  Duolingo character plus Headspace beauty, never producty. Calm's
  pacing: just enough questions, then value fast.
- D1 resolved, refined by founder in-session: sign-in IS the front
  door. The welcome screen and the account screen are one screen
  (Continue with Apple / Google / email code plus a quiet "I already
  have an account" link). A button that only leads to more buttons is
  a wasted tap; any control that adds no user-visible value gets
  removed or merged. Duolingo's deferred-auth (anonymous account
  merged later) was considered and rejected: Homa's aha runs on the
  kids' details, which must never strand on a signed-out device.
- Vocabulary: "wall" means paywall and nothing else. Auth is just the
  door.
- Aha 1 is the custom printable worksheet (child's name, current love,
  working-on level). Aha 2 is the weekly plan, which earns the deeper
  per-child progress questions. Progress report is a plan-lane reward,
  not the acquisition hook (false-positive risk noted by founder).
- Paywall moves late: triggered by the second create, not at the door.
  Exact position still needs the IAP and #238 alignment ruling (D4).
- Onboarding is pausable and resumable everywhere, with a resume chip
  on home. No anonymous worksheet generation, ever.
- Wireframe flow map (v3, plain wireframe): The first ten minutes,
  https://claude.ai/code/artifact/7781a5f9-0b49-4e19-967e-d69dfa7f6a88

## 9. Cadence study: Duolingo and Headspace, screen by screen

Question asked: do the greats ever run back-to-back questionnaires,
where do they breathe (tutorial, feedback, delight), and how often?
Method: full onboarding flows read in order on Mobbin
(Duolingo 20 screens, https://mobbin.com/flows/b0b4f93f-5637-46ec-9d77-49ecda6b991d;
Headspace 21 screens, https://mobbin.com/flows/31b21791-dec6-448a-8253-648f5ebbba3e).
Beat labels: ASK extracts, GIVE returns something (reflection, promise,
delight, celebration), FRAME sets expectations before an ask run,
DO is real product value.

### Duolingo, in order

1. Splash, green field, owl. Brand beat. GIVE
2. Duo says hello in a speech bubble. Every later screen keeps the
   character talking, so even questions read as dialog. GIVE
3. "What would you like to learn?" ASK
4. "How much French do you know?" ASK
5. "Since you know a few words, let's start at Score 10!" Duo reflects
   the answer just given and sets placement. GIVE
6. "Here's what you can achieve in 3 months!" A promise derived from
   the course they picked. GIVE
7. "What's your daily learning goal?" The button is "I'M COMMITTED",
   an ask turned into a pledge. ASK
8. "Let's set up a learning routine!" Coach transition. GIVE
9. "I'll cheer you on from your home screen!" Widget offer, skippable.
   OFFER
10. "Where would you like to start?" carries a RECOMMENDED chip: the
    app gives an opinion inside its own question. ASK+GIVE
11. "Just 7 quick questions before we start your first lesson!"
    Expectation-setting before the longest run. FRAME
12. First lesson. The value moment, pre-account. DO
13. "Don't lose your progress! Let's create a profile." Account ask
    only after there is something to lose, LATER escape. ASK
14. Name, email, password, one field per screen, email personalized
    ("What is your email address, Sam?"). ASK run
15. "Welcome, Sam Lee! Your profile has been successfully created."
    Celebration. GIVE
16. Friends and contacts offers, then home. OFFER

Duolingo cadence string: G G A A G G A G O A+G F DO A A A G.
Longest pure ask run: 3 (the account fields), and it is framed,
personalized mid-run, and celebrated at the end.

### Headspace, in order

1. Splash. GIVE
2. Welcome carousel, claims with numbers ("Just 10 days of Headspace
   can increase happiness by 16%"). GIVE
3. "Welcome to Headspace. Support for all of life's moments." Terms
   checkbox, create account or log in. GIVE then ASK
4. Account form, first and last name, email, password, one screen,
   SSO and socials below. Their entire heavy extraction is compressed
   into a single screen instead of spread thin. ASK
5. "Breathe in." A live breathing exercise with the rising orb. The
   product demonstrates itself as pure delight, placed immediately
   after the heaviest form. GIVE (the breath)
6. "What's on your mind? I want to..." Goal question. ASK
7. "What's your mindfulness style? Answer a few questions, and we'll
   reveal which course will lead you toward a healthier mind."
   The quiz is framed as a reveal game before it begins. FRAME
8. Style quiz, a few single-tap questions back to back. ASK run
9. "Exploring Stillness. For Calm Explorers like you. 89K people
   started. Why this recommendation." The payoff quotes their answers
   back and shows its work. GIVE
10. "How your trial works": Today, In 12 days, In 14 days. GIVE
11. Plan pick, paywall. ASK
12. Home.

Headspace cadence string: G G G A G(breath) A F A A A G G A.
Longest pure ask run: about 3 quiz taps, after framing, immediately
paid off by the reveal.

### The pattern both share

1. Never open with an ask. Both spend 2 to 3 beats giving (brand,
   promise, hello) before extracting anything.
2. Ask runs cap around 2 to 3 beats, then something comes back.
3. Every ask run is sandwiched: FRAMED before ("just 7 quick
   questions", "answer a few and we'll reveal") and PAID OFF after
   (Score 10, the 3-month promise, the style reveal).
4. Answers are visibly used. The give-back derives from the specific
   answer just given, so extraction feels like investment.
5. The delight beat lands right after the heaviest ask (Headspace
   breathes after the account form; Duolingo celebrates after the
   profile fields).
6. A character or brand voice hosts every question, so the
   questionnaire reads as conversation.
7. Back-to-back questionnaires exist in both, but only mid-flow,
   never at the door, always framed, always paid off.

### Extended corpus: character-driven apps (added same day)

- Finch (https://mobbin.com/flows/ab3823c2-2068-4b25-965a-c4a2f9290102):
  opens by giving a possession before any ask ("You hatched a birb!"),
  and the ask for the user's name is reciprocal, made by the character
  after the user names it ("Thanks for hatching me. If my name is Lee,
  what's your name?").
- Cleo (https://mobbin.com/flows/78850b24-4ac4-4c5a-ae91-89014abd6d4d):
  chat-native cadence. Counts its questionnaire out loud with the
  reason ("Be honest in the next 5 qs, Trisha. The more I know, the
  better I can help you"), celebrates completion ("You made it,
  Trisha"), and pays off with an artifact ("Your overview's ready"),
  with on-demand teaching ("how does it work?" answered in three
  bullets). Register is louder than Homa's laws allow; mechanics sound.
- Duolingo ABC
  (https://mobbin.com/flows/63b774b7-a199-4a57-8bee-54ec27c551a4):
  the parent-onboards-child shape. A why-line under every single ask
  ("We'll personalize the experience for this age"), audience routing
  with its reason stated, and the child receives a character companion
  during setup: the give-back living inside kid setup itself.
- Khan Academy Kids: not in Mobbin's corpus (only adult Khan Academy).

These six studies are codified as the agent skill
`.agents/skills/onboarding-cadence/SKILL.md` (beat vocabulary, ten
laws, application checklist, anti-patterns). Future onboarding work
loads that skill instead of rereading this section.

### Marathon corpus (same day, second pass)

Breadth pass across 60+ apps: 13 at flow depth (adding Lemonade,
Calm partial, and the earlier set) and roughly 50 more at
moment level via themed sweeps (commitment rituals, loading theater,
celebrations, permission pre-prompts, journey previews, empathy
interstitials, illustrated quizzes). Named finds worth remembering:
Lemonade's Maya (pre-frames sensitive questions, jokes inside the
honest loading ticker with "Feeding Fluffy", echoes answers with charm
in the quote: "A ridiculously cute, 3-year-old Shiba Inu from New
York"), Life Reset's fingerprint-hold vow, Superpower's sign-your-name
commitment, Mindvalley's "I, commit to:" contract and dated "Day One"
medal, Strava and ChatGPT selling notifications by previewing the
actual notification, BeReal's one-notification honesty, Oura's
reassure-before-inform mindset interstitial, and Me+'s fake-precision
"Analyzing your risk of depression 20%" as the cautionary anti-pattern.
The full catalog with links and Homa translations lives in
`.agents/skills/onboarding-cadence/references/moments.md`; the skill
body carries the distilled laws and the award-winning bar.

### Our v3 scored the same way

Welcome/sign-in ASK, intent ASK, name ASK, age ASK, loves ASK,
working-on ASK, siblings ASK, then the first give at the worksheet:
A A A A A A A G G G. Seven consecutive extraction beats before
anything comes back. The structure is right; the rhythm is wrong.
The fix is not fewer questions, it is give-backs woven between them:
an opening give before the account, a frame before the kid run,
micro-reflections after each kid answer (the child's card visibly
assembling, Homa reacting to "Paw Patrol" in her own voice), a
celebration beat at account creation, and the reveal payoff kept.


