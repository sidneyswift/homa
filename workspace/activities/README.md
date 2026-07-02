# Activities

> 🤖 MAINTAINED BY HOMA — one activity per (domain, subdomain) pair.

Each file here is a single 10-minute activity the parent can do with the child to push one specific subdomain forward. Activities are research-backed, age-appropriate, and tied to the child's current position.

## File naming

`{domain_key}__{subdomain_key}.json` — e.g.:
- `social_emotional__self_regulation.json`
- `math__subitizing.json`
- `phonics__segmenting.json`

The double-underscore separates domain from subdomain.

## Schema (v1)

```json
{
  "schema_version": 1,
  "domain": "social_emotional",
  "subdomain": "self_regulation",
  "title": "The Calm-Down Toolkit",
  "duration_minutes": 10,
  "frequency": "3x per week",
  "current_position_when_drafted": "at_age",
  "target_position": "12mo_ahead",
  "expected_impact": "the child moves from at-age to 12mo+ ahead in 4-6 weeks",
  "what_you_need": ["A stuffed animal the child knows by name", "5 quiet minutes one-on-one"],
  "instructions": [
    "Pick a calm moment, NOT during a meltdown.",
    "Hold the stuffed animal: 'Mr Moo looks frustrated. What can he do?'",
    "Offer 3 simple strategies: belly breaths, big squeeze, ask for help.",
    "Have the child show Mr Moo how to do one of them.",
    "Praise the strategy by name: 'You taught Mr Moo to breathe — that's a superpower.'"
  ],
  "why_this_works": "Self-regulation has to be learned in calm moments, not in the heat of frustration. Pretend play removes the personal pressure: the child is the coach, not the patient. Multiple studies show this narrate-rehearse-reinforce pattern outperforms direct instruction at 3-4y.",
  "how_to_know_its_working": "Within 4-6 weeks: the child spontaneously names a strategy when frustrated, or asks Mr Moo to do one. Milestone: hearing 'I feel ___' come out unprompted.",
  "graduate_when": "the child uses one of the calm-down strategies on his own during a real frustrating moment, 3+ times in one week.",
  "next_activity": "Naming feelings together — the parent narrates her own emotions out loud during the day, modeling the same toolkit.",
  "research_basis": ["Research/2026-05-04-social-emotional.md"],
  "generated_date": "2026-05-05",
  "regenerate_after": "2026-08-05"
}
```

## Lifecycle

Activities are regenerated when:
1. **Subdomain position changes** — e.g., self_regulation goes from `at_age` → `12mo_ahead`. The old activity is archived (moved to `_archive/`) and a new one generated for the next push.
2. **the parent reports graduation** — the parent tells Homa "the child did X this week" matching `graduate_when`. Old activity archived, `next_activity` becomes the new draft.
3. **>90 days stale** — `regenerate_after` date passed. Homa refreshes during next nightly research run for that domain.
4. **Manual request** — the parent taps "Generate this activity" on a placeholder page → triggers generation.

## Where activities flow

- `~/.openclaw/workspace/activities/{domain}__{subdomain}.json` — source of truth
- `~/.openclaw/workspace/activities/_archive/` — graduated/superseded activities (kept for history)
- `dashboard-deploy/{domain-slug}/{subdomain-slug}.html` — public web page (auto-generated)
- Subject pages link each subdomain to its activity page
