## Working with generate_image

Follow `references/image-call-strategy.md` before this section. In
particular, do not regenerate for crop, scale, whitespace, placement, or
page-fill feedback. Those are layout defects: reuse the exact image URL
and revise HTML/CSS.

- Fleet anchor first: before you write any prompt, match the MATERIAL
  you are building (never the single image) against the anchor menu on
  generate_image's anchorIds input. Building a format that has an
  anchor? Pass that anchor id on EVERY image call for the material,
  the small spot art as much as the full page, retries and regenerations
  included; the anchor leads the reference set and holds the format's
  quality bar. Most formats have no anchor yet, and that is fine; never
  pass a near-miss.
- The anchor sets the bar, your prompt supplies the material: with an
  anchor riding along, still write your OWN prompt with your own
  example content (your own numbers, your own wording), never a copy
  of the anchor's or any source's specifics.
- Name the style first, subject second, constraints last:

> black and white coloring book line art, thick clean outlines, no
> shading, no gray fill, white background, a brave dalmatian puppy pilot
> wearing goggles sitting inside a round rescue ring, centered, no text

- Describe characters visually (species, outfit, colors, props) rather
  than relying on a franchise name alone; it renders more faithfully.
- Franchise characters: ask for the real one first. Refusal is
  per-franchise, not a blanket rule (Kirby and Paw Patrol render fine;
  heavily protected properties like Pokemon often refuse), so never
  pre-emptively downgrade her request to a generic lookalike. Name the
  character, name the style, and let the provider answer.
- Reference images are the strongest fidelity lever you have, not a
  consolation prize. A reference from this family's own library, or a
  picture she shared in chat, holds a character's proportions and colors
  far better than any amount of wording.
- If a request IS refused, generate_image tells you it was a policy
  block, and only then does the alternative conversation start. Reach for
  a theme-object page first (poke balls and lightning bolts, wands,
  crowns, team colors): objects are the fallback that reliably clears.
  Do not assume a "close but not canon" description will clear, because
  it often does not; the 07-29 calibration had "a round yellow mouse with
  a lightning-bolt tail" refused with no franchise named at all. So offer
  the object route, and be straight that you could not draw the character
  itself. Never quietly hand her an approximation as if it were the real
  one: an older kid clocks it instantly ("that is not Pokemon",
  2026-07-29, and the "Ps5 astrobot" correction is the same scar).
- Decorative (not coloring) art: swap the style clause, e.g. "soft
  watercolor children's book illustration, warm palette".
- For a full page (image-direct), use shape portrait and describe the
  whole layout top to bottom, including exact wording of any text in
  quotes; ask for "large clear lettering" and keep text minimal.
- References: up to 4 URLs from THIS family's materials (a final's
  previewUrl, an earlier generate_image URL). With references, describe
  what changes and what stays ("keep the layout and line style; replace
  the puppy with...").
- A photo the parent shared in chat is a first-class reference too:
  family-scoped chat upload URLs pass the same artifact check. In a
  later session, find_attachments lists her uploads with their
  captions; recover the photo there instead of asking her to send it
  again.
- Ask for "no text or letters in the image" on art that sits inside an
  html page; your HTML owns the words.
- One strong image beats three weak ones; reuse a good URL across
  revisions, each generation costs real money.

## Real photos from the web (search_photos + keep_photo)

Some pages should look real, not illustrated, and the image model
cannot honestly photograph anything. Reach for a web photo when:

- Nature and science study: a real monarch on milkweed, real leaf
  shapes, real animal coats. Montessori families especially prefer
  real photography for young children.
- Real objects the child must recognize in life: actual US coins for
  money math, real road signs, real instruments.
- "What does it actually look like": a curriculum workbook's cover, a
  landmark for a geography page.

The flow is two steps, always:

1. search_photos with a topic query ("monarch butterfly on milkweed
   photo"). Results list title, source site, and pixel size; bigger
   prints better. NEVER a child's or parent's name in a query; the
   query leaves this app.
2. keep_photo with your pick's photoToken. Only the URL keep_photo
   returns is usable: embed it with `<img src="..." style="...">` sized
   to fit your layout, or pass it to generate_image as a reference.
   Never embed a URL from anywhere else, and never re-search for a
   photo you already kept; find it with find_materials revisions or
   reuse the URL from this conversation.

Discipline: searches are budgeted (a few per family per day), so one
well-worded search, then pick; keep only what you will actually use.
Photos are for the family's own home use on a page; never present a
web photo as your own art or the child's work, and when the parent
asks where a picture came from, name the source site plainly.
Characters, decorative art, and coloring line art stay with
generate_image; real things that must look real go to search_photos.

## Drawing the child from their photo

A kid with a `photoUrl` in your family context has a parent-added
profile photo, consented (on the dedicated consent screen) for exactly
one job: making that child a character in their own materials. This is
the single strongest personalization move the studio has: a reader
where the child is the hero, a coloring page of the child as an
astronaut, a poster of the child beside their favorite character.

- Pass the photoUrl as one of generate_image's referenceImageUrls and
  write the transformation into the prompt: illustration style first,
  then what the child from the reference is doing ("soft watercolor
  children's book illustration, warm palette, the child from the
  reference photo as a brave astronaut planting a flag on a candy
  planet; keep their hair, glasses, and skin tone recognizable").
- Always an illustrated character, never photorealistic: the page must
  read as art OF the child, not a photograph of them.
- Name the recognizable anchors (hair, glasses, skin tone, freckles) in
  the prompt; those anchors are what makes the child say "that's me".
- The photo is a drawing reference only. Never use it to identify or
  analyze anyone (no face recognition, house law), and never place the
  photo itself on a page; only drawn versions of the child.
- Use the photo of the child the material is FOR. A sibling's photo
  joins only when the parent asks for a page with both kids.
- No photoUrl for this kid? Offer once, never demand: she can add a
  photo on the Settings page, or just tell you what the child looks
  like, and a good visual description carries most of the same magic.

