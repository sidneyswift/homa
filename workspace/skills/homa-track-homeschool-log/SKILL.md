---
name: homa-track-homeschool-log
description: Log homeschool lessons and activities in the Obsidian vault when the parent shares what the child did — photos, voice notes, or descriptions. Use when the parent reports on a lesson, activity, or learning moment. Also use when updating the child's progress, compiling subject pages, or maintaining the Obsidian knowledge base.
---

# Homeschool Logging

Log lessons in Obsidian and keep the compiled knowledge base current.

## The Three-Step Rule

Every time the parent shares what they did, do ALL THREE:

1. **Log it** — create/update daily entry in `Lessons/YYYY-MM/DD.md`
2. **Compile it** — update the relevant `Subjects/` page(s)
3. **Update profile** — if it changes the child's level or reveals something new, update `the-child.md`

## Lesson Log Format

File: `~/Documents/<vault>/Lessons/YYYY-MM/DD.md`

```markdown
# YYYY-MM-DD — Day of Week

## Subject Name
- **Activity:** What they did
- **Materials:** Curriculum page, worksheet, activity name
- **How the child responded:** Engaged? Struggled? Loved it? Pivoted?
- **Level/Progress:** Where he's at now
- **Notes:** Anything notable

## Another Subject
...
```

If the file already exists for today, append new sections — don't overwrite.

## Subject Page Updates

File: `~/Documents/<vault>/Subjects/{Subject}.md`

Subject pages are **compiled knowledge** — the current state of the child's progress, not a log dump. Update with:

- Current level/ability
- Recent milestones
- What's working, what isn't
- Vocab lists (for Spanish), skill progressions, etc.
- Links to recent lesson logs: `[[Lessons/YYYY-MM/DD]]`

## the-child.md Updates

File: `~/Documents/<vault>/the-child.md`

Update when you learn something new about the child's:
- Interests or favorites
- Learning style observations
- Developmental milestones
- What motivates him

## Cross-Linking Rules

- Every lesson log links to relevant `[[Subjects/X]]` and `[[Curriculum/X]]` pages
- Subject pages link back to recent lesson entries
- New curriculum mentions → create or update `Curriculum/` page

## Maintenance

During heartbeats, periodically check:
- Are subject pages current with recent lessons?
- Any orphan lesson logs not linked from subject pages?
- Is `log.md` up to date with recent vault changes?
- Is `index.md` current if new pages were created?

See `references/vault-structure.md` for the full vault layout.
