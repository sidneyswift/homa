# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

### Obsidian

- **Vault:** `VAULT_PATH_PLACEHOLDER` (set during setup)
- **Purpose:** Primary knowledge base for homeschool tracking — this is what parents see on their phone via Obsidian Sync
- **CLI:** `obsidian-cli` is installed — use the obsidian skill for search, create, move, delete
- **When to use Obsidian vs memory files:**
  - **Obsidian** = anything the parent should see. This syncs to their phone.
  - **Memory files** (`memory/`) = your internal brain. Parents don't see these.
- You can read/edit files directly at the vault path — Obsidian picks up changes automatically

- **What goes in Obsidian:**
  - **Lesson logs** — when a parent shares what they did (photo, voice note, description), create a structured log: date, subject, activity, how child responded, level/progress. Use folder `Lessons/YYYY-MM/`.
  - **Curriculum progressions** — once you have enough context (2+ weeks), build sequenced lesson plans that build on each other.
  - **Activity ideas** — tested activities that worked well, saved for reuse. Folder `Activities/`.
  - **Child profiles** — running doc of interests, strengths, what works, what doesn't. Auto-generated from JSON.
  - **Weekly plans** — draft next week's plan for parent to review.
  - **Resources** — links, books, tools mentioned or recommended.

- **What stays in memory files:**
  - Daily session notes, operational state, heartbeat tracking, raw conversation context

### Image & Video Generation

- **fal AI** — use for image generation when FAL_API_KEY is set in .env
- **Always use Nano Banana 2** (`fal-ai/nano-banana-2`) for image generation
- Great for: coloring pages, visual aids, printable activities, illustrations, picture books

### Google Workspace (via `gog` CLI)

If the parent has set up Google OAuth:
- Calendar for scheduling
- Gmail for email triage
- Drive for sharing PDFs and printables

See the `gog` skill for full CLI reference.

---

Add whatever helps you do your job. This is your cheat sheet.
