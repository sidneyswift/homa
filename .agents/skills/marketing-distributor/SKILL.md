---
name: marketing-distributor
description: Publish a staged bundle's APPROVED formats, and only those, on an explicit founder instruction like "publish <bundle> <formats>". Blog = copy MDX + images into apps/web and verify the build. Social = Postiz CLI (auth check, upload media, posts:create per channel). Email = blocked until founder ruling DM7. Writes distribution.md and moves the bundle to content/published/. NOT for approving formats (the human edits meta.yml) and NOT for drafting or staging (marketing-demand-engine).
---

# Marketing distributor

The only skill allowed to move content out of `content/drafts/`, and it moves
nothing a human has not marked `approved`. It never half-publishes: a format
either fully ships or fully reports why it cannot.

## Preconditions, checked before anything ships

1. The founder explicitly asked to publish this bundle, naming formats or "all
   approved". A routine or orchestrator run never counts.
2. Read the bundle's `meta.yml`. Formats not `status: approved` are refused by
   name ("article is still draft; skipping"). Zero approved formats = stop,
   report, done.
3. Read `marketing/AGENTS.md` if not already in context.

## Channel procedures

**Blog (works today, git is the channel):**
1. Copy `article.mdx` to `apps/web/content/blog/<slug>.mdx` (slug = bundle
   slug). Copy `images/` contents to `apps/web/public/blog/<slug>/`.
2. Prove the bundle article and web copy are byte-identical. Fix inside the
   bundle and re-copy; never hand-edit only the `apps/web` mirror.
3. Verify: `pnpm --filter web typecheck && pnpm --filter web build`. Inspect the
   built article output or local route, not only the command exit code. Confirm
   intended tables, headings, and links rendered as HTML; no Markdown pipes or
   link syntax are visible; the current product link and CTA are present; and
   no stale product-state language appears in visible copy.
4. Commit: `Blog: publish <slug>`. Canonical URL:
   `https://thankshoma.com/blog/<slug>`.

**Social via Postiz (blocked-on-human until accounts exist):**
1. Follow the `postiz` skill (`.agents/skills/postiz/SKILL.md`) exactly:
   `postiz auth:status` first; every media file through `postiz upload` and
   use the returned `.path` (Rule 2 there); `postiz integrations:list` to map
   channels to integration IDs.
2. Per approved social format: video channels (TikTok, Instagram, YouTube,
   Facebook) post `video/video.mp4` with that channel's caption file;
   Pinterest posts `pin/pin.png` with pin.md title/description and the
   article's canonical URL; X posts `x.md` text (with the canonical URL).
   Platform settings per the postiz skill's per-platform sections.
3. Schedule: post immediately unless the founder gave times. If the founder
   asked for staged scheduling, use `-t draft` in Postiz and say where to
   review.
4. If auth fails or an integration is missing: STOP that channel, publish
   nothing on it, and print exactly which founder step is missing
   (tracked as `founder-action` GitHub Issues; see issue #183)
   (register handle / connect in Postiz / `postiz auth:login`). Other approved
   channels proceed.

**Email (blocked until DM7 is ruled):**
Refuse with the reason: the waitlist form's promise ("email only used for
your invite") has not been resolved into a consent ruling. Point at spec §10
and the DM7 founder-decision issue (#182). Once DM7 is ruled option (a) or (b): send via
Resend using `RESEND_API_KEY` from `apps/web/.env.local` (never committed),
recipients per the ruling's scope, aggregate reporting only.

## After publishing

1. Write `distribution.md` in the bundle: one line per shipped format with
   canonical URL and timestamp; one line per refused format with the reason.
2. `git mv` the bundle dir from `content/drafts/` to `content/published/`
   (it moves when at least one format shipped; killed-everything bundles move
   too, with distribution.md saying so).
3. Update the source signal's file if needed (it stays `used`).
4. Update the status column in `marketing/workflows/demand-engine.md` if
   reality changed (a channel came alive).
5. Commit: `Marketing: publish <bundle> (<formats>)`.

For a blog, publishing is not complete at the commit. Ship through the normal
branch, pull request, required-check, merge, and Vercel production flow. Wait
for the merge deployment to report Ready, then fetch the canonical article,
blog index, and sitemap. Verify status 200, canonical metadata, Article and
Breadcrumb JSON-LD, index and sitemap inclusion, intended rendered structures,
current internal links, and no stale product-state language in visible copy.
Record the verified canonical URL in `distribution.md`.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish: this skill runs only on explicit founder instruction, per
format, per bundle. No family data. No secrets in this folder. Voice issues
found this late go back through the bundle, not patched in place silently.
