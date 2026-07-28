# Simulator walkthrough, 2026-07-28 (iPhone 17 Pro Max, dev build against prod backend)

Signed-in account: "App Review Family" (sswift+homatest@swiftdrtv.com), sandbox=true in prod DB, child Maya 7y 1m. Screenshots in ../screens/ (440x956 pt device).

## What the app is today

Three tabs: Today, Chat, Family. That is the entire app.

1. **01-home-today.png**: Today tab = logo, "Hi App.", one child summary card (name, age, into, working on), a single "Talk to Homa" button, then ~60% empty screen. No today plan, no schedule, no materials, no progress, no celebration, no offers. The tab is named Today but shows nothing about today.
2. **02-chat-empty.png**: Chat empty state is good bones: "Hi App, I'm Homa." + 3 suggestion chips (What should we work on this week? / Make a worksheet for today / We had a rough morning, help me reset). Input placeholder "Tell Homa about your day...". "Start a new chat" kills history (no chat list; single thread only).
3. **03-chat-reply-text.png**: Tapped chip 1. Streaming works, reply arrived fast, quality high, references prior family context ("that sh/ch/th word strip I mentioned last time"). Rendering is plain markdown bubbles; no typing indicator beyond a thin orange progress bar at top, no per-tool activity indication.
4. **04-chat-planner-deadend.png**: Asked "Open the planner and schedule math for Maya on Wednesday morning". Homa: "Maya doesn't have any month or subject plan yet... Plans get built from her progress report with one tap. Want me to point you to that...". The phone app HAS NO progress report surface, so "point you to that" is unfollowable here.
5. **05-chat-planner-cannot.png**: Replied "Yes please build her plan and show me the week". Homa: "I can't build that plan for her from here. Plans get created with one tap on Maya's progress report page... Open Maya's progress report and you'll see a button...". HARD DEAD END on mobile: the agent routes the parent to a web-only surface with no deep link, and claims it cannot act. On web this same request opens a planner canvas. Core planning loop is unusable from the phone.
6. **06-family.png**: Family tab = family card (name, parent, state), child card, then a permanently-expanded raw "Add a child" form (three plain text fields for birth year/month/day, no native date picker). No child edit, no per-child profile page.
7. **07-family-signout.png**: Bottom of Family tab: "Signed in as ..." + Sign out button. That is the only account control in the app. No settings screen, no subscription management, no account deletion (App Review 5.1.1(v) risk: Apple/Google/email sign-in creates accounts in-app, so in-app account deletion is required), no notification preferences, no support/contact, no privacy policy link.

## Also observed

- The gear icon floating over every tab is the Expo dev-menu button (dev build only), but it overlaps content (sits on top of the Family card and chat transcript) even in this build.
- No onboarding of any kind: a fresh user would sign in and land on Today with whatever family state exists; new users get punted to web /onboarding per src/lib/web-links.ts.
- No paywall/subscription surface anywhere in the app.
- Everything runs against prod (thankshoma.com) with the caller's Supabase JWT; chat latency to first token felt ~2-4s, acceptable.
- Visual language: brand cream background, orange primary, Fredoka-ish logo, rounded cards. Consistent with web brand but sparse; zero motion/animation anywhere, zero haptics.

## Sharpest product findings for the plan

1. Chat works and is genuinely good; it is the app's spine and proof the one-brain architecture carries to mobile.
2. The agent's own copy routes users to surfaces that do not exist on the phone (progress report, planner). Until native surfaces or deep links exist, the agent needs channel-aware instructions (it already behaves differently per channel: it refused open_planner from mobile).
3. There is no first-run experience, no paywall, no settings, no deletion, no push. The app cannot legally/practically onboard a paying stranger today.
4. The Today tab is the biggest cheap win: the backend already has plans, materials, progress, hours; the tab shows none of it.
