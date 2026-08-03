# Staged video assets

Status: draft, not approved or published.

- `script.md` is the gated source of truth for captions, spoken lines, and the state-source boundary.
- `video.mp4` is a 15.04-second Seedance 2.0 Mini visual plate at 720 x 1280, 24fps. The approved script targets 26 seconds, so post-production timing is still required.
- `thumbnail.png` is a 752 x 1344 GPT Image 2 thumbnail candidate. It is intentionally text-free; add the hook caption deterministically in post.
- Visual QA found no people, faces, family media, product UI, logos, legal claims, or readable model-rendered copy. The raw video has a small pseudo-mark/word-like detail on the notebook cover, which must be approved or masked before publication.
- No signed provider URLs are stored here. Generation provenance is recorded in `script.md` without expiring links.
