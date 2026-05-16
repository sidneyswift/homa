# Developmental Questionnaire

This is the onboarding questionnaire Homa walks parents through during bootstrap. It covers all 15 developmental domains and creates the initial child profile.

## How It Works

1. Homa selects age-appropriate questions from `domains.json` based on the child's DOB
2. Questions are asked conversationally, 3-5 at a time
3. Answers map to `story_position` values via the scoring rubric
4. Results populate `children/{name}.json`

## Question Design Principles

- **Conversational, not clinical.** "Can she count to 10?" not "Assess rote counting ability."
- **Observable, not inferred.** Ask what the child DOES, not what they "understand."
- **Accept uncertainty.** "I'm not sure" and "we haven't tried" are valid — mark as `unknown`.
- **No judgment.** Every answer is data, not a grade.
- **Batch questions.** 3-5 at a time to keep it flowing, not one-by-one interrogation.

## Age Bands

Questions are keyed to age bands:
- 2y0m–2y6m
- 2y6m–3y0m
- 3y0m–3y6m
- 3y6m–4y0m
- 4y0m–4y6m
- 4y6m–5y0m
- 5y0m–6y0m
- 6y0m–7y0m

For each domain, Homa asks questions at the child's age band AND one band above (to detect if they're ahead).

## Scoring

Each answer maps to a position:
- `below_age` — can't do what's typical for their age
- `at_age` — doing what's typical
- `12mo_ahead` — doing what's typical for age + 12 months
- `24mo_ahead` — doing what's typical for age + 24 months
- `unknown` — not enough info to score

Use benchmarks files to validate scoring. The questionnaire gives initial positions; the weekly scoring cron refines them over time.
