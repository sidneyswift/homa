# Scorer test fixtures

These bundles exist to test `score_bundle.py`. **The failing bundle
deliberately violates the repo's voice laws** (it contains an em dash, banned
phrases, all-caps HOMA, and "behind" framing) so the scorer's catches stay
verifiable. Do not "fix" those violations; they are the test. Nothing in this
folder is real content and none of it ever publishes.

- `failing-bundle/`: every check should flag something. Expected: grounding 1
  (missing signal), voice 4+ (dash, banlist, casing, framing), article 3
  (missing hero, overlong description, retired waitlist state), completeness
  2 (missing caption file, long email subject).
- `passing-bundle/`: minimal clean bundle citing `signals/2026-01-01-fixture-signal.md`.
  Expected: exit 0.

Run both after any scorer change:

```bash
python3 marketing/evals/score_bundle.py marketing/evals/fixtures/failing-bundle --signals-dir marketing/evals/fixtures/signals --scorecards-dir /tmp/scorecards
python3 marketing/evals/score_bundle.py marketing/evals/fixtures/passing-bundle --signals-dir marketing/evals/fixtures/signals --scorecards-dir /tmp/scorecards
```
