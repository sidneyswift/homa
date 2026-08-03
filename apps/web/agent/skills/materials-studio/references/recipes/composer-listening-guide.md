# Composer listening guide

A one-page active-listening companion for a single piece of music. The
parent plays a recording; the child follows the page. It gives the child
one concrete thing to listen for before the music starts, a short ordered
row of moments to catch as they arrive, and a feeling-response line at the
end. Pairs with the artist-composer-study-card: the card is the per-composer
portfolio page, this guide is the per-piece companion used during actual
listening sessions.

Great for: ages 5-10, composer study rotations, Charlotte Mason music
appreciation, first classical-music listening sessions, program music with
a built-in story (a symphony movement, a named character piece, a seasonal
piece), any family who has a biography of a composer and wants the child
actively listening instead of just hearing.

Always html path. The page is text, boxes, and rules that must line up
cleanly and print in one page; there is no illustration-led surface to
justify image or hybrid work, and the child supplies all drawing.

Design patterns (all binding for composer-listening-guide):

- **Title block**: piece name in large type with the composer's name
  beneath it in smaller type. Include the piece's nickname when one exists
  (children remember "the Surprise Symphony" long before "Symphony No. 94").
- **Listen-for callout**: one bordered callout near the top naming a single
  concrete hook the child should catch, written in plain child language:
  a four-note knock that keeps coming back, a melody that sounds like a
  cuckoo, the moment the storm starts. One hook only; two hooks split the
  child's attention and neither lands.
- **Moment boxes**: 3 to 5 boxes in listening order, each with a checkbox,
  a one-line description of the moment in story language, and a small blank
  sketch area. The child checks or draws each moment as the music reaches
  it. Never more than 5; a first listen cannot track more.
- **Feeling-response line**: a closing stem sentence in the child's voice
  ("This music made me feel...") with a ruled line, matching the reflection
  style of the artist-composer-study-card so a portfolio reads as one set.
- **No music notation**: this is a listening page, not a theory page. No
  staves, note names, or rhythm symbols anywhere; the child needs zero
  reading of music to use it.
- **Pick real, findable pieces**: name pieces a family can actually play
  from a streaming search (title plus composer), and prefer pieces with a
  concrete story or picture for the moment boxes. Purely abstract works
  make weak first guides.
- **One piece per page**: never combine two pieces on one guide. A second
  listening gets a fresh copy of the same guide, not a second column.

```html
<style>
  .listen-guide { font-family: 'Andika', sans-serif; padding: 24px; }
  .listen-piece { font-size: 30px; font-weight: 700; color: var(--homa-ink); }
  .listen-composer { font-size: 15px; color: var(--homa-control-boundary); margin-bottom: 16px; }
  .listen-for { border: 2.5px solid var(--homa-ink); border-radius: 8px;
    padding: 12px 14px; margin-bottom: 18px; font-size: 15px; }
  .listen-for strong { text-transform: uppercase; font-size: 12px;
    letter-spacing: 0.05em; display: block; margin-bottom: 4px;
    color: var(--homa-control-boundary); }
  .moment { display: flex; gap: 12px; align-items: flex-start;
    border: 1.5px solid var(--homa-control-boundary); border-radius: 6px; padding: 10px;
    margin-bottom: 10px; }
  .moment-check { width: 22px; height: 22px; border: 2px solid var(--homa-ink);
    border-radius: 4px; flex-shrink: 0; }
  .moment-text { font-size: 14px; flex: 1; }
  .moment-sketch { width: 90px; height: 58px; border: 1px dashed var(--homa-control-boundary);
    border-radius: 4px; flex-shrink: 0; }
  .listen-feeling { margin-top: 18px; font-size: 15px; }
  .listen-feeling .rule { border-bottom: 1.5px solid var(--homa-ink);
    display: inline-block; width: 60%; }
</style>
<div class="listen-guide">
  <div class="listen-piece">Symphony No. 6, "Pastoral"</div>
  <div class="listen-composer">by Ludwig van Beethoven</div>
  <div class="listen-for"><strong>Listen for</strong>
    Real bird calls hiding in the music: a nightingale, a quail, and a
    cuckoo. Beethoven copied them from birds he heard on his walks.</div>
  <div class="moment"><div class="moment-check"></div>
    <div class="moment-text">1. The music arrives in the countryside,
      calm and happy, like stepping off a wagon into a meadow.</div>
    <div class="moment-sketch"></div></div>
  <div class="moment"><div class="moment-check"></div>
    <div class="moment-text">2. A little brook flows along. Can you hear
      the water moving in the strings?</div>
    <div class="moment-sketch"></div></div>
  <div class="moment"><div class="moment-check"></div>
    <div class="moment-text">3. A thunderstorm crashes in, loud and wild.</div>
    <div class="moment-sketch"></div></div>
  <div class="moment"><div class="moment-check"></div>
    <div class="moment-text">4. The storm passes and a shepherd sings a
      thankful song. Everything feels washed and new.</div>
    <div class="moment-sketch"></div></div>
  <div class="listen-feeling">This music made me feel
    <span class="rule"></span></div>
</div>
```
