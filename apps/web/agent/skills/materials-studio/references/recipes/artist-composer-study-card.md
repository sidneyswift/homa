# Artist / composer study card

A Charlotte Mason picture-study and composer-study portfolio card. One
card per artist or composer, reused week after week across a study
rotation: name banner, a frame for the artwork or a listening icon, a
"where they were from" map or photo circle, and a short reflection box.
Designed to be collected into a running binder across the school year.

Great for: ages 4-10, Charlotte Mason picture study and composer study,
art appreciation, music appreciation, portfolio-building across a
36-week rotation of artists or composers. Pairs with the picture-study
routine of gazing at one work for a few quiet minutes, hiding it, and
recalling details from memory before the child fills in the card.

Always html path. The frame, circle, and box proportions need to line up
consistently across every card in the set so the finished portfolio reads
as one cohesive collection, not a pile of mismatched pages.

Design patterns (all binding for artist-composer-study-card):

- **Header tag**: a small palette icon and "Artist Study" label for a
  picture-study card, or a music-note icon and "Composer Study" label for
  a listening card.
- **Name banner**: the artist or composer's full name in large, decorative
  type (`font-size: 32px; font-weight: 700;`), centered or left-aligned
  below the header tag.
- **Artwork/portrait frame** (artist card only): an ornate or scalloped
  bordered box, left blank for a printed photo of the artwork or the
  child's own sketch of it to be glued in. Composer cards skip this box;
  use the extra space to enlarge the reflection box instead.
- **"Where they were from" circle**: a circular bordered frame with the
  caption "Where they were from," left blank for a glued-in map clipping
  or photo.
- **Favorite-work box** (artist card only): a small bordered box labeled
  "My favorite work by this artist," for the child to draw or glue their
  pick.
- **Reflection box**: a wide bordered box at the bottom with a stem
  sentence in the child's voice: "When I look at [artist]'s work, I
  think about..." for artists, or "When I listen to their music, I think
  about..." for composers. Leave the rest blank for dictation or drawing.
- **One card per person**: never combine two artists or two composers on
  one card. The set is meant to be collected, not condensed.
- **Consistent template, changing name**: every card in a rotation uses
  the identical layout; only the name, header tag, and (for artists) the
  frame content change week to week.

```html
<style>
  .study-card { font-family: 'Andika', sans-serif; padding: 24px; }
  .study-tag { display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; color: #6b6259; margin-bottom: 8px; }
  .study-name { font-size: 32px; font-weight: 700; color: #221e1a;
    margin-bottom: 16px; }
  .study-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    margin-bottom: 16px; }
  .study-frame { border: 3px solid #221e1a; border-radius: 6px;
    min-height: 180px; }
  .study-circle { border: 2px solid #6b6259; border-radius: 50%;
    aspect-ratio: 1 / 1; display: flex; align-items: center;
    justify-content: center; text-align: center; font-size: 12px;
    color: #6b6259; padding: 12px; }
  .study-reflection { border: 1.5px solid #6b6259; border-radius: 6px;
    padding: 14px; min-height: 90px; font-size: 14px; }
</style>
```
