# Homa 📚

**Your AI homeschool assistant.** Homa is an opinionated, deeply knowledgeable homeschool AI that tracks your children's development across 15 domains, generates personalized learning materials, and keeps a compiled knowledge base your whole family can use.

Built on [OpenClaw](https://openclaw.ai). Designed for non-technical parents.

---

## What You Get

- **15-domain developmental tracking** — Math, Literacy, Phonics, Science, Spanish, Art, Gross Motor, Fine Motor, Social-Emotional, Executive Function, and more. Research-backed benchmarks from CDC, Head Start, Common Core, and NAEYC.
- **Personalized content creation** — Picture books starring your kids, flash cards, coloring pages, decodable readers, worksheets — all generated on demand.
- **Obsidian knowledge base** — A compiled wiki that syncs to your phone. Subject pages, lesson logs, curriculum tracking, weekly plans — all auto-maintained.
- **Nightly research** — Homa reads developmental research every night and updates benchmarks while you sleep.
- **Weekly scoring** — Automatic progress assessment with gap analysis and suggested focus areas.
- **10-minute activities** — Research-backed activities for every subdomain, tailored to your child's current level.
- **Email triage** — Scans your inbox hourly and surfaces only what needs your attention.
- **Daily journal** — One simple question per day that feeds into the whole system.
- **Multi-child support** — Track multiple children, each with their own profile, benchmarks, and materials.

## What You Need

1. **A computer that stays on** — Mac mini recommended, but any Mac or Linux machine works.
2. **[OpenClaw](https://openclaw.ai)** — The AI agent platform Homa runs on.
3. **An Anthropic API key** — Homa's brain. Get one at [console.anthropic.com](https://console.anthropic.com).
4. **A messaging app** — Slack, Discord, Telegram, or WhatsApp. This is how you talk to Homa.
5. **(Optional) [Obsidian](https://obsidian.md)** — Free note-taking app. Homa maintains a knowledge base here that syncs to your phone.
6. **(Optional) [fal.ai](https://fal.ai) API key** — For AI image generation (picture books, flash cards, coloring pages).

## Quick Start

```bash
# 1. Install OpenClaw (if you haven't)
npm install -g openclaw

# 2. Clone this repo
git clone https://github.com/sidneyswift/homa.git
cd homa

# 3. Run the setup script
./setup.sh
```

The setup script will:
- Copy Homa's workspace to `~/.openclaw/workspace/`
- Create your Obsidian vault
- Set up cron jobs
- Walk you through API key configuration
- Start OpenClaw

Then just message Homa. She'll introduce herself and walk you through onboarding — who your kids are, what you're teaching, where they are developmentally.

## The Onboarding Flow

When you first message Homa, she'll:

1. **Ask about your family** — names, ages, location, schedule
2. **Learn about each child** — interests, favorites, sensory considerations, learning style
3. **Run the developmental questionnaire** — ~15 minutes per child, covering all 15 domains. Yes/no, counting, and short-answer questions keyed to your child's age.
4. **Generate the first profile** — positions, gaps, strengths, unknowns
5. **Create the knowledge base** — your Obsidian vault, populated with real data about your kids

After onboarding, Homa works proactively — researching at night, scoring weekly, suggesting activities, logging what you share, and generating materials on demand.

## How It Works (Architecture)

```
You (Slack/Discord/etc.)
  ↕
OpenClaw (agent runtime)
  ↕
Homa (workspace + skills + crons)
  ↕
┌─────────────────────────────────────────┐
│ children/{name}.json — per-child profile│
│ benchmarks/ — developmental standards   │
│ activities/ — 10-min targeted activities│
│ skills/ — content creation pipelines    │
│ scripts/ — vault generators, dashboard  │
│ Obsidian vault — parent-facing wiki     │
└─────────────────────────────────────────┘
```

## Skills

| Skill | What it does |
|---|---|
| `child-coach` | The brain — nightly research, weekly scoring, developmental tracking |
| `picture-book` | AI-generated illustrated picture books starring your kids |
| `flash-cards` | Printable flash card PDFs with AI illustrations |
| `coloring-pages` | Line art coloring pages from photos or prompts |
| `decodable-readers` | Phonics-leveled books your child can read themselves |
| `curriculum-builder` | Transcribe textbooks → structured lesson plans |
| `homeschool-log` | Log lessons to Obsidian, compile subject pages |
| `homa-journal` | Daily one-question journal prompt |
| `vault-audit` | Keep the knowledge base honest and current |
| `email-triage` | Surface important emails, ignore the rest |
| `reaction-feedback` | Learn from your 👍/👎 reactions |

## Cron Jobs

| Job | Schedule | What it does |
|---|---|---|
| Nightly Research | 2:14 AM | Picks one domain, reads research, updates benchmarks |
| Weekly Scoring | Saturday 10:18 PM | Rescores all children against benchmarks |
| Daily Journal | 8:00 PM | Posts one journal question |
| Email Triage | Hourly 7AM–10PM | Scans inbox for important emails |
| Dashboard Update | 7:23 AM | Regenerates the web dashboard |
| Vault Audit | Sunday 3:13 PM | Checks vault for staleness and drift |
| Reaction Retro | Sunday 4:07 PM | Weekly digest of feedback reactions |
| Ambient Learning | Every 30 min | Catches signals from chat that were missed in real-time |
| Daily Janitor | 4:17 AM | Rotates logs, ages old files, health checks |

## Project Structure

```
homa/
├── README.md
├── setup.sh
├── .env.example
├── workspace/                  # → ~/.openclaw/workspace/
│   ├── AGENTS.md
│   ├── BOOTSTRAP.md
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   ├── TOOLS.md
│   ├── HEARTBEAT.md
│   ├── children/               # Per-child profiles
│   │   └── _schema.json
│   ├── skills/                 # All 11 skills
│   ├── scripts/                # Generators, dashboard, janitor
│   ├── benchmarks/             # 15 developmental benchmark files
│   ├── practice/               # 10 homeschool practice files
│   ├── activities/             # Activity schema + README
│   ├── questionnaire/          # Onboarding question bank
│   └── reference-images/       # Family photos (you add these)
├── vault-template/             # → ~/Documents/{Family} Homeschool/
└── cron-templates/             # Cron job definitions
```

## Contributing

Homa improves every day through real use. If you build something useful — a new skill, better benchmark research, a curriculum template — PRs are welcome.

## License

MIT

---

*Built with ❤️ by parents, for parents.*
