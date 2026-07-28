# Competitor teardown: the bar for Homa iOS (researched 2026-07-28)

Method: web research plus a live pull of the iTunes Search/Lookup API on 2026-07-28 for US App Store ratings and the "homeschool" query. Caveat: the iTunes Search API approximates on-device App Store search ranking (it excludes Search Ads and personalization) but it is the best external proxy and was captured fresh today.

## 1. The reference apps (the general-ed bar)

### Duolingo (iOS id 570060128)

- **Live rating (2026-07-28):** 4.73 stars, 5,350,844 ratings. Updated 2026-07-27 (ships continuously).
- **Onboarding:** 38 screens. Personalization quiz first (language, proficiency, goal, daily time commitment, motivation type), then the first lesson is completed BEFORE any account or paywall. The design intent per the [Tasu teardown](https://tasu.ai/library/duolingo): every screen increases what the user has to lose. Notifications are requested during onboarding, then re-asked after a streak exists, when the user has "something to protect." The home-screen widget ask is likewise deferred to the moment of maximum investment.
- **Paywall:** soft paywall after the first lesson. Opens with a "Try now" CTA, no price on the first screen, four plan options of which half are family plans. Roughly 10% of ~60M MAU convert; 2025 revenue $1.037B.
- **Price (2026):** Super $12.99/mo or ~$83.99-95.99/yr; Family $119.99/yr for up to 6; Max (AI tier) $167.99/yr. Annual plan discounted 50-60% every January ([dealnews](https://www.dealnews.com/features/duolingo/cost/), [languageappguide](https://languageappguide.com/pricing/duolingo-cost/)).
- **Retention:** streaks (the core loss-aversion asset), Duo mascot emotional attachment, daily streak emails, follower notifications, weekly stat reports, leagues, widget with mood states.
- **Review themes:** gamification and progress feel praised; hearts/energy limits and ad pressure on free tier are the recurring gripes.
- **One thing to steal:** the two-stage permission ask. Ask for push/widget only after the family has something to protect (a streak, a plan in flight, a first printable). Homa should never fire the iOS push prompt on first launch.

### Duolingo ABC (id 1440502568)

- **Live rating:** 4.25 stars, only 3,736 US ratings. Last updated 2023-08-02, effectively abandoned.
- **Model:** completely free, no ads, no IAP. A trust-builder for the parent brand.
- **Review themes:** parents praise ad-free, genuinely effective reading practice ([Common Sense parent reviews](https://www.commonsensemedia.org/app-reviews/duolingo-abc-learn-to-read/user-reviews/adult)); complaints: no corrective teaching (it marks wrong without explaining), lesson navigation forces repetition.
- **One thing to steal:** the "free child surface, monetize the parent" structure. Also a warning: even a giant let its kids companion go stale for 3 years; freshness is a visible differentiator.

### Khan Academy Kids (id 1378467217)

- **Live rating:** 4.80 stars, 128,197 ratings. Apple Editor's Choice, Common Sense Top Rated. Ranks #8 today for the App Store query "homeschool" without being a homeschool app.
- **Model:** 100% free, nonprofit, zero ads, zero IAP. That fact IS the review moat: top reviews are variants of "100% free and my kids learn so much."
- **Onboarding:** parent email/Google/Apple signup, then child profiles (name, age, avatar), multiple children supported from the start ([Khan Kids setup docs](https://khankids.zendesk.com/hc/en-us/articles/360006537272-How-do-I-set-up-an-account)). Personalized learning path per child; parent dashboard with progress.
- **Review themes:** praise: free, high quality, ages 2-8 breadth. Complaints are minor and technical (keyboard glitches).
- **One thing to steal:** multi-child profile creation as a first-class onboarding step, and the weekly parent progress email loop. Homa cannot match free, so it must match the feeling of "this app is on my side, not extracting from me."

### Prodigy Math (id 950795722)

- **Live rating:** 4.76 stars, 237,740 ratings. Separate companion app "Prodigy for Parents" (id 1597129900): 4.85 stars, 14,873 ratings.
- **Onboarding:** kid-first. The child creates a wizard character (name, appearance, items) and is playing in the fantasy world before any account friction; the parent account is optional and links afterward, from which parents see progress, send motivational messages, and grant in-game rewards ([Prodigy parent FAQ](https://prodigygame.zendesk.com/hc/en-us/articles/115005952803-Getting-Started-with-Prodigy-Math-Parent-FAQ)).
- **Paywall/price:** free full math curriculum; membership gates cosmetics, pets, and progression perks. Math Plus $14.95/mo or $88.95/yr; Ultra (math+science+English) $19.95/mo or $118.95/yr ([Brighterly pricing breakdown](https://brighterly.com/blog/prodigy-membership-cost/)).
- **Review themes:** kids love it; the durable complaint class is upsells aimed at children: constant membership pop-ups, kids begging parents, premium kids visibly advantaged in class. Fairplay and 21 partners filed an FTC complaint in 2021 over manipulative marketing to children ([Fairplay](https://fairplayforkids.org/pf/prodigy/)).
- **One thing to steal:** the dedicated parent companion surface with progress plus "send encouragement" actions (a 4.85-star app on its own). One thing to never copy: monetization pressure routed through the child.

### ABCmouse (id 6460300848)

- **Live rating:** 4.17 stars, 109,700 ratings. Subtitle: "Learn Math, Reading & Phonics."
- **Price:** $14.99/mo or $59.99/yr, plus an Assessments add-on ($3.99/mo). Free tier is a daily curated collection capped around one hour weekly, and reviews complain about the cap.
- **Review themes:** the brand is defined by billing anger: Trustpilot 2025 reviews are overwhelmingly about charges after cancellation, impossible cancellation flows, and refund fights ([Trustpilot](https://www.trustpilot.com/review/www.abcmouse.com), [ConsumerAffairs](https://www.consumeraffairs.com/education/abcmouse.html)). Content itself gets praise from parents and teachers.
- **One thing to steal (inverted):** ABCmouse is the cautionary tale. Cancellation friction and renewal surprise convert a 4.8-quality curriculum into a 4.17 rating and a poisoned brand. Homa's Stripe-side cancel and trial reminder must stay one tap and honest.

### Brilliant (id 913335252)

- **Live rating:** 4.74 stars, 31,246 ratings.
- **Onboarding/paywall:** interest quiz, then a hard trial gate: 7-day free trial, card required, with a reminder email on day 5 before the charge ([missiongraduatenm](https://missiongraduatenm.org/brilliant-free-trial/)). Price $24.99/mo or $119.99/yr.
- **Review themes:** praise for interactive learn-by-doing lessons and instant feedback; the number-one complaint is waking up to a surprise ~$160-186 annual renewal with no warning ([BBB complaints](https://www.bbb.org/us/ca/san-francisco/profile/online-education/brilliantorg-1116-532075/complaints), [Trustpilot](https://www.trustpilot.com/review/brilliant.org)).
- **One thing to steal:** the day-5 trial reminder as a trust feature (Homa's Day 4 trial reminder from PR #273 is already at parity; keep it and market it). Also: renewal reminders, which Brilliant skips and bleeds ratings for.

### Outschool (id 1594191740)

- **Live rating:** 3.3 stars, only 110 ratings, for a well-known brand. A live demonstration of pricing-model damage.
- **Review themes:** roughly a 50% surcharge for buying classes in-app versus the website (Apple commission passed through), a credits/membership pivot reviewers call confusing and designed to squeeze, force-quits, rigid rescheduling ([App Store reviews](https://apps.apple.com/us/app/outschool/id1594191740?see-all=reviews&platform=iphone), [Common Sense parent reviews](https://www.commonsensemedia.org/website-reviews/outschool/user-reviews/adult)).
- **One thing to steal (inverted):** never ship a credits system, and never let app and web prices visibly diverge. Homa's single $19/mo price is an asset; keep the iOS purchase story coherent with it.

### Khanmigo (adjacent AI bar)

- $4/mo or $44/yr for parents/learners, free for teachers ([khanmigo.ai/pricing](https://www.khanmigo.ai/pricing)). Socratic tutoring, top Common Sense marks for safety and privacy. It anchors the "AI tutor" price floor very low; Homa must sell family operations plus materials plus records, not raw tutoring minutes, or the $19/mo looks expensive against $4.

## 2. Homeschool-native tools

### Homeschool Planet (web-first; iOS id 6639586865)

- $7.95/mo or $69.95/yr, one-month free trial where trial data carries into the paid account ([Smarter Learning Guide](https://smarterlearningguide.com/homeschool-planet-review/)). Deep planner: Google Calendar sync, per-child logins, transcripts, curriculum-publisher lesson plan marketplace.
- The iOS app is an afterthought: 4.5 stars from just 10 ratings, released late 2024; reviews cite session timeouts and a blank feel.
- Steal: trial data carrying over into the paid plan (no restart penalty), and publisher-integrated lesson plans.

### Homeschool Panda (id 1470263093)

- 3.22 stars, 32 ratings, last updated June 2024. Tiers: free community, ~$5/mo essentials, $7.99/mo pro. All-in-one planner, attendance, portfolio scans, plus a homeschooler social network.
- Review themes: decent record-keeping, but bugs (date defaults, title editing) and slow support. The all-in-one breadth is shallow everywhere ([Homeschool Moment comparison](https://homeschoolmoment.com/compare/homeschool-panda)).
- Lesson: breadth without polish caps you at 3 stars in this category.

### AI homeschool entrants, 2025-2026 (the direct-competitor set)

- **Homeschool Planner AI: Uschool** (id 6469048740, live since Nov 2023): 4.72 stars, 80 ratings, ranks #10 for "homeschool" today. Photograph any curriculum's table of contents and it organizes it; AI persona "Ivy" gives guidance; AI-generated personalized curricula. $4.99/mo or $47.90/yr. Reviews praise attendance tracking for state compliance and AI planning time savings; complaints are scheduling gaps and bugs. Carries an explicit "AI content is for reference only, NOT accredited" disclaimer.
- **HomeschoolPlanner.com "Homeschool Planner"** (id 6745445641, released 2025-06-12): 4.27 stars, 22 ratings. AI scheduling assistant that rebalances lessons when life happens, plus an on-demand AI worksheet generator for K-8, plus a student companion app. $59.99/$119.99/$199.99 per year tiers. Positioning line: "an experienced homeschool administrator in your pocket."
- **Homeschooly** (Oct 2025), **Homeschool Scheduler** (Feb 2026), **Rooted** (May 2026): new planner-trackers with 3 to 17 ratings each. The shelf is filling but nothing has escaped double-digit ratings.
- **HomeTrail** (id 6476961667, Apr 2024): 4.87 stars, 107 ratings, free. Subtitle "The path to a happy homeschool." Warm attendance/nature-time/journal tracker; reviews praise simplicity and the subject pie charts.
- **Homeschool AI OS** ([homeschool-aios.com](https://www.homeschool-aios.com/), Florida launch Apr-May 2026, web): builds every subject around one theme, Florida-ready records and standards tracking, AI coach. Signals where the category is heading: AI plan + state compliance in one.
- **LittleLit AI** ([pricing](https://www.littlelit.ai/pricing)): full AI K-12 curriculum at $299/child/yr or $35/child/mo; approved ESA vendor in TX, GA, LA, UT (public-money channel Homa should note). Independent review scored it 3/5 for shallow hands-on learning ([kidsaitools](https://www.kidsaitools.com/en/articles/littlelit-ai-review-2026)).
- **OpenEd SmartPath**: free AI curriculum finder; OpenEd's honest-assessment essay on AI tutors shapes homeschool-parent skepticism ([opened.co](https://opened.co/blog/ai-tutors-homeschool)).

## 3. What ranks for "homeschool" in the App Store today

Live iTunes Search API pull, US, 2026-07-28, top results in order (rating, count):

1. Homeschool: Good & Beautiful, 3.47, 350 (curriculum brand companion; reviews complain of broken video playback and support that dead-ends in FAQs)
2. Homeschool Scheduler, 4.82, 17 (new Feb 2026 planner)
3. BrainPOP, 4.73, 34,244
4. Acellus, 4.49, 31,933
5. Khan Academy, 4.57, 109,106
6. IXL, 4.35, 203,110
7. ANTON, 4.84, 6,652
8. Khan Academy Kids, 4.80, 128,197
9. Twinkl, 4.89, 2,445
10. Homeschool Planner AI: Uschool, 4.72, 80
11. HomeTrail, 4.87, 107
12. Big Math Flash Cards, 4.22, 39,834
14. Hooked on Phonics, 4.50, 17,468
15. Epic, 4.72, 518,490
16. Homeschooly, 4.0, 8
17. Homeschool Planner (HomeschoolPlanner.com), 4.27, 22
18. Rooted, 5.0, 3
19. Homeschool Planet, 4.5, 10

**Reading of the board:** the query is split between giant general-ed apps that merely mention homeschoolers (BrainPOP, IXL, Khan, Epic) and homeschool-native apps that are tiny (nothing homeschool-native above 350 ratings, and the #1 homeschool-native result sits at 3.47 stars). No one owns "homeschool + AI" at scale. This is an open ASO lane.

**Listing patterns among the natives:** titles are keyword-stuffed toward "Homeschool Planner" ("Homeschool Planner AI: Uschool"); subtitles are plain function or feeling statements ("Home School Tool. Plan Classes", "The path to a happy homeschool", "Live online classes", "Learn Math, Reading & Phonics"). Screenshot decks show dashboards, checklists, attendance grids, and gradebooks; the compliance artifacts (transcripts, report cards, attendance for the state) are what reviews thank them for. Nobody's screenshots show a conversation, a generated worksheet, or a child's finished work.

## 4. The 5 patterns Homa iOS must match

1. **Value before the card ask.** Duolingo runs 38 screens and a completed lesson before the paywall; Prodigy has the child playing before any account. Homa's chat-first onboarding with the first-making artifact moment is the right shape: the paywall belongs after the first personalized artifact exists, and the signup-paywall funnel should be scored on that ordering.
2. **Trust-clean billing, loudly.** Brilliant's day-5 trial reminder is the only thing standing between it and ABCmouse-grade rating damage; ABCmouse and Outschool show that billing complexity and cancel friction, not content, are what crater education-app ratings. Homa: one price, trial reminder (already shipped, PR #273), one-tap cancel, renewal notice. Say so in the listing.
3. **Multi-child from minute one.** Khan Kids, IXL, Prodigy's parent dashboard, Uschool: every winner treats per-child profiles and per-child progress as onboarding, not settings. Homa's family model already fits; the iOS surface must expose it immediately.
4. **A retention loop built on something to protect.** Duolingo's streak plus deferred permission asks; Khan Kids' weekly parent email. Homa's equivalents (weekly report, Friday letter, morning brief, planner week) should anchor a push strategy that is earned late and always reassures before informing. Never fire the iOS notification prompt at first launch.
5. **Compliance receipts on screen.** Attendance, hours, transcripts, and state-reporting artifacts are the single most-thanked feature class across homeschool-native reviews (Uschool, HomeschoolPlanner.com, Homeschool Planet, Panda). Homa's records and progress surfaces must be visible in the first three screenshots, not buried.

## 5. The 3 places Homa can leapfrog

1. **Own the empty "homeschool + AI" lane at scale.** Today's best homeschool-native listing has 350 ratings at 3.47 stars, and the AI entrants (Uschool 80, HomeschoolPlanner 22) are unpolished indie planners. A design-system-quality app with a keyword-honest title ("Homa: AI Homeschool Assistant" shape), a feeling subtitle, and 100+ early ratings would take the query. None of the giants will build homeschool-native.
2. **Close the loop from conversation to finished artifact.** Every competitor either plans (planners) or drills (curriculum apps). None goes from a parent's sentence to a printed, child-specific worksheet, packet, or lesson with progress captured afterward. HomeschoolPlanner.com's worksheet generator is the closest attempt and has 22 ratings. Homa's materials-studio plus printables plus journaling is the demo moment; make it screenshot one and the App Preview video.
3. **Be the parent's ally, not the child's slot machine.** Prodigy carries an FTC complaint for upselling through kids; ABCmouse carries a decade of billing anger; Outschool converted loyalists into 1-star reviewers with a credits pivot. The trust vacuum is enormous, and homeschool parents are the most trust-sensitive segment in education. Homa's laws (offers never commands, no monetization pressure on children, reassure-before-inform, honest tool claims) are a positioning weapon: state them in the listing and in App Review notes, and pair them with the multi-channel reality (chat, SMS, voice, planner, printables) that no competitor's app can follow.

## Sources

- [Tasu: Duolingo onboarding teardown](https://tasu.ai/library/duolingo) · [UserGuiding Duolingo UX breakdown](https://userguiding.com/blog/duolingo-onboarding-ux)
- [Dealnews: Super Duolingo cost July 2026](https://www.dealnews.com/features/duolingo/cost/) · [LanguageAppGuide Duolingo pricing](https://languageappguide.com/pricing/duolingo-cost/)
- [Common Sense: Duolingo ABC parent reviews](https://www.commonsensemedia.org/app-reviews/duolingo-abc-learn-to-read/user-reviews/adult) · [EducationalAppStore Duolingo ABC review](https://www.educationalappstore.com/app/duolingo-abc)
- [Khan Kids account setup](https://khankids.zendesk.com/hc/en-us/articles/360006537272-How-do-I-set-up-an-account) · [Common Sense Khan Kids parent reviews](https://www.commonsensemedia.org/app-reviews/khan-academy-kids/user-reviews/adult)
- [Brighterly: Prodigy membership cost](https://brighterly.com/blog/prodigy-membership-cost/) · [Fairplay: 7 reasons to say no to Prodigy](https://fairplayforkids.org/pf/prodigy/) · [Prodigy parent FAQ](https://prodigygame.zendesk.com/hc/en-us/articles/115005952803-Getting-Started-with-Prodigy-Math-Parent-FAQ)
- [Brighterly: ABCmouse pricing](https://brighterly.com/blog/abcmouse-pricing/) · [Trustpilot ABCmouse](https://www.trustpilot.com/review/www.abcmouse.com) · [ConsumerAffairs ABCmouse](https://www.consumeraffairs.com/education/abcmouse.html)
- [myelearningworld: Brilliant pricing](https://myelearningworld.com/brilliant-pricing/) · [BBB Brilliant complaints](https://www.bbb.org/us/ca/san-francisco/profile/online-education/brilliantorg-1116-532075/complaints) · [Brilliant free trial mechanics](https://missiongraduatenm.org/brilliant-free-trial/)
- [Outschool App Store reviews](https://apps.apple.com/us/app/outschool/id1594191740?see-all=reviews&platform=iphone) · [Common Sense Outschool parent reviews](https://www.commonsensemedia.org/website-reviews/outschool/user-reviews/adult)
- [Smarter Learning Guide: Homeschool Planet](https://smarterlearningguide.com/homeschool-planet-review/) · [Heart and Soul Homeschooling review](https://heartandsoulhomeschooling.com/online-homeschool-planner-review/)
- [Homeschool Panda App Store](https://apps.apple.com/us/app/homeschool-panda/id1470263093) · [Homeschool Moment vs Panda](https://homeschoolmoment.com/compare/homeschool-panda)
- [Khanmigo pricing](https://www.khanmigo.ai/pricing) · [kidsaitools Khanmigo review](https://www.kidsaitools.com/en/articles/khanmigo-review-2026)
- [Homeschool AI OS](https://www.homeschool-aios.com/) · [LittleLit pricing](https://www.littlelit.ai/pricing) · [kidsaitools LittleLit review](https://www.kidsaitools.com/en/articles/littlelit-ai-review-2026) · [OpenEd on AI tutors](https://opened.co/blog/ai-tutors-homeschool)
- Live App Store data: iTunes Search API (`itunes.apple.com/search?term=homeschool&entity=software&country=US`) and Lookup API, pulled 2026-07-28; App Store listing pages for ids 1619791153, 6469048740, 6745445641, 6476961667, 1470263093, 6639586865, 6460300848, 1594191740.
