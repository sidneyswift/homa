# Delta: current native onboarding/paywall vs. the 94%-paywall-view article

Comparing [`current-state-audit.md`](current-state-audit.md) against
[`article-94-percent-paywall-view-rate.md`](article-94-percent-paywall-view-rate.md).
Goal here is just to name every gap and every point of friction between the
two, not to decide yet which gaps are worth closing. That decision belongs
in the spec, after Sidney has weighed in.

## Screen-by-screen mapping

| Article step | Homa today | Match? |
| --- | --- | --- |
| 0. Welcome + ATT + variant tagging | `hello` (no ATT, no variant tagging, no analytics SDK) | Partial: same slot, none of the instrumentation |
| 1. Name (first ask, pre-account) | Parent name asked on `you`, screen 3, **after** account already exists | Different position, different order |
| 2. Gender | Does not exist | Missing |
| 3. Usage frequency | Does not exist | Missing |
| 4. Referral source | Does not exist | Missing |
| 5. Goals (desire before features) | `intent` screen ("what should we do first?") does this job | **Already present**, different framing |
| 6. Favorites / preferences (investment) | `kids` screen's "what does X love" / "what's X working on" does this, but about the *child*, not the parent, and it's load-bearing product input, not personalization theater | **Already present**, different subject and purpose |
| 7. Social proof + rating prompt | Does not exist | Missing |
| 8. Notifications permission | Does not exist | Missing |
| 9–12. Pain points ×4 | Does not exist; Homa never asks the parent to describe frustration/stress | Missing |
| 13. "Personalizing…" fake progress | `making` screen, but it's a **real** worksheet build (~85s floor), not staged | Different: real, not theater |
| 14–15. Stats screens tied to pain points | Does not exist | Missing |
| 16. Paywall, as a deliberate sequence step | Paywall exists but is **not a step in the walk at all**: it's a global gate that ambushes whichever screen you're on once a backend flag flips | Structurally different, see below |
| Account last, only after purchase | Account is **first**, before any onboarding screen | Opposite order |

## The four gaps that matter most (not just "missing screens")

1. **Homa has no designed paywall moment, and the real trigger is more
   deliberate than it first looked, but just as invisible to the walk.**
   Correction from an earlier pass: the free window does NOT end from a
   simple column stamp. It ends at one specific, founder-ruled choke point
   (`onboardingCompletionReached()`, all three of profile-complete +
   has-a-child + has-a-scored-report) that every channel shares. For
   native, that resolves to one concrete moment: **the instant she answers
   her first question in the `ChecklistTakeover` questionnaire embedded in
   the `making` screen.** That's a real, intentional screen doing real
   work (see current-state-audit.md §1), not an accident. The gap is that
   nothing downstream of it (`reveal`, `next`) knows it happened, and the
   trigger only fires *if* she engages the checklist at all: skip it, and
   the wall's timing becomes unpredictable, landing whenever a report
   first gets scored days or weeks later. The article's paywall is always
   screen 16 in the same state for everyone; Homa's can land mid-walk for
   one family and not at all during onboarding for another.

2. **Account-first vs. account-last is a real product constraint, not
   just a style choice.** Homa cannot show a personalized worksheet
   (its actual "aha" moment, arguably stronger proof than the article's
   generic stats screens) without knowing the kid's name, age, and
   interests, and those currently get written as a real `children` row
   mid-walk (`kids.tsx`, `addChild`), implying an account already exists.
   A true "account last" flow would need either a guest/local-only capture
   step before any account exists, or a redefinition of what counts as
   "the app" before signup. This needs a decision, not an assumption
   either way.

3. **Homa's flow is functional/data-collection-first; the article's is
   emotional/persuasion-first.** Every existing Homa screen produces
   something the product needs (a name, an age, an interest list, a real
   worksheet). None of them exist purely to build trust, amplify pain, or
   create investment as a psychological tactic. The article's steps 2–4,
   7, 8, and 9–15 are *entirely* persuasion infrastructure with no direct
   product function. Porting them wholesale means adding screens whose
   only job is conversion, which Homa has never done before. That is worth
   naming explicitly rather than importing by default.

4. **Some article tactics may conflict with Homa's existing house rules.**
   Two specific ones:
   - The "personalizing…" screen is explicitly described as fake progress
     ("~4-5 seconds," "checklist of things being customized") regardless
     of whether real personalization work is happening. Homa's equivalent
     screen (`making`) is real and has a founder ruling behind it (D7:
     "react lines are generated live... no curated line bank," and the
     `alive-making-screen` work cited in the current-state audit) that
     the walk always shows a *true* state. Faking progress may cut against
     that.
   - Stats screens use a generic, possibly-cherry-picked statistic
     ("X% of people in this situation report Y"). Homa's copy law is
     "never a verdict on a child" and the product's actual identity leans
     on made-for-your-kid specificity, not population-level stats about
     strangers. Whether a stats screen fits Homa's voice, or whether the
     "proof" beat should instead lean harder on the real worksheet Homa
     already made, is a real design choice.

## Where Homa may already be doing something *better* than the article's baseline

Worth not losing in a rewrite:

- The `kids` screen's investment step produces a **real, usable artifact**
  (an actual personalized worksheet) rather than a promise that
  personalization is coming. The article's flow doesn't get its own proof
  moment until stats screens 14–15, which are generic. Homa's proof (the
  `reveal` screen) is specific to this exact kid.
- Every answer autosaves and the walk is resumable from any point
  (`onboarding-state.ts`); the article's flow doesn't describe resume
  behavior at all, and a 17-screen sequence with pain points and stats
  screens raises the cost of losing progress on an interruption.

## Open questions this raises for the spec

- [ ] Does Homa want a fixed number of persuasion-only screens at all, or
      does it want to keep every screen functional and instead fix the
      *timing/reliability* of the existing paywall trigger?
- [ ] Is "account last" achievable for Homa given kid-data requirements,
      or does the spec target "account first, but everything after account
      creation follows the article's psychological ordering"?
- [ ] Which article tactics (ATT, notifications ask, rating prompt,
      referral source, gender, usage frequency) are worth adding at all for
      a homeschool app, versus which are conversion tactics for a
      different category of app (this needs Sidney's judgment, not just a
      structural copy)?
- [ ] Should the "make the wall a deliberate screen" fix be a real,
      insertable "next" step in the walk (article's model), or should it
      stay a global gate but with the *trigger condition* changed so it
      reliably fires in sync with the walk's own state?
