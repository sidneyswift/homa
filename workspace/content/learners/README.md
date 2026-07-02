# content/learners/

**Per-child state — the "flowing" half** (the curriculum library in `content/curriculum/` is the
"compounding" half, shared across kids). One folder per child; `_TEMPLATE/` is the skeleton to copy
when a second child starts.

Each child folder holds:
- `README.md` — the **cursor**: which curriculum is active in each subject, where the child is in it, at
  **their own pace** (labeled "year one / year two", **never grade levels** — the parent's rule). The one
  place that answers "where did we leave off?" without Homa reading every log.
- `what-works.md` — the **personalization model** (interests, modality, what landed/what they resist).
  Read before any suggestion/worksheet/research for that child.

**Multi-kid scaling:** a second child reuses the *same* `content/curriculum/` library (built once); they
just get their own `learners/<kid>/` cursor + what-works model, copied from `_TEMPLATE/`, advancing at
their own pace. Build the worksheet once → reuse forever.

Agent-owned; the child's academic *position* lives in `children/<child>.json` (rendered to the Slack
dashboard). This folder is the *learning-style + progress-cursor* layer the profile doesn't capture.
