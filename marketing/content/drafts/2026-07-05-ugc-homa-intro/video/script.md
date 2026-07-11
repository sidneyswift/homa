# UGC · Homa intro, take 3 (conversational, benchmark map feature)

> Historical draft, not approved or published. Its source signal, checklist,
> benchmark-map, product-state, and route premises require a new evidence pass.
> Per-channel captions are missing and Postiz is unauthenticated. Do not
> distribute.

hook: "Does anyone actually know where their homeschool kid is at?" (spoken inside 2 seconds)
length-target: 15s (~46 spoken words)
mode: ugc, presenter synthesized from brief (warm mom, mid 30s, kitchen)
founder direction (2026-07-05): completely conversational, no salesy sayings,
no pitch; feature is the free national-benchmarks map; product is an app, no
paper props; real brand lockup on the end card.

## Claims guardrail for this ad

She introduces an app she came across, in her own words. She never claims
usage history or results. Feature claims stay product-true: answer questions
about your kid (a checklist for the parent, never a test for the child), see
where they stand compared to national benchmarks, free. No "behind", no
sibling or peer comparison, no outcome promises. The end card is composited
locally from the real design-system lockup, never AI-rendered.

## Beats (gated: reader + editor ran twice, 2026-07-05; 32 spoken words, 2.5 w/s)

1. HOOK (0-2s): To camera, kitchen, mid-thought like she just put the kids
   down: "Where's your kid actually at?"
2. THE THING (2-10s): "There's this app, Homa. A few questions, nobody tests
   him, and you see where he stands next to national benchmarks."
3. THE KICKER (10-13s): "And that part's free. I know."
4. END CARD (13-15s): composited locally: real Homa lockup, thankshoma.com,
   "A gentle checklist for you, free" on cream #FBF7F0.

## Caption plan (burned in locally, sentence case)

Editor-gate notes applied: 32 words fits 13s of speech unhurried; the hook
fits 2s; "exactly" cut (precision overclaim); the for-you idea carries on
screen in caption 2.

- 0.3-2.2s: "Where's your kid actually at?"
- 2.2-10s: "Homa: a few questions, never a test for them." + "You see where
  they stand, next to national benchmarks."
- 10-13s: "And that part is free. (I know.)"
- 13-15s: end card carries the lockup, URL, and "A gentle checklist for
  you, free".

## Presenter and scene brief (for the generation prompt)

Warm, real-looking mom in her mid 30s, comfortable sweater, evening or
morning kitchen, honest lived-in texture, handheld selfie framing, natural
light, talking to a friend energy, mid-thought, unhurried. NO props: no
phone screens, no app interfaces, no paper cards, no printed materials, no
logos in scene (the real lockup is composited locally). No children on
camera. Cream, clay, sage tones where natural.

## Generation log (reproducibility)

- Take 1 (REJECTED): `marketing_studio_video`, mode ugc, 15s, 720p, 9:16,
  product id bfe1ff74-0262-4b76-86dd-7afd5f00f200 (Homa, imported from
  thankshoma.com). Rejected: presenter held a phone showing a fabricated
  app interface (claims rule). Reference:
  https://d8j0ntlcm91z4.cloudfront.net/user_2zdokGh7BDcXq7kUhDXHw7JGrCp/hf_20260706_024607_51cff42c-492c-4a19-8dde-551b7fac6648.mp4
- Take 2 (REJECTED by founder direction 2026-07-05): no fake UI, but the
  presenter held a paper Homa card with garbled fine print; founder ruled
  the product is an app (no paper props) and the script was too pitchy.
  Reference:
  https://d8j0ntlcm91z4.cloudfront.net/user_2zdokGh7BDcXq7kUhDXHw7JGrCp/hf_20260706_025542_4bb47376-0ee0-4b7f-8103-7a9cdeca5fff.mp4
- Take 3 (STAGED as video.mp4): this file's conversational script, STRICT
  no-props constraint (nothing held, no screens, no paper, no logos in
  scene). 15.1s, 720p, h264 + aac.
  Result: https://d8j0ntlcm91z4.cloudfront.net/user_2zdokGh7BDcXq7kUhDXHw7JGrCp/hf_20260706_040431_696582b2-6182-4d2d-83fc-33154c85a681.mp4
- video-captioned.mp4 (the postable master): take 3 plus local ffmpeg
  compositing: the caption plan above burned in sentence case, and the last
  2 seconds fade to an end card rendered headlessly from the REAL
  design-system lockup (clay house mark + bounced Fredoka wordmark, tokens
  per docs/homa-design via apps/web globals) with thankshoma.com and
  "A gentle checklist for you, free". No AI-rendered text in the master.
- thumbnail.png: frame at 1s of take 3.

## Founder review notes (honest flags)

1. The voiceover was generated from the exact gated lines, but spoken-word
   fidelity is not machine-verified. Watch once with sound before
   approving.
2. Marketing Studio synthesized the presenter (no Soul ID, no real
   person's likeness).
3. The free benchmarks checklist this ad points at is the lead-magnet
   feature, live at thankshoma.com/onboarding (built as /map, renamed
   2026-07-06). That publish blocker is cleared; normal staging gates
   still apply.
