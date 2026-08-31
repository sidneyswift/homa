# Delta: current native onboarding/paywall vs. "Onboarding 10x better" (7 tips)

Comparing [`current-state-audit.md`](current-state-audit.md) against
[`article-2-onboarding-10x-better.md`](article-2-onboarding-10x-better.md)
and the screens described in
[`screenshots-observed-article2.md`](screenshots-observed-article2.md).
This is a second, independent lens on the same flow; [`delta.md`](delta.md)
covers the first article's screen-sequence claims; this one covers a
different framing (7 general principles rather than one prescribed order),
so read them together rather than expecting identical conclusions.

## Tip-by-tip

| Tip | Homa today | Verdict |
| --- | --- | --- |
| 1. Define the activation moment | Already defined and already strong: the real worksheet appearing on `reveal` is a genuine, specific proof moment, arguably better than either example screenshot's proxy (a game-style achievement badge, a generic chart), because Homa's proof is the literal product output, not a stand-in for it. | **Asset, not a gap.** Don't dilute this by adding a fake achievement moment on top of it. |
| 2. Show value before asking for effort | Direct contradiction: account creation (the single biggest ask: email code, real signup) happens **first**, before any screen shows what Homa does. `hello.tsx` explains the product only after the account already exists. | **Real gap, and now confirmed by two independent sources** (this tip and article 1's "account last" rule agree). Two data points converging is a stronger signal than either alone. |
| 3. Ask only useful questions (answers must visibly change the experience) | Strong existing match: `kids` screen's "what does X love" / "what's X working on" answers go directly into the real worksheet content, not cosmetic personalization. | **Asset.** This is the tip Homa already satisfies best of the seven. |
| 4. One clear action per screen | Mostly followed (`kids` screen's sub-steps are genuinely one question each). One minor violation: `you` screen asks for parent's name AND state on a single screen. | **Small, low-risk fix candidate**, not a structural one. |
| 5. Make it animated and interesting (motion, haptics, satisfying transitions) | **Uneven, not absent.** `making-show.tsx` already invests real Reanimated motion: the easel sheet breathing, ink-dot "she's drawing" cues, fact-chips dropping in with spring physics, a tap-to-spark decoration. That is genuinely in the spirit of this tip. But `intent`, `kids`, and `you` are comparatively flat: static chip grids and plain screen replacements, no equivalent motion investment. | **Real gap, but a narrower one than "no motion at all"**: the gap is *inconsistency*, not a blank slate. See the dedicated motion note below; this is also the one tip static screenshots (ours or the article's) cannot actually verify either way. |
| 6. Make it personal (one emotionally resonant stat from their own answer, not generic population data) | Homa doesn't currently generate anything like this. Closest existing counterpart is the real worksheet itself (personal, but not framed as a statistic/insight). | **Open design opportunity**, and notably a *narrower, safer* version of delta.md's open "stats screen" question: one true, specific, kid-related number (not a barrage of generic population percentages) sits more comfortably inside Homa's existing voice law ("never a verdict on a child," specificity over population stats). |
| 7. End with a meaningful result, not a generic "done" screen | Already matches: `reveal` shows the actual finished worksheet immediately before `next`'s doors. Homa does not have a generic "you're all set" screen. | **Asset.** The Walkify screenshot's twist (showing the reward, THEN asking for login) is the more interesting idea buried in this tip: could `reveal` (already a real result) double as the account-creation moment instead of account being first? Flagged as a new open question below, not a decision. |

## Net read

Four of the seven tips (1, 3, 4, 7) are things Homa's current flow already
does well or nearly well; this article is not a case for rebuilding
everything. The two real structural gaps (2: account timing, 5: motion
consistency) both echo findings already on the table from article 1 and
the app research, which raises their priority rather than adding new
scope. Tip 6 is a genuinely new, low-risk idea worth carrying into the
spec's open questions.

## Open questions this adds (append to delta.md's list, don't replace it)

- [ ] Could `reveal` (the real worksheet, already a "meaningful result")
      double as the account-creation moment, Walkify-style (reward first,
      login/signup second) instead of account being the very first
      screen? This would resolve the account-timing gap without inventing
      a guest-mode data model, IF a worksheet can be generated and held
      for an anonymous session before an account exists. That's a real
      technical question, not just a design one; flag for whoever owns
      the eventual implementation.
- [ ] Is a single, true, kid-specific personalized-stat moment (tip 6)
      worth designing, distinct from and instead of the generic
      population-stats screens delta.md was skeptical of?
