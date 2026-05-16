# Children Profiles

Each child gets their own JSON profile: `{name}.json`

The profile is created during onboarding from `_schema.json`. It tracks:

- **15 developmental domains** with subdomains
- **Positions** against age-normed benchmarks (below_age, at_age, 12mo_ahead, 24mo_ahead)
- **Confidence levels** that decay over time
- **Active interventions** and their graduation criteria
- **Interests, sensory notes, learning style**

## Schema

See `_schema.json` for the full empty template. Key fields:

- `name` — child's name
- `dob` — date of birth (YYYY-MM-DD)
- `pronouns` — he/him, she/her, they/them
- `domains.{domain}.subdomains.{sub}` — per-subdomain tracking
  - `current` — what the child can do right now
  - `verified` — date of last observation
  - `confidence` — high/medium/stale/expired/unknown
  - `story_position` — below_age/at_age/12mo_ahead/24mo_ahead/unknown

## The 15 Domains

1. Math
2. Literacy
3. Phonics
4. Writing & Fine Motor
5. Spanish
6. Science
7. Social Studies
8. Art & Creative
9. Gross Motor
10. Fine Motor (general)
11. Social-Emotional
12. Self-Care & Independence
13. Executive Function
14. Language (Oral English)
15. Music

Each domain has 3-9 subdomains for granular tracking.
