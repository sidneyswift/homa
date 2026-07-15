# QA scoring and feedback

## Draft scoring rubric (1-5 per category)

Score every creator draft on these 5 dimensions:

| Dimension | 1 (fail) | 3 (acceptable) | 5 (exceptional) |
|---|---|---|---|
| **Hook strength** | First 0.5s is dead air or "hey guys" | Decent text/question but predictable | Stops the scroll cold — unexpected, emotional, or visually arresting |
| **Clarity** | Audio muddy, framing bad, message unclear | Clean audio, decent framing, message lands | Crystal clear audio, intentional framing, message is unforgettable |
| **Brand alignment** | Mentions AI first, shows children, wrong tone | Hits the product truth, avoids red lines | Nails Homa voice: reassuring, honest, confession-style |
| **Engagement style** | Low energy, reading a script, feels like an ad | Natural energy, mostly authentic | Genuinely compelling — you'd watch even without knowing Homa |
| **Conversion potential** | No reason to download after watching | Curiosity piqued, might check it out | Viewer thinks "I need this right now" |

**Threshold:** Any score ≤ 2 = send back with feedback.

## The one-round rule

One round. One note. Fix it and post.

At scale, 3 rounds of approval = operational bottleneck. If the content
needs more than one fix, pick the most impactful one. The creator learns
faster from shipping 10 videos with incremental notes than from
perfecting 1 video over 3 rounds.

## Standardized feedback language

Use exact phrases so creators learn the vocabulary:

| Phrase | Meaning |
|---|---|
| "speed up to 1.1x" | Pacing drags, tighten the edit |
| "needs a stronger visual hook" | First frame won't stop the scroll |
| "clean background" | Setting is cluttered/distracting |
| "first frame must be compelling" | Thumbnail wouldn't stop a scroll |
| "more natural energy" | Feels scripted or stiff |
| "confession, not demo" | Too much product walkthrough, not enough story |
| "artifact proof only" | Showing or referencing a child — use worksheets/screens instead |

## Daily QA routine (first hour of every morning)

1. Watch every creator video from the last 24 hours.
2. Score each on the 5 dimensions.
3. Give specific feedback using standardized language.
4. Review any drafts waiting for approval (respond within 1-2 hours).
5. Log scores in `marketing/campaigns/<campaign>/scores/`.

## Score file format

```yaml
# scores/yyyy-mm-dd-creator-handle.yml
creator: "@handle"
date: 2026-07-15
video: "description or draft filename"
scores:
  hook: 4
  clarity: 5
  brand: 3
  engagement: 4
  conversion: 4
total: 20
verdict: approved  # approved | revision | rejected
feedback: "needs a stronger visual hook — try on-screen text in first frame"
```
