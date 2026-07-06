# UGC · Homa intro (mom presenter, Marketing Studio)

hook: "Planning tomorrow at 10pm again?" (spoken + on-screen inside 2 seconds)
length-target: 15s (Marketing Studio UGC single take, ~45 spoken words)
mode: ugc, presenter synthesized from brief (warm mom, mid 30s, kitchen)

## Claims guardrail for this ad

The presenter INTRODUCES Homa (real, pre-launch, waitlist open). She never
claims to be a customer, never cites results, never promises outcomes. Every
line describes real product behavior or the real waitlist. "We're building"
keeps the pre-launch status honest.

## Beats (gated: reader 2026-07-05, editor 2026-07-05, rewrites applied)

1. HOOK (0-2s): To camera, kitchen, warm, unhurried: "Planning tomorrow at
   10pm again?" On-screen: "Planning tomorrow at 10pm again?"
2. WHAT IT IS (2-9s): One breath per idea: "This is Homa, an AI homeschool
   assistant we're building. Practice with your kid's name on it, and an
   hours log that writes itself." On-screen: "Homa: practice with their name
   on it. A log that writes itself."
3. THE FEELING + CTA (9-15s): "The what-do-we-do-today? Carried for you.
   The waitlist is at thankshoma dot com, if that sounds like your kind of
   calm." On-screen: "The what-do-we-do-today, carried. thankshoma.com ·
   Waitlist open"

Spoken total: ~44 words, a calm 15-second read. Three beats. One CTA.
Every spoken idea has a sentence-case on-screen equivalent, so the story
works muted: the 10pm problem, what Homa is, the carried feeling, the link.

## Presenter and scene brief (for the generation prompt)

Warm, real-looking mom in her mid 30s, comfortable sweater, morning kitchen
with honest homeschool mess (workbooks, crayons, a read-aloud stack), phone
propped or handheld selfie framing, natural light, UGC energy: talking to a
friend, not presenting. No children on camera. Cream, clay, and sage tones
in the scene where natural.

## Generation log (reproducibility)

- Take 1 (REJECTED): `marketing_studio_video`, mode ugc, 15s, 720p, 9:16,
  product id bfe1ff74-0262-4b76-86dd-7afd5f00f200 (Homa, imported from
  thankshoma.com). Rejected because the presenter held up a phone showing a
  fabricated app interface, which violates the no-fake-product-UI claims
  rule. Result kept for reference:
  https://d8j0ntlcm91z4.cloudfront.net/user_2zdokGh7BDcXq7kUhDXHw7JGrCp/hf_20260706_024607_51cff42c-492c-4a19-8dde-551b7fac6648.mp4
- Take 2 (STAGED as video.mp4): same job with an explicit no-phone-screen,
  no-app-interface constraint in the prompt. 15.1s, 720p, h264 + aac audio.
  Result: https://d8j0ntlcm91z4.cloudfront.net/user_2zdokGh7BDcXq7kUhDXHw7JGrCp/hf_20260706_025542_4bb47376-0ee0-4b7f-8103-7a9cdeca5fff.mp4
- video-captioned.mp4: take 2 with the gated sentence-case captions burned
  in locally via ffmpeg drawtext (hook 0.3-2.2s, what-it-is 2.2-9s,
  feeling + CTA 9-15s). This is the postable master.
- thumbnail.png: frame at 1s of take 2.

## Founder review notes (honest flags)

1. The presenter holds a small Homa-branded card around seconds 4 to 7. The
   all-caps wordmark on it reads as a brand-card prop (wordmark treatment,
   allowed on UI surfaces); the card's fine print is AI-garbled pseudo-text.
   Visible but small. If it bothers you, take 3 can add a no-props
   constraint.
2. The voiceover was generated from the exact gated lines, but I could not
   machine-verify the spoken words match them. Watch once with sound before
   approving.
3. Marketing Studio synthesized the presenter (no Soul ID, no real person's
   likeness requested).
