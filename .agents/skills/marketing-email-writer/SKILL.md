---
name: marketing-email-writer
description: Derive the bundle's one waitlist nurture email from the already-gated article (never written independently), subject under 50 chars, body under 200 words, one CTA. Invoked by marketing-demand-engine after the article passes its gates. Output is STAGED ONLY: sending is blocked until founder ruling DM7 (spec 14 §10). NOT for sending (marketing-distributor) and NOT for the article itself (marketing-article-writer).
---

# Marketing email writer

One email per bundle, to people who already leaned in. The cheapest channel to
win and the easiest to burn: an unsubscribe is permanent.

## Procedure

1. Read the gated `article.mdx` (post-gates version) and
   `marketing/voice/house-style.md`. The email derives from the article's one
   idea; it never introduces a second one.
2. Write `email/email.md` in the bundle:

```markdown
subject: The 20-minute Sunday plan
preview: What three kids and one planner taught us about hours.

Hi, it's Sidney from Homa.

[Body: under 200 words. One idea from the article, retold the way you'd text
a friend, not summarized like a newsletter. Reassure before inform. One CTA,
usually the article's canonical URL or /waitlist. Sign-off like a person.]
```

3. Rules that decide open-or-archive, from the waitlist-subscriber persona:
   - Subject under 50 chars, sounds like a person, no brackets, no urgency
     mechanics, at most zero emoji.
   - Preview line set deliberately (it renders next to the subject; never let
     it default to the first body line by accident).
   - Remember who she is: she signed up for an invite. News that moves her
     timeline beats content that fills a calendar slot.
   - Exactly one CTA. Three CTAs is zero CTAs.
4. Hand back to the orchestrator, which runs the full gates on it
   (waitlist-subscriber persona, then editor).

## DM7, the consent gate (restated so it cannot be missed)

The live waitlist form promises "we'll only use your email to send your
invite." Until the founder rules DM7 (spec
`docs/homa-planning/14-marketing-demand-engine.md` §10), every email this
skill produces is a staged draft, and `marketing-distributor` will refuse to
send it, correctly. Do not design around this; it is a promise to real people.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish or auto-send. No source, no claim. No family data. Voice
per `marketing/voice/house-style.md`.
