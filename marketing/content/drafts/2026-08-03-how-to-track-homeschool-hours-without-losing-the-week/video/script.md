# The four fields that save the week

hook: "Still rebuilding the homeschool hours log from memory?"
length-target: 26s

## Beats

1. HOOK (0-2s): **On-screen caption:** “Rebuilding your homeschool hours log?” **Spoken line:** “Still rebuilding the homeschool hours log from memory?” **Shot:** A vertical close-up of a lived-in cream notebook on a kitchen table, with a pencil, a small analog clock, and a few unmarked subject cards slightly out of order. Late-day light and tactile paper texture make the moment feel used, not like a polished planner ad. No people, product UI, or logo.
2. THE FOUR FIELDS (2-8s): **On-screen caption:** “Date · subject or activity · duration · one note” **Spoken line:** “A useful record has four fields: the date, the subject or activity, the duration, and one short note.” **Shot:** The notebook opens to four blank ruled sections. Small coral marks appear on the page, with no legible handwriting or generated text.
3. NOTE NOW, REVIEW LATER (8-15s): **On-screen caption:** “A fresh note now. A short review later.” **Spoken line:** “A note made while the day is fresh is easier to trust. The review can happen later.” **Shot:** The pencil moves between the four sections as the clock hand advances. The coral thread connects the marks without becoming a chart or interface.
4. KEEP THE RULE SEPARATE (15-22s): **On-screen caption:** “Your log records what happened. The official source helps you check what applies.” **Spoken line:** “Your daily log can hold what happened. The official state source helps you check what applies to your family.” **Shot:** The notebook and a blank source card sit side by side. The pencil moves from the day's record to the source card, making the relationship useful and visible without legal text, logos, or fabricated claims.
5. CTA (22-26s): **On-screen caption:** “Homa records hours by subject” **Spoken line:** “Homa records hours by subject and keeps the state-source context nearby. See the homeschool hours tracker at thankshoma.com.” **Shot:** The notebook closes gently with the coral thread visible at the edge. A clean cream end frame leaves room for a post-production URL and Homa Logo.

## Shot plan

- Beat 1: Vertical editorial still life with lived-in kitchen-table texture, cream paper, midnight blue clock, coral pencil detail, late-day light, slow push-in, no people or faces.
- Beat 2: Overhead notebook view, four blank sections, restrained hand-drawn texture, slow page movement, no legible text and no product interface.
- Beat 3: Close crop on pencil, clock, and coral thread, one continuous gentle camera move, no chart, dashboard, or fake app state.
- Beat 4: The daily notebook and an unmarked source card remain side by side as the pencil moves between them, no legal wording or fabricated source.
- Beat 5: Notebook closes, coral thread remains visible, warm cream end frame with negative space for deterministic caption and Logo placement.

## Sound-off plan

The final captions are added in post-production from the lines above. Generated footage remains text-free so the video does not depend on model-rendered typography. A muted viewer should read:

1. Rebuilding your homeschool hours log?
2. Date · subject or activity · duration · one note
3. A fresh note now. A short review later.
4. Your log records what happened. The official source helps you check what applies.
5. Homa records hours by subject

CTA caption: `See the homeschool hours tracker at thankshoma.com`

## Generation notes

- Model: Seedance 2.0 Mini (`seedance_2_0_mini`)
- Provider job: internal generation record, 2026-08-03; signed provider URL intentionally not stored in git
- Input reference: the staged article hero at `../images/hero.png`
- Raw plate: `video.mp4`, 15.04s, 720 x 1280, H.264, 24fps
- Timing note: the approved script is 26s; this model's live duration limit is 15s, so the raw plate compresses the beats and needs deterministic post-production timing before use.
- Full prompt: "Create one continuous vertical 15-second editorial visual plate for Homa. Quiet authority, warm lived-in homeschool kitchen-table texture rather than a polished planner advertisement. Start with a tactile cream notebook, pencil, small midnight-blue analog clock, and a few unmarked subject cards slightly out of order in late-day light. In one gentle continuous camera move, open the notebook to four blank ruled areas, move the pencil among them as the clock advances, let one thin Homa-coral thread connect the marks, place a blank source card beside the notebook, then close the notebook into a calm cream end frame with negative space. Compress the story gracefully without jump cuts. Mineral neutrals, Homa coral #E7602F, midnight #27374D. No people, faces, hands, child likenesses, logos, product UI, dashboards, charts, legal text, readable text, handwriting, captions, watermark, fabricated evidence, or stock-photo sheen. Keep the footage text-free because captions are added deterministically in post-production."
- Visual QA: no people, faces, family media, product UI, or legal claims visible in the reviewed frame sheet. A small pseudo-mark/word-like detail appears on the generated notebook cover, so this raw plate is not publication-ready until a human approves or masks that detail.
- Thumbnail model: GPT Image 2 (`gpt_image_2`), 9:16, 1k, high quality; signed provider URL intentionally not stored in git.
- Thumbnail file: `thumbnail.png`, 752 x 1344 PNG. Visual QA passed at full size and grid size: the hook subject is clear, the image is text-free, and no faces, product UI, logos, or fabricated claims are visible.
